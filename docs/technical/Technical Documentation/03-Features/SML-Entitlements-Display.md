# SML Entitlements Display Enhancement

## ✅ Implementation Complete

Successfully enhanced the Provisioning Monitor to display SML entitlements for Deprovision requests alongside payload entitlements.

## What Was Added

### 1. Async Validation Results Fetching

**File**: `frontend/src/pages/ProvisioningRequests.jsx`

Added state and logic to fetch async validation results:

```javascript
// New state for async validation results
const [asyncValidationResults, setAsyncValidationResults] = useState(new Map());

// Fetch async validation results after loading PS records
const fetchAsyncValidationResults = async (recordIds) => {
  const response = await fetch(`/api/validation/async-results?recordIds=${recordIds.join(',')}`);
  const data = await response.json();
  
  if (data.success) {
    // Group results by record ID
    const resultsMap = new Map();
    data.results.forEach(result => {
      if (!resultsMap.has(result.ps_record_id)) {
        resultsMap.set(result.ps_record_id, []);
      }
      resultsMap.get(result.ps_record_id).push(result);
    });
    setAsyncValidationResults(resultsMap);
  }
};
```

### 2. Enhanced Product Column Display

**File**: `frontend/src/pages/ProvisioningRequests.jsx`

Modified `renderProductsColumn` to merge payload and SML entitlements for Deprovision requests:

**Key Features**:
- Detects if request type is "Deprovision"
- Extracts SML entitlements from async validation results
- Merges payload and SML entitlements
- Shows total count including SML data
- Displays "+X★" indicator for SML entitlements

**Visual Example**:
```
📊 Models (5) +2★
💾 Data (10) +5★
📱 Apps (3)
(20 total)
```

**Code**:
```javascript
const isDeprovisionRequest = request.TenantRequestAction__c === 'Deprovision';
let smlEntitlements = null;

if (isDeprovisionRequest && asyncResults) {
  const deprovisionResult = asyncResults.find(
    r => r.rule_id === 'deprovision-active-entitlements-check' && r.sml_entitlements
  );
  if (deprovisionResult && deprovisionResult.sml_entitlements) {
    smlEntitlements = deprovisionResult.sml_entitlements;
  }
}

// Merge entitlements
const mergedModels = isDeprovisionRequest && smlEntitlements ? [...models, ...smlModels] : models;
const mergedData = isDeprovisionRequest && smlEntitlements ? [...data, ...smlData] : data;
const mergedApps = isDeprovisionRequest && smlEntitlements ? [...apps, ...smlApps] : apps;

// Mark source for modal display
const createModalData = (payloadItems, smlItems, type) => {
  const marked = [...payloadItems.map(item => ({ ...item, source: 'payload' }))];
  if (isDeprovisionRequest && smlItems.length > 0) {
    marked.push(...smlItems.map(item => ({ ...item, source: 'sml' })));
  }
  return marked;
};
```

### 3. Product Modal SML Indicators

**File**: `frontend/src/components/features/ProductModal.jsx`

Added visual badges to distinguish SML entitlements from payload entitlements:

**For Grouped Rows** (when multiple instances):
```javascript
// Show SML badge if group contains SML items
const hasSMLInGroup = group.items.some(item => item.source === 'sml');
{hasSMLInGroup && (
  <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
    ★ SML Data
  </span>
)}
```

**For Single Items**:
```javascript
{group.defaultItem?.source === 'sml' && (
  <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">
    ★ SML
  </span>
)}
```

**For Expanded Child Rows**:
```javascript
// Add SML badge to product code in child rows
if (col.key === 'productCode' && item.source === 'sml') {
  return (
    <td key={col.key} className="px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span>{value}</span>
        <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-700">
          ★ SML
        </span>
      </div>
    </td>
  );
}
```

## Visual Design

### Product Column Buttons
- **Star Indicator** (★): Shows SML data is included
- **Count Format**: `+X★` where X is the number of SML entitlements
- **Colors**: Matches existing color scheme (blue/green/purple) with amber accents for SML

### Product Modal Badges
- **Color Scheme**: Amber (yellow-orange)
  - Light mode: `bg-amber-50 text-amber-700 border-amber-200`
  - Dark mode: `bg-amber-900/20 text-amber-400 border-amber-700`
- **Icon**: ★ (star) to indicate special SML data
- **Placement**: 
  - Next to product code in summary rows
  - Next to "X instances" badge in grouped rows
  - Next to product code in expanded child rows

## User Flow

### For Regular Requests (Non-Deprovision)
1. Display shows payload entitlements only
2. No SML indicators
3. Works exactly as before

### For Deprovision Requests
1. **Page loads** → Fetches PS records
2. **Background fetch** → Retrieves async validation results including SML entitlements
3. **Products column** → Shows merged counts with "+X★" for SML data
4. **Click product button** → Opens modal with all entitlements
5. **Modal display** → Shows "★ SML" badge next to SML-sourced entitlements
6. **Expand grouped items** → Child rows show individual SML badges

## Data Flow

```
1. Page Load
   ↓
2. Fetch PS Records (Salesforce)
   ↓
3. Fetch Async Validation Results (Database)
   ├─ Contains sml_entitlements JSONB
   └─ Contains validation status
   ↓
4. Merge SML Entitlements into Display
   ├─ Mark with source: 'sml'
   └─ Mark with source: 'payload'
   ↓
5. Render Products Column
   ├─ Show combined counts
   └─ Show "+X★" for SML items
   ↓
6. Open Product Modal
   └─ Display "★ SML" badges
```

## Database Schema

The SML entitlements come from:

**Table**: `async_validation_results`
**Column**: `sml_entitlements` (JSONB)

**Structure**:
```json
{
  "models": [
    {
      "productCode": "RI-RISKMODELER-STD",
      "startDate": "2024-01-01",
      "endDate": "2025-12-31",
      "productModifier": "Standard"
    }
  ],
  "data": [...],
  "apps": [...]
}
```

## Example Scenarios

### Scenario 1: Deprovision with All Expired Entitlements
- **Payload**: 5 models (all expired)
- **SML**: 0 active entitlements
- **Display**: `📊 Models (5)` - No SML indicator
- **Validation**: ✅ PASS

### Scenario 2: Deprovision with Active Entitlements
- **Payload**: 3 models (expired)
- **SML**: 2 active models
- **Display**: `📊 Models (5) +2★` - Shows SML data
- **Modal**: Shows 3 payload + 2 SML (with ★ badges)
- **Validation**: ⚠️ WARNING

### Scenario 3: Deprovision with Mixed Products
- **Payload**: 3 models, 5 data, 2 apps
- **SML**: 2 models, 1 data, 0 apps
- **Display**: 
  - `📊 Models (5) +2★`
  - `💾 Data (6) +1★`
  - `📱 Apps (2)`
- **Total**: (13 total)

## Files Modified

1. ✅ `frontend/src/pages/ProvisioningRequests.jsx`
   - Added `asyncValidationResults` state
   - Added `fetchAsyncValidationResults()` function
   - Modified `renderProductsColumn()` to merge SML entitlements

2. ✅ `frontend/src/components/features/ProductModal.jsx`
   - Added SML badge rendering for grouped rows
   - Added SML badge rendering for single items
   - Added SML badge rendering for expanded child rows

## Testing Instructions

### 1. Find a Deprovision Request

```bash
# Navigate to Provisioning Monitor
http://localhost:8080/provisioning

# Filter by Request Type: "Deprovision"
```

### 2. Check Products Column

**Expected**:
- If SML data exists: Shows "+X★" indicator
- Example: `📊 Models (5) +2★`
- Hover shows all entitlements in modal

### 3. Open Product Modal

**Expected**:
- SML entitlements have amber "★ SML" badge
- Both payload and SML items displayed
- Grouped items show "★ SML Data" badge
- Expanded items show individual "★ SML" badges

### 4. Test Dark Mode

**Expected**:
- Amber badges adjust to dark mode colors
- `text-amber-700 dark:text-amber-400`
- `bg-amber-50 dark:bg-amber-900/20`
- `border-amber-200 dark:border-amber-700`

### 5. Test Non-Deprovision Requests

**Expected**:
- No "+X★" indicators
- No "★ SML" badges
- Works exactly as before

## Benefits

1. **Complete Visibility**: Shows all entitlements (payload + SML) for Deprovision requests
2. **Clear Distinction**: Amber star badges clearly identify SML-sourced data
3. **Accurate Counts**: Total counts include both payload and SML entitlements
4. **Validation Context**: Users can see which entitlements triggered validation warnings
5. **Consistent UX**: Follows existing design patterns with new SML indicators
6. **Dark Mode Support**: Full dark mode compatibility

## Technical Notes

### Source Marking

All entitlements are marked with a `source` property:
- `source: 'payload'` - From Salesforce payload
- `source: 'sml'` - From SML integration

This allows the modal to distinguish and badge them appropriately.

### Performance

- Async validation results fetched once per page load
- Cached in React state (`asyncValidationResults` Map)
- No additional API calls when opening modals
- Minimal performance impact

### Edge Cases Handled

1. **No SML data available**: Falls back to payload only
2. **SML fetch fails**: Silently continues with payload data
3. **Empty SML entitlements**: No "+X★" shown
4. **Request type not Deprovision**: SML logic skipped entirely

## Future Enhancements

Potential improvements:
1. **Loading State**: Show spinner while fetching SML data
2. **Refresh Button**: Allow manual refresh of SML entitlements
3. **SML Timestamp**: Show when SML data was last updated
4. **Comparison View**: Side-by-side payload vs SML comparison
5. **Export**: Include SML data in CSV exports

## Related Documentation

- [Deprovision Active Entitlements Validation](./Technical%20Documentation/03-Features/Deprovision-Active-Entitlements-Validation.md)
- [Validation Rules Settings Update](./VALIDATION-RULES-SETTINGS-UPDATE.md)
- [Background Process Setup](./BACKGROUND-PROCESS-SETUP-SUCCESS.md)

## Summary

✅ **The Provisioning Monitor now displays SML entitlements for Deprovision requests!**

Users can:
- See total entitlement counts including SML data in the Products column
- Identify SML entitlements with "+X★" indicators
- View detailed SML entitlements in the Product Modal with "★ SML" badges
- Distinguish between payload and SML-sourced data at a glance
- Access complete entitlement information for validation purposes

The enhancement seamlessly integrates with existing features while providing clear visual indicators for SML data.

