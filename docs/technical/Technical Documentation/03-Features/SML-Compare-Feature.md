# SML Compare Feature

## Overview

The SML Compare feature allows users to compare Salesforce provisioning data with actual SML (Service Management Layer) tenant entitlements using a headless browser approach. This provides a side-by-side comparison to identify discrepancies between what's provisioned in Salesforce vs. what exists in the live SML system.

## Feature Location

**Provisioning Monitor Page** → Actions Menu → **SML Compare**

## How It Works

### Backend Implementation

1. **API Endpoint**: `POST /api/sml/tenant-compare`
   - Accepts a tenant name
   - Uses stored SML bearer token from Settings
   - Launches Playwright headless browser
   - Searches for the tenant across paginated results
   - Fetches complete tenant details including entitlements

2. **Playwright Integration** (`sml-service.js`)
   - `fetchTenantDetailsWithPlaywright()` - Main orchestrator
   - `_searchTenantWithPlaywright()` - Searches tenant list with pagination
   - `_fetchTenantDetailsByIdWithPlaywright()` - Fetches full tenant details
   - Handles gzip compression automatically
   - Bypasses CORS restrictions

### Frontend Implementation

1. **Components**:
   - `SMLComparisonModal.jsx` - Side-by-side comparison modal
   - Updated `ActionsMenu.jsx` - Added "SML Compare" action
   - Updated `ProvisioningRequests.jsx` - Integrated modal and handlers

2. **Services**:
   - `smlCompareService.js` - API communication layer

3. **User Flow**:
   1. User clicks "Actions" → "SML Compare" on any provisioning request
   2. System validates SML configuration exists
   3. Loading modal appears while fetching data
   4. Comparison modal displays three sections:
      - Model Entitlements
      - Data Entitlements
      - App Entitlements
   5. Each section shows:
      - **In SML Only** (green) - Exists in SML but not in Salesforce
      - **In SF Only** (red) - Exists in Salesforce but not in SML
      - **Different** (yellow) - Exists in both but with different values
      - **Match** (blue) - Perfect match between systems

## Technical Details

### Data Comparison Logic

1. **Aggregation**: Consecutive date ranges for the same product are aggregated
2. **Comparison**: Products are matched based on composite keys:
   - Models: `productCode|productModifier`
   - Data: `productCode|productModifier`
   - Apps: `productCode|packageName|quantity|productModifier`
3. **Change Detection**: Compares key attributes (dates, package names, quantities, modifiers)

### API Endpoints Used

**SML Tenant Provisioning API**:
- List Tenants: `GET /sml/tenant-provisioning/v1/tenants/`
  - Pagination support via `nextLink`
  - Filters: `includingTaskDetail=false`, `isDeleted=false`
  
- Get Tenant Details: `GET /sml/tenant-provisioning/v1/tenants/{tenantId}`
  - Query params: `expandModels=true`, `includingDetail=true`
  - Returns complete entitlement data in `extensionData`

### Error Handling

1. **SML Not Configured**: User prompted to configure SML in Settings
2. **Tenant Not Found**: Error modal displays with specific message
3. **Network Errors**: Graceful error display with retry option
4. **Loading States**: Clear loading indicator during fetch

## Prerequisites

- SML must be configured in Settings (bearer token + environment)
- User must have valid bearer token with appropriate permissions
- Playwright must be installed (`@playwright/test` package)

## Configuration

SML authentication is configured via Settings page:
1. Environment: `use1` or `euw1`
2. Bearer Token: Valid JWT token from SML

## Benefits

1. **Real-time Validation**: Compare against live SML data
2. **Discrepancy Detection**: Quickly identify differences
3. **Audit Trail**: Visual proof of system state
4. **Troubleshooting**: Helps diagnose provisioning issues

## Comparison Modal Features

- **Collapsible Sections**: Each product type can be expanded/collapsed
- **Auto-expand**: Sections with changes are open by default
- **Color Coding**: Visual distinction for different states
- **Detailed View**: Shows all attributes side-by-side
- **Summary Stats**: Total, added, removed, updated, unchanged counts

## Example Use Cases

1. **Post-Provisioning Verification**: After provisioning, verify it matches SML
2. **Troubleshooting**: Investigate why a tenant reports missing products
3. **Audit**: Document the state of entitlements at a specific time
4. **Update Validation**: Verify product updates were applied correctly

## Performance Considerations

- Uses headless browser (adds ~5-10 seconds per request)
- Searches up to 20 pages of tenants (2000 tenants max)
- Handles gzip compression for faster network transfer
- Browser lifecycle properly managed (launch/close)

## Future Enhancements

Potential improvements:
1. Cache tenant search results
2. Parallel searches for better performance
3. Export comparison results to CSV
4. Historical comparison tracking
5. Bulk comparison for multiple tenants

## Related Files

**Backend**:
- `sml-routes.js` - API route handler
- `sml-service.js` - Playwright implementation

**Frontend**:
- `frontend/src/components/features/SMLComparisonModal.jsx`
- `frontend/src/components/common/ActionsMenu.jsx`
- `frontend/src/pages/ProvisioningRequests.jsx`
- `frontend/src/services/smlCompareService.js`

## Testing

To test the feature:
1. Configure SML in Settings
2. Navigate to Provisioning Monitor
3. Find a provisioning request with entitlements
4. Click Actions → SML Compare
5. Wait for modal to load
6. Review comparison results

## Expansion Pack Handling

SML may nest expansion pack entitlements inside their parent entitlement objects rather than listing them as separate top-level entries. For example:

```json
{
  "productCode": "RI-RISKMODELER",
  "expansionPacks": [
    {
      "productCode": "RI-RISKMODELER-EXPANSION",
      "packageName": "P6 Expansion Pack",
      "quantity": 1,
      "startDate": "2025-10-22",
      "endDate": "2025-12-22"
    }
  ],
  "startDate": "2025-09-30",
  "endDate": "2027-05-31"
}
```

All parsing functions automatically **flatten** nested `expansionPacks` arrays into the top-level entitlement list. This means expansion packs are:
- Included in entitlement counts
- Visible in the SML comparison modal
- Compared against Salesforce payload data
- Considered in ghost account analysis and deprovision validation

The flattening is applied consistently across all parsing locations:
- `excel-lookup.service.js` (`_normalizeEntitlements` / `_flattenExpansionPacks`)
- `SMLComparisonModal.jsx` (`flattenExpansionPacks` helper)
- `current-accounts.service.js` (`_flattenExpansionPacks`)
- `sml-validation-helper.js` (`_flattenExpansionPacks`)
- `sml-ghost-accounts.service.js` (`_flattenExpansionPacks`)

## Known Limitations

1. Bearer tokens expire (typically 1 hour) - users must refresh in Settings
2. Large tenant lists may take longer to search
3. Requires active network connection
4. Cross-tenant access depends on token permissions

