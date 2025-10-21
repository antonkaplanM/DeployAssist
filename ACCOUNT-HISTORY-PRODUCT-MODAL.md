# Account History - Product Modal with Table & Aggregation

## What Was Implemented

### 1. ✅ Table-Based Layout (instead of cards)
The modal now displays products in a clean, sortable table format matching the old app:
- Professional table with headers
- Cleaner, more organized presentation
- Easier to scan multiple products

### 2. ✅ Product Aggregation with Expandable Rows
Products with the same product code are now **automatically grouped** and **expandable**:
- Shows **min start date** (earliest) and **max end date** (latest)
- Displays **instance count** badge (e.g., "2 instances")
- **Chevron icon** (▶) indicates expandable groups
- **Click row** to expand and see individual line items
- **Click again** to collapse
- Child rows show individual dates for each instance

**Example:**
```
▶ CATSUITE-US [2 instances]  Start: 1/1/2023   End: 12/31/2028
  (Click to expand)

▼ CATSUITE-US [2 instances]  Start: 1/1/2023   End: 12/31/2028
  1  CATSUITE-US              Start: 1/1/2023   End: 12/31/2026
  2  CATSUITE-US              Start: 1/15/2026  End: 12/31/2028
  (Click to collapse)
```

### 3. ✅ Package Name Helper
For **App Entitlements**, package names now have an info icon (ℹ️):
- Click the icon to open a nested modal
- Displays full package details from database:
  - Package Name & RI Package Name
  - Package Type (Base/Add-on)
  - Description
  - Capacity & Limits:
    - Locations
    - Max Concurrent Model Jobs
    - Max Concurrent Non-Model Jobs
    - Max Jobs per Day
    - Max Users

### 4. ✅ Product Type-Specific Columns

**Models:**
- Product Code
- Start Date
- End Date
- Modifier

**Data:**
- Product Code
- Start Date
- End Date

**Apps:**
- Product Code
- Package Name (with info icon ℹ️)
- Quantity
- Start Date
- End Date

## How It Works

**User Flow:**
1. User searches and selects an account
2. Table displays with product badges in the "Products" column
3. User clicks on "2 Models", "1 Data", or "3 Apps" badge
4. Modal opens showing **table** with aggregated products
5. If products have same code → grouped with date range and chevron icon (▶)
6. **Click grouped row** → expands to show individual line items
7. **Click again** → collapses back to aggregated view
8. For apps: click ℹ️ icon next to package name → opens package details modal
9. Close modal with "Close" button or backdrop click

**Example Table in Modal:**
```
Model Entitlements
PS-4327 • 5 items

   Product Code          Start Date    End Date      Modifier
▶  CATSUITE-US [2 inst]  1/1/2023     12/31/2028    —
   DATA-FLOOD-GBL        1/1/2023     12/31/2026    —

(Click row with chevron to expand)

   Product Code          Start Date    End Date      Modifier
▼  CATSUITE-US [2 inst]  1/1/2023     12/31/2028    —
 1   CATSUITE-US         1/1/2023     12/31/2026    —
 2   CATSUITE-US         1/15/2026    12/31/2028    —
   DATA-FLOOD-GBL        1/1/2023     12/31/2026    —
```

**Example Package Info Modal (nested):**
```
Package Name: BASE-100K
RI Package: RI-BASE-100K
Type: Base

Description: Base package with 100,000 locations...

Capacity & Limits:
- Locations: 100,000
- Max Concurrent Model Jobs: 10
- Max Jobs per Day: 1,000
- Max Users: 25
```

## Technical Implementation

### Expandable Row State Management
```javascript
const [expandedGroups, setExpandedGroups] = useState(new Set());

const toggleGroup = (groupIndex) => {
  setExpandedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(groupIndex)) {
      next.delete(groupIndex);
    } else {
      next.add(groupIndex);
    }
    return next;
  });
};
```

### Product Aggregation Logic (lines 33-66)
```javascript
const groupedProducts = useMemo(() => {
  const grouped = new Map();
  
  products.forEach((item, originalIndex) => {
    const productCode = getProductCode(item);
    const startDate = getStartDate(item);
    const endDate = getEndDate(item);
    
    if (!grouped.has(productCode)) {
      grouped.set(productCode, {
        productCode: productCode,
        items: [],
        minStartDate: startDate,
        maxEndDate: endDate,
        defaultItem: item
      });
    }
    
    const group = grouped.get(productCode);
    group.items.push({ ...item, originalIndex });
    
    // Update min/max dates
    if (startDate !== '—' && (group.minStartDate === '—' || 
        new Date(startDate) < new Date(group.minStartDate))) {
      group.minStartDate = startDate;
    }
    if (endDate !== '—' && (group.maxEndDate === '—' || 
        new Date(endDate) > new Date(group.maxEndDate))) {
      group.maxEndDate = endDate;
    }
  });
  
  return Array.from(grouped.values());
}, [products]);
```

### Package Info Fetch (lines 69-98)
```javascript
const handleShowPackageInfo = async (packageName) => {
  setLoadingPackage(true);
  
  const response = await fetch(`/api/packages/${encodeURIComponent(packageName)}`);
  const data = await response.json();
  
  if (data.success && data.package) {
    setPackageModalData(data.package);
  }
  
  setLoadingPackage(false);
};
```

### Table Rendering with Info Icon (lines 209-223)
```javascript
// Package name column with info icon
if (col.showInfo && value !== '—' && value) {
  return (
    <td className="px-3 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span>{value}</span>
        <button
          onClick={() => handleShowPackageInfo(value)}
          className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 p-1"
          title="View package details"
        >
          <InformationCircleIcon className="h-4 w-4 text-blue-600" />
        </button>
      </div>
    </td>
  );
}
```

## Test Now

1. **Navigate**: http://localhost:8080/analytics/account-history
2. **Search**: Type "Chubb" or "Bank" and select account
3. **Click Product Badge**: Click "2 Models", "1 Data", or "3 Apps"
4. **Verify Table Modal**:
   - ✅ Opens with table layout (not cards)
   - ✅ Shows correct columns for product type
   - ✅ Products with same code are grouped
   - ✅ Shows "X instances" badge for duplicates
   - ✅ Chevron icon (▶) appears for grouped items
   - ✅ Displays aggregated date range (min start, max end)
   - ✅ **Click grouped row** → expands to show individual items
   - ✅ Chevron rotates (▼) when expanded
   - ✅ Child rows show with gray background
   - ✅ Child rows numbered (1, 2, 3...)
   - ✅ **Click again** → collapses back
   - ✅ Close button works
5. **Test Package Helper** (Apps only):
   - ✅ Info icon (ℹ️) appears next to package names
   - ✅ Click info icon opens nested modal
   - ✅ Shows package name, type, description
   - ✅ Shows capacity metrics (locations, jobs, users)
   - ✅ Loading spinner while fetching
   - ✅ Close nested modal returns to product table

## Files Modified
- ✅ `frontend/src/components/features/ProductModal.jsx` (Complete Rewrite)
  - Replaced card layout with table
  - Added product aggregation logic (group by product code)
  - Added date range aggregation (min start, max end)
  - Added package info helper with API integration
  - Added nested modal for package details
  - Added loading states
  - Added dynamic columns based on product type
- ✅ `frontend/src/pages/AccountHistory.jsx`
  - Imported ProductModal component
  - Added modal state management
  - Added click handler for product badges
  - Changed badges from divs to buttons

## Matches Old App Behavior
✅ Product badges are clickable  
✅ Modal uses table layout (not cards)  
✅ Products grouped by product code  
✅ Shows instance count for duplicates  
✅ Aggregates dates (min start, max end)  
✅ **Expandable rows with chevron icon**  
✅ **Click to expand/collapse grouped items**  
✅ **Child rows show individual line items**  
✅ Package name helper with info icon  
✅ Nested modal for package details  
✅ Shows capacity metrics from database  
✅ Color-coded by type (blue/green/purple)  
✅ Close with button or backdrop click  

## Key Improvements Over Original Implementation
1. **Better Performance**: `useMemo` for grouping calculation
2. **React State Management**: Clean expand/collapse with Set-based state
3. **Cleaner Code**: Reusable field accessor functions
4. **Type Safety**: Handles multiple field name variations
5. **Smooth Animations**: CSS transitions for chevron rotation
6. **Loading States**: Shows spinner while fetching package data
7. **Error Handling**: User-friendly alerts for failed API calls
8. **Nested Modals**: Proper z-index stacking (z-50, z-60)
9. **Event Bubbling**: Proper stopPropagation for nested clicks

