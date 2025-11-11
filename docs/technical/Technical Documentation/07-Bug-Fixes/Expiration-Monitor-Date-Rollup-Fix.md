# Expiration Monitor - Date Roll-Up Fix

**Date:** October 17, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

## Problem Description

### Reported Issue
The Expiration Monitor was showing incorrect expiration dates for product codes that have multiple line items with different end dates in the same PS record. 

**Example:**
- PS-4178 contains RI-EXPOSUREIQ with multiple line items:
  - Line 1: End Date 2025-10-24
  - Line 2: End Date 2027-10-24 (extends the product)
- **Incorrect Behavior:** System showed RI-EXPOSUREIQ as expiring in 7 days (using the nearest date 2025-10-24)
- **Expected Behavior:** System should use 2027-10-24 (the latest end date) to determine expiration

### Root Cause
The `analyzeExpirations()` function in `salesforce.js` was iterating through **each individual line item** and checking if that specific line item's end date was expiring, rather than first calculating the **maximum end date** for each product code within a PS record.

### Impact
- False positive expirations appearing on the monitor
- Products showing as expiring even when they have extension line items in the same PS record
- Inconsistent with Provisioning Monitor page, which correctly shows the maximum end date

## Solution

### Implementation
Modified the `analyzeExpirations()` function in `salesforce.js` to:

1. **Group by PS Record First** - Process each PS record separately
2. **Calculate Max End Date** - Within each PS record, group by product code and find the maximum end date
3. **Use Max Date for Expiration Check** - Check if the maximum end date is expiring (not individual line items)
4. **Consistent with Provisioning Monitor** - Matches the date roll-up logic used on the Provisioning Monitor page

### Code Changes

**File:** `salesforce.js`

**Before:**
```javascript
// Group by product code within account
const byProductCode = new Map();
accountEntitlements.forEach(ent => {
    if (!byProductCode.has(ent.productCode)) {
        byProductCode.set(ent.productCode, []);
    }
    byProductCode.get(ent.productCode).push(ent);
});

// For each product code, check for expirations
for (const [productCode, entitlements] of byProductCode) {
    entitlements.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
    
    for (let i = 0; i < entitlements.length; i++) {
        const current = entitlements[i];
        const currentEndDate = new Date(current.endDate);
        
        // Check if this entitlement is expiring...
        if (currentEndDate >= today && currentEndDate <= expirationThreshold) {
            // ... process individual line item
        }
    }
}
```

**After:**
```javascript
// Group entitlements by PS record first
const byPsRecord = new Map();
accountEntitlements.forEach(ent => {
    if (!byPsRecord.has(ent.psRecordId)) {
        byPsRecord.set(ent.psRecordId, []);
    }
    byPsRecord.get(ent.psRecordId).push(ent);
});

// Process each PS record
for (const [psRecordId, psEntitlements] of byPsRecord) {
    // Within this PS record, group by product code and find max end date
    const productCodeMaxDates = new Map();
    
    psEntitlements.forEach(ent => {
        const productCode = ent.productCode;
        const endDate = new Date(ent.endDate);
        
        if (!productCodeMaxDates.has(productCode)) {
            productCodeMaxDates.set(productCode, {
                maxEndDate: endDate,
                maxEndDateStr: ent.endDate,
                entitlement: ent
            });
        } else {
            const existing = productCodeMaxDates.get(productCode);
            if (endDate > existing.maxEndDate) {
                productCodeMaxDates.set(productCode, {
                    maxEndDate: endDate,
                    maxEndDateStr: ent.endDate,
                    entitlement: ent
                });
            }
        }
    });
    
    // Now check each product code's max end date for expiration
    for (const [productCode, productData] of productCodeMaxDates) {
        const maxEndDate = productData.maxEndDate;
        // Check if max end date is expiring...
        if (maxEndDate >= today && maxEndDate <= expirationThreshold) {
            // ... process using max date
        }
    }
}
```

### Extension Detection Update
Also updated the extension detection logic to correctly find the maximum end date for the same product code in other PS records, ensuring accurate "Extended" vs "At-Risk" status.

## Testing Verification

### Test Case: PS-4178 RI-EXPOSUREIQ
- **Setup:** PS record with multiple RI-EXPOSUREIQ line items with different end dates
- **Expected:** System should use the latest end date (2027-10-24) for expiration detection
- **Result:** ✅ Now correctly uses maximum end date

### Logic Validation
The fix reuses the same date roll-up logic that is implemented on the Provisioning Monitor page (`public/script.js` lines 3523-3551), which has been working correctly.

## Related Documentation

- [Expiration Monitor Feature Documentation](../03-Features/Expiration-Monitor-Feature.md) - Updated to include Date Roll-Up Logic section
- [Provisioning Monitor Date Roll-Up Logic](../../public/script.js#L3523-L3551) - Reference implementation

## Deployment Notes

### Steps to Apply Fix
1. Update `salesforce.js` with the new logic
2. Clear expiration monitor cache: `node setup-expiration-monitor.js`
3. Run fresh analysis: Click "Refresh Analysis" in Expiration Monitor UI
4. Verify PS records with multiple line items show correct max dates

### No Database Changes Required
The fix is logic-only; no database schema changes needed.

### Backward Compatibility
✅ Fully backward compatible - only changes how dates are calculated, not data structure.

## Related Changes

### Removed Extended Items Display (October 17, 2025)

As part of this fix, we also removed the "Show Extended" filter and extended items from the expiration monitor display:

**Rationale:**
- With the new date roll-up logic, products with multiple line items automatically use the latest date
- This makes the "extended" concept less meaningful within a single PS record
- Showing extended items across PS records adds noise without significant value
- The monitor should focus on truly at-risk products that need attention

**Changes Made:**
1. Removed "Show Extended" checkbox from UI
2. Removed "Extended" summary card (changed from 4 cards to 3)
3. Updated backend to always filter to `is_extended = false`
4. Updated all API calls to fetch only non-extended items
5. Updated documentation to reflect the simplified logic

## Future Improvements

1. Consider adding unit tests for date roll-up logic
2. Add database view that pre-calculates max dates for performance
3. Add UI indicator showing when multiple line items exist for a product code

