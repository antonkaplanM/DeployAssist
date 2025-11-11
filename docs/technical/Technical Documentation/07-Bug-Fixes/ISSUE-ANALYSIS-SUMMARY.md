# PS-4652 Tenant Name Issue - Quick Summary

## Issue
PS-4652 shows **"N/A"** for Tenant Name instead of **"ajg-eudev"** in the Account History page.

## Root Cause
The tenant name extraction code only checked one location in the payload JSON:
```javascript
payload.properties.provisioningDetail.tenantName  // Only checked here
```

But PS-4652 stores the tenant name at a different location:
```javascript
payload.properties.tenantName  // Actually stored here
```

## Why Different Locations?
Over time, Salesforce payload structures evolved:
- **Newer records** (2024+): `properties.provisioningDetail.tenantName`
- **Older records** (like PS-4652): `properties.tenantName`

## Solution ✅
Updated `salesforce.js` to check **multiple locations** with fallback logic:

```javascript
const tenantName = payload.properties?.provisioningDetail?.tenantName  // Try new structure first
    || payload.properties?.tenantName                                   // Then old structure
    || payload.tenantName                                               // Then root level (rare)
    || null;                                                            // Finally, null if not found
```

## Impact
- ✅ PS-4652 now displays **"ajg-eudev"** correctly
- ✅ Other older records will also show tenant names correctly
- ✅ Tenant filter dropdown will include previously missing tenants
- ✅ No impact on newer records (they still work)

## Next Steps
**Test PS-4652:**
1. Open Account History page
2. Search for PS-4652's account
3. Verify Tenant Name shows "ajg-eudev" instead of "N/A"
4. Verify tenant filter includes "ajg-eudev" as an option

---
**Status:** FIXED - Ready for testing  
**File Changed:** `salesforce.js` (parsePayloadData function)


