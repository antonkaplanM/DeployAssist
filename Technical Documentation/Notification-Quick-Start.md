# 🔔 Notification System - Quick Start Guide

## What You Get

✨ **Real-time alerts for new PS requests** with:
- Toast notifications in your browser
- Desktop notifications (Windows Action Center, etc.)
- Sound alerts
- Visual badge indicator
- One-click navigation to Provisioning Monitor

---

## Quick Setup (30 seconds)

### 1. Enable Notifications

1. Navigate to **Settings** page (gear icon in sidebar)
2. Click on **Notifications** section to expand
3. All notifications are **ON by default** ✅

### 2. Grant Desktop Permission (First Time Only)

When you enable desktop notifications for the first time:

1. Your browser will show a permission prompt
2. Click **"Allow"**
3. Done! 🎉

**That's it!** Notifications are now active.

---

## How It Works

### Automatic Monitoring

- System checks for new PS requests every **60 seconds**
- Runs automatically in the background while app is open
- No action needed from you

### What Triggers a Notification?

✅ Any new PS request in Salesforce  
✅ Shows the Request Type (Product Addition, Removal, etc.)  
✅ Shows Account name  
✅ Click to jump straight to Provisioning Monitor

### Example Notification

```
🔔 New PS Request: Product Addition
PS-12345 - Acme Corporation

[View in Provisioning Monitor →]
```

---

## Quick Tips

### 💡 Test It Out

1. Go to **Settings → Notifications**
2. Click **"Send Test Notification"**
3. You should see a notification appear!

### 💡 Check Your Badge

Look at the **Provisioning Monitor** nav item:
- Red badge appears when new requests arrive
- Shows count of unread notifications
- Clears automatically when you visit Provisioning Monitor

### 💡 Customize Settings

Turn on/off individually:
- ✅ In-Browser Notifications (toast in top-right)
- ✅ Desktop/System Notifications (OS notifications)
- ✅ Sound Alerts (subtle beep)

---

## Browser Permission Denied?

If you accidentally clicked "Block" on the permission prompt:

**Chrome/Edge:**
1. Click the 🔒 lock icon in the address bar
2. Find "Notifications"
3. Change to "Allow"
4. Refresh the page

**Firefox:**
1. Click the 🔒 lock icon in the address bar
2. Click "More Information"
3. Go to "Permissions" tab
4. Find "Notifications" and change to "Allow"
5. Refresh the page

---

## Troubleshooting

### Not Getting Notifications?

**Quick Checklist:**
- ✅ Salesforce authenticated? (Check Settings → Salesforce Integration)
- ✅ Notifications enabled? (Check Settings → Notifications)
- ✅ Browser permission granted? (Should show "✓ Granted" next to Desktop Notifications)

### Still Not Working?

1. Try the **"Send Test Notification"** button in Settings
2. Check browser console (F12) for any error messages
3. Make sure you're not in Do Not Disturb mode (Windows)

---

## For More Details

See: `Technical Documentation/Notification-System-Feature.md`

---

**Enjoy your new notification system! 🎉**

You'll never miss a new PS request again.

