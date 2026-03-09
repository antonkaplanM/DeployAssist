# EPIC-02: Data Sources, Connections & Integrations

## Epic Description

Implement all external data source connections, integration services, and the canonical data source registry that powers the application's data layer. This includes integrations with Salesforce, SML, Jira, Microsoft Graph, and OpenAI, as well as the internal data catalog and MCP (Model Context Protocol) server that exposes these sources to AI agents.

**Business Value:** The Deployment Assistant's core value proposition is aggregating data from multiple siloed systems into a single operational view. This epic establishes the data pipeline infrastructure that all feature pages consume.

**Dependencies:** EPIC-01 (Infrastructure & Foundation)

---

## Tasks

### T-02.01 — Implement Salesforce API Service

**Description:** Build the Salesforce integration service that connects to the Salesforce REST API via `jsforce` for querying PS records, provisioning data, and analytics.

**Acceptance Criteria:**
- `SalesforceApiService` class with methods for: provisioning requests (list, search, detail, filter options, new records, removals), validation trend, request types by week, completion times
- Per-user OAuth 2.0 Authorization Code flow: redirect to SF login → callback → store tokens encrypted in `user_settings`
- Service account fallback: Client Credentials flow using environment variables (`SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_LOGIN_URL`)
- Token file support for persistent service account tokens (`SF_TOKEN_FILE`)
- Connection caching to avoid re-authentication on every request
- Error handling for expired tokens, network failures, rate limits
- Configurable API version via `SF_API_VERSION`

**Technical Details:**
- Dependencies: `jsforce`
- Environment variables: `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_REDIRECT_URI`, `SF_USERNAME`, `SF_PASSWORD`, `SF_SECURITY_TOKEN`, `SF_TOKEN_FILE`, `SF_API_VERSION`

---

### T-02.02 — Implement Salesforce OAuth Routes

**Description:** Create the OAuth callback routes for Salesforce per-user authentication.

**Acceptance Criteria:**
- `GET /auth/salesforce` — initiates OAuth flow, redirects user to Salesforce login
- `GET /auth/salesforce/callback` — handles OAuth callback, exchanges code for tokens, stores encrypted tokens
- `GET /api/user-settings/salesforce` — returns connection status (connected, disconnected, service_account)
- `PUT /api/user-settings/salesforce/preference` — sets user's Salesforce auth preference
- `DELETE /api/user-settings/salesforce` — disconnects user's Salesforce credentials
- `POST /api/user-settings/salesforce/test` — tests the current Salesforce connection

---

### T-02.03 — Implement Salesforce Data Routes

**Description:** Create the API routes that expose Salesforce data to the frontend and MCP server.

**Acceptance Criteria:**
- `GET /api/analytics/validation-trend` — validation trend over configurable months with enabled rules filter
- `GET /api/analytics/request-types-week` — request types aggregated by week
- `GET /api/analytics/completion-times` — provisioning completion time analytics
- `GET /api/provisioning/requests` — paginated PS requests with filters (type, account, status, date range, search)
- `GET /api/provisioning/search` — type-ahead search for PS requests
- `GET /api/provisioning/requests/:id` — single request detail
- `GET /api/provisioning/filter-options` — available filter values for UI dropdowns
- `GET /api/provisioning/new-records` — new records since a given timestamp
- `GET /api/provisioning/removals` — product removals within a timeframe
- All routes use `withSalesforceConnection()` middleware to resolve the appropriate SF connection

---

### T-02.04 — Implement SML Integration Service

**Description:** Build the SML (RMS tenant management system) integration service for accessing tenant entitlement data and ghost accounts.

**Acceptance Criteria:**
- `SmlService` class with methods for: get config, test connection, refresh token, get tenant products, tenant compare, proxy requests
- Token management: read/write `.sml_config.json` for auth cookies
- Automated token refresh via Playwright headless browser (SSO flow through Okta/Cognito)
- Auth state persistence in `.sml_auth_state.json` (cookies, localStorage)
- Multi-region support (EUW1, USE1, etc.)
- Configurable base URL (`SML_BASE_URL`) and timeout (`SML_API_TIMEOUT`)
- Feature flag: `ENABLE_SML` gates SML functionality

**Technical Details:**
- The SML system uses SSO; there is no standard API auth flow. Playwright automates the browser-based login.
- Auth state includes Okta, Cognito, and RMS cookies plus localStorage tokens.

---

### T-02.05 — Implement SML API Routes

**Description:** Create the API routes for SML configuration, token management, and data access.

**Acceptance Criteria:**
- `GET /api/sml/config` — returns current SML configuration and connection status
- `POST /api/sml/config` — updates SML configuration
- `GET /api/sml/token/status` — returns token validity and expiry
- `POST /api/sml/token/refresh` — triggers Playwright-based SSO token refresh
- `POST /api/sml/test` — tests SML connectivity
- `GET /api/sml/tenant/:tenantId/products` — returns products for a specific tenant
- `POST /api/sml/tenant-compare` — compares Salesforce vs SML entitlements
- `POST /api/sml/proxy` — proxies arbitrary requests to SML API
- All routes require authentication

---

### T-02.06 — Implement SML Tenant Data Storage

**Description:** Create the database tables and services for caching SML tenant data locally.

**Acceptance Criteria:**
- `sml_tenant_data` table stores cached tenant entitlement data
- `sml_ghost_accounts` table stores SML ghost account analysis
- Refresh scripts: `sml:refresh`, `sml:refresh:euw1`, `sml:refresh:use1`, `sml:check`
- `SmlGhostAccountsService` with methods for: list, get products, analyze, refresh, export, review, unique products

---

### T-02.07 — Implement Tenant Entitlements Service

**Description:** Build the service layer for querying and analyzing tenant entitlements across SML regions.

**Acceptance Criteria:**
- `TenantEntitlementsService` with methods: `suggest(search)`, `getSummary()`, `getAnalysis(status)`, `getProductBreakdown(tenantStatus, productStatus)`, `getEntitlements(tenant, account, includeExpired)`
- Routes at `/api/tenant-entitlements/`: suggest, summary, analysis, product-breakdown, list
- Type-ahead tenant name suggestions
- Filtering by tenant status and product status
- Include/exclude expired entitlements option

---

### T-02.08 — Implement Jira Integration Service

**Description:** Build the Atlassian Jira integration for searching initiatives and issues.

**Acceptance Criteria:**
- `JiraService` class with methods for: search initiatives, query issues
- Basic Auth using `ATLASSIAN_EMAIL` and `ATLASSIAN_API_TOKEN`
- JQL query construction for initiative search
- Routes at `/api/jira/` for initiative search
- Feature flag: `ENABLE_JIRA` gates Jira functionality
- Error handling for auth failures and rate limits

**Technical Details:**
- Environment variables: `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `ATLASSIAN_BASE_URL`, `ATLASSIAN_SITE_URL`, `ATLASSIAN_CLOUD_ID`

---

### T-02.09 — Implement Confluence Publishing Service

**Description:** Build the Confluence integration for publishing analytics and reports to Confluence pages.

**Acceptance Criteria:**
- `ConfluenceService` class with methods for: create page, update page, format content
- Routes for publishing: analytics overview → Confluence, current accounts → Confluence
- Content formatting: converts application data to Confluence Storage Format (XHTML)

---

### T-02.10 — Implement Microsoft Graph Integration

**Description:** Build the Microsoft Graph integration for OneDrive/Excel file access used by the Current Accounts feature.

**Acceptance Criteria:**
- `MicrosoftAuthService` class: OAuth 2.0 via MSAL, token acquisition and refresh
- `MicrosoftGraphExcelService` class: read/write Excel files on OneDrive via Graph API
- `ExcelService` class: Excel file operations (read, write, parse)
- `ExcelLookupService` class: tenant data lookup from Excel files
- `ExcelPollingService` class: poll for Excel file updates at configurable intervals
- Routes at `/api/auth/microsoft/`, `/api/excel-lookup/`, `/api/excel-polling/`
- `ExcelConfigModal` component on frontend for configuring Excel integration

**Technical Details:**
- Dependencies: `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `exceljs`, `xlsx`
- Environment variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`

---

### T-02.11 — Implement OpenAI LLM Integration

**Description:** Build the OpenAI integration service used by the Custom Reports AI chat feature.

**Acceptance Criteria:**
- `ReportLlmService` class with methods: `chat(message, conversationHistory, proposedConfig)`, `getCapabilities()`
- Per-user API key support: keys stored encrypted (AES-256-GCM) in `user_settings`
- System prompt construction using data catalog context
- Function calling support for report config generation
- Configurable model (`LLM_MODEL`), temperature (`LLM_TEMPERATURE`), max tokens (`LLM_MAX_TOKENS`)
- Rate limiting per user
- Feature flag: `ENABLE_REPORT_AI` gates LLM functionality

**Technical Details:**
- Dependencies: `openai`
- Environment variables: `OPENAI_API_KEY` (fallback), `LLM_PROVIDER`, `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`

---

### T-02.12 — Build Canonical Data Source Registry

**Description:** Create the canonical data source registry (`config/report-data-sources.js`) that serves as the single source of truth for all report-eligible API endpoints.

**Acceptance Criteria:**
- Registry exports an array of data source objects with fields: `id`, `endpoint`, `category`, `sourceType`, `sourceRef`, `primarySource`, `mcpToolName`, `description`, `params[]`, `responseShape`, `dependencies[]`
- Source types: `primary` (direct from external system), `derived` (computed from primary data), `preserved` (historical snapshots)
- ID convention: `<sourceType>.<sourceGroup>.<name>` (e.g., `primary.salesforce.provisioning-list`)
- Category convention: `<SourceType>: <Group>` (e.g., `Primary: Salesforce`)
- Params array uses exact parameter names matching Express route handlers
- Response shape defines `arrayKey` and `fields[]` with name, type, description
- Helper functions: `getToolSchema(canonicalId)`, `buildOpenAITools()`, `validateEndpointParams()`, `isEndpointAllowed()`, `getDataCatalog()`
- At least 24 data sources across 8 categories registered

---

### T-02.13 — Build Report Configuration Schema

**Description:** Create the Zod validation schema for custom report configurations.

**Acceptance Criteria:**
- `config/report-config-schema.js` exports Zod schemas for: report config, components, filters, layouts
- Supported component types: `kpi-card`, `bar-chart`, `line-chart`, `pie-chart`, `data-table`, `echarts`, `ag-grid`
- Layout types: `grid`, `stack`, `two-column`
- Each component schema validates: `type`, `title`, `dataSource` (endpoint, params, arrayKey), `config` (type-specific options)
- `validateReportConfig(config)` function returns validation result with detailed error messages

---

### T-02.14 — Build MCP Server Core

**Description:** Implement the MCP (Model Context Protocol) server that exposes application data to AI agents.

**Acceptance Criteria:**
- MCP server using `@modelcontextprotocol/sdk` with stdio transport
- Server name: `deployassist-mcp`, version `1.0.0`
- Configuration via environment variables: `MCP_SERVER_NAME`, `MCP_SERVER_ENABLED`, `INTERNAL_API_URL`
- `ApiClient` utility that calls the Express API using `INTERNAL_API_URL` (default `http://localhost:5000`)
- Auth modes: `passthrough` (forward user token), `service_account` (use `MCP_SERVICE_ACCOUNT_TOKEN`)
- Health validation on startup via `/api/health/database`
- Error handling middleware for tool execution failures
- Input validation middleware for tool parameters
- MCP tool invocation audit logging to `mcp_tool_invocations` table

**Technical Details:**
- Dependencies: `@modelcontextprotocol/sdk`
- Environment variables: `MCP_SERVER_ENABLED`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION`, `INTERNAL_API_URL`, `INTERNAL_API_TIMEOUT`, `MCP_AUTH_MODE`, `MCP_SERVICE_ACCOUNT_TOKEN`, `MCP_RATE_LIMIT_*`, `MCP_AUDIT_LOGGING`, `MCP_LOG_LEVEL`

---

### T-02.15 — Build MCP Tool Registry and Tool Files

**Description:** Implement the MCP tool registry and create all 42 tool files organized by category.

**Acceptance Criteria:**
- `mcp-server/config/tool-registry.js` dynamically registers tools from the `tools/` directory
- Each tool file exports: `name`, `description`, `inputSchema`, `execute(args, context)` function
- Tools derive their schema from the canonical data source registry via `getToolSchema(canonicalId)`
- Tools use `context.apiClient` to call Express API endpoints
- Tool categories and counts:
  - Analytics: `validation_trend`, `request_types_week`, `package_changes_summary`, `package_changes_by_product`, `package_changes_by_account`, `recent_package_changes`, `package_changes_status`, `ps_request_volume` (8 tools)
  - Provisioning: `search_provisioning_requests`, `get_provisioning_request`, `get_provisioning_filter_options`, `get_new_provisioning_records`, `get_provisioning_removals`, `list_provisioning_requests`, `get_validation_errors` (7 tools)
  - Audit Trail: `get_audit_stats`, `search_ps_records`, `get_ps_record`, `get_ps_status_changes`, `capture_ps_audit_changes` (5 tools)
  - Customer Products: `list_customer_products`, `get_product_update_options`, `create_product_update_request`, `get_product_update_requests`, `get_product_update_request`, `update_product_request_status`, `get_product_request_history` (7 tools)
  - Expiration: `get_expiration_monitor`, `refresh_expiration_data`, `get_expiration_status`, `query_expired_products` (4 tools)
  - Accounts: `list_ghost_accounts`, `get_ghost_account_products`, `review_ghost_account`, `delete_ghost_account`, `get_deprovisioned_accounts` (5 tools)
  - Packages: `list_packages`, `get_package`, `get_package_stats` (3 tools)
  - Integrations: `test_salesforce_connection`, `query_salesforce`, `search_jira_initiatives` (3 tools)

---

### T-02.16 — Build Data Alignment Validation Script

**Description:** Create the validation script that checks alignment between the canonical data source schema and MCP tool registry.

**Acceptance Criteria:**
- `scripts/validate-data-alignment.js` compares canonical data sources against registered MCP tools
- Reports: missing tools, orphaned tools, mismatched schemas, missing parameters
- Exit code 0 if aligned, non-zero if misaligned
- Can be run as `node scripts/validate-data-alignment.js`
- Output includes actionable guidance on how to fix misalignments

---

### T-02.17 — Implement Validation Service

**Description:** Build the validation service that checks PS records against configurable rules.

**Acceptance Criteria:**
- `ValidationService` with methods: `getErrors(timeFrame, enabledRules)`, `getAsyncResults(recordIds)`, `getAsyncStatus()`, `refreshSmlData()`
- `ValidationEngineService` for executing validation rules against records
- Routes at `/api/validation/`: errors, async-results, async-status, refresh-sml-data
- Async validation result storage in `async_validation_results` table
- Processing log in `async_validation_processing_log` table

**Key Detail:**
- Validation rules defined in the backend service (see T-09.07 for full list):

| Rule ID | Category | Logic |
|---------|----------|-------|
| `app-quantity-validation` | product-validation | quantity must = 1 except `IC-DATABRIDGE`, `RI-RISKMODELER-EXPANSION` |
| `model-count-validation` | product-validation | Fails if models > 100 |
| `entitlement-date-overlap-validation` | date-validation | Same productCode overlapping date ranges |
| `entitlement-date-gap-validation` | date-validation | Gaps between consecutive date ranges |
| `app-package-name-validation` | product-validation | Apps need packageName; exceptions: `DATAAPI-LOCINTEL`, `RI-COMETA`, `DATAAPI-BULK-GEOCODE`, `IC-RISKDATALAKE`, `IC-DATABRIDGE` |
| `deprovision-active-entitlements-check` | deprovision-validation | WARNING severity — warns if deprovision has active entitlements |

- `getErrors(timeFrame, enabledRules)` accepts `enabledRules` as a JSON-stringified array; `timeFrame` values: `1d`, `3d`, `1w`, `1m`
- Response includes `summary: { validRecords, invalidRecords, totalRecords }` and per-record error details

---

### T-02.18 — Implement Expiration Monitor Service

**Description:** Build the expiration monitoring service that analyzes product/entitlement expiration data.

**Acceptance Criteria:**
- `ExpirationService` with methods: `getMonitor(expirationWindow, showExtended)`, `refresh(lookbackYears, expirationWindow)`, `getStatus()`, `getExpiredProducts(category, accountName, ...)`
- Routes at `/api/expiration/`: monitor, refresh, status, expired-products
- Configurable expiration window (7, 30, 60, 90 days)
- Extension detection for renewed products
- Data stored in `expiration_monitor` and `expiration_analysis_log` tables
- Feature flag: `ENABLE_EXPIRATION_MONITOR`

---

### T-02.19 — Implement Package Changes Analytics Service

**Description:** Build the package change analytics service that tracks product package modifications over time.

**Acceptance Criteria:**
- `PackageChangesService` with methods: `getSummary(timeFrame)`, `getByProduct(timeFrame)`, `getByAccount(timeFrame, limit)`, `getRecent(limit)`, `refresh(lookbackYears)`, `getStatus()`, `export(timeFrame)`
- Routes at `/api/analytics/package-changes/`: summary, by-product, by-account, recent, refresh, status, export
- Data stored in `package_change_analysis` and `package_change_analysis_log` tables
- Excel export capability

---

### T-02.20 — Implement PS Audit Trail Service

**Description:** Build the PS audit trail service for tracking historical changes to PS records.

**Acceptance Criteria:**
- `PsAuditService` with methods: `getStats()`, `search(q)`, `getVolume(months)`, `getPsRecord(identifier)`, `getStatusChanges(identifier)`, `capture()`
- Routes at `/api/audit-trail/`: stats, search, ps-volume, ps-record/:identifier, status-changes/:identifier, capture
- Audit trail stored in `ps_audit_trail` table with change snapshots
- Audit log in `ps_audit_log` table
- Feature flag: `ENABLE_AUDIT_TRAIL`
- Maintenance scripts: `audit:backfill`, `audit:capture`, `audit:fix-names`, `audit:analyze-payloads`

---

### T-02.21 — Implement Ghost Accounts Service

**Description:** Build the ghost accounts service that identifies accounts with expired or invalid product entitlements.

**Acceptance Criteria:**
- Ghost accounts from Salesforce: `GhostAccountsService` with list, get products, review, delete, refresh
- Ghost accounts from SML: `SmlGhostAccountsService` with list, get products, analyze, refresh, export, review, unique products
- Routes at `/api/ghost-accounts/` and `/api/sml-ghost-accounts/`
- Data stored in `ghost_accounts` and `sml_ghost_accounts` tables
- Review workflow: mark accounts as reviewed with notes

---

### T-02.22 — Implement Packages Service

**Description:** Build the packages service for managing the package catalog.

**Acceptance Criteria:**
- `PackagesService` with methods: `list(type, includeDeleted)`, `get(identifier)`, `getStats()`, `export()`
- Routes at `/api/packages/`: list, get by ID, summary stats, export
- Data stored in `packages` table
- Excel export capability
- Package-product mapping in `package_product_mapping` table

---

### T-02.23 — Implement Customer Products Service

**Description:** Build the customer products service for viewing tenant product entitlements.

**Acceptance Criteria:**
- `CustomerProductsService` with methods: `getProducts(account, includeExpired)`
- Routes at `/api/customer-products/`
- Aggregates data from PS records and SML

---

### T-02.24 — Implement Product Update Workflow Service

**Description:** Build the product update request workflow service.

**Acceptance Criteria:**
- `ProductUpdateService` with methods: `getOptions()`, `createRequest()`, `getRequests()`, `getRequest(id)`, `updateStatus(id, status)`, `getHistory(id)`, `refreshOptions()`
- Routes at `/api/product-update/`: options, requests (CRUD), request history, refresh options
- Data stored in `product_update_options`, `product_update_requests`, `product_update_request_history` tables
- Status workflow: pending → approved/rejected

---

### T-02.25 — Implement Current Accounts Service

**Description:** Build the current accounts service for managing the active accounts list.

**Acceptance Criteria:**
- `CurrentAccountsService` with methods: `list()`, `getSyncStatus()`, `sync()`, `quickSync()`, `updateComments(id, comments)`, `publishToConfluence()`, `export()`
- Routes at `/api/current-accounts/`
- Data stored in `current_accounts` and `current_accounts_sync_log` tables
- Sync from SML and/or Salesforce
- Excel update integration (via Microsoft Graph)
- Confluence publishing
- Editable comments per account

---

### T-02.26 — Implement Report Data Routes

**Description:** Create the report data API routes that the ReportRenderer uses to fetch data for individual report components.

**Acceptance Criteria:**
- `GET /api/report-data/catalog` — returns the data catalog (grouped by category)
- `POST /api/report-data/fetch` — fetches data from an allowlisted endpoint with optional enrichment; accepts `endpoint`, `params`, `arrayKey`, `enrich`
- Endpoint allowlisting: only endpoints registered in the canonical data source registry can be fetched
- Parameter validation against canonical schema
- Optional data enrichment (joins, transformations)

**Key Detail:**
- The `POST /api/report-data/fetch` endpoint is used by the ReportRenderer only when a component's `dataSource.enrich` property is set; otherwise the renderer fetches data directly from the source endpoint via GET
- Catalog response groups data sources by category with source type badges: `primary`, `derived`, `preserved`
- Per source in catalog: endpoint, description, `primarySource`, params (name, type, default), response shape (`arrayKey`, `fields[]`)

---

### T-02.17 — Implement Mixpanel Analytics Integration

**Description:** Build the Mixpanel integration service that connects to the Mixpanel API using service account credentials (HTTP Basic Auth). Supports raw event export, Insights/Funnels/Retention Query API, and Engage (Profiles) API.

**Acceptance Criteria:**
- `MixpanelService` class with methods for: `testConnection`, `exportEvents`, `queryInsights`, `queryFunnels`, `queryRetention`, `queryProfiles`, `getEventNames`
- Service account authentication via HTTP Basic Auth (username + secret)
- Per-user encrypted credential storage in `user_settings` table with fallback to `MIXPANEL_*` environment variables
- Connection test endpoint validates credentials against Mixpanel export API
- 6 canonical data source entries in `report-data-sources.js` under `Primary: Mixpanel` category
- 6 MCP tools registered for Cursor agent access: `export_mixpanel_events`, `query_mixpanel_insights`, `query_mixpanel_funnels`, `query_mixpanel_retention`, `query_mixpanel_profiles`, `list_mixpanel_event_names`
- Settings page section under Data Sources → Mixpanel with credential entry, test connection, and remove functionality

**Technical Details:**
- Dependencies: native `https` module (no external packages required)
- Environment variables: `MIXPANEL_SERVICE_ACCOUNT_USERNAME`, `MIXPANEL_SERVICE_ACCOUNT_SECRET`, `MIXPANEL_PROJECT_ID`
- API hosts: `data.mixpanel.com` (event export), `mixpanel.com` (Query API, Engage API)
- Rate limits: Query API is 60 requests/hour, 5 concurrent; Export API is unlimited
- Mixpanel plan requirement: Query API (Insights/Funnels/Retention) requires Growth or Enterprise plan; Event export works on all plans

---

### T-02.18 — Implement Mixpanel Settings UI

**Description:** Add Mixpanel configuration section to the Settings page under Data Sources for credential management.

**Acceptance Criteria:**
- `GET /api/user-settings/mixpanel` — returns masked credential status + env fallback flag
- `PUT /api/user-settings/mixpanel` — saves encrypted username, secret, and project ID
- `DELETE /api/user-settings/mixpanel` — removes stored Mixpanel credentials
- `POST /api/user-settings/mixpanel/test` — tests connectivity using stored/env credentials
- Settings UI shows connection status (configured/env fallback/not configured)
- Username and secret inputs with show/hide toggle and encryption notice
- Project ID field with description of where to find it
- Test Connection and Remove buttons when credentials are configured

---

### T-02.20 — Implement Usage Limits Monitor

**Description:** Build an aggregation endpoint and frontend page that monitors customer quota utilization from Mixpanel events, cross-referenced with SML entitlements.

**Acceptance Criteria:**
- `GET /api/mixpanel/usage-limits` endpoint that exports and aggregates quota/storage events per tenant
- Utilization calculation: `currentValue / limit × 100%`; status classification: exceeded (≥100%), warning (≥80%), ok (<80%)
- Tracked quota events: `DailyJobsRun`, `DailyUnderwriterJobsRun`, `DailyTreatyJobsRun`, `EntitlementUsage`, etc.
- Tracked storage events: `StorageStatus`, `TotalDiskSpaceInMb`, `UsedDiskSpaceInMb`, etc.
- Frontend page at `/experimental/usage-limits` with summary cards, filterable tenant table, and expandable detail rows
- Expandable rows show quota metric breakdown and SML entitlement cross-reference
- Canonical data source entry `derived.mixpanel.usage-limits` and MCP tool `get_usage_limits`
- Navigation entry under Experimental Pages > Usage Limits

**Technical Details:**
- Backend: `routes/mixpanel-usage.routes.js` with credential resolution from `user_settings`
- Frontend: `frontend/src/pages/UsageLimits.jsx`
- Entitlements fetched via existing `/api/tenant-entitlements?tenant=<tenantId>` endpoint
- Configurable time window (1–30 days) and event limit

---

## User Stories

### US-02.01 — User Can Connect Their Salesforce Account

**As a** deployment team member, **I want to** connect my personal Salesforce account via OAuth **so that** I can access live provisioning data without sharing credentials.

**Acceptance Criteria:**
- Settings page shows Salesforce connection status (Connected/Disconnected/Service Account)
- "Connect" button initiates OAuth flow, redirecting to Salesforce login
- After successful OAuth, status updates to "Connected" with my Salesforce username
- "Test Connection" button verifies the connection works
- "Disconnect" button removes my stored credentials
- If I don't have a personal connection and have the `salesforce.service_account` permission, the shared service account is used automatically

**Dependencies:** T-02.01, T-02.02

---

### US-02.02 — User Can View SML Connection Status

**As an** administrator, **I want to** see the SML connection status and refresh tokens when needed **so that** tenant entitlement data stays accessible.

**Acceptance Criteria:**
- Settings page shows SML configuration: environment, token expiry, last refresh time
- "Refresh Token" button triggers automated SSO refresh
- "Test Connection" button verifies SML API accessibility
- Status indicators: connected (green), expiring soon (yellow), expired (red)

**Dependencies:** T-02.04, T-02.05

---

### US-02.04 — User Can Connect Mixpanel Analytics

**As a** deployment team member, **I want to** connect my Mixpanel service account **so that** I can pull product usage analytics data into reports and the Cursor agent.

**Acceptance Criteria:**
- Settings page shows Mixpanel section under Data Sources with connection status
- User can enter service account username, secret, and project ID
- Credentials are encrypted before storage; secrets are masked in API responses
- "Test Connection" button validates credentials against Mixpanel
- "Remove" button clears all stored Mixpanel credentials
- Once configured, 7 Mixpanel data sources appear in the report builder's Data Catalog (6 primary + 1 derived)
- Cursor agent can invoke Mixpanel MCP tools to query events, insights, funnels, retention, profiles, and usage limits
- If no per-user credentials, server-wide `MIXPANEL_*` environment variables are used as fallback
- Usage Limits Monitor page available under Experimental Pages in navigation

**Dependencies:** T-02.17, T-02.18, T-02.20

---

### US-02.05 — User Can Monitor Customer Usage Limits

**As a** deployment team member, **I want to** see which customers have hit or are approaching their usage limits **so that** I can proactively address capacity issues.

**Acceptance Criteria:**
- Usage Limits page is accessible under Experimental Pages > Usage Limits in the sidebar
- Summary cards show total tenants, exceeded count, warning count, and OK count
- Tenant table shows each tenant with status badge, peak utilization bar, and quota metric tags
- Clicking a summary card filters the table to that status category
- Search bar allows filtering by tenant name
- Time range selector allows choosing 1, 3, 7, 14, or 30 days of data
- Expanding a tenant row shows detailed quota metrics (current value, limit, utilization, status)
- Expanding a tenant row also shows storage metrics when available
- Expanding a tenant row fetches and displays SML entitlements for that tenant (product name, package, quantity, status, end date)
- Tenants are sorted by severity (exceeded first, then warning, then OK)

**Dependencies:** T-02.17, T-02.20

---

### US-02.02b — Daily Limit Exceedances Report

**As a** deployment team member, **I want to** see which customers exceeded their daily quota limits and on how many days **so that** I can identify chronic over-usage patterns and take corrective action.

**Acceptance Criteria:**
- Daily Exceedances page is accessible under Experimental Pages > Daily Exceedances in the sidebar
- Summary cards show total customers exceeding limits, total exceedance days, and the period length
- Report defaults to 14 days with options for 7, 14, 30, 60, or 90 days
- Only customers with at least one daily exceedance are shown
- Each row shows the tenant, account, exceedance day count, and a frequency bar
- Expanding a row shows per-day breakdown with exceeded metrics, values, limits, and utilization percentages
- Tenants are sorted by exceedance day count (highest first)
- Search allows filtering by tenant name or account name
- Async refresh fetches data from Mixpanel (same background job pattern as Usage Limits)
- Canonical data source `derived.mixpanel.daily-exceedances` registered with MCP tool `get_daily_exceedances`

**Dependencies:** T-02.17, T-02.20

---

### US-02.03 — AI Agent Can Access Application Data via MCP

**As an** AI agent (e.g., Claude in Cursor), **I want to** invoke MCP tools to query deployment data **so that** I can answer user questions about provisioning, analytics, and accounts without requiring manual UI navigation.

**Acceptance Criteria:**
- MCP server responds to `tools/list` with all 50 registered tools (including 8 Mixpanel tools)
- Each tool invocation returns data from the Express API
- Tool parameters validated before execution
- Invocations are audit-logged in `mcp_tool_invocations` table
- Authentication is enforced (passthrough or service account mode)

**Dependencies:** T-02.14, T-02.15
