# Empty Notifications Issue - Analysis & Fix

## Issue
User reports seeing two empty in-app notifications when landing on the Pending Requests page.

## Root Cause

The notifications come from `notification-manager.js` which automatically starts polling when the app loads:

```javascript
// notification-manager.js line 142-164
async checkForNewRecords() {
    const response = await fetch(`/api/provisioning/new-records?since=${this.lastCheckTimestamp}`);
    const data = await response.json();
    
    if (data.success && data.newRecords && data.newRecords.length > 0) {
        this.showNotifications(data.newRecords);
    }
}
```

## Why Notifications Appear Empty

The notification expects these fields from each record:
- `record.requestType` - Shows in title
- `record.name` - Shows in message
- `record.account` - Shows in message

If any of these fields are `undefined` or empty, the notification appears blank.

## Possible Causes

1. **Timing Issue**: Notification fires before Salesforce connection is established
2. **Data Format Issue**: Records returned don't have required fields
3. **Duplicate Polling**: Multiple instances of notification manager running

## How to Diagnose

### Step 1: Check what the endpoint actually returns

```javascript
// In browser console:
fetch('/api/provisioning/new-records?since=' + new Date().toISOString())
  .then(r => r.json())
  .then(data => {
    console.log('Success:', data.success);
    console.log('Records:', data.newRecords);
    console.log('Record structure:', data.newRecords[0]);
  });
```

### Step 2: Check Salesforce connection

```javascript
// Check if there's valid SF auth
fetch('/api/salesforce/auth/status')
  .then(r => r.json())
  .then(data => console.log('SF Auth:', data));
```

## Fixes

### Fix 1: Disable Notifications Temporarily

If you don't need the notification feature:

**In browser console:**
```javascript
if (window.notificationManager) {
  window.notificationManager.stop();
  localStorage.setItem('notificationSettings', JSON.stringify({
    inBrowserEnabled: false,
    desktopEnabled: false,
    soundEnabled: false,
    pollInterval: 60000
  }));
  console.log('✅ Notifications disabled');
}
```

### Fix 2: Increase Polling Interval

Reduce frequency of checks (default is 60 seconds):

**In Settings page UI** or **browser console:**
```javascript
if (window.notificationManager) {
  window.notificationManager.saveSettings({
    pollInterval: 300000  // 5 minutes instead of 1 minute
  });
}
```

### Fix 3: Add Better Error Handling (Code Change)

Update `public/notification-manager.js`:

```javascript
// Around line 192
showNotification(record) {
    // Add validation
    if (!record || !record.requestType || !record.name) {
        console.warn('Skipping notification - missing required fields:', record);
        return;
    }
    
    const title = `New PS Request: ${record.requestType}`;
    const message = `${record.name}${record.account ? ' - ' + record.account : ''}`;
    // ... rest of code
}
```

## Expected Behavior

### Normal Operation
1. App loads
2. Notification manager starts polling every 60 seconds
3. If new PS records are found in Salesforce (created after last check), show notification
4. Notification has title, message, and action button

### When Notifications Should NOT Appear
- No Salesforce authentication configured
- No new records since last check
- Records don't meet criteria (e.g., already seen)

## Server Response Analysis

### Correct Response (No new records):
```javascript
{
  success: true,
  newRecords: [],
  totalNew: 0,
  checkTimestamp: "2025-11-11T10:00:00.000Z",
  timestamp: "2025-11-11T10:00:05.123Z"
}
```

### Correct Response (With new records):
```javascript
{
  success: true,
  newRecords: [
    {
      id: "a1B5e000000ABCD",
      name: "PS-12345",
      requestType: "New License",
      account: "Acme Corp",
      accountSite: "Production",
      status: "Pending",
      createdDate: "2025-11-11T09:55:00.000Z"
    }
  ],
  totalNew: 1,
  checkTimestamp: "2025-11-11T10:00:05.123Z",
  timestamp: "2025-11-11T10:00:05.123Z"
}
```

### Problem Response (Missing fields):
```javascript
{
  success: true,
  newRecords: [
    {
      id: "a1B5e000000ABCD",
      name: "PS-12345",
      requestType: undefined,  // ❌ Missing
      account: null,            // ❌ Missing
      status: "Pending",
      createdDate: "2025-11-11T09:55:00.000Z"
    }
  ],
  totalNew: 1,
  checkTimestamp: "2025-11-11T10:00:05.123Z",
  timestamp: "2025-11-11T10:00:05.123Z"
}
```

This would cause empty notifications because:
- Title becomes: `New PS Request: undefined`
- Message becomes: `PS-12345`

## Recommended Actions

1. **Verify Salesforce Setup**: Ensure Salesforce is properly authenticated in Settings
2. **Check Recent Records**: Look at the actual PS records created in the last hour - do they have proper data?
3. **Monitor Console**: Keep browser console open and watch for the next polling cycle
4. **Adjust Settings**: If notifications are too frequent or unwanted, disable or adjust polling interval

## Configuration Location

Notification settings are stored in `localStorage`:
```javascript
// View current settings:
console.log(JSON.parse(localStorage.getItem('notificationSettings')));
```

Default settings:
```javascript
{
  inBrowserEnabled: true,      // Show in-app toast notifications
  desktopEnabled: true,         // Show system notifications
  soundEnabled: true,           // Play notification sound
  pollInterval: 60000          // Check every 60 seconds
}
```

## Next Steps

1. Run the diagnostic commands above
2. Check the actual data being returned
3. If notifications persist as empty, apply Fix 1 to disable temporarily
4. Report back with the console output for further diagnosis

