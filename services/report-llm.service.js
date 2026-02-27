/**
 * Report LLM Service
 *
 * Manages the OpenAI chat conversation for the report-building agent.
 * Constructs a system prompt from the data catalog and report config schema,
 * sends user messages to the LLM, and parses structured JSON configs from
 * the assistant's replies.
 *
 * Supports two key sources (checked in order):
 *   1. Per-user key stored in user_settings (encrypted)
 *   2. Server-wide OPENAI_API_KEY environment variable
 *
 * When neither is available the service reports itself as unavailable
 * so callers can fall back to the stub / sample-only mode.
 */

const OpenAI = require('openai');
const config = require('../config/environment');
const db = require('../database');
const { getCatalogForPrompt } = require('../config/report-data-catalog');
const { VALID_COMPONENT_TYPES, VALID_FORMATS, VALID_LAYOUTS, MAX_COMPONENTS } = require('../config/report-config-schema');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

let serverOpenai = null;

if (config.llm.enabled) {
    serverOpenai = new OpenAI({ apiKey: config.llm.apiKey });
    logger.info('Report LLM service initialised with server-wide key', { model: config.llm.model });
} else {
    logger.warn('No server-wide OPENAI_API_KEY – LLM will use per-user keys only');
}

/**
 * Check if LLM is available (server-wide key).
 * For per-user availability, use resolveApiKey().
 */
function isAvailable() {
    return !!(config.llm.enabled && serverOpenai);
}

/**
 * Resolve the API key for a given user. Checks user_settings first, then
 * falls back to the server-wide environment variable.
 * @param {number} userId
 * @returns {Promise<{apiKey: string|null, source: string}>}
 */
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

/**
 * Resolve the model preference for a given user.
 * @param {number} userId
 * @returns {Promise<string>}
 */
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

function buildSystemPrompt() {
    const catalog = getCatalogForPrompt();

    return `You are a report-building assistant for the DeployAssist application.
Your job is to help users create data dashboard reports by producing a JSON configuration object that the application renders into charts, KPI cards, and data tables.

## Rules
1. ONLY use the data source endpoints listed below. Never invent endpoints.
2. Respond conversationally while you gather requirements. When you have enough information to propose a report, include the JSON configuration inside a fenced code block tagged \`\`\`report-config.
3. The JSON must conform exactly to the schema described below.
4. Keep reports focused – aim for 3-6 components. Maximum ${MAX_COMPONENTS}.
5. Always include a "title" and "description" in the config.
6. Endpoint paths must start with /api/ and match an entry in the data catalog exactly.
7. Choose appropriate chart types for the data (e.g. bar charts for categorical comparisons, line charts for time series, pie charts for proportional breakdowns).
8. For KPI cards, set valueField to the dot-path into the API response where the single metric lives (e.g. "summary.total_changes").
9. **CRITICAL**: For tables, column "field" values MUST exactly match the field names listed in the data catalog for that endpoint. For example, use "account_name" not "account", "product_name" not "product", "change_type" not "changeType". The API returns snake_case field names from the database.
10. For charts, xField and yField MUST also exactly match the catalog field names.
11. Pay attention to the "summary" field in the catalog responseShape – it tells you which key the data array lives under (e.g. "data", "ghostAccounts", "requests", "trendData").
12. **NEVER include comments** (// or /* */) inside the JSON config block. JSON does not support comments and they will cause parsing errors.

## Available Data Sources
${JSON.stringify(catalog, null, 2)}

## Report Config JSON Schema

\`\`\`
{
  "title": string (1-255 chars),
  "description": string (optional, max 1000 chars),
  "layout": ${JSON.stringify(VALID_LAYOUTS)} (default "grid"),
  "refreshInterval": number (seconds, 0 = no auto-refresh, max 3600),
  "filters": [                          // optional, max 5
    {
      "id": string,
      "type": "select" | "date-range" | "text",
      "label": string,
      "options": [{ "value": string, "label": string }],
      "default": string,
      "mapsToParam": string             // query-param name sent to the endpoint
    }
  ],
  "components": [                       // 1-${MAX_COMPONENTS} items
    // -- KPI Card --
    {
      "id": string, "type": "kpi-card", "title": string,
      "gridSpan": 1-3,
      "dataSource": { "endpoint": string, "params": {} },
      "valueField": string,             // dot-path into response
      "format": ${JSON.stringify(VALID_FORMATS)}
    },
    // -- Bar Chart --
    {
      "id": string, "type": "bar-chart", "title": string,
      "gridSpan": 1-3,
      "dataSource": { "endpoint": string, "params": {} },
      "xField": string, "yField": string,
      "colors": [string],
      "stacked": boolean, "horizontal": boolean
    },
    // -- Line Chart --
    {
      "id": string, "type": "line-chart", "title": string,
      "gridSpan": 1-3,
      "dataSource": { "endpoint": string, "params": {} },
      "xField": string, "yField": string,
      "colors": [string],
      "fill": boolean
    },
    // -- Pie Chart --
    {
      "id": string, "type": "pie-chart", "title": string,
      "gridSpan": 1-3,
      "dataSource": { "endpoint": string, "params": {} },
      "labelField": string, "valueField": string,
      "colors": [string], "doughnut": boolean
    },
    // -- Data Table --
    {
      "id": string, "type": "data-table", "title": string,
      "gridSpan": 1-3,
      "dataSource": { "endpoint": string, "params": {}, "linkedParams": { "<paramName>": "<paramId>" } },
      "columns": [{ "field": string, "header": string, "format": ${JSON.stringify(VALID_FORMATS)} }],
      "pageSize": 5-100, "searchable": boolean,
      "onRowClick": { "paramId": string, "valueField": string },   // optional
      "conditionalFormatting": [                                     // optional, max 10 rules
        {
          "field": string,                                           // dot-path to the cell value to evaluate
          "operator": "equals"|"notEquals"|"contains"|"greaterThan"|"lessThan"|"greaterThanOrEqual"|"lessThanOrEqual",
          "value": string|number|boolean,                            // value to compare against
          "style": "danger"|"warning"|"success"|"info"|"muted"      // row highlight style
        }
      ]
    }
  ]
}
\`\`\`

## Component types
${VALID_COMPONENT_TYPES.map(t => `- ${t}`).join('\n')}

## Cross-Component Interactivity (Row-Click Linking)

Data tables can publish a value when a row is clicked, and other components can consume that value as a query parameter. This is useful for master-detail patterns (e.g. click an account to view its entitlements).

**How it works:**
1. Add \`onRowClick\` to the source data-table. \`paramId\` is a unique name for the published value. \`valueField\` is the dot-path to extract from the clicked row.
2. On the target component's \`dataSource\`, add \`linkedParams\`: an object mapping a query parameter name to the \`paramId\` from step 1. The target component will wait for a row selection before fetching data.

**Example:**
\`\`\`
{
  "components": [
    {
      "id": "accounts-table", "type": "data-table",
      "dataSource": { "endpoint": "/api/expiration/monitor", "params": { "expirationWindow": 30 } },
      "onRowClick": { "paramId": "selectedAccount", "valueField": "account.name" },
      "columns": [...]
    },
    {
      "id": "entitlements-table", "type": "data-table",
      "dataSource": {
        "endpoint": "/api/tenant-entitlements",
        "params": { "account": "" },
        "linkedParams": { "account": "selectedAccount" }
      },
      "columns": [...]
    }
  ]
}
\`\`\`

**Important:** For entitlement data, prefer \`/api/tenant-entitlements\` over \`/api/customer-products\`. The tenant-entitlements endpoint returns a flat array of entitlement rows from SML tenant data, which is easier to display in data tables. The entitlements array contains fields: tenantName, tenantId, category, productCode, productName, packageName, quantity, startDate, endDate, status, daysRemaining.

When the user asks to click a row to filter or query another component, use this pattern. The \`paramId\` must be a simple alphanumeric/underscore/hyphen string. The \`valueField\` must be a valid dot-path to a field in the source data.

## Conditional Formatting (Row Highlighting)

Data tables support \`conditionalFormatting\` – an array of rules that highlight entire rows based on cell values. Rules are evaluated in order; the first matching rule determines the row style.

**Styles:** \`danger\` (red), \`warning\` (amber), \`success\` (green), \`info\` (blue), \`muted\` (gray)

**Operators:** \`equals\`, \`notEquals\`, \`contains\`, \`greaterThan\`, \`lessThan\`, \`greaterThanOrEqual\`, \`lessThanOrEqual\`

**Example:**
\`\`\`
{
  "id": "entitlements-table", "type": "data-table",
  "dataSource": { "endpoint": "/api/tenant-entitlements", "params": { "account": "Acme" } },
  "columns": [
    { "field": "productName", "header": "Product" },
    { "field": "status", "header": "Status" },
    { "field": "daysRemaining", "header": "Days Left", "format": "number" }
  ],
  "conditionalFormatting": [
    { "field": "status", "operator": "equals", "value": "Expired", "style": "danger" },
    { "field": "status", "operator": "equals", "value": "Expiring Soon", "style": "warning" },
    { "field": "status", "operator": "equals", "value": "Active", "style": "success" }
  ]
}
\`\`\`

Use conditional formatting when the user asks to highlight, color-code, or visually distinguish rows by status, severity, threshold, or any field value. For numeric thresholds use \`greaterThan\`/\`lessThan\`; for text matching use \`equals\` or \`contains\`. Place the most urgent/important rules first since only the first match applies.

## Tips for the user
- Ask clarifying questions if the user's request is vague.
- Suggest relevant data sources from the catalog.
- After producing a config, tell the user they can preview it and then save it.
- If the user wants changes, produce a new complete config block.`;
}

/**
 * Send a conversation to the LLM and return the assistant reply.
 *
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @param {string} userMessage
 * @param {{ userId?: number }} options
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

    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        ...(conversationHistory || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
    ];

    logger.debug('Sending report-agent request to LLM', {
        model,
        keySource: source
    });

    const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature
    });

    const reply = completion.choices?.[0]?.message?.content || '';

    logger.debug('LLM response received', {
        replyLength: reply.length,
        finishReason: completion.choices?.[0]?.finish_reason
    });

    const reportConfig = extractReportConfig(reply);

    return { message: reply, reportConfig };
}

/**
 * Strip single-line JS/C-style comments from a JSON string so that
 * LLM-generated JSON with inline comments can still be parsed.
 */
function stripJsonComments(jsonStr) {
    return jsonStr.replace(/\/\/.*$/gm, '');
}

/**
 * Try to extract a JSON report config from a fenced ```report-config block.
 * Returns null if no valid block found.
 */
function extractReportConfig(text) {
    const fencePattern = /```report-config\s*\n([\s\S]*?)```/;
    const match = text.match(fencePattern);
    if (!match) return null;

    try {
        const cleaned = stripJsonComments(match[1]).trim();
        return JSON.parse(cleaned);
    } catch (err) {
        logger.warn('Failed to parse report-config JSON from LLM reply', { error: err.message });
        return null;
    }
}

/**
 * Strip the raw ```report-config fenced block from the assistant message
 * so the frontend can show clean conversational text alongside the parsed config.
 */
function stripConfigBlock(text) {
    return text.replace(/```report-config\s*\n[\s\S]*?```/g, '').trim();
}

module.exports = {
    isAvailable,
    resolveApiKey,
    chat,
    extractReportConfig,
    stripConfigBlock
};
