# Background Process Setup - Success Report

## ✅ Automatic Background Processing Configured!

The SML validation background worker has been successfully set up to run automatically every 10 minutes.

## What Was Done

### 1. Fixed Module Path Issues
**Problem:** `sml-validation-helper.js` was trying to import TypeScript modules
**Solution:** Updated to use JavaScript versions:
```javascript
// Before (TypeScript - doesn't work)
const { SMLService } = require('./src/services/SMLService');

// After (JavaScript - works!)
const SMLService = require('./sml-service');
```

### 2. Created User-Level Scheduled Task
**File:** `setup-sml-validation-task-user.ps1`
- No Administrator privileges required
- Runs as current user
- Automatically repeats every 10 minutes

### 3. Tested Background Worker
```bash
node process-sml-validation.js
```
**Result:** ✅ Script runs successfully!

## Task Status

```
TaskName : SML-Validation-Processing
State    : Ready
LastRun  : 11/30/1999 12:00:00 AM
NextRun  : 10/30/2025 11:14:14 AM
```

- **Status**: ✅ Active and Ready
- **Frequency**: Every 10 minutes
- **Next Run**: Scheduled automatically
- **User**: Current user (no admin needed)

## Task Details

| Property | Value |
|----------|-------|
| Task Name | `SML-Validation-Processing` |
| Frequency | Every 10 minutes |
| Script | `process-sml-validation.js` |
| Node.js | `C:\Program Files\nodejs\node.exe` |
| State | Ready |
| User | Current user |

## How It Works

```
Every 10 minutes:
  1. Windows Task Scheduler triggers
  2. Runs: node process-sml-validation.js
  3. Script checks for deprovision PS records (last 30 days)
  4. For each record:
     - Extracts tenant name
     - Queries SML API for active entitlements
     - Checks if any entitlements are not yet expired
     - Stores result in database
  5. UI displays WARNING for active entitlements
```

## Current Status

The background worker is running successfully but **SML is not yet configured**:

```
⚠️  SML is not configured. Skipping this run.
```

### To Complete Setup:

1. **Configure SML Integration**:
   - Navigate to: **Settings** → **SML Integration**
   - Select environment (euw1 or use1)
   - Enter Bearer token
   - Click "Test Connection"
   - Click "Save Configuration"

2. **Verify Setup**:
   ```bash
   node process-sml-validation.js
   ```
   Should now process records instead of skipping

3. **Monitor Processing**:
   ```powershell
   Get-ScheduledTask -TaskName "SML-Validation-Processing"
   ```

## Management Commands

### View Task Status
```powershell
Get-ScheduledTask -TaskName "SML-Validation-Processing"
```

### Run Manually (Test)
```bash
node process-sml-validation.js
```

### Start Task Immediately
```powershell
Start-ScheduledTask -TaskName "SML-Validation-Processing"
```

### Disable Task
```powershell
Disable-ScheduledTask -TaskName "SML-Validation-Processing"
```

### Enable Task
```powershell
Enable-ScheduledTask -TaskName "SML-Validation-Processing"
```

### Remove Task
```powershell
Unregister-ScheduledTask -TaskName "SML-Validation-Processing" -Confirm:$false
```

### View Task History
1. Open Task Scheduler: `taskschd.msc`
2. Find: `SML-Validation-Processing`
3. Click "History" tab at bottom

## Database Queries

### View Recent Validation Results
```sql
SELECT * FROM async_validation_results 
WHERE rule_id = 'deprovision-active-entitlements-check'
ORDER BY updated_at DESC 
LIMIT 20;
```

### View Processing Logs
```sql
SELECT * FROM async_validation_processing_log
ORDER BY created_at DESC 
LIMIT 10;
```

### Count Results by Status
```sql
SELECT status, COUNT(*) as count
FROM async_validation_results 
WHERE rule_id = 'deprovision-active-entitlements-check'
GROUP BY status;
```

## Files Created

1. ✅ `setup-sml-validation-task-user.ps1` - User-level task setup (no admin)
2. ✅ `setup-sml-validation-task.ps1` - System-level task setup (requires admin)
3. ✅ `remove-sml-validation-task.ps1` - Task removal script
4. ✅ `sml-validation-helper.js` - SML validation helper (fixed paths)
5. ✅ `process-sml-validation.js` - Background worker script
6. ✅ `run-migration.js` - Database migration runner
7. ✅ `verify-tables.js` - Database verification script

## Verification Checklist

- ✅ Database tables created
- ✅ Environment variables configured (DATABASE_URL added)
- ✅ Module paths fixed (JavaScript instead of TypeScript)
- ✅ Background worker script runs successfully
- ✅ Scheduled task created and active
- ✅ Task scheduled to run every 10 minutes
- ⏳ SML integration needs configuration
- ⏳ First validation run pending

## Next Steps

### Immediate (Required)
1. **Configure SML Integration** (Settings → SML Integration)
   - Get Bearer token from SML portal
   - Save configuration
   - Test connection

### Testing
2. **Run Background Worker Manually**:
   ```bash
   node process-sml-validation.js
   ```
   Should now process records

3. **Check Results in Database**:
   ```bash
   node verify-tables.js
   ```

4. **View in UI**:
   - Navigate to Provisioning Monitor
   - Look for WARNING badges on deprovision requests
   - Click product groups to see highlighted entitlements

### Monitoring (Optional)
5. **Monitor Task Execution**:
   - Open Task Scheduler (`taskschd.msc`)
   - Find `SML-Validation-Processing`
   - View History tab

6. **Check API Status**:
   ```http
   GET http://localhost:5000/api/validation/async-status
   ```

## Troubleshooting

### Task Not Running
```powershell
# Check task status
Get-ScheduledTask -TaskName "SML-Validation-Processing"

# Manually trigger
Start-ScheduledTask -TaskName "SML-Validation-Processing"

# View task history in Task Scheduler
taskschd.msc
```

### Script Errors
```bash
# Run manually to see errors
node process-sml-validation.js

# Check SML configuration
node -e "const sml = require('./sml-service'); const s = new sml(); console.log(s.getConfig());"
```

### No Results in Database
```bash
# Verify SML is configured
# Verify deprovision records exist in Salesforce
# Check processing logs
node -e "const {Pool} = require('pg'); require('dotenv').config(); const pool = new Pool({connectionString: process.env.DATABASE_URL}); pool.query('SELECT * FROM async_validation_processing_log ORDER BY created_at DESC LIMIT 5').then(r => {console.table(r.rows); return pool.end();});"
```

## Success Metrics

Once SML is configured, you should see:
- ✅ Task runs every 10 minutes
- ✅ Records processed (check logs)
- ✅ Results in `async_validation_results` table
- ✅ WARNING badges in Provisioning Monitor UI
- ✅ Yellow highlighting in Product Modal

## Summary

🎉 **Background processing is now fully operational!**

The scheduled task will automatically:
- Run every 10 minutes
- Check deprovision PS records
- Validate against SML active entitlements  
- Store results in database
- Display warnings in UI

**Final Step**: Configure SML integration in Settings to start processing records.

---

**Status**: ✅ Setup Complete - Ready for SML Configuration

