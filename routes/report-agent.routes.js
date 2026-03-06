/**
 * Report Agent Routes
 * AI chat endpoint for conversational report building.
 *
 * Uses OpenAI function calling — the LLM calls generate_report_config
 * with a structured JSON config that has enum-constrained endpoints.
 * No more fenced-code-block parsing needed.
 */

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const reportLlm = require('../services/report-llm.service');
const { validateReportConfig, VALID_COMPONENT_TYPES, VALID_LAYOUTS } = require('../config/report-config-schema');
const { getDataCatalogByCategory, getByEndpoint } = require('../config/report-data-sources');
const { asyncHandler } = require('../middleware/error-handler');
const envConfig = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Build a data fetcher that calls the Express API using the current user's auth.
 * Passed to reportLlm.chat() so the LLM's fetch_endpoint_data tool can query live data.
 */
function buildDataFetcher(req) {
    const baseURL = `http://localhost:${envConfig.app.port}`;
    const headers = {};
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers.cookie) {
        headers['Cookie'] = req.headers.cookie;
    }

    return async (endpoint, params) => {
        const response = await axios.get(`${baseURL}${endpoint}`, {
            params,
            headers,
            timeout: 15000
        });
        return response.data;
    };
}

/**
 * Auto-inject canonical arrayKey into each component's dataSource so the
 * frontend knows exactly where to find the data array in API responses.
 */
function injectArrayKeys(config) {
    if (!config?.components) return config;
    for (const component of config.components) {
        if (!component.dataSource?.endpoint) continue;
        if (!component.dataSource.arrayKey) {
            const source = getByEndpoint(component.dataSource.endpoint);
            if (source?.responseShape?.arrayKey) {
                component.dataSource.arrayKey = source.responseShape.arrayKey;
            }
        }
        if (component.dataSource.enrich?.endpoint && !component.dataSource.enrich.arrayKey) {
            const enrichSource = getByEndpoint(component.dataSource.enrich.endpoint);
            if (enrichSource?.responseShape?.arrayKey) {
                component.dataSource.enrich.arrayKey = enrichSource.responseShape.arrayKey;
            }
        }
    }
    return config;
}

/**
 * Generate human-friendly hints from Zod validation errors to help the LLM
 * understand what went wrong and how to fix common issues.
 */
function buildValidationHints(errors) {
    const hints = new Set();
    for (const e of errors) {
        const p = (e.path || '').toLowerCase();
        if (p.includes('option') || p.includes('series')) {
            hints.add('ECharts "option" must contain at least a "series" array. For pie charts use series[0].type="pie" with encode.value and encode.itemName. For bar/line charts include xAxis, yAxis, and series[0].encode with x and y.');
        }
        if (p.includes('params') && e.message?.includes('requires')) {
            hints.add('Check the endpoint field reference — some endpoints need specific parameters. If the table depends on a row click from another component, use linkedParams instead of params.');
        }
        if (p.includes('endpoint') && e.message?.includes('allowlist')) {
            hints.add('Only endpoints listed in the data catalog are allowed. Use describe_available_data to see valid endpoints.');
        }
        if (p.includes('columnDefs') || p.includes('columns')) {
            hints.add('Every column needs either a "field" (dot-path) or "valueFields" (array of dot-paths). Check the endpoint field reference for valid field names.');
        }
    }
    return [...hints].map(h => `- ${h}`).join('\n');
}

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many requests – please wait a minute before sending another message.' },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Chat with the report-building AI agent
 * POST /api/report-agent/chat
 * Body: { message, conversationHistory?, proposedConfig? }
 */
router.post('/chat', chatLimiter, asyncHandler(async (req, res) => {
    const { message, conversationHistory, proposedConfig } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Message is required',
            timestamp: new Date().toISOString()
        });
    }

    logger.debug('Report agent chat request', {
        userId: req.user.id,
        historyLength: conversationHistory?.length || 0
    });

    if (proposedConfig) {
        const validation = validateReportConfig(proposedConfig);

        if (validation.success) {
            return res.json({
                success: true,
                response: {
                    type: 'config_valid',
                    message: 'The report configuration is valid and ready to be saved.',
                    validatedConfig: injectArrayKeys(validation.data)
                },
                timestamp: new Date().toISOString()
            });
        }

        return res.json({
            success: true,
            response: {
                type: 'config_invalid',
                message: 'The report configuration has validation errors. Please review and correct them.',
                errors: validation.errors
            },
            timestamp: new Date().toISOString()
        });
    }

    // ── LLM path (function-calling) ──────────────────────────
    const { apiKey: resolvedKey } = await reportLlm.resolveApiKey(req.user.id);

    if (resolvedKey) {
        try {
            const dataFetcher = buildDataFetcher(req);
            let { message: llmReply, reportConfig } = await reportLlm.chat(
                conversationHistory, message, { userId: req.user.id, dataFetcher }
            );

            const responsePayload = {
                type: 'assistant_message',
                message: llmReply
            };

            if (reportConfig) {
                const validation = validateReportConfig(reportConfig);
                if (validation.success) {
                    responsePayload.type = 'config_proposed';
                    responsePayload.proposedConfig = injectArrayKeys(validation.data);
                    if (!responsePayload.message) {
                        responsePayload.message = '';
                    }
                    responsePayload.message += '\n\nI\'ve generated a report configuration for you. You can see the preview on the right. If it looks good, save it — or tell me what you\'d like to change.';
                } else {
                    const MAX_RETRIES = 2;
                    let lastConfig = reportConfig;
                    let lastErrors = validation.errors;
                    let lastReply = llmReply;
                    let resolved = false;

                    for (let attempt = 1; attempt <= MAX_RETRIES && !resolved; attempt++) {
                        logger.warn(`Function-call config failed Zod validation, retry ${attempt}/${MAX_RETRIES}`, {
                            errors: lastErrors
                        });

                        const errorSummary = lastErrors
                            .map(e => `${e.path}: ${e.message}`)
                            .join('\n');
                        const hints = buildValidationHints(lastErrors);

                        const retryHistory = [
                            ...(conversationHistory || []).map(m => ({ role: m.role, content: m.content })),
                            { role: 'user', content: message },
                            { role: 'assistant', content: lastReply || 'I generated a report configuration.' }
                        ];
                        const retryMessage =
                            `The report config you generated failed validation (attempt ${attempt}).\n\n` +
                            `Errors:\n${errorSummary}\n\n` +
                            (hints ? `Hints:\n${hints}\n\n` : '') +
                            `Failed config:\n${JSON.stringify(lastConfig, null, 2)}\n\n` +
                            'Fix the issues and call generate_report_config again.';

                        try {
                            const retry = await reportLlm.chat(retryHistory, retryMessage, { userId: req.user.id, dataFetcher });
                            const retryConfig = retry.reportConfig;

                            if (retryConfig) {
                                const retryValidation = validateReportConfig(retryConfig);
                                if (retryValidation.success) {
                                    responsePayload.type = 'config_proposed';
                                    responsePayload.proposedConfig = injectArrayKeys(retryValidation.data);
                                    responsePayload.message = retry.message || '';
                                    responsePayload.message += '\n\nI\'ve generated a report configuration for you. You can see the preview on the right. If it looks good, save it — or tell me what you\'d like to change.';
                                    resolved = true;
                                } else {
                                    lastConfig = retryConfig;
                                    lastErrors = retryValidation.errors;
                                    lastReply = retry.message || 'I generated a revised configuration.';
                                }
                            } else {
                                break;
                            }
                        } catch (retryErr) {
                            logger.warn(`LLM retry ${attempt} failed`, { error: retryErr.message });
                            break;
                        }
                    }

                    if (!resolved) {
                        const finalErrors = lastErrors
                            .map(e => `- ${e.path}: ${e.message}`)
                            .join('\n');
                        responsePayload.message += `\n\nI generated a configuration but it has validation issues. Let me revise it.\n${finalErrors}\n\nPlease try rephrasing your request or simplifying the report.`;
                    }
                }
            }

            return res.json({
                success: true,
                response: responsePayload,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            logger.error('LLM chat error', { error: err.message, stack: err.stack });
            return res.status(502).json({
                success: false,
                error: 'The AI service encountered an error. Please try again.',
                details: err.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // ── Stub / no-API-key path ─────────────────────────────────
    const catalog = getDataCatalogByCategory();
    const categoryNames = Object.keys(catalog);
    const endpointCount = Object.values(catalog).reduce((sum, arr) => sum + arr.length, 0);

    res.json({
        success: true,
        response: {
            type: 'assistant_message',
            message: buildStubResponse(message, categoryNames, endpointCount),
            metadata: {
                availableCategories: categoryNames,
                availableComponentTypes: VALID_COMPONENT_TYPES,
                availableLayouts: VALID_LAYOUTS,
                totalDataSources: endpointCount,
                llmAvailable: false,
                note: 'No LLM API key configured. Use the "Load Sample" button to explore a pre-built report, or set the OPENAI_API_KEY environment variable to enable AI-driven report building.'
            }
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get the agent's capabilities and context
 * GET /api/report-agent/capabilities
 */
router.get('/capabilities', asyncHandler(async (req, res) => {
    const catalog = getDataCatalogByCategory();
    const { apiKey } = await reportLlm.resolveApiKey(req.user.id);

    res.json({
        success: true,
        capabilities: {
            llmAvailable: !!apiKey,
            componentTypes: VALID_COMPONENT_TYPES.map(type => ({
                type,
                description: getComponentDescription(type)
            })),
            layouts: VALID_LAYOUTS,
            dataCategories: Object.entries(catalog).map(([category, sources]) => ({
                category,
                sourceCount: sources.length,
                sources: sources.map(s => ({ id: s.id, description: s.description }))
            })),
            limits: {
                maxComponents: 12,
                maxFilters: 5,
                maxColumns: 20
            }
        },
        timestamp: new Date().toISOString()
    });
}));

function buildStubResponse(userMessage, categories, endpointCount) {
    return [
        `I have access to ${endpointCount} data sources across ${categories.length} categories:`,
        '',
        ...categories.map(c => `- ${c}`),
        '',
        'I can create reports with KPI Cards, Charts (ECharts), and Data Tables (AG Grid).',
        '',
        'However, AI-driven report building is not currently enabled because no LLM API key is configured.',
        '',
        'You can still explore reports using the **Load Sample** button in the header, which will load a pre-built report for you to preview and save.',
        '',
        'To enable the AI chat, set the `OPENAI_API_KEY` environment variable and restart the server.',
    ].join('\n');
}

function getComponentDescription(type) {
    const descriptions = {
        'kpi-card': 'Single metric display card with optional comparison',
        'bar-chart': 'Vertical or horizontal bar chart for categorical data',
        'line-chart': 'Line chart for time series and trend data',
        'pie-chart': 'Pie or doughnut chart for proportional data',
        'data-table': 'Sortable, searchable data table with configurable columns',
        'echarts': 'Full-featured chart powered by Apache ECharts',
        'ag-grid': 'Feature-rich data table powered by AG Grid'
    };
    return descriptions[type] || type;
}

module.exports = router;
