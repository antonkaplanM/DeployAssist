# Expiration Monitor - Changelog

## Version 1.1.0 - October 2, 2025

### Bug Fixes
- **Fixed modal data not loading**: Resolved duplicate HTML element IDs (`modal-title` and `modal-content`) that prevented expiration details modal from displaying product data
  - Renamed product modal IDs to `product-modal-title` and `product-modal-content`
  - Updated `showModal()` function to use correct modal elements

- **Fixed incorrect status column**: All items were showing "At-Risk" regardless of actual extension status
  - Updated `salesforce.js` backend logic to default group status to `'extended'`
  - Status only marked as `'at-risk'` if ANY product in the group is not extended
  - Previously defaulted to `'at-risk'` causing incorrect display

- **Fixed data passing issue**: Modal function was unreliably looking up data from global array
  - Changed `showExpirationDetails()` to accept complete item object as parameter
  - Removed array lookup by PS record ID which could fail
  - Ensures reliable data access in modal

### UI Enhancements
- **Updated color scheme** to match specification:
  - Models: Blue badges (`bg-blue-50 text-blue-700`) with 🔵 icon when extended
  - Data: Green badges (`bg-green-50 text-green-700`) with 🟢 icon when extended
  - Apps: Purple badges (`bg-purple-50 text-purple-700`) with 🟣 icon when extended
  - At-Risk: Red badges (`bg-red-50 text-red-700 ring-2 ring-red-600`) with 🔴 icon for all types

- **Enhanced status badges**:
  - At-Risk: Red background with bold ring-2 border for high visibility
  - Extended: Green background with ring-2 border
  - Increased font weight to `font-semibold` for better readability

- **Improved modal category headers**:
  - Color-coded left borders matching product type
  - Dynamic icons based on status (red for at-risk, colored for extended)
  - Text colors match border colors for consistency

### Debug & Logging
- Added comprehensive console logging:
  - `[Expiration]` - Page initialization and data loading
  - `[ExpirationTable]` - Table rendering with status verification
  - `[ExpirationDetails]` - Modal data population
- Logs first 3 items during table render to verify status
- Logs sample item when data loads
- Logs item structure when modal opens

### Documentation
- Updated `Expiration-Monitor-Feature.md` with:
  - Detailed visual indicators section
  - Bug fix documentation
  - Enhanced troubleshooting section
  - Implementation notes and color scheme details
- Added Expiration Monitor section to Help page with:
  - Key features overview
  - Visual indicators guide
  - Usage instructions
  - Extension detection logic explanation
  - Best practices

### Testing
- Created E2E tests (`tests/e2e/expiration-monitor.spec.ts`):
  - Page element visibility tests
  - Filter and control interaction tests
  - Modal functionality tests
  - Status badge verification
  - Console logging verification
  - Empty state handling
  - Navigation tests

- Created Integration tests (`tests/integration/expiration-api.spec.js`):
  - API endpoint response structure tests
  - Parameter handling tests
  - Data integrity validation
  - Authentication handling tests
  - Summary calculation verification
  - Extended product details validation

### Cleanup
- Removed debugging scripts and assets:
  - `check-expiration-data.js`
  - `diagnose-expiration.js`
  - `public/debug-expiration.html`
  - `test-frontend-api.html`
  - `test-refresh-api.js`

---

## Version 1.0.0 - Initial Release

### Features
- 5-year historical analysis of PS records
- Configurable expiration windows (7/30/60/90 days)
- Automatic extension detection
- Database caching for performance
- Grouped display by account and PS record
- Detailed modal with product breakdown

### Database
- Created `expiration_monitor` table with comprehensive indexing
- Created `expiration_analysis_log` table for run tracking
- Setup script: `setup-expiration-monitor.js`

### API Endpoints
- `GET /api/expiration/monitor` - Retrieve expiration data
- `POST /api/expiration/refresh` - Trigger analysis
- `GET /api/expiration/status` - Get analysis status

### Backend Functions
- `analyzeExpirations()` in `salesforce.js`
- `getExpiringEntitlements()` in `salesforce.js`
- 6 new database functions in `database.js`

### Frontend
- Expiration Monitor page with navigation
- Summary cards for quick overview
- Filterable table view
- Product details modal
- Real-time refresh capability

---

## Migration Notes

### From 1.0.0 to 1.1.0
No database migrations required. UI changes are backward compatible.

**Recommended Actions:**
1. Clear browser cache to ensure latest JavaScript/CSS
2. Run "Refresh Analysis" to verify status display is correct
3. Check console logs for any unexpected errors

---

## Known Issues
None at this time.

## Planned Enhancements
- Email notifications for critical expirations
- Export to CSV/Excel functionality
- Scheduled automatic analysis (cron job)
- Integration with Account History page
- Trend analysis over time
- Configurable grace periods for extensions
- Bulk operations (mark as reviewed, add notes)

---

## Support
For issues or questions:
- Technical Documentation: `Expiration-Monitor-Feature.md`
- Integration Details: `Integration-Architecture.md`
- Testing Guide: `Testing-Strategy.md`
- Main README: `../README.md`



