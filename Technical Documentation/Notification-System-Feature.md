# Notification System Feature

## Overview

The notification system provides real-time alerts for new Professional Services (PS) requests added to the Provisioning Monitor. It implements a hybrid approach combining in-browser toast notifications and native desktop/system notifications.

**Status:** ✅ Fully Implemented  
**Date:** October 7, 2025  
**Version:** 1.0

---

## Features

### Core Functionality

1. **Real-time Monitoring**
   - Polls for new PS records every 60 seconds
   - Checks for records created since last poll
   - Automatic background monitoring while app is open

2. **Dual Notification System**
   - **In-Browser Notifications:** Toast-style notifications in top-right corner
   - **Desktop Notifications:** Native OS notifications (Windows Action Center, etc.)
   - Both can be enabled/disabled independently

3. **Sound Alerts**
   - Subtle notification sound when new records detected
   - Uses Web Audio API for cross-browser compatibility
   - Can be toggled on/off in settings

4. **Visual Badge Indicator**
   - Red badge on "Provisioning Monitor" nav item
   - Shows count of unread notifications
   - Auto-clears when navigating to Provisioning Monitor

5. **One-Click Navigation**
   - Click notification to navigate to Provisioning Monitor
   - Both in-browser and desktop notifications support navigation

---

## Architecture

### Components

#### Backend API
- **Endpoint:** `GET /api/provisioning/new-records`
- **Parameters:** `since` (ISO timestamp)
- **Returns:** Array of new PS records with metadata

#### Frontend Components

1. **NotificationManager** (`public/notification-manager.js`)
   - Core notification service
   - Handles polling, display logic, and settings
   - Manages notification permissions

2. **Settings UI** (`public/index.html`)
   - Toggle switches for each notification type
   - Permission status indicators
   - Test notification button

3. **Integration Code** (`public/script.js`)
   - Settings initialization and event handlers
   - Badge clearing on navigation
   - Status updates

---

## Technical Implementation

### Polling Mechanism

```javascript
// Checks for new records every 60 seconds
setInterval(() => {
    checkForNewRecords();
}, 60000);
```

- Tracks last check timestamp
- Only retrieves records created after last check
- Efficient: minimal server load

### Notification Display Logic

**Single Record:**
```
Title: New PS Request: [Request Type]
Message: [PS Name] - [Account]
Action: View in Provisioning Monitor →
```

**Multiple Records (>3):**
```
Title: X New PS Requests
Message: Request types: [Type1, Type2, ...]
Action: View in Provisioning Monitor →
```

### Browser Notification Permissions

Three states:
- **Granted:** Desktop notifications work
- **Denied:** Only in-browser notifications work
- **Default:** Prompt user for permission

---

## User Guide

### Enabling Notifications

1. Navigate to **Settings** page
2. Expand **Notifications** section
3. Configure preferences:
   - ✅ In-Browser Notifications (on by default)
   - ✅ Desktop/System Notifications (on by default)
   - ✅ Sound Alerts (on by default)

### Granting Desktop Notification Permission

**First Time:**
1. Enable "Desktop/System Notifications" toggle
2. Browser will prompt for permission
3. Click "Allow" in browser prompt

**If Previously Denied:**
1. Click browser's site settings icon (lock icon in address bar)
2. Find "Notifications" permission
3. Change to "Allow"
4. Refresh page

### Testing Notifications

1. Go to **Settings** → **Notifications**
2. Click "Send Test Notification"
3. Should see both in-browser and desktop notification (if enabled)

---

## Settings Storage

Settings are stored in browser's localStorage:

```json
{
  "inBrowserEnabled": true,
  "desktopEnabled": true,
  "soundEnabled": true,
  "pollInterval": 60000
}
```

**Key:** `notificationSettings`  
**Persistence:** Per browser/device

---

## Notification Behavior

### When You'll Receive Notifications

✅ **YES** - Notify when:
- New PS record is created in Salesforce
- Any request type
- Regardless of current page filters

❌ **NO** - Don't notify when:
- No Salesforce authentication
- Notifications disabled in settings
- Browser tab completely closed

### Auto-Clear Behavior

Badge clears automatically when:
- User navigates to Provisioning Monitor
- User clicks on a notification (navigates to monitor)

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|---------|------|---------|---------|
| In-Browser Notifications | ✅ | ✅ | ✅ | ✅ |
| Desktop Notifications | ✅ | ✅ | ✅ | ✅ |
| Sound Alerts | ✅ | ✅ | ✅ | ✅ |
| Badge Display | ✅ | ✅ | ✅ | ✅ |

**Minimum Versions:**
- Chrome/Edge: 88+
- Firefox: 78+
- Safari: 14+

---

## API Reference

### Backend Endpoint

```http
GET /api/provisioning/new-records?since=2025-10-07T10:30:00Z
```

**Query Parameters:**
- `since` (required): ISO 8601 timestamp

**Response:**
```json
{
  "success": true,
  "newRecords": [
    {
      "id": "a0x5g000001XyZ8AAK",
      "name": "PS-12345",
      "requestType": "Product Addition",
      "account": "Acme Corp",
      "accountSite": "US",
      "status": "Open",
      "createdDate": "2025-10-07T10:35:22.000Z"
    }
  ],
  "totalNew": 1,
  "checkTimestamp": "2025-10-07T10:36:00.000Z"
}
```

### Frontend API

#### NotificationManager Class

```javascript
// Access global instance
notificationManager

// Methods
.start()                    // Start polling
.stop()                     // Stop polling
.saveSettings(settings)     // Update settings
.getStatus()               // Get current status
.clearUnreadCount()        // Clear badge
.showNotification(record)  // Show notification for record
```

---

## Customization Options

### Polling Interval

Default: 60 seconds

To change, modify in `notification-manager.js`:
```javascript
pollInterval: 60000  // Change to desired milliseconds
```

### Sound

Custom sound can be added by replacing the Web Audio API implementation with an audio file:

```javascript
this.notificationSound = new Audio('/path/to/sound.mp3');
```

### Max Individual Notifications

Default: 3

To change, modify in `notification-manager.js`:
```javascript
const maxIndividualNotifications = 3;  // Change value
```

---

## Troubleshooting

### Notifications Not Appearing

**Check:**
1. Are notifications enabled in Settings?
2. Is Salesforce authenticated?
3. Is browser permission granted? (for desktop notifications)
4. Check browser console for errors

### Sound Not Playing

**Solutions:**
- Check that "Sound Alerts" is enabled in Settings
- Some browsers require user interaction before playing audio
- Check system volume settings

### Badge Not Clearing

**Solutions:**
- Navigate to Provisioning Monitor page
- Refresh the page
- Clear browser cache

### Desktop Notifications Blocked

**Solutions:**
1. Click lock icon in browser address bar
2. Find "Notifications" in site settings
3. Change to "Allow"
4. Refresh page and toggle Desktop Notifications in Settings

---

## Performance Considerations

### Server Load
- Polling every 60 seconds = ~1,440 requests/day per user
- Query is efficient (indexed CreatedDate field)
- Minimal data transfer (~1KB per request typically)

### Client Performance
- Notification manager runs in background
- Negligible CPU/memory impact
- Sound generation uses optimized Web Audio API

### Battery Impact (Mobile)
- Polling consumes minimal battery
- Consider increasing interval for mobile devices if needed

---

## Security Considerations

1. **Authentication Required**
   - New records endpoint requires Salesforce authentication
   - Returns empty array if not authenticated

2. **Timestamp Validation**
   - Backend validates timestamp format
   - Prevents injection attacks

3. **Data Filtering**
   - Only returns records user has access to via Salesforce
   - Respects Salesforce permissions

---

## Future Enhancement Ideas

**Potential additions:**
- [ ] Notification history log
- [ ] Per-request-type filtering
- [ ] Configurable polling interval in UI
- [ ] Email notifications for offline users
- [ ] Push notifications via Service Worker
- [ ] Notification grouping by account
- [ ] Mute notifications for X minutes
- [ ] Different sounds for different request types

---

## Files Modified/Created

### New Files
- `public/notification-manager.js` - Core notification service
- `Technical Documentation/Notification-System-Feature.md` - This document

### Modified Files
- `app.js` - Added `/api/provisioning/new-records` endpoint
- `public/index.html` - Added notification settings UI, script reference, badge
- `public/script.js` - Added settings integration, badge clearing
- `public/styles.css` - Added notification styling

---

## Testing Checklist

### Manual Testing

- [x] In-browser notifications display correctly
- [x] Desktop notifications display correctly
- [x] Sound plays when enabled
- [x] Badge appears and shows correct count
- [x] Badge clears when navigating to Provisioning Monitor
- [x] Clicking notification navigates to Provisioning Monitor
- [x] Settings persist across page refreshes
- [x] Permission request works
- [x] Test notification button works
- [x] Multiple notifications display properly
- [x] Notifications auto-dismiss after 10 seconds
- [x] Works with Salesforce authenticated
- [x] Handles no authentication gracefully

### Browser Testing

- [x] Chrome/Edge
- [x] Firefox
- [x] Safari (if available)

---

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Settings → Notifications configuration
3. Test with "Send Test Notification" button
4. Check Salesforce authentication status

---

## Changelog

### Version 1.0 (October 7, 2025)
- Initial implementation
- In-browser toast notifications
- Desktop/system notifications
- Sound alerts
- Visual badge indicator
- Settings UI with toggles
- One-click navigation
- Test notification feature

