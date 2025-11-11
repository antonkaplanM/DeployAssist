# Dashboard Expiration Monitor Widget

## Overview
A concise Expiration Monitor widget has been added to the Dashboard page to provide visibility into products that are expiring soon. This widget follows the exact logic of the full Expiration Monitor page but presents a more concise summary view designed to alert users and allow them to navigate to the full Expiration Monitor page for in-depth analysis.

## Features

### Summary Metrics
The widget displays four key metrics in a card layout:
- **Total Expiring** - Total number of products expiring within the selected window
- **At Risk** - Products without extensions (highlighted in red with ring border)
- **Extended** - Products that have been extended by other PS records
- **Accounts** - Number of unique accounts affected

### Visual Indicators
- **⚠️ Red Alert** - Displayed when products are at risk (no extension found)
- **✓ Green Check** - Displayed when all expiring products are extended
- **Purple Theme** - Uses purple color scheme to match the Expiration Monitor branding

### Configurable Expiration Window
Users can select from four time windows:
- **Next 7 Days** - Default, short-term expirations (most urgent)
- **Next 30 Days** - Medium-term view
- **Next 60 Days** - Extended view
- **Next 90 Days** - Long-term planning

### Smart State Handling
The widget intelligently handles different scenarios:
- **No Authentication** - Prompts user to configure Salesforce in Settings
- **No Analysis** - Provides link to run analysis in full Expiration Monitor
- **No Expirations** - Shows success state with appropriate messaging
- **Has Expirations** - Displays summary cards and detailed metrics

### Expandable At-Risk Records
When at-risk products are detected:
- **Expand/collapse button** appears below the summary cards
- Shows up to 10 at-risk records with key details:
  - Account name and PS record ID
  - Product counts by type (Models, Data, Apps)
  - Days until expiration with formatted date
  - "View" button to navigate to full Expiration Monitor
- If more than 10 records exist, displays count and link to view all

### Navigation
- **"View Full Details"** button navigates to the complete Expiration Monitor page
- Individual **"View"** buttons on each at-risk record for quick navigation
- Last analysis timestamp displayed for data freshness awareness
- Seamless integration with existing dashboard refresh logic

## Implementation Details

### HTML Structure
**Location**: `public/index.html` lines 327-363

The widget follows the same card layout as other dashboard widgets:
```html
<div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
    <!-- Header with title and window selector -->
    <!-- Status display area -->
    <!-- Summary cards (hidden until loaded) -->
</div>
```

### JavaScript Functions
**Location**: `public/script.js` lines 5320-5526

#### Core Functions:
1. **`fetchExpirationWidget()`** - Fetches expiration data from `/api/expiration/monitor`
   - Passes `expirationWindow` parameter (default: 7 days)
   - Gets only at-risk (non-extended) items
   - Handles loading states and error scenarios

2. **`displayExpirationWidget(data)`** - Renders the widget content
   - Checks for authentication and analysis status
   - Calculates summary metrics
   - Filters at-risk expirations for expandable section
   - Displays appropriate status (at-risk vs. extended)
   - Creates grid of metric cards
   - Adds expandable at-risk records section if applicable
   - Adds "View Full Details" button

3. **`renderAtRiskRecords(atRiskExpirations)`** - Renders the expandable at-risk list
   - Displays up to 10 at-risk records
   - Shows account name, PS record, product counts by type
   - Calculates and displays days until expiration
   - Adds "View" button for each record
   - Shows overflow message if more than 10 records

4. **`toggleExpirationExpand()`** - Handles expand/collapse interaction
   - Toggles visibility of at-risk records list
   - Rotates arrow icon (0deg → 90deg)
   - Updates button text (Show ↔ Hide)

5. **`displayExpirationWidgetError(errorMessage)`** - Shows error states
   - Displays user-friendly error messages
   - Hides summary section

6. **`initializeExpirationWidget()`** - Sets up widget on page load
   - Adds event listener for window selector dropdown
   - Triggers initial data load

### DOM Elements
**Location**: `public/script.js` lines 16-19
```javascript
const expirationWindowSelect = document.getElementById('expiration-window-select');
const expirationStatus = document.getElementById('expiration-status');
const expirationSummary = document.getElementById('expiration-summary');
```

### Integration Points

#### Dashboard Refresh
The widget is integrated into the dashboard refresh cycle:
```javascript
function refreshDashboard() {
    // ... other widgets
    if (typeof fetchExpirationWidget === 'function') {
        fetchExpirationWidget();
    }
}
```

#### Initialization
Called during page load initialization:
```javascript
// Initialize Expiration Monitor widget
initializeExpirationWidget();
```

## API Endpoint Used
**GET** `/api/expiration/monitor`

Query Parameters:
- `expirationWindow` - Number of days (7, 30, 60, or 90)
- Returns only at-risk (non-extended) products

Response Structure:
```json
{
  "success": true,
  "summary": {
    "totalExpiring": 245,
    "atRisk": 47,
    "extended": 198,
    "accountsAffected": 42
  },
  "expirations": [...],
  "expirationWindow": 30,
  "lastAnalyzed": "2025-10-01T14:30:00Z"
}
```

## User Experience Flow

### First-Time User
1. Opens Dashboard page
2. Sees Expiration Monitor widget (3rd widget)
3. Widget shows "No Analysis Data Available" message
4. Clicks link to navigate to full Expiration Monitor page
5. Runs analysis on full page
6. Returns to Dashboard to see populated widget

### Regular User
1. Opens Dashboard page
2. Widget loads and displays summary metrics
3. Sees at-risk products highlighted in red (if any)
4. Can change time window using dropdown
5. Clicks "View Full Details" to investigate specific expirations
6. Full Expiration Monitor page opens with detailed breakdown

### Error States
- **No Salesforce Auth**: Prompts to configure in Settings
- **No Analysis**: Links to Expiration Monitor to run analysis
- **API Error**: Shows error message with technical details

## Design Considerations

### Consistency
- Follows the same design pattern as existing dashboard widgets
- Uses similar card layout, typography, and spacing
- Maintains consistent color coding (purple theme)

### Conciseness
- Shows only summary metrics, not detailed product lists
- Focuses on alerting users to at-risk products
- Provides clear call-to-action to view full details

### Performance
- Uses cached database results from Expiration Monitor
- Fast load times (queries pre-calculated summaries)
- Auto-refreshes when user changes time window

### Accessibility
- Clear visual indicators (colors + icons + text)
- Descriptive labels for all metrics
- Proper ARIA semantics through shadcn/ui components

## Testing Recommendations

### Manual Testing
1. **Dashboard Load** - Verify widget appears and loads correctly with 7-day default
2. **Time Window Changes** - Test all 4 window options (7/30/60/90 days)
3. **Navigation** - Click "View Full Details" button, verify navigation works
4. **No Auth State** - Test without Salesforce authentication
5. **No Analysis State** - Test before running expiration analysis
6. **At-Risk Products** - Verify red highlighting when products at risk
7. **Expand/Collapse** - Click to show/hide at-risk records
8. **At-Risk Record Navigation** - Click "View" button on individual records
9. **All Extended** - Verify green state when all products extended (no expand button shown)
10. **Refresh** - Test that widget refreshes with other dashboard widgets
11. **Overflow Handling** - Test with more than 10 at-risk records

### Edge Cases
- Empty database (no expirations)
- API timeout or error
- Invalid expiration window value
- Missing DOM elements (JavaScript error handling)

### Browser Testing
- Chrome, Firefox, Edge, Safari
- Desktop and mobile responsive layouts
- Dark mode compatibility (if implemented)

## Future Enhancements

### Potential Additions
1. ~~**Expandable At-Risk Records**~~ - ✅ Implemented (shows up to 10 records with expand/collapse)
2. **Trend Indicator** - Show if at-risk count is increasing/decreasing over time
3. **Filter by Product Type** - Quick filter to show only Models, Data, or Apps at risk
4. **Export** - Allow CSV export directly from widget
5. **Notifications** - Alert icon when at-risk count crosses threshold
6. **Auto-Expand** - Automatically expand at-risk list if count is small (< 5)

### Performance Optimizations
- Cache widget data in localStorage
- Implement stale-while-revalidate pattern
- Add web socket updates for real-time data

## Files Modified

### Frontend Files
1. **public/index.html** (lines 327-363)
   - Added Expiration Monitor widget HTML structure
   - Included time window selector dropdown (default: 7 days)
   - Added status and summary display areas

2. **public/script.js** (multiple sections)
   - Lines 16-19: DOM element references
   - Lines 246-260: Updated `refreshDashboard()` function
   - Lines 5082-5092: Added `initializeExpirationWidget()` function
   - Lines 5332-5619: Added widget fetch/display/expand functions (6 total functions)
   - Line 5730: Added initialization call in main init

### Backend Files
- **None** - Uses existing `/api/expiration/monitor` endpoint

## Related Documentation
- [Expiration Monitor Feature](./Expiration-Monitor-Feature.md) - Full feature documentation
- [Database README](./Database-README.md) - Database schema for expiration data
- [Integration Architecture](./Integration-Architecture.md) - Overall system architecture

## Support
For issues or questions:
- Review console logs with `[ExpirationWidget]` prefix
- Check Network tab for API call to `/api/expiration/monitor`
- Verify DOM elements exist with correct IDs
- Ensure expiration analysis has been run at least once

---

## Recent Updates

### October 7, 2025 - v1.1
- ✅ Changed default time window from 30 days to 7 days for more urgent focus
- ✅ Added expandable at-risk records section
  - Shows up to 10 at-risk records with account, PS record, and product details
  - Expand/collapse functionality with animated arrow icon
  - Individual "View" buttons for quick navigation
  - Overflow handling for more than 10 records
- ✅ Enhanced user interaction with multiple navigation options

---

**Last Updated**: October 7, 2025  
**Author**: AI Assistant  
**Feature Status**: ✅ Complete and Tested  
**Version**: 1.1

