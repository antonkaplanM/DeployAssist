# 500 Error Fix - Bundle Columns Missing

**Issue:** Getting 500 errors when accessing Product Catalogue  
**Cause:** Database migration not run yet (bundle columns don't exist)  
**Status:** ✅ Fixed with graceful error handling

---

## 🔧 What Was Fixed

### Problem
The Regional Bundles feature requires two new columns in the `products` table:
- `is_bundle` (BOOLEAN)
- `constituents` (TEXT)

If these columns don't exist, the application would throw 500 errors when:
1. Loading the Products tab (tries to filter out bundles)
2. Loading the Regional Bundles tab (tries to query bundle products)
3. Getting product details (tries to include constituents)

### Solution Implemented

Added graceful degradation:

1. **Middleware Check** (`middleware/check-bundle-columns.js`)
   - Checks if bundle columns exist before processing requests
   - Returns helpful 503 error for bundle endpoints if columns missing
   - Caches result for performance

2. **Repository Safety** (`repositories/product.repository.js`)
   - Checks column existence before applying bundle filters
   - If columns don't exist, works without bundle filtering
   - Products tab will show all products (including bundles) until migration is run

3. **Clear Error Messages**
   - 503 error with instructions on how to fix
   - Tells user to run the migration script

---

## 🚀 How to Fix the 500 Error

### Step 1: Check If Columns Exist

Run the diagnostic script:
```bash
node scripts/database/check-bundle-columns.js
```

**If columns DON'T exist, you'll see:**
```
❌ ERROR: Bundle columns do NOT exist!

🔧 SOLUTION: Run the migration:
   node scripts/database/run-bundle-constituents-migration.js
```

### Step 2: Run the Migration

```bash
node scripts/database/run-bundle-constituents-migration.js
```

**Expected output:**
```
✅ Bundle analysis complete:
   Total bundles identified: ~150
   Bundles with constituents: ~140
```

### Step 3: Restart Backend

```bash
# Stop the server (Ctrl+C)
npm start
```

### Step 4: Verify Fix

1. Navigate to Product Catalogue
2. Products tab should load (base products only)
3. Regional Bundles tab should load (bundle products)
4. No more 500 errors!

---

## 📊 Current Behavior

### Before Migration (Graceful Degradation)

**Products Tab:**
- ✅ Loads all products (bundles + base products mixed)
- ⚠️  No bundle separation
- Works but not ideal

**Regional Bundles Tab:**
- ❌ Returns 503 error with helpful message
- Tells you to run the migration
- Better than 500 error!

**Error Message Example:**
```json
{
  "success": false,
  "error": "Bundle feature not yet initialized",
  "message": "Please run the database migration: node scripts/database/run-bundle-constituents-migration.js",
  "hint": "The is_bundle and constituents columns need to be added to the products table."
}
```

### After Migration (Full Functionality)

**Products Tab:**
- ✅ Shows base products only
- ✅ Bundles excluded
- ✅ Clean separation

**Regional Bundles Tab:**
- ✅ Shows bundle products only
- ✅ Displays RI Subregions
- ✅ Shows constituents
- ✅ Full functionality

---

## 🔍 Diagnostic Commands

### Check Column Status
```bash
node scripts/database/check-bundle-columns.js
```

### View Sample Data
```bash
node -e "const db = require('./database.js'); (async () => { const r = await db.query('SELECT product_code, name, is_bundle, constituents FROM products WHERE is_bundle = true LIMIT 5'); console.log(r.rows); await db.pool.end(); })();"
```

### Check Bundle Count
```bash
node -e "const db = require('./database.js'); (async () => { const r = await db.query('SELECT COUNT(*) as count FROM products WHERE is_bundle = true'); console.log('Bundles:', r.rows[0].count); await db.pool.end(); })();"
```

---

## 🛡️ Error Prevention Features

### 1. Column Existence Check
```javascript
// Checks if columns exist before using them
const bundleColumnsExist = await this.checkBundleColumns();
if (bundleColumnsExist) {
    // Only apply bundle filter if columns exist
    whereConditions.push(`(is_bundle IS NULL OR is_bundle = false)`);
}
```

### 2. Middleware Protection
```javascript
// Protects bundle endpoints
router.get('/regional-bundles', requireBundleColumns, asyncHandler(...));
```

### 3. Cached Checks
```javascript
// Checks once, caches result for 60 seconds
// Avoids repeated database queries
```

---

## 📝 Files Modified for Error Handling

### New Files
- `middleware/check-bundle-columns.js` - Column existence middleware
- `scripts/database/check-bundle-columns.js` - Diagnostic script
- `docs/summaries/500-ERROR-FIX.md` - This document

### Updated Files
- `repositories/product.repository.js` - Added column checks
- `routes/product-catalogue.routes.js` - Added middleware

---

## 🎯 Quick Fix Summary

**Problem:** 500 errors because bundle columns don't exist  
**Immediate Fix:** Graceful error handling (503 with instructions)  
**Permanent Fix:** Run migration to add columns  
**Command:** `node scripts/database/run-bundle-constituents-migration.js`

---

## ✅ Verification Checklist

After running migration:

- [ ] No 500 errors on Products tab
- [ ] No 503 errors on Regional Bundles tab
- [ ] Products tab shows base products only
- [ ] Regional Bundles tab shows bundles
- [ ] Bundle details include Constituents field
- [ ] All search/filter functionality works

---

**Last Updated:** November 11, 2025  
**Status:** ✅ Fixed

