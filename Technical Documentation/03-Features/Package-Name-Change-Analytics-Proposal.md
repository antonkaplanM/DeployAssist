# Package Name Change Analytics - Enhancement Proposal

**Status:** Implemented ✅  
**Target Page:** Analytics Dashboard (Sub-page)  
**Date:** October 15, 2025  
**Last Updated:** October 16, 2025

## Overview

Add a new analytics widget to the Analytics Dashboard that tracks and displays Package Name changes in PS records with Request Type "Update". This helps business users understand customer upgrade patterns and identify which accounts have changed their package names (indicating product upgrades).

## Business Goal

**Primary Objective:** Provide visibility into customer package upgrade behavior

**Key Questions Answered:**
1. How many customers have upgraded their product packages?
2. Which products are being upgraded most frequently?
3. Which accounts are making package changes?
4. What is the trend over time?

**Business Value:**
- Track product adoption and upgrade patterns
- Identify upsell/expansion opportunities
- Monitor customer engagement with newer packages
- Support revenue and customer success planning

## Proposed Solution

### High-Level Approach

For each PS record with Request Type = "Update":
1. Find the **previous PS record** with the same Deployment Number
2. Compare the `apps` section in Payload_Data__c
3. Identify if any app has:
   - **Same app name** (product)
   - **Different Package Name** (indicates upgrade)
4. Count and aggregate these changes by:
   - **Product Name** (which apps are being upgraded)
   - **Account** (which customers are upgrading)

### Data Structure

**Input Data (Per PS Record):**
```javascript
{
  Id: "a03...",
  Name: "PS-12345",
  Account__c: "Acme Corp",
  TenantRequestAction__c: "Update",
  Payload_Data__c: {
    apps: [
      {
        appName: "ExpIQ",
        packageName: "ExpIQ X3"  // Changed from "ExpIQ X2" in previous record
      }
    ]
  },
  deploymentNumber: "D-001"
}
```

### Widget Display (Proposed)

#### Option A: Two Separate Widgets

**Widget 1: Package Changes by Product**
```
┌────────────────────────────────────┐
│ Package Changes by Product        │
│ (Last 1 Year)                     │
├────────────────────────────────────┤
│ ExpIQ                    45       │
│ RMS                      23       │
│ Climate on Demand        12       │
│ Loan Loss Analyzer        8       │
│ TOTAL                    88       │
└────────────────────────────────────┘
```

**Widget 2: Package Changes by Account**
```
┌────────────────────────────────────┐
│ Top Accounts - Package Changes    │
│ (Last 1 Year)                     │
├────────────────────────────────────┤
│ Acme Corp                 8       │
│ Global Bank               5       │
│ Tech Industries           4       │
│ Finance Co                3       │
│ [View All...]                     │
└────────────────────────────────────┘
```

#### Option B: Single Consolidated Widget with Tabs

```
┌────────────────────────────────────┐
│ Package Name Changes (Last 1 Year) │
│ [By Product] [By Account]         │
├────────────────────────────────────┤
│ 88 Total Package Changes          │
│                                    │
│ By Product:                        │
│ ExpIQ                    45       │
│ RMS                      23       │
│ Climate on Demand        12       │
│ ...                               │
└────────────────────────────────────┘
```

#### Option C: Detailed Breakdown Widget

```
┌────────────────────────────────────────────────┐
│ Package Upgrade Analysis (Last 1 Year)       │
├────────────────────────────────────────────────┤
│ 88 PS Records with Package Changes           │
│ Across 42 Accounts                            │
│                                               │
│ By Product:                                   │
│ ExpIQ          45 changes (51%)               │
│ RMS            23 changes (26%)               │
│ CoD            12 changes (14%)               │
│ ...                                           │
│                                               │
│ Top Accounts:                                 │
│ Acme Corp       8 upgrades                   │
│ Global Bank     5 upgrades                   │
│ ...                                           │
└────────────────────────────────────────────────┘
```

### Time Frame Flexibility

**Default:** 1 year (365 days)

**Proposed Options:**
- Last 30 days
- Last 90 days
- Last 6 months
- Last 1 year (default)
- Last 2 years
- Custom date range

**Implementation:** Dropdown selector similar to Expiration Monitor

## Requirements Specification (APPROVED)

### 1. **Deployment Number Comparison** ✅

**APPROVED APPROACH:**
- Compare PS records with the **same Deployment Number** only
- Sort by PS record ID number (not date) to find "previous" record
  - PS record ID format: `PS-####` where #### is a consecutive number
  - Higher number = newer record (e.g., PS-4695 is newer than PS-4640)
- Compare consecutive records where:
  - Both have Status = "Tenant Request Completed"
  - Subsequent record has Type = "Update" (previous can be "New" or "Update")
- If no previous record exists, skip (no comparison possible)

**Example:** 
- Deploy-7561: PS-4640 (Type: "New") → PS-4695 (Type: "Update")
- Both have Status "Tenant Request Completed"
- Compare these two records for package changes

### 2. **App Matching Logic** ✅

**APPROVED APPROACH:**
- Match apps by **Product Name** (parsed from JSON payload, see validation rules implementation)
- **Date Range Consideration:**
  - One app name per record per date range is expected
  - If same app name appears with **different date ranges** and **different package sizes** → Count each separately
  - If same app name appears with **overlapping date ranges** → **EXCLUDE entire PS record** (invalid data)

**Valid Scenario:**
```javascript
// Previous Record (PS-4640)
[
  { productCode: "RI-RISKMODELER", packageName: "P4", startDate: "2024-01-01", endDate: "2024-12-31" }
]

// Current Record (PS-4695)
[
  { productCode: "RI-RISKMODELER", packageName: "P5", startDate: "2025-01-01", endDate: "2025-12-31" }
]

// Result: Package changed from P4 → P5 ✅
```

**Invalid Scenario (Exclude):**
```javascript
// Current Record has overlapping dates for same product
[
  { productCode: "RI-RISKMODELER", packageName: "P4", startDate: "2024-01-01", endDate: "2024-12-31" },
  { productCode: "RI-RISKMODELER", packageName: "P5", startDate: "2024-06-01", endDate: "2025-06-01" }
]

// Result: EXCLUDE this PS record (invalid - overlapping dates) ❌
```

### 3. **What Counts as a "Package Name Change"?** ✅

**APPROVED CRITERIA:**

| Scenario | Previous Package | New Package | Count as Change? |
|----------|-----------------|-------------|------------------|
| Upgrade | P4 | P5 | ✅ Yes (count as UPGRADE) |
| Downgrade | P5 | P3 | ✅ Yes (count as DOWNGRADE) |
| Different Product | RMS Base | Climate CoD C1 | ❌ No (different products) |
| Same Package | P4 | P4 | ❌ No (no change) |
| App Removed | P4 | (not present) | ❌ No (exclude) |
| App Added | (not present) | P5 | ❌ No (exclude) |
| Null → Value | null | P5 | ❌ No (exclude null values) |
| Value → Null | P4 | null | ❌ No (exclude null values) |

**Key Rules:**
1. **Both records MUST have the product** with non-null package names
2. **Same product, different package** = Package change
3. **Split tracking:**
   - Track upgrades separately (e.g., P4 → P5)
   - Track downgrades separately (e.g., P5 → P3)
   - Display both for clarity and detail
4. **Exclude:**
   - Null values
   - Added/removed apps (product must exist in both records)
   - Different products (not a package change)

### 4. **Aggregation Strategy** ✅

**APPROVED APPROACH:** Hybrid - Show both metrics

**Display Format:**
```
88 PS Records with 156 Total Package Changes
- 132 Upgrades
- 24 Downgrades
```

**Counting Logic:**
1. **PS Record Count:** Count each PS record with at least one package change (once)
   - PS-4695 has 3 package upgrades → Count PS record once
   
2. **Individual Change Count:** Count each package change separately
   - PS-4695 has 3 package upgrades → Count 3 changes
   
3. **Split by Type:**
   - Count upgrades separately
   - Count downgrades separately
   - Display both for detailed analysis

**Example:**
- PS-4695: RI-RISKMODELER (P4→P5), ExpIQ (X2→X3), RMS (Base→Premium)
- **PS Record Count:** 1
- **Individual Changes:** 3 upgrades
- **By Product:** RI-RISKMODELER (1), ExpIQ (1), RMS (1)

### 5. **Product Name Identification** ✅

**APPROVED APPROACH:**
- Parse Product Name from **JSON payload of Products**
- **Reuse existing logic** from validation rules implementation
- Extract from `productCode` field (e.g., "RI-RISKMODELER")

**Implementation Reference:**
See `validation-engine.js` for product parsing logic that should be reused:
- Parse `Payload_Data__c` JSON
- Extract products from `apps` or products array
- Use `productCode` as the primary identifier
- Map to friendly display name if needed

**Example Data Structure:**
```javascript
{
  Payload_Data__c: {
    apps: [
      {
        productCode: "RI-RISKMODELER",
        packageName: "P5",
        startDate: "2025-01-01",
        endDate: "2025-12-31"
      }
    ]
  }
}
```

### 6. **Account Identification** ✅

**APPROVED APPROACH:**
- Primary grouping by `Account__c` field
- Display top 10-15 accounts by default with "View All" option
- Include account drill-down to see specific PS records

**Widget Display:**
```
Top Accounts - Package Changes
1. Acme Corp          12 upgrades, 2 downgrades
2. Global Bank         8 upgrades, 1 downgrade
3. Tech Industries     6 upgrades, 0 downgrades
...
[View All Accounts]
```

**Future Enhancement:** 
- Consider adding MA Account SF links (like Ghost Accounts feature)
- Consider `Account_Site__c` sub-grouping for detailed analysis

### 7. **UI/UX Layout** ✅

**APPROVED APPROACH:**
- **Multiple separate widgets** for clarity and detail
- **Location:** Sub-page under Analytics section (not main dashboard)
- **Drill-down support:** Yes - reuse Account History side-by-side comparison view

**Widget Structure:**

**Widget 1: Summary Statistics**
```
┌────────────────────────────────────────┐
│ Package Change Summary                 │
│ (Last 1 Year)                         │
├────────────────────────────────────────┤
│ 88 PS Records with Package Changes    │
│ 156 Total Package Changes             │
│ - 132 Upgrades (84.6%)               │
│ - 24 Downgrades (15.4%)              │
│                                        │
│ Across 42 Accounts                    │
└────────────────────────────────────────┘
```

**Widget 2: Changes by Product**
```
┌────────────────────────────────────────┐
│ Package Changes by Product            │
├────────────────────────────────────────┤
│ Product          Upgrades  Downgrades │
│ RI-RISKMODELER      45        3       │
│ ExpIQ               32        5       │
│ RMS                 28        8       │
│ Climate on Demand   15        2       │
│ ...                                   │
└────────────────────────────────────────┘
```

**Widget 3: Top Accounts**
```
┌────────────────────────────────────────┐
│ Top Accounts - Package Changes        │
├────────────────────────────────────────┤
│ Acme Corp        12 upgrades, 2 ↓     │
│ Global Bank       8 upgrades, 1 ↓     │
│ Tech Industries   6 upgrades, 0 ↓     │
│ [View All Accounts...]                │
└────────────────────────────────────────┘
```

**Widget 4: Recent Changes (Optional)**
```
┌────────────────────────────────────────┐
│ Recent Package Changes                 │
├────────────────────────────────────────┤
│ PS-4695  Acme Corp                    │
│ Deploy-7561  RI-RISKMODELER P4→P5    │
│ [View Details]                        │
└────────────────────────────────────────┘
```

### 8. **Request Type Filtering** ✅

**APPROVED CRITERIA:**
- **Subsequent record** must have Type = "**Update**" (from TenantRequestAction__c column on Provisioning Monitor)
- **Previous record** can be Type = "New" or "Update"
- **Both records** must have Status = "**Tenant Request Completed**"

**Example (Valid):**
- PS-4640: Type "New", Status "Tenant Request Completed", Deploy-7561
- PS-4695: Type "Update", Status "Tenant Request Completed", Deploy-7561
- ✅ Compare these two records

**Example (Invalid - Skip):**
- PS-4640: Type "New", Status "In Progress"
- PS-4695: Type "Update", Status "Tenant Request Completed"
- ❌ Do not compare (previous record not completed)

**Note:** This represents updates that are upgrades - the "Update" type indicates a change to existing deployment.

### 9. **Data Refresh Strategy** ✅

**APPROVED APPROACH:** Pre-calculated with on-demand refresh

**Implementation:**
- Similar to **Expiration Monitor** approach
- Store analysis results in database
- Manual refresh button to recalculate
- Display last analysis timestamp

**Benefits:**
- Fast page load times
- Reduced Salesforce API calls
- Sufficient for this use case (historical analysis)

**User Flow:**
1. Navigate to Package Changes sub-page
2. View cached analysis results (with timestamp)
3. Click "Refresh Analysis" to recalculate
4. Analysis runs in background (may take 30-60 seconds)
5. Results updated and displayed

**Database Schema:**
```sql
CREATE TABLE package_change_analysis (
    id SERIAL PRIMARY KEY,
    analysis_date TIMESTAMP,
    ps_record_id VARCHAR(50),
    ps_record_name VARCHAR(100),
    previous_ps_record_id VARCHAR(50),
    previous_ps_record_name VARCHAR(100),
    deployment_number VARCHAR(100),
    tenant_name VARCHAR(255), -- Added: Extracted from payload
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    account_site VARCHAR(255),
    product_code VARCHAR(100),
    product_name VARCHAR(255),
    previous_package VARCHAR(100),
    new_package VARCHAR(100),
    change_type VARCHAR(20), -- 'upgrade' or 'downgrade'
    previous_start_date DATE,
    previous_end_date DATE,
    new_start_date DATE,
    new_end_date DATE,
    ps_created_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tenant Name Integration:**
- Tenant name is extracted from the payload using the same logic as Account History page
- Multiple fallback locations:
  - `properties.provisioningDetail.tenantName`
  - `properties.tenantName`
  - `preferredSubdomain1` / `preferredSubdomain2`
  - `Tenant_Name__c` (Salesforce field)
- Displayed alongside deployment number in all views (e.g., "Deploy-7186 (mycompany-prod)")
- Included in Excel exports for easy identification of environments

### 10. **Edge Cases & Error Handling** ✅

**APPROVED HANDLING:**

1. **No previous record exists** (First record for deployment)
   - ✅ **Skip** - Cannot compare, no package change detected
   - Log for debugging: "No previous record found for Deploy-XXXX, PS-YYYY"

2. **Missing Payload_Data__c**
   - ✅ **Skip** - Cannot analyze without payload data
   - Log for debugging: "Missing payload data for PS-YYYY"

3. **Malformed payload data**
   - ✅ **Skip gracefully** with error logging
   - Try-catch JSON parsing
   - Log specific parsing errors for investigation
   - Continue processing other records

4. **Multiple Updates on same day**
   - ✅ Use **PS record ID number** to determine order (higher = newer)
   - Example: PS-4640 < PS-4695 (compare in this order)
   - Dates are not used for ordering

5. **Overlapping date ranges for same product** (Invalid data)
   - ✅ **Exclude entire PS record** from analysis
   - Log for investigation: "Invalid data - overlapping dates for PS-YYYY"

6. **Status not "Tenant Request Completed"**
   - ✅ **Skip** - Only analyze completed requests
   - Filter query to only fetch completed requests

**Error Logging:**
All skipped/excluded records should be logged to console with reason code for troubleshooting and data quality monitoring.

## Technical Implementation Plan (Pending Clarification)

### Backend Changes

1. **New API Endpoint:** `GET /api/analytics/package-changes`
   - Query parameters: `startDate`, `endDate`, `groupBy` (product/account)
   
2. **New Salesforce Function:** `getPackageNameChangeAnalytics()`
   - Fetch Update requests in date range
   - Group by Deployment Number
   - Compare consecutive records
   - Identify package changes
   - Aggregate by product and account

3. **Database (Optional):** 
   - If using cached approach, create table `package_change_analysis`

### Frontend Changes

1. **Analytics Dashboard HTML:**
   - Add new widget section
   - Include time frame selector
   - Add product/account breakdown tables

2. **JavaScript:**
   - Fetch package change data
   - Render widget with counts
   - Handle time frame changes
   - Support drill-down (optional)

3. **Styling:**
   - Match existing Analytics Dashboard theme
   - Color-code products (optional)
   - Responsive design for mobile

### Testing Requirements

1. **Unit Tests:**
   - Package change detection logic
   - App matching algorithm
   - Aggregation calculations

2. **Integration Tests:**
   - API endpoint functionality
   - Salesforce data fetching
   - Time frame filtering

3. **E2E Tests:**
   - Widget displays correctly
   - Time frame selector works
   - Data accuracy verification

## Estimated Effort

**Complexity:** Medium-High

**Estimated Time:**
- Backend development: 4-6 hours
- Frontend development: 3-4 hours
- Testing: 2-3 hours
- Documentation: 1-2 hours
- **Total:** 10-15 hours

**Dependencies:**
- Access to Salesforce PS records
- Understanding of Payload_Data__c structure
- Clarification on business logic questions

## Implementation Plan

### Phase 1: Backend Development (4-6 hours)

1. **Database Schema**
   - Create `package_change_analysis` table
   - Create `package_change_analysis_log` table (for tracking refresh history)
   - Add indexes for performance

2. **Salesforce Integration** (`salesforce.js`)
   - New function: `analyzePackageChanges(lookbackYears, startDate, endDate)`
   - Query PS records with Status = "Tenant Request Completed"
   - Group by Deployment Number
   - Sort by PS record ID (extract number from PS-####)
   - Compare consecutive records using validation rules product parsing logic
   - Detect upgrades vs downgrades
   - Handle edge cases (overlapping dates, missing data, etc.)

3. **Database Functions** (`database.js`)
   - `clearPackageChangeCache()` - Clear old analysis data
   - `insertPackageChangeData(changes)` - Store analysis results
   - `logPackageChangeAnalysis(metadata)` - Log refresh history
   - `getPackageChangeSummary(timeFrame)` - Get summary statistics
   - `getPackageChangesByProduct(timeFrame)` - Group by product
   - `getPackageChangesByAccount(timeFrame)` - Group by account
   - `getRecentPackageChanges(limit)` - Get recent changes

4. **API Endpoints** (`app.js`)
   - `GET /api/analytics/package-changes/summary` - Summary stats
   - `GET /api/analytics/package-changes/by-product` - Product breakdown
   - `GET /api/analytics/package-changes/by-account` - Account breakdown
   - `GET /api/analytics/package-changes/recent` - Recent changes list
   - `POST /api/analytics/package-changes/refresh` - Trigger analysis
   - `GET /api/analytics/package-changes/status` - Get last analysis info

### Phase 2: Frontend Development (3-4 hours)

1. **Navigation Updates** (`public/index.html`)
   - Add "Package Changes" sub-navigation item under Analytics
   - Wire up navigation event handlers

2. **New Sub-page** (`public/index.html`)
   - Create `page-analytics-package-changes` section
   - Add time frame selector (30d, 90d, 6m, 1y, 2y)
   - Add refresh button with loading state
   - Display last analysis timestamp

3. **Widgets** (`public/script.js`)
   - Summary Statistics widget
   - Changes by Product table (with upgrade/downgrade split)
   - Top Accounts table (with upgrade/downgrade counts)
   - Recent Changes list
   - Error handling and loading states

4. **Comparison View Integration**
   - Add "View Details" button for each change
   - Reuse Account History side-by-side comparison modal
   - Pass PS record IDs to comparison view
   - Highlight package differences in comparison

### Phase 3: Testing (2-3 hours) ✅ COMPLETED

1. **Backend Unit Tests** (`tests/unit/`)
   - ⚠️ Deferred - Can be added following existing patterns
   - Test PS record ID sorting logic
   - Test product parsing and matching
   - Test upgrade vs downgrade detection
   - Test overlapping date range detection
   - Test edge case handling

2. **API Integration Tests** (`tests/integration/package-changes-api.spec.js`) ✅
   - ✅ Test all 6 API endpoints (status, summary, by-product, by-account, recent, refresh, export)
   - ✅ Test refresh workflow with custom parameters
   - ✅ Test error responses and auth handling
   - ✅ Test time frame filtering (30d, 90d, 6m, 1y, 2y)
   - ✅ Test tenant name integration in hierarchical data
   - ✅ Test data integrity (unique combinations, consistent counts, date validation)
   - ✅ Test counting logic (upgrades + downgrades = total)
   - ✅ Test Excel export with timeFrame parameter

3. **E2E Tests** (`tests/e2e/package-changes.spec.ts`) ✅
   - ✅ Test navigation to Package Changes page
   - ✅ Test modern gradient tile design for all 6 summary cards
   - ✅ Test widget display and data loading
   - ✅ Test time frame selector (30d, 90d, 6m, 1y, 2y)
   - ✅ Test refresh and export button functionality
   - ✅ Test expandable account hierarchy (Account → Deployment → Product)
   - ✅ Test tenant names displayed in deployments and recent changes
   - ✅ Test hierarchical indentation visualization
   - ✅ Test upgrade (green) and downgrade (amber) color coding
   - ✅ Test all table headers and structures
   - ✅ Test page load performance

**Test Coverage Summary:**
- Integration Tests: 30+ test cases covering all API endpoints and data integrity
- E2E Tests: 20+ test cases covering UI/UX, navigation, and visual design
- Total: 50+ comprehensive test cases ensuring feature reliability

### Phase 4: Documentation (1-2 hours)

1. **Feature Documentation**
   - Create `Package-Name-Change-Analytics-Feature.md`
   - Document how to use the feature
   - Include screenshot examples
   - Explain business metrics

2. **Technical Documentation**
   - Document database schema
   - Document API endpoints
   - Document comparison algorithm
   - Include troubleshooting guide

3. **Update Related Docs**
   - Update Analytics overview
   - Update navigation guide
   - Add to CHANGELOG

## Next Steps - READY TO PROCEED

✅ **All requirements have been clarified and approved**

**To begin implementation, please confirm:**
1. Does the implementation plan look correct?
2. Are there any additional requirements or modifications needed?
3. Should I proceed with implementation now?

**Reference Example:**
- Deployment: deploy-7561
- Previous: PS-4640 (Type: "New", Status: "Tenant Request Completed")
- Current: PS-4695 (Type: "Update", Status: "Tenant Request Completed")
- Change: RI-RISKMODELER package upgraded from P4 → P5

## Related Documentation

- [Analytics-Validation-Integration.md](./Analytics-Validation-Integration.md) - Current analytics implementation
- [Customer-Products-Feature.md](./Customer-Products-Feature.md) - Similar product tracking feature
- [Packages-Integration-Summary.md](../05-Integrations/Packages-Integration-Summary.md) - Package data structure

---

**Questions or feedback?** Please review the clarifying questions above and provide guidance on the preferred approach.

