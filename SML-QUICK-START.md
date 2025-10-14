# SML Integration - Quick Start Guide

## 🎯 What This Does
The SML integration allows you to pull product entitlement data (Apps, Models, and Data) from the SML API and display it on the Customer Products page. Instead of relying solely on Salesforce payload data, you now get real-time data directly from SML.

## ⚡ Quick Setup (5 Minutes)

### Step 1: Get Your Bearer Token
1. Open your browser and log into the SML portal
2. Press `F12` to open Developer Tools
3. Go to **Network** tab
4. Refresh the page or navigate to any data page
5. Click on any API request (look for requests to `/sml/` or `/v1/`)
6. In the **Request Headers** section, find the **Authorization** header
7. Copy the token value **AFTER** "Bearer " (it's a long JWT string starting with `eyJ...`)

### Step 2: Configure the App
1. In the Deployment Assistant, click **Settings** in the sidebar
2. Expand the **SML Integration** section
3. Select your environment:
   - **PE EUW1** for Europe (`https://api-euw1.rms.com`)
   - **PE USE1** for US East (`https://api-use1.rms.com`)
4. Paste the Bearer token you copied (don't include "Bearer " prefix)
5. Click **Save Configuration**
6. Click **Test Connection** to verify it works

### Step 3: Use It!
1. Navigate to **Customer Products** page
2. Search for a customer account
3. The app will automatically:
   - Find the tenant ID from Salesforce
   - Fetch products from SML
   - Display Apps, Models, and Data with dates and status

## 📝 Important Notes

### Token Expiration
- ⏰ **The Bearer token expires periodically (typically after a few hours)**
- When it expires, you'll see: *"SML authentication expired"* or *"401 Unauthorized"*
- Just get a fresh token and save it again (Steps 1-2 above)

### How It Works
```
Customer Search → Find Tenant in Salesforce → Query SML API → Display Products
```

The app uses Salesforce to find the tenant name/ID, then queries SML for the actual product data.

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "SML integration not configured" | Complete Step 2 above |
| "authentication expired" | Token expired - get a new one (Step 1) |
| "Could not find tenant information" | Account might not have tenant data in Salesforce |
| Products not showing | Check Settings → Test Connection |

## 🎨 What You'll See

The Customer Products page will show:
- **Apps**: Application entitlements
- **Models**: Risk models
- **Data**: Data entitlements
- **Dates**: Start and end dates for each product
- **Status**: Active, expired, etc.
- **Days Remaining**: Until expiration

## 💡 Pro Tips

1. **Test First**: Always test the connection after configuring
2. **Keep Network Tab Open**: Makes it easier to grab the token when refreshing
3. **Check Expiration**: If data isn't loading, the token might be expired
4. **Environment Matters**: Make sure you're using the right environment (euw1 vs use1)

## 📚 More Information

For detailed documentation, see `SML-INTEGRATION-SUMMARY.md`

## 🚀 That's It!

You're now ready to view real-time product entitlements from SML. The integration runs automatically whenever you search for a customer on the Customer Products page.

