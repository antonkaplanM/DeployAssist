# EPIC-09: Settings Page

## Epic Description

Build the Settings page that provides users and administrators with configuration controls for external integrations (Salesforce, SML, LLM), validation rules, Excel polling, debug configuration, theme preferences, and auto-refresh intervals. The Settings page centralizes all application configuration that is not related to user/role management.

**Business Value:** The Settings page empowers users to configure integrations and preferences without requiring environment variable changes or server restarts, reducing operational overhead and enabling self-service setup.

**Dependencies:** EPIC-01 (Infrastructure), EPIC-02 (Data Sources — Salesforce, SML, OpenAI integrations)

---

## Tasks

### T-09.01 — Implement User Settings Database Table and Service

**Description:** Create the `user_settings` table and backend service for managing per-user settings.

**Acceptance Criteria:**
- `user_settings` table: `id` (serial PK), `user_id` (integer, FK to users), `setting_type` (varchar), `setting_data` (jsonb, encrypted where sensitive), `created_at` (timestamp), `updated_at` (timestamp)
- Unique constraint on `(user_id, setting_type)`
- Setting types: `salesforce_credentials`, `llm_config`, `preferences`
- Sensitive data (API keys, tokens) encrypted with AES-256-GCM before storage

**Key Detail:**
- Actual table schema uses `setting_key` (varchar) and `setting_value` (text) instead of `setting_type` / `setting_data`
- Table includes `is_encrypted` (boolean) column to flag which values are encrypted
- Unique constraint is on `(user_id, setting_key)`

---

### T-09.02 — Implement Settings Service (Frontend)

**Description:** Create the frontend `settingsService` module for settings operations.

**Acceptance Criteria:**
- `settingsService.js` exports:
  - Salesforce: `testSalesforceConnection()`, `getSalesforceStatus()`, `disconnectSalesforce()`
  - SML: `getSmlConfig()`, `setSmlConfig(config)`, `testSmlConnection()`, `getSmlTokenStatus()`, `refreshSmlToken()`
  - LLM: `getLlmSettings()`, `saveLlmSettings(data)`, `deleteLlmSettings()`, `testLlmConnection()`
  - Salesforce per-user: `getSalesforceCredentials()`, `saveSalesforceCredentials(data)`, `deleteSalesforceCredentials()`, `testSalesforceCredentials()`
- Error handling with meaningful messages

**Key Detail:**
- Exact API endpoints:
  - Salesforce: `GET /api/test/salesforce`, `GET /api/user-settings/salesforce`, `PUT /api/user-settings/salesforce/preference`, `DELETE /api/user-settings/salesforce`, `POST /api/user-settings/salesforce/test`
  - SML: `POST /api/sml/config`, `GET /api/sml/config`, `GET /api/sml/test-connection`, `GET /api/sml/token/status`, `POST /api/sml/token/refresh`
  - LLM: `GET /api/user-settings/llm`, `PUT /api/user-settings/llm`, `DELETE /api/user-settings/llm`, `POST /api/user-settings/llm/test`
- Application settings are stored in localStorage (not on server): `theme`, `autoRefreshInterval`, `defaultAnalyticsTimeframe`, `defaultExpirationTimeframe`, `defaultPackageChangesTimeframe`, `defaultDashboardValidationTimeframe`, `defaultDashboardRemovalsTimeframe`, `defaultDashboardExpirationWindow`

---

### T-09.03 — Implement User Settings API Routes

**Description:** Create the API routes for managing user settings (LLM, Salesforce per-user credentials).

**Acceptance Criteria:**
- **LLM settings:**
  - `GET /api/user-settings/llm` — returns LLM config with masked API key
  - `PUT /api/user-settings/llm` — saves LLM config (body: `apiKey`, `model`)
  - `DELETE /api/user-settings/llm` — removes LLM config
  - `POST /api/user-settings/llm/test` — tests LLM connection with stored key
- **Salesforce per-user settings (covered in EPIC-02 but listed for completeness):**
  - OAuth routes and credential management at `/api/user-settings/salesforce`
- All routes require authentication

**Key Detail:**
- LLM test endpoint rate limited: 5 requests per minute
- LLM save request body: `{ apiKey?: string, model?: string }`
- LLM get response: API key is masked (only last 4 characters visible)

---

### T-09.04 — Build Settings Page Container

**Description:** Create the `Settings.jsx` page component with tabbed or sectioned layout for all configuration areas.

**Acceptance Criteria:**
- Page title: "Settings"
- Layout: vertical sections or tabbed interface grouping related settings
- Sections:
  1. Salesforce Connection
  2. SML Configuration
  3. Validation Rules
  4. LLM Configuration (for Custom Reports AI)
  5. Excel Polling
  6. Debug Configuration
  7. Theme & Appearance
  8. Auto-Refresh
- Each section is independently savable
- Loading states per section during data fetch
- Page registered with permission name `settings`

**Key Detail:**
- Actual implemented sections (sidebar navigation):
  1. **Web Connectivity** — network connectivity test
  2. **Data Sources** (parent with children):
     - **Salesforce** — Salesforce connection management
     - **AI Configuration** — LLM/OpenAI API key settings
  3. **SML Configuration** — SML token and connection management
  4. **Excel Polling** — OneDrive/local Excel integration settings
  5. **Debug Configuration** — diagnostics and troubleshooting info
  6. **Application Settings** — theme, auto-refresh, default timeframes (all stored in localStorage)
  7. **Notifications** — notification preferences
  8. **Validation Rules** — enable/disable validation rules

---

### T-09.05 — Build Salesforce Connection Settings Section

**Description:** Create the Salesforce connection management section of the Settings page.

**Acceptance Criteria:**
- Connection status display: Connected (with username), Disconnected, or Service Account
- **If disconnected:**
  - "Connect to Salesforce" button initiates OAuth flow (redirect to Salesforce login)
  - After successful OAuth, status updates to Connected
- **If connected:**
  - Shows connected Salesforce username
  - "Test Connection" button verifies the connection works, shows success/error result
  - "Disconnect" button removes stored credentials (with confirmation dialog)
- **Service account info:**
  - If user has `salesforce.service_account` permission, shows that service account is available as fallback
  - Preference toggle: use personal connection vs service account

---

### T-09.06 — Build SML Configuration Settings Section

**Description:** Create the SML configuration management section of the Settings page.

**Acceptance Criteria:**
- Current SML configuration display: environment (e.g., EUW1), base URL, timeout
- Token status: valid (green), expiring soon (yellow), expired (red), with expiry date/time
- Last refresh timestamp
- Action buttons:
  - "Test Connection" — tests SML API connectivity
  - "Refresh Token" — triggers Playwright-based SSO token refresh; shows progress; success/error toast
  - "Save Config" — saves SML configuration changes
- Environment selector if multiple SML environments available
- Editable fields: base URL, API timeout

---

### T-09.07 — Build Validation Rules Settings Section

**Description:** Create the validation rules configuration section of the Settings page.

**Acceptance Criteria:**
- List of all available validation rules with toggle switches (enable/disable)
- Each rule shows: name, description, category, severity
- Enabled/disabled state saved to user settings (per-user preference)
- "Reset to Defaults" button restores default rule configuration
- Changes affect which validation rules are applied on the Dashboard and Provisioning Monitor
- Success toast on save

**Key Detail:**
- Complete list of validation rules:

| Rule ID | Display Name | Category | Description / Logic |
|---------|-------------|----------|---------------------|
| `app-quantity-validation` | App Quantity Validation | product-validation | Quantity must = 1 except for `IC-DATABRIDGE` and `RI-RISKMODELER-EXPANSION` |
| `model-count-validation` | Model Count Validation | product-validation | Fails if models count > 100 |
| `entitlement-date-overlap-validation` | Entitlement Date Overlap Validation | date-validation | Same productCode with overlapping date ranges |
| `entitlement-date-gap-validation` | Entitlement Date Gap Validation | date-validation | Gaps between consecutive date ranges |
| `app-package-name-validation` | App Package Name Validation | product-validation | Apps must have packageName; exceptions: `DATAAPI-LOCINTEL`, `RI-COMETA`, `DATAAPI-BULK-GEOCODE`, `IC-RISKDATALAKE`, `IC-DATABRIDGE` |
| `deprovision-active-entitlements-check` | Deprovision Active Entitlements Check | deprovision-validation | WARNING severity — warns if deprovision request has active entitlements |

- Categories: `product-validation`, `date-validation`, `deprovision-validation`
- `deprovision-active-entitlements-check` has WARNING severity (not FAIL)
- Default enabled rules: `app-quantity-validation`, `entitlement-date-overlap-validation`, `entitlement-date-gap-validation`, `app-package-name-validation`

---

### T-09.08 — Build LLM Configuration Settings Section

**Description:** Create the LLM (OpenAI) configuration section for Custom Reports AI.

**Acceptance Criteria:**
- API key input field (masked/hidden by default, reveal toggle)
- Model selector dropdown (e.g., GPT-4, GPT-4o, GPT-3.5-turbo)
- Status: configured (green), not configured (grey)
- "Test Connection" button validates the API key by making a test call to OpenAI
- "Save" button stores the API key encrypted in user settings
- "Remove" button deletes the stored API key (with confirmation)
- Note explaining that API keys are stored encrypted and per-user
- Feature flag notice: if `ENABLE_REPORT_AI` is disabled, show appropriate message

**Key Detail:**
- Located under "Data Sources > AI Configuration" in the Settings sidebar
- LLM test endpoint: `POST /api/user-settings/llm/test` (rate limited to 5 requests/minute)
- Save endpoint: `PUT /api/user-settings/llm` with body `{ apiKey, model }`
- Get endpoint returns masked API key (only last 4 characters visible)

---

### T-09.09 — Build Excel Polling Settings Section

**Description:** Create the Excel polling configuration section for Microsoft Graph/OneDrive integration.

**Acceptance Criteria:**
- Polling status: active/inactive
- Polling interval configuration (e.g., 5 min, 15 min, 30 min, 1 hour, off)
- Microsoft connection status (connected/disconnected via OAuth)
- File path configuration for the monitored Excel file
- Last poll timestamp and result (success/error)
- "Poll Now" manual trigger button
- Start/Stop polling toggle
- Calls `/api/excel-polling/*` routes

---

### T-09.10 — Build Debug Configuration Settings Section

**Description:** Create the debug configuration section for troubleshooting and diagnostics.

**Acceptance Criteria:**
- Toggle for verbose logging
- Display of current configuration values (read-only) for diagnostics:
  - Database connection status and pool stats
  - Feature flag states (SML, Jira, Audit Trail, Expiration, Report AI)
  - MCP server status
  - Active sessions count
- "Download Debug Info" button exports a sanitized diagnostic dump (no secrets)
- Admin-only visibility for sensitive debug information

---

### T-09.11 — Build Theme & Appearance Settings Section

**Description:** Create the theme and appearance configuration section.

**Acceptance Criteria:**
- Theme selector: Light mode, Dark mode, System (follow OS preference)
- Current selection highlighted
- Changes apply immediately (no save button needed)
- Preference stored in localStorage via `ThemeContext`
- Preview of the selected theme in the settings panel itself

**Key Detail:**
- Actual theme options: `light` and `dark` only (no "System" option implemented)
- localStorage key: `theme`; default: `light`
- Located under "Application Settings" section (not a standalone section)
- Setting label: "Dark Mode" — toggle switch between light and dark

---

### T-09.12 — Build Auto-Refresh Settings Section

**Description:** Create the auto-refresh configuration section.

**Acceptance Criteria:**
- Global auto-refresh toggle: enable/disable
- Refresh interval selector: 1 min, 5 min, 15 min, 30 min
- Per-page override option (or note that per-page settings are managed on each page)
- Current auto-refresh state display for each active page
- Settings stored via `AutoRefreshContext` in localStorage

**Key Detail:**
- Located under "Application Settings" section (not a standalone section)
- Setting label: "Auto-refresh Background Pages"
- Exact interval options: Never, 1, 5, 10, 15, 30 minutes
- localStorage key: `autoRefreshInterval`; default: `5` minutes
- Affected pages: `dashboard`, `analytics`, `account-history`, `package-changes`, `provisioning`, `expiration`, `ghost-accounts`, `customer-products`, `ps-audit-trail`
- Additional Application Settings fields (all localStorage, with specific option values):
  - **Analytics Time Frame**: 1, 3, 6, 12 months (key: `defaultAnalyticsTimeframe`)
  - **Expiration Monitor Time Frame**: 30, 60, 90, 120, 180 days (key: `defaultExpirationTimeframe`)
  - **Package Changes Time Frame**: 7, 14, 30, 60, 90 days (key: `defaultPackageChangesTimeframe`)
  - **Data Validation Widget**: 1d, 1w, 1m, 1y (key: `defaultDashboardValidationTimeframe`)
  - **Product Removals Widget**: 1d, 1w, 1m, 1y (key: `defaultDashboardRemovalsTimeframe`)
  - **Expiration Monitor Widget**: 7, 30, 60, 90 days (key: `defaultDashboardExpirationWindow`)

---

## User Stories

### US-09.01 — User Can Connect Salesforce in Settings

**As a** deployment team member, **I want to** connect my Salesforce account from the Settings page **so that** I can access live provisioning data throughout the application.

**Acceptance Criteria:**
- Clear connection status visible on the Settings page
- One-click OAuth login to connect Salesforce
- Test button verifies the connection works
- Disconnect button removes my credentials
- If I disconnect, features fall back to service account (if available) or show connection required messages

**Dependencies:** T-09.02, T-09.05

---

### US-09.02 — User Can Configure SML Connection

**As a** deployment team member, **I want to** view and manage the SML connection from Settings **so that** tenant entitlement data stays accessible.

**Acceptance Criteria:**
- I can see the current SML token status (valid/expired/expiring soon)
- I can refresh the SML token when it expires
- I can test the SML connection
- I can configure the SML environment and API settings

**Dependencies:** T-09.02, T-09.06

---

### US-09.03 — User Can Configure Validation Rules

**As a** deployment team member, **I want to** enable or disable specific validation rules **so that** I only see validation results relevant to my workflow.

**Acceptance Criteria:**
- I can see all available validation rules with descriptions
- I can toggle each rule on or off
- My preferences are saved and applied to Dashboard widgets and Provisioning Monitor
- I can reset to default rules with one click

**Key Detail:**
- 6 validation rules available (see T-09.07 for full list)
- Default enabled: `app-quantity-validation`, `entitlement-date-overlap-validation`, `entitlement-date-gap-validation`, `app-package-name-validation`
- `deprovision-active-entitlements-check` is WARNING severity (distinct from FAIL rules)

**Dependencies:** T-09.07

---

### US-09.04 — User Can Set Up Their LLM API Key for Custom Reports

**As a** deployment team member, **I want to** configure my OpenAI API key in Settings **so that** I can use the AI-powered report builder.

**Acceptance Criteria:**
- I can enter my OpenAI API key (securely masked)
- I can select which model to use
- "Test Connection" verifies the key works before I start creating reports
- My API key is stored encrypted — only I can use it
- I can remove my key at any time

**Key Detail:**
- API key is masked in the UI (only last 4 characters visible)
- Test connection rate limited: 5 requests per minute
- Setting stored encrypted (AES-256-GCM) in `user_settings` table with `is_encrypted = true`

**Dependencies:** T-09.01, T-09.03, T-09.08

---

### US-09.05 — User Can Switch Theme

**As a** user, **I want to** choose between light and dark themes in Settings **so that** I can work comfortably in my preferred visual mode.

**Acceptance Criteria:**
- Theme options: Light, Dark, System
- Change applies immediately across the entire application
- Setting persists across browser sessions

**Key Detail:**
- Implemented options: Light and Dark only (no System option)
- Setting label: "Dark Mode" (toggle switch)
- Change applies immediately; no save button needed
- Stored in localStorage key `theme`

**Dependencies:** T-09.11

---

### US-09.06 — User Can Configure Auto-Refresh

**As a** user, **I want to** set the auto-refresh interval **so that** pages update automatically at a pace that suits my workflow without excessive API calls.

**Acceptance Criteria:**
- I can choose a global refresh interval (1, 5, 15, 30 minutes) or disable auto-refresh
- Setting applies to all pages that support auto-refresh
- I can see when data was last refreshed on each page

**Key Detail:**
- Full interval options: Never (0), 1, 5, 10, 15, 30 minutes
- Default: 5 minutes
- 9 pages support auto-refresh: Dashboard, Analytics Overview, Account History, Package Changes, Provisioning Monitor, Expiration Monitor, Ghost Accounts, Customer Products, PS Audit Trail

**Dependencies:** T-09.12

---

### US-09.07 — Admin Can View Debug Information

**As an** administrator, **I want to** view system diagnostics in Settings **so that** I can troubleshoot issues with database connections, integrations, or configuration.

**Acceptance Criteria:**
- Debug section shows database pool stats, feature flags, MCP status
- I can download a sanitized diagnostic dump for sharing with support
- Sensitive information (passwords, keys) is never included in debug output

**Dependencies:** T-09.10

---

### US-09.08 — User Can Configure Excel Polling

**As a** deployment team member, **I want to** configure Excel polling from OneDrive **so that** current accounts data stays in sync with our team's shared spreadsheet.

**Acceptance Criteria:**
- I can connect to Microsoft/OneDrive via OAuth
- I can specify which Excel file to monitor
- I can set the polling interval or trigger a manual poll
- I can see the last poll status and timestamp
- I can stop polling when not needed

**Dependencies:** T-09.09
