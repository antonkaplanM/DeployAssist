# Quick Start: Regional Fields Update

## 🚀 One-Command Deployment (Windows)

```powershell
.\deploy-regional-fields.ps1
```

This automated script will:
1. ✅ Test Salesforce field accessibility
2. ✅ Run database migration
3. ✅ Sync products from Salesforce

To skip the Salesforce test:
```powershell
.\deploy-regional-fields.ps1 -SkipTest
```

---

## 📋 Manual Step-by-Step (All Platforms)

### Step 1: Test Field Access (Optional)
```bash
node test-regional-fields.js
```

### Step 2: Run Migration
```bash
node run-regional-fields-migration.js
```

### Step 3: Sync Products
```bash
node sync-products-from-salesforce.js
```

---

## 🔍 Quick Verification

### Check Database
```sql
-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('continent', 'irp_bundle_region', 'irp_bundle_subregion');

-- Check data for ALM-EQ-ARG
SELECT product_code, name, continent, irp_bundle_region, irp_bundle_subregion 
FROM products 
WHERE product_code = 'ALM-EQ-ARG';
```

Expected result: `continent = 'South America'`

### Check API
Visit: `http://localhost:5000/api/product-catalogue?search=ALM-EQ-ARG`

Should include:
```json
{
  "Continent__c": "South America",
  "IRP_Bundle_Region__c": "...",
  "IRP_Bundle_Subregion__c": "..."
}
```

---

## ❓ What Changed?

### 🆕 New Database Columns
- `continent` ← Salesforce `Continent__c`
- `irp_bundle_region` ← Salesforce `IRP_Bundle_Region__c` ⚠️ CRITICAL
- `irp_bundle_subregion` ← Salesforce `IRP_Bundle_Subregion__c` ⚠️ CRITICAL

### 📁 Modified Files
- `sync-products-from-salesforce.js` - SOQL query + data mapping
- `app.js` - 3 API endpoints updated
- Database schema - 3 new columns with indexes

### 🆕 New Files
- `database/add-regional-bundle-fields.sql` - Migration script
- `run-regional-fields-migration.js` - Automated migration
- `test-regional-fields.js` - Field accessibility test
- `deploy-regional-fields.ps1` - One-command deployment

---

## 🎯 What Problem Does This Solve?

**Before:** Missing critical regional and bundle fields from Product2 object  
**After:** Complete data synchronization with all Product2 fields

### Example: ALM-EQ-ARG Product
- ❌ **Before:** No continent or bundle region data
- ✅ **After:** Shows "South America" and IRP bundle classifications

---

## 📊 Impact

- ✅ **No breaking changes** - New fields added as optional
- ✅ **Backward compatible** - Existing code continues to work
- ✅ **Automatic in exports** - Excel exports include new fields
- ✅ **API enhanced** - All endpoints return complete data

---

## 🔧 Troubleshooting

### "INVALID_FIELD" Error
**Cause:** Fields don't exist or aren't accessible in Salesforce  
**Fix:** Verify field names and permissions in Salesforce

### "Column already exists" Error
**Cause:** Migration already run  
**Fix:** Safe to ignore - skip to Step 3 (sync)

### NULL Values in New Fields
**Cause:** Salesforce doesn't have values for these products  
**Fix:** This is normal - not all products have regional designations

---

## 📖 Full Documentation

See `REGIONAL-FIELDS-UPDATE-SUMMARY.md` for:
- Complete implementation details
- All code changes
- Deployment instructions
- Rollback plan
- API response examples

---

## ✅ Success Checklist

After deployment:
- [ ] Migration completed without errors
- [ ] Product sync completed
- [ ] ALM-EQ-ARG shows `Continent = 'South America'`
- [ ] API returns new fields
- [ ] Excel export includes new fields in Attributes

---

**Status:** Ready to Deploy  
**Estimated Time:** 2-5 minutes  
**Risk Level:** Low (backward compatible)

