# EPIC-03: Dashboard

## Epic Description

Build the Dashboard page — the application's landing page after login — which provides an at-a-glance operational overview through three summary widgets: Data Validation errors, Product Removals, and Expiration Monitor. Each widget displays a configurable timeframe of data and links to its detailed feature page.

**Business Value:** The Dashboard gives deployment team members an immediate understanding of the current operational state, surfacing the most critical provisioning issues without requiring navigation to individual pages.

**Dependencies:** EPIC-01 (Infrastructure), EPIC-02 (Data Sources — specifically Salesforce provisioning and expiration services)

---

## Tasks

### T-03.01 — Implement Dashboard Service (Frontend)

**Description:** Create the frontend `dashboardService` module that fetches data for each dashboard widget from the backend APIs.

**Acceptance Criteria:**
- `dashboardService.js` exports: `getValidationErrors(timeFrame, enabledRules)`, `getRemovalsData(timeFrame)`, `getExpirationData(expirationWindow)`
- Uses the shared `api` Axios instance
- Error handling returns meaningful messages for widget error states

**API Endpoints Used:**
- `GET /api/validation/errors` (timeFrame, enabledRules)
- `GET /api/provisioning/removals` (timeFrame)
- `GET /api/expiration/monitor` (expirationWindow)

**Key Detail:**
- `getValidationErrors` default parameters: `timeFrame = '1d'`, `enabledRules = ['app-quantity-validation', 'entitlement-date-overlap-validation', 'entitlement-date-gap-validation', 'app-package-name-validation']`; `enabledRules` is sent as a JSON string in the query parameter
- `getRemovalsData` default parameter: `timeFrame = '1w'`
- `getExpirationData` default parameters: `expirationWindow = 7`, `showExtended = false`

---

### T-03.02 — Build Dashboard Page Container

**Description:** Create the `Dashboard.jsx` page component that orchestrates the three widgets and manages their state.

**Acceptance Criteria:**
- Page title: "Dashboard"
- Three widget areas arranged in a responsive grid layout (stacks on mobile, side-by-side on desktop)
- Each widget independently loads its data on mount
- Each widget has its own timeframe selector (stored in `localStorage` for persistence)
- Loading state per widget (skeleton/spinner)
- Error state per widget (error message with retry button)
- Auto-refresh support via `usePageAutoRefresh` hook
- Page registered with permission name `dashboard`

**Key Detail:**
- Grid layout: `grid grid-cols-1 2xl:grid-cols-3 gap-6` (3 columns on 2xl screens, single column on smaller)
- Widget timeframe localStorage keys: `dashboard_validationTimeframe`, `dashboard_removalsTimeframe`, `dashboard_expirationWindow`
- Default timeframes loaded from localStorage settings keys: `defaultDashboardValidationTimeframe` (fallback `'1w'`), `defaultDashboardRemovalsTimeframe` (fallback `'1w'`), `defaultDashboardExpirationWindow` (fallback `7`)
- Below the three main widgets, two additional cards are displayed:
  - **API Status card** — shows "Server is running and responding to requests" based on `GET /api/health`
  - **Quick Links card** — provides direct links to Provisioning Monitor, Expiration Monitor, and Customer Products

---

### T-03.03 — Build Validation Widget Component

**Description:** Create the `ValidationWidget` component that displays data validation error counts and details.

**Acceptance Criteria:**
- Displays count of validation errors within the selected timeframe
- Summary cards showing error breakdown by category/rule
- Timeframe selector: 7 days, 30 days, 90 days (default 7)
- Configurable validation rules filter
- Error count displayed prominently with color coding (red for critical, yellow for warnings)
- Click-through link to the full Provisioning Monitor page for details
- Loading and error states

**Key Detail:**
- Exact timeframe selector options: `1d` (Last 24 hours), `3d` (Last 3 days), `1w` (Last week), `1m` (Last month)
- Three summary counter cards displayed:
  - **Valid** — `summary.validRecords` — styled with `bg-green-50`, `text-green-700`, `border-green-200`
  - **Invalid** — `summary.invalidRecords` — styled with `bg-red-50`, `text-red-700`, `border-red-200`
  - **Total** — `summary.totalRecords` — styled with `bg-blue-50`, `text-blue-700`, `border-blue-200`
- Overall status indicator: red if `invalidCount > 0`, green if all records valid
- Per-error detail shows: `recordName`/`recordId`, `account`, list of `failedRules[]` (each with `ruleName` and `message`), `createdDate`
- "View Record" link per error navigates to `/provisioning?exact={recordName}` with exact match filter
- Default validation rules: `app-quantity-validation`, `entitlement-date-overlap-validation`, `entitlement-date-gap-validation`, `app-package-name-validation`

---

### T-03.04 — Build Removals Widget Component

**Description:** Create the `RemovalsWidget` component that displays recent product removal activity.

**Acceptance Criteria:**
- Displays count of product removals within the selected timeframe
- Summary of removals by product type or category
- Timeframe selector: 7 days, 30 days, 90 days (default 7)
- Color-coded indicators for removal volume (high/medium/low)
- Click-through link to the Provisioning Monitor page
- Loading and error states

**Key Detail:**
- Exact timeframe selector options: `1d` (Last 24 hours), `3d` (Last 3 days), `1w` (Last week), `1m` (Last month)
- Three category counter cards with specific color coding:
  - **Models** — blue (`bg-blue-50`, `text-blue-700`, `text-blue-900`)
  - **Data** — green (`bg-green-50`, `text-green-700`, `text-green-900`)
  - **Apps** — purple (`bg-purple-50`, `text-purple-700`, `text-purple-900`)
- Response data structure: `data.requests[]` where each request contains `currentRequest`, `previousRequest`, and `removals` with keys `removedModels`, `removedData`, `removedApps`
- Per-product removal detail shows: `productCode`, `productName`, "Removed From" (list of PS record names)
- Status indicator: green if `totalProducts === 0` (no removals), orange if removals exist
- Category modal config titles: "Model Removals" (blue), "Data Removals" (green), "App Removals" (purple)

---

### T-03.05 — Build Expiration Widget Component

**Description:** Create the `ExpirationWidget` component that displays products approaching expiration.

**Acceptance Criteria:**
- Displays count of products expiring within the selected window
- Breakdown by expiration urgency: expiring within 7 days, 30 days, 60 days, 90 days
- Expiration window selector: 7, 30, 60, 90 days (default 30)
- Extension detection: identifies products that have been renewed/extended
- Color-coded urgency indicators (red for imminent, yellow for upcoming, green for extended)
- Click-through link to the Expiration Monitor page
- Loading and error states

**Key Detail:**
- Exact window selector options: `7`, `14`, `30`, `60`, `90` days (note: includes 14 days, not in original spec)
- Three summary counter cards:
  - **At Risk** — `summary.atRisk` — styled with `bg-red-50`, `text-red-700`, `border-red-200`
  - **Upcoming** — `summary.upcoming` — styled with `bg-yellow-50`, `text-yellow-700`, `border-yellow-200`
  - **Accounts** — `summary.accountsAffected` — styled with `bg-blue-50`, `text-blue-700`, `border-blue-200`
- Status indicator: red if `atRiskCount > 0`, yellow if `upcomingCount > 0` but no at-risk, green if neither
- Per at-risk record detail shows: `accountName`, `psRecordName`, `productCode`, `productName`, `productType`, `endDate`, `daysUntilExpiry`
- Special state: if no `lastAnalyzed` timestamp exists, shows yellow warning "No Analysis Data Available"
- Expandable "Show at-risk records" section for detailed view

---

## User Stories

### US-03.01 — User Sees Operational Overview on Login

**As a** deployment team member, **I want to** see a summary of validation errors, product removals, and upcoming expirations immediately after logging in **so that** I can quickly assess whether any urgent action is needed.

**Acceptance Criteria:**
- Dashboard is the default page after login (route `/`)
- All three widgets load data automatically on page load
- Data is current (fetched fresh on each visit or auto-refreshed)
- Each widget shows both a count/summary and enough detail to assess urgency
- If any widget fails to load data, it shows an error with a retry option without affecting other widgets

**Key Detail:**
- Default timeframes for first-time users: Validation = `1w`, Removals = `1w`, Expiration = `7` days
- Each widget renders its own status indicator (colored dot/badge) so urgency is visible at a glance without reading numbers

**Dependencies:** T-03.01, T-03.02, T-03.03, T-03.04, T-03.05

---

### US-03.02 — User Can Customize Dashboard Timeframes

**As a** deployment team member, **I want to** adjust the timeframe for each dashboard widget independently **so that** I can focus on the time period most relevant to my current concerns.

**Acceptance Criteria:**
- Each widget has its own timeframe/window dropdown
- Selected timeframes persist across sessions (localStorage)
- Changing a timeframe immediately refreshes that widget's data
- Default timeframes are sensible for new users (7 days for validation/removals, 30 days for expiration)

**Key Detail:**
- localStorage keys for persistence: `dashboard_validationTimeframe`, `dashboard_removalsTimeframe`, `dashboard_expirationWindow`
- Global default overrides configurable in Settings page under Application Settings, stored in: `defaultDashboardValidationTimeframe`, `defaultDashboardRemovalsTimeframe`, `defaultDashboardExpirationWindow`

**Dependencies:** T-03.02, T-03.03, T-03.04, T-03.05

---

### US-03.03 — User Can Navigate from Dashboard to Detailed Views

**As a** deployment team member, **I want to** click on a dashboard widget to navigate to its full-featured page **so that** I can investigate issues in detail.

**Acceptance Criteria:**
- Validation Widget links to Provisioning Monitor (`/provisioning`)
- Removals Widget links to Provisioning Monitor (`/provisioning`)
- Expiration Widget links to Expiration Monitor (`/provisioning/expiration`)
- Navigation preserves the selected timeframe where applicable

**Key Detail:**
- Validation Widget "View Record" links navigate to `/provisioning?exact={recordName}` which pre-filters the provisioning table to that specific record
- Quick Links card below widgets provides additional navigation to: Provisioning Monitor, Expiration Monitor, Customer Products

**Dependencies:** T-03.03, T-03.04, T-03.05

---

### US-03.04 — User Sees Data Auto-Refresh on Dashboard

**As a** deployment team member, **I want** the dashboard data to automatically refresh at a configurable interval **so that** I always see current information without manually reloading.

**Acceptance Criteria:**
- Auto-refresh interval is configurable (e.g., 1 min, 5 min, 15 min, off)
- Auto-refresh setting persists across sessions
- Visual indicator shows when data was last refreshed
- Auto-refresh pauses when the browser tab is not active (resumes on focus)

**Key Detail:**
- Auto-refresh intervals: 0 (Never), 1, 5, 10, 15, 30 minutes; default: 5 minutes
- Configured globally via Settings page (Application Settings section) and stored in localStorage key `autoRefreshInterval`
- Dashboard registers its refresh callback via `usePageAutoRefresh` hook from `AutoRefreshContext`

**Dependencies:** T-03.02 (uses `AutoRefreshContext` from EPIC-01)
