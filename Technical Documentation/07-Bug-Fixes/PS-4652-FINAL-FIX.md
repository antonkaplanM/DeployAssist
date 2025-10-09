# PS-4652 Tenant Name Issue - FINAL FIX ✅

## Issue
PS-4652 was showing **"N/A"** for Tenant Name instead of **"ajg-eudev"** in the Account History page.

## Root Cause - THE REAL ISSUE
We were trying to extract the tenant name from the **JSON payload** (`Payload_Data__c`), but the tenant name is actually stored as a **direct Salesforce field** on the `Prof_Services_Request__c` object!

**Field Name:** `Tenant_Name__c`

## Previous Attempts (Incorrect Approach)
❌ Tried to extract from `payload.properties.provisioningDetail.tenantName`  
❌ Tried to extract from `payload.properties.tenantName`  
❌ Tried to extract from `payload.preferredSubdomain1`  

**The Problem:** We were looking in the wrong place! The tenant name is a **Salesforce field**, not a JSON payload property.

## The Correct Solution ✅

### 1. Added `Tenant_Name__c` to SOQL Queries

Updated the main SOQL query in `queryProfServicesRequests()`:

**Before:**
```sql
SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
       Account_Site__c, Billing_Status__c, RecordTypeId,
       TenantRequestAction__c, Payload_Data__c,
       Requested_Install_Date__c, RequestedGoLiveDate__c,
       CreatedDate, LastModifiedDate, CreatedBy.Name
FROM Prof_Services_Request__c
WHERE Name LIKE 'PS-%'
```

**After:**
```sql
SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
       Account_Site__c, Billing_Status__c, RecordTypeId,
       TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,  ✅ ADDED
       Requested_Install_Date__c, RequestedGoLiveDate__c,
       CreatedDate, LastModifiedDate, CreatedBy.Name
FROM Prof_Services_Request__c
WHERE Name LIKE 'PS-%'
```

### 2. Updated Record Processing Logic

Modified the code to use the `Tenant_Name__c` field value directly:

```javascript
// Process the results to parse JSON payload
const processedRecords = result.records.map(record => {
    const parsedPayload = parsePayloadData(record.Payload_Data__c);
    
    // ✅ Override tenantName with the Salesforce field value if available
    if (record.Tenant_Name__c) {
        parsedPayload.tenantName = record.Tenant_Name__c;
    }
    
    return {
        ...record,
        parsedPayload: parsedPayload
    };
});
```

This approach:
- ✅ Reads the `Tenant_Name__c` field directly from Salesforce
- ✅ Overrides any payload-parsed value with the field value
- ✅ Falls back to payload parsing if the field is empty (backward compatibility)

### 3. Updated getProfServicesRequestById()

Also updated the single record query to include and use `Tenant_Name__c`:

```javascript
const record = result.records[0];
const parsedPayload = parsePayloadData(record.Payload_Data__c);

// ✅ Override tenantName with the Salesforce field value if available
if (record.Tenant_Name__c) {
    parsedPayload.tenantName = record.Tenant_Name__c;
}

return {
    success: true,
    record: {
        ...record,
        parsedPayload: parsedPayload
    }
};
```

## Files Modified

### Backend Files
1. **`salesforce.js`**
   - Line 270: Added `Tenant_Name__c` to main SOQL query
   - Lines 328-338: Updated record processing to use `Tenant_Name__c` field
   - Line 540: Added `Tenant_Name__c` to single record query
   - Lines 564-569: Updated single record processing to use `Tenant_Name__c` field

### Frontend Files
2. **`public/script.js`**
   - Line 7033: Updated debug logging to show `Tenant_Name__c` field
   - Line 7045: Updated debug logging to show Salesforce field value

## Why This is Better

### Previous Approach (Payload Parsing) ❌
```javascript
// Unreliable - payload structure varies
tenantName: payload.properties?.provisioningDetail?.tenantName 
    || payload.properties?.tenantName 
    || payload.preferredSubdomain1
    || payload.preferredSubdomain2
    || null;
```

**Problems:**
- Payload structures vary across different records
- Need to check multiple possible locations
- Unreliable and brittle
- Hard to maintain

### New Approach (Direct Field Access) ✅
```javascript
// Reliable - direct Salesforce field
if (record.Tenant_Name__c) {
    parsedPayload.tenantName = record.Tenant_Name__c;
}
```

**Benefits:**
- ✅ Direct field access - always reliable
- ✅ Single source of truth
- ✅ Consistent across all records
- ✅ Easy to maintain
- ✅ Falls back to payload parsing if field is empty

## What This Fixes

### For PS-4652
- ✅ **Tenant Name column** will show "ajg-eudev" (not "N/A")
- ✅ **Tenant filter dropdown** will include "ajg-eudev"
- ✅ **Details view** will show "ajg-eudev"
- ✅ **Comparison view** will use "ajg-eudev" for grouping

### For All Records
- ✅ All records with `Tenant_Name__c` populated will display correctly
- ✅ More reliable than payload parsing
- ✅ Consistent tenant name display across the application

## Testing Steps

### 1. Hard Refresh Browser
**CRITICAL - Clear JavaScript cache:**
- Press `Ctrl + Shift + R` (or `Ctrl + F5`)

### 2. Load Account History
1. Navigate to **Analytics → Account History**
2. Search for "AJG Re(Willis Re Inc. - formerly)"
3. Select the account

### 3. Verify PS-4652
**Check the table:**
- Find PS-4652 in the list
- **Tenant Name column** should show **"ajg-eudev"** ✅

**Check the console (F12):**
```
🔍 DEBUG PS-4652: {
    tenantNameField: "ajg-eudev",  ✅ From Salesforce field!
    parsedPayloadTenantName: "ajg-eudev",
    ...
}
```

**Check the filter:**
- Tenant filter dropdown should include "ajg-eudev" ✅
- Select "ajg-eudev" - PS-4652 should remain visible ✅

### 4. Verify Details View
1. Click on PS-4652 to expand
2. Tenant name should appear in details section ✅

## Server Status

✅ **Server restarted** with updated code  
✅ **SOQL queries** now include `Tenant_Name__c`  
✅ **Record processing** uses field value directly  

## Debug Information

The debug console will now show:
```javascript
{
    'Salesforce Tenant_Name__c field': "ajg-eudev",  // ✅ Direct from Salesforce!
    'properties.provisioningDetail.tenantName': null,
    'properties.tenantName': undefined,
    'preferredSubdomain1': "ajg-eudev",
    'preferredSubdomain2': "ajg-eudev"
}
```

This shows:
- ✅ Salesforce field has the correct value
- The payload also has it in `preferredSubdomain` fields
- But we're now using the **direct Salesforce field** (more reliable!)

## Key Takeaways

### What We Learned
1. **Always check for direct Salesforce fields first** before parsing payloads
2. Payload structures can vary - direct fields are more reliable
3. The `Tenant_Name__c` field exists on `Prof_Services_Request__c` object
4. Direct field access is simpler and more maintainable than JSON parsing

### Best Practices Going Forward
1. ✅ Query Salesforce fields directly when available
2. ✅ Use payload parsing as a fallback only
3. ✅ Document which fields are available on Salesforce objects
4. ✅ Test with real data to verify field values

## Verification Checklist

- [x] Added `Tenant_Name__c` to main SOQL query
- [x] Updated record processing to use field value
- [x] Added field to single record query
- [x] Updated single record processing
- [x] Updated debug logging to show field value
- [x] No linter errors
- [x] Server restarted
- [ ] **USER ACTION:** Hard refresh browser (`Ctrl + Shift + R`)
- [ ] **USER ACTION:** Verify PS-4652 shows "ajg-eudev"
- [ ] **USER ACTION:** Verify tenant filter includes "ajg-eudev"
- [ ] **USER ACTION:** Verify details view shows tenant name

---

**Status:** ✅ **FINAL FIX APPLIED**  
**Date:** October 9, 2025  
**Solution:** Using direct Salesforce field `Tenant_Name__c` instead of payload parsing  
**Next Step:** Hard refresh browser and verify PS-4652 displays "ajg-eudev"! 🎉


