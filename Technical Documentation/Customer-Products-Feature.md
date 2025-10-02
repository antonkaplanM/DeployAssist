# Customer Products Feature Documentation

## Overview

The **Customer Products** feature provides a comprehensive, region-organized view of all active products for a specific customer account. It aggregates data from all Professional Services (PS) records and displays products grouped by geographic region and category (Models, Data, Apps).

## Location

The Customer Products page is accessible via:
- **Provisioning → Customer Products** in the main navigation
- Direct navigation from Account History page via "View Customer Products" button (if implemented)

## Key Features

### 1. Real-Time Product Aggregation

**Data Source:**
- Queries all PS records for the selected account from Salesforce
- Parses payload data to extract entitlements
- Aggregates and merges products in real-time on each page load

**Active Products Only:**
- Shows only products where `endDate >= today`
- Expired products are automatically filtered out
- Focus on current customer subscriptions

### 2. Smart Product Merging

**Merging Logic:**
- Products are merged based on: `region + category + productCode`
- Same product across multiple PS records is shown as one entry
- Date ranges are aggregated (earliest `startDate`, latest `endDate`)
- All contributing PS records are tracked and displayed

**DataBridge Exception:**
- DataBridge products can have multiple concurrent instances in the same region
- Each DataBridge instance is shown separately
- Tracked by unique combination: `region + category + productCode + PS record ID`

### 3. Geographic Organization

**Region-Based Display:**
- Products are primarily organized by geographic region
- Common regions: North America, Europe, Asia Pacific, etc.
- Each region displays its own product count
- Regions are collapsible for easy navigation

**Region Cards:**
- Header shows region name and total product count
- Clickable to expand/collapse
- Contains category sections (Models, Data, Apps)
- Visual globe icon for easy identification

### 4. Category Breakdown

**Three Product Categories:**

1. **Models** (Blue color scheme)
   - Analytical models and algorithms
   - Grouped by productCode
   - Shows model names and codes

2. **Data** (Green color scheme)
   - Data feeds and datasets
   - Data entitlements
   - Database products

3. **Apps** (Purple color scheme)
   - Application products
   - Includes PackageName field (shows resource allocation)
   - Web applications and services

**Category Features:**
- Each category is collapsible within its region
- Shows product count badge
- Products sorted alphabetically by productCode
- Color-coded for easy visual distinction

### 5. Product Cards

Each product card displays:

**Essential Information:**
- Product Name
- Product Code (monospace font)
- PackageName (for Apps - indicates resource size)
- Geographic Region
- Active period (startDate → endDate)
- Days remaining until expiration

**Status Indicators:**
- 🟢 **Active**: > 90 days remaining (green)
- 🟡 **Expiring Soon**: 30-90 days remaining (yellow)
- 🟠 **Expiring**: < 30 days remaining (orange)

**Source Tracking:**
- Lists all PS records that contributed to this product
- PS record IDs are clickable badges
- Links directly to Provisioning Monitor with exact match

### 6. Search and Discovery

**Account Search:**
- Type-ahead autocomplete for account names
- Minimum 2 characters to trigger search
- 300ms debounce for performance
- Shows account names with request counts

**Search Methods:**
- Type account name directly
- Select from autocomplete dropdown
- Press Enter or click Search button

### 7. Summary Statistics

**Account Summary Card:**
- Account name
- Total active products count
- Last updated information (PS record ID and date)
- Category breakdown (Models, Data, Apps counts)
- Quick action buttons

**Action Buttons:**
- **View Account History**: Navigate to chronological PS record view
- **Clear**: Reset view and return to search state

## User Workflows

### Workflow 1: View Customer Products

1. Navigate to **Provisioning → Customer Products**
2. Type customer account name (e.g., "Bank of America")
3. Select from autocomplete or press Enter
4. View products organized by region
5. Expand/collapse regions and categories as needed
6. Review product details and expiration dates

### Workflow 2: Navigate to Source Records

1. Load customer products for an account
2. Find product of interest
3. Click on any PS record badge (e.g., "PS-1234")
4. System navigates to Provisioning Monitor
5. Shows exact PS record with full details
6. Can view original payload data

### Workflow 3: Cross-Reference with Account History

1. View customer products page
2. Click "View Account History" button
3. System navigates to Account History page with account pre-loaded
4. View chronological changes to products over time
5. See additions, removals, and modifications
6. Return to Customer Products for current state

### Workflow 4: Focus on Specific Region

1. Load customer products
2. See all regions expanded by default
3. Click region header to collapse unwanted regions
4. Focus on specific geographic area
5. Expand/collapse categories within focused region
6. Review products in detail

## Technical Implementation

### Backend Architecture

**API Endpoint:**
```
GET /api/customer-products?account={accountName}
```

**Response Structure:**
```json
{
  "success": true,
  "account": "Bank of America",
  "summary": {
    "totalActive": 15,
    "byCategory": {
      "models": 8,
      "data": 4,
      "apps": 3
    }
  },
  "productsByRegion": {
    "North America": {
      "models": [...],
      "data": [...],
      "apps": [...]
    },
    "Europe": {
      "models": [...],
      "data": [...],
      "apps": [...]
    }
  },
  "lastUpdated": {
    "psRecordId": "PS-4567",
    "date": "2025-09-15T10:30:00Z"
  },
  "psRecordsAnalyzed": 12,
  "timestamp": "2025-10-02T14:30:00Z"
}
```

**Product Object Structure:**
```json
{
  "productCode": "ABC-001",
  "productName": "ABC-MODEL-PRO",
  "packageName": "com.example.app",  // Apps only
  "category": "models",
  "region": "North America",
  "startDate": "2023-01-15",
  "endDate": "2026-01-15",
  "status": "active",
  "daysRemaining": 312,
  "sourcePSRecords": ["PS-4331", "PS-4402", "PS-4567"],
  "isDataBridge": false
}
```

### Frontend Components

**Key Functions:**
- `initializeCustomerProducts()` - Sets up page and event listeners
- `loadCustomerProducts(accountName)` - Fetches data from API
- `renderCustomerProducts(data)` - Updates UI with results
- `renderCustomerProductsRegions(productsByRegion)` - Creates region cards
- `renderCategorySection(name, products, color)` - Creates category sections
- `renderProductCard(product, color)` - Displays individual product
- `toggleRegionSection(regionId)` - Handles region collapse/expand
- `toggleCustomerProductsCategory(categoryId)` - Handles category collapse/expand
- `navigateToProvisioningWithExactMatch(psId)` - Links to source record

**State Management:**
```javascript
currentCustomerProducts = {
    accountName: "Bank of America",
    data: {...} // Full API response
}
```

### Data Aggregation Algorithm

**Step 1: Query PS Records**
```sql
SELECT Id, Name, Account__c, Payload_Data__c, CreatedDate, LastModifiedDate
FROM Prof_Services_Request__c
WHERE Account__c = '{accountName}'
ORDER BY CreatedDate DESC
LIMIT 1000
```

**Step 2: Parse and Filter**
- Extract entitlements from `Payload_Data__c`
- Parse JSON structure: `properties.provisioningDetail.entitlements`
- Filter out products where `endDate < today`

**Step 3: Merge Products**
- Create unique key: `region|category|productCode` (or include PS ID for databridge)
- Group products by unique key
- Aggregate: earliest startDate, latest endDate
- Collect all source PS record IDs

**Step 4: Organize by Region**
- Group products by region
- Within each region, separate into categories
- Sort products alphabetically by productCode

**Step 5: Calculate Status**
- Active: daysRemaining > 90
- Expiring Soon: 30 < daysRemaining <= 90
- Expiring: 0 < daysRemaining <= 30

### Performance Considerations

**Real-Time Aggregation:**
- No caching or pre-computation
- Fresh data on every request
- Typical response time: 1-3 seconds
- Scales to ~1000 PS records per account

**Future Optimization Options:**
- Redis caching with TTL
- Background refresh jobs
- Database materialized views
- Incremental updates

## Design Principles

### Visual Hierarchy

1. **Account Summary** (Top level)
   - Shows overall statistics
   - Quick actions

2. **Region Cards** (Primary grouping)
   - Collapsible for focus
   - Geographic organization

3. **Category Sections** (Secondary grouping)
   - Collapsible within regions
   - Color-coded by type

4. **Product Cards** (Detail level)
   - All essential information
   - Clickable source links

### Color Scheme

- **Blue**: Models (analytical products)
- **Green**: Data (data feeds and sources)
- **Purple**: Apps (applications)
- **Status Colors**: Green (active), Yellow (expiring soon), Orange (expiring)

### Responsive Design

- **Desktop**: Full multi-column layout
- **Tablet**: Stacked regions with optimized spacing
- **Mobile**: Single column, full-width cards
- All collapsible sections maintain functionality across devices

## Integration Points

### Account History Integration

**Bidirectional Navigation:**
- Customer Products → Account History: "View Account History" button
- Account History → Customer Products: (Future) "View Customer Products" button

**Complementary Views:**
- Customer Products: Current state, organized by region
- Account History: Timeline view, organized chronologically

### Provisioning Monitor Integration

**Exact Match Navigation:**
- Click PS record badge in Customer Products
- System sets `exactMatchFilter = psId`
- Navigates to Provisioning Monitor
- Shows only the exact PS record (no partial matches)

**Example:**
- Click "PS-89" → Shows only PS-89
- Does NOT show: PS-898, PS-8901, PS-890

### Salesforce Integration

**Data Source:**
- Direct queries to Salesforce via jsforce
- Reads Prof_Services_Request__c objects
- Parses Payload_Data__c JSON field

**Authentication:**
- Uses OAuth 2.0 client credentials flow
- Token stored in `.salesforce_auth.json`
- Automatic token refresh

## Testing

### E2E Test Coverage

- ✅ Navigation to Customer Products page
- ✅ Search functionality with autocomplete
- ✅ Results display with summary cards
- ✅ Region collapse/expand
- ✅ Category collapse/expand
- ✅ Product card display
- ✅ Action buttons (View Account History, Clear)
- ✅ Navigation to Provisioning Monitor
- ✅ Error handling
- ✅ Responsive design (mobile/tablet)

**Test File:** `tests/e2e/customer-products.spec.ts`

### Integration Test Coverage

- ✅ API endpoint validation
- ✅ Request parameter handling
- ✅ Response structure verification
- ✅ Data aggregation logic
- ✅ Product merging
- ✅ Active products filtering
- ✅ Category counts consistency
- ✅ Error handling
- ✅ Performance testing

**Test File:** `tests/integration/customer-products-api.spec.js`

### Running Tests

```bash
# Run all tests
npm test

# Run E2E tests only
npm run test:e2e

# Run specific test file
npx jest tests/integration/customer-products-api.spec.js
npx playwright test tests/e2e/customer-products.spec.ts
```

## API Reference

### GET /api/customer-products

**Description:** Fetches and aggregates all active products for a customer account.

**Query Parameters:**
- `account` (required): Customer account name

**Success Response (200):**
```json
{
  "success": true,
  "account": "string",
  "summary": {
    "totalActive": "number",
    "byCategory": {
      "models": "number",
      "data": "number",
      "apps": "number"
    }
  },
  "productsByRegion": {
    "{regionName}": {
      "models": "array",
      "data": "array",
      "apps": "array"
    }
  },
  "lastUpdated": {
    "psRecordId": "string",
    "date": "ISO8601 string"
  },
  "psRecordsAnalyzed": "number",
  "timestamp": "ISO8601 string"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Account name is required"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Error message",
  "account": "string",
  "productsByRegion": {}
}
```

## Troubleshooting

### Common Issues

**Issue: Search returns no results**
- **Solution**: Verify account name is correct (case-sensitive)
- **Solution**: Check if account has any PS records in Salesforce
- **Solution**: Verify Salesforce authentication is valid

**Issue: Products not appearing**
- **Solution**: Check if products have valid end dates
- **Solution**: Verify products are not expired (endDate < today)
- **Solution**: Check payload data format in PS records

**Issue: Duplicate products in same region**
- **Solution**: Expected for DataBridge products (can have multiple instances)
- **Solution**: For non-DataBridge, report as potential bug

**Issue: Region sections not collapsing**
- **Solution**: Check browser console for JavaScript errors
- **Solution**: Refresh the page
- **Solution**: Clear browser cache

**Issue: PS record links not working**
- **Solution**: Ensure Provisioning Monitor page is accessible
- **Solution**: Check if PS record exists in Salesforce
- **Solution**: Verify exactMatchFilter is being set correctly

**Issue: Slow page load**
- **Solution**: Expected for accounts with many PS records (>500)
- **Solution**: Wait for aggregation to complete (up to 10 seconds)
- **Solution**: Consider future caching implementation

### Debug Mode

**Enable console logging:**
```javascript
// In browser console
localStorage.setItem('debug', 'true');
// Reload page
```

**Check API calls:**
```javascript
// In browser console, after loading products
console.log(currentCustomerProducts);
```

## Future Enhancements

### Potential Features

1. **Export Functionality**
   - Export products to CSV/Excel
   - Include all product details and source PS records
   - Filter by region or category

2. **Timeline View**
   - Visual timeline of product additions/removals
   - Integration with Account History comparison
   - Animated product lifecycle

3. **Product Comparison**
   - Compare products across regions
   - Highlight regional differences
   - Identify gaps in coverage

4. **Caching Layer**
   - Redis cache with configurable TTL
   - Background refresh jobs
   - Faster page loads

5. **Advanced Filtering**
   - Filter by product status (active/expiring)
   - Filter by date range
   - Filter by specific product codes

6. **Notifications**
   - Alert for expiring products
   - Email notifications for administrators
   - Dashboard widget showing expiring count

7. **Historical Snapshots**
   - Save product state at specific dates
   - Compare current vs. historical state
   - Trend analysis over time

8. **Bulk Actions**
   - Select multiple products
   - Bulk export
   - Bulk operations (if applicable)

### Known Limitations

1. **Real-Time Only**: No historical snapshots (current state only)
2. **1000 Record Limit**: Queries limited to 1000 PS records per account
3. **No Server-Side Filtering**: All filtering done client-side after load
4. **No Caching**: Fresh query on every page load
5. **Salesforce Dependent**: Requires valid Salesforce connection

## Changelog

### Version 1.0 (Current)

**Initial Release:**
- ✅ Real-time product aggregation
- ✅ Region-based organization
- ✅ Collapsible regions and categories
- ✅ Smart product merging
- ✅ Active products filtering
- ✅ Status indicators (active/expiring soon/expiring)
- ✅ Integration with Account History
- ✅ Integration with Provisioning Monitor
- ✅ Autocomplete search
- ✅ Summary statistics
- ✅ Responsive design
- ✅ E2E and integration tests
- ✅ Comprehensive documentation

## Support

For issues, questions, or feature requests:
1. Check this documentation first
2. Review troubleshooting section
3. Check browser console for errors
4. Contact development team
5. File an issue in the project repository

## Related Documentation

- [Account History Feature](./Account-History-Feature.md)
- [Expiration Monitor Feature](./Expiration-Monitor-Feature.md)
- [Testing Strategy](./Testing-Strategy.md)
- [Integration Architecture](./Integration-Architecture.md)

