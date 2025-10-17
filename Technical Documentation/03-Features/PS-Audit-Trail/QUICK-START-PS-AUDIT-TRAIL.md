# Quick Start: PS Audit Trail

## 🚀 Get Started in 3 Steps

### Step 1: Set Up Database (2 minutes)

```bash
# Initialize the audit trail schema
node setup-ps-audit-trail.js
```

**What this does**:
- Creates `ps_audit_trail` table
- Creates `ps_audit_log` table
- Sets up helper functions
- Creates optimized indexes

✅ **Success**: You should see "PS Audit Trail setup complete!"

---

### Step 2: Load Existing Data (5-10 minutes)

```bash
# Pre-populate with PS records from the last 2 years
node pre-populate-ps-audit.js
```

**What this does**:
- Fetches all PS records from Salesforce (last 2 years)
- Creates initial snapshots for each record
- May take several minutes depending on data volume

✅ **Success**: You should see statistics like:
```
Total Records: 1,234
Successfully Captured: 1,234
Duration: 45.23s
```

---

### Step 3: Add to Entitlements (30 seconds)

```bash
# Add the page to the navigation system
node add-audit-trail-to-entitlements.js
```

**What this does**:
- Adds "Audit Trail" to the Provisioning menu
- Grants access to Admin and User roles

✅ **Success**: Refresh your browser - you should now see "Audit Trail" under Provisioning!

---

## 📊 Using the Audit Trail

### Access the Page
1. Navigate to **Provisioning → Audit Trail**
2. You'll see statistics at the top showing:
   - Total PS Records tracked
   - Total Snapshots captured
   - Status Changes detected
   - Last Capture time

### Search for a Record
1. Enter a PS record name (e.g., `PS-12345`) or Salesforce ID
2. Click **Search** or press Enter
3. View:
   - ✨ **Record Info**: Current status and account
   - 📈 **Status Timeline**: Visual history of changes
   - 📋 **Complete Table**: All snapshots with details

---

## 🔄 Continuous Tracking (Optional but Recommended)

### Option A: Manual Capture
Run this command whenever you want to check for changes:
```bash
node capture-ps-changes.js
```

### Option B: Automated Capture (Recommended)

**Windows (Task Scheduler)**:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily, repeat every 15 minutes
4. Action: `node.exe capture-ps-changes.js`
5. Start in: Your app directory

**Linux/Mac (Cron)**:
```bash
# Edit crontab
crontab -e

# Add this line (runs every 15 minutes)
*/15 * * * * cd /path/to/app && node capture-ps-changes.js >> logs/audit-capture.log 2>&1
```

---

## 🎯 Common Use Cases

### Find Record History
**Use Case**: "What status changes happened to PS-12345?"
1. Go to Audit Trail page
2. Search for `PS-12345`
3. View the status timeline

### Track Processing Time
**Use Case**: "How long did it take PS-12345 to complete?"
- View the timeline to see timestamps
- Calculate duration between initial and final status

### Analyze Status Changes
**Use Case**: "What statuses did this record go through?"
- Status timeline shows all transitions
- Complete audit trail table shows every snapshot

---

## ✅ Verification

### Check It's Working

1. **Statistics Show Data**:
   - Go to Audit Trail page
   - Top stats should show non-zero numbers

2. **Search Works**:
   - Pick any PS record name from the Provisioning Monitor
   - Search for it in Audit Trail
   - You should see results

3. **Check Database**:
   ```sql
   SELECT COUNT(*) FROM ps_audit_trail;
   ```
   Should return a number > 0

---

## 🆘 Troubleshooting

### Problem: "No records found when searching"

**Solution**:
1. Verify pre-population ran: `node pre-populate-ps-audit.js`
2. Check if Salesforce is authenticated
3. Try searching with a different PS record name

### Problem: "Page doesn't appear in navigation"

**Solution**:
1. Run: `node add-audit-trail-to-entitlements.js`
2. Refresh your browser (Ctrl+F5 / Cmd+Shift+R)
3. Verify you're logged in with correct role

### Problem: "Statistics show 0 records"

**Solution**:
1. Run pre-population: `node pre-populate-ps-audit.js`
2. Wait for it to complete
3. Refresh the page

---

## 📚 Want More Details?

See the full documentation: [PS-AUDIT-TRAIL-IMPLEMENTATION.md](./PS-AUDIT-TRAIL-IMPLEMENTATION.md)

---

## 🎉 That's It!

You now have a complete audit trail system for tracking PS records. The system will:
- ✅ Show complete history for any PS record
- ✅ Track status changes over time
- ✅ Help identify processing bottlenecks
- ✅ Maintain compliance audit trails

**Next Step**: Set up automated capture (every 15 minutes) to continuously track changes!

