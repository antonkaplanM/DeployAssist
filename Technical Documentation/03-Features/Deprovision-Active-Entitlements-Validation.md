# Deprovision Active Entitlements Validation

## Overview

This validation rule checks if deprovision PS requests include entitlements that are still active (not yet expired) according to SML (Service Management Layer) data. When active entitlements are detected, the system displays a **WARNING** in yellow, alerting users that the deprovision request would remove resources that haven't expired yet.

## Key Features

- ✅ **Asynchronous Processing**: Runs in the background via scheduled task to avoid blocking the UI
- ⚠️ **Warning Status**: Uses new WARNING status (yellow) instead of FAIL (red)
- 🎨 **Visual Highlighting**: Active entitlements are highlighted in yellow in the product modal
- 🔄 **SML Integration**: Fetches real-time entitlement data from SML API
- 📊 **Database Storage**: Results stored in `async_validation_results` table for persistence
- 🕒 **Automatic Updates**: Background worker runs every 10 minutes to keep results current

## Architecture

### Components

1. **Validation Rule Definition** (`validation-engine.js`, `public/validation-rules.js`)
   - Rule ID: `deprovision-active-entitlements-check`
   - Category: `deprovision-validation`
   - Type: Asynchronous (requires background processing)

2. **SML Validation Helper** (`sml-validation-helper.js`)
   - Integrates with SML API via `SMLService`
   - Checks entitlement expiration dates
   - Returns WARNING status for active entitlements

3. **Background Worker** (`process-sml-validation.js`)
   - Scheduled to run every 10 minutes
   - Queries deprovision PS records from last 30 days
   - Validates against SML and stores results in database

4. **Database Tables**
   - `async_validation_results`: Stores validation results
   - `async_validation_processing_log`: Tracks processing runs

5. **API Endpoints** (`app.js`)
   - `GET /api/validation/async-results`: Fetch async validation results by record IDs
   - `GET /api/validation/async-status`: Get processing status and statistics

6. **UI Components**
   - Updated `ProvisioningRequests.jsx`: Displays WARNING status in yellow
   - Updated `ProductModal.jsx`: Highlights active entitlements in yellow

## How It Works

### 1. Data Flow

```
[PS Record Created/Updated]
           ↓
[Background Worker runs every 10 minutes]
           ↓
[Checks if Request Type = "Deprovision"]
           ↓
[Extracts tenant name from payload]
           ↓
[Queries SML API for entitlements]
           ↓
[Checks if any entitlements have endDate > currentDate]
           ↓
[Stores result in database]
           ↓
[UI fetches async results and displays WARNING]
```

### 2. Validation Logic

```javascript
For each deprovision PS record:
  1. Extract tenant name from Payload_Data__c
  2. Fetch all entitlements from SML API
  3. Filter entitlements where endDate > currentDate
  4. If activeEntitlements.length > 0:
     - Status: WARNING
     - Message: "Found X active entitlement(s)"
     - Details: List of active entitlements
  5. Else:
     - Status: PASS
     - Message: "All entitlements expired"
```

### 3. Status Priority

The validation system now supports three statuses with priority:

1. **FAIL** (Red) - Highest priority, validation error
2. **WARNING** (Yellow) - Medium priority, potential issue
3. **PASS** (Green) - Lowest priority, all checks passed

Overall status is determined by the highest priority rule result.

## Database Schema

### async_validation_results

```sql
CREATE TABLE async_validation_results (
    id SERIAL PRIMARY KEY,
    ps_record_id VARCHAR(255) NOT NULL,
    ps_record_name VARCHAR(100),
    account_name VARCHAR(255),
    tenant_name VARCHAR(255),
    request_type VARCHAR(100),
    rule_id VARCHAR(100) NOT NULL,
    rule_name VARCHAR(255),
    status VARCHAR(20) NOT NULL, -- 'PASS', 'FAIL', 'WARNING', 'PENDING', 'ERROR'
    message TEXT,
    details JSONB,
    sml_entitlements JSONB,
    active_entitlements_count INT DEFAULT 0,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_ms INT,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### async_validation_processing_log

```sql
CREATE TABLE async_validation_processing_log (
    id SERIAL PRIMARY KEY,
    process_started TIMESTAMP NOT NULL,
    process_completed TIMESTAMP,
    records_queued INT DEFAULT 0,
    records_processed INT DEFAULT 0,
    records_succeeded INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    records_skipped INT DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Installation & Setup

### Prerequisites

- PostgreSQL database with connection configured in `.env`
- Node.js installed at `C:\Program Files\nodejs\node.exe`
- SML integration configured (Bearer token in `.sml_config.json`)
- Windows Task Scheduler (for Windows) or cron (for Linux)

### Setup Steps

#### 1. Create Database Tables

Run the SQL script:
```bash
psql -d your_database -f database/init-scripts/13-async-validation-results.sql
```

Or if using a database initialization script, ensure it's included.

#### 2. Configure SML Integration

Ensure SML is configured with valid credentials:
- Go to **Settings** → **SML Integration**
- Enter environment and Bearer token
- Test connection

#### 3. Setup Scheduled Task (Windows)

Run the PowerShell script as Administrator:
```powershell
.\setup-sml-validation-task.ps1
```

This creates a scheduled task named `SML-Validation-Processing` that runs every 10 minutes.

#### 4. Enable Validation Rule

The rule is enabled by default. To disable/enable:
- Navigate to **Provisioning Monitor** → **Validation Rules** sub-page
- Toggle the "Deprovision Active Entitlements Check" rule

### Manual Execution

To run the background worker manually:
```bash
node process-sml-validation.js
```

## Usage

### For End Users

1. **Viewing Validation Results**
   - Navigate to **Provisioning Monitor**
   - Look at the "Data Validations" column
   - **WARNING** status appears in yellow for deprovision requests with active entitlements

2. **Viewing Details**
   - Hover over the WARNING badge to see tooltip with summary
   - Click on product groups to open the Product Modal
   - Active entitlements are highlighted in yellow
   - Tooltip shows: "This entitlement is still active and will be removed"

3. **Interpreting Results**
   - **WARNING**: Deprovision request includes active (non-expired) entitlements
   - **PASS**: All entitlements have expired or no entitlements found
   - **ERROR**: SML validation failed (check logs)

### For Administrators

1. **Monitoring Processing**
   - Check Task Scheduler: `Get-ScheduledTask -TaskName "SML-Validation-Processing"`
   - View logs in `async_validation_processing_log` table
   - API endpoint: `GET /api/validation/async-status`

2. **Troubleshooting**
   ```bash
   # Check if task is running
   Get-ScheduledTask -TaskName "SML-Validation-Processing" | Select-Object State, LastRunTime, NextRunTime
   
   # Run manually to see errors
   node process-sml-validation.js
   
   # Check database logs
   SELECT * FROM async_validation_processing_log ORDER BY created_at DESC LIMIT 10;
   ```

3. **Managing the Task**
   ```powershell
   # Start task manually
   Start-ScheduledTask -TaskName "SML-Validation-Processing"
   
   # Disable task
   Disable-ScheduledTask -TaskName "SML-Validation-Processing"
   
   # Enable task
   Enable-ScheduledTask -TaskName "SML-Validation-Processing"
   
   # Remove task
   .\remove-sml-validation-task.ps1
   ```

## Configuration

### Environment Variables

Ensure these are set in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/deployassist
DATABASE_SSL=false
```

### SML Configuration

SML credentials are stored in `.sml_config.json`:
```json
{
  "environment": "euw1",
  "authCookie": "Bearer eyJ..."
}
```

### Validation Rule Configuration

The rule can be configured in the Validation Rules page:
- **Enabled/Disabled**: Toggle rule on/off
- **Rule applies to**: Deprovision requests only
- **Runs**: Asynchronously in background

## API Reference

### Get Async Validation Results

```http
GET /api/validation/async-results?recordIds=a0X1234,a0X5678
```

**Query Parameters:**
- `recordIds` (string, required): Comma-separated list of PS record IDs

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "ps_record_id": "a0X1234",
      "ps_record_name": "PS-12345",
      "rule_id": "deprovision-active-entitlements-check",
      "status": "WARNING",
      "message": "Found 3 active entitlement(s) that have not yet expired",
      "details": {
        "tenantName": "example-tenant",
        "activeEntitlements": [
          {
            "productCode": "RI-CORE",
            "productName": "RMS Core",
            "category": "apps",
            "endDate": "2025-12-31",
            "daysRemaining": 60
          }
        ],
        "activeByCategory": {
          "apps": 2,
          "models": 1,
          "data": 0
        }
      },
      "active_entitlements_count": 3,
      "processing_completed_at": "2025-10-30T10:15:00Z",
      "updated_at": "2025-10-30T10:15:00Z"
    }
  ],
  "count": 1,
  "timestamp": "2025-10-30T10:20:00Z"
}
```

### Get Processing Status

```http
GET /api/validation/async-status
```

**Response:**
```json
{
  "success": true,
  "lastProcessing": {
    "process_started": "2025-10-30T10:10:00Z",
    "process_completed": "2025-10-30T10:15:00Z",
    "records_queued": 15,
    "records_processed": 15,
    "records_succeeded": 14,
    "records_failed": 1,
    "records_skipped": 0,
    "status": "completed_with_errors"
  },
  "statistics": {
    "total_results": 50,
    "warning_count": 8,
    "pass_count": 40,
    "error_count": 2,
    "last_updated": "2025-10-30T10:15:00Z"
  },
  "timestamp": "2025-10-30T10:20:00Z"
}
```

## Performance Considerations

### Background Processing

- **Frequency**: Every 10 minutes (configurable)
- **Record Limit**: 100 records per run
- **Date Filter**: Last 30 days of deprovision requests
- **Delay Between Records**: 500ms to avoid rate limiting

### Database Impact

- **Indexes**: On `ps_record_id`, `rule_id`, `status`, `updated_at`
- **Storage**: JSONB columns for flexible data storage
- **Cleanup**: Consider archiving old results (> 90 days)

### SML API Calls

- **Rate Limiting**: 500ms delay between requests
- **Error Handling**: Failed requests are logged but don't stop processing
- **Token Expiration**: Handled gracefully with error status

## Limitations

1. **SML Dependency**: Requires valid SML authentication
2. **Async Nature**: Results may be up to 10 minutes old
3. **Date Range**: Only processes records from last 30 days
4. **Rate Limiting**: Large backlogs may take multiple runs to process

## Future Enhancements

Potential improvements:

1. **Real-time Processing**: Trigger validation on PS record creation/update via webhook
2. **Email Notifications**: Alert users when WARNING status is detected
3. **Bulk Actions**: Batch process multiple records simultaneously
4. **Configurable Frequency**: Allow admins to adjust scheduling interval
5. **Historical Tracking**: Track how validation results change over time

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Task not running | Check Task Scheduler, ensure task is enabled |
| SML authentication errors | Update Bearer token in Settings → SML Integration |
| No results showing | Check database connection, ensure tables exist |
| Slow processing | Reduce batch size or increase frequency |
| Missing entitlements | Verify SML API is returning data correctly |

### Debug Commands

```bash
# Test SML connection
node -e "const {SMLService} = require('./src/services/SMLService'); new SMLService().testConnection().then(console.log)"

# Test validation helper
node -e "const {SMLValidationHelper} = require('./sml-validation-helper'); new SMLValidationHelper().isSMLConfigured().then(console.log)"

# Run background worker in debug mode
NODE_ENV=development node process-sml-validation.js
```

## Change Log

### Version 1.0 (2025-10-30)
- Initial implementation
- Added WARNING status support
- Created async validation infrastructure
- Implemented SML integration for deprovision checks
- Added background worker and scheduled task
- Updated UI to display warnings in yellow
- Added highlighting for active entitlements

## Related Documentation

- [SML Integration Summary](../05-Integrations/SML-Integration-Summary.md)
- [Validation Rules Documentation](./Validation-Rules-Documentation.md)
- [PS Audit Trail Automation](../PS-Audit-Trail/AUDIT-TRAIL-AUTOMATION-SETUP.md)

