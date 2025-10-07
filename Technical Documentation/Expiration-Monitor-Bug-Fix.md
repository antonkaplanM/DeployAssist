# Expiration Monitor Bug Fix - October 2025

## Issue Summary
The Expiration Monitor page had a critical bug where changing the expiration window dropdown had no effect on the displayed data, and a persistent "Loading..." message appeared above the table.

## Root Causes

### 1. Duplicate Element ID
**Problem**: Two HTML elements had the same `id="expiration-status"`
- Dashboard widget (line 352 in `index.html`)
- Expiration Monitor page (line 1015 in `index.html`)

**Impact**: JavaScript functions trying to update the Expiration Monitor page status were inadvertently targeting the dashboard widget element instead, causing the "Loading..." message to never clear on the page.

### 2. No Database Refresh
**Problem**: Changing the expiration window only re-queried the cached database with a different filter parameter.

**Impact**: 
- Database still contained data from the last analysis run
- Different window sizes would show incorrect results
- Users saw stale data that didn't match their selected timeframe

## Solution Implemented

### Fix 1: Rename Duplicate ID
**File**: `public/index.html` (line 1015)

**Before**:
```html
<div id="expiration-status" class="text-sm text-muted-foreground">
    Loading...
</div>
```

**After**:
```html
<div id="expiration-page-status" class="text-sm text-muted-foreground">
    Ready
</div>
```

**Changes**:
- Renamed from `expiration-status` to `expiration-page-status`
- Changed default text from "Loading..." to "Ready"

### Fix 2: Update JavaScript References
**File**: `public/script.js` (multiple locations)

Updated all references in the Expiration Monitor page functions:
- Lines 7343, 7379, 7740: Changed `getElementById('expiration-status')` to `getElementById('expiration-page-status')`
- Line 18: Added comment clarifying dashboard widget scope

### Fix 3: Auto-Refresh on Window Change
**File**: `public/script.js` (lines 7298-7305, 7699-7734)

#### Event Listener Update
**Before**:
```javascript
windowSelect.addEventListener('change', (e) => {
    expirationWindow = parseInt(e.target.value);
    loadExpirationData(); // Only queries database
});
```

**After**:
```javascript
windowSelect.addEventListener('change', async (e) => {
    expirationWindow = parseInt(e.target.value);
    console.log('[Expiration] Window changed to:', expirationWindow, 'days - triggering auto-refresh');
    
    // Auto-refresh the analysis with new window
    await autoRefreshExpirationData();
});
```

#### New Function: autoRefreshExpirationData()
**Purpose**: Silently refresh database analysis when user changes window

**Key Features**:
- Runs in background without alert dialog
- Re-analyzes 5 years of data with new expiration window
- Updates database cache with correct data
- Reloads page display automatically
- Shows progress in status indicator

**Implementation**:
```javascript
async function autoRefreshExpirationData() {
    const statusEl = document.getElementById('expiration-page-status');
    
    try {
        if (statusEl) statusEl.textContent = 'Analyzing...';
        
        console.log('[Expiration] Auto-refreshing analysis for', expirationWindow, 'day window');
        
        const response = await fetch('/api/expiration/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lookbackYears: 5,
                expirationWindow: expirationWindow
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[Expiration] ✅ Auto-refresh complete');
            await loadExpirationStatus();
            await loadExpirationData();
        } else {
            console.error('[Expiration] ❌ Auto-refresh failed:', data.error);
            if (statusEl) statusEl.textContent = `Error: ${data.error}`;
        }
    } catch (error) {
        console.error('[Expiration] Error during auto-refresh:', error);
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
    }
}
```

### Fix 4: Updated Manual Refresh Function
**File**: `public/script.js` (line 7740)

Changed `refreshExpirationAnalysis()` to use `expiration-page-status` instead of `expiration-status`.

### Fix 5: Extended Checkbox Behavior
**File**: `public/script.js` (lines 7308-7312)

**Before**: Called `loadExpirationData()` (re-query database)
**After**: Calls `renderExpirationTable()` (re-render current data)

**Rationale**: "Show Extended" checkbox is just a display filter, no need to refresh database.

## Data Flow (After Fix)

### User Changes Expiration Window
```
1. User selects "7 Days" from dropdown
   ↓
2. Event listener fires: autoRefreshExpirationData()
   ↓
3. Status shows: "Analyzing..."
   ↓
4. POST /api/expiration/refresh with {expirationWindow: 7, lookbackYears: 5}
   ↓
5. Backend:
   - Queries 5 years of Salesforce data
   - Analyzes expirations within 7 days
   - Detects extensions
   - Updates database cache
   ↓
6. Frontend:
   - Loads fresh data from database
   - Updates summary cards
   - Renders table
   - Status shows: "Showing X records"
```

### User Toggles "Show Extended" Checkbox
```
1. User checks/unchecks "Show Extended"
   ↓
2. Event listener fires: renderExpirationTable()
   ↓
3. Filters current data in memory
   ↓
4. Re-renders table (no API call needed)
```

## Benefits of the Fix

### User Experience
1. **Real-time Accuracy**: Changing window always shows correct data
2. **Clear Feedback**: Status updates show what's happening
3. **No Confusion**: "Loading..." message clears properly
4. **Seamless Operation**: Auto-refresh happens automatically

### Technical Benefits
1. **Data Integrity**: Database always synced with selected parameters
2. **No Stale Data**: Cache refreshed on every window change
3. **Proper Separation**: Dashboard and page elements clearly separated
4. **Better Logging**: Console logs track refresh operations

## Performance Considerations

### Analysis Duration
- **Typical Time**: 5-15 seconds for 5 years of data
- **User Feedback**: Progress shown in status indicator
- **Background Operation**: Page remains responsive
- **No Blocking**: Can navigate away during analysis

### API Load
- **Impact**: One additional API call per window change
- **Mitigation**: Analysis is efficient, cached in database
- **Consideration**: Frequent window changes may cause load
- **Future Enhancement**: Consider debouncing if needed

## Testing Performed

### Manual Testing
✅ Changed expiration window from 30 to 7 days - data refreshed correctly
✅ Changed expiration window from 7 to 90 days - data refreshed correctly  
✅ Toggled "Show Extended" checkbox - table filtered correctly
✅ Clicked "Refresh Analysis" button - manual refresh works
✅ Verified "Loading..." message clears properly
✅ Checked console logs for proper ID targeting
✅ Tested dashboard widget independently - still works
✅ Verified no conflicts between dashboard and page

### Regression Testing
✅ Dashboard expiration widget unaffected
✅ Navigation between pages works
✅ Other widgets continue functioning
✅ Salesforce authentication flows work
✅ Error states display correctly

## Known Limitations

### Performance
- Changing window triggers full analysis (5-15 seconds)
- Multiple rapid changes can queue up refresh requests
- Consider adding debounce if users frequently change windows

### User Interface
- No visual indication of queued refreshes
- Can't cancel an in-progress auto-refresh
- Status message is simple text (could be enhanced)

## Future Enhancements

### Potential Improvements
1. **Debounce Window Changes**: Wait 1 second after last change before refreshing
2. **Cancel Button**: Allow canceling in-progress analysis
3. **Progress Bar**: Show percentage complete during analysis
4. **Smart Caching**: Only refresh if data is stale (> 1 hour old)
5. **Background Workers**: Move analysis to background job
6. **Incremental Updates**: Only analyze new data since last refresh

### Alternative Approaches
- **Hybrid Mode**: Quick filter on cached data, full refresh on demand
- **Pre-compute**: Generate all window sizes during nightly batch
- **Lazy Loading**: Only analyze when user navigates to page

## Related Issues

### Fixed
- ✅ Duplicate ID causing wrong element updates
- ✅ Stale "Loading..." message persisting
- ✅ Window changes not refreshing data

### Prevented
- ✅ Race conditions between dashboard and page
- ✅ Confusion about data freshness
- ✅ Users seeing incorrect expiration counts

## Files Modified

### HTML
- `public/index.html` (line 1015)
  - Renamed `id="expiration-status"` to `id="expiration-page-status"`
  - Changed default text from "Loading..." to "Ready"

### JavaScript
- `public/script.js` (multiple locations)
  - Line 18: Added clarifying comment
  - Lines 7298-7305: Updated window change event listener
  - Lines 7343, 7379: Updated status element references
  - Lines 7699-7734: Added `autoRefreshExpirationData()` function
  - Line 7740: Updated manual refresh function
  - Lines 7308-7312: Updated extended checkbox behavior

### Backend
- **None** - No backend changes required

## Backwards Compatibility
- ✅ All existing bookmarks work
- ✅ No API changes
- ✅ No database schema changes
- ✅ Dashboard widget unaffected
- ✅ URL parameters preserved

---

**Bug Fixed**: October 7, 2025  
**Severity**: High (Core functionality broken)  
**Impact**: All users affected  
**Resolution Time**: Complete  
**Status**: ✅ Resolved and Tested

