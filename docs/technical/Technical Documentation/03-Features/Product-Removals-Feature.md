# Product Removals Monitor Feature Documentation

## Overview

The **Product Removals Monitor** is a dashboard widget that displays Technical Team (PS) requests that have product entitlement removals compared to their previous request. This feature helps track when products are being removed from customer accounts, providing visibility into potential downgrades or service reductions.

## Location

The Product Removals Monitor is accessible on the main **Dashboard** page, positioned directly below the Data Validation Monitor.

## Key Features

### 1. Time Frame Selection

**Available Time Frames:**
- Last 1 Day
- Last 1 Week (default)
- Last 1 Month
- Last 1 Year

**Behavior:**
- Dropdown selector in the top-right of the widget
- Default selection: 1 week
- Updates data immediately when changed

### 2. Removal Detection Logic

**How It Works:**
1. Fetches all PS requests created within the selected time period
2. For each request, finds the chronologically previous PS request for the same account
3. Compares product entitlements between the two requests:
   - Model Entitlements
   - Data Entitlements
   - App Entitlements
4. Identifies products that exist in the previous request but not in the current request
5. Displays only requests that have at least one product removal

**Comparison Logic:**
- Products are compared by their product codes
- Handles three types of entitlements separately:
  - **Models**: Compared by `productCode` field
  - **Data**: Compared by `productCode` or `name` field
  - **Apps**: Compared by `productCode` or `name` field

### 3. Display States

**No Removals Found:**
- Green checkmark icon
- Message: "No product removals found"
- Indicates no PS requests with product removals in the selected time period

**Removals Detected:**
- Orange warning triangle icon
- Count of requests with removals
- Expandable list showing details for each request

### 4. Removal Details

**Each removal entry shows:**
- **Current Request Information:**
  - PS request ID (e.g., PS-4330)
  - Request Type badge (New/Update/Termination)
  - Account name
  - Created date
  - "View Record" button

- **Removal Information:**
  - Previous request ID it's being compared to
  - Previous request creation date
  - Color-coded badges for each removed product:
    - **Red badges**: Model removals
    - **Orange badges**: Data removals
    - **Yellow badges**: App removals
  - Total count of removed products

### 5. Integration with Provisioning Monitor

**View Record Button:**
- Clicking "View Record" navigates to the Provisioning Monitor
- Automatically searches for the exact PS request
- Uses exact match filtering to show only the selected request
- Provides seamless navigation between monitoring views

## Technical Implementation

### Backend Components

#### API Endpoint

**Route:** `GET /api/provisioning/removals`

**Query Parameters:**
- `timeFrame` (optional): `1d`, `1w`, `1m`, or `1y` (default: `1w`)

**Response Format:**
```json
{
  "success": true,
  "requests": [
    {
      "currentRequest": {
        "id": "a0X...",
        "name": "PS-4330",
        "account": "Example Corp",
        "status": "Completed",
        "requestType": "Update",
        "createdDate": "2024-09-15T10:00:00Z"
      },
      "previousRequest": {
        "id": "a0X...",
        "name": "PS-4280",
        "createdDate": "2024-08-01T10:00:00Z"
      },
      "removals": {
        "hasRemovals": true,
        "removedModels": [
          {
            "productCode": "MODEL-123",
            "name": "Model Name",
            "type": "Model"
          }
        ],
        "removedData": [],
        "removedApps": [],
        "totalCount": 1,
        "summary": "1 Model(s), 0 Data, 0 App(s)"
      }
    }
  ],
  "totalCount": 1,
  "timeFrame": "1w",
  "startDate": "2024-09-23",
  "timestamp": "2024-09-30T12:00:00Z"
}
```

#### Salesforce Module Functions

**Main Function:** `getPSRequestsWithRemovals(timeFrame)`
- Fetches PS requests in the time period
- Groups requests by account
- Finds previous request for each account
- Compares payloads to detect removals
- Returns list of requests with removals

**Helper Function:** `findRemovedProducts(previousPayload, currentPayload)`
- Compares two payload objects
- Identifies removed products in each category
- Returns structured removal data

### Frontend Components

#### HTML Structure

**Widget Container:**
```html
<div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
  <!-- Header with title and time frame selector -->
  <div id="removals-status"><!-- Status display --></div>
  <div id="removals-list"><!-- List of removals --></div>
</div>
```

#### JavaScript Functions

**Initialization:** `initializePSRemovalsMonitoring()`
- Sets up event listeners
- Loads initial data

**Data Fetching:** `fetchPSRemovals()`
- Calls API endpoint
- Handles loading state
- Displays results or errors

**Display Functions:**
- `displayRemovalsResults(data)`: Renders removal entries
- `displayRemovalsError(errorMessage)`: Shows error state

**Navigation:** `viewPSRecordExact(recordId, recordName)`
- Navigates to Provisioning Monitor
- Sets exact match filter
- Ensures only the selected record is shown

### Styling

**Color Scheme:**
- **Widget Icon**: Orange (indicates removal/warning)
- **No Removals Status**: Green (success state)
- **Removals Detected**: Orange (warning state)
- **Model Badges**: Red background
- **Data Badges**: Orange background
- **App Badges**: Yellow background

**Visual Design:**
- Consistent with existing dashboard widgets
- Card-based layout with hover effects
- Responsive design for mobile/tablet/desktop
- Clear visual hierarchy

## User Workflows

### Workflow 1: Monitor Recent Removals

1. Navigate to **Dashboard**
2. Locate **Product Removals Monitor** widget
3. Default view shows removals from the last week
4. Review count and status indicator
5. If removals exist, scroll through the list
6. Click on any entry to expand details

### Workflow 2: Check Historical Removals

1. Navigate to **Dashboard**
2. Locate **Product Removals Monitor** widget
3. Click **Time Frame** dropdown
4. Select desired period (1 day, 1 month, or 1 year)
5. Widget automatically refreshes with new data
6. Review historical removal patterns

### Workflow 3: Investigate Specific Removal

1. Find a removal entry of interest
2. Review the removed products list
3. Note the previous request ID for comparison
4. Click **View Record** button
5. System navigates to Provisioning Monitor
6. View full request details
7. Use Account History feature to see complete chronological evolution

## Performance Considerations

### Optimization Strategies

1. **Limited Result Set**: Maximum 1000 requests fetched per time period
2. **Account Grouping**: Efficient grouping to minimize API calls
3. **Caching**: Browser caching of API responses
4. **Progressive Loading**: Widget loads independently of other dashboard components
5. **Lazy Rendering**: List items rendered only when data is available

### Scalability

- **Query Optimization**: Uses indexed fields (Account__c, CreatedDate)
- **Pagination Ready**: Backend supports limiting results
- **Client-Side Processing**: Minimal server-side processing

## Error Handling

### Error Scenarios

1. **No Salesforce Connection**: Shows error message with connection instructions
2. **API Timeout**: Displays network error with retry suggestion
3. **No Data Found**: Shows friendly "No removals" message
4. **Invalid Time Frame**: Falls back to default (1 week)

### Error Messages

- Clear, user-friendly language
- Red error icon for visibility
- Actionable guidance when possible
- Console logging for debugging

## Integration Points

### Dependencies

- **Salesforce Integration**: Requires valid Salesforce connection
- **Payload Data**: Depends on `Payload_Data__c` field structure
- **Provisioning Monitor**: Integration for "View Record" navigation
- **Account History**: Complementary feature for detailed tracking

### Data Sources

- **Prof_Services_Request__c** Salesforce object
- **Payload_Data__c** JSON field containing entitlement data
- Product codes from model, data, and app entitlements

## Testing

### Manual Testing Checklist

- [ ] Widget displays correctly on dashboard
- [ ] Time frame selector works (1d, 1w, 1m, 1y)
- [ ] Loading state shows while fetching data
- [ ] "No removals" state displays correctly
- [ ] Removals list renders with correct data
- [ ] Product badges show correct types and colors
- [ ] "View Record" button navigates correctly
- [ ] Error handling works for network failures
- [ ] Responsive design works on mobile/tablet
- [ ] Widget updates when time frame changes

### Test Scenarios

**Scenario 1: Account with Removal**
- Account has 2+ PS requests
- Later request removes at least one product
- Expected: Request appears in widget with removal details

**Scenario 2: Account with Only Additions**
- Account has 2+ PS requests
- Later request only adds products (no removals)
- Expected: Request does NOT appear in widget

**Scenario 3: New Account**
- Account has only 1 PS request
- No previous request to compare against
- Expected: Request does NOT appear in widget

**Scenario 4: Multiple Product Types Removed**
- Request removes models, data, and apps
- Expected: All removal types shown with correct badges

## Future Enhancements

### Potential Features

1. **Email Notifications**: Alert when removals are detected
2. **Export Functionality**: Export removal report to CSV/Excel
3. **Trending Analysis**: Show removal trends over time
4. **Account Filtering**: Filter by specific accounts
5. **Product Type Filtering**: Show only specific product type removals
6. **Comparison View**: Side-by-side comparison of before/after
7. **Approval Workflow**: Flag removals requiring approval
8. **Historical Charts**: Visualize removal patterns

### Known Limitations

1. **No Real-Time Updates**: Requires manual refresh
2. **1000 Request Limit**: May not show all removals in very large datasets
3. **Single Previous Request**: Only compares to immediate previous request
4. **No Batch Actions**: Can't perform actions on multiple removals at once

## Troubleshooting

### Common Issues

**Issue: No data showing even when removals exist**
- **Solution**: Check Salesforce connection in Settings
- **Solution**: Verify time frame selection includes relevant dates
- **Solution**: Check browser console for API errors

**Issue: "View Record" button not working**
- **Solution**: Ensure Provisioning Monitor page is accessible
- **Solution**: Check that PS request ID is valid
- **Solution**: Refresh the page and try again

**Issue: Incorrect removal count**
- **Solution**: Verify payload data structure in Salesforce
- **Solution**: Check that product codes are populated correctly
- **Solution**: Review comparison logic for edge cases

**Issue: Performance is slow**
- **Solution**: Select a shorter time frame (1d or 1w)
- **Solution**: Check network connection
- **Solution**: Clear browser cache and reload

## Changelog

### Version 1.0 (Initial Release)
- ✅ Basic removal detection functionality
- ✅ Time frame selector (1d, 1w, 1m, 1y)
- ✅ Color-coded product badges
- ✅ Integration with Provisioning Monitor
- ✅ Responsive design
- ✅ Error handling
- ✅ Loading states

## Support

For issues, questions, or feature requests, please contact the development team or file an issue in the project repository.

---

**Last Updated:** September 30, 2024  
**Feature Version:** 1.0  
**Status:** Production Ready

