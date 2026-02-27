# Custom Reports Feature - AI-Driven Report Builder

**Date:** February 27, 2026  
**Status:** ✅ Complete (All Phases)  
**Version:** 1.6

---

## Overview

Custom Reports allows users to create personalized data reports through a conversational AI interface. Users interact with an AI agent via a chat window, describe the report they want, and the AI generates a structured report definition that is stored in the database and rendered dynamically.

### Key Design Decision

Reports are stored as **JSON configuration definitions** in a `custom_reports` database table, rendered at runtime by a generic `<ReportRenderer>` component. This approach was chosen over raw JSX file generation for security, safety, and manageability:

- No filesystem writes at runtime
- Users cannot modify any other part of the codebase
- Reports are sandboxed to a strict set of pre-built widget types
- Easy to version, edit, and delete

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │  CreateReport │  │  CustomReportView                │  │
│  │  (Chat UI)    │  │  (ReportRenderer → widgets)      │  │
│  └──────┬───────┘  └──────────────┬───────────────────┘  │
│         │                         │                      │
│         │  POST /api/report-agent │  GET /api/custom-    │
│         │  /chat                  │  reports/:slug/data  │
└─────────┼─────────────────────────┼──────────────────────┘
          │                         │
┌─────────▼─────────────────────────▼──────────────────────┐
│  Backend                                                  │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ Report Agent  │  │  Custom Reports CRUD             │  │
│  │ Routes        │  │  Routes                          │  │
│  └──────┬───────┘  └──────────────┬───────────────────┘  │
│         │                         │                      │
│  ┌──────▼───────┐  ┌──────────────▼───────────────────┐  │
│  │ LLM Service  │  │  CustomReportRepository           │  │
│  │ (OpenAI /    │  │  (PostgreSQL)                     │  │
│  │  Anthropic)  │  │                                   │  │
│  └──────┬───────┘  └─────────────────────────────────-┘  │
│         │                                                 │
│  ┌──────▼──────────────────────────────────────────────┐  │
│  │ Data Catalog (allowlisted GET-only API endpoints)   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Backend + Database) ✅ Complete
- Database migration: `custom_reports` table
- Allowlisted data sources registry
- Report config Zod schema & validation
- Custom reports repository (CRUD)
- Custom reports API routes
- Report agent chat endpoint (stub, LLM integration in Phase 3)
- Route mounting in `app.js`

### Phase 2: Frontend (Chat UI + Report Renderer) ✅ Complete
- `CreateReport.jsx` - Chat interface with live preview
- `CustomReportView.jsx` - Dynamic report page
- `ReportRenderer.jsx` - JSON config → Chart.js/table widgets
- Widget sub-components: `KpiCard`, `ChartWidget`, `DataTable`
- Sidebar integration with dynamic report listing
- Route registration in `App.jsx`
- `reportAgentService.js` - Frontend API service

### Phase 3: AI Agent Logic ✅ Complete
- LLM client service (`services/report-llm.service.js`)
- System prompt with full report schema + data catalog context
- Conversation orchestration via OpenAI chat completions
- Automatic JSON config extraction from `\`\`\`report-config` fenced blocks
- Server-side validation of LLM-generated configs before sending to frontend
- Graceful fallback: when no `OPENAI_API_KEY` is set, the chat returns a stub response and the "Load Sample" button remains available
- Frontend shows "AI Active" / "Sample Only" badge and contextual banner

### Phase 4: Polish & Security ✅ Complete
- **Rate limiting** – 10 req/min on `/api/report-agent/chat`, 5 req/min on `/api/user-settings/llm/test` (uses `express-rate-limit`)
- **Report editing & versioning** – Edit button on report view page, navigates to `/custom-reports/edit/:slug` which opens `CreateReport` in edit mode, pre-populating config + conversation history; updates increment the `version` column
- **Config validation hardening** – HTML/script tag stripping on all text fields, `safeId` regex on component/filter IDs, `safeFieldPath` regex on data field references, hex color validation, `width` max-length on columns
- **JSON export** – "Export" button on the preview panel downloads the current report configuration as a `.json` file
- **JSON import** – "Import" button on both the Create Report page and Reports List page; accepts a `.json` config file, validates structure (requires `title` + `components`), loads it into the preview for review before saving
- **Page entitlements** – Already enforced via `ProtectedRoute` in Phase 1
- **Delete navigation fix** – After deleting a report from the view page, user is now redirected to the reports list instead of the create page

---

## Database Schema

### `custom_reports` Table

```sql
CREATE TABLE custom_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    report_config JSONB NOT NULL,
    data_sources JSONB,
    conversation_history JSONB,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1
);
```

### Page Entitlements

New pages added to the `pages` table:
- `custom_reports` (parent section)
- `custom_reports.create` (Create Report chat page)
- `custom_reports.view` (View saved reports)

---

## Report Config JSON Schema

Report definitions follow a strict JSON structure. The AI generates these configurations, which are validated server-side before saving.

### Structure

```json
{
  "title": "Weekly Provisioning Summary",
  "description": "Overview of provisioning activity for the past week",
  "layout": "grid",
  "refreshInterval": 300,
  "filters": [
    {
      "id": "timeRange",
      "type": "select",
      "label": "Time Range",
      "options": [
        { "value": "7", "label": "7 days" },
        { "value": "30", "label": "30 days" },
        { "value": "90", "label": "90 days" }
      ],
      "default": "30",
      "mapsToParam": "months"
    }
  ],
  "components": [
    {
      "id": "total-requests",
      "type": "kpi-card",
      "title": "Total Requests",
      "gridSpan": 1,
      "dataSource": {
        "endpoint": "/api/analytics/request-types-week",
        "params": { "months": 1 },
        "transform": "count"
      },
      "valueField": "count",
      "format": "number"
    },
    {
      "id": "requests-by-type",
      "type": "bar-chart",
      "title": "Requests by Type",
      "gridSpan": 2,
      "dataSource": {
        "endpoint": "/api/analytics/request-types-week",
        "params": { "months": 3 }
      },
      "xField": "requestType",
      "yField": "count",
      "colors": ["#3B82F6", "#10B981", "#F59E0B"]
    },
    {
      "id": "recent-changes",
      "type": "data-table",
      "title": "Recent Package Changes",
      "gridSpan": 3,
      "dataSource": {
        "endpoint": "/api/analytics/package-changes/recent",
        "params": { "limit": 20 }
      },
      "columns": [
        { "field": "account_name", "header": "Account" },
        { "field": "product_name", "header": "Product" },
        { "field": "change_type", "header": "Type" },
        { "field": "ps_created_date", "header": "Date", "format": "date" }
      ]
    }
  ]
}
```

### Supported Component Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `kpi-card` | Single metric display | `valueField`, `format` |
| `bar-chart` | Bar chart (vertical) | `xField`, `yField` |
| `line-chart` | Line chart (time series) | `xField`, `yField` |
| `pie-chart` | Pie/doughnut chart | `labelField`, `valueField` |
| `data-table` | Tabular data display | `columns` |

### Conditional Formatting (Data Tables)

Data tables support a `conditionalFormatting` property -- an array of rules that highlight entire rows based on cell values. Rules are evaluated in order; the first matching rule determines the row style.

#### Rule Schema

```json
{
  "conditionalFormatting": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Expired",
      "style": "danger"
    }
  ]
}
```

#### Available Operators

| Operator | Description | Best For |
|----------|-------------|----------|
| `equals` | Exact match (case-sensitive) | Status values, categories |
| `notEquals` | Does not match | Exclusion highlighting |
| `contains` | Substring match (case-insensitive) | Partial text matching |
| `greaterThan` | Numeric `>` | Threshold alerts |
| `lessThan` | Numeric `<` | Below-minimum warnings |
| `greaterThanOrEqual` | Numeric `>=` | At-or-above threshold |
| `lessThanOrEqual` | Numeric `<=` | At-or-below threshold |

#### Available Styles

| Style | Appearance | Use Case |
|-------|------------|----------|
| `danger` | Red background, red text | Expired, failed, critical |
| `warning` | Amber background, amber text | Expiring soon, needs attention |
| `success` | Green background, green text | Active, completed, healthy |
| `info` | Blue background, blue text | Informational highlights |
| `muted` | Gray background, gray text | Inactive, archived, low priority |

### Supported Formats

- `number` - Plain number with comma separators
- `currency` - Dollar format
- `percentage` - Percentage with % suffix
- `date` - Formatted date string

---

## Data Catalog (Allowlisted Endpoints)

Only GET endpoints from the existing API are available for reports. The AI agent receives this catalog as context and can only reference endpoints listed here.

See `config/report-data-catalog.js` for the full registry.

### Categories

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Analytics | 4 | Validation trends, request types, completion times, PS volume |
| Package Changes | 4 | Summary, by product, by account, recent changes |
| Provisioning | 4 | Search, list, filter options, removals |
| Expiration | 3 | Monitor, status, expired products |
| Customer Products | 2 | List products (PS records), update requests |
| Tenant Entitlements | 1 | SML-based entitlements by account (preferred for entitlement reports) |
| Ghost Accounts | 2 | List, deprovisioned |
| Packages | 2 | List, stats |
| Audit Trail | 3 | Stats, search, status changes |

---

## API Endpoints

### Custom Reports CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/custom-reports` | List all active reports for the user |
| `GET` | `/api/custom-reports/data-catalog` | Get available data sources |
| `GET` | `/api/custom-reports/:slug` | Get a specific report config |
| `POST` | `/api/custom-reports` | Create a new report |
| `PUT` | `/api/custom-reports/:id` | Update an existing report |
| `DELETE` | `/api/custom-reports/:id` | Soft-delete a report |

### Report Agent Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/report-agent/chat` | Send message to AI agent, receive response |

---

## API Key Management

Users can configure their own OpenAI API key via **Settings > AI Configuration**. The key resolution order is:

1. **Per-user key** – stored encrypted (AES-256-GCM) in the `user_settings` database table
2. **Server-wide key** – `OPENAI_API_KEY` environment variable
3. **No key** – falls back to sample-only mode

### User Settings API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/user-settings/llm` | Get current LLM settings (key is masked) |
| `PUT` | `/api/user-settings/llm` | Save API key (encrypted) and model preference |
| `DELETE` | `/api/user-settings/llm` | Remove all LLM settings |
| `POST` | `/api/user-settings/llm/test` | Test the stored API key with a minimal call |

### Database: `user_settings` Table

```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, setting_key)
);
```

## Environment Variables (Phase 3)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | _(empty)_ | Server-wide fallback key. Per-user keys in Settings take priority. |
| `LLM_PROVIDER` | No | `openai` | LLM provider (currently only `openai` supported) |
| `LLM_MODEL` | No | `gpt-4o` | Default model (users can override in Settings) |
| `LLM_MAX_TOKENS` | No | `4096` | Max tokens for LLM response |
| `LLM_TEMPERATURE` | No | `0.2` | Temperature for LLM response (lower = more deterministic) |
| `ENABLE_REPORT_AI` | No | `true` | Feature flag to disable AI reporting even if key is present |

---

## Security Constraints

1. **Read-only data access** - Reports can only query GET endpoints
2. **Allowlist enforcement** - Only endpoints in the data catalog are permitted
3. **Schema validation** - All report configs validated with Zod before saving
4. **Page entitlements** - Access controlled via existing role-based system
5. **No code generation** - Reports are data definitions, not executable code
6. **Rate limiting** - Chat endpoint: 10 req/min, LLM test: 5 req/min
7. **User scoping** - Users can only manage their own reports

---

## Dependencies

### New (Phase 1)
- None (uses existing `zod`, `pg`, `express`)

### New (Phase 3 - AI Integration)
- `openai` - OpenAI SDK for chat completions

---

## File Locations

### Phase 1 Files
- `database/add-custom-reports.sql` - Migration
- `config/report-data-catalog.js` - Allowlisted data sources
- `config/report-config-schema.js` - Zod validation schema
- `repositories/custom-report.repository.js` - Data access
- `services/custom-report.service.js` - Business logic
- `routes/custom-reports.routes.js` - CRUD API
- `routes/report-agent.routes.js` - AI chat API

### Phase 2 Files (Frontend) ✅ Created
- `frontend/src/pages/CreateReport.jsx` - Chat interface with split-pane (chat + live preview)
- `frontend/src/pages/CustomReportView.jsx` - Report viewer with delete support
- `frontend/src/components/reports/ReportRenderer.jsx` - JSON config → widget rendering engine
- `frontend/src/components/reports/widgets/KpiCard.jsx` - KPI metric card widget
- `frontend/src/components/reports/widgets/ChartWidget.jsx` - Bar/Line/Pie chart widget (Chart.js)
- `frontend/src/components/reports/widgets/DataTable.jsx` - Sortable, searchable data table
- `frontend/src/services/reportAgentService.js` - AI chat API service
- `frontend/src/services/customReportService.js` - Reports CRUD API service

### Modified Files (Phase 2)
- `frontend/src/App.jsx` - Added routes: `/custom-reports/create`, `/custom-reports/:slug`
- `frontend/src/components/layout/Sidebar.jsx` - Added Custom Reports collapsible section with DocumentChartBarIcon

### Phase 3 Files (AI Agent)
- `services/report-llm.service.js` - OpenAI LLM wrapper with system prompt, config extraction, and availability check

### Phase 3 + Settings Files
- `utils/encryption.js` - AES-256-GCM encrypt/decrypt/mask utilities
- `routes/user-settings.routes.js` - CRUD API for per-user LLM key (encrypted storage)
- `database/add-user-settings.sql` - Migration for `user_settings` table
- `scripts/database/run-user-settings-migration.js` - Node.js migration runner

### Modified Files (Phase 3)
- `config/environment.js` - Added `llm` config block and `enableReportAI` feature flag
- `routes/report-agent.routes.js` - LLM chat path with per-user key resolution and stub fallback
- `services/report-llm.service.js` - `resolveApiKey()` checks user_settings then env var
- `frontend/src/pages/CreateReport.jsx` - AI availability badge, no-key banner, `config_proposed` handling
- `frontend/src/pages/Settings.jsx` - New "AI Configuration" section with key entry, model select, test
- `frontend/src/services/settingsService.js` - LLM CRUD methods
- `app.js` - Mounted `/api/user-settings` routes

### Phase 4 Modified Files
- `routes/report-agent.routes.js` - Added `chatLimiter` rate limit middleware (10 req/min)
- `routes/user-settings.routes.js` - Added `llmTestLimiter` rate limit middleware (5 req/min)
- `config/report-config-schema.js` - Added `sanitizeString`, `safeId`, `safeFieldPath`, `safeColor` validators
- `frontend/src/pages/CreateReport.jsx` - Edit mode via `useParams()`, JSON export/import, update-vs-create save flow, router state for import from list page
- `frontend/src/pages/CustomReportsList.jsx` - Added Import button (file picker → navigate to create page with config in router state)
- `frontend/src/pages/CustomReportView.jsx` - Added Edit button, fixed delete redirect to `/custom-reports`
- `frontend/src/App.jsx` - Added `/custom-reports/edit/:slug` route

### Migration Script
- `scripts/database/run-custom-reports-migration.js` - Node.js migration runner

---

### Version 1.5 – Data Catalog & Nested Field Support Fix (February 27, 2026)

**Version:** 1.5

#### Problem

Reports generated by the AI agent showed empty tables and charts despite API data being fetched successfully. Two root causes were identified:

1. **Data catalog field name mismatches** – The `report-data-catalog.js` documented incorrect field names (e.g. camelCase `account` instead of the actual `account_name`). Since the LLM uses the catalog to generate column definitions, tables had wrong field references.

2. **No dot-path resolution in widgets** – Many API responses contain nested objects (e.g. `account: { id, name }`). The LLM correctly generates dot-path column fields like `account.name`, but `DataTable` and `ChartWidget` used direct property access (`row[col.field]`) which treats `"account.name"` as a literal key instead of traversing the nested path.

#### Fixes

**Data Catalog (`config/report-data-catalog.js`)**:
- All `responseShape.fields` now match actual API response keys
- `summary` descriptions document which key the data array lives under (e.g. `"data"`, `"ghostAccounts"`, `"trendData"`, `"requests"`)
- Fixed `/api/packages/stats` → `/api/packages/summary/stats`
- Removed `/api/analytics/ps-request-volume` (no route exists)
- Corrected query param names (e.g. `expirationWindow` not `days`, `account` not `accountName`)
- Removed `[]` array notation from field names to avoid LLM confusion

**Widget Dot-Path Resolution (`DataTable.jsx`, `ChartWidget.jsx`)**:
- Added `resolveField(obj, path)` helper to both widgets
- Cell rendering now uses `resolveField(row, col.field)` instead of `row[col.field]`
- Search filtering and sorting also use `resolveField` for nested field support
- Chart axis fields (`xField`, `yField`, `labelField`, `valueField`) also use `resolveField`

**ReportRenderer (`ReportRenderer.jsx`)**:
- Added missing response array keys to `extractArray()`: `trendData`, `requests`, `expirations`, `accounts`, `weeklyData`, `technicalRequests`

**LLM System Prompt (`report-llm.service.js`)**:
- Strengthened rules to emphasize exact field name matching from the catalog
- Added explicit guidance about snake_case field names and response array key locations

**Impact**: Existing saved reports created before this fix may still have incorrect field names in their stored `report_config`. These reports should be edited or re-created.

---

---

### Version 1.6 – Cross-Component Interactivity: Row-Click Linked Parameters (February 27, 2026)

**Version:** 1.6

#### Overview

Added the ability for users to click a row in one data-table component to dynamically set a query parameter on another component, triggering a data refresh. This enables master-detail patterns such as "click an account to see its entitlements."

#### How It Works

1. A **source** data-table component defines an `onRowClick` property:
   - `paramId` – a unique identifier for the published value (e.g. `"selectedAccount"`)
   - `valueField` – a dot-path into the clicked row to extract the value (e.g. `"account.name"`)

2. A **target** component adds `linkedParams` to its `dataSource`:
   - Maps a query parameter name to the `paramId` from step 1 (e.g. `{ "account": "selectedAccount" }`)
   - The target component shows a placeholder ("Click a row in the table above to view data here.") until a row is selected
   - Once a row is clicked, the target component automatically fetches data with the linked parameter value injected

#### Example Config

```json
{
  "components": [
    {
      "id": "accounts-table",
      "type": "data-table",
      "title": "Accounts with Expiring Products",
      "dataSource": {
        "endpoint": "/api/expiration/monitor",
        "params": { "expirationWindow": 30 }
      },
      "onRowClick": {
        "paramId": "selectedAccount",
        "valueField": "account.name"
      },
      "columns": [
        { "field": "account.name", "header": "Account Name" },
        { "field": "earliestExpiry", "header": "Earliest Expiry", "format": "date" }
      ]
    },
    {
      "id": "entitlements-table",
      "type": "data-table",
      "title": "Entitlements for Selected Account",
      "dataSource": {
        "endpoint": "/api/customer-products",
        "params": { "account": "" },
        "linkedParams": { "account": "selectedAccount" }
      },
      "columns": [
        { "field": "productsByRegion.region", "header": "Region" },
        { "field": "productsByRegion.models", "header": "Models" }
      ]
    }
  ]
}
```

#### Files Changed

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added `onRowClickSchema` (`paramId` + `valueField`), optional `onRowClick` on `dataTableSchema`, optional `linkedParams` (`z.record(safeId)`) on `dataSourceSchema` |
| `frontend/src/components/reports/ReportRenderer.jsx` | Added `componentParams` state to `ReportRenderer`, `handleLinkedRowClick` callback, linked parameter injection and placeholder rendering in `ComponentRenderer` |
| `frontend/src/components/reports/widgets/DataTable.jsx` | Accepts `onRowClickConfig`, `onRowClick`, `selectedRowValue` props; clickable rows with `cursor-pointer`, blue highlight for selected row |
| `services/report-llm.service.js` | Added "Cross-Component Interactivity" section to LLM system prompt with `onRowClick`/`linkedParams` schema and example |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

#### Data Flow

```
User clicks row in source table
  → DataTable calls onRowClick(paramId, value)
  → ReportRenderer stores value in componentParams state
  → ComponentRenderer for target component detects linkedParams
  → Merges linked value into request params
  → Fetches data with updated params
  → Target component re-renders with new data
```

---

### Version 1.7 – Tenant Entitlements Data Source (February 27, 2026)

**Version:** 1.7

#### Overview

Added a new `/api/tenant-entitlements` endpoint that serves product entitlement data from the `sml_tenant_data` table (synced from SML during full sync) instead of from PS records in Salesforce. This provides a more direct and reliable source for entitlement data in custom reports.

#### Why

The existing `/api/customer-products` endpoint reads entitlements from PS records (Salesforce audit trail), which represents a secondary source. The `sml_tenant_data` table contains entitlements pulled directly from SML during the full sync on the Current Accounts page, stored in the `product_entitlements` JSONB column. This new endpoint makes that data available to custom reports in a flat, table-friendly format.

#### New Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tenant-entitlements?account=<name>` | Get entitlements for an account from SML tenant data |

**Query Parameters:**
- `account` (required) – Account name to look up
- `includeExpired` (optional, default `false`) – Include expired entitlements

**Response Shape:**
```json
{
  "success": true,
  "account": "Acme Corp",
  "entitlements": [
    {
      "tenantName": "acme-prod",
      "tenantId": "6000009",
      "category": "apps",
      "productCode": "APP-001",
      "productName": "My App",
      "packageName": "Enterprise",
      "productModifier": "",
      "quantity": 1,
      "startDate": "2024-01-01",
      "endDate": "2025-12-31",
      "status": "Active",
      "daysRemaining": 300
    }
  ],
  "summary": {
    "totalEntitlements": 15,
    "activeCount": 12,
    "expiringCount": 2,
    "expiredCount": 1,
    "tenantCount": 1
  },
  "source": "sml_tenant_data"
}
```

#### Example Report Config

Reports that need entitlement data should use `/api/tenant-entitlements` instead of `/api/customer-products`:

```json
{
  "id": "entitlements-table",
  "type": "data-table",
  "title": "Entitlements for Selected Account",
  "dataSource": {
    "endpoint": "/api/tenant-entitlements",
    "params": { "account": "" },
    "linkedParams": { "account": "selectedAccount" }
  },
  "columns": [
    { "field": "productName", "header": "Product", "sortable": true },
    { "field": "category", "header": "Category", "sortable": true },
    { "field": "packageName", "header": "Package", "sortable": true },
    { "field": "startDate", "header": "Start Date", "format": "date", "sortable": true },
    { "field": "endDate", "header": "End Date", "format": "date", "sortable": true },
    { "field": "status", "header": "Status", "sortable": true },
    { "field": "daysRemaining", "header": "Days Remaining", "format": "number", "sortable": true }
  ]
}
```

#### Files Changed

| File | Change |
|------|--------|
| `database.js` | Added `getSMLTenantEntitlementsByAccount()` – queries `sml_tenant_data` by account name with entitlements |
| `services/tenant-entitlements.service.js` | New service that flattens `product_entitlements` JSONB into a table-friendly array with status calculation |
| `routes/tenant-entitlements.routes.js` | New route: `GET /api/tenant-entitlements` |
| `app.js` | Mounted `/api/tenant-entitlements` route |
| `config/report-data-catalog.js` | Added `tenant-entitlements.list` to the data catalog with flat response shape |
| `services/report-llm.service.js` | Updated LLM system prompt to prefer `/api/tenant-entitlements` for entitlement data |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

#### Data Flow

```
Custom report config references /api/tenant-entitlements
  → Route calls TenantEntitlementsService.getEntitlementsByAccount()
  → Service calls db.getSMLTenantEntitlementsByAccount(accountName)
  → Database queries sml_tenant_data WHERE account_name ILIKE $1
  → Service flattens product_entitlements JSONB (apps/models/data + expansion packs)
  → Service calculates status (Active / Expiring Soon / Expired) and daysRemaining
  → Returns flat entitlements array to report widget
```

---

### Version 1.8 – Conditional Formatting for Data Tables (February 27, 2026)

**Version:** 1.8

#### Overview

Added conditional formatting support to data-table widgets. Report creators can define rules that highlight entire table rows based on cell values -- for example, coloring rows red when a product's status is "Expired" or amber when it's "Expiring Soon."

#### How It Works

A `conditionalFormatting` array is added to any data-table component configuration. Each rule specifies:
- `field` -- the dot-path to the cell value to evaluate
- `operator` -- comparison operator (`equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`)
- `value` -- the value to compare against
- `style` -- the row highlight style (`danger`, `warning`, `success`, `info`, `muted`)

Rules are evaluated in order per row; the first matching rule wins. Selected rows (from row-click linking) take priority over conditional formatting styles.

#### Example Config

```json
{
  "id": "entitlements-table",
  "type": "data-table",
  "title": "Account Entitlements",
  "dataSource": {
    "endpoint": "/api/tenant-entitlements",
    "params": { "account": "Acme Corp", "includeExpired": "true" }
  },
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
```

#### Files Changed

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added `conditionalFormatRuleSchema` (field, operator, value, style) and optional `conditionalFormatting` array on `dataTableSchema` |
| `frontend/src/components/reports/widgets/DataTable.jsx` | Added `CF_STYLES` map, `evaluateRule()` and `getRowStyle()` helpers; row/cell classes now driven by first matching rule |
| `frontend/src/components/reports/ReportRenderer.jsx` | Passes `conditionalFormatting` prop from component config to `DataTable` |
| `services/report-llm.service.js` | Added `conditionalFormatting` to data-table schema in LLM prompt; added dedicated "Conditional Formatting" guidance section |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

**Last Updated:** February 27, 2026
