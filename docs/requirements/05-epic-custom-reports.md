# EPIC-05: Custom Reports

## Epic Description

Build the complete Custom Reports feature — an AI-powered report creation system that allows users to describe reports in natural language, have an LLM generate report configurations, preview and refine them interactively, and save them for ongoing use. This includes the AI chat interface, the report renderer engine, all widget types, the data catalog, report CRUD operations, JSON import/export, and sidebar integration for saved reports.

**Business Value:** Custom Reports empowers non-technical users to create operational dashboards and data views through natural language conversation, eliminating the need for developer involvement in report creation. Saved reports become reusable artifacts accessible to the entire team.

**Dependencies:** EPIC-01 (Infrastructure), EPIC-02 (Data Sources — OpenAI LLM service, canonical data source registry, report data routes)

---

## Tasks

### T-05.01 — Implement Custom Report Database Table

**Description:** Create the `custom_reports` database table for storing report configurations.

**Acceptance Criteria:**
- Table schema: `id` (serial PK), `name` (varchar, not null), `slug` (varchar, unique, not null), `description` (text), `report_config` (jsonb, not null), `conversation_history` (jsonb), `created_by` (integer, FK to users), `created_at` (timestamp), `updated_at` (timestamp), `version` (integer, default 1)
- Unique constraint on `slug`
- Index on `created_by` for per-user queries
- Index on `slug` for fast lookup

---

### T-05.02 — Implement Custom Report Service (Backend)

**Description:** Build the backend `CustomReportService` that handles CRUD operations for custom reports.

**Acceptance Criteria:**
- `CustomReportService` with methods:
  - `list(limit, offset)` — paginated list of all reports
  - `getBySlug(slug)` — single report lookup by slug
  - `create(name, description, reportConfig, conversationHistory, userId)` — creates report with auto-generated slug
  - `update(id, name, description, reportConfig, conversationHistory)` — updates report, increments version
  - `delete(id)` — deletes a report
  - `getDataCatalog(grouped)` — returns allowlisted data sources
- Slug generation: converts name to URL-safe slug, appends number if duplicate
- Report config validated against Zod schema before save
- Conversation history preserved for edit continuity

---

### T-05.03 — Implement Custom Report API Routes

**Description:** Create the API routes for custom report CRUD operations.

**Acceptance Criteria:**
- `GET /api/custom-reports` — list reports (params: `limit`, `offset`), returns array with `id`, `name`, `slug`, `description`, `created_at`, `updated_at`, `version`
- `GET /api/custom-reports/data-catalog` — returns data catalog grouped by category (param: `grouped`)
- `GET /api/custom-reports/:slug` — single report by slug, includes full `reportConfig` and `conversationHistory`
- `POST /api/custom-reports` — create report (body: `name`, `description`, `reportConfig`, `conversationHistory`)
- `PUT /api/custom-reports/:id` — update report (body: same as create)
- `DELETE /api/custom-reports/:id` — delete report
- All routes require authentication

---

### T-05.04 — Implement Report Agent API Routes

**Description:** Create the API routes for the AI chat-based report generation.

**Acceptance Criteria:**
- `POST /api/report-agent/chat` — send chat message (body: `message`, `conversationHistory`, `proposedConfig`); returns LLM response with optional proposed report config
- `GET /api/report-agent/capabilities` — returns available capabilities and data catalog for the report agent
- Chat endpoint invokes `ReportLlmService.chat()` with full context
- Rate limiting applied per user
- Requires authentication and valid LLM API key in user settings

**Key Detail:**
- Chat endpoint rate limit: 10 requests per minute per user
- Request body for chat: `{ message: string, conversationHistory?: array, proposedConfig?: object }`

---

### T-05.05 — Implement Report Data Fetch Routes

**Description:** Create the API routes that the report renderer uses to fetch live data for individual report components.

**Acceptance Criteria:**
- `GET /api/report-data/catalog` — returns the data catalog (same as custom-reports but at a separate path for renderer)
- `POST /api/report-data/fetch` — fetches data from an allowlisted endpoint (body: `endpoint`, `params`, `arrayKey`, `enrich`)
- Endpoint allowlisting: validates against canonical data source registry
- Parameter validation: checks params against the source's defined parameter schema
- Optional enrichment: joins or transforms data before returning
- Returns consistent response format with data array and metadata

**Key Detail:**
- The `POST /api/report-data/fetch` endpoint is used when a component's `dataSource.enrich` property exists; otherwise the ReportRenderer fetches data directly from the source endpoint via GET
- Data catalog endpoint used by both `DataCatalogModal` and `CreateReport` page

---

### T-05.06 — Implement Custom Report Service (Frontend)

**Description:** Create the frontend `customReportService` module for report CRUD operations.

**Acceptance Criteria:**
- `customReportService.js` exports:
  - `listReports()` — fetch all reports
  - `getReport(slug)` — fetch single report by slug
  - `createReport(data)` — create new report
  - `updateReport(id, data)` — update existing report
  - `deleteReport(id)` — delete report
  - `getDataCatalog()` — fetch data catalog
- Error handling with meaningful messages

**Key Detail:**
- `listReports` accepts `limit` and `offset` parameters; called with `limit=100, offset=0` from sidebar
- `getDataCatalog` accepts a `grouped` query parameter
- Create/update request body: `{ name, description, reportConfig, conversationHistory }`

---

### T-05.07 — Implement Report Agent Service (Frontend)

**Description:** Create the frontend `reportAgentService` module for the AI chat interface.

**Acceptance Criteria:**
- `reportAgentService.js` exports:
  - `chat(message, conversationHistory, proposedConfig)` — send chat message, receive LLM response
  - `getCapabilities()` — fetch report agent capabilities and data catalog
- Handles streaming responses if supported
- Error handling: distinguishes between auth errors (missing API key), rate limit errors, and general failures

---

### T-05.08 — Build Create Report Page

**Description:** Create the `CreateReport.jsx` page that provides the AI chat interface for building reports.

**Acceptance Criteria:**
- Page layout: left panel (chat) and right panel (report preview), resizable split
- Chat panel:
  - Message input with send button (Enter to send, Shift+Enter for newline)
  - Conversation history display with user and AI messages distinguished
  - AI messages may include proposed report configs that auto-render in preview
  - Loading indicator while waiting for AI response
  - Error display for failed API calls
- Preview panel:
  - Renders the current proposed report config using `ReportRenderer`
  - Updates live as the AI proposes new configurations
  - Empty state with instructions when no config is proposed
- Action buttons:
  - "Save Report" — opens save dialog with name and description fields
  - "Load Sample" — loads a sample report config for demonstration
  - "Import JSON" — imports a report config from a JSON file
  - "Export JSON" — exports the current config as a JSON file
  - "Data Catalog" — opens the Data Catalog Modal
- Edit mode: when navigating to `/custom-reports/edit/:slug`, loads existing report's config and conversation history
- Page registered with permission name `custom_reports.create`

**Key Detail:**
- Layout: `flex h-[calc(100vh-8rem)] gap-4`, each panel is `w-1/2`
- Chat panel header: Sparkles icon, title "Report Builder" (or "Edit Report" in edit mode), AI status badge ("AI Active" if LLM configured, "Sample Only" if not)
- Action buttons in chat panel: Data Catalog, Import (hidden file input accepting `.json`), Load Sample (only in create mode, not edit), Reset (clears messages and proposed config)
- Preview panel header: Document icon, title "Preview"; action buttons appear when `proposedConfig` exists: Export JSON, Save Report / Update Report
- Chat message styling: user messages (blue, right-aligned, `max-w-[85%]`), assistant messages (gray, left-aligned), error messages (red)
- Chat input: textarea with 2 rows, Enter to send, placeholder varies by LLM availability and edit mode
- Built-in sample report config (loaded by "Load Sample"):
  - Title: "Package Changes Overview"
  - Description: "Summary of product package upgrades and downgrades across customer accounts"
  - Layout: `grid`
  - Components: 4 KPI cards (Total Changes, Upgrades, Accounts Affected, Downgrades), 1 bar chart (Changes by Product with top 10), 1 data table (Recent Package Changes with 6 columns: Account, Product, Type, From, To, Date)
  - Data sources used: `/api/analytics/package-changes/summary`, `/api/analytics/package-changes/by-product`, `/api/analytics/package-changes/recent`

---

### T-05.09 — Build Report Renderer Component

**Description:** Create the `ReportRenderer` component that dynamically renders a report from a JSON configuration.

**Acceptance Criteria:**
- Accepts a `reportConfig` prop (validated against Zod schema)
- Report config structure:
  - `title` — report title displayed at top
  - `description` — optional report description
  - `layout` — layout type (`grid`, `stack`, `two-column`)
  - `filters[]` — global filters that affect multiple components
  - `components[]` — array of widget configurations
- Each component in `components[]` has: `id`, `type`, `title`, `dataSource` (endpoint, params, arrayKey), `config` (type-specific)
- Data fetching: each component fetches its own data independently via `POST /api/report-data/fetch`
- Data deduplication: if multiple components use the same endpoint+params, share the response
- Linked parameters: components can reference filter values in their params
- Global refresh button re-fetches all component data
- Layout renders components according to `layout` type:
  - `grid`: CSS Grid with configurable columns
  - `stack`: vertical stack (full width)
  - `two-column`: two equal columns
- Loading state per component (skeleton placeholder)
- Error state per component (error message with retry)

**Key Detail:**
- Grid layout: `grid grid-cols-3 gap-6`
- Grid span classes: `{ 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3' }` — each component specifies `gridSpan` (1, 2, or 3)
- Component type to widget mapping: `kpi-card` -> KpiCard, `bar-chart`/`line-chart`/`pie-chart` -> ChartWidget, `data-table` -> DataTable, `echarts` -> EChartsWidget, `ag-grid` -> AgGridTable
- Data fetching: uses `fetchWithDedup` that caches in-flight requests by `endpoint + JSON.stringify(params)` to avoid duplicate calls when multiple KPI cards share the same data source
- If `dataSource.enrich` exists, fetches via `POST /report-data/fetch`; otherwise fetches directly from the source endpoint via GET
- Array extraction from response: `extractArray()` uses `dataSource.arrayKey` or falls back to well-known keys (`data`, `reports`, `ghostAccounts`, etc.)
- Linked parameters: filter `mapsToParam` property maps filter value to a component's API parameter; `ReportRenderer` merges `filterValues` into each component's `params` before fetch
- Filter types supported: `select`, `text`, `typeahead`
- Only `grid` layout is fully implemented; `stack` and `two-column` are in the Zod schema but not differentiated in rendering

---

### T-05.10 — Build KPI Card Widget Component

**Description:** Create the `KpiCard` widget component for displaying key performance indicator values.

**Acceptance Criteria:**
- Displays: title, primary value (large text), optional subtitle/label, optional trend indicator (up/down/neutral with percentage)
- Configurable: value field path, format (number, percentage, currency), color/accent
- Supports static values or values extracted from API response data
- Responsive sizing within grid layouts
- Dark mode support

**Key Detail:**
- Component props: `title`, `value`, `format`, `prefix`, `suffix`, `comparison` (number from `comparisonField`), `comparisonLabel`, `loading`, `error`, `errorDetail`
- Value extraction: uses `valueField` property (dot-path notation, e.g., `summary.total_changes`) to extract value from API response
- Format options and rendering:
  - `currency`: `$` prefix + `toLocaleString()`
  - `percentage`: `toFixed(1)` + `%` suffix
  - `number` (default): `toLocaleString()` (adds comma separators)

---

### T-05.11 — Build Chart Widget Component (Chart.js)

**Description:** Create the `ChartWidget` component for rendering Chart.js-based charts (bar, line, pie).

**Acceptance Criteria:**
- Supports chart types: `bar-chart`, `line-chart`, `pie-chart`
- Uses `react-chartjs-2` library
- Configurable: data field paths, labels, colors, axes, legend, tooltips
- Responsive sizing
- Dark mode: adjusts grid lines, text colors, and tooltips for dark backgrounds
- Empty state when no data available

**Key Detail:**
- Chart type mapping: `bar-chart` -> Bar, `line-chart` -> Line, `pie-chart` -> Pie or Doughnut (when `config.doughnut` is true)
- Per-type configuration options:
  - **Bar**: `xField`, `yField`, `colors`, `horizontal` (horizontal bars), `stacked` (stacked bar)
  - **Line**: `xField`, `yField`, `colors`, `fill` (area fill), `multiSeries`, `seriesField`
  - **Pie**: `labelField`, `valueField`, `colors`, `doughnut` (ring instead of filled)
- Default color palette: `['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']`

---

### T-05.12 — Build ECharts Widget Component

**Description:** Create the `EChartsWidget` component for rendering advanced charts using the ECharts library.

**Acceptance Criteria:**
- Renders any ECharts option configuration
- Uses `echarts-for-react` library
- Input sanitization via `echartsSanitizer` utility to prevent XSS in option configs
- Configurable dimensions (height, width)
- Responsive resize handling
- Dark mode: applies ECharts dark theme
- Supports all ECharts chart types: bar, line, pie, scatter, heatmap, gauge, etc.
- Loading and error states

**Key Detail:**
- Props: `title`, `data`, `option` (raw ECharts option object), `loading`, `error`, `errorDetail`
- Data injection: `injectDataset(option, data)` sets `option.dataset.source` to the API response data array
- Sanitization via `sanitizeEChartsOption(rawOption)` applied before rendering
- Dark mode detection: checks `document.documentElement.classList.contains('dark')` and applies `DARK_THEME` ECharts theme
- Default height: `h-72` (18rem)

---

### T-05.13 — Build Data Table Widget Component

**Description:** Create the `DataTable` widget component for rendering tabular data with basic formatting.

**Acceptance Criteria:**
- Renders a table from array data with configurable columns
- Column configuration: field path, header label, width, alignment, format (text, number, date, badge)
- Sorting by column click
- Pagination within the widget (configurable page size)
- Responsive horizontal scroll for many columns
- Dark mode support
- Empty state message when no data

**Key Detail:**
- Column definition schema: `{ field (dot-path), header (display label), format ('date'|'currency'|'percentage'|'number'|'text'), sortable (default true), width (optional), valueFields (array of dot-paths for composite columns), separator (default ', '), displayField (for array/object values) }`
- Props: `title`, `data`, `columns`, `pageSize`, `searchable`, `loading`, `error`, `errorDetail`, `onRowClickConfig`, `onRowClick`, `selectedRowValue`, `conditionalFormatting`
- Conditional formatting support:
  - Operators: `equals`, `notEquals`, `contains`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`
  - Styles: `danger` (red), `warning` (yellow), `success` (green), `info` (blue), `muted` (gray)

---

### T-05.14 — Build AG Grid Table Widget Component

**Description:** Create the `AgGridTable` widget component for rendering advanced data tables using AG Grid.

**Acceptance Criteria:**
- Uses `ag-grid-react` (Community edition)
- Column definitions derived from report config or auto-detected from data
- Features: sorting, filtering, column resize, column reorder
- Pagination with configurable page size
- Cell formatting: text, number, date, badge/status
- Row selection support
- Export to CSV from within the grid
- Dark mode: applies AG Grid dark theme
- Responsive sizing

**Key Detail:**
- Column definition schema: `{ field, headerName (or header), sortable, filter, resizable, flex, width, minWidth, format, valueFields, separator, displayField, valueGetter }`
- Pagination: enabled by default (`pagination !== false`); default page size: 10; available sizes: `[10, 25, 50, 100]`
- Quick filter: `quickFilterText` enables search across all columns
- Row styling: `getRowStyle` callback for row selection highlighting and conditional formatting
- Row click: `onRowClicked` fires when `onRowClickConfig` is configured (for drill-down navigation)
- Grid options: `domLayout="autoHeight"`, `animateRows`, `suppressCellFocus`, `enableCellTextSelection`
- Theme: `themeQuartz` with dark variant applied based on current theme setting

---

### T-05.15 — Build Filter TypeAhead Component for Reports

**Description:** Create the `FilterTypeAhead` component used for global report filters.

**Acceptance Criteria:**
- Type-ahead input with dropdown suggestions
- Fetches suggestions from the appropriate data source endpoint
- Supports single and multi-select modes
- Selected value(s) propagated to linked report components via ReportRenderer
- Debounced search (300ms)
- Clear selection button
- Integration with ReportRenderer's linked parameter system

**Key Detail:**
- Configuration props: `value`, `onChange`, `placeholder` (default 'Search...'), `suggestEndpoint` (API endpoint), `suggestParam` (default 'search'), `suggestResultKey` (dot-path to array in response), `suggestDisplayField` (default 'name'), `suggestSecondaryField` (optional secondary line in dropdown)
- Request format: `GET {suggestEndpoint}?{suggestParam}={term}&limit=10`
- Minimum characters before search triggers: 2
- Debounce interval: 300ms
- Linked parameter integration: filter's `mapsToParam` property maps the selected value to an API parameter name (e.g., `account_id`); ReportRenderer merges this into each linked component's params before fetching

---

### T-05.16 — Build Data Catalog Modal Component

**Description:** Create the `DataCatalogModal` component that displays all available data sources for report creation.

**Acceptance Criteria:**
- Modal listing all data sources from the canonical registry
- Grouped by category (e.g., "Primary: Salesforce", "Derived: Package Changes")
- Each source shows: name, description, endpoint, parameters with types and defaults, response shape (field names and types)
- Search/filter within the catalog
- Copy endpoint or parameter details to clipboard
- Helps users understand what data is available when chatting with the AI agent

**Key Detail:**
- Data source fetched from `GET /api/report-data/catalog`
- Grouping by category with source type badges: `primary`, `derived`, `preserved` (each with distinct badge/icon styling)
- Per data source display: endpoint path, description, `primarySource` label, parameters list (name, type, default), response shape (`arrayKey`, `fields[]` with name and type)
- Search filters by: endpoint, description, field names, parameter names

---

### T-05.17 — Build Custom Report View Page

**Description:** Create the `CustomReportView.jsx` page for viewing saved reports.

**Acceptance Criteria:**
- Route: `/custom-reports/:slug`
- Fetches report by slug via `customReportService.getReport(slug)`
- Renders report using `ReportRenderer` component
- Header shows: report title, description, version, last updated date
- Action buttons:
  - "Edit" — navigates to `/custom-reports/edit/:slug` (requires `custom_reports.create` permission)
  - "Delete" — confirmation dialog, then deletes report and navigates to Dashboard
  - "Export Config" — downloads report config as JSON file
- Page registered with permission name `custom_reports.view`
- 404 handling for non-existent slugs

**Key Detail:**
- Title display priority: `config?.title || report.name`
- Description display priority: `config?.description || report.description`
- Metadata displayed: `created_by_username`, `updated_at` (formatted date), version badge (`v{report.version}`)
- Action buttons: Back (link to `/custom-reports/create`), Export, Edit, Delete
- Delete triggers a confirmation modal before executing

---

### T-05.18 — Integrate Saved Reports into Sidebar

**Description:** Add dynamic sidebar entries for saved custom reports under the Custom Reports section.

**Acceptance Criteria:**
- Sidebar "Custom Reports" section shows:
  - Static "Create Report" link (always visible if user has `custom_reports.create`)
  - Dynamic list of saved reports fetched from `GET /api/custom-reports`
  - Each saved report links to `/custom-reports/:slug`
- Reports refresh when a new report is saved or deleted
- Active report highlighted in sidebar when viewing
- Section collapsible like other sidebar sections

**Key Detail:**
- Fetch: `listReports(100, 0)` called when user has `custom_reports.view` page access
- Re-fetch trigger: when `location.pathname.startsWith('/custom-reports')` (checks on route change)
- Report display name in sidebar: `report.report_config?.title || report.name`
- Sidebar item path: `/custom-reports/${report.slug}`
- Custom Reports nav item has `dynamic: true` flag to enable dynamic sub-items

---

### T-05.19 — Implement JSON Import/Export for Report Configs

**Description:** Add the ability to import and export report configurations as JSON files.

**Acceptance Criteria:**
- **Export:** "Export JSON" button on Create Report page and Custom Report View page downloads the report config as a `.json` file named `report-{slug}.json`
- **Import:** "Import JSON" button on Create Report page opens a file picker, reads the JSON file, validates against Zod schema, and loads it into the preview panel
- Validation errors from import display a clear error message listing what's wrong
- Imported configs can be further edited via chat before saving

**Key Detail:**
- Import uses a hidden `<input type="file" accept=".json">` element
- Imported JSON is parsed and set as the `proposedConfig` state, which triggers ReportRenderer to render it in the preview panel

---

### T-05.20 — Implement ECharts Sanitizer Utility

**Description:** Create the utility that sanitizes ECharts option objects to prevent XSS attacks from AI-generated configurations.

**Acceptance Criteria:**
- `echartsSanitizer.js` exports `sanitizeEChartsOption(option)` function
- Removes or escapes potentially dangerous properties (functions, event handlers)
- Preserves all valid ECharts configuration options
- Handles deeply nested option objects
- Used by `EChartsWidget` before passing options to ECharts

**Key Detail:**
- Sanitized/blocked content:
  - **Functions**: any value that is a function is removed
  - **HTML**: regex `<[^>]*>` stripped from all string values
  - **Prototype pollution**: keys `__proto__`, `constructor`, `prototype` are dropped
  - **Depth limit**: max 15 levels of nesting; deeper objects become `undefined`
- Validation: `validateEChartsStructure()` checks that the option object contains `series` or `graphic` property (minimum viable ECharts config)

---

## User Stories

### US-05.01 — User Can Create a Report Using Natural Language

**As a** deployment team member, **I want to** describe a report I need in plain language and have the AI generate it **so that** I can create custom dashboards without technical knowledge.

**Acceptance Criteria:**
- I can type a natural language request like "Show me a bar chart of provisioning requests by type for the last 30 days"
- The AI responds with a proposed report configuration that renders in the preview panel
- I can refine the report through follow-up messages ("Make the chart red", "Add a KPI card showing the total count")
- Each AI iteration updates the preview in real-time
- The conversation history is preserved so the AI has context for refinements

**Dependencies:** T-05.04, T-05.07, T-05.08, T-05.09

---

### US-05.02 — User Can Preview a Report Before Saving

**As a** deployment team member, **I want to** see a live preview of the AI-generated report **so that** I can verify it shows the right data before committing.

**Acceptance Criteria:**
- Preview panel shows the rendered report with live data
- Each component loads real data from the application's APIs
- If data loading fails for a component, only that component shows an error (others still render)
- I can resize the chat/preview split to see more of either panel

**Key Detail:**
- Preview panel occupies `w-1/2` of the page; ReportRenderer renders with `showTitle={true}`
- Each component independently fetches and displays data; errors are isolated per component

**Dependencies:** T-05.08, T-05.09, T-05.10, T-05.11, T-05.12, T-05.13, T-05.14

---

### US-05.03 — User Can Save a Custom Report

**As a** deployment team member, **I want to** save a report I've created **so that** I and my colleagues can access it again later.

**Acceptance Criteria:**
- "Save Report" button opens a dialog for name and description
- Report is saved with a URL-friendly slug derived from the name
- Saved report appears in the sidebar under Custom Reports
- Conversation history is saved alongside the config for future editing
- Success toast confirms the save

**Dependencies:** T-05.02, T-05.03, T-05.06, T-05.08, T-05.18

---

### US-05.04 — User Can View a Saved Report

**As a** deployment team member, **I want to** click on a saved report in the sidebar to view it **so that** I can monitor the data it presents.

**Acceptance Criteria:**
- Clicking a report in the sidebar navigates to `/custom-reports/:slug`
- Report renders with current live data (not cached data from when it was saved)
- Report header shows title, description, and last updated date
- Report is viewable by any user with `custom_reports.view` permission

**Key Detail:**
- Report header also shows `created_by_username` and version badge (`v{version}`)

**Dependencies:** T-05.09, T-05.17, T-05.18

---

### US-05.05 — User Can Edit an Existing Report

**As a** deployment team member, **I want to** edit a saved report to refine or update it **so that** reports stay relevant as needs change.

**Acceptance Criteria:**
- "Edit" button on the report view navigates to edit mode
- Edit mode loads the saved config and conversation history
- I can continue the AI conversation from where it left off
- Saving updates the existing report (increments version, updates timestamp)
- Cancel discards changes and returns to the view

**Key Detail:**
- Edit route: `/custom-reports/edit/:slug`
- In edit mode, the "Load Sample" button is hidden; page title shows "Edit Report" instead of "Report Builder"

**Dependencies:** T-05.02, T-05.08

---

### US-05.06 — User Can Delete a Report

**As a** deployment team member, **I want to** delete a report I no longer need **so that** the sidebar doesn't become cluttered.

**Acceptance Criteria:**
- "Delete" button on the report view shows a confirmation dialog
- Confirming deletion removes the report from the database and sidebar
- User is redirected to the Dashboard after deletion
- Only the report creator or admin can delete a report

**Dependencies:** T-05.03, T-05.17

---

### US-05.07 — User Can Import and Export Report Configurations

**As a** deployment team member, **I want to** export a report config as JSON and import configs from JSON files **so that** I can share reports with colleagues or back them up.

**Acceptance Criteria:**
- Export downloads a `.json` file with the full report configuration
- Import reads a `.json` file, validates it, and loads it into the Create Report preview
- Invalid JSON files show a clear error message
- Imported configs can be modified via chat before saving

**Dependencies:** T-05.19

---

### US-05.08 — User Can Browse Available Data Sources

**As a** deployment team member, **I want to** browse a catalog of available data sources **so that** I know what data I can request when creating reports.

**Acceptance Criteria:**
- "Data Catalog" button opens a modal listing all available data sources
- Sources are grouped by category (Salesforce, Package Changes, Expiration, etc.)
- Each source shows: description, available parameters, response fields
- I can search within the catalog
- This helps me formulate better requests to the AI

**Key Detail:**
- Data sources are grouped into three source types with distinct badges: `primary` (direct from external system), `derived` (computed from primary data), `preserved` (historical snapshots)
- Each source displays: endpoint path, description, `primarySource`, list of parameters (name, type, default value), response shape with `arrayKey` and `fields[]` (name, type)

**Dependencies:** T-05.16

---

### US-05.09 — User Can Load a Sample Report

**As a** new user, **I want to** load a sample report configuration **so that** I can see what a finished report looks like and understand the system's capabilities.

**Acceptance Criteria:**
- "Load Sample" button populates the preview with a pre-built report
- Sample report demonstrates multiple widget types (KPI, chart, table)
- User can modify the sample via chat or save it as their own report

**Key Detail:**
- Sample report title: "Package Changes Overview"
- Sample components: 4 KPI cards (Total Changes, Upgrades, Accounts Affected, Downgrades), 1 bar chart (Changes by Product, top 10), 1 data table (Recent Package Changes with columns: Account, Product, Type, From, To, Date)
- Data sources used: `/api/analytics/package-changes/summary`, `/api/analytics/package-changes/by-product`, `/api/analytics/package-changes/recent`
- "Load Sample" button is only visible in create mode (not edit mode)

**Dependencies:** T-05.08
