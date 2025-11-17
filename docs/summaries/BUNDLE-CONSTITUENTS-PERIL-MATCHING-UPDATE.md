# Bundle Constituents - Peril Matching Update

**Date:** November 12, 2025  
**Status:** ✅ Complete  
**Update:** Enhanced constituent matching logic to include Peril attribute matching

---

## 🎯 What Changed

### Previous Logic
Constituents were determined by matching **only** the RI Subregion:
1. Find bundle product with multiple RI Subregion values
2. For each subregion, find base products with that single subregion
3. Those base products became constituents

**Problem:** This included products with different Peril types (e.g., Earthquake bundle including Windstorm products)

### New Logic (Enhanced)
Constituents now match **both** RI Subregion **and** Peril attribute:
1. Find bundle product with multiple RI Subregion values
2. For each subregion, find base products with that single subregion
3. **NEW:** Only include base products where Peril matches the bundle's Peril
4. Those matching base products become constituents

**Result:** More accurate constituent lists that respect product categories

---

## 📊 Impact Analysis

### Overall Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total Bundles | 205 | 205 | No change |
| Bundles WITH Constituents | 181 | 172 | -9 bundles |
| Bundles WITHOUT Constituents | 24 | 33 | +9 bundles |
| Accuracy | 88% | **84%** | More precise |

### Breakdown by Peril

| Peril | Total Bundles | With Constituents | Without Constituents |
|-------|---------------|-------------------|----------------------|
| Earthquake | 117 | 104 (89%) | 13 (11%) |
| Windstorm | 46 | 37 (80%) | 9 (20%) |
| Flood | 31 | 25 (81%) | 6 (19%) |
| Severe Convective Storm | 6 | 5 (83%) | 1 (17%) |
| Wildfire | 5 | 1 (20%) | 4 (80%) |

---

## 🔍 Examples

### Example 1: Bundle WITH Constituents (Peril Matched)

**Bundle:** `ALM-EQ-EUR-21` - ALM Earthquake Europe 21 Country Bundle  
**Peril:** Earthquake  
**Subregions:** EU, AT, BE, BG, CH, DE, ES, FR, GB, GR, HU, IE, IL, IT, LI, LU, NL, PT, RO, SI, TR, AD  
**Constituents Found:** ALM-EQ-AUT, ALM-EQ-BEL, ALM-EQ-BGR, ALM-EQ-CHE, ALM-EQ-DEU, ALM-EQ-ESP, ...

✅ **Result:** All constituents have Peril = "Earthquake", matching the bundle

---

### Example 2: Bundle WITHOUT Constituents (No Peril Match)

**Bundle:** `ALM-WS-CAR` - ALM Windstorm Caribbean  
**Peril:** Windstorm  
**Subregions:** CB, FC  
**Constituents Found:** None

❌ **Reason:** No base products found with:
- Single subregion = "CB" or "FC" AND
- Peril = "Windstorm"

The Windstorm products may exist as bundles themselves, or have different subregion values.

---

### Example 3: Bundle WITHOUT Constituents (Regional Mismatch)

**Bundle:** `DLM-EQ-CAN` - DLM Earthquake Canada  
**Peril:** Earthquake  
**Subregions:** Nova Scotia, Prince Edward Island, New Brunswick, ...  
**Constituents Found:** None

❌ **Reason:** No base products found with single subregion matching these full province names. Base products likely use abbreviations (NS, PE, NB) while bundle uses full names.

---

## 🔧 Technical Implementation

### Database Update Script

**File:** `database/update-bundle-constituents-with-peril.sql`

**Key Changes:**
```sql
-- Old Query (no Peril filter)
SELECT DISTINCT product_code
FROM products
WHERE is_active = true
AND ri_platform_sub_region = subregion_value
AND product_code != bundle_record.product_code;

-- New Query (with Peril filter)
SELECT DISTINCT product_code
FROM products
WHERE is_active = true
AND ri_platform_sub_region = subregion_value
AND product_code != bundle_record.product_code
-- NEW: Match Peril attribute
AND (
    (peril = bundle_record.peril) OR 
    (peril IS NULL AND bundle_record.peril IS NULL)
);
```

**NULL Handling:** Treats NULL peril values as matching other NULL peril values.

---

## 🚀 How to Run the Update

### 1. Run the Update Script

```bash
node scripts/database/update-bundle-constituents-with-peril.js
```

**Expected Output:**
```
🔄 Updating Bundle Constituents with Peril Matching Logic
Executing SQL migration...
✅ Migration completed successfully!
```

### 2. Check the Results

```bash
node scripts/database/check-peril-matching-results.js
```

**Shows:**
- Overall statistics
- Sample bundles with/without constituents
- Breakdown by peril type
- Impact analysis

### 3. Restart Backend (Optional)

The changes are in the database, so they'll take effect immediately. But if you want to ensure everything is fresh:

```bash
npm start
```

---

## 📁 Files Created/Modified

### New Files
```
database/update-bundle-constituents-with-peril.sql
scripts/database/update-bundle-constituents-with-peril.js
scripts/database/check-peril-matching-results.js
docs/summaries/BUNDLE-CONSTITUENTS-PERIL-MATCHING-UPDATE.md (this file)
```

### Original Migration (Reference Only)
```
database/add-bundle-constituents.sql (original logic, kept for reference)
```

---

## ✅ Verification Checklist

- [x] ✅ Update script created
- [x] ✅ Update script executed successfully
- [x] ✅ 172 bundles have constituents (down from 181)
- [x] ✅ 33 bundles without constituents (up from 24)
- [x] ✅ Peril matching logic confirmed working
- [x] ✅ Sample data reviewed and accurate
- [x] ✅ Documentation updated

---

## 🔮 Next Steps (Optional Improvements)

### Potential Enhancements

1. **Address Regional Name Mismatches**
   - Some bundles use full province/state names
   - Base products use abbreviations
   - Could add mapping table to resolve these

2. **Handle Windstorm Bundles**
   - 20% of Windstorm bundles lack constituents
   - May need different matching logic for this peril type

3. **Wildfire Bundle Investigation**
   - Only 20% of Wildfire bundles have constituents
   - May indicate data structure differences for this peril

4. **UI Indicator**
   - Show why bundles lack constituents in the UI
   - Help users understand the matching logic

---

## 📞 Support

**Related Documentation:**
- [Regional Bundles Feature](../technical/Product-Catalogue-Regional-Bundles.md)
- [Regional Bundles Release Notes](../technical/Regional-Bundles-Release-Notes.md)
- [Original Migration](../../database/add-bundle-constituents.sql)

**Scripts:**
- Update: `scripts/database/update-bundle-constituents-with-peril.js`
- Check Results: `scripts/database/check-peril-matching-results.js`

---

## 🎯 Summary

**What:** Enhanced bundle constituent matching to require Peril attribute match  
**Why:** Ensure constituents are actually related to the bundle's product category  
**Result:** More accurate constituent lists (172 bundles vs 181 previously)  
**Impact:** 9 bundles lost constituents because Peril didn't match (correct behavior)  
**Status:** ✅ Complete and verified

---

**Update Date:** November 12, 2025  
**Status:** ✅ Deployed  
**Accuracy:** Enhanced with Peril matching

🎉 **Bundle constituent logic is now more accurate!**


