# SML Ghost Accounts Implementation

**Date:** November 10, 2025  
**Feature:** Alternative Data Source (SML) for Ghost Accounts Analysis  
**Status:** ✅ COMPLETE

---

## Overview

Enhanced the Ghost Accounts page to support SML as an alternative data source in addition to the existing Salesforce integration. Users can now choose between Salesforce and SML to analyze ghost accounts based on data from their selected source.

---

## What Was Implemented

### 1. Database Schema

**File:** `database/init-scripts/09-sml-tenant-data.sql`

Created two new tables:

#### `sml_tenant_data` Table
Stores tenant information synced from SML with account name mapping:
- `tenant_id` - SML tenant ID (unique identifier)
- `tenant_name` - SML tenant name  
- `account_name` - Mapped account name from existing DB tables
- `tenant_display_name` - Display name from SML
- `is_deleted` - Deletion flag from SML
- `raw_data` - Full tenant data (JSONB)
- Timestamps: `last_synced`, `created_at`, `updated_at`

#### `sml_ghost_accounts` Table
Tracks ghost accounts identified from SML data:
- `tenant_id` - SML tenant ID
- `tenant_name` - SML tenant name
- `account_name` - Mapped account name (nullable)
- `total_expired_products` - Count of expired products
- `latest_expiry_date` - Most recent expiry date
- `is_reviewed`, `reviewed_at`, `reviewed_by`, `notes` - Review tracking
- `data_source` - Always 'sml' for this table

Also added `data_source` column to existing `ghost_accounts` table (defaults to 'salesforce').

### 2. Database Functions

**File:** `database.js`

Added comprehensive database functions:

**SML Tenant Data Functions:**
- `upsertSMLTenant()` - Insert or update tenant data
- `getSMLTenants(filters)` - Get tenants with optional filtering
- `getSMLTenantById(tenantId)` - Get single tenant by ID
- `clearSMLTenants()` - Clear all tenant data for refresh
- `findAccountNameForTenant(tenantName)` - Map tenant name to account name using existing PS records

**SML Ghost Accounts Functions:**
- `upsertSMLGhostAccount()` - Insert or update ghost account
- `getSMLGhostAccounts(filters)` - Get ghost accounts with filters
- `markSMLGhostAccountReviewed()` - Mark tenant as reviewed
- `removeSMLGhostAccount()` - Remove from tracking
- `clearSMLGhostAccounts()` - Clear all ghost accounts for refresh
- `getSMLGhostAccountsSummary()` - Get summary statistics

### 3. Backend Service

**File:** `sml-ghost-accounts-service.js`

Created `SMLGhostAccountsService` class with key methods:

**Tenant Syncing:**
- `syncAllTenantsFromSML()` - Fetches all tenants from SML API and stores them locally
  - Uses Playwright for headless browser API calls
  - Handles pagination automatically
  - Attempts to map tenant names to account names
  - Returns sync statistics (total, new, updated, mapped)

- `_fetchAllTenantsWithPlaywright()` - Internal method using Playwright to fetch paginated tenant data

**Ghost Account Analysis:**
- `analyzeGhostAccounts()` - Analyzes all tenants for ghost status
  - Fetches products for each tenant from SML
  - Identifies tenants where ALL products are expired
  - Stores ghost accounts in database
  
- `_analyzeTenantForGhostStatus()` - Analyzes single tenant
  - Fetches apps, models, and data products
  - Checks if all products are expired
  - Returns ghost status and details

**Complete Workflow:**
- `refreshGhostAccountsFromSML()` - Full refresh: sync tenants + analyze
  - Step 1: Sync all tenants from SML
  - Step 2: Analyze tenants for ghost status
  - Returns comprehensive summary

**Product Fetching:**
- `getTenantExpiredProducts()` - Get expired products for specific tenant with filtering options

### 4. Backend API Endpoints

**File:** `app.js` (lines 3645-3880)

Added new REST API endpoints for SML ghost accounts:

#### `GET /api/sml-ghost-accounts`
- Fetches SML ghost accounts with optional filters
- Supports: `isReviewed`, `accountSearch`, `expiryBefore`, `expiryAfter`
- Returns: ghost accounts list + summary statistics + data source indicator

#### `POST /api/sml-ghost-accounts/refresh`
- Triggers full SML ghost accounts analysis
- Checks for SML authentication
- Syncs all tenants from SML
- Analyzes tenants for ghost status
- Returns: summary with tenant counts, mapping stats, ghost accounts found, duration

#### `POST /api/sml-ghost-accounts/:tenantId/review`
- Marks SML ghost account as reviewed
- Requires: `reviewedBy`, optional `notes`
- Updates review status and timestamps

#### `GET /api/sml-ghost-accounts/:tenantId/products`
- Fetches expired products for specific SML tenant
- Supports filtering by category and product exclusion
- Returns: product list + summary by category

#### `DELETE /api/sml-ghost-accounts/:tenantId`
- Removes SML ghost account from tracking

### 5. Frontend Updates

**File:** `frontend/src/pages/GhostAccounts.jsx`

Enhanced the Ghost Accounts page with comprehensive SML support:

**State Management:**
- Added `dataSource` state ('salesforce' or 'sml')
- Updated `useEffect` to re-fetch when data source changes

**Data Source Selector:**
- Added dropdown in filters section to switch between Salesforce and SML
- Selector positioned prominently with other filter controls

**Visual Indicators:**
- Badge next to page title showing active data source
  - Blue for Salesforce
  - Purple for SML
- Info box color changes based on data source
- Updated descriptions to explain each data source

**Dynamic API Calls:**
- `fetchGhostAccounts()` - Uses appropriate endpoint based on data source
- `handleRefreshAnalysis()` - Routes to correct refresh endpoint
- `handleMarkReviewed()` - Uses correct review endpoint
- Enhanced error handling with data source-specific messages

**Table Updates:**
- Dynamic column header: "Tenant / Account Name" for SML, "Account Name" for Salesforce
- Conditionally renders "MA Salesforce" column (only for Salesforce data)
- Handles different field names:
  - Salesforce: `account_id`, `account_name`
  - SML: `tenant_id`, `tenant_name`, optional `account_name`
- Shows tenant name with mapped account name for SML data
- Adapted "View Products" button for both sources

**User Experience:**
- Search placeholder updates based on data source
- Refresh success message shows different details for SML (includes mapping stats)
- All UI elements adapt seamlessly to selected data source

---

## Key Features

### Tenant Name to Account Name Mapping

The system automatically attempts to map SML tenant names to account names:

1. **Mapping Source:** Searches `prof_services_requests` table for matching `Tenant_Name__c`
2. **Mapping Process:** During tenant sync, each tenant name is looked up
3. **Display:** When mapped, shows both tenant name and account name in UI
4. **Fallback:** If no mapping found, shows tenant name only

### Data Source Independence

Both data sources operate independently:
- Separate database tables
- Separate API endpoints
- No data interference between sources
- Users can switch between sources seamlessly

### Performance Optimization

SML integration uses local database caching:
- All tenant data synced to local DB first
- Analysis runs on local data (not repeated API calls)
- Reduces load on SML API
- Enables faster subsequent queries

---

## Usage Workflow

### For Users:

1. **Navigate** to Ghost Accounts page
2. **Select Data Source** using dropdown (Salesforce or SML)
3. **Run Analysis** by clicking "Run Analysis" button
   - For Salesforce: Analyzes accounts from Salesforce entitlements
   - For SML: Syncs tenants from SML and analyzes product expirations
4. **View Results** in the table
5. **Review Accounts** by marking them as reviewed
6. **View Products** by clicking on product count badge

### Analysis Process (SML):

1. System fetches all tenants from SML API (paginated)
2. Attempts to map tenant names to account names
3. Stores tenant data in `sml_tenant_data` table
4. For each tenant, fetches all products (apps, models, data)
5. Identifies tenants where all products are expired
6. Stores ghost accounts in `sml_ghost_accounts` table
7. Returns summary statistics

---

## Technical Highlights

### Playwright Integration

Uses existing Playwright integration from SML service:
- Headless browser for API calls (bypasses CORS)
- Handles gzip compression automatically
- Manages authentication via Bearer token
- Supports pagination with nextLink handling

### Account Name Resolution

Smart mapping strategy:
```javascript
// Searches prof_services_requests table
SELECT DISTINCT account_name
FROM prof_services_requests
WHERE tenant_name = $1
AND account_name IS NOT NULL
ORDER BY last_modified_date DESC
LIMIT 1
```

### Ghost Detection Logic

A tenant is considered a ghost account if:
1. Has at least one product (not empty tenant)
2. ALL products have status = 'expired'
3. NO products have status = 'active'

---

## Configuration Requirements

### SML Authentication

SML must be configured before using SML ghost accounts:
1. Navigate to Settings page
2. Configure SML authentication (Bearer token)
3. Test connection
4. SML data source becomes available in Ghost Accounts

### Database Migration

Run the database migration script to create new tables:
```sql
-- Run: database/init-scripts/09-sml-tenant-data.sql
```

---

## API Response Examples

### SML Ghost Accounts List
```json
{
  "success": true,
  "ghostAccounts": [
    {
      "tenant_id": "6000009",
      "tenant_name": "mycompany-prod",
      "account_name": "My Company Inc.",
      "total_expired_products": 12,
      "latest_expiry_date": "2024-06-30",
      "is_reviewed": false,
      "data_source": "sml"
    }
  ],
  "summary": {
    "total_ghost_accounts": 5,
    "unreviewed": 3,
    "reviewed": 2
  },
  "dataSource": "sml",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

### SML Refresh Analysis
```json
{
  "success": true,
  "message": "SML ghost accounts analysis completed successfully",
  "summary": {
    "totalTenants": 150,
    "mappedTenants": 120,
    "totalAnalyzed": 150,
    "ghostAccountsFound": 5,
    "duration": 45.6
  },
  "dataSource": "sml",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

---

## Benefits

1. **Flexibility:** Choose data source based on need
2. **Comprehensive Coverage:** Analyze ghost accounts from both systems
3. **Account Mapping:** Automatic tenant-to-account name resolution
4. **Performance:** Local caching reduces API load
5. **User-Friendly:** Seamless switching between data sources
6. **Independent Operation:** No interference between data sources

---

## Future Enhancements (Optional)

- Combined view showing ghost accounts from both sources
- Comparison mode to identify discrepancies
- Bulk operations for marking multiple accounts
- Export functionality for SML ghost accounts
- Advanced filtering (by mapped/unmapped status)
- Scheduled automatic analysis

---

## Files Modified/Created

### New Files:
- `database/init-scripts/09-sml-tenant-data.sql`
- `sml-ghost-accounts-service.js`
- `Technical Documentation/03-Features/SML-Ghost-Accounts-Implementation.md`

### Modified Files:
- `database.js` - Added SML functions and exports
- `app.js` - Added SML ghost accounts API endpoints
- `frontend/src/pages/GhostAccounts.jsx` - Enhanced UI for dual data sources

---

**Implementation Status:** ✅ COMPLETE  
**Testing Required:** Manual testing of SML ghost accounts workflow  
**Documentation:** This file + inline code comments

---


