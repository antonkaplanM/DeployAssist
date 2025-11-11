# PS Record Audit Trail Implementation

## Overview

The PS Record Audit Trail system tracks the complete history of Professional Services records, capturing snapshots over time to monitor status changes and maintain a full audit trail. This enables analysis of record processing times and status transitions.

## Features

✅ **Complete Record History**: Captures all PS record data over time  
✅ **Status Change Tracking**: Automatically detects and records status changes  
✅ **Timeline Visualization**: Visual timeline showing status transitions  
✅ **Search Functionality**: Search by PS record name or Salesforce ID  
✅ **Statistics Dashboard**: Overview of total records, snapshots, and changes  
✅ **Page Entitlements**: Role-based access control integrated  
✅ **API Endpoints**: RESTful APIs for querying audit data  

## Database Schema

### Tables Created

**`ps_audit_trail`**: Main table storing PS record snapshots
- Tracks all record data displayed on the provisioning monitor
- Captures: status, request type, deployment, tenant, account, etc.
- Indexed for fast queries by record ID, name, status, and capture time

**`ps_audit_log`**: Metadata table for analysis runs
- Tracks capture operations and their results
- Useful for monitoring and debugging

### Views

**`ps_audit_latest`**: Latest snapshot for each PS record
- Optimized for quick lookups of current state

### Functions

- `get_ps_audit_trail(identifier)`: Get complete history for a PS record
- `get_ps_status_changes(identifier)`: Get status change timeline
- `get_ps_audit_stats()`: Get system-wide statistics

## Setup Instructions

### 1. Initialize Database Schema

```bash
node setup-ps-audit-trail.js
```

This creates the necessary database tables, views, and functions.

### 2. Pre-populate with Existing Records

```bash
node pre-populate-ps-audit.js
```

This fetches all PS records from the last 2 years and creates initial snapshots. This process may take several minutes depending on the number of records.

### 3. Add Page to Entitlements (If Already Set Up)

If you already have the page entitlements system running, add the audit trail page:

```bash
node add-audit-trail-to-entitlements.js
```

If you're setting up entitlements from scratch, the audit trail page is already included in the updated `08-page-entitlements.sql` script.

### 4. Set Up Periodic Capture (Recommended)

To continuously track changes, run the capture script periodically:

```bash
node capture-ps-changes.js
```

**Recommended Schedule**: Every 15-30 minutes via cron or Windows Task Scheduler

Example cron entry (every 15 minutes):
```
*/15 * * * * cd /path/to/app && node capture-ps-changes.js >> logs/ps-audit-capture.log 2>&1
```

Example Windows Task Scheduler:
- Trigger: Daily, repeat every 15 minutes
- Action: Start program `node.exe` with argument `capture-ps-changes.js`
- Start in: `C:\path\to\app`

## Using the Audit Trail Page

### Access

Navigate to: **Provisioning → Audit Trail**

The page is accessible to both Admin and User roles by default.

### Search for a PS Record

1. Enter a PS record name (e.g., `PS-12345`) or Salesforce ID
2. Click **Search** or press Enter
3. View the complete audit trail with:
   - **Record Info**: Name, account, total snapshots, current status
   - **Status Timeline**: Visual timeline of status changes
   - **Complete Audit Trail**: Table with all captured snapshots

### Statistics Dashboard

The top of the page shows:
- **Total PS Records**: Unique records in the audit trail
- **Total Snapshots**: All captured snapshots
- **Status Changes**: Number of detected status changes
- **Last Capture**: When the last capture ran

## API Endpoints

### Get Audit Trail for a PS Record
```
GET /api/audit-trail/ps-record/:identifier
```

**Parameters**:
- `identifier`: PS record name (e.g., PS-12345) or Salesforce ID

**Response**:
```json
{
  "success": true,
  "identifier": "PS-12345",
  "recordCount": 15,
  "records": [
    {
      "id": 123,
      "ps_record_name": "PS-12345",
      "status": "Completed",
      "captured_at": "2025-10-17T14:30:00Z",
      "change_type": "status_change",
      ...
    }
  ]
}
```

### Get Status Changes Timeline
```
GET /api/audit-trail/status-changes/:identifier
```

Returns only the status change events for visualizing the timeline.

### Get System Statistics
```
GET /api/audit-trail/stats
```

Returns overall audit trail statistics.

### Search Records
```
GET /api/audit-trail/search?q=searchTerm
```

Search for PS records in the audit trail.

## Data Captured

For each PS record snapshot, the following data is captured:

### Core Fields
- **PS Record ID & Name**: Salesforce identifiers
- **Status**: The key field for tracking changes
- **Request Type**: TenantRequestAction__c
- **Account**: Account ID and name
- **Deployment**: Deployment ID and name
- **Tenant Name**: Associated tenant

### Additional Fields
- Account Site
- Billing Status
- SML Error Message
- Payload Data (JSON)
- Created Date & By
- Last Modified Date

### Audit Metadata
- **Captured At**: When this snapshot was taken
- **Change Type**: initial, status_change, update, or snapshot
- **Previous Status**: For status changes, the previous value

## Change Detection Logic

The system automatically detects changes by:

1. **Periodic Polling**: Fetches recent PS records from Salesforce
2. **Comparison**: Compares with latest snapshot in database
3. **Status Change Detection**: If status differs, creates new snapshot with `change_type='status_change'`
4. **New Record Detection**: If no previous snapshot exists, creates initial snapshot

## Use Cases

### 1. Status Change Analysis
Track how long records spend in each status:
```sql
SELECT 
    status,
    AVG(EXTRACT(EPOCH FROM (
        LEAD(captured_at) OVER (PARTITION BY ps_record_id ORDER BY captured_at) - captured_at
    )) / 3600) as avg_hours_in_status
FROM ps_audit_trail
WHERE change_type IN ('initial', 'status_change')
GROUP BY status;
```

### 2. Record Processing Time
Calculate total time from creation to completion:
```sql
SELECT 
    ps_record_name,
    MAX(captured_at) FILTER (WHERE status LIKE '%Complete%') - 
    MIN(captured_at) as processing_duration
FROM ps_audit_trail
GROUP BY ps_record_name, ps_record_id;
```

### 3. Status Progression
View the status progression for a specific record:
```sql
SELECT * FROM get_ps_status_changes('PS-12345');
```

## Maintenance

### Database Size

Each snapshot stores approximately 1-2 KB of data. Expected growth:
- 1,000 PS records × 10 snapshots each = ~10-20 MB
- 10,000 PS records × 15 snapshots each = ~150-300 MB

### Cleanup Old Snapshots (Optional)

To keep only recent data (e.g., last 90 days):
```sql
DELETE FROM ps_audit_trail 
WHERE captured_at < NOW() - INTERVAL '90 days';
```

### Reindex for Performance
```sql
REINDEX TABLE ps_audit_trail;
VACUUM ANALYZE ps_audit_trail;
```

## Troubleshooting

### No Snapshots Appearing

1. **Check Database Setup**:
   ```bash
   node setup-ps-audit-trail.js
   ```

2. **Verify Pre-population Ran**:
   ```bash
   node pre-populate-ps-audit.js
   ```

3. **Check Salesforce Authentication**:
   Ensure the app has valid Salesforce credentials

### Missing Status Changes

1. **Verify Capture Script is Running**:
   Check that `capture-ps-changes.js` is scheduled and running

2. **Check Capture Logs**:
   Review `ps_audit_log` table for errors:
   ```sql
   SELECT * FROM ps_audit_log ORDER BY created_at DESC LIMIT 10;
   ```

### Page Not Visible

1. **Check Page Entitlements**:
   ```bash
   node add-audit-trail-to-entitlements.js
   ```

2. **Verify User Has Access**:
   ```sql
   SELECT * FROM get_user_pages(user_id);
   ```

## Architecture

### Components

1. **Database Layer** (`09-ps-audit-trail.sql`)
   - Schema definition
   - Indexes for performance
   - Helper functions

2. **Service Layer** (`ps-audit-service.js`)
   - Snapshot capture logic
   - Change detection
   - Data queries

3. **API Layer** (`app.js`)
   - REST endpoints
   - Authentication
   - Error handling

4. **Frontend** (`public/index.html`, `public/script.js`)
   - Search interface
   - Timeline visualization
   - Audit trail table

5. **Scripts**
   - `setup-ps-audit-trail.js`: Database initialization
   - `pre-populate-ps-audit.js`: Initial data load
   - `capture-ps-changes.js`: Periodic capture
   - `add-audit-trail-to-entitlements.js`: Entitlements setup

## Future Enhancements

Potential additions:
- [ ] Advanced analytics dashboard with charts
- [ ] Export audit trail to Excel
- [ ] Email notifications on status changes
- [ ] Comparison view between two snapshots
- [ ] Bulk status change analysis
- [ ] Integration with validation rules tracking
- [ ] Performance metrics dashboard
- [ ] Automated alerting for stuck records

## Support

For issues or questions:
1. Check the logs in `ps_audit_log` table
2. Review capture script output
3. Verify database connectivity
4. Check Salesforce API limits and quotas

## Summary

The PS Record Audit Trail system provides comprehensive tracking of all PS records, enabling:
- Complete history and status change tracking
- Performance analysis and bottleneck identification
- Compliance and audit requirements
- Data-driven insights into provisioning processes

All setup scripts are idempotent and safe to run multiple times.

