/**
 * Report Agent Routes
 * AI chat endpoint for conversational report building.
 *
 * When an LLM API key is configured the chat endpoint forwards the
 * conversation to OpenAI and parses any report-config JSON from the
 * reply.  When no key is present, the endpoint returns a structured
 * stub so the frontend still works (users can load samples instead).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const customReportService = require('../services/custom-report.service');
const reportLlm = require('../services/report-llm.service');
const { validateReportConfig, VALID_COMPONENT_TYPES, VALID_LAYOUTS } = require('../config/report-config-schema');
const { asyncHandler } = require('../middleware/error-handler');
const logger = require('../utils/logger');

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

    // If a proposed config was submitted directly, validate it (bypass LLM).
    if (proposedConfig) {
        const validation = validateReportConfig(proposedConfig);

        if (validation.success) {
            return res.json({
                success: true,
                response: {
                    type: 'config_valid',
                    message: 'The report configuration is valid and ready to be saved.',
                    validatedConfig: validation.data
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

    // ── LLM path ───────────────────────────────────────────────
    // Check both server-wide key and per-user key
    const { apiKey: resolvedKey } = await reportLlm.resolveApiKey(req.user.id);

    if (resolvedKey) {
        try {
            const { message: llmReply, reportConfig } = await reportLlm.chat(
                conversationHistory, message, { userId: req.user.id }
            );

            const responsePayload = {
                type: 'assistant_message',
                message: reportLlm.stripConfigBlock(llmReply)
            };

            if (reportConfig) {
                const validation = validateReportConfig(reportConfig);
                if (validation.success) {
                    responsePayload.type = 'config_proposed';
                    responsePayload.proposedConfig = validation.data;
                    responsePayload.message += '\n\nI\'ve generated a report configuration for you. You can see the preview on the right. If it looks good, save it — or tell me what you\'d like to change.';
                } else {
                    logger.warn('LLM produced invalid config, forwarding errors to user', { errors: validation.errors });
                    responsePayload.message += '\n\nI generated a configuration but it has validation issues. Let me revise it.';
                    // Retry: ask the LLM to fix the config is out-of-scope for v1;
                    // instead we just surface the conversational reply.
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
    const catalog = customReportService.getDataCatalog({ grouped: true });
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
 * Get the agent's capabilities and context (for frontend display)
 * GET /api/report-agent/capabilities
 */
router.get('/capabilities', asyncHandler(async (req, res) => {
    const catalog = customReportService.getDataCatalog({ grouped: true });
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

/**
 * Build a structured stub response when no LLM is available.
 */
function buildStubResponse(userMessage, categories, endpointCount) {
    return [
        `I have access to ${endpointCount} data sources across ${categories.length} categories:`,
        '',
        ...categories.map(c => `- ${c}`),
        '',
        'I can create reports with KPI Cards, Bar Charts, Line Charts, Pie Charts, and Data Tables.',
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
        'data-table': 'Sortable, searchable data table with configurable columns'
    };
    return descriptions[type] || type;
}

module.exports = router;
