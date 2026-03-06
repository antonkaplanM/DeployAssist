# Custom Reports Feature - AI-Driven Report Builder

**Date:** February 27, 2026  
**Status:** ✅ Complete (All Phases)  
**Version:** 4.1

---

## Overview

Custom Reports allows users to create personalized data reports through a conversational AI interface. Users interact with an AI agent via a chat window, describe the report they want, and the AI generates a structured report definition that is stored in the database and rendered dynamically.

### Key Design Decision

Reports are stored as **JSON configuration definitions** in a `custom_reports` database table, rendered at runtime by a generic `<ReportRenderer>` component. This approach was chosen over raw JSX file generation for security, safety, and manageability:

- No filesystem writes at runtime
- Users cannot modify any other part of the codebase
- Reports are sandboxed to validated widget types
- Easy to version, edit, and delete

### Rendering Architecture (v2.0)

As of v2.0, the report renderer supports two tiers of components:

1. **ECharts + AG Grid (preferred)** – LLM generates native Apache ECharts option objects and AG Grid column definitions. These are pass-through configs rendered by industry-standard libraries, giving access to 40+ chart types and feature-rich tables without custom code for each feature.

2. **Legacy components (still supported)** – The original `bar-chart`, `line-chart`, `pie-chart`, and `data-table` types continue to work for backward compatibility with existing saved reports.

Security is maintained via an option sanitizer that recursively strips functions, HTML tags, and prototype-pollution keys from ECharts options before rendering.

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

| Type | Description | Required Fields | Status |
|------|-------------|-----------------|--------|
| `kpi-card` | Single metric display | `valueField`, `format` | Active |
| `echarts` | Any ECharts chart (bar, line, pie, scatter, radar, funnel, gauge, heatmap, treemap, etc.) | `option` (ECharts option object) | **Preferred** (v2.0) |
| `ag-grid` | Feature-rich data table (AG Grid Community) | `columnDefs` | **Preferred** (v2.0) |
| `bar-chart` | Bar chart (Chart.js) | `xField`, `yField` | Legacy |
| `line-chart` | Line chart (Chart.js) | `xField`, `yField` | Legacy |
| `pie-chart` | Pie/doughnut chart (Chart.js) | `labelField`, `valueField` | Legacy |
| `data-table` | Basic data table | `columns` | Legacy |

### ECharts Component (v2.0)

The `echarts` type renders any chart supported by Apache ECharts using a pass-through `option` object. Data is injected via the ECharts `dataset` component — the renderer sets `option.dataset.source` to the fetched API data array.

**Key features available without custom code:**
- 40+ chart types (bar, line, pie, scatter, radar, funnel, gauge, heatmap, treemap, sunburst, boxplot, candlestick, graph/network, etc.)
- Rich tooltips, interactive legends, data zoom, toolbox (save as image, data view)
- Animations, responsive resizing, dark mode support
- Multi-series, stacked, and grouped charts
- All configured via the standard ECharts JSON option format

**Example:**
```json
{
  "id": "changes-chart", "type": "echarts", "title": "Changes by Product",
  "gridSpan": 2,
  "dataSource": { "endpoint": "/api/package-changes/by-product", "params": {} },
  "option": {
    "dataset": { "source": [] },
    "tooltip": { "trigger": "axis" },
    "xAxis": { "type": "category" },
    "yAxis": { "type": "value" },
    "series": [{ "type": "bar", "encode": { "x": "product_name", "y": "change_count" } }]
  }
}
```

**Security:** ECharts options are sanitized before rendering — functions, HTML tags, and prototype-pollution keys are recursively stripped. See `frontend/src/utils/echartsSanitizer.js`.

### AG Grid Component (v2.0)

The `ag-grid` type renders a data table using AG Grid Community. Column definitions (`columnDefs`) are passed through to AG Grid, providing sorting, filtering, column resizing, pagination, and quick search out of the box.

**Key features available without custom code:**
- Column sorting, filtering (text/number/date), resizing, reordering
- Pagination with configurable page size
- Quick search (global filter)
- Conditional formatting (row highlighting)
- Row-click linking (cross-component interactivity)
- Dark mode support via custom theme
- Dot-path field resolution for nested data

**Example:**
```json
{
  "id": "entitlements", "type": "ag-grid", "title": "Entitlements",
  "gridSpan": 3,
  "dataSource": { "endpoint": "/api/tenant-entitlements", "params": { "account": "Acme" } },
  "columnDefs": [
    { "field": "productName", "headerName": "Product" },
    { "field": "status", "headerName": "Status" },
    { "field": "daysRemaining", "headerName": "Days Left", "format": "number" }
  ],
  "conditionalFormatting": [
    { "field": "status", "operator": "equals", "value": "Expired", "style": "danger" }
  ]
}
```

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
| `LLM_TEMPERATURE` | No | `0.5` | Temperature for LLM response (lower = more deterministic, higher = richer output) |
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

### New (v2.0 - ECharts + AG Grid)
- `echarts` - Apache ECharts charting library
- `echarts-for-react` - React wrapper for ECharts
- `ag-grid-community` - AG Grid Community data grid
- `ag-grid-react` - React wrapper for AG Grid

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
- `frontend/src/components/reports/widgets/ChartWidget.jsx` - Bar/Line/Pie chart widget (Chart.js, legacy)
- `frontend/src/components/reports/widgets/DataTable.jsx` - Sortable, searchable data table (legacy)
- `frontend/src/components/reports/widgets/EChartsWidget.jsx` - ECharts chart widget (v2.0, preferred)
- `frontend/src/components/reports/widgets/AgGridTable.jsx` - AG Grid data table widget (v2.0, preferred)
- `frontend/src/utils/echartsSanitizer.js` - ECharts option security sanitizer (v2.0)
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

### Version 2.0 – ECharts + AG Grid Integration (February 27, 2026)

**Version:** 2.0

#### Overview

Replaced the custom Chart.js-based charting and hand-built data table with Apache ECharts and AG Grid Community. This shifts the architecture from "custom schema per feature" to "pass-through rendering" — the LLM generates native ECharts option objects and AG Grid column definitions that are rendered directly by industry-standard libraries.

#### Motivation

The previous approach required every chart feature (colors, stacking, tooltips, axis labels, chart types) to be explicitly defined in the Zod schema, implemented in custom widget code, documented in the LLM prompt, and maintained. Adding a new chart type or table feature was a full development cycle. With ECharts and AG Grid, the LLM speaks directly to the rendering engine — any feature either library supports is immediately available without custom code.

#### What Changed

**New components (preferred for new reports):**
- `echarts` – Renders any ECharts chart type. The `option` property is a standard ECharts option object using the `dataset` component for data injection. Supports 40+ chart types including bar, line, pie, scatter, radar, funnel, gauge, heatmap, treemap, sunburst, boxplot, candlestick, and graph/network.
- `ag-grid` – Renders a feature-rich data table using AG Grid Community. The `columnDefs` array defines columns with built-in sorting, filtering, column resizing, and pagination.

**Legacy components (still supported):**
- `bar-chart`, `line-chart`, `pie-chart` (Chart.js) and `data-table` (hand-built) continue to work for backward compatibility with existing saved reports. The LLM is instructed to prefer the new types.

#### Security Mitigations

| Risk | Mitigation |
|------|------------|
| Functions in ECharts options (formatters, callbacks) | Recursive sanitizer strips all function-typed values before rendering |
| HTML injection via string properties | Sanitizer strips all HTML tags from string values |
| Prototype pollution | Sanitizer blocks `__proto__`, `constructor`, `prototype` keys |
| Deep nesting DoS | Sanitizer enforces max depth of 15 levels |
| Wider LLM output space | LLM prompt explicitly forbids functions; structural validation checks for `series` presence |

#### Data Injection Pattern

ECharts components use the **dataset** pattern. The renderer sets `option.dataset.source` to the API response data array. Series use `encode` to map field names:

```json
{
  "dataset": { "source": [] },
  "series": [{ "type": "bar", "encode": { "x": "field_name", "y": "value_field" } }]
}
```

This separates data from presentation — the LLM defines the visualization structure, and the renderer injects live data at runtime.

#### Files Changed

| File | Change |
|------|--------|
| `frontend/package.json` | Added `echarts`, `echarts-for-react`, `ag-grid-community`, `ag-grid-react` |
| `frontend/src/utils/echartsSanitizer.js` | New – recursive option sanitizer (strips functions, HTML, prototype-pollution keys) |
| `frontend/src/components/reports/widgets/EChartsWidget.jsx` | New – ECharts renderer with dataset injection, dark mode, resize handling |
| `frontend/src/components/reports/widgets/AgGridTable.jsx` | New – AG Grid renderer with custom theme, dark mode, conditional formatting, row-click linking |
| `config/report-config-schema.js` | Added `echarts` and `ag-grid` to valid component types; added `echartsSchema` with pass-through option validation and `agGridSchema` with column definition validation |
| `frontend/src/components/reports/ReportRenderer.jsx` | Added import and switch cases for `EChartsWidget` and `AgGridTable` |
| `services/report-llm.service.js` | Rewrote system prompt to prefer ECharts + AG Grid; added dataset pattern examples, chart type guidance, and security rules |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

#### Migration Notes

- Existing saved reports using legacy types (`bar-chart`, `line-chart`, `pie-chart`, `data-table`) continue to render without changes.
- New reports generated by the LLM will use `echarts` and `ag-grid` types by default.
- To convert an existing report, edit it via the chat interface and ask the AI to regenerate it — the new config will use the preferred types.

---

### Version 2.0.1 – Filter-LinkedParam Interop Fix & Typeahead Filters (February 27, 2026)

**Version:** 2.0.1

#### Problem

When the LLM generates a report with a text filter (e.g. account name) and a table that uses `linkedParams` referencing the filter's ID, the table never loads data. The `linkedReady` check only looked for values in `componentParams` (set by row-click `onRowClick` publishers), so a `linkedParam` pointing at a filter ID was never satisfied — the component remained stuck on the placeholder message.

#### Root Cause

The `linkedParams` mechanism was designed exclusively for row-click linking between components. The LLM sometimes conflates filters (global, apply to all components) with `linkedParams` (component-to-component via row clicks), generating configs where a table's `linkedParams` references a filter ID instead of a `paramId` from `onRowClick`.

#### Fixes

**ReportRenderer (`ReportRenderer.jsx`):**
- `linkedReady` now also checks `filterValues` — if a `linkedParam`'s `paramId` matches a filter ID with a non-empty value, it is considered ready
- `fetchKey` computation also resolves `linkedParam` values from `filterValues` when `componentParams` doesn't have the value

**LLM System Prompt (`report-llm.service.js`):**
- Added explicit "Filters vs. Linked Parameters" section explaining that filters apply globally to all components and `linkedParams` is only for row-click values
- Added rule: "Do NOT use `linkedParams` to connect a filter to a component"

#### Typeahead Filter Type

Added a `typeahead` filter type that provides autocomplete suggestions as the user types, fetching matches from a configurable API endpoint. This is particularly useful for account name filters where the user may not know the exact registered name.

**Schema:**
```json
{
  "id": "accountFilter",
  "type": "typeahead",
  "label": "Account Name",
  "mapsToParam": "account",
  "suggestEndpoint": "/api/provisioning/search",
  "suggestParam": "search",
  "suggestResultKey": "accounts",
  "suggestDisplayField": "name"
}
```

**Properties:**
| Property | Description |
|----------|-------------|
| `suggestEndpoint` | API endpoint to call for suggestions |
| `suggestParam` | Query parameter name for the search term (default: `search`) |
| `suggestResultKey` | Key in the response containing the results array (e.g. `accounts`) |
| `suggestDisplayField` | Field on each result to display as the primary label (default: `name`) |
| `suggestSecondaryField` | Optional field shown below the primary label for context (e.g. `account_name`) |

**Features:**
- Debounced input (300ms) with minimum 2 character threshold
- Keyboard navigation (arrow keys, Enter to select, Escape to close)
- Match highlighting in suggestions
- Abort-on-type (cancels previous request when new input arrives)
- Dark mode support
- Click-outside-to-close

#### Files Changed

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added `typeahead` to filter types; added `suggestEndpoint`, `suggestParam`, `suggestResultKey`, `suggestDisplayField` optional properties to filter schema |
| `frontend/src/components/reports/widgets/FilterTypeAhead.jsx` | New – generic typeahead filter component with debounced API suggestions, keyboard navigation, and match highlighting |
| `frontend/src/components/reports/ReportRenderer.jsx` | `linkedReady` and `fetchKey` now check `filterValues` as fallback for `linkedParams` resolution; added import and rendering of `FilterTypeAhead` for `typeahead` filter type |
| `services/report-llm.service.js` | Added "Typeahead Filters" section with available suggestion endpoints and examples; added "Filters vs. Linked Parameters" guidance section |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 2.0.2 – LLM Tuning for Richer Report Output (February 27, 2026)

**Version:** 2.0.2

#### Overview

Tuned the LLM configuration and system prompt to produce more comprehensive, publication-quality dashboard reports on the first iteration. Previously, the LLM tended to generate minimal 2-3 component reports even for broad analytical questions, requiring multiple refinement rounds to reach a useful dashboard.

#### Changes

**Temperature increase (`config/environment.js`):**
- Default `LLM_TEMPERATURE` changed from `0.2` to `0.5`. The previous value was overly conservative, producing safe but minimal outputs. The new value balances creativity with reliability — rich enough to compose multi-perspective dashboards, deterministic enough to produce valid JSON and correct field references.

**System prompt – scope-aware component count (`services/report-llm.service.js`):**
- Rule 4 rewritten from a flat "aim for 3-6 components" to scope-aware guidance:
  - Narrow, specific questions → 2-4 components (focused)
  - Broad, analytical questions → as many components as needed, each contributing new information or a different perspective, stopping when additional components would be redundant
- This prevents the LLM from self-constraining on requests that clearly call for a full dashboard.

**System prompt – comprehensive dashboard blueprint (`services/report-llm.service.js`):**
- Added a new "Building Comprehensive Dashboards" section that teaches the LLM a structured dashboard layout pattern:
  1. KPI row (top) – 2-3 headline metrics
  2. Primary chart (full width) – main trend or comparison visualization
  3. Secondary visuals + detail table – supporting chart paired with a summary table
  4. Deep-dive tables (full width) – AG Grid with sorting, filtering, conditional formatting
  5. Risk/attention section – items needing attention with severity color-coding
- Added layout tips: grid span planning, flex column widths, ECharts color and axis styling, filter inclusion, conditional formatting usage.

**System prompt – balanced clarification approach (`services/report-llm.service.js`):**
- Updated the "Tips" section to encourage clarifying questions for refinement, while not holding back the first report draft — the LLM should produce a comprehensive report and then refine based on feedback.

#### Impact

Reports generated from broad analytical questions (e.g. "show me the product mix and traction across customers") should now include:
- Multiple KPI cards for headline metrics
- Charts with proper colors, legends, tooltips, and axis formatting
- Multiple data perspectives (e.g. by-product, by-account, over-time)
- Detail tables with conditional formatting
- Time frame or date range filters when applicable
- Risk/attention tables when relevant data sources exist

Narrow, focused requests continue to produce appropriately scoped reports.

#### Files Changed

| File | Change |
|------|--------|
| `config/environment.js` | Default `LLM_TEMPERATURE` changed from `0.2` to `0.5` |
| `services/report-llm.service.js` | Rewrote Rule 4 for scope-aware component count; added "Building Comprehensive Dashboards" section with layout blueprint and tips; updated "Tips" to reduce unnecessary clarification questions |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 2.0.3 – Unicode Normalization Fix for Account Lookups (February 27, 2026)

**Version:** 2.0.3

#### Problem

Custom reports using the `/api/tenant-entitlements` endpoint failed to return data for accounts with non-ASCII characters in their names (e.g. "Mapfre Re, Compañía de Reaseguros S.A."). Other accounts without special characters worked correctly.

#### Root Cause

The database query used `ILIKE` for account name matching, which is case-insensitive but **not** Unicode-normalization-aware. Characters like `ñ` (U+00F1, NFC precomposed) and `ñ` (U+006E + U+0303, NFD decomposed) look identical visually but have different byte representations. When the typeahead source (Salesforce Account) and the stored data (`sml_tenant_data.account_name`, mapped from `ps_audit_trail`) used different Unicode normalization forms, the `ILIKE` comparison failed silently, returning zero results.

#### Fixes

**Database query – multi-strategy matching (`database.js`):**
- `getSMLTenantEntitlementsByAccount()` now uses a three-tier matching strategy:
  1. **NFC match** – normalizes input to NFC (precomposed) and tries ILIKE
  2. **NFD fallback** – if NFC didn't match, tries NFD (decomposed) form
  3. **Accent-insensitive fallback** – uses `translate()` to strip common Latin diacritics from both sides and compare base characters
- Logs a warning when no results are found after all strategies

**Data storage normalization (`database.js`):**
- `upsertSMLTenant()` now normalizes `accountName` to NFC before storing, ensuring consistent representation for future data

**Service-layer normalization (`services/tenant-entitlements.service.js`):**
- Input account name is normalized to NFC before querying
- Added warning log when no entitlements are found for a given account

#### Files Changed

| File | Change |
|------|--------|
| `database.js` | `getSMLTenantEntitlementsByAccount()` – three-tier Unicode-aware matching (NFC, NFD, accent-stripped); `upsertSMLTenant()` – NFC normalization on store |
| `services/tenant-entitlements.service.js` | NFC normalization of input; improved logging for no-result cases |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 2.0.4 – Tenant-Name-Based Entitlement Lookup & Suggest Endpoint (February 27, 2026)

**Version:** 2.0.4

#### Problem

The v2.0.3 Unicode normalization fix was insufficient for all cases. The root issue is that entitlement lookups used `account_name` as the key, but `account_name` in `sml_tenant_data` is a secondary mapping from `ps_audit_trail` — it can be NULL (if no PS request exists for the tenant) or stored in a different form than what the Salesforce Account object returns. This cross-system name mismatch affected accounts with non-ASCII characters and any accounts without PS audit trail records.

#### Solution

Added a `tenant` query parameter to `/api/tenant-entitlements` that matches directly on `tenant_name` — a field that comes directly from SML and is always present. Also added a `/api/tenant-entitlements/suggest` endpoint that searches `sml_tenant_data` directly, eliminating the cross-system name mismatch entirely.

#### New Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tenant-entitlements/suggest?search=<term>` | Typeahead suggestions from `sml_tenant_data` |

**Query Parameters:**
- `search` (required) – Search term (min 2 characters)
- `limit` (optional, default 10) – Max results

**Response Shape:**
```json
{
  "success": true,
  "tenants": [
    {
      "tenant_name": "acme-prod",
      "account_name": "Acme Corp",
      "tenant_display_name": "Acme Production",
      "tenant_id": "6000009"
    }
  ],
  "count": 1
}
```

The suggest endpoint searches across `tenant_name`, `account_name`, and `tenant_display_name` using `ILIKE` pattern matching, returning only tenants that have entitlements and are not deleted.

#### Updated Endpoint

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tenant-entitlements?tenant=<name>` | Get entitlements by tenant name (**preferred**) |
| `GET` | `/api/tenant-entitlements?account=<name>` | Get entitlements by account name (legacy) |

The `tenant` parameter matches directly on `sml_tenant_data.tenant_name` via `ILIKE`, which is always populated from SML. The `account` parameter continues to work for backward compatibility.

#### Recommended Report Config

For entitlement reports, use the tenant-entitlements suggest endpoint with `mapsToParam: "tenant"`:

```json
{
  "filters": [
    {
      "id": "tenantFilter",
      "type": "typeahead",
      "label": "Tenant Name",
      "mapsToParam": "tenant",
      "suggestEndpoint": "/api/tenant-entitlements/suggest",
      "suggestParam": "search",
      "suggestResultKey": "tenants",
      "suggestDisplayField": "tenant_name",
      "suggestSecondaryField": "account_name"
    }
  ],
  "components": [
    {
      "dataSource": {
        "endpoint": "/api/tenant-entitlements",
        "params": {}
      }
    }
  ]
}
```

#### Files Changed

| File | Change |
|------|--------|
| `database.js` | Added `getSMLTenantEntitlementsByTenantName()` – ILIKE match on `tenant_name`; added `searchSMLTenantsForSuggest()` – searches tenant_name, account_name, tenant_display_name |
| `services/tenant-entitlements.service.js` | Added `getEntitlementsByTenant()` – lookup by tenant name; added `suggestTenants()` – typeahead search |
| `routes/tenant-entitlements.routes.js` | Added `GET /suggest` route; updated `GET /` to accept `tenant` param (preferred) alongside `account` (legacy) |
| `config/report-data-catalog.js` | Added `tenant-entitlements.suggest` entry; updated `tenant-entitlements.list` to document both `tenant` and `account` params |
| `config/report-config-schema.js` | Added optional `suggestSecondaryField` to filter schema |
| `frontend/src/components/reports/widgets/FilterTypeAhead.jsx` | Added `suggestSecondaryField` prop; secondary line uses configurable field with match highlighting; falls back to legacy hardcoded fields when not set |
| `frontend/src/components/reports/ReportRenderer.jsx` | Passes `suggestSecondaryField` prop to `FilterTypeAhead` |
| `services/report-llm.service.js` | Updated typeahead guidance to prefer `/api/tenant-entitlements/suggest` for entitlement reports; documented `suggestSecondaryField`; updated examples |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

#### Data Flow (Tenant-Based Lookup)

```
User types in typeahead
  → FilterTypeAhead calls /api/tenant-entitlements/suggest?search=<term>
  → Route calls suggestTenants() → searches sml_tenant_data directly
  → User selects a tenant from dropdown
  → Filter value set to tenant_name
  → AG Grid component fetches /api/tenant-entitlements?tenant=<tenant_name>
  → Route calls getEntitlementsByTenant()
  → Database queries sml_tenant_data WHERE tenant_name ILIKE $1
  → Service flattens product_entitlements → returns flat entitlements array
```

---

### Version 1.9 – LLM Config Generation Reliability Fixes (February 27, 2026)

**Version:** 1.9

#### Problem

The LLM report agent frequently generated invalid report configs that failed schema validation, leading to a broken user experience where:

1. **Preview never appeared** -- The LLM sometimes used `` ```json `` instead of `` ```report-config `` as the code fence tag, so the config extraction regex never matched and the preview never updated.
2. **Wrong endpoint paths** -- The LLM confused catalog `id` values (dot-separated, e.g., `package-changes.by-account`) with actual `endpoint` paths (slash-separated, e.g., `/api/analytics/package-changes/by-account`). It also shortened paths (e.g., `/api/package-changes/by-account` instead of `/api/analytics/package-changes/by-account`).
3. **No error recovery** -- When the LLM generated an invalid config, the backend just told the user "it has validation issues" without feeding the errors back to the LLM for correction.

#### Fixes

**Config extraction (`report-llm.service.js`)**:
- `extractReportConfig()` now tries three patterns in order: `` ```report-config ``, `` ```json ``, and bare `` ``` `` blocks
- Each candidate is validated to have `title` and `components` before being accepted as a report config
- `stripConfigBlock()` updated to also strip `` ```json `` blocks that contain report configs

**Auto-retry (`report-agent.routes.js`)**:
- When the LLM's first config attempt fails validation, the backend now automatically sends the validation errors back to the LLM with correction instructions
- The retry message explicitly reminds the LLM to use the `endpoint` path from the catalog and the `` ```report-config `` fence tag
- If the retry also fails, the validation errors are shown to the user with a suggestion to simplify the request

**Prompt improvements (`report-llm.service.js`)**:
- Rule 6 now includes explicit examples of wrong vs. correct endpoint paths
- Added Rule 14: always use `` ```report-config `` fence tag, not `` ```json ``

**Catalog prompt cleanup (`report-data-catalog.js`)**:
- `getCatalogForPrompt()` no longer includes the `id` field in the catalog output sent to the LLM, removing the source of dot-path confusion

#### Files Changed

| File | Change |
|------|--------|
| `services/report-llm.service.js` | Multi-pattern config extraction, updated `stripConfigBlock`, strengthened prompt rules 6 and 14 |
| `routes/report-agent.routes.js` | Auto-retry with validation error feedback (1 retry attempt) |
| `config/report-data-catalog.js` | Removed `id` from `getCatalogForPrompt()` output |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 2.0 – Widget Error Details & Data Source Guidance (February 27, 2026)

**Version:** 2.0

#### Problem

When report widgets failed to load data (e.g., an endpoint returned HTTP 500), the widgets showed only a generic "Failed to load data" message with no information about what went wrong. This made it impossible for users to tell the LLM what to fix, and for developers to diagnose which endpoint failed.

Additionally, the LLM sometimes chose endpoints that require prior data loading (like running a package change analysis first) without warning the user, or picked endpoints that don't provide the data shape needed for the requested visualization (e.g., no time-series endpoint exists for upgrade trends).

#### Fixes

**Widget error details (all widget components)**:
- All widgets (`KpiCard`, `ChartWidget`, `DataTable`, `EChartsWidget`, `AgGridTable`) now accept an `errorDetail` prop
- The `ComponentRenderer` in `ReportRenderer.jsx` builds a descriptive error string from the Axios error via a new `describeError()` helper (shows endpoint, HTTP status, and server error message)
- Error displays now show the detail in a monospaced font below the generic message

**LLM data source guidance (`report-llm.service.js`)**:
- Added "Data Source Reliability & Dependencies" section to the system prompt
- Documents which endpoints are always available vs. which require prior analysis
- Lists available time-series endpoints with their actual fields
- Explicitly states there is no dedicated "upgrade trend over time" endpoint

#### Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/reports/ReportRenderer.jsx` | Added `describeError()` helper; error state now stores `{ raw, detail }` object; passes `errorDetail` to all widgets |
| `frontend/src/components/reports/widgets/KpiCard.jsx` | Accepts and displays `errorDetail` |
| `frontend/src/components/reports/widgets/ChartWidget.jsx` | Accepts and displays `errorDetail` |
| `frontend/src/components/reports/widgets/DataTable.jsx` | Accepts and displays `errorDetail` |
| `frontend/src/components/reports/widgets/EChartsWidget.jsx` | Accepts and displays `errorDetail` |
| `frontend/src/components/reports/widgets/AgGridTable.jsx` | Accepts and displays `errorDetail` |
| `services/report-llm.service.js` | Added data source reliability section to LLM prompt |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 2.1 – LLM Semantic Accuracy & Transparency (February 27, 2026)

**Version:** 2.1

#### Problem

The LLM sometimes produced reports where a component's title implied one metric (e.g., "Upgrade Trend Over Time") but the backing endpoint provided a completely different metric (e.g., validation failure trend). This resulted in misleading dashboards. The LLM also silently substituted unrelated endpoints rather than telling the user that the requested data isn't available.

Additionally, the data catalog had a parameter mismatch for the `validation-trend` endpoint — the catalog listed a `days` parameter but the actual route handler uses `months`.

#### Fixes

**LLM prompt – semantic correctness (Rules 15 & 16)**:
- **Rule 15**: Every component must use an endpoint whose data actually answers the question the component title implies. The LLM must never repurpose an unrelated endpoint to fill a slot.
- **Rule 16**: If part of the user's request cannot be fulfilled because no suitable endpoint exists, the LLM must tell the user explicitly which part is missing and why, and build only what can be correctly supported. An incomplete but accurate report is better than a complete but misleading one.

**LLM prompt – explicit data descriptions**:
- The "Data Source Reliability" section now lists each time-series endpoint with a clear description of what it actually measures and which fields it returns.
- Added a "Gaps" subsection listing data types that do NOT exist in any endpoint (upgrade trends over time, revenue, customer growth).
- Added a closing tip reinforcing that the LLM should explain gaps rather than hide them.

**Data catalog – description clarity & parameter fix**:
- Updated `validation-trend` description to emphasize it measures VALIDATION FAILURES, not product upgrades.
- Fixed `validation-trend` parameter from `days` to `months` to match the actual route handler.
- Updated `request-types-week` and `completion-times` descriptions to explicitly state what they do NOT measure.

#### Files Changed

| File | Change |
|------|--------|
| `services/report-llm.service.js` | Added Rules 15 & 16; rewrote time-series endpoint descriptions with explicit semantics; added "Gaps" list; added transparency tip |
| `config/report-data-catalog.js` | Fixed `validation-trend` param `days` → `months`; clarified descriptions for `validation-trend`, `request-types-week`, `completion-times` |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 3.0 – Canonical Data Schema & OpenAI Function Calling (February 27, 2026)

**Version:** 3.0

#### Problem

The LLM report builder repeatedly generated incorrect report configurations despite multiple rounds of prompt engineering. The root cause: the data catalog was injected as unstructured text into the system prompt, and the LLM treated it as guidance rather than constraints. Additionally, the report data catalog (27 endpoints) and the MCP server tools (42 tools) were independently maintained, causing parameter mismatches, description drift, and incomplete coverage.

#### Architecture Change

**Before:** Two independent systems — a flat JS catalog injected as text into the LLM system prompt, and separate MCP tool files with inline inputSchema definitions. The LLM parsed text to select endpoints and could hallucinate any string as an endpoint path.

**After:** A single canonical data source schema (`config/report-data-sources.js`) that generates:
1. **OpenAI function-calling tool definitions** with enum-constrained endpoints (the LLM cannot reference non-existent endpoints)
2. **MCP tool inputSchema + description** (imported via `getToolSchema()`)
3. **Endpoint allowlist** for Zod validation
4. **Data catalog** for the frontend capabilities endpoint

#### Key Changes

**Canonical data source schema (`config/report-data-sources.js`)**:
- 24 data source entries with correct parameter names matching actual route handlers
- Each entry includes: id, endpoint, category, mcpToolName, description, typed params, responseShape, dependencies, reportEligible flag
- Exports `getToolSchema(id)` for MCP tools to import schema
- Exports `buildOpenAITools()` generating the `generate_report_config` and `describe_available_data` function definitions
- Exports `isEndpointAllowed()` for Zod validation (replaces old catalog's version)

**OpenAI function calling (`services/report-llm.service.js`)**:
- System prompt reduced from ~500 lines to ~100 lines (catalog no longer embedded as text)
- LLM receives two tools: `generate_report_config` (with endpoint enum) and `describe_available_data` (catalog exploration)
- Multi-turn tool call loop: LLM can call `describe_available_data` to explore, then `generate_report_config` to produce the config
- Endpoint paths are enum-constrained — invalid endpoints are structurally impossible

**MCP tool alignment**:
- 21 MCP tool files refactored to import `inputSchema` and `description` from the canonical schema via `getToolSchema()`
- Execute functions updated to use correct parameter names matching route handlers
- Fixed parameter mismatches: `days`→`months` (validation-trend), `includeReviewed`→`isReviewed` (ghost-accounts), `since`→`daysBack` (deprovisioned), `accountName`→`account` (customer-products), `query`→`q` (search endpoints), and more

**Ongoing alignment**:
- Validation script (`scripts/validate-data-alignment.js`) checks canonical→MCP mapping completeness and schema import verification
- Cursor rule (`.cursor/rules/data-source-alignment.mdc`) instructs the AI agent to update all three layers when data sources change

#### Files Created

| File | Purpose |
|------|---------|
| `config/report-data-sources.js` | Canonical data source schema — single source of truth |
| `scripts/validate-data-alignment.js` | CI validation script for canonical↔MCP alignment |
| `.cursor/rules/data-source-alignment.mdc` | Always-apply Cursor rule for ongoing alignment |

#### Files Modified

| File | Change |
|------|--------|
| `services/report-llm.service.js` | Rewritten: function calling instead of text catalog; shorter system prompt |
| `routes/report-agent.routes.js` | Updated to handle function-call configs; imports from canonical schema |
| `config/report-config-schema.js` | Now imports `isEndpointAllowed` from canonical schema |
| `services/custom-report.service.js` | Now imports from canonical schema |
| `routes/custom-reports.routes.js` | Removed `forPrompt` option (no longer needed) |
| `config/report-data-catalog.js` | Superseded by canonical schema (kept for reference) |
| `mcp-server/tools/analytics/*.js` (6 files) | Import schema from canonical source; fixed param names |
| `mcp-server/tools/provisioning/*.js` (4 files) | Import schema from canonical source; fixed param names |
| `mcp-server/tools/expiration/*.js` (3 files) | Import schema from canonical source; fixed param names |
| `mcp-server/tools/accounts/*.js` (2 files) | Import schema from canonical source; fixed param names |
| `mcp-server/tools/customer-products/*.js` (2 files) | Import schema from canonical source; fixed param names |
| `mcp-server/tools/packages/*.js` (2 files) | Import schema from canonical source |
| `mcp-server/tools/audit-trail/*.js` (2 files) | Import schema from canonical source; fixed param names |

---

### Version 4.0 – Origin-Based Data Source Reorganization (February 27, 2026)

**Version:** 4.0

#### Problem

The canonical data catalog (`config/report-data-sources.js`) was organized by **app feature/page**: Analytics, Package Changes, Provisioning, Expiration, Ghost Accounts, etc. These categories were essentially pre-built reports — compilations of data from multiple sources. This created:

- **Overlap**: Multiple endpoints queried the same Salesforce object (`Prof_Services_Request__c`) but were categorized separately (e.g., "Analytics" and "Provisioning" both come from the same source)
- **Hidden lineage**: The LLM couldn't see that `validation-trend` and `request-types-week` both derive from the same primary data source
- **Fragile extensibility**: Adding a new data source (e.g., a new external API) had no clear place in the category structure

#### Architecture Change

**Before (v3.0):** Page-oriented categories — `Analytics`, `Package Changes`, `Provisioning`, `Expiration`, `Ghost Accounts`, `Customer Products`, `Tenant Entitlements`, `Packages`, `Audit Trail`.

**After (v4.0):** Origin-based categories organized into three tiers:

```
┌─────────────────────────────────────────────────────────┐
│  PRIMARY SOURCES                                         │
│  (Direct from external systems)                          │
├─────────────────────────────────────────────────────────┤
│  Primary: Salesforce      5 endpoints                    │
│  Primary: SML             2 endpoints                    │
│  Primary: Packages        2 endpoints                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  DERIVED DATA                                            │
│  (Computed from primary sources, cached locally)         │
├─────────────────────────────────────────────────────────┤
│  Derived: Provisioning Analytics   3 endpoints           │
│  Derived: Package Changes          4 endpoints           │
│  Derived: Expiration               3 endpoints           │
│  Derived: Ghost Accounts           2 endpoints           │
│  Derived: Current Accounts         1 endpoint            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  PRESERVED DATA                                          │
│  (Captured because ephemeral in source)                  │
├─────────────────────────────────────────────────────────┤
│  Preserved: Audit Trail            2 endpoints           │
│  Preserved: Product Updates        1 endpoint            │
└─────────────────────────────────────────────────────────┘
```

#### New Schema Fields

Every entry in `DATA_SOURCES` now includes:

| Field | Type | Purpose |
|-------|------|---------|
| `sourceType` | `'primary' \| 'derived' \| 'preserved'` | Data origin tier |
| `sourceRef` | `string` | Which primary system the data comes from (e.g., `'salesforce'`, `'sml'`, `'salesforce.provisioning'`) |
| `primarySource` | `string` | Specific source object/table (e.g., `'Prof_Services_Request__c'`, `'ps_audit_trail table'`) |

Example entry:

```javascript
{
    id: 'derived.package-changes.summary',
    endpoint: '/api/analytics/package-changes/summary',
    category: 'Derived: Package Changes',
    sourceType: 'derived',
    sourceRef: 'salesforce.provisioning',
    primarySource: 'Prof_Services_Request__c (Payload_Data__c → package_change_analysis)',
    // ...existing fields...
}
```

#### Canonical ID Naming Convention (Option A — Flat with Prefix)

IDs now follow the pattern `<sourceType>.<sourceGroup>.<name>`:

| Old ID | New ID |
|--------|--------|
| `analytics.request-types-week` | `derived.provisioning-analytics.request-types` |
| `analytics.validation-trend` | `derived.provisioning-analytics.validation-trend` |
| `analytics.completion-times` | `derived.provisioning-analytics.completion-times` |
| `package-changes.summary` | `derived.package-changes.summary` |
| `package-changes.by-product` | `derived.package-changes.by-product` |
| `package-changes.by-account` | `derived.package-changes.by-account` |
| `package-changes.recent` | `derived.package-changes.recent` |
| `provisioning.list` | `primary.salesforce.provisioning-list` |
| `provisioning.search` | `primary.salesforce.provisioning-search` |
| `provisioning.validation-errors` | `primary.salesforce.validation-errors` |
| `provisioning.removals` | `primary.salesforce.provisioning-removals` |
| `customer-products.list` | `primary.salesforce.customer-products` |
| `tenant-entitlements.list` | `primary.sml.entitlements` |
| `tenant-entitlements.suggest` | `primary.sml.entitlements-suggest` |
| `packages.list` | `primary.packages.list` |
| `packages.stats` | `primary.packages.stats` |
| `expiration.monitor` | `derived.expiration.monitor` |
| `expiration.status` | `derived.expiration.status` |
| `expiration.expired-products` | `derived.expiration.expired-products` |
| `ghost-accounts.list` | `derived.ghost-accounts.list` |
| `ghost-accounts.deprovisioned` | `derived.ghost-accounts.deprovisioned` |
| `audit-trail.stats` | `preserved.audit-trail.stats` |
| `audit-trail.search` | `preserved.audit-trail.search` |
| `customer-products.update-requests` | `preserved.product-updates.list` |

A `LEGACY_ID_MAP` in the schema provides backward compatibility — `getToolSchema()` and `getById()` accept both old and new IDs.

#### New Data Source Added

`GET /api/current-accounts` — enriched tenant account data combining SML tenant info with Salesforce provisioning records. Added as `derived.current-accounts.list` (sourceRef: `sml+salesforce`).

#### OpenAI Tool Updates

- `describe_available_data` now accepts an optional `sourceType` parameter (`"primary"`, `"derived"`, `"preserved"`) in addition to `category`
- Endpoint descriptions in `generate_report_config` now include source lineage tags (e.g., `[PRIMARY: salesforce]`, `[DERIVED from salesforce.provisioning]`)
- `handleDescribeData()` returns `sourceType`, `sourceRef`, and `primarySource` fields in its response

#### What This Enables

- **For the LLM**: It can see that 12 endpoints are derived from Salesforce PS records, and understand that if the user asks about "upgrades," the relevant data comes from the package-changes derivation, not the validation-trend derivation
- **For new sources**: Adding a new primary source (e.g., a CRM API) means adding a new category under "Primary," and any derived analytics from it go under "Derived"
- **For debugging**: If a "derived" endpoint returns no data, the user/LLM knows to check whether the primary source has been synced/analyzed

#### Files Modified

| File | Change |
|------|--------|
| `config/report-data-sources.js` | Full restructure: origin-based categories, new `sourceType`/`sourceRef`/`primarySource` fields, new IDs with `LEGACY_ID_MAP`, new `getBySourceType()`/`getBySourceRef()` helpers, updated OpenAI tool definitions with source lineage |
| `mcp-server/tools/analytics/*.js` (6 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/provisioning/*.js` (4 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/expiration/*.js` (3 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/accounts/*.js` (2 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/customer-products/*.js` (2 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/packages/*.js` (2 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `mcp-server/tools/audit-trail/*.js` (2 files) | Updated `getToolSchema()` calls to new canonical IDs |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |
| `docs/technical/Technical Documentation/11-MCP-Integration/MCP-Server-Implementation.md` | Updated canonical alignment section |

---

### Version 4.1 – Data-Aware Report Building (February 27, 2026)

**Version:** 4.1

#### Problem

The LLM operates in "blind design" mode — it knows endpoint schemas from the canonical catalog but never sees actual data. This causes:

- Wrong endpoint choices (e.g., using validation-trend data to represent upgrade trends)
- Incorrect record counts (showing 9 accounts when there are 47 with a wider parameter window)
- Inability to verify that data exists before building a widget
- No way to explain data gaps or staleness to the user

The LLM generates static JSON configurations; it cannot query, filter, or aggregate data at design time.

#### Solution

Added a third OpenAI function-calling tool — `fetch_endpoint_data` — that gives the LLM live data access during the conversation. The LLM can now query actual API endpoints, inspect real records, and make data-informed decisions before generating report configurations.

**Flow:**
1. User requests a report
2. LLM calls `describe_available_data` to understand available endpoints
3. LLM calls `fetch_endpoint_data` to query live data from candidate endpoints
4. LLM receives a summarized preview (record count, sample records, field types, summary stats)
5. LLM uses the real data to build an accurate report configuration via `generate_report_config`
6. LLM reports actual findings to the user (e.g., "Found 47 accounts with products expiring within 90 days")

**Data summarization:** Raw API responses are summarized to stay within token limits (~2000 tokens per fetch):
- `totalRecords` — actual count from the data array
- `sampleRecords` — first 5 records for field inspection
- `summary` — summary/stats object if the endpoint provides one
- `fieldTypes` — inferred types for each field (including nested object fields)
- `responseKeys` — top-level keys in the response

**Authentication:** The data fetcher uses the same user credentials (cookies/Authorization header) that the chat request arrives with, maintaining the existing security boundaries. Calls go to `http://localhost:{PORT}` — the same Express server.

**Endpoint restriction:** Only endpoints in `DATA_SOURCES` with `reportEligible: true` can be queried. The endpoint parameter uses the same enum constraint as `generate_report_config`.

#### Changes

**Tool definition (`config/report-data-sources.js`)**:
- Added `fetch_endpoint_data` tool to `buildOpenAITools()` with enum-constrained endpoint and optional params
- Added `summarizeEndpointData(rawResponse, endpoint)` helper that extracts totalRecords, sample, summary, and field types from raw API responses

**LLM service (`services/report-llm.service.js`)**:
- Accepts `options.dataFetcher` callback in `chat()`
- Handles `fetch_endpoint_data` tool calls: validates endpoint, calls dataFetcher, summarizes response
- Increased `MAX_TOOL_ITERATIONS` from 3 to 5 (LLM may need: describe → fetch → fetch → generate → follow-up)
- Updated system prompt with data exploration guidance: "Always fetch data from at least the primary endpoint you plan to use BEFORE calling generate_report_config"

**Route handler (`routes/report-agent.routes.js`)**:
- Added `buildDataFetcher(req)` that creates an axios-based callback forwarding the user's auth credentials
- Passes `dataFetcher` to `reportLlm.chat()` for both initial and retry calls

#### Files Changed

| File | Change |
|------|--------|
| `config/report-data-sources.js` | Added `fetch_endpoint_data` tool definition and `summarizeEndpointData` helper |
| `services/report-llm.service.js` | Handle `fetch_endpoint_data` tool calls; accept `dataFetcher`; `MAX_TOOL_ITERATIONS` 3→5; updated system prompt |
| `routes/report-agent.routes.js` | Added `buildDataFetcher(req)` and `axios` import; pass `dataFetcher` to chat calls |
| `package.json` | Added `axios` dependency |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2 – Nested & Multi-Field Column Support (February 27, 2026)

**Version:** 4.2

#### Problem

When API data contains values spread across multiple nested paths — for example, expiring product codes stored under `expiringProducts.models`, `expiringProducts.data`, and `expiringProducts.apps` — the table widgets (AG Grid and data-table) could not display them in a single column. The LLM could *see* these nested values via `fetch_endpoint_data`, but had no way to configure a column that merges and displays them.

Additionally, when a simple dot-path field resolved to an array (e.g., `expiringProducts.apps` returning `["RI-EXPOSUREIQ"]`), the renderer displayed the raw array object instead of a readable string. More critically, when the arrays contain **objects** (e.g., `{ productCode: "RI-EXPOSUREIQ", productName: "Exposure IQ", ... }`), the renderer displayed `[object Object]` since it had no mechanism to extract a display-friendly property from each object.

#### Solution

Added `valueFields`, `separator`, and `displayField` options to column definitions for both AG Grid and data-table components. This allows the LLM to configure columns that:

1. **Merge multiple dot-paths** — resolve each path, flatten any arrays, and join all values into a single display string
2. **Extract from nested objects** — when arrays contain objects, use `displayField` to specify which property to display (e.g., `"productCode"`). If `displayField` is omitted, the renderer auto-detects by trying `name`, `code`, `productCode`, `label`, `id` in that order.
3. **Auto-join arrays** — when a single `field` resolves to an array, automatically join with `", "` instead of displaying the raw array

**Configuration example (arrays of objects):**
```json
{
  "headerName": "Product Codes",
  "valueFields": [
    "expiringProducts.models",
    "expiringProducts.data",
    "expiringProducts.apps"
  ],
  "displayField": "productCode",
  "separator": ", ",
  "flex": 2
}
```

**LLM guidance:** The system prompt includes a "Nested & Multi-Field Columns" section instructing the LLM to use `valueFields` with `displayField` when it observes arrays of objects in `fetch_endpoint_data` results.

#### Changes

**Zod schema (`config/report-config-schema.js`)**:
- Added `valueFields` (array of dot-path strings, max 10), `separator` (string, max 10 chars), and `displayField` (string, max 100 chars) to both `agGridColumnDefSchema` and `columnSchema`
- Updated column refinement to accept `valueFields` as an alternative to `field`

**AG Grid renderer (`frontend/src/components/reports/widgets/AgGridTable.jsx`)**:
- `valueFields` columns use a custom `valueGetter` that resolves all paths, flattens arrays of objects (using `displayField` or auto-detection), and joins with separator
- Single dot-path fields that resolve to arrays are auto-joined with `", "`

**Data-table renderer (`frontend/src/components/reports/widgets/DataTable.jsx`)**:
- Added `extractDisplayValue()` helper for extracting display values from objects
- Added `resolveColumnValue()` helper supporting `valueFields`, `displayField`, and array auto-join
- Updated search, sort, and cell rendering to use `resolveColumnValue()`

**OpenAI tool schema (`config/report-data-sources.js`)**:
- Added `valueFields`, `separator`, and `displayField` properties to AG Grid and data-table column definitions in `generate_report_config` tool

**LLM system prompt (`services/report-llm.service.js`)**:
- Added "Nested & Multi-Field Columns (valueFields)" section with `displayField` guidance and example

#### Files Changed

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added `valueFields`/`separator`/`displayField` to AG Grid and data-table column Zod schemas |
| `frontend/src/components/reports/widgets/AgGridTable.jsx` | Handle `valueFields` with object extraction in `columnDefs`; auto-join array field values |
| `frontend/src/components/reports/widgets/DataTable.jsx` | Added `extractDisplayValue()` and `resolveColumnValue()`; updated search, sort, cell rendering |
| `config/report-data-sources.js` | Added `valueFields`/`separator`/`displayField` to OpenAI tool column schemas |
| `services/report-llm.service.js` | Added valueFields + displayField guidance to system prompt |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2.1 – Tenant Summary Endpoint (February 27, 2026)

**Version:** 4.2.1

#### Problem

The LLM could not answer overview questions about SML tenants (e.g., "How many tenants are there?") because:

- `/api/tenant-entitlements` requires a `tenant` or `account` parameter — throws `BadRequestError` without one
- `/api/tenant-entitlements/suggest` requires at least 2 characters of search input — returns empty otherwise

There was no endpoint that provided aggregate tenant data without a specific lookup key.

#### Solution

Added a new `/api/tenant-entitlements/summary` endpoint that returns all active tenants with counts and metadata, requiring no parameters.

**Response shape:**
```json
{
  "success": true,
  "tenants": [
    { "tenantName": "...", "accountName": "...", "displayName": "...", "tenantId": "...", "lastSynced": "..." }
  ],
  "summary": {
    "totalTenants": 150,
    "uniqueAccounts": 120,
    "lastSynced": "2026-02-27T10:00:00.000Z"
  }
}
```

Also updated the description of `/api/tenant-entitlements` in the canonical data sources to explicitly state it requires a parameter and to direct the LLM to use `/api/tenant-entitlements/summary` for overview queries.

#### Files Changed

| File | Change |
|------|--------|
| `services/tenant-entitlements.service.js` | Added `getTenantsSummary()` method |
| `routes/tenant-entitlements.routes.js` | Added `GET /summary` route |
| `config/report-data-sources.js` | Registered `primary.sml.tenant-summary` (26th source); clarified `/api/tenant-entitlements` description |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2.2 – Tenant Entitlement Analysis Endpoint (February 27, 2026)

**Version:** 4.2.2

#### Problem

The LLM could not perform cross-tenant analysis (e.g., "find tenants where all products are expired") because:

- `/api/tenant-entitlements` is a single-tenant lookup (requires `tenant` or `account` parameter)
- `/api/tenant-entitlements/summary` provides a tenant list but no entitlement status data
- With 500+ tenants and a 5-iteration tool limit, the LLM cannot query tenants individually
- No endpoint existed that computed per-tenant entitlement status breakdowns

#### Solution

Added a new `/api/tenant-entitlements/analysis` endpoint that processes all tenants' `product_entitlements` JSONB in bulk, computing active/expiring/expired counts per tenant. Supports a `status` filter parameter for pre-filtered results.

**Response shape:**
```json
{
  "success": true,
  "tenants": [
    {
      "tenantName": "Example Corp",
      "accountName": "Example Corp",
      "tenantId": "t-12345",
      "totalEntitlements": 8,
      "activeCount": 0,
      "expiringCount": 0,
      "expiredCount": 8,
      "allExpired": true,
      "lastSynced": "2026-02-27T10:00:00.000Z"
    }
  ],
  "summary": {
    "totalTenantsAnalyzed": 504,
    "tenantsWithAllExpired": 5,
    "tenantsWithSomeExpiring": 20,
    "tenantsFullyActive": 479,
    "tenantsReturned": 5
  }
}
```

**Filter values:** `?status=allExpired` | `hasExpiring` | `fullyActive` | (omit for all)

#### Files Changed

| File | Change |
|------|--------|
| `database.js` | Added `getAllSMLTenantEntitlements()` — bulk query returning all tenants with `product_entitlements` |
| `services/tenant-entitlements.service.js` | Added `getTenantsEntitlementAnalysis(filters)` — per-tenant status breakdown using existing `_flattenCategory` / `_calculateStatus` |
| `routes/tenant-entitlements.routes.js` | Added `GET /analysis` route with `status` filter parameter |
| `config/report-data-sources.js` | Registered `primary.sml.entitlement-analysis` (27th source) |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2.3 – Filter Parameter Propagation Fixes (February 27, 2026)

**Version:** 4.2.3

#### Problem

The LLM explored data with specific filter parameters (e.g., `status=allExpired`) via `fetch_endpoint_data` but then generated report configs with empty `params: {}`, causing:

1. **Unfiltered tables** — A table titled "Tenants with All Products Expired" showed ALL 504 tenants because `status=allExpired` was not passed in the report config's `dataSource.params`
2. **Empty detail tables** — A linked table showing entitlements for an expired tenant appeared empty because `/api/tenant-entitlements` filters out expired entitlements by default (`includeExpired` defaults to `false`)
3. **Mixed data sources** — The LLM combined data from `/api/expiration/expired-products` (Salesforce PS records) and `/api/tenant-entitlements/analysis` (SML data), which measure different things

#### Solution

Added stronger LLM guidance and improved data source descriptions:

**System prompt rules added:**
- **PARAMS MUST MATCH** — When the LLM explored data with specific parameters during `fetch_endpoint_data`, those same parameters must appear in the report config's `dataSource.params`
- **INCLUDE EXPIRED DATA** — When building reports about expired products/tenants, pass `includeExpired=true` to endpoints that filter out expired records by default
- **linkedParams guidance** — Detail table params must include required defaults (e.g., `includeExpired=true`)

**Endpoint descriptions updated:**
- `/api/tenant-entitlements` — Added warning that expired entitlements are excluded by default and `includeExpired=true` is required for expiration-related reports
- `/api/tenant-entitlements/analysis` — Emphasized that `status` filter is required for filtered views and must be passed in report config params

#### Files Changed

| File | Change |
|------|--------|
| `services/report-llm.service.js` | Added PARAMS MUST MATCH and INCLUDE EXPIRED DATA rules to system prompt; added linkedParams includeExpired guidance |
| `config/report-data-sources.js` | Updated descriptions for `/api/tenant-entitlements` and `/api/tenant-entitlements/analysis` with filter emphasis |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2.4 – Include Expired Entitlements by Default (February 27, 2026)

**Version:** 4.2.4

#### Problem

The `/api/tenant-entitlements` endpoint defaulted `includeExpired` to `false`, filtering out expired entitlements. When used in a master-detail report pattern (e.g., clicking an expired tenant to see its entitlements), the detail table showed no data because all entitlements were expired and thus excluded.

#### Solution

Changed the default of `includeExpired` from `false` to `true`. The endpoint now returns all entitlements (including expired) by default. Callers can pass `includeExpired=false` to explicitly exclude expired records.

**Rationale:** When looking up entitlements for a specific tenant/account, the complete picture is almost always desired. The `status` field in each entitlement row allows users to filter visually via AG Grid's built-in column filters.

#### Files Changed

| File | Change |
|------|--------|
| `routes/tenant-entitlements.routes.js` | Changed `includeExpired` default from `false` to `true` |
| `config/report-data-sources.js` | Updated `includeExpired` param description to reflect new default |
| `services/report-llm.service.js` | Updated system prompt rules for expired data defaults |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### Version 4.2.5 – Product Breakdown Endpoint (March 3, 2026)

**Version:** 4.2.5

#### Problem

The LLM could not create pie charts or bar charts showing product distribution across tenants because no endpoint provided product-level aggregation. The LLM attempted to call `/api/tenant-entitlements` without parameters (to get bulk data), hitting a `BadRequestError`, and then generated an incomplete ECharts config that failed Zod validation (`option: Required`).

The existing endpoints provide:
- `/api/tenant-entitlements/analysis` — per-tenant counts (not per-product)
- `/api/tenant-entitlements` — single-tenant lookup only
- Neither can answer "how many tenants have RiskModeler?"

#### Solution

Added `/api/tenant-entitlements/product-breakdown` — a product-level aggregation endpoint that processes all tenants and returns unique products with their total counts and tenant counts. Supports filtering by tenant status (`tenantStatus=allExpired`) and product status (`productStatus=Expired`).

**Response shape:**
```json
{
  "products": [
    { "productCode": "RI-RISKMODELER", "productName": "RiskModeler", "category": "apps", "count": 45, "tenantCount": 38 },
    { "productCode": "RI-EXPOSUREIQ", "productName": "ExposureIQ", "category": "apps", "count": 23, "tenantCount": 20 }
  ],
  "summary": { "totalProducts": 15, "totalEntitlements": 180, "tenantsProcessed": 91 }
}
```

This is directly usable for pie charts (`productName` as label, `count` as value) and bar charts.

#### Files Changed

| File | Change |
|------|--------|
| `services/tenant-entitlements.service.js` | Added `getProductBreakdown(filters)` — aggregates entitlements by product across tenants |
| `routes/tenant-entitlements.routes.js` | Added `GET /product-breakdown` route with `tenantStatus` and `productStatus` filters |
| `config/report-data-sources.js` | Registered `primary.sml.product-breakdown` (28th source) |
| `docs/technical/Custom-Reports-Feature.md` | This documentation update |

---

### v4.3 — Report Builder Reliability Enhancements

This release addresses the three most common failure modes in the LLM report builder: unreliable array extraction, missing parameter validation, lack of concrete examples, and weak error recovery.

#### 1. Canonical `arrayKey` — Eliminates `extractArray` Guessing

**Problem:** The frontend used a hardcoded list of ~17 array keys to guess where the data array lives in API responses. Keys like `tenants` and `products` were missing, causing silent data failures where the table would render with zero rows despite the API returning data.

**Solution:** Added an optional `arrayKey` field to the `dataSource` schema. When present, the renderer uses it directly instead of guessing. A server-side post-validation step (`injectArrayKeys`) auto-populates `arrayKey` from the canonical data source definitions even if the LLM omits it. The `tenants` key was also added to the fallback list as a safety net.

**Files changed:**

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added `arrayKey` field to `dataSourceSchema` |
| `config/report-data-sources.js` | Added `arrayKey` to `generate_report_config` OpenAI tool schema |
| `frontend/src/components/reports/ReportRenderer.jsx` | `extractArray()` now accepts an `arrayKey` parameter; added `tenants` to fallback list |
| `routes/report-agent.routes.js` | Added `injectArrayKeys()` helper; applied to all validation success paths |

#### 2. Validated Example Configs in System Prompt

**Problem:** The LLM had rules and field references but no concrete examples of correct configs. It repeatedly made the same structural mistakes — missing `series` in ECharts, empty params for filtered endpoints, wrong encode patterns.

**Solution:** Added a "Validated Config Examples" section to `buildSystemPrompt()` covering the four most error-prone patterns: ECharts pie chart, ECharts bar chart, AG Grid master-detail with linkedParams, and KPI card with dot-path. Each example is minimal (~5-8 lines of JSON, ~400 additional tokens total).

**Files changed:**

| File | Change |
|------|--------|
| `services/report-llm.service.js` | Added validated example config snippets to `buildSystemPrompt()` |

#### 3. Required Parameter Validation at Zod Level

**Problem:** The LLM generated configs with `params: {}` for endpoints that require specific parameters (e.g., `/api/tenant-entitlements` without `tenant` or `account`). Zod validated the structure but not the semantic correctness, so these errors only appeared at render time when the API returned an error.

**Solution:** Added a `validateEndpointParams()` helper in `report-data-sources.js` that checks required params and `requireOneOf` groups against the canonical data source definitions. Params covered by `linkedParams` (filled at render time via row clicks) are correctly excluded from the check. The helper is wired into the Zod schema via `.superRefine()` on `dataSourceSchema`, catching these errors at validation time so the LLM gets a clear error message to fix.

**Files changed:**

| File | Change |
|------|--------|
| `config/report-data-sources.js` | Added `requireOneOf` field to tenant-entitlements source; added `validateEndpointParams()` helper; exported it |
| `config/report-config-schema.js` | Added `.superRefine()` on `dataSourceSchema` calling `validateEndpointParams()` |

#### 4. Improved Auto-Retry Mechanism

**Problem:** When validation failed, the retry got a terse error message like `components.2.option: Required` with no context about what correct values look like. A single retry with poor context often failed again.

**Solution:** Enhanced the retry loop in `report-agent.routes.js`:
- **2 retries** instead of 1 — gives the LLM a second chance if the first fix is also wrong.
- **Failed config included** — the retry message now contains the full JSON of the failed config so the LLM can see exactly what it generated.
- **Error-path-based hints** — a `buildValidationHints()` helper maps common error paths (option/series, params, endpoint, columns) to actionable fix suggestions.

**Files changed:**

| File | Change |
|------|--------|
| `routes/report-agent.routes.js` | Replaced single-retry block with a 2-retry loop; added `buildValidationHints()` helper; retry messages now include failed config JSON and hints |

#### Expected Impact

These five changes address the three most common failure modes:
- **Silent empty data** (fixes 1 + auto-inject) — `arrayKey` eliminates guessing
- **Wrong/missing params** (fix 3) — caught at validation, not at render time
- **Structural mistakes** (fixes 2 + 4) — examples prevent mistakes; better retry recovers from them

---

### v4.4 — Navigation Restructure: Reports as Sub-Pages

#### Problem

Saved custom reports were displayed as cards on a dedicated "View Reports" sub-page (`/custom-reports`). Users had to navigate to this page, scan the card grid, and click a card to view a report. This added an unnecessary intermediate step and hid reports behind a single nav link.

#### Solution

Removed the "View Reports" list page and instead display each saved report as its own navigation link directly under the "Custom Reports" category in the sidebar.

**Before:**
- Custom Reports > Create Report
- Custom Reports > View Reports (card grid) > click card > report view

**After:**
- Custom Reports > Create Report
- Custom Reports > Report A (direct link)
- Custom Reports > Report B (direct link)
- ...

#### Implementation

The sidebar dynamically fetches the list of saved reports via `listReports()` from `customReportService` and renders each as a submenu link under "Custom Reports". The report list is refreshed whenever the user navigates within the `/custom-reports` path prefix (catching creates and deletes).

#### Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/layout/Sidebar.jsx` | Added dynamic report fetching; replaced static "View Reports" submenu item with per-report links |
| `frontend/src/App.jsx` | Removed `/custom-reports` list route and `CustomReportsList` import |
| `frontend/src/pages/CustomReportsList.jsx` | Deleted (no longer needed) |
| `frontend/src/pages/CustomReportView.jsx` | Updated back-navigation and post-delete redirect to `/custom-reports/create` |

---

### v4.5 — Server-Side Data Enrichment Proxy

#### Problem

Each report component fetches data from exactly one API endpoint. There is no mechanism to combine data across sources. For example, `/api/expiration/monitor` returns `account.name` but not `tenantName` — that field lives in `sml_tenant_data` (accessible via `/api/current-accounts`). Users cannot build a table showing both expiration data and tenant names without manual correlation.

#### Solution

Added a server-side **data proxy endpoint** that the frontend uses when a component's `dataSource` includes an `enrich` directive. The proxy fetches the primary data, performs lookups against a second endpoint using a shared key, and returns merged results.

**Data flow:**

```
ReportRenderer → POST /api/report-data/fetch → server fetches primary + enrichment → joined response
```

#### `enrich` Configuration

The `enrich` object is optional within `dataSource` and has the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `endpoint` | string | Second endpoint to fetch enrichment data from (must be in the data catalog) |
| `params` | object? | Query parameters for the enrichment endpoint (e.g., `{ "pageSize": 1000 }` for paginated endpoints) |
| `arrayKey` | string? | Key in the enrichment response containing the data array (auto-injected if omitted) |
| `sourceField` | string | Dot-path field in the PRIMARY data row used as the join key (e.g., `"account.name"`) |
| `matchField` | string | Field in the ENRICHMENT data to match against `sourceField` (e.g., `"client"`) |
| `fields` | string[] | Fields to copy from the matched enrichment row onto each primary row |

**Important:** For paginated enrichment endpoints like `/api/current-accounts` (default 50 rows), always pass `params` with a large `pageSize` to ensure all rows are available for matching.

#### Example: Expiration Monitor with Tenant Names

```json
{
  "type": "ag-grid",
  "title": "Expiring Products with Tenant Info",
  "gridSpan": 3,
  "dataSource": {
    "endpoint": "/api/expiration/monitor",
    "params": {},
    "arrayKey": "expirations",
    "enrich": {
      "endpoint": "/api/current-accounts",
      "params": { "pageSize": 1000 },
      "arrayKey": "accounts",
      "sourceField": "account.name",
      "matchField": "client",
      "fields": ["tenant_name", "tenant_id"]
    }
  },
  "columnDefs": [
    { "field": "account.name", "headerName": "Account" },
    { "field": "tenant_name", "headerName": "Tenant Name" },
    { "field": "earliestExpiry", "headerName": "Expiry Date", "format": "date" },
    { "field": "earliestDaysUntilExpiry", "headerName": "Days Left", "format": "number" }
  ]
}
```

The proxy fetches both endpoints, matches each expiration row's `account.name` against `current_accounts.client`, and copies `tenant_name` and `tenant_id` onto each row before returning to the frontend.

#### Implementation Details

- **Security:** Only allowlisted endpoints (from the data catalog) can be queried. Authentication is forwarded from the user's request.
- **Join strategy:** Case-insensitive exact match using a `Map` lookup. First match wins; unmatched rows keep their original fields only.
- **Auto-inject:** `injectArrayKeys()` in `report-agent.routes.js` also populates `enrich.arrayKey` from the canonical data source when omitted by the LLM.
- **LLM guidance:** The system prompt includes a dedicated section with the enrichment pattern and a concrete example.

#### Files Changed

| File | Change |
|------|--------|
| `config/report-config-schema.js` | Added optional `enrich` object to `dataSourceSchema` with Zod validation |
| `config/report-data-sources.js` | Added `enrich` property to `generate_report_config` OpenAI tool schema |
| `routes/report-data.routes.js` | **New file** — `POST /api/report-data/fetch` proxy endpoint with enrichment logic |
| `app.js` | Registered `reportDataRoutes` at `/api/report-data` |
| `frontend/src/components/reports/ReportRenderer.jsx` | Updated `ComponentRenderer` to POST to proxy when `enrich` is present |
| `services/report-llm.service.js` | Added "Cross-Source Data Enrichment" section to `buildSystemPrompt()` |
| `routes/report-agent.routes.js` | Extended `injectArrayKeys()` to also handle `enrich.arrayKey` |

---

### v4.5.1 — Data Catalog Browser

#### Problem

Users building reports through the LLM chat had no visibility into what data sources were available, what endpoints existed, or what fields each endpoint returned. This made it difficult to formulate effective report requests, leading to trial-and-error conversations with the LLM.

#### Solution

Added a "Data Catalog" button to the Report Builder's chat header that opens a modal displaying the full data catalog in a readable, searchable format. The catalog is organized by source category (Primary, Derived, Preserved), with expandable endpoint cards showing descriptions, parameters, and response fields.

#### Features

- **Grouped by category** — endpoints organized under Primary (Salesforce, SML, Packages), Derived (Analytics, Package Changes, Expiration, etc.), and Preserved (Audit Trail, Product Updates)
- **Color-coded badges** — source type is visually distinguished (blue for Primary, amber for Derived, purple for Preserved)
- **Full-text search** — filter across endpoint paths, descriptions, field names, and parameter names
- **Expandable endpoint cards** — click to reveal full description, parameters with types and optionality, response fields, and array key
- **Endpoint count** — header shows total number of available endpoints

#### Files Changed

| File | Change |
|------|--------|
| `routes/report-data.routes.js` | Added `GET /api/report-data/catalog` endpoint returning grouped data catalog |
| `frontend/src/components/reports/DataCatalogModal.jsx` | **New file** — modal component with search, category grouping, and expandable endpoint cards |
| `frontend/src/pages/CreateReport.jsx` | Added "Data Catalog" button in chat header; imported and rendered `DataCatalogModal` |

---

**Last Updated:** February 27, 2026
