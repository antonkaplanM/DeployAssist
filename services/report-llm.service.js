/**
 * Report LLM Service
 *
 * Manages the OpenAI chat conversation for the report-building agent.
 * Uses OpenAI function calling (tools) to let the LLM produce structured
 * report configs with enum-constrained endpoints — preventing hallucinated
 * or semantically wrong data source references.
 *
 * Three tools are exposed to the LLM:
 *   1. generate_report_config  — produces the JSON config (endpoint enum)
 *   2. describe_available_data — lets the LLM explore catalog by category
 *   3. fetch_endpoint_data     — queries live API data so the LLM can inspect
 *                                actual records before building a report
 *
 * Supports two API-key sources (checked in order):
 *   1. Per-user key stored in user_settings (encrypted)
 *   2. Server-wide OPENAI_API_KEY environment variable
 */

const OpenAI = require('openai');
const config = require('../config/environment');
const db = require('../database');
const { buildOpenAITools, handleDescribeData, summarizeEndpointData, isEndpointAllowed, _buildEndpointFieldMap } = require('../config/report-data-sources');
const { MAX_COMPONENTS } = require('../config/report-config-schema');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

let serverOpenai = null;

if (config.llm.enabled) {
    serverOpenai = new OpenAI({ apiKey: config.llm.apiKey });
    logger.info('Report LLM service initialised with server-wide key', { model: config.llm.model });
} else {
    logger.warn('No server-wide OPENAI_API_KEY – LLM will use per-user keys only');
}

function isAvailable() {
    return !!(config.llm.enabled && serverOpenai);
}

async function resolveApiKey(userId) {
    if (userId) {
        try {
            const result = await db.query(
                `SELECT setting_value FROM user_settings
                 WHERE user_id = $1 AND setting_key = 'llm_api_key' AND is_encrypted = TRUE`,
                [userId]
            );
            if (result.rows.length && result.rows[0].setting_value) {
                const key = decrypt(result.rows[0].setting_value);
                if (key) return { apiKey: key, source: 'user' };
            }
        } catch (err) {
            logger.warn('Failed to resolve user API key', { userId, error: err.message });
        }
    }

    if (config.llm.enabled && config.llm.apiKey) {
        return { apiKey: config.llm.apiKey, source: 'server' };
    }

    return { apiKey: null, source: 'none' };
}

async function resolveModel(userId) {
    if (userId) {
        try {
            const result = await db.query(
                `SELECT setting_value FROM user_settings
                 WHERE user_id = $1 AND setting_key = 'llm_model'`,
                [userId]
            );
            if (result.rows.length && result.rows[0].setting_value) {
                return result.rows[0].setting_value;
            }
        } catch {
            // fall through to default
        }
    }
    return config.llm.model;
}

// ─────────────────────────────────────────────────────────────
//  System prompt — much shorter now that the catalog is in the
//  tool schema instead of a text blob.
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt() {
    const fieldMap = _buildEndpointFieldMap();

    return `You are a report-building assistant for the DeployAssist application.
Your job is to help users create data dashboard reports by calling the generate_report_config tool with a JSON configuration that the application renders into charts, KPI cards, and data tables.

## How It Works
1. Chat conversationally to understand what the user wants.
2. Use fetch_endpoint_data to query live API data and inspect actual records, counts, and field names BEFORE building any report components.
3. When ready, call generate_report_config with a complete config based on verified data.
4. If part of the user's request cannot be fulfilled by available endpoints, explain what is missing in your text response and build ONLY the components you CAN support correctly.
5. If you need to explore what endpoints are available, call describe_available_data first.

## Data Exploration (IMPORTANT)
You have access to fetch_endpoint_data which queries LIVE data from the application's API. Use it to:
- **Verify data exists** before building a component. If an endpoint returns 0 records, tell the user rather than building an empty widget.
- **Check record counts** to give accurate KPI values and set appropriate page sizes.
- **Inspect field names** in sample records so your column/chart field references are correct.
- **Understand response structure** (where is the data array? is there a summary object?).
- **Explore different parameters** (e.g., try expirationWindow=90 vs. expirationWindow=30 to see how many records change).

Always fetch data from at least the primary endpoint you plan to use BEFORE calling generate_report_config. Report what you found to the user (e.g., "I found 47 accounts with expiring products within 90 days").

## Critical Rules
- The endpoint enum in generate_report_config contains ALL valid endpoints. You cannot reference anything outside that list.
- Every component's title MUST accurately describe the data the chosen endpoint provides. Never label a chart "Upgrade Trends" if the endpoint returns validation failure rates.
- If no endpoint provides the data the user asked for, say so explicitly. An incomplete but accurate report is better than a complete but misleading one.
- Maximum ${MAX_COMPONENTS} components per report.
- Field references MUST exactly match the actual API response field names you observed via fetch_endpoint_data.
- **PARAMS MUST MATCH**: When you explored data via fetch_endpoint_data with specific parameters (e.g., status=allExpired, expirationWindow=90), you MUST use those SAME parameters in the report config's dataSource.params. The report renderer calls the endpoint exactly as configured — if you omit a filter param, the component will show unfiltered data. For example, if you fetched from /api/tenant-entitlements/analysis with status=allExpired and found 91 tenants, the report config MUST include "params": { "status": "allExpired" }.
- **EXPIRED DATA DEFAULTS**: /api/tenant-entitlements includes expired entitlements by default. Pass includeExpired=false only if the user specifically wants to exclude expired records.

## Endpoint Field Reference
${fieldMap}

## Validated Config Examples
Copy these patterns exactly — they are the most error-prone structures.

ECharts pie chart:
{ "type": "echarts", "title": "Product Distribution", "gridSpan": 2, "dataSource": { "endpoint": "/api/tenant-entitlements/product-breakdown", "params": { "tenantStatus": "allExpired" }, "arrayKey": "products" }, "option": { "tooltip": { "trigger": "item" }, "series": [{ "type": "pie", "radius": ["40%", "70%"], "encode": { "value": "count", "itemName": "productName" } }] } }

ECharts bar chart:
{ "type": "echarts", "title": "Changes by Account", "gridSpan": 3, "dataSource": { "endpoint": "/api/analytics/package-changes/by-account", "params": { "timeFrame": "1y" }, "arrayKey": "accounts" }, "option": { "tooltip": { "trigger": "axis" }, "grid": { "containLabel": true }, "xAxis": { "type": "category" }, "yAxis": { "type": "value" }, "series": [{ "type": "bar", "encode": { "x": "account_name", "y": "total_changes" } }] } }

AG Grid master-detail with linkedParams:
Master: { "type": "ag-grid", "dataSource": { "endpoint": "/api/tenant-entitlements/analysis", "params": { "status": "allExpired" }, "arrayKey": "tenants" }, "onRowClick": { "paramId": "selectedAccount", "valueField": "accountName" }, ... }
Detail: { "type": "ag-grid", "dataSource": { "endpoint": "/api/tenant-entitlements", "params": {}, "linkedParams": { "account": "selectedAccount" }, "arrayKey": "entitlements" }, ... }

KPI card with dot-path:
{ "type": "kpi-card", "title": "Total Expired", "gridSpan": 1, "dataSource": { "endpoint": "/api/tenant-entitlements/analysis", "params": { "status": "allExpired" } }, "valueField": "summary.tenantsReturned", "format": "number" }

## Component Guidance

### ECharts (PREFERRED for all charts)
Use the dataset + encode pattern. The renderer sets option.dataset.source to the fetched API data array at runtime.
- Use encode with field names from the endpoint (NOT positional indices).
- Always include tooltip.
- NEVER include JavaScript functions — only static JSON values.
- Include legend for multi-series charts.
- Include grid with containLabel: true.
- Use axisLabel.rotate on xAxis when category labels are long.
- For doughnut: radius: ["40%", "70%"].

### AG Grid (PREFERRED for all tables)
- columnDefs: each column needs field (data field name) and headerName (display header).
- Use flex for proportional column widths.
- Use format: "date" for date fields, "number" for numeric fields.
- Use conditionalFormatting to highlight rows: danger (red), warning (amber), success (green), info (blue), muted (gray).
- Operators: equals, notEquals, contains, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual.

### Nested & Multi-Field Columns (valueFields)
When API data contains values spread across multiple nested paths (e.g. product codes under expiringProducts.models, expiringProducts.data, expiringProducts.apps), use valueFields instead of field:
- valueFields: ["path.to.array1", "path.to.array2", ...] — resolves each path, flattens arrays, and joins all values into a single display string.
- separator: optional join string (default ", ").
- displayField: IMPORTANT — when the arrays contain objects (not simple strings), set displayField to the property name to extract (e.g. "productCode"). Without this, the renderer auto-tries name, code, productCode, label, id. Always check the sample records from fetch_endpoint_data to see if array items are objects or strings.
- Works in both AG Grid columnDefs and data-table columns.
- If a single dot-path field resolves to an array of primitives, it is auto-joined with ", " — no valueFields needed.
- Example with objects: { "headerName": "Product Codes", "valueFields": ["expiringProducts.models", "expiringProducts.data", "expiringProducts.apps"], "displayField": "productCode", "flex": 2 }
- Use fetch_endpoint_data to inspect the response structure first so you know exactly which paths contain the nested data and whether items are objects or primitives.

### KPI Cards
- valueField: dot-path into the API response (e.g. "summary.total_changes").
- Use for single headline metrics. gridSpan 1 each, arrange 2-3 in a row.

### Typeahead Filters
Use for filters where the user searches by partial input (account/tenant names):
- suggestEndpoint: the API to call for suggestions.
- suggestParam: query param name for search term.
- suggestResultKey: key in response containing results array.
- suggestDisplayField: field to display as primary label.
- suggestSecondaryField: optional secondary label.
Preferred for entitlements: /api/tenant-entitlements/suggest with mapsToParam "tenant".
Filters apply globally to ALL components — do NOT use linkedParams for filter-to-component connections.

### Row-Click Linking (linkedParams)
linkedParams is ONLY for master-detail patterns between components:
1. Source table: onRowClick: { paramId, valueField }.
2. Target component: dataSource.linkedParams: { paramName: paramId }.
IMPORTANT: The detail component's static params MUST include any required defaults for the linked endpoint. Check the endpoint description for default behaviors.

### Cross-Source Data Enrichment (enrich)
When a table needs fields from TWO DIFFERENT endpoints (e.g., expiration data with tenant names), use the \`enrich\` directive in \`dataSource\`.
The server fetches both endpoints and joins them by a shared key — no frontend logic needed.

When to use: ONLY when the primary endpoint genuinely lacks a field that exists in another endpoint. If one endpoint already has the field, just use it directly.

How it works:
- \`sourceField\`: dot-path in each PRIMARY row used as the join key (e.g., "account.name")
- \`matchField\`: field in the ENRICHMENT response to match against (e.g., "client")
- \`fields\`: array of field names to copy from the matched enrichment row (e.g., ["tenant_name", "tenant_id"])
- \`params\`: optional query params for the enrichment endpoint — CRITICAL for paginated endpoints

CRITICAL: The join key MUST be a field that exists in BOTH datasets with matching values. For expiration monitor + current-accounts:
- sourceField = "account.name" (the Salesforce Account name in the expiration data)
- matchField = "client" (the same Account name in current-accounts)
Do NOT use psRecord.id ↔ ps_record_id unless you specifically need PS-record-level matching.

CRITICAL: For paginated enrichment endpoints (e.g., /api/current-accounts defaults to 50 rows), ALWAYS pass params with a large pageSize to get all rows:
enrich.params = { "pageSize": 1000 }

Example — expiration monitor enriched with tenant names from current-accounts:
{ "type": "ag-grid", "title": "Expiring Products with Tenant Info", "gridSpan": 3, "dataSource": { "endpoint": "/api/expiration/monitor", "params": {}, "arrayKey": "expirations", "enrich": { "endpoint": "/api/current-accounts", "params": { "pageSize": 1000 }, "arrayKey": "accounts", "sourceField": "account.name", "matchField": "client", "fields": ["tenant_name", "tenant_id"] } }, "columnDefs": [ { "field": "account.name", "headerName": "Account" }, { "field": "tenant_name", "headerName": "Tenant Name" }, { "field": "earliestExpiry", "headerName": "Expiry Date", "format": "date" }, { "field": "earliestDaysUntilExpiry", "headerName": "Days Left", "format": "number" } ] }

After enrichment, the copied fields appear as top-level properties on each primary row, so reference them directly in columnDefs (e.g., "field": "tenant_name").

## Dashboard Structure Tips
Grid is 3 columns wide. Plan rows so gridSpan values add up to 3.
1. KPI row (top): 2-3 headline metrics.
2. Primary chart (full width, gridSpan 3): main trend or comparison.
3. Secondary visuals + detail table.
4. Deep-dive tables (full width) with conditional formatting.

## Data Dependencies
Some endpoints require prior data loading:
- /api/analytics/package-changes/* — requires package change analysis run.
- /api/expiration/* — requires expiration analysis run.
- /api/ghost-accounts — requires ghost account analysis.
- /api/analytics/* (request-types, validation-trend, completion-times) — require PS audit trail data.
- /api/provisioning/*, /api/tenant-entitlements — always available.

## What Does NOT Exist
- No time-series "upgrade trend over time" endpoint.
- No "revenue" or "contract value" endpoint.
- No "customer growth over time" endpoint.
If the user requests any of these, tell them the data is not available.`;
}

// ─────────────────────────────────────────────────────────────
//  Chat — uses OpenAI function calling (tools)
// ─────────────────────────────────────────────────────────────

/**
 * Send a conversation to the LLM and return the assistant reply.
 * The LLM may respond with text, a tool call, or both.
 *
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @param {string} userMessage
 * @param {{ userId?: number, dataFetcher?: (endpoint: string, params: object) => Promise<object> }} options
 * @returns {Promise<{message: string, reportConfig: object|null}>}
 */
async function chat(conversationHistory, userMessage, options = {}) {
    const { apiKey, source } = await resolveApiKey(options.userId);

    if (!apiKey) {
        throw new Error('LLM service is not available – no API key configured');
    }

    const client = source === 'server' && serverOpenai
        ? serverOpenai
        : new OpenAI({ apiKey });

    const model = await resolveModel(options.userId);
    const tools = buildOpenAITools();

    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        ...(conversationHistory || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
    ];

    logger.debug('Sending report-agent request to LLM (function-calling mode)', {
        model,
        keySource: source,
        toolCount: tools.length
    });

    let reportConfig = null;
    let textMessage = '';
    let iterationCount = 0;
    const MAX_TOOL_ITERATIONS = 5;

    while (iterationCount < MAX_TOOL_ITERATIONS) {
        iterationCount++;

        const completion = await client.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: 'auto',
            max_tokens: config.llm.maxTokens,
            temperature: config.llm.temperature
        });

        const choice = completion.choices?.[0];

        if (!choice) {
            logger.warn('LLM returned no choices');
            break;
        }

        logger.debug('LLM response received', {
            finishReason: choice.finish_reason,
            hasToolCalls: !!(choice.message.tool_calls && choice.message.tool_calls.length),
            contentLength: choice.message.content?.length || 0,
            iteration: iterationCount
        });

        if (choice.message.content) {
            textMessage += (textMessage ? '\n\n' : '') + choice.message.content;
        }

        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
            break;
        }

        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
            const fnName = toolCall.function.name;
            let fnArgs;
            try {
                fnArgs = JSON.parse(toolCall.function.arguments);
            } catch (parseErr) {
                logger.warn('Failed to parse tool call arguments', { fnName, error: parseErr.message });
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: 'Failed to parse arguments' })
                });
                continue;
            }

            if (fnName === 'generate_report_config') {
                reportConfig = fnArgs;
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ success: true, message: 'Report config received. It will be validated and previewed for the user.' })
                });
            } else if (fnName === 'describe_available_data') {
                const catalogInfo = handleDescribeData(fnArgs);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(catalogInfo)
                });
            } else if (fnName === 'fetch_endpoint_data') {
                if (!options.dataFetcher) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: 'Data fetching is not available in this context.' })
                    });
                    continue;
                }
                if (!fnArgs.endpoint || !isEndpointAllowed(fnArgs.endpoint)) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: `Endpoint not allowed: ${fnArgs.endpoint}` })
                    });
                    continue;
                }
                try {
                    logger.debug('LLM fetching live data', { endpoint: fnArgs.endpoint, params: fnArgs.params });
                    const rawData = await options.dataFetcher(fnArgs.endpoint, fnArgs.params || {});
                    const preview = summarizeEndpointData(rawData, fnArgs.endpoint);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(preview)
                    });
                } catch (fetchErr) {
                    logger.warn('LLM data fetch failed', { endpoint: fnArgs.endpoint, error: fetchErr.message });
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            error: `Failed to fetch data from ${fnArgs.endpoint}: ${fetchErr.message}`,
                            hint: 'The endpoint may require prior data loading (e.g., running an analysis) or the parameters may be invalid.'
                        })
                    });
                }
            } else {
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ error: `Unknown function: ${fnName}` })
                });
            }
        }

        if (reportConfig) {
            if (choice.finish_reason === 'tool_calls' && !choice.message.content) {
                const followUp = await client.chat.completions.create({
                    model,
                    messages: [
                        ...messages,
                        { role: 'user', content: 'The report configuration has been received. Please provide a brief summary of what you built and any limitations or gaps.' }
                    ],
                    max_tokens: 500,
                    temperature: config.llm.temperature
                });
                const followUpText = followUp.choices?.[0]?.message?.content;
                if (followUpText) {
                    textMessage += (textMessage ? '\n\n' : '') + followUpText;
                }
            }
            break;
        }
    }

    return { message: textMessage, reportConfig };
}

// ─────────────────────────────────────────────────────────────
//  Legacy helpers — kept for backward compatibility with
//  any code that still parses fenced code blocks.
// ─────────────────────────────────────────────────────────────

function stripJsonComments(jsonStr) {
    return jsonStr.replace(/\/\/.*$/gm, '');
}

function extractReportConfig(text) {
    const patterns = [
        /```report-config\s*\n([\s\S]*?)```/,
        /```json\s*\n([\s\S]*?)```/,
        /```\s*\n([\s\S]*?)```/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match) continue;

        try {
            const cleaned = stripJsonComments(match[1]).trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && parsed.title && Array.isArray(parsed.components)) {
                return parsed;
            }
        } catch (err) {
            logger.debug('Fenced block did not parse as report config', { error: err.message });
        }
    }

    return null;
}

function stripConfigBlock(text) {
    let stripped = text.replace(/```report-config\s*\n[\s\S]*?```/g, '');

    stripped = stripped.replace(/```json\s*\n([\s\S]*?)```/g, (match, inner) => {
        try {
            const parsed = JSON.parse(stripJsonComments(inner).trim());
            if (parsed && parsed.title && Array.isArray(parsed.components)) return '';
        } catch { /* not a report config, keep it */ }
        return match;
    });

    return stripped.trim();
}

module.exports = {
    isAvailable,
    resolveApiKey,
    chat,
    extractReportConfig,
    stripConfigBlock
};
