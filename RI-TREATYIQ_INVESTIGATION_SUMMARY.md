# RI-TREATYIQ Missing Product Investigation

**Date:** November 3, 2025  
**Issue:** RI-TREATYIQ product code was not showing in the Product Catalogue  
**Status:** ✅ RESOLVED

---

## 🔍 Investigation Summary

### What We Found:

1. **✅ Product EXISTS in Salesforce**
   - Salesforce ID: `01t0d000006AU5bAAG`
   - Name: `TREATYIQ`
   - Product Code: `RI-TREATYIQ`
   - Family: `Risk Modeler`
   - Status: `Active` (not archived, not deleted)

2. **❌ Product DID NOT EXIST in Local Database**
   - The product was not synced from Salesforce
   - Total active products in DB: 1,342
   - RI-TREATYIQ was missing from this count

3. **❌ Sync Script Had Database Connection Issue**
   - Error: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
   - The `sync-products-from-salesforce.js` script could not connect to the database
   - This suggests the product sync may have failed silently or never completed successfully

---

## ✅ Resolution

### Immediate Fix Applied:
Created and ran `add-treatyiq-product.js` which:
- Connected to the database using a simple pg Client
- Inserted the RI-TREATYIQ product directly
- Used `ON CONFLICT` to handle if it already existed
- Verified the insert was successful

### Product Now in Database:
```json
{
  "name": "TREATYIQ",
  "product_code": "RI-TREATYIQ",
  "is_active": true,
  "is_archived": false,
  "salesforce_id": "01t0d000006AU5bAAG",
  "family": "Risk Modeler",
  "description": "TreatyIQ"
}
```

---

## 🚨 Root Cause Analysis

### Why Was It Missing?

The product sync process has a database connection configuration issue:

**Error Message:**
```
SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**Possible Causes:**
1. **Password Encoding Issue** - The DATABASE_URL in `.env` may have special characters that need URL encoding
2. **Connection Pool Configuration** - The sync script uses a different database connection method than the main app
3. **Incomplete Sync** - The product may have been added to Salesforce after the last successful sync

**Evidence:**
- The main app (`app.js`) connects to the database successfully
- Standalone scripts (`sync-products-from-salesforce.js`, `sync-single-product.js`) fail with password error
- This suggests the database pool configuration in `database.js` has issues when used outside the main app context

---

## 📋 Other Potentially Missing Products

Since the sync has been failing, there may be OTHER products that were added to Salesforce but never synced to the local database.

### To Check:
1. Compare total count in Salesforce vs. local database
2. Check if there are other recent products in Salesforce that are missing locally
3. Review sync logs to see when the last successful sync occurred

---

## 🔧 Recommended Fixes

### 1. Fix Database Connection in Sync Scripts (HIGH PRIORITY)

**Problem:** Sync scripts can't connect to database

**Solution Options:**

#### Option A: Fix PASSWORD_URL Encoding
Check if the password has special characters that need URL encoding:
```javascript
// In .env, ensure password is properly encoded
DATABASE_URL=postgresql://user:p%40ssw%24rd@host:port/db
```

#### Option B: Use Separate Connection Logic for Scripts
Create a dedicated connection function for sync scripts:
```javascript
// sync-database.js
const { Client } = require('pg');

async function getSyncConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('amazonaws.com')
            ? { rejectUnauthorized: false }
            : undefined
    });
    await client.connect();
    return client;
}
```

#### Option C: Run Syncs via API Endpoint
Use the existing `/api/product-catalogue/refresh` endpoint which uses the app's working database connection.

---

### 2. Add Sync Monitoring (MEDIUM PRIORITY)

**Add alerts for:**
- Failed syncs
- Sync age (warn if > 7 days old)
- Missing products (Salesforce count vs. DB count mismatch)

**Implementation:**
```javascript
// Check sync status dashboard
app.get('/api/product-catalogue/sync-status', async (req, res) => {
    const lastSync = await getLastSync();
    const sfCount = await getSalesforceProductCount();
    const dbCount = await getDatabaseProductCount();
    
    res.json({
        lastSync: lastSync,
        salesforceCount: sfCount,
        databaseCount: dbCount,
        discrepancy: sfCount - dbCount
    });
});
```

---

### 3. Add Manual Sync Trigger (LOW PRIORITY)

**Add UI button to trigger sync:**
- Available to admin users
- Shows sync progress
- Reports any errors
- Displays before/after counts

---

## 📝 Scripts Created During Investigation

### Diagnostic Scripts:
1. `check-product-in-db.js` - Check if a product exists in local database
2. `check-product-in-salesforce.js` - Check if a product exists in Salesforce
3. `check-last-sync.js` - Check sync history and timing

### Fix Scripts:
4. `add-treatyiq-product.js` - **Successfully added RI-TREATYIQ** ✅
5. `sync-single-product.js` - Attempt to sync single product (failed due to connection)

### SQL Files:
6. `INSERT_RI_TREATYIQ.sql` - Manual SQL insert (backup method)

---

## ✅ Immediate Action Items

- [x] RI-TREATYIQ product added to database
- [ ] Refresh the Product Catalogue page in browser to see the product
- [ ] Test that RI-TREATYIQ appears in Products tab
- [ ] Test that RI-TREATYIQ appears in Excel export
- [ ] Verify package-product mappings show correctly (T1, T2, T3, T5 → RI-TREATYIQ)

---

## 🔮 Future Prevention

### Short Term:
1. Run `add-treatyiq-product.js` type scripts for any other missing products
2. Document the database connection issue
3. Create a workaround sync method that works

### Long Term:
1. Fix the root database connection issue in sync scripts
2. Implement automated sync monitoring
3. Add UI sync trigger for admins
4. Set up alerts for sync failures
5. Consider scheduled automatic syncs (daily/weekly)

---

## 📊 Current Status

| Item | Status |
|------|--------|
| RI-TREATYIQ in Salesforce | ✅ Yes |
| RI-TREATYIQ in Database | ✅ Yes (Fixed) |
| RI-TREATYIQ visible in UI | ⏳ Pending browser refresh |
| Sync script working | ❌ No (connection issue) |
| Other missing products | ⚠️ Unknown (needs investigation) |

---

## 🎯 Next Steps

1. **Immediate:** Refresh your Product Catalogue page to see RI-TREATYIQ
2. **Soon:** Investigate if there are other missing products
3. **Later:** Fix the sync script database connection issue
4. **Future:** Implement sync monitoring and alerts

---

The product is now in the database and should appear in your Product Catalogue! 🎉


