# EPIC-06: Current Accounts Sub-Page

## Epic Description

Build the Current Accounts sub-page that provides a comprehensive, searchable view of all currently active tenant accounts, with capabilities for data synchronization from SML, quick sync, Excel-based updates, editable comments, Confluence publishing, and data export.

**Business Value:** The Current Accounts page serves as the single source of truth for the team's active account roster. By consolidating data from SML with the ability to annotate and publish, it eliminates manual account tracking and ensures the entire team works from the same up-to-date list.

**Dependencies:** EPIC-01 (Infrastructure), EPIC-02 (Data Sources — SML integration, Microsoft Graph for Excel, Confluence for publishing)

---

## Tasks

### T-06.01 — Implement Current Accounts Database Tables

**Description:** Create the database tables for storing current accounts data and sync history.

**Acceptance Criteria:**
- `current_accounts` table: `id` (serial PK), `account_name` (varchar), `tenant_id` (varchar), `region` (varchar), `status` (varchar), `product_count` (integer), `comments` (text), `last_synced_at` (timestamp), `created_at` (timestamp), `updated_at` (timestamp) — plus additional fields for account metadata
- `current_accounts_sync_log` table: `id` (serial PK), `sync_type` (varchar: 'full', 'quick'), `status` (varchar), `records_processed` (integer), `records_updated` (integer), `started_at` (timestamp), `completed_at` (timestamp), `error_message` (text)
- Indexes on `account_name`, `tenant_id`, `region`

**Key Detail:**
- The `current_accounts` table has significantly more columns than the basic schema above. The full column set (matching the frontend table) includes: `client`, `services`, `account_type`, `csm_owner`, `ps_record_name`, `payload` (jsonb for raw data), `completion_date`, `size`, `region`, `tenant_name`, `tenant_url`, `tenant_id`, `salesforce_account_id`, `initial_tenant_admin`, `tenant_status`, `comments`
- `account_type` values: `POC`, `Subscription` (displayed as badges)
- `tenant_status` values: `Active`, `Deprovisioned` (displayed as badges)

---

### T-06.02 — Implement Current Accounts Service (Backend)

**Description:** Build the backend `CurrentAccountsService` that manages the current accounts data.

**Acceptance Criteria:**
- `CurrentAccountsService` with methods:
  - `list(params)` — list accounts with search, sort, pagination
  - `getSyncStatus()` — returns last sync time, sync log
  - `sync()` — full sync from SML (fetch all tenant data, upsert accounts)
  - `quickSync()` — incremental sync (only changed records)
  - `updateComments(id, comments)` — updates user comments on an account
  - `publishToConfluence()` — formats and publishes account list to Confluence page
  - `export()` — generates Excel export of current accounts
- Full sync fetches all tenant data from SML across configured regions
- Quick sync checks for changes since last sync
- Sync operations logged in `current_accounts_sync_log`

**Key Detail:**
- `list()` default parameters: `page=1`, `pageSize=50`, `sortBy='completion_date'`, `sortOrder='DESC'`, `includeRemoved=false`, `search=''`
- `publishToConfluence()` fetches all active accounts (up to 10,000, no pagination) sorted by `completion_date` DESC with `includeRemoved: false`; uses `confluenceService.generateCurrentAccountsHTML()` and `confluenceService.publishPage()`
- Confluence publish response: `{ success, pageUrl, pageId, title, recordCount, created, updated }`

---

### T-06.03 — Implement Current Accounts API Routes

**Description:** Create the API routes for current accounts operations.

**Acceptance Criteria:**
- `GET /api/current-accounts` — list accounts (params: search, sort, page, pageSize)
- `GET /api/current-accounts/sync-status` — returns sync status and history
- `POST /api/current-accounts/sync` — triggers full sync
- `POST /api/current-accounts/quick-sync` — triggers quick sync
- `PATCH /api/current-accounts/:id/comments` — updates comments for an account
- `POST /api/current-accounts/publish-to-confluence` — publishes to Confluence
- `GET /api/current-accounts/export` — downloads Excel file
- Excel-related routes for Microsoft Graph integration:
  - `GET /api/current-accounts/excel-status` — checks Excel file connection status
  - `POST /api/current-accounts/excel-update` — updates accounts from Excel file
- All routes require authentication (+ Salesforce connection for some)

**Key Detail:**
- Additional query parameters for `GET /api/current-accounts`: `sortBy`, `sortOrder`, `includeRemoved` (boolean)
- Additional local Excel routes: `GET /api/current-accounts/excel-validate-path`, `GET /api/current-accounts/excel-sheets`, `POST /api/current-accounts/excel-create`
- Confluence publish request body: `{ spaceKey, pageTitle, pageId }` — defaults: `pageTitle = 'Current Accounts'`
- Export accepts `includeRemoved` query parameter

---

### T-06.04 — Implement Current Accounts Service (Frontend)

**Description:** Create the frontend `currentAccountsService` module for current accounts operations.

**Acceptance Criteria:**
- `currentAccountsService.js` exports:
  - `getAccounts(params)` — fetch accounts list
  - `getSyncStatus()` — fetch sync status
  - `sync()` — trigger full sync
  - `quickSync()` — trigger quick sync
  - `updateComments(id, comments)` — update account comments
  - `publishToConfluence()` — publish to Confluence
  - `exportAccounts()` — download Excel export
- Error handling with meaningful messages

**Key Detail:**
- `getAccounts(params)` supports: `page`, `pageSize`, `sortBy`, `sortOrder`, `includeRemoved`, `search`
- `publishToConfluence(spaceKey, pageTitle)` — sends `{ spaceKey, pageTitle }` in request body
- `exportAccounts(includeRemoved)` — passes `includeRemoved` as query parameter

---

### T-06.05 — Build Current Accounts Page

**Description:** Create the `CurrentAccounts.jsx` page component with the accounts table and action toolbar.

**Acceptance Criteria:**
- Page title: "Current Accounts"
- Layout: action toolbar at top, search bar, main data table
- Action toolbar buttons:
  - "Quick Sync" — triggers incremental sync, shows progress
  - "Full Sync" — triggers full sync with confirmation (takes longer), shows progress
  - "Excel Update" — opens ExcelConfigModal for Excel-based data update
  - "Publish to Confluence" — publishes current data to Confluence
  - "Export" — downloads Excel file
- Data table with columns: Account Name, Tenant ID, Region, Status, Product Count, Comments, Last Synced
- All columns sortable
- Search bar filters by account name or tenant ID
- Pagination controls
- Last sync timestamp displayed in toolbar
- Auto-refresh support
- Page registered with permission name `analytics.current_accounts`

**Key Detail:**
- Exact column definitions (16 columns in order):

| # | Column Key | Label | Sortable | Special Rendering |
|---|-----------|-------|----------|-------------------|
| 1 | `client` | Client | Yes | Plain text |
| 2 | `services` | Services | Yes | Plain text |
| 3 | `account_type` | Type | Yes | Badge — POC (amber), Subscription (green); subscript "(Calculated Best Guess)" |
| 4 | `csm_owner` | CSM/Owner | Yes | Plain text |
| 5 | `ps_record_name` | PS Record | Yes | Clickable badge that opens `PSRecordProductsModal` |
| 6 | `payload` | Payload | No | "JSON" button that opens `RawDataModal` |
| 7 | `completion_date` | Completion Date | Yes | Date formatted |
| 8 | `size` | Size | Yes | Plain text |
| 9 | `region` | Region | Yes | Plain text |
| 10 | `tenant_name` | Tenant Name | Yes | Plain text |
| 11 | `tenant_url` | Tenant URL | No | Clickable link with "Open" text and external icon |
| 12 | `tenant_id` | Tenant ID | Yes | Plain text |
| 13 | `salesforce_account_id` | SF Account ID | Yes | Plain text |
| 14 | `initial_tenant_admin` | Initial Tenant Admin | Yes | Plain text |
| 15 | `tenant_status` | Status | Yes | Badge — Active (green), Deprovisioned (red) |
| 16 | `comments` | Comments | No | Editable (inline editing); truncated at `MAX_CELL_CHARS` (20 characters) |

- Cell text truncation: `MAX_CELL_CHARS = 20` — longer values truncated with tooltip showing full text
- Toolbar layout (left to right): Search input ("Search by client, services, tenant..."), "Include Removed" checkbox, Refresh button, Quick Sync (emerald), Full Sync (amber), Update Excel (blue), Publish to Confluence (indigo)
- Default sort: `completion_date` DESC
- Default page size: 50

---

### T-06.06 — Implement Editable Comments for Accounts

**Description:** Add inline editing capability for the Comments column in the accounts table.

**Acceptance Criteria:**
- Comments column shows current comment text (truncated if long)
- Clicking on a comment cell enters edit mode (inline text area)
- Save on blur or Enter key
- Cancel on Escape key
- Saves to backend via `PATCH /api/current-accounts/:id/comments`
- Success/error toast on save
- Optimistic update (show new value immediately, revert on error)

**Key Detail:**
- Edit mode triggered by `startEditing(account)` which sets `editingId` and `editValue` state
- Edit control: inline input field with check icon (save) and X icon (cancel)
- Keyboard bindings: Enter = save, Escape = cancel
- Empty state: shows "Click to add..." placeholder text
- Truncation: text truncated at 20 characters in view mode with full text available via tooltip
- Request body: `{ comments: string }`

---

### T-06.07 — Build Excel Config Modal Component

**Description:** Create the `ExcelConfigModal` component for configuring and executing Excel-based account data updates.

**Acceptance Criteria:**
- Modal for configuring the Microsoft Graph/OneDrive Excel integration
- Shows current connection status (connected/disconnected)
- Microsoft login button if not connected (initiates OAuth flow)
- File picker or path input for selecting the Excel file on OneDrive
- Preview of data before import
- "Update" button to apply Excel data to current accounts
- Progress indicator during update
- Summary of changes applied (new, updated, unchanged records)

**Key Detail:**
- Two main modes: **OneDrive** and **Local File**
- OneDrive sub-tabs: Recent (last used file, worksheet selector, "Create new worksheet..."), My Files (file list with filter), Shared (file list, "Add file by sharing link"), Create (File Name, Sheet Name fields)
- OneDrive API endpoints: `/api/auth/microsoft/status`, `/api/auth/microsoft/list-personal`, `/api/auth/microsoft/list-shared`, `/api/auth/microsoft/worksheets`, `/api/auth/microsoft/update-excel`, `/api/auth/microsoft/create-excel`, `/api/auth/microsoft/create-worksheet`, `/api/auth/microsoft/resolve-share-link`
- Local File sub-modes: Update Existing, Create New
- Local File fields: File Path, Sheet Name
- Local File endpoints: `/api/current-accounts/excel-validate-path`, `/api/current-accounts/excel-sheets`, `/api/current-accounts/excel-update`, `/api/current-accounts/excel-create`
- Default sheet name: `"Current Accounts"`

---

### T-06.08 — Implement Confluence Publishing for Current Accounts

**Description:** Implement the Confluence publishing workflow that formats and publishes the current accounts list.

**Acceptance Criteria:**
- "Publish to Confluence" button triggers publishing workflow
- Confirmation dialog before publishing
- Data formatted into Confluence Storage Format (structured XHTML table)
- Published to a configured Confluence page (space and page title configurable)
- Success toast with link to the published Confluence page
- Error handling for Confluence API failures

**Key Detail:**
- Frontend call: `publishToConfluence(null, 'Current Accounts')` — default page title is `'Current Accounts'`
- Backend fetches all active accounts (no pagination, up to 10,000), sorted by `completion_date` DESC, with `includeRemoved: false`
- Uses `confluenceService.generateCurrentAccountsHTML(accounts)` to format and `confluenceService.publishPage()` to publish
- Response includes: `success`, `pageUrl`, `pageId`, `title`, `recordCount`, `created` (boolean), `updated` (boolean)
- Success toast includes clickable link to the published Confluence page

---

## User Stories

### US-06.01 — User Can View All Current Accounts

**As a** deployment team member, **I want to** see a list of all currently active tenant accounts **so that** I know which accounts are in our portfolio.

**Acceptance Criteria:**
- Table displays all current accounts with key fields (name, tenant ID, region, status, product count)
- Data loads on page visit
- I can sort by any column
- I can search by account name or tenant ID
- Pagination handles large account lists

**Key Detail:**
- The full set of columns displayed (16 total): Client, Services, Type (POC/Subscription badge), CSM/Owner, PS Record (clickable), Payload (JSON viewer), Completion Date, Size, Region, Tenant Name, Tenant URL (link), Tenant ID, SF Account ID, Initial Tenant Admin, Status (Active/Deprovisioned badge), Comments (editable)
- "Include Removed" checkbox toggles visibility of deprovisioned accounts
- Default sort: Completion Date descending

**Dependencies:** T-06.04, T-06.05

---

### US-06.02 — User Can Sync Account Data from SML

**As a** deployment team member, **I want to** sync the current accounts list from SML **so that** the data reflects the latest state of tenant entitlements.

**Acceptance Criteria:**
- "Quick Sync" updates only changed records (fast, ~seconds)
- "Full Sync" refreshes all account data (slower, ~minutes)
- Progress indicator during sync
- Sync completion shows summary (records processed, updated)
- Last sync timestamp updates after successful sync
- If sync fails, error message explains the issue

**Dependencies:** T-06.02, T-06.03, T-06.05

---

### US-06.03 — User Can Add Comments to Accounts

**As a** deployment team member, **I want to** add notes or comments to individual accounts **so that** I can share context with my team (e.g., "Renewal in progress", "Contact: John Doe").

**Acceptance Criteria:**
- I can click on the Comments cell to edit it inline
- Changes save automatically when I click away
- My comments persist across page reloads and syncs
- Other team members can see my comments

**Key Detail:**
- Keyboard shortcuts: Enter = save, Escape = cancel
- Empty comments show "Click to add..." placeholder
- Comments truncated at 20 characters in the table cell; full text visible on hover via tooltip

**Dependencies:** T-06.06

---

### US-06.04 — User Can Publish Account List to Confluence

**As a** deployment team member, **I want to** publish the current accounts list to Confluence **so that** stakeholders outside the application can view the account roster.

**Acceptance Criteria:**
- One-click publish to Confluence
- Published page includes all account data in a formatted table
- Published page is updated in place (not duplicated) on subsequent publishes
- Success confirmation includes a link to the Confluence page

**Key Detail:**
- Default Confluence page title: "Current Accounts"
- Only active (non-removed) accounts are published
- Accounts sorted by completion date descending in the published page

**Dependencies:** T-06.08

---

### US-06.05 — User Can Update Accounts from Excel

**As a** deployment team member, **I want to** update account data from an Excel file on OneDrive **so that** I can incorporate data maintained in spreadsheets.

**Acceptance Criteria:**
- I can connect to my OneDrive via Microsoft login
- I can select or specify an Excel file path
- I can preview the data before applying updates
- Update shows a summary of changes (new, updated, unchanged)
- Only fields present in the Excel file are updated (others preserved)

**Key Detail:**
- Two update modes: OneDrive (via Microsoft Graph OAuth) and Local File (via file path)
- OneDrive has sub-tabs: Recent, My Files, Shared, Create
- Default worksheet name: "Current Accounts"

**Dependencies:** T-06.07

---

### US-06.06 — User Can Export Account Data to Excel

**As a** deployment team member, **I want to** export the current accounts data as an Excel file **so that** I can analyze it offline or share it with stakeholders.

**Acceptance Criteria:**
- "Export" button downloads an Excel file
- File includes all accounts with all columns
- File is named with the current date
- Export respects current search/filter (or exports all if no filter)

**Key Detail:**
- Export includes or excludes deprovisioned accounts based on the "Include Removed" checkbox state (`includeRemoved` parameter)

**Dependencies:** T-06.03, T-06.05
