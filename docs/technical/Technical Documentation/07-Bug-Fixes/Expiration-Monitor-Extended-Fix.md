# Expiration Monitor - Extended Entitlements Fix

**Date:** October 22, 2025  
**Status:** ✅ COMPLETE

## Summary

Fixed the "Show Extended Entitlements" checkbox functionality and corrected column data display issues in the Expiration Monitor.

## Issues Fixed

### 1. ✅ Show Extended Entitlements Checkbox Not Working
**Problem:** The checkbox existed in the UI but was non-functional across all 3 layers (frontend service, API, database).

**Solution:** Updated all layers to respect the `showExtended` parameter:
- **database.js** (line 238-243): Made `is_extended` filter conditional
- **app.js** (line 1503-1512): Read `showExtended` from query parameters and pass it through
- **salesforce.js** (line 1640-1643): Pass `showExtended` parameter to database query

### 2. ✅ Expiring Products Column Not Showing Data
**Problem:** Frontend was looking for `exp.products` but backend returns `exp.expiringProducts`.

**Solution:** Updated all references in ExpirationMonitor.jsx:
- Line 101: `handleViewProducts` function
- Line 123-125: CSV export
- Line 408-431: Table rendering

### 3. ✅ Days Until Column Not Showing Data
**Problem:** Frontend was looking for `exp.daysUntilExpiry` but backend returns `exp.earliestDaysUntilExpiry`.

**Solution:** Updated all references to use correct property name.

### 4. ✅ Combined Days Until with Earliest Expiry Column
**Problem:** User wanted date and days combined like the old app.

**Solution:** 
- Merged two columns into one that displays both values
- Shows date on top line, days in smaller text below: `11/13/2025 (22 days)`
- Updated CSV export header to reflect combined column
- Updated sorting logic to work with renamed property

## Files Modified

| File | Changes |
|------|---------|
| `database.js` | Made `is_extended` filter conditional based on `showExtended` parameter |
| `app.js` | Read `showExtended` from query string and pass through to service |
| `salesforce.js` | Pass `showExtended` parameter through to database |
| `frontend/src/pages/ExpirationMonitor.jsx` | Fixed property names (`products` → `expiringProducts`, `daysUntilExpiry` → `earliestDaysUntilExpiry`), combined columns |

## Testing Instructions

### Test 1: Extended Entitlements Visibility
1. Navigate to **Provisioning → Expiration Monitor**
2. **Without checkbox checked** (default):
   - Should show only at-risk products (those without extensions)
   - PS-4215 should NOT appear (it's extended by PS-4883)
3. **Check "Show Extended Entitlements"**:
   - Should now show ALL expiring products including extended ones
   - PS-4215 should now appear with its products
   - Extended products will have `is_extended = true` in the database

### Test 2: Products Column Display
1. View the Expiration Monitor table
2. **Expiring Products column** should now show clickable counts:
   - "2 Models" (clickable)
   - "1 Data" (clickable)
   - "3 Apps" (clickable)
3. Click on any product count to open the Product Modal

### Test 3: Combined Date/Days Column
1. View the **Earliest Expiry** column
2. Should show:
   - **Top line:** Date in bold (e.g., "11/13/2025")
   - **Bottom line:** Days in smaller gray text (e.g., "(22 days)")
3. Column should be sortable by clicking header
4. Export to CSV should include combined format: "11/13/2025 (22 days)"

### Test 4: PS-4215 Specific Test
```sql
-- Check PS-4215 in database
SELECT ps_record_name, product_code, end_date, days_until_expiry, 
       is_extended, extending_ps_record_name
FROM expiration_monitor 
WHERE ps_record_name = 'PS-4215';
```

**Expected Results:**
- DATA-COD-PRO: `is_extended = true`, `extending_ps_record_name = PS-4883`
- RI-COD-STN: `is_extended = true`, `extending_ps_record_name = PS-4883`

**UI Behavior:**
- **Checkbox unchecked:** PS-4215 does NOT appear (filtered out)
- **Checkbox checked:** PS-4215 DOES appear with 2 products

## Why PS-4215 Was "Missing"

PS-4215 was not broken or missing - it was **correctly filtered out** because:

1. ✅ PS-4215 has products expiring in 22 days (DATA-COD-PRO, RI-COD-STN)
2. ✅ PS-4883 extends those products with later end dates (1 year later)
3. ✅ The system marked them as `is_extended = true`
4. ✅ The Expiration Monitor was designed to only show at-risk products (not extended)

**The products are safe** - they've been renewed by PS-4883, so they don't need urgent attention.

## Database Evidence

From the investigation:

```
PS-4215 Products:
  Product 1: DATA-COD-PRO
    End Date: Thu Nov 13 2025 (22 days)
    Is Extended: ✅ YES
    Extended By: PS-4883
    Extended End Date: Fri Nov 13 2026 (1 year later)

  Product 2: RI-COD-STN
    End Date: Thu Nov 13 2025 (22 days)
    Is Extended: ✅ YES
    Extended By: PS-4883
    Extended End Date: Fri Nov 13 2026 (1 year later)
```

## How Extension Detection Works

The system detects extensions by:
1. Grouping all PS records by account
2. For each product code in a PS record:
   - Check if the same product code exists in a DIFFERENT PS record for the same account
   - Check if that other PS record has a LATER end date
   - If yes, mark as `is_extended = true` and record the extending PS record info

## Benefits

1. **Flexibility:** Users can now toggle between viewing only at-risk products or all products
2. **Clarity:** Products column now displays data correctly
3. **Efficiency:** Combined date/days column saves space and matches old app format
4. **Transparency:** Extended products are clearly marked when visible

## Implementation Details

### Database Layer (database.js)
```javascript
// Before: Hard-coded filter
queryText += ` AND is_extended = false`;

// After: Conditional filter
if (filters.showExtended === false || filters.showExtended === undefined) {
    queryText += ` AND is_extended = false`;
}
// If showExtended is true, no filter applied (shows all)
```

### API Layer (app.js)
```javascript
const showExtended = req.query.showExtended === 'true' || req.query.showExtended === true;
const result = await salesforce.getExpiringEntitlements(expirationWindow, showExtended);
```

### Service Layer (salesforce.js)
```javascript
const result = await db.getExpirationData({
    expirationWindow: expirationWindow,
    showExtended: showExtended  // Pass through the parameter
});
```

### Frontend Layer (ExpirationMonitor.jsx)
```jsx
// Correct property names
{exp.expiringProducts?.models && ...}

// Combined date/days display
<div className="flex flex-col">
  <span className="font-medium">{new Date(exp.earliestExpiry).toLocaleDateString()}</span>
  <span className="text-xs text-gray-500">({exp.earliestDaysUntilExpiry} days)</span>
</div>
```

## No Breaking Changes

- Default behavior unchanged: Still shows only at-risk products when checkbox is unchecked
- Existing functionality preserved: All other features continue to work as before
- Backward compatible: Old behavior is default, new behavior requires explicit checkbox toggle

---

**Fix implemented by:** AI Assistant  
**Linter Status:** ✅ No errors  
**Related Files:** database.js, app.js, salesforce.js, ExpirationMonitor.jsx


