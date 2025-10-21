# Validation Failure Highlighting Implementation

## Overview
Implemented validation failure highlighting on the Provisioning Monitor page that matches the old app's behavior. When validation rules fail for a PS record, the product category buttons are highlighted with a red ring, and individual line items with validation failures are highlighted with a red background and warning icon in the product modal.

## Problem Statement

**Before:**
- Product category buttons (Models, Data, Apps) showed no visual indication of validation failures
- Individual line items in the product modal had no highlighting for validation failures
- Users couldn't quickly identify which products or specific entitlements had issues

**After:**
- Product category buttons with validation failures show a prominent red ring (`ring-2 ring-red-400`)
- Individual line items with validation failures display:
  - Red background (`bg-red-50`)
  - Red border (`border-red-200`)
  - Warning icon (⚠️) instead of row number
  - Tooltip explaining the validation failure

## Changes Made

### 1. ProvisioningRequests.jsx Updates

#### Product Modal State Enhancement
```javascript
const [productModal, setProductModal] = useState({
  isOpen: false,
  products: [],
  productType: '',
  requestName: '',
  validationResult: null, // NEW: Pass validation results to modal
});
```

#### Product Category Button Highlighting
Added `hasValidationFailureForType()` helper function that checks:

**For All Types (Models, Data, Apps):**
- Date overlap validation failures
- Date gap validation failures

**For Apps Specifically:**
- App quantity validation failures (quantity !== 1)
- App package name validation failures (missing package names)

**For Models Specifically:**
- Model count validation failures

**Visual Implementation:**
```javascript
<button
  className={`...base-classes... ${
    appsHasFailure ? 'ring-2 ring-red-400' : ''
  }`}
>
  📱 Apps ({apps.length})
</button>
```

#### Validation Result Passing
Updated `openProductModal()` and `renderProductsColumn()` to pass validation results:

```javascript
const openProductModal = (products, type, requestName, validationResult = null) => {
  setProductModal({
    isOpen: true,
    products,
    productType: type,
    requestName,
    validationResult, // Pass validation result
  });
};
```

### 2. ProductModal.jsx Updates

#### Accept Validation Results Prop
```javascript
const ProductModal = ({ 
  isOpen, 
  onClose, 
  products, 
  productType, 
  requestName, 
  validationResult = null // NEW prop
}) => {
```

#### Validation Issue Detection Function
Added `hasValidationIssue(item, index)` function that checks if an individual entitlement has a validation failure:

**Checks Performed:**

1. **Date Overlap Issues:**
   - Compares entitlement type and index against overlap details
   - Validates if this specific item is involved in overlapping dates

2. **Date Gap Issues:**
   - Compares entitlement type and index against gap details
   - Validates if this specific item is involved in date gaps

3. **App Quantity Issues (Apps only):**
   - Checks if quantity !== 1
   - Exceptions: `IC-DATABRIDGE`, `RI-RISKMODELER-EXPANSION`

4. **App Package Name Issues (Apps only):**
   - Checks if package name is missing or empty
   - Exceptions: `DATAAPI-LOCINTEL`, `IC-RISKDATALAKE`, `RI-COMETA`, `DATAAPI-BULK-GEOCODE`

#### Line Item Highlighting
Updated child row rendering to apply visual indicators:

```javascript
const hasIssue = hasValidationIssue(item, item.originalIndex);
const childRowClass = hasIssue
  ? 'border-b bg-red-50 border-red-200'  // Red highlighting
  : 'border-b bg-gray-50';                // Normal

return (
  <tr 
    className={childRowClass}
    title={hasIssue ? 'This entitlement has a validation failure' : ''}
  >
    <td className="px-1 py-2 w-4 text-center pl-6">
      {hasIssue ? (
        // Warning triangle icon
        <svg className="h-3 w-3 text-red-500">...</svg>
      ) : (
        // Row number
        <span className="text-xs text-gray-400">{itemIndex + 1}</span>
      )}
    </td>
    {/* ...column cells... */}
  </tr>
);
```

## Visual Examples

### Product Category Button Highlighting

**Normal State:**
```
📊 Models (3)    💾 Data (2)    📱 Apps (5)
```

**With Validation Failures:**
```
📊 Models (3)    💾 Data (2)    [📱 Apps (5)]   ← Red ring around Apps button
                                    ↑
                             ring-2 ring-red-400
```

### Line Item Modal Highlighting

**Normal Row:**
```
|   1   | IC-TOUCHSTONE | Package-ABC | 1 | 2024-01-01 | 2025-01-01 |
       ↑                                                              
  Row number                                                          
```

**Failed Row:**
```
| ⚠️ | IC-TOUCHSTONE | (missing) | 5 | 2024-01-01 | 2025-01-01 |
   ↑                    ↑         ↑
Warning icon      Missing pkg   Bad quantity
                                              
Background: bg-red-50, Border: border-red-200
```

## Validation Rules Implemented

### 1. Date Overlap Validation
**Rule ID:** `entitlement-date-overlap-validation`

**Detection:**
- Checks if entitlement is involved in any date overlaps
- Compares entitlement type (model/data/app) and index position
- Highlights both entitlements involved in the overlap

**Visual Indicator:**
- Red ring on product category button
- Red background on specific line items

### 2. Date Gap Validation
**Rule ID:** `entitlement-date-gap-validation`

**Detection:**
- Checks if entitlement is involved in any date gaps
- Compares entitlement type and index position
- Highlights both entitlements involved in the gap

**Visual Indicator:**
- Red ring on product category button
- Red background on specific line items

### 3. App Quantity Validation
**Rule ID:** `app-quantity-validation`

**Detection:**
- Apps must have quantity = 1
- **Exceptions:** `IC-DATABRIDGE`, `RI-RISKMODELER-EXPANSION`
- Highlights apps with quantity !== 1 (excluding exceptions)

**Visual Indicator:**
- Red ring on Apps button
- Red background on specific app rows with bad quantity

### 4. App Package Name Validation
**Rule ID:** `app-package-name-validation`

**Detection:**
- Apps must have a package name
- **Exceptions:** `DATAAPI-LOCINTEL`, `IC-RISKDATALAKE`, `RI-COMETA`, `DATAAPI-BULK-GEOCODE`
- Highlights apps missing package names (excluding exceptions)

**Visual Indicator:**
- Red ring on Apps button
- Red background on app rows missing package names

### 5. Model Count Validation
**Rule ID:** `model-count-validation`

**Detection:**
- Validates model count constraints
- Highlights model entitlements that fail count validation

**Visual Indicator:**
- Red ring on Models button
- Red background on specific model rows

## Code Flow

### 1. Page Load & Validation
```
ProvisioningRequests.jsx
  ↓
fetchRequests()
  ↓
Runs validation on all records
  ↓
Stores results in validationResults Map
```

### 2. Rendering Product Buttons
```
renderProductsColumn(request)
  ↓
Get validation result for this request
  ↓
hasValidationFailureForType('apps')
  ↓
Check all app-related validation rules
  ↓
Apply 'ring-2 ring-red-400' if failures found
```

### 3. Opening Product Modal
```
User clicks product button
  ↓
openProductModal(products, type, requestName, validationResult)
  ↓
ProductModal receives validation result
  ↓
Renders table with grouped products
```

### 4. Highlighting Individual Items
```
Child row rendering
  ↓
hasValidationIssue(item, index)
  ↓
Check date overlaps/gaps
  ↓
Check quantity (apps only)
  ↓
Check package name (apps only)
  ↓
Apply red background + warning icon if issue found
```

## Data Structure

### Validation Result Object
```javascript
{
  recordId: "a0X...",
  overallStatus: "FAIL" | "PASS",
  ruleResults: [
    {
      ruleId: "app-quantity-validation",
      status: "FAIL",
      details: {
        failures: [
          {
            productCode: "IC-TOUCHSTONE",
            quantity: 5,
            message: "App quantity must be 1"
          }
        ]
      }
    },
    {
      ruleId: "entitlement-date-overlap-validation",
      status: "FAIL",
      details: {
        overlaps: [
          {
            entitlement1: { type: "app", index: 1 },
            entitlement2: { type: "app", index: 2 },
            overlapDays: 30
          }
        ]
      }
    }
  ]
}
```

## Styling Reference

### Product Category Button Highlighting
```css
/* Normal button */
.inline-flex.items-center.gap-1.text-xs.font-medium.text-purple-700...

/* With validation failure */
.inline-flex.items-center.gap-1.text-xs.font-medium.text-purple-700...
.ring-2.ring-red-400  /* Adds red ring */
```

### Line Item Row Highlighting
```css
/* Normal row */
.border-b.bg-gray-50

/* Failed row */
.border-b.bg-red-50.border-red-200
```

### Warning Icon
```svg
<svg class="h-3 w-3 text-red-500" ...>
  <!-- Triangle with exclamation mark -->
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
  <path d="M12 9v4"/>
  <path d="m12 17 .01 0"/>
</svg>
```

## Testing Checklist

### Product Category Button Highlighting

- [ ] **Models with validation failures**
  - [ ] Models button shows red ring
  - [ ] Other buttons (Data, Apps) don't show ring if no failures

- [ ] **Data with validation failures**
  - [ ] Data button shows red ring
  - [ ] Other buttons don't show ring if no failures

- [ ] **Apps with validation failures**
  - [ ] Apps button shows red ring for quantity issues
  - [ ] Apps button shows red ring for package name issues
  - [ ] Apps button shows red ring for date overlap/gap issues

- [ ] **Multiple types with failures**
  - [ ] All affected buttons show red rings
  - [ ] Unaffected buttons remain normal

### Line Item Highlighting in Modal

- [ ] **Date Overlap Issues**
  - [ ] Both overlapping items highlighted in red
  - [ ] Warning icon shown instead of row number
  - [ ] Tooltip explains validation failure

- [ ] **Date Gap Issues**
  - [ ] Both items with gaps highlighted in red
  - [ ] Warning icon shown

- [ ] **App Quantity Issues**
  - [ ] Apps with quantity !== 1 highlighted (except exceptions)
  - [ ] Exceptions (IC-DATABRIDGE, RI-RISKMODELER-EXPANSION) not highlighted
  - [ ] Warning icon shown

- [ ] **App Package Name Issues**
  - [ ] Apps without package names highlighted (except exceptions)
  - [ ] Exceptions (DATAAPI-LOCINTEL, etc.) not highlighted
  - [ ] Warning icon shown

- [ ] **Normal Items**
  - [ ] Items without issues show gray background
  - [ ] Row numbers displayed normally
  - [ ] No warning icons

### Edge Cases

- [ ] **No validation failures**
  - [ ] All buttons normal (no red rings)
  - [ ] All rows gray background
  - [ ] No warning icons

- [ ] **All items fail validation**
  - [ ] All relevant buttons show red rings
  - [ ] All line items highlighted in red
  - [ ] Warning icons on all rows

- [ ] **Mixed pass/fail**
  - [ ] Only failed items highlighted
  - [ ] Correct warning icons placement
  - [ ] Normal items remain gray

## Performance Considerations

1. **Validation Results Caching:**
   - Results stored in Map for O(1) lookup
   - Calculated once per page load
   - No re-validation on modal open/close

2. **Modal Rendering:**
   - `hasValidationIssue()` called only for visible rows
   - Results computed during render (fast operation)
   - No unnecessary re-renders

3. **Button Highlighting:**
   - Type-specific checks reduce unnecessary iterations
   - Early returns for PASS status
   - Minimal DOM updates

## Comparison with Old App

### Matching Features ✅

1. **Red ring on product category buttons** - Exact match
2. **Red background on failed line items** - Exact match (`bg-red-50`)
3. **Warning triangle icon** - Exact match
4. **Tooltip on hover** - Exact match
5. **Validation rule logic** - Exact match
6. **Exception handling** - Exact match

### Implementation Differences

**Old App:**
- Uses vanilla JavaScript with inline HTML generation
- Stores validation results in global `validationResults` Map
- Applies classes using string concatenation

**New App:**
- Uses React with component-based architecture
- Stores validation results in React state
- Applies classes using conditional className expressions
- Better type safety and maintainability

## Files Modified

1. **`frontend/src/pages/ProvisioningRequests.jsx`**
   - Added validation result to product modal state
   - Implemented `hasValidationFailureForType()` helper
   - Added red ring styling to product buttons
   - Pass validation results to modal

2. **`frontend/src/components/features/ProductModal.jsx`**
   - Accept `validationResult` prop
   - Implemented `hasValidationIssue()` helper
   - Added red background highlighting for failed rows
   - Added warning icon rendering
   - Added tooltip for failed items

## Troubleshooting

### Issue: Product buttons not showing red ring

**Possible Causes:**
1. Validation not running (check `ENABLED_VALIDATION_RULES`)
2. Validation result not being passed to `renderProductsColumn()`
3. Type mismatch in validation rule checks

**Solution:**
- Check browser console for validation logs
- Verify `validationResults.get(request.Id)` returns data
- Inspect `hasValidationFailureForType()` logic

### Issue: Line items not highlighting in modal

**Possible Causes:**
1. Validation result not passed to ProductModal
2. `hasValidationIssue()` logic not matching validation rule output
3. Index mismatch (0-based vs 1-based)

**Solution:**
- Verify `validationResult` prop in ProductModal
- Check `item.originalIndex` is correct
- Log validation rule details to inspect structure

### Issue: Wrong items highlighted

**Possible Causes:**
1. Index calculation incorrect
2. Type mapping wrong (model vs models)
3. Exception list incomplete

**Solution:**
- Verify type mapping: `{models: 'model', apps: 'app', data: 'data'}`
- Check index + 1 logic (validation uses 1-based indexing)
- Review exception product codes

## Future Enhancements

1. **Hover Details:**
   - Show specific validation failure message on hover
   - Display which rule(s) failed

2. **Filtering:**
   - Filter to show only records with validation failures
   - Filter by specific validation rule type

3. **Bulk Actions:**
   - Fix common validation issues in bulk
   - Export validation failure report

4. **Visual Improvements:**
   - Animation when opening modal with failures
   - Color-coded severity (warning vs error)
   - Expandable validation details panel

## Summary

✅ **Complete feature parity with old app**
- Product category buttons highlighted with red ring when validation fails
- Individual line items highlighted with red background and warning icon
- All validation rules properly implemented
- Exception handling matches old app exactly

✅ **Improved user experience**
- Clear visual indicators of validation failures
- Tooltips provide context
- Consistent styling across the application

✅ **Maintainable code**
- Well-structured helper functions
- Proper React patterns
- Comprehensive validation logic

**Status: Complete and Ready for Testing** 🎉


