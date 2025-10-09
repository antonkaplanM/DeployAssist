# Debug Instructions for PS-4652 Tenant Name Issue

## What I Added

I've added comprehensive debug logging to the frontend that will show us **exactly** what's in the PS-4652 data.

## Steps to Debug

### 1. Clear Browser Cache (CRITICAL!)
**Hard refresh to get the updated JavaScript file:**
- Press `Ctrl + Shift + R` (or `Ctrl + F5`)

### 2. Open Browser Console
- Press `F12` to open Developer Tools
- Click on the **Console** tab
- Clear any existing messages (click the 🚫 icon or trash icon)

### 3. Navigate to Account History
1. In the application, go to **Analytics → Account History**
2. Search for the account that contains PS-4652
3. Select the account to load the history

### 4. Check Console Output

You should see debug messages like this:

```
🔍 DEBUG PS-4652: {
    name: "PS-4652",
    account: "Some Account Name",
    parsedPayloadTenantName: undefined,  // <-- This should show the tenant name
    parsedPayloadKeys: [...],
    hasPayloadData: true,
    payloadDataLength: 1234
}

🔍 PS-4652 Payload structure check: {
    properties.provisioningDetail.tenantName: undefined,
    properties.tenantName: "ajg-eudev",  // <-- Look for this!
    tenantName (root): undefined,
    properties keys: [...]
}
```

### 5. Share the Output

**Please copy and paste the ENTIRE console output** that starts with:
- `🔍 DEBUG PS-4652:`
- `🔍 PS-4652 Payload structure check:`
- Any lines showing where "ajg-eudev" was found

This will tell us:
1. ✅ Is the backend sending `parsedPayload.tenantName`?
2. ✅ Where is "ajg-eudev" actually stored in the raw payload?
3. ✅ Are our fallback checks looking in the right places?

## What the Debug Code Does

The debug code:
1. **Detects PS-4652** in the table rendering
2. **Logs the backend parsedPayload** - shows what the backend sent
3. **Re-parses the raw payload** - checks all possible tenant name locations
4. **Searches for "ajg-eudev"** - finds where it's actually stored
5. **Shows the exact line** where "ajg-eudev" appears

## Possible Outcomes

### Scenario 1: Backend is NOT parsing correctly
```
parsedPayloadTenantName: undefined  // ❌ Backend didn't extract it
properties.tenantName: "ajg-eudev"  // ✅ But it's here!
```
**Solution:** Backend fix not working, need to investigate salesforce.js

### Scenario 2: Tenant name is in a different location
```
properties.provisioningDetail.tenantName: undefined
properties.tenantName: undefined
tenantName (root): undefined
✅ Found "ajg-eudev" in payload...
  Line 42: "someOtherField": "ajg-eudev"
```
**Solution:** Need to add that location to our fallback checks

### Scenario 3: "ajg-eudev" not in payload at all
```
❌ "ajg-eudev" NOT found in payload at all!
```
**Solution:** The data might not be in Salesforce, or PS-4652 doesn't actually have a tenant name

### Scenario 4: Everything looks correct but still shows N/A
```
parsedPayloadTenantName: "ajg-eudev"  // ✅ Backend sent it correctly!
```
**Solution:** Frontend display logic issue, need to check the table rendering

## After Debugging

Once you share the console output, I'll know exactly:
- Where the tenant name is stored
- If the backend is parsing correctly
- If the frontend is receiving the data
- What specific fix is needed

---

**Please do a hard refresh (`Ctrl + Shift + R`) and share the console output!** 🔍


