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

### 8. Flexible Side-by-Side Comparison

**Selection Feature:**
- Checkbox in each table row for selecting PS records
- Select any 2 records to compare side-by-side
- Maximum 2 records can be selected at a time

**Comparison Button:**
- **View Side-by-Side** button located above the table
- Enabled only when exactly 2 records are selected
- Opens detailed comparison modal showing product differences

**How It Works:**
1. Check the boxes next to any 2 PS records in the table
2. Click "View Side-by-Side" button (becomes enabled when 2 are selected)
3. Modal displays detailed side-by-side product comparison
4. Shows added, removed, and unchanged products for Models, Data, and Apps
5. Use "Clear Selection" to unselect all records

**Comparison Logic:**
- The **higher PS number** is always shown as "current" (newer/right side)
- The **lower PS number** is always shown as "previous" (older/left side)
- Modal header shows: `PS-[lower] → PS-[higher]`
- This ensures consistent comparison direction regardless of selection order

**Product Status Categories:**
1. **Added** (Green): Product exists in higher PS number but not in lower PS number
2. **Removed** (Red): Product exists in lower PS number but not in higher PS number
3. **Updated** (Yellow): Product exists in both PS records but with different attributes
   - Shows product on single row with side-by-side comparison
   - Highlights changed attributes with yellow cell background
   - Displays all product attributes for both versions
   - Lists which specific attributes changed
4. **Unchanged** (Blue): Product exists in both PS records with identical attributes
   - Displayed directly in the table alongside other products
   - All products sorted alphabetically by product code

**Attribute-Level Comparison:**
- **Models**: Product Code, Start Date, End Date, Product Modifier
- **Data Entitlements**: Product Code, Start Date, End Date, Product Modifier
- **App Entitlements**: Product Code, Package Name, Quantity, Start Date, End Date, Product Modifier
- Each product category (Models/Data/Apps) is in a collapsible section
- Sections with changes (Added/Removed/Updated) are **expanded by default**
- Sections with only unchanged products are **collapsed by default**
- All attributes are shown for every product in all categories
- Changed attributes are visually highlighted with yellow background for easy identification

**Benefits:**
- Compare any two requests, not just sequential ones
- Flexible comparison across different deployment numbers
- Consistent comparison direction based on PS numbers
- Easy to understand visual representation of changes
- Compare older requests with newer ones to see long-term evolution

**Note:** This is separate from the "Show Product Changes" toggle, which automatically compares each request with its chronological predecessor.

### 9. Actions Dropdown

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

### 10. Integration with Provisioning Monitor

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

### Workflow 5: Flexible Side-by-Side Comparison

1. Load account history for any account
2. Review the list of PS records in the table
3. Check the box next to the first record you want to compare
4. Check the box next to the second record you want to compare
5. Click "View Side-by-Side" button (now enabled)
6. Review detailed comparison modal with collapsible sections:
   - **Comparison Direction**: Always shows PS-[lower] → PS-[higher] regardless of selection order
   - **Smart Section States**: 
     - Sections with changes are expanded by default
     - Sections with only unchanged products are collapsed by default
     - Click section header to expand/collapse
   - **Product Code**: First column showing the product identifier
   - **PS-[lower] Columns**: All attributes from the previous PS record
   - **PS-[higher] Columns**: All attributes from the current PS record
   - **Status Column**: Shows whether each product is Added/Removed/Updated/Unchanged
   - **Added products** (green rows): Present in higher PS, absent in lower
   - **Removed products** (red rows): Present in lower PS, absent in higher
   - **Updated products** (yellow rows): Present in both but with different attributes
     - Changed attributes have yellow cell background
     - Easy to see which specific fields changed
   - **Unchanged products** (blue rows): Present in both with identical attributes
7. Each section shows summary stats: Total | Added | Removed | Updated | Unchanged
8. All products sorted alphabetically by product code for easy navigation
9. Close modal and optionally select different records
10. Click "Clear Selection" to reset and start over

**Use Cases:**
- Compare first request with latest request to see overall evolution
- Compare requests from different deployment numbers
- Compare non-sequential requests to understand specific changes
- Verify product additions/removals between any two points in time
- Identify which specific attributes changed for a product (quantity, dates, etc.)
- Audit product configuration changes over time

**Example:**
- Select PS-100 and PS-200
- Modal shows: PS-100 → PS-200
- Product "APP-XYZ" appears in both but with different quantity:
  - Status: **Updated** (yellow background)
  - PS-100: Quantity: 5, Transactions: 10,000
  - PS-200: Quantity: 10, Transactions: 10,000 (unchanged)
  - Changed attributes: quantity (highlighted)
- Product "MODEL-ABC" only in PS-200:
  - Status: **Added** (green background)
  - Shows all attributes: Product Code, Description, Valid From, Valid To

### Workflow 6: Navigate to Provisioning Monitor

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
    limit: 5,                 // Display limit (5, 10, 25, 50, or null for all)
    deploymentFilter: '',     // Deployment number filter
    selectedRecords: []       // Selected record IDs for flexible comparison (max 2)
}
```

### Key Functions

- `initializeAccountHistory()`: Sets up event listeners
- `handleAccountHistorySearch()`: Debounced search handler
- `selectAccountOrRequest()`: Handles selection from search results
- `loadAccountHistory()`: Fetches requests for account
- `renderAccountHistoryTable()`: Renders table with limit applied
- `renderRequestRow()`: Renders individual request rows
- `renderRequestDetails()`: Renders expandable details
- `renderEntitlementsSummary()`: Renders collapsible product categories
- `toggleDetailProductGroup()`: Handles category collapse/expand
- `toggleRecordSelection()`: Handles checkbox selection for comparison (max 2)
- `updateComparisonButtonState()`: Enables/disables comparison button based on selection
- `showFlexibleComparison()`: Opens side-by-side modal with selected records (ensures higher PS is always "current")
- `clearRecordSelection()`: Clears all selected records and checkboxes
- `showDetailedComparisonModal()`: Displays side-by-side comparison modal with attribute-level comparison
- `renderEnhancedComparisonTable()`: Renders detailed comparison with Added/Removed/Updated/Unchanged categories
- `compareProducts()`: Helper function to detect attribute-level changes between product lists
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
- ✅ Flexible side-by-side comparison (select any 2 records)
- ✅ Checkbox selection (max 2 records)
- ✅ Comparison button enable/disable logic
- ✅ Clear selection functionality
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
4. ~~**Diff View Toggle**: Side-by-side comparison view~~ ✅ **Implemented** (Flexible Side-by-Side Comparison)
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

### Version 1.4 (Latest)
- ✅ Added flexible side-by-side comparison feature
- ✅ Added checkbox selection for any 2 PS records
- ✅ Added "View Side-by-Side" comparison button
- ✅ Added "Clear Selection" functionality
- ✅ Comparison button enables/disables based on selection count
- ✅ Can now compare any two records, not just sequential ones
- ✅ Comparison always shows higher PS number as "current" and lower as "previous"
- ✅ Ensures consistent comparison direction regardless of selection order
- ✅ **Enhanced comparison with attribute-level detection**:
  - **Added** status: Product exists in one PS but not the other
  - **Removed** status: Product exists in one PS but not the other
  - **Updated** status: Product exists in both but with different attributes
  - **Unchanged** status: Product exists in both with identical attributes
- ✅ Updated products show side-by-side comparison with highlighted changes
- ✅ All product attributes are displayed for every category
- ✅ Changed attributes are visually highlighted with yellow cell background
- ✅ **Smart collapsible sections**:
  - Each product category (Models/Data/Apps) in collapsible section
  - Sections with changes (Added/Removed/Updated) expanded by default
  - Sections with only unchanged products collapsed by default
  - Chevron icon rotates to indicate expand/collapse state
  - Section headers show "Has Changes" or "No Changes" indicator
  - Products sorted alphabetically by product code within each section
  - Clean side-by-side layout with PS-[lower] | PS-[higher] | Status columns
- ✅ **Updated column structure**:
  - Models: Product Code, Start Date, End Date, Product Modifier
  - Data: Product Code, Start Date, End Date, Product Modifier
  - Apps: Product Code, Package Name, Quantity, Start Date, End Date, Product Modifier

### Version 1.3
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
