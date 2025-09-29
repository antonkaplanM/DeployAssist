# Account History Feature Documentation

## Overview

The **Account History** feature provides a comprehensive view of all Technical Team Requests associated with a specific account, displaying the chronological evolution of product entitlements over time. This feature enables users to track product changes, understand account configurations, and quickly navigate to specific requests.

## Location

The Account History page is accessible via:
- **Analytics → Account History** in the main navigation
- **View Account History** button on the Analytics Overview page
- **View Account History** link in the Provisioning Monitor (from individual requests)

## Key Features

### 1. Smart Search

**Dual Search Capability:**
- Search by **Account Name** (e.g., "Bank of America")
- Search by **PS-ID** (Technical Team Request ID, e.g., "PS-4331")

**Auto-detection:**
- Automatically detects whether you're searching for an account or a PS-ID
- Provides autocomplete suggestions as you type (debounced for performance)

**Search Behavior:**
- Minimum 2 characters required
- 300ms debounce delay
- Real-time results dropdown
- Shows both accounts and matching PS-IDs

### 2. Account Summary Display

When an account is selected, the page displays:
- **Account Name**: The selected account
- **Total Request Count**: Number of Technical Team Requests
- **Date Range**: From oldest to newest request
- **Displayed Count**: How many requests are currently shown (based on limit)

### 3. Configurable Record Limit

**Default Behavior:**
- Shows **latest 5 requests** by default
- Displays most recent requests first (descending chronological order)

**Options:**
- Latest 5
- Latest 10
- Latest 25
- Latest 50
- All Requests

**Count Indicator:**
- Shows "Showing latest X of Y requests" when limited
- Shows "Showing all Y requests" when all are displayed

### 4. Request History Table

**Columns:**
1. **Expand**: Chevron icon to expand/collapse details
2. **Request ID**: PS-ID with timestamp badge
3. **Date**: Created date
4. **Status**: Request status
5. **Type**: Request type (New/Update/Termination)
6. **Products**: Collapsible product summary (Models/Data/Apps)
7. **Actions**: Dropdown menu with options

**Table Features:**
- Sorted by created date (descending - newest first when limited)
- Expandable rows for detailed information
- Clickable product categories
- Responsive design

### 5. Product Display

**Main Table - Collapsible View:**
- Models: `M:X` (collapsible button)
- Data: `D:X` (collapsible button)
- Apps: `A:X` (collapsible button)

**Click Behavior:**
- Clicking any product category button opens a modal
- Modal shows full product details with:
  - Request name
  - Product group type
  - Complete list of products
  - Product codes
  - Validation status (if applicable)

**Detail View - Collapsible Sections:**
- When expanding a request row, product categories are collapsible
- Click to expand/collapse individual categories
- Shows full product details inline

### 6. Expandable Request Details

**Information Displayed:**
- **Request Information:**
  - Salesforce ID
  - Created Date
  - Status
  - Request Type
  - Deployment Status
  - Billing Status

- **Product Entitlements:**
  - Collapsible categories (Models/Data/Apps)
  - Product codes
  - Entitlement details

- **Product Comparison** (when enabled):
  - Shows changes from previous request
  - Highlights added products (green)
  - Highlights removed products (red)
  - Only available for requests after the first one

### 7. Product Change Comparison

**Toggle Feature:**
- Checkbox: "Show Product Changes"
- Located above the history table

**When Enabled:**
- Expands each request to show comparison
- Compares with chronologically previous request
- Shows:
  - **Added Products**: Green background
  - **Removed Products**: Red/orange background
  - **Unchanged Products**: Default styling

**Logic:**
- Requests are sorted descending (newest first)
- Comparison is with the next item in array (chronologically older)
- First/oldest request has no comparison

### 8. Actions Dropdown

**Menu Options:**
- **View in Provisioning Monitor**: Navigate to Provisioning Monitor with exact search

**Behavior:**
- Three-dot menu button (⋮) in Actions column
- Click to open dropdown
- Click option to execute action
- Automatically closes when:
  - Clicking an action
  - Clicking outside the dropdown
  - Opening another dropdown

### 9. Integration with Provisioning Monitor

**Exact Match Navigation:**
- When clicking "View in Provisioning Monitor" from Account History
- Automatically searches for the exact PS-ID in Provisioning Monitor
- Uses `exactMatchFilter` flag to ensure only exact matches are shown
- Example: Selecting PS-89 will NOT show PS-898 or PS-8901

**Filter Clearing:**
- Filter automatically clears when user:
  - Types a new search in Provisioning Monitor
  - Selects from type-ahead suggestions
  - Clicks refresh button

## User Workflows

### Workflow 1: Search by Account Name

1. Navigate to **Analytics → Account History**
2. Type account name (e.g., "Bank of America")
3. Select account from dropdown
4. View chronological history (latest 5 by default)
5. Optionally change limit to see more requests
6. Click on request to expand details
7. Use "Show Product Changes" to see evolution

### Workflow 2: Search by PS-ID

1. Navigate to **Analytics → Account History**
2. Type PS-ID (e.g., "PS-4331")
3. Select PS-ID from dropdown
4. System automatically loads associated account's history
5. View all requests for that account
6. Requested PS-ID is included in the table

### Workflow 3: View Product Details

1. Load account history
2. Click on any product category button (M:X, D:X, A:X)
3. Modal opens with full product details
4. Review product codes and entitlements
5. Close modal
6. OR: Expand request row to see inline collapsible categories

### Workflow 4: Track Product Evolution

1. Load account with multiple requests
2. Enable "Show Product Changes" toggle
3. Expand requests to see comparisons
4. Green highlights show newly added products
5. Red highlights show removed products
6. Navigate chronologically to understand changes

### Workflow 5: Navigate to Provisioning Monitor

1. Load account history
2. Find specific request of interest
3. Click actions dropdown (⋮)
4. Select "View in Provisioning Monitor"
5. System navigates and shows exact match only
6. Continue working in Provisioning Monitor

## Technical Implementation

### State Management

```javascript
currentAccountHistory = {
    accountName: null,        // Selected account name
    requests: [],             // Array of requests
    showComparison: false,    // Comparison toggle state
    limit: 5                  // Display limit (5, 10, 25, 50, or null for all)
}
```

### Key Functions

- `initializeAccountHistory()`: Sets up event listeners
- `handleAccountHistorySearch()`: Debounced search handler
- `selectAccountOrRequest()`: Handles selection from search results
- `fetchAccountHistory()`: Fetches requests for account
- `renderAccountHistoryTable()`: Renders table with limit applied
- `renderRequestRow()`: Renders individual request rows
- `renderRequestDetails()`: Renders expandable details
- `renderEntitlementsSummary()`: Renders collapsible product categories
- `toggleDetailProductGroup()`: Handles category collapse/expand
- `viewPSRecordExact()`: Navigates to Provisioning Monitor with exact filter
- `clearAccountHistory()`: Resets page to empty state

### API Endpoints Used

- `GET /api/provisioning/search?search={term}`: Search for accounts/PS-IDs
- `GET /api/provisioning/requests?search={accountName}&limit=100`: Fetch account history

### Exact Match Filter

```javascript
// Global flag for exact matching
let exactMatchFilter = null;

// Set when navigating from Account History
exactMatchFilter = 'PS-4280';

// Applied in renderProvisioningTable()
if (exactMatchFilter && data && data.length > 0) {
    data = data.filter(record => record.Name === exactMatchFilter);
}

// Cleared on user actions:
// - Manual search input
// - Type-ahead selection
// - Refresh button
```

## Styling and UX

### Design Principles

- **Consistent with Provisioning Monitor**: Uses same product display patterns
- **Responsive**: Works on mobile, tablet, and desktop
- **Progressive Disclosure**: Expandable rows prevent information overload
- **Clear Hierarchy**: Visual hierarchy guides user attention
- **Accessible**: Keyboard navigation and ARIA labels

### Visual Indicators

- **Chevron Icons**: Indicate expandable/collapsible state
- **Color Coding** (comparison mode):
  - Green background: Added products
  - Red/orange background: Removed products
- **Badges**: Small badges for timestamps
- **Hover States**: Clear hover states on all interactive elements

## Performance Considerations

### Optimizations

1. **Debounced Search**: 300ms delay prevents excessive API calls
2. **Limited Results**: Default limit of 5 reduces initial render time
3. **Client-Side Sorting**: Sorting done in browser
4. **Event Delegation**: Single listener for product group buttons
5. **Progressive Loading**: Details loaded on-demand (expand)

### Scalability

- **Maximum Fetch**: Limited to 100 requests per account
- **Client-Side Filtering**: All filtering/sorting done client-side
- **Modal Reuse**: Single modal element reused for all product views

## Testing

### E2E Test Coverage

- ✅ Navigation to Account History page
- ✅ Search by account name
- ✅ Search by PS-ID
- ✅ Display limit selector (5, 10, 25, 50, all)
- ✅ Count indicator accuracy
- ✅ Actions dropdown menu
- ✅ Product category modals
- ✅ Collapsible categories in details
- ✅ Product change comparison
- ✅ Exact match navigation to Provisioning Monitor
- ✅ Clear and reset functionality
- ✅ Responsive design (mobile/tablet)

### Integration Test Coverage

- ✅ `/api/provisioning/search` endpoint
- ✅ `/api/provisioning/requests` endpoint
- ✅ Error handling
- ✅ Pagination
- ✅ Sorting

## Future Enhancements

### Potential Features

1. **Export Functionality**: Export account history to CSV/Excel
2. **Advanced Filters**: Filter by date range, request type, status
3. **Timeline Visualization**: Visual timeline of product changes
4. **Diff View Toggle**: Side-by-side comparison view
5. **Bookmark/Favorites**: Save frequently viewed accounts
6. **Notifications**: Alert when account has new requests
7. **Bulk Actions**: Select multiple requests for batch operations
8. **Print View**: Optimized print layout for reporting

### Known Limitations

1. **Maximum 100 Requests**: API limited to 100 requests per account
2. **No Real-Time Updates**: Requires page refresh for new data
3. **Client-Side Only**: No server-side filtering/sorting
4. **No Caching**: Requests fetched every time page is loaded

## Troubleshooting

### Common Issues

**Issue: Search returns no results**
- **Solution**: Ensure search term is at least 2 characters
- **Solution**: Check if account exists in Salesforce
- **Solution**: Verify API connectivity

**Issue: Limit not applying correctly**
- **Solution**: Refresh the page
- **Solution**: Clear browser cache
- **Solution**: Check if limit selector is properly initialized

**Issue: Product comparison not showing**
- **Solution**: Ensure "Show Product Changes" toggle is checked
- **Solution**: Verify account has at least 2 requests
- **Solution**: Expand a request that is not the oldest

**Issue: Modal not opening when clicking product category**
- **Solution**: Check browser console for errors
- **Solution**: Ensure product category has data
- **Solution**: Refresh the page

**Issue: Exact match not working in Provisioning Monitor**
- **Solution**: Check that `exactMatchFilter` is being set
- **Solution**: Verify navigation is using `viewPSRecordExact()`
- **Solution**: Check console logs for filter application

## Changelog

### Version 1.3 (Latest)
- ✅ Added collapsible product categories in detail view
- ✅ Added product category modal support
- ✅ Fixed chronological ordering for product comparison
- ✅ Updated product display to match Provisioning Monitor pattern

### Version 1.2
- ✅ Added configurable limit selector (default 5)
- ✅ Added count indicator
- ✅ Fixed default limit not applying on initial load

### Version 1.1
- ✅ Replaced direct action button with dropdown menu
- ✅ Implemented exact match search in Provisioning Monitor
- ✅ Fixed race condition with filter application

### Version 1.0
- ✅ Initial release
- ✅ Dual search (account name / PS-ID)
- ✅ Chronological display
- ✅ Expandable request details
- ✅ Product change comparison
- ✅ Integration with Provisioning Monitor

## Support

For issues, questions, or feature requests, please contact the development team or file an issue in the project repository.
