# Current Accounts Feature

## Overview

The Current Accounts page is a sub-page under the Analytics section that provides a comprehensive view of all active tenant accounts. It consolidates data from Salesforce (PS Records) and SML (Service Management Layer) to display key information about tenants and their entitlements.

## Features

- **Consolidated View**: One table showing all tenant accounts with their apps
- **Sortable Columns**: Click any column header to sort data
- **Search**: Filter accounts by client, services, tenant name, or CSM/Owner
- **Editable Comments**: Click to add/edit comments (preserved during sync)
- **Quick Sync**: Fast sync that only adds new tenants
- **Full Sync**: Comprehensive sync that updates all records
- **CSV Export**: Download data for offline analysis
- **Publish to Confluence**: Publish table to Confluence page for sharing
- **Removed Records**: Option to view removed/inactive accounts
- **Truncated Columns**: Column values are limited to 20 characters with ellipsis (…) and tooltip for full text
- **PS Record Products Modal**: Click on PS Record badge to view all products (Models, Data, Apps) with collapsible categories
- **Payload Viewer**: Click JSON badge to view raw payload data with syntax highlighting

## Data Model

### Table: `current_accounts`

| Column | Type | Description |
|--------|------|-------------|
| `client` | VARCHAR(255) | Account name (same as Account__c on Provisioning Monitor) |
| `services` | VARCHAR(255) | App name - one app per row |
| `account_type` | VARCHAR(50) | 'POC' (longest entitlement < 90 days) or 'Subscription' (longest entitlement ≥ 90 days) |
| `csm_owner` | VARCHAR(255) | CreatedBy.Name from Provisioning Monitor |
| `provisioning_status` | VARCHAR(100) | Status from Provisioning Monitor |
| `completion_date` | TIMESTAMP | CreatedDate from Provisioning Monitor |
| `size` | VARCHAR(255) | Package name of the app |
| `region` | VARCHAR(100) | From PS record payload "region" field |
| `tenant_name` | VARCHAR(255) | Extracted from SML payload |
| `tenant_url` | VARCHAR(500) | Derived: https://{tenant_name}.rms.com |
| `tenant_id` | VARCHAR(255) | From SML integration |
| `salesforce_account_id` | VARCHAR(100) | Salesforce Account ID |
| `initial_tenant_admin` | VARCHAR(255) | From PS payload "adminUsername" field |
| `comments` | TEXT | User-editable, preserved on sync |
| `tenant_status` | VARCHAR(50) | 'Active' (isDeleted=false) or 'Deprovisioned' (isDeleted=true) from SML |
| `record_status` | VARCHAR(50) | 'active' or 'removed' |

### Table: `current_accounts_sync_log`

Tracks sync operations with timestamps, record counts, and status.

## API Endpoints

### GET `/api/current-accounts`

Get paginated list of current accounts.

**Query Parameters:**
- `page` (default: 1) - Page number
- `pageSize` (default: 50) - Records per page
- `sortBy` (default: completion_date) - Column to sort by
- `sortOrder` (default: DESC) - Sort direction (ASC/DESC)
- `includeRemoved` (default: false) - Include removed records
- `search` - Search term

**Response:**
```json
{
    "success": true,
    "accounts": [...],
    "pagination": {
        "page": 1,
        "pageSize": 50,
        "totalCount": 500,
        "totalPages": 10
    }
}
```

### POST `/api/current-accounts/sync`

Trigger a full sync of data from Salesforce and SML. Updates all existing records and marks removed tenants.

**Response:**
```json
{
    "success": true,
    "stats": {
        "tenantsProcessed": 100,
        "recordsCreated": 250,
        "recordsUpdated": 50,
        "recordsMarkedRemoved": 5,
        "syncDuration": 45000
    }
}
```

### POST `/api/current-accounts/quick-sync`

Quick sync - only adds new tenants that don't already exist in the database. Faster than full sync as it skips updating existing records.

**Response:**
```json
{
    "success": true,
    "stats": {
        "smlTenantsRefreshed": 500,
        "existingTenants": 450,
        "newTenantsFound": 50,
        "recordsCreated": 125,
        "syncDuration": 30000
    }
}
```

### PATCH `/api/current-accounts/:id/comments`

Update comments for a specific record.

**Request Body:**
```json
{
    "comments": "Customer renewed for 2 years"
}
```

### GET `/api/current-accounts/sync-status`

Get sync status and statistics.

### POST `/api/current-accounts/publish-to-confluence`

Publish current accounts data to a Confluence page.

**Request Body:**
```json
{
    "spaceKey": "~71202084b0c0d62c364df5b68d111f1d4f9bf1",
    "pageTitle": "Current Accounts"
}
```

**Response:**
```json
{
    "success": true,
    "pageUrl": "https://yoursite.atlassian.net/wiki/spaces/.../Current+Accounts",
    "pageId": "123456",
    "title": "Current Accounts",
    "recordCount": 500,
    "created": false,
    "updated": true
}
```

### GET `/api/current-accounts/export`

Export all records as CSV.

## Sync Options

There are two sync options available:

### Full Sync
The full sync process fetches **fresh data directly from SML** and updates all records, including both **active and deprovisioned tenants**:

1. **Refresh Active SML Data**: Fetch all active tenants (isDeleted=false) and their entitlements directly from the SML API using Playwright
2. **Fetch Deprovisioned Tenants**: Fetch all deprovisioned tenants (isDeleted=true) from SML
3. **Cache Updated Data**: Store refreshed tenant data in `sml_tenant_data` table
4. **Correlate PS Records**: Find associated PS records for metadata (CSM/Owner, status, dates)
5. **Extract Apps**: Parse entitlements from SML data to get individual apps
6. **Calculate Type**: Find longest entitlement across all products (Apps, Models, Data). POC if longest term < 90 days, else Subscription
7. **Set Tenant Status**: Set `tenant_status` to 'Active' or 'Deprovisioned' based on SML isDeleted flag
8. **Upsert Records**: Insert new or update existing records
9. **Mark Removed**: Records not updated are marked as 'removed'
10. **Preserve Comments**: User comments are never overwritten

### Quick Sync (New Tenants Only)
The quick sync is optimized and only fetches data for NEW tenants:

1. **Find Existing Tenants FIRST**: Query `current_accounts` to get list of existing tenant names
2. **Fetch Tenant List Only**: Get just the tenant list from SML (fast - no entitlements)
3. **Filter New Tenants**: Identify tenants in SML that don't exist in current_accounts
4. **Fetch Details for New Only**: Only fetch entitlements/details for NEW tenants (the slow part is skipped for existing tenants)
5. **Process New Only**: Insert records only for new tenants
6. **Skip Updates**: Existing records are not modified or marked as removed

**Key Optimization**: The slow part (fetching entitlements for each tenant) is only done for new tenants, not for all tenants. This makes Quick Sync significantly faster when most tenants already exist.

**When to use Quick Sync:**
- Daily routine checks to catch newly provisioned tenants
- When you want a fast update without modifying existing data
- To add new records without risking changes to existing ones

**When to use Full Sync:**
- Periodic comprehensive refresh (weekly/monthly)
- After significant changes in source systems
- When you need to update existing records with new data

**Note**: Entitlement data (apps, models, data products) comes directly from SML, not from PS records. This ensures accuracy as PS records may have stale or different data.

## Row Granularity

Each row represents a unique combination of:
- **Client** (account name)
- **Services** (app name)
- **Tenant ID**
- **PS Record ID**

This means an account with 5 different apps will have 5 rows in the table.

## Field Sources

| Field | Source System | Source Field/Method |
|-------|--------------|---------------------|
| Client | SML (primary) / Salesforce PS (fallback) | sml_tenant_data.account_name or Account__c |
| Services | SML (direct) | extensionData.appEntitlements.productCode |
| Type | Calculated | Based on app startDate/endDate term |
| CSM/Owner | Salesforce PS | CreatedBy.Name |
| Provisioning Status | Salesforce PS | Status__c |
| Completion Date | Salesforce PS | CreatedDate |
| Size | SML (direct) | extensionData.appEntitlements.packageName |
| Region | Salesforce PS Payload | payload.region |
| Tenant Name | SML (direct) | tenant.tenantName |
| Tenant URL | Derived | https://{tenant_name}.rms.com |
| Tenant ID | SML (direct) | tenant.tenantId |
| SF Account ID | Salesforce PS Payload | payload.accountId |
| Initial Tenant Admin | Salesforce PS Payload | payload.adminUsername |
| Tenant Status | SML (direct) | 'Active' if isDeleted=false, 'Deprovisioned' if isDeleted=true |
| Comments | Database | User input (preserved) |

**Data freshness**: SML data is fetched fresh from the SML API during each sync. PS record metadata is retrieved from the cached `ps_audit_trail` table.

## Files

### Backend
- `database/init-scripts/16-current-accounts.sql` - Database schema
- `services/current-accounts.service.js` - Business logic & sync
- `services/confluence.service.js` - Confluence API integration for publishing
- `routes/current-accounts.routes.js` - API endpoints

### Frontend
- `frontend/src/pages/CurrentAccounts.jsx` - Page component
- `frontend/src/services/currentAccountsService.js` - API service
- `frontend/src/components/features/PSRecordProductsModal.jsx` - Modal for viewing PS record products

### Configuration
- `frontend/src/App.jsx` - Route definition
- `frontend/src/components/layout/Sidebar.jsx` - Navigation item
- `app.js` - Route registration

## Usage

### Accessing the Page
1. Navigate to **Analytics** in the sidebar
2. Click **Current Accounts**

### Syncing Data

**Quick Sync (Recommended for daily use):**
1. Click the **Quick Sync** button (green)
2. Confirm the operation
3. Only new tenants will be added (faster)

**Full Sync (Comprehensive refresh):**
1. Click the **Full Sync** button (amber)
2. Confirm the operation
3. Wait for sync to complete (may take several minutes)

### Adding Comments
1. Click on the Comments cell for any row
2. Type your comment
3. Press Enter or click the checkmark to save
4. Press Escape to cancel

### Viewing Truncated Values
For readability, column values are limited to 20 characters. If a value exceeds this limit:
1. The text displays with an ellipsis (…) at the end
2. Hover over the cell to see a tooltip with the full value
3. The cursor changes to a help icon to indicate a tooltip is available

### Viewing PS Record Products
Click on any PS Record badge to view all products associated with that provisioning request:
1. Click on the purple PS Record badge in any row
2. A modal opens showing all products organized by category:
   - **Model Entitlements** (blue) - Analytical models
   - **Data Entitlements** (green) - Data feeds and datasets
   - **App Entitlements** (purple) - Application products with package info
3. Each category is collapsible - click the header to expand/collapse
4. For App entitlements, click the info icon next to Package Name to view package details

### Viewing Raw Payload Data
Click on the JSON badge in the Payload column to view the raw JSON payload:
1. Click on the gray "JSON" badge in the Payload column
2. A modal opens displaying the complete raw JSON payload with syntax highlighting
3. Use the "Copy" button to copy the JSON to clipboard
4. The modal shows line count and file size at the bottom

### Exporting Data
1. Apply any desired filters/search
2. Click **Export CSV**
3. File downloads automatically

### Publishing to Confluence
1. Ensure you have data synced
2. Click the **Publish to Confluence** button (indigo)
3. Confirm the operation
4. A success banner will appear with a link to view the page
5. The page will be created if it doesn't exist, or updated if it does

**Note:** Publishing to Confluence requires Atlassian API credentials configured in environment variables:
- `ATLASSIAN_EMAIL`
- `ATLASSIAN_API_TOKEN`
- `ATLASSIAN_SITE_URL`

## Performance Considerations

- **Pagination**: Default 50 records per page
- **Indexes**: Created on frequently queried columns
- **Sync Performance**: The sync fetches data from SML for each tenant, expect 5-15 minutes for several hundred tenants
- **SML API Calls**: Each tenant requires a Playwright browser request to SML
- **Export Limit**: Maximum 10,000 records for export

## Troubleshooting

### No Data Showing
1. Run the sync operation to populate data (this will fetch fresh SML data)
2. Check browser console for API errors
3. Verify the `current_accounts` table has data

### Sync Fails
1. Check server logs for detailed error messages
2. **Verify SML token is valid**: The sync requires a valid SML bearer token
   - Check token status in Settings → Integrations → SML
   - Refresh token if expired: `npm run sml:refresh`
3. Verify Salesforce connectivity for PS record metadata
4. Ensure database tables exist (run migration)

### SML Token Expired
The sync fetches data directly from SML and requires a valid token:
1. Navigate to Settings → Integrations → SML
2. Click "Refresh Token" or run `npm run sml:refresh`
3. Retry the sync operation (no server restart required - config is reloaded automatically)

### Comments Not Saving
1. Check network tab for API response
2. Verify user is authenticated
3. Check for database write permissions

