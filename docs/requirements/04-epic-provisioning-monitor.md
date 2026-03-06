# EPIC-04: Provisioning Monitor Sub-Page

## Epic Description

Build the Provisioning Monitor sub-page that provides a detailed, filterable, searchable view of Professional Services (PS) provisioning requests from Salesforce. This page is the primary operational tool for monitoring provisioning activity, identifying validation errors, comparing entitlements between Salesforce and SML, and examining raw request data.

**Business Value:** The Provisioning Monitor is the core operational page used daily by the deployment team to track, investigate, and resolve provisioning requests. It eliminates the need to query Salesforce directly, provides validation against business rules, and enables comparison with the SML entitlement system.

**Dependencies:** EPIC-01 (Infrastructure), EPIC-02 (Data Sources — Salesforce API, SML, Validation services)

**Note:** This epic covers only the Provisioning Monitor sub-page (`/provisioning`). Related sub-pages (Expiration Monitor, Ghost Accounts, Audit Trail) are part of the broader Provisioning section but are out of scope for this epic (they are covered by their underlying data source tasks in EPIC-02).

---

## Tasks

### T-04.01 — Implement Provisioning Service (Frontend)

**Description:** Create the frontend `provisioningService` module that fetches provisioning data from the backend APIs.

**Acceptance Criteria:**
- `provisioningService.js` exports: `getRequests(params)`, `getFilterOptions()`, `searchRequests(query, limit)`, `getRequest(id)`, `getCustomerProducts(account)`, `getRemovals(timeFrame)`, `getNewRecords(since)`
- Uses the shared `api` Axios instance
- Supports pagination parameters: `pageSize`, `offset`
- Supports filter parameters: `requestType`, `accountId`, `status`, `startDate`, `endDate`, `search`
- Error handling with meaningful messages

**Key Detail:**
- Exact API endpoints and parameters per method:
  - `getProvisioningRequests(params)` — `GET /api/provisioning/requests` — query params: `requestType`, `accountId`, `status`, `search`, `pageSize` (default 25), `offset` (default 0)
  - `getProvisioningFilterOptions()` — `GET /api/provisioning/filter-options` — no params
  - `searchProvisioning(query, limit)` — `GET /api/provisioning/search` — query params: `q` (search term), `limit` (default 20)
  - `getProvisioningRequestById(id)` — `GET /api/provisioning/requests/:id` — path param
  - `getCustomerProducts(account)` — `GET /api/customer-products` — query param: `account` (account name)
  - `getProvisioningWithRemovals(timeFrame)` — `GET /api/provisioning/removals` — query param: `timeFrame` (default `'1w'`)
  - `getNewProvisioningRecords(since)` — `GET /api/provisioning/new-records` — query param: `since`

---

### T-04.02 — Implement SML Compare Service (Frontend)

**Description:** Create the frontend `smlCompareService` module for comparing Salesforce provisioning data against SML tenant entitlements.

**Acceptance Criteria:**
- `smlCompareService.js` exports functions for: SML connection test, tenant product comparison, tenant product listing
- Calls SML-related endpoints under `/api/sml/`
- Returns comparison results highlighting discrepancies between Salesforce and SML

**Key Detail:**
- Exact API endpoints:
  - `fetchSMLTenantDetails(tenantName)` — `POST /api/sml/tenant-compare` — body: `{ tenantName: string }`
  - `getSMLConfig()` — `GET /api/sml/config` — no params

---

### T-04.03 — Build Provisioning Monitor Page Container

**Description:** Create the `ProvisioningRequests.jsx` page component that orchestrates the provisioning requests table, filters, search, and modals.

**Acceptance Criteria:**
- Page title: "Provisioning Monitor"
- Layout: search bar at top, filter panel (collapsible), main data table, action buttons
- Fetches provisioning requests on mount with default filters
- Supports pagination (configurable page size: 25, 50, 100)
- Supports sorting by multiple columns
- Loading state while data loads
- Error handling with retry capability
- Auto-refresh support via `usePageAutoRefresh` hook
- Page registered with permission name `provisioning.monitor`

**Key Detail:**
- Default page size: 25
- URL query parameter `exact` supports exact-match filtering: when present, filters table to records where `record.Name === exactMatchFilter` (used by Dashboard "View Record" links)
- Validation is run client-side on every loaded record using `validationEngine.validateRecord()` with the enabled rules list
- Default enabled validation rules: `['app-quantity-validation', 'entitlement-date-overlap-validation', 'entitlement-date-gap-validation', 'app-package-name-validation']`

---

### T-04.04 — Build Type-Ahead Search for Provisioning Requests

**Description:** Implement the type-ahead search functionality that allows users to search PS requests by account name, PS ID, or tenant name.

**Acceptance Criteria:**
- Search input with debounced type-ahead (300ms delay)
- Calls `GET /api/provisioning/search?q={query}&limit={limit}`
- Dropdown displays matching results with highlighting
- Selecting a result navigates to or filters to that specific record
- Minimum 2 characters before search triggers
- Loading indicator during search
- "No results" message when search returns empty

**Key Detail:**
- Default search result limit: 20
- Selecting a result sets the `accountId` filter to filter the table to that account's records

---

### T-04.05 — Build Filter Panel for Provisioning Requests

**Description:** Implement the multi-criteria filter panel for narrowing provisioning requests.

**Acceptance Criteria:**
- Filter options loaded from `GET /api/provisioning/filter-options`
- Available filters:
  - Request Type (multi-select dropdown)
  - Status (multi-select dropdown)
  - Account (type-ahead)
  - Date Range (start date, end date pickers)
  - Free-text search
- Filters applied on change with debounce
- "Clear Filters" button resets all filters to defaults
- Active filter count displayed as badge
- Filter state preserved in URL query parameters for shareability

**Key Detail:**
- Filter options API response structure: `{ requestTypes: string[], statuses: string[] }`
- Only two dropdown filters are implemented: Request Type and Status (rendered as `<select>` elements with "All Request Types" / "All Statuses" defaults)
- Account filter is set via the type-ahead search component (not a separate filter control)
- URL query parameter `exact` provides an additional exact-match-by-name filter (used for deep-linking from Dashboard)
- State keys: `filters.requestType`, `filters.status`, `filters.accountId`; plus `exactMatchFilter` from URL

---

### T-04.06 — Build Provisioning Requests Data Table

**Description:** Implement the main data table that displays provisioning requests with sortable columns and row actions.

**Acceptance Criteria:**
- Columns: PS ID, Account Name, Request Type, Status, Created Date, Products, Validation Status
- All columns sortable (click header to toggle ascending/descending)
- Row click opens detailed view
- Row actions menu (three-dot icon) with options: View Products, Compare SML, View Raw Data
- Pagination controls at bottom: previous/next, page number, total count, page size selector
- Responsive column widths
- Validation status indicators: pass (green check), fail (red X), warning (yellow triangle)
- CSV export button for current filtered results

**Key Detail:**
- Exact column definitions in order:

| # | Column Header | Salesforce Field Path | Rendering Notes |
|---|---------------|----------------------|-----------------|
| 1 | Technical Team Request | `request.Name` | Plain text, fallback `'N/A'` |
| 2 | Account | `request.Account__c` | Primary text; `request.Account_Site__c` shown as secondary smaller text below |
| 3 | Request Type | `request.TenantRequestAction__c` | Plain text |
| 4 | Deployment | `request.Deployment__r?.Name` | Plain text |
| 5 | Tenant Name | `parseTenantName(request)` | Derived via `validationEngine.parseTenantName()` |
| 6 | Products | `request.Payload_Data__c` | Custom `renderProductsColumn()` — three buttons showing counts for Models, Data, Apps; clicking opens ProductModal for that category |
| 7 | Payload | `request.Payload_Data__c` | "JSON" button that opens RawDataModal if payload exists |
| 8 | Data Validations | `validationResults.get(request.Id)` | Custom `renderValidationColumn()` — Pass (green badge), Fail (red badge with count), Warning (yellow badge) |
| 9 | Status | `request.Status__c` | Uses `getStatusText()` / `getStatusColor()` helpers; shows "Provisioning Failed" if `SMLErrorMessage__c` exists |
| 10 | Created Date | `request.CreatedDate` | Formatted as `toLocaleDateString()` + `toLocaleTimeString()` (two lines) |
| 11 | Created By | `request.CreatedBy?.Name` | Plain text |
| 12 | Actions | — | `ActionsMenu` component with row-level actions |

- CSV export headers (in order): `Technical Team Request`, `Account`, `Account Site`, `Request Type`, `Deployment Number`, `Tenant Name`, `Status`, `Created Date`, `Created By`

---

### T-04.07 — Build Product Modal Component

**Description:** Create the `ProductModal` component that displays product details for a selected provisioning request.

**Acceptance Criteria:**
- Modal overlay with close button (X) and click-outside-to-close
- Displays: account name, PS record ID, request type
- Product list with: product name, package, status, dates
- Product categorization (Models, Data, Apps)
- Scrollable product list for records with many products
- Loading state while fetching product details

**Key Detail:**
- Product columns vary by product type (category):

| Product Type | Columns |
|-------------|---------|
| **Models** | Product Code (`getProductCode`), Start Date (`getStartDate`), End Date (`getEndDate`), Modifier (`getModifier`) |
| **Apps** | Product Code (`getProductCode`), Package Name (`getPackageName`) [with info icon], Quantity (`getQuantity`), Start Date (`getStartDate`), End Date (`getEndDate`) |
| **Data** | Product Code (`getProductCode`), Start Date (`getStartDate`), End Date (`getEndDate`) |

- `getProductCode` resolves from fields: `productCode`, `product_code`, `ProductCode`, `name` (in priority order)
- `getModifier` resolves from fields: `productModifier`, `ProductModifier`
- Apps Package Name column has an info icon (`showInfo: true`) that opens a nested **Package Info Modal** showing: `package_name`, `ri_package_name`, `package_type`, `description`, `locations`, `max_concurrent_model`, `max_concurrent_non_model`, `max_jobs_day`, `max_users`
- Package name validation exceptions (apps that don't require a package name): `IC-RISKDATALAKE`, `IC-DATABRIDGE`, `DATAAPI-LOCINTEL`, `RI-COMETA`, `DATAAPI-BULK-GEOCODE`

---

### T-04.08 — Build SML Comparison Modal Component

**Description:** Create the `SMLComparisonModal` component that compares Salesforce provisioning data against SML tenant entitlements side by side.

**Acceptance Criteria:**
- Modal displays two-column comparison: Salesforce (left) vs SML (right)
- Highlights discrepancies: products in Salesforce but not SML, products in SML but not Salesforce
- Color coding: green (match), red (mismatch), yellow (partial match)
- Shows tenant ID, account name, region
- Product-level comparison with individual status indicators
- "Refresh SML Data" button to force fresh comparison
- Loading state during SML data fetch

**Key Detail:**
- Comparison is performed per entitlement type with type-specific identifiers and compared fields:

| Entitlement Type | Identifier Key | Compared Fields |
|-----------------|---------------|-----------------|
| **Models** | `productCode\|productModifier` | `startDate`, `endDate`, `productModifier` |
| **Data** | `productCode\|name` + `productModifier` | `startDate`, `endDate`, `productModifier` |
| **Apps** | `productCode\|name` + `packageName` + `quantity` + `productModifier` | `startDate`, `endDate`, `packageName`, `quantity`, `productModifier` |

- Comparison table columns per type:
  - Models: Start Date, End Date, Product Modifier
  - Data: Start Date, End Date, Product Modifier
  - Apps: Package Name, Quantity, Start Date, End Date, Product Modifier
- Status labels: `In SML Only`, `In SF Only`, `Different`, `Match`
- API call: `POST /api/sml/tenant-compare` with body `{ tenantName }`

---

### T-04.09 — Build Raw Data Modal Component

**Description:** Create the `RawDataModal` component that displays the raw JSON data of a provisioning request.

**Acceptance Criteria:**
- Modal displays formatted JSON with syntax highlighting
- Color scheme: keys (blue), strings (green), numbers (orange), booleans (purple), null (grey)
- Line numbers displayed
- File size and line count shown in header
- Copy-to-clipboard button
- Scrollable content for large payloads
- Search within JSON content

**Key Detail:**
- Props: `isOpen`, `onClose`, `data` (string or object), `title` (default `'Raw JSON Data'`)
- Data is parsed and pretty-printed with `JSON.stringify(parsed, null, 2)`
- **Download as JSON** button saves file as `{sanitizedTitle}_{YYYY-MM-DD}.json`
- Footer shows: line count and file size in KB
- If JSON parsing fails, shows raw content and displays the parse error message

---

### T-04.10 — Implement SML Data Refresh Capability

**Description:** Add the ability to refresh SML tenant data from the provisioning monitor.

**Acceptance Criteria:**
- "Refresh SML Data" button available on the page
- Calls `POST /api/validation/refresh-sml-data`
- Shows progress indicator during refresh
- Success/error toast notification on completion
- Refreshed data reflected in subsequent comparisons

---

### T-04.11 — Implement Validation Engine (Frontend)

**Description:** Create the frontend validation engine utility for client-side validation of provisioning records.

**Acceptance Criteria:**
- `validationEngine.js` exports: `validateRecord(record, enabledRules)`, `parseEntitlements(entitlementString)`, `parseTenantName(name)`, and related helpers
- Applies configurable validation rules to PS records
- Returns structured validation results: pass/fail per rule, error messages, severity
- Rules configurable via Settings page (stored rules preference)

**Key Detail:**
- Exact validation rules implemented:

| Rule ID | Name | Category | Logic |
|---------|------|----------|-------|
| `app-quantity-validation` | App Quantity Validation | product-validation | FAIL if any app has `quantity < 1` or missing quantity |
| `entitlement-date-overlap-validation` | Entitlement Date Overlap Validation | date-validation | FAIL if same product code has overlapping date ranges |
| `entitlement-date-gap-validation` | Entitlement Date Gap Validation | date-validation | Always PASS (simplified implementation) |
| `app-package-name-validation` | App Package Name Validation | product-validation | FAIL if app is missing `packageName`; exceptions: `IC-RISKDATALAKE`, `IC-DATABRIDGE` |

- Additional exports: `getValidationTooltip(validationResult)` for generating hover tooltips
- `parseTenantName(request)` extracts tenant name from various fields on the PS record
- `parseEntitlements(entitlementString)` parses the `Payload_Data__c` JSON field into structured product arrays (models, data, apps)

---

## User Stories

### US-04.01 — User Can View All Provisioning Requests

**As a** deployment team member, **I want to** see a comprehensive list of PS provisioning requests **so that** I can monitor all provisioning activity in one place.

**Acceptance Criteria:**
- Table displays all recent provisioning requests with key columns
- Data loads automatically on page visit
- Pagination allows browsing through large result sets
- Total record count is displayed
- Data reflects current Salesforce state (or recently cached data)

**Key Detail:**
- The "key columns" displayed in the table are (in order): Technical Team Request, Account (with Account Site as secondary text), Request Type, Deployment, Tenant Name, Products (Models/Data/Apps count buttons), Payload (JSON viewer button), Data Validations (Pass/Fail/Warning badge), Status, Created Date (date + time), Created By, Actions menu
- Default page size: 25; available sizes: 25, 50, 100
- Products column renders three clickable buttons showing counts for Models, Data, and Apps categories

**Dependencies:** T-04.01, T-04.03, T-04.06

---

### US-04.02 — User Can Search for Specific Provisioning Requests

**As a** deployment team member, **I want to** search for provisioning requests by account name, PS ID, or tenant name **so that** I can quickly find a specific request.

**Acceptance Criteria:**
- Type-ahead search shows matching results as I type
- Results appear after 2+ characters with minimal delay
- I can see enough context in search results to identify the right record
- Selecting a result shows that record in the table

**Dependencies:** T-04.01, T-04.04

---

### US-04.03 — User Can Filter Provisioning Requests by Multiple Criteria

**As a** deployment team member, **I want to** filter provisioning requests by type, status, account, and date range **so that** I can focus on the subset of requests relevant to my current task.

**Acceptance Criteria:**
- Multiple filters can be applied simultaneously
- Filters take effect immediately (or with minimal delay)
- Active filter count is visible
- I can clear all filters with one click
- Filter selections can be shared via URL

**Key Detail:**
- Implemented filters: Request Type dropdown (from `filterOptions.requestTypes`), Status dropdown (from `filterOptions.statuses`), Account (via type-ahead search), Exact Name Match (via `?exact=` URL parameter)
- Filter options are fetched from `GET /api/provisioning/filter-options` which returns `{ requestTypes: [], statuses: [] }`

**Dependencies:** T-04.01, T-04.05

---

### US-04.04 — User Can View Product Details for a Provisioning Request

**As a** deployment team member, **I want to** click on a provisioning request to see its product details **so that** I can understand exactly what products are being provisioned or modified.

**Acceptance Criteria:**
- Clicking a row or "View Products" opens the Product Modal
- Modal shows all products with names, packages, statuses, and dates
- Products are categorized (Models, Data, Apps)
- Modal is scrollable for records with many products

**Key Detail:**
- Products column in the table shows three category buttons (Models, Data, Apps) with counts; clicking a specific category button opens the ProductModal filtered to that category
- Models columns: Product Code, Start Date, End Date, Modifier
- Apps columns: Product Code, Package Name (with package info icon), Quantity, Start Date, End Date
- Data columns: Product Code, Start Date, End Date
- Package Info Modal (nested inside ProductModal for Apps) shows: package_name, ri_package_name, package_type, description, locations, max_concurrent_model, max_concurrent_non_model, max_jobs_day, max_users

**Dependencies:** T-04.07

---

### US-04.05 — User Can Compare Salesforce and SML Entitlements

**As a** deployment team member, **I want to** compare the Salesforce provisioning data against SML tenant entitlements **so that** I can identify discrepancies between the two systems.

**Acceptance Criteria:**
- "Compare SML" action opens a side-by-side comparison view
- Matching products are shown in green, mismatches in red
- I can see which products exist in one system but not the other
- I can refresh SML data if it appears stale

**Key Detail:**
- Comparison statuses: `Match` (green), `Different` (yellow), `In SF Only` (red), `In SML Only` (red)
- Comparison is performed separately for each entitlement type (Models, Data, Apps) with type-specific identifier keys and comparison fields (see T-04.08 Key Detail)

**Dependencies:** T-04.02, T-04.08

---

### US-04.06 — User Can View Raw JSON Data for a Provisioning Request

**As a** deployment team member, **I want to** view the raw JSON payload of a provisioning request **so that** I can inspect the full data structure for debugging or investigation.

**Acceptance Criteria:**
- "View Raw Data" action opens a formatted JSON viewer
- JSON is syntax-highlighted and readable
- I can copy the JSON to clipboard
- Line numbers help reference specific fields
- I can search within the JSON content

**Key Detail:**
- JSON color scheme: keys (blue), strings (green), numbers (orange), booleans (purple), null (grey)
- Download button saves as `{sanitizedTitle}_{YYYY-MM-DD}.json`
- Footer displays line count and file size (KB)

**Dependencies:** T-04.09

---

### US-04.07 — User Can Export Provisioning Data to CSV

**As a** deployment team member, **I want to** export the current filtered provisioning data to CSV **so that** I can analyze it in Excel or share it with stakeholders.

**Acceptance Criteria:**
- "Export CSV" button downloads a CSV file of the current filtered/sorted view
- CSV includes all visible columns plus additional detail fields
- File is named with the current date (e.g., `provisioning-requests-2026-03-04.csv`)
- Export respects current filter and sort settings

**Key Detail:**
- Exact CSV column headers (in order): `Technical Team Request`, `Account`, `Account Site`, `Request Type`, `Deployment Number`, `Tenant Name`, `Status`, `Created Date`, `Created By`

**Dependencies:** T-04.06

---

### US-04.08 — User Sees Validation Status for Each Provisioning Request

**As a** deployment team member, **I want to** see which provisioning requests have validation errors **so that** I can prioritize investigating and resolving them.

**Acceptance Criteria:**
- Each row in the table shows a validation status icon (pass/fail/warning)
- Validation is applied according to the rules enabled in Settings
- Hovering over a failed validation shows a tooltip with the error details
- I can sort/filter by validation status

**Key Detail:**
- Validation is run client-side on each record using `validationEngine.validateRecord(record, enabledRules)`
- Default enabled rules: `app-quantity-validation`, `entitlement-date-overlap-validation`, `entitlement-date-gap-validation`, `app-package-name-validation`
- Validation column renders: green "Pass" badge (all rules pass), red "Fail" badge with error count (one or more rules fail), yellow "Warning" badge
- Tooltip on hover generated by `getValidationTooltip()` showing per-rule results and error messages

**Dependencies:** T-04.06, T-04.11
