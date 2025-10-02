# Expiration Monitor Feature

## Overview
The Expiration Monitor tracks product entitlements that are expiring within a configurable time window (7, 30, 60, or 90 days). It analyzes 5 years of Professional Services (PS) records to identify expirations and automatically detects if products have been extended by other PS records on the same account.

## Features
- ✅ 5-year historical analysis of PS records
- ✅ Configurable expiration window (7/30/60/90 days)
- ✅ Automatic extension detection
- ✅ Red visual indicators for at-risk products
- ✅ Database caching for fast performance
- ✅ Grouped by account and PS record
- ✅ Detailed modal with product breakdown
- ✅ Direct navigation to Provisioning Monitor for PS records

## Database Tables

### `expiration_monitor`
Stores cached expiration data for fast queries.

**Columns:**
- `id` - Primary key
- `account_id` - Salesforce account ID
- `account_name` - Account display name
- `ps_record_id` - Professional Services request ID
- `ps_record_name` - PS record name (e.g., PS-12345)
- `product_code` - Product identifier
- `product_name` - Product display name
- `product_type` - 'Model', 'Data', or 'App'
- `end_date` - Entitlement expiration date
- `is_extended` - TRUE if extended by another PS record
- `extending_ps_record_id` - ID of extending PS record (if applicable)
- `extending_ps_record_name` - Name of extending PS record
- `extending_end_date` - New end date from extension
- `days_until_expiry` - Calculated days until expiration
- `last_analyzed` - Timestamp of last analysis
- `created_at` - Record creation timestamp

**Indexes:**
- `idx_expiration_end_date` - For date-based queries
- `idx_expiration_account_id` - For account filtering
- `idx_expiration_product_code` - For product lookups
- `idx_expiration_is_extended` - For extension filtering
- `idx_expiration_days_until_expiry` - For urgency sorting
- `idx_expiration_ps_record` - For PS record lookups

### `expiration_analysis_log`
Tracks analysis runs for monitoring and debugging.

**Columns:**
- `id` - Primary key
- `analysis_started` - Analysis start timestamp
- `analysis_completed` - Analysis completion timestamp
- `records_analyzed` - Total PS records processed
- `entitlements_processed` - Total entitlements with end dates
- `expirations_found` - Count of expiring entitlements
- `extensions_found` - Count of detected extensions
- `lookback_years` - Years of historical data analyzed (default: 5)
- `status` - 'running', 'completed', 'failed', or 'schema_initialized'
- `error_message` - Error details if status is 'failed'
- `created_at` - Log entry timestamp

## API Endpoints

### `GET /api/expiration/monitor`
Retrieves expiration data with optional filtering.

**Query Parameters:**
- `expirationWindow` (integer) - Days in the future (default: 30)
- `showExtended` (boolean) - Include extended items (default: true)

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalExpiring": 245,
    "atRisk": 47,
    "extended": 198,
    "accountsAffected": 42
  },
  "expirations": [
    {
      "account": {
        "id": "001...",
        "name": "Acme Corporation"
      },
      "psRecord": {
        "id": "a0X...",
        "name": "PS-12345"
      },
      "expiringProducts": {
        "models": [...],
        "data": [...],
        "apps": [...]
      },
      "status": "at-risk",
      "earliestExpiry": "2025-10-15"
    }
  ],
  "expirationWindow": 30,
  "lastAnalyzed": "2025-10-01T14:30:00Z",
  "timestamp": "2025-10-01T15:00:00Z"
}
```

### `POST /api/expiration/refresh`
Triggers a new expiration analysis (analyzes 5 years of data).

**Request Body:**
```json
{
  "lookbackYears": 5,
  "expirationWindow": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expiration analysis completed successfully",
  "summary": {
    "recordsAnalyzed": 8452,
    "entitlementsProcessed": 25789,
    "expirationsFound": 245,
    "extensionsFound": 198,
    "lookbackYears": 5,
    "expirationWindow": 30,
    "duration": 12.5
  },
  "timestamp": "2025-10-01T15:00:00Z"
}
```

### `GET /api/expiration/status`
Returns information about the last analysis run.

**Response:**
```json
{
  "success": true,
  "hasAnalysis": true,
  "analysis": {
    "lastRun": "2025-10-01T14:30:00Z",
    "lastRunAgo": "2 hours ago",
    "status": "completed",
    "recordsAnalyzed": 8452,
    "entitlementsProcessed": 25789,
    "expirationsFound": 245,
    "extensionsFound": 198,
    "lookbackYears": 5
  }
}
```

## Extension Detection Logic

The system identifies extensions by:

1. **Grouping by Account** - All PS records for the same account are grouped together
2. **Grouping by Product Code** - Within each account, entitlements with the same `productCode` are grouped
3. **Extension Check** - For each expiring entitlement:
   - Look for another PS record (different `ps_record_id`)
   - With the same `productCode`
   - And an `endDate` that is later than the expiring entitlement's `endDate`
   - If found → mark as "Extended" ✓
   - If not found → mark as "At-Risk" ⚠️

## Usage

### Initial Setup
1. Tables are created by running: `node setup-expiration-monitor.js`
2. Start the application
3. Navigate to **Provisioning → Expiration Monitor**
4. Click **"Refresh Analysis"** to analyze 5 years of PS records

### Daily Usage
1. View expiration data in the main table
2. Use filters to adjust expiration window or hide extended items
3. Click **"View Details"** to see product-by-product breakdown
4. Click **"Monitor"** button to view the PS record in Provisioning Monitor
5. Look for 🔴 red indicators for at-risk categories

### Refresh Frequency
- **Recommended:** Daily or weekly
- **Method:** Click "Refresh Analysis" button
- **Duration:** 10-30 seconds depending on data volume
- **Alternative:** Set up a cron job to call `/api/expiration/refresh` periodically

## Visual Indicators

### Table View
- **Product Category Badges:**
  - 🔴 **Red badges with ring-2 border** - Categories containing at-risk products (urgent attention needed)
  - 🔵 **Blue badges** - Models that are extended
  - 🟢 **Green badges** - Data that is extended
  - 🟣 **Purple badges** - Apps that are extended
- **Status Column:**
  - ⚠️ **At-Risk** - Red badge with bold ring-2 border indicating no extension found for one or more products
  - ✓ **Extended** - Green badge with ring-2 border indicating all products are extended

### Detail Modal
- **Product Items:**
  - 🔴 **Red highlighted products** - Individual products with no extension found
  - 🟢 **Green highlighted products** - Individual products extended by another PS record
- **Category Headers:**
  - 🔴 **Red left border** - Category contains at-risk items (red text)
  - 🔵 **Blue left border** - Models category with all products extended (blue text)
  - 🟢 **Green left border** - Data category with all products extended (green text)
  - 🟣 **Purple left border** - Apps category with all products extended (purple text)
- **Extension Details** - Shows extending PS record ID/name and new end date for extended products

## Files Modified/Created

### Database
- `database/init-scripts/02-expiration-monitor.sql` - Table definitions
- `setup-expiration-monitor.js` - Setup script

### Backend
- `database.js` - 6 new functions for expiration data
- `salesforce.js` - 2 functions: `analyzeExpirations()`, `getExpiringEntitlements()`
- `app.js` - 3 API endpoints

### Frontend
- `public/index.html` - Expiration Monitor page + navigation
- `public/script.js` - ~420 lines of expiration monitor logic

## Performance Considerations

### Database Caching
- All expiration data is cached in `expiration_monitor` table
- Queries are fast even with 5 years of historical data
- Indexes optimize filtering by date, account, product, etc.

### Analysis Duration
- Initial analysis: 10-30 seconds for 5 years of data
- Subsequent queries: < 1 second (using cache)
- Refresh when: Data freshness requirements demand it

### Optimization Tips
- Schedule analysis during off-peak hours
- Consider reducing lookback period if not needed (e.g., 3 years instead of 5)
- Monitor `expiration_analysis_log` for performance trends

## Troubleshooting

### No Data Showing
- Verify Salesforce authentication is configured
- Click "Refresh Analysis" to populate data
- Check browser console for errors (look for `[Expiration]` log messages)
- Verify database tables exist: `node -e "const db = require('./database'); db.query('SELECT COUNT(*) FROM expiration_monitor').then(r => console.log(r.rows));"`

### Modal Opens But Shows No Data
- Check browser console for `[ExpirationDetails]` messages
- Verify the data structure includes `expiringProducts` with `models`, `data`, and `apps` arrays
- Ensure modal IDs are unique (no duplicate `modal-title` or `modal-content` IDs)

### All Items Show "At-Risk" Status
- Verify backend logic defaults group status to `'extended'` (not `'at-risk'`)
- Check that `is_extended` flag is properly set in database
- Review console logs showing item status during table render

### Analysis Takes Too Long
- Check network connection to Salesforce
- Consider reducing `lookbackYears` in refresh request
- Monitor logs for Salesforce API rate limiting

### Incorrect Extension Detection
- Verify product codes match exactly between PS records (case-sensitive)
- Check that accounts are correctly associated
- Review `expiration_monitor` table for specific cases
- Ensure extension logic checks for different PS record ID with same product code

## Implementation Notes

### Bug Fixes (October 2025)
1. **Modal Data Not Loading**: Fixed duplicate HTML element IDs (`modal-title` and `modal-content`) that prevented the expiration details modal from displaying data correctly. Product modal IDs renamed to `product-modal-title` and `product-modal-content`.

2. **Status Column Incorrect**: Fixed backend grouping logic in `salesforce.js` to default status to `'extended'` and only mark as `'at-risk'` if ANY product is not extended. Previously all items incorrectly showed as at-risk.

3. **Data Passing Issue**: Changed `showExpirationDetails()` to accept the complete item object instead of performing array lookup by PS record ID, ensuring reliable data access.

### Color Scheme Implementation
- **Models**: Blue (`bg-blue-50 text-blue-700`) when extended, 🔵 icon
- **Data**: Green (`bg-green-50 text-green-700`) when extended, 🟢 icon
- **Apps**: Purple (`bg-purple-50 text-purple-700`) when extended, 🟣 icon
- **At-Risk**: Red (`bg-red-50 text-red-700 ring-2 ring-red-600`) for all types, 🔴 icon

### Debug Logging
The implementation includes comprehensive console logging:
- `[Expiration]` - Main page initialization and data loading
- `[ExpirationTable]` - Table rendering and status display
- `[ExpirationDetails]` - Modal data population

## Recent Enhancements

### Navigation to Provisioning Monitor (October 2025)
Added a **"Monitor"** button in the Actions column that allows users to:
- Click to navigate directly from Expiration Monitor to Provisioning Monitor
- Automatically search for and display the specific PS record
- Use exact match filtering to show only the selected PS record
- Seamlessly switch between expiration tracking and detailed provisioning view

This enhancement provides quick access to full PS record details without manual searching.

## Future Enhancements
- Email notifications for critical expirations
- Export to CSV/Excel functionality
- Scheduled automatic analysis (cron job)
- Trend analysis over time
- Configurable grace periods for extensions
- Bulk operations (e.g., mark as reviewed, add notes)

## Testing
- **E2E Tests**: `tests/e2e/expiration-monitor.spec.ts`
- **Integration Tests**: `tests/integration/expiration-api.spec.js`
- See `Testing-Strategy.md` for test coverage details

## Support
For issues or questions, refer to:
- Main README: `../README.md`
- Integration Architecture: `Integration-Architecture.md`
- Database Setup: `PostgreSQL-Setup-Complete.md`
- Testing Strategy: `Testing-Strategy.md`

