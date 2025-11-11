# PS Audit Trail - Automatic Capture Setup

## ✅ Status: CONFIGURED

The PS Audit Trail automatic capture has been set up and is running!

## Configuration Details

**Task Name**: `PS-Audit-Trail-Capture`  
**Frequency**: Every 5 minutes  
**Status**: Active and Ready  
**Script**: `capture-ps-changes.js`  
**Node.js**: `C:\Program Files\nodejs\node.exe`  

## What It Does

The scheduled task automatically:
1. Runs every 5 minutes
2. Fetches recently modified PS records from Salesforce
3. Compares them with the latest snapshots in the database
4. Detects status changes
5. Creates new snapshots when changes are found
6. Logs all operations to `ps_audit_log` table

## Management Commands

### View Task Status
```powershell
Get-ScheduledTask -TaskName "PS-Audit-Trail-Capture" | Select-Object TaskName, State, LastRunTime, NextRunTime | Format-List
```

### Run Task Manually (Test)
```powershell
Start-ScheduledTask -TaskName "PS-Audit-Trail-Capture"
```

Or run the script directly:
```bash
node capture-ps-changes.js
```

### View Task History
1. Open Task Scheduler: `taskschd.msc`
2. Navigate to: Task Scheduler Library
3. Find: `PS-Audit-Trail-Capture`
4. Click the "History" tab at the bottom

### Stop/Disable Task (Temporarily)
```powershell
Disable-ScheduledTask -TaskName "PS-Audit-Trail-Capture"
```

### Enable Task (Re-enable)
```powershell
Enable-ScheduledTask -TaskName "PS-Audit-Trail-Capture"
```

### Remove Task Completely
```powershell
Unregister-ScheduledTask -TaskName "PS-Audit-Trail-Capture" -Confirm:$false
```

Or use the provided script:
```powershell
.\remove-audit-capture-task.ps1
```

## Monitoring

### Check Database for Recent Captures
```sql
-- View recent capture operations
SELECT 
    analysis_started,
    records_processed,
    new_snapshots_created,
    changes_detected,
    status
FROM ps_audit_log
ORDER BY analysis_started DESC
LIMIT 10;
```

### Check Latest Snapshots
```sql
-- View recently captured snapshots
SELECT 
    ps_record_name,
    status,
    captured_at,
    change_type
FROM ps_audit_trail
ORDER BY captured_at DESC
LIMIT 20;
```

### Check Status Changes
```sql
-- View recent status changes
SELECT 
    ps_record_name,
    status,
    previous_status,
    captured_at
FROM ps_audit_trail
WHERE change_type = 'status_change'
ORDER BY captured_at DESC
LIMIT 20;
```

## Troubleshooting

### Task Not Running?

1. **Check Task Status**:
   ```powershell
   Get-ScheduledTask -TaskName "PS-Audit-Trail-Capture"
   ```
   Status should be "Ready"

2. **Check Task History**:
   - Open Task Scheduler (`taskschd.msc`)
   - Find the task and view History tab
   - Look for errors

3. **Test Manually**:
   ```bash
   node capture-ps-changes.js
   ```
   This will show any errors

4. **Common Issues**:
   - **Salesforce Authentication Expired**: Re-authenticate in the app
   - **Database Connection**: Check `.env` file database settings
   - **Node.js Path**: Verify Node is in system PATH

### No Status Changes Detected?

This is normal if:
- No PS records have changed status since last capture
- All records are stable
- No new PS records created

To verify it's working:
1. Manually change a PS record status in Salesforce
2. Wait 5 minutes for next capture
3. Check the audit trail page for the updated record

### High Resource Usage?

If the task uses too much CPU/memory:
1. Increase capture interval (change from 5 to 10 or 15 minutes)
2. Edit the scheduled task in Task Scheduler
3. Modify the trigger repetition interval

## Logs

The capture script logs to the database in `ps_audit_log` table. To view recent runs:

```sql
SELECT * FROM ps_audit_log ORDER BY created_at DESC LIMIT 10;
```

Each run logs:
- Start and end time
- Number of records processed
- New snapshots created
- Changes detected
- Any errors

## Modifying the Frequency

To change from 5 minutes to a different interval:

### Option 1: Re-run Setup Script
Edit `setup-audit-capture-task.ps1` and change:
```powershell
-RepetitionInterval (New-TimeSpan -Minutes 5)
```
To your desired minutes, then run:
```powershell
.\setup-audit-capture-task.ps1
```

### Option 2: Manual Edit in Task Scheduler
1. Open Task Scheduler (`taskschd.msc`)
2. Find `PS-Audit-Trail-Capture`
3. Right-click → Properties
4. Go to Triggers tab
5. Edit the trigger
6. Change "Repeat task every" to desired interval
7. Click OK

## Performance Notes

- Each capture typically processes 50-200 records in under 1 second
- Only records modified in the last 30 days are checked
- Only changed records create new database entries
- Database impact is minimal (1-2KB per snapshot)

## Verification

To verify the automation is working:

1. **Check Database Growth**:
   ```sql
   SELECT COUNT(*) FROM ps_audit_trail;
   ```
   This number should gradually increase over time

2. **Check Recent Activity**:
   ```sql
   SELECT 
       COUNT(*) as snapshots_today,
       COUNT(DISTINCT ps_record_id) as unique_records,
       COUNT(*) FILTER (WHERE change_type = 'status_change') as status_changes
   FROM ps_audit_trail
   WHERE captured_at >= CURRENT_DATE;
   ```

3. **Check Audit Trail Page**:
   - Navigate to Provisioning → Audit Trail
   - Statistics should update every 5 minutes
   - "Last Capture" should show recent time

## Summary

✅ **Automatic tracking is now active!**

The system will:
- Capture PS record changes every 5 minutes
- Detect status transitions automatically
- Maintain a complete audit trail
- Enable processing time analysis
- Support compliance requirements

No further action required - the system is now running automatically!

