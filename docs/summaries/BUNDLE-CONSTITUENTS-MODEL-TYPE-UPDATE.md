# Bundle Constituents - Model Type Matching Update

**Date:** November 12, 2025  
**Status:** ✅ Complete  
**Update:** Added Model Type attribute to constituent matching logic

---

## 🎯 What Changed

### Evolution of Matching Logic

| Version | Matching Criteria | Bundles with Constituents | Coverage |
|---------|------------------|---------------------------|----------|
| **v1.3.0** | RI Subregion only | 181 / 205 | 88% |
| **v1.4.0** | + Peril | 172 / 205 | 84% |
| **v1.5.0** | + Model Type | **65 / 205** | **32%** |

### Current Logic (v1.5.0)
Constituents now match **all three** attributes:
1. ✅ RI Subregion matches
2. ✅ Peril attribute matches  
3. ✅ **Model Type attribute matches** (NEW)

---

## 📊 Impact Analysis

### Dramatic Change
Adding Model Type matching **reduced constituent coverage from 84% to 32%** (107 bundles lost constituents).

### Why Such a Large Impact?

**Model Type Mismatch Patterns:**
1. **Bundles with NULL Model Type** - Cannot match products with specific Model Types
2. **Cross-Model-Type Bundles** - Bundle has one Model Type, constituents have different Model Types
3. **Data Products** - Many DATA-* products have NULL Model Type

---

## 📈 Breakdown by Model Type

| Model Type | Total Bundles | With Constituents | Success Rate |
|------------|---------------|-------------------|--------------|
| **ALM** | 10 | 8 | **80%** ✅ |
| **DLM** | 43 | 28 | **65%** ✅ |
| **Severe Convective Storm** | 6 | 4 | **67%** ✅ |
| **NULL** | 15 | 4 | **27%** ⚠️ |
| **HD** | 107 | 20 | **19%** ❌ |
| **HD-ALM** | 30 | 5 | **17%** ❌ |
| **Wildfire** | 5 | 0 | **0%** ❌ |

---

## 📈 Breakdown by Peril

| Peril | Bundles | With Constituents | Success Rate |
|-------|---------|-------------------|--------------|
| **Windstorm** | 46 | 31 | **67%** ✅ |
| **Severe Convective Storm** | 6 | 4 | **67%** ✅ |
| **Flood** | 31 | 15 | **48%** ⚠️ |
| **Earthquake** | 117 | 15 | **13%** ❌ |
| **Wildfire** | 5 | 0 | **0%** ❌ |

---

## 🔍 Examples

### Example 1: Bundle WITH Constituents (All Match)

**Bundle:** `ALM-EQ-EUR-21` - ALM Earthquake Europe 21 Country Bundle  
**Peril:** Earthquake  
**Model Type:** ALM  
**Subregions:** EU, AT, BE, BG, CH, DE, ES, FR, GB, GR, HU, IE, IL, IT, LI, LU, NL, PT, RO, SI, TR, AD  
**Constituents:** ALM-EQ-AUT, ALM-EQ-BEL, ALM-EQ-BGR, ALM-EQ-CHE, ALM-EQ-DEU, ...

✅ **Success:** All constituents have:
- Peril = "Earthquake" ✓
- Model Type = "ALM" ✓
- Single matching subregion ✓

---

### Example 2: Bundle WITHOUT Constituents (Model Type NULL)

**Bundle:** `DATA-EQRSC-LAM` - Central & South America Earthquake Risk Scores  
**Peril:** Earthquake  
**Model Type:** NULL  
**Subregions:** AR, BO, BR, CO, EC, PE, VE, CL, BZ, SV, CR, GT, HN, NI, PA  
**Constituents:** None

❌ **Reason:** No base products found with:
- Single subregion = one of the above AND
- Peril = "Earthquake" AND  
- Model Type = NULL

**Issue:** Most base products have a specific Model Type (ALM, DLM, HD), not NULL.

---

### Example 3: Bundle WITHOUT Constituents (Model Type Mismatch)

**Bundle:** `ALM-EQ-CAR` - ALM Earthquake Caribbean  
**Peril:** Earthquake  
**Model Type:** ALM  
**Subregions:** CB, FC  
**Constituents:** None

❌ **Reason:** The constituent product `DATA-EQRSC-CAR` exists with:
- Subregion = "CB" ✓
- Peril = "Earthquake" ✓
- Model Type = NULL ✗ (doesn't match "ALM")

---

## ⚠️ Observations

### 1. HD Models Heavily Affected
- 107 HD bundles → only 20 with constituents (19%)
- Suggests HD bundles may aggregate products from different model types

### 2. Earthquake Bundles Impacted
- 117 Earthquake bundles → only 15 with constituents (13%)
- Many Earthquake products may use different model types than their bundles

### 3. Data Products Issue
- Many DATA-* products have NULL Model Type
- Cannot match bundles with specific Model Types

### 4. ALM Products Work Well
- 80% success rate for ALM bundles
- ALM products have consistent Model Type tagging

---

## 🔧 Technical Implementation

### Database Update Script

**File:** `database/update-bundle-constituents-with-model-type.sql`

**Key Change:**
```sql
-- Find base products matching ALL THREE criteria
SELECT DISTINCT product_code
FROM products
WHERE is_active = true
AND ri_platform_sub_region = subregion_value
AND product_code != bundle_record.product_code
-- Match Peril attribute
AND (
    (peril = bundle_record.peril) OR 
    (peril IS NULL AND bundle_record.peril IS NULL)
)
-- NEW: Match Model Type attribute
AND (
    (model_type = bundle_record.model_type) OR 
    (model_type IS NULL AND bundle_record.model_type IS NULL)
);
```

**NULL Handling:** NULL Model Type values only match other NULL Model Type values.

---

## 🚀 How to Run

### 1. Apply the Update

```bash
node scripts/database/update-bundle-constituents-with-model-type.js
```

### 2. Check Results

```bash
node scripts/database/check-model-type-matching-results.js
```

### 3. Restart Backend (Optional)

Changes are in the database - no restart needed.

---

## 📁 Files Created

```
database/update-bundle-constituents-with-model-type.sql
scripts/database/update-bundle-constituents-with-model-type.js
scripts/database/check-model-type-matching-results.js
docs/summaries/BUNDLE-CONSTITUENTS-MODEL-TYPE-UPDATE.md (this file)
```

---

## 💡 Recommendations

### Option 1: Keep Strict Matching (Current)
**Pros:**
- Most accurate constituent lists
- Respects all three product attributes
- 32% of bundles have high-quality constituent data

**Cons:**
- 68% of bundles have no constituents
- May be too restrictive for some use cases

### Option 2: Relax Model Type Matching
Consider modifying logic to:
- Allow NULL Model Type to match any Model Type
- Allow specific Model Type compatibility rules (e.g., HD can include HD-ALM)

### Option 3: Make Model Type Optional
Add a flag to enable/disable Model Type matching:
- Strict mode: Use all three criteria (32% coverage)
- Standard mode: Use Peril + Subregion only (84% coverage)

---

## ✅ Status

- [x] ✅ Update script created
- [x] ✅ Update executed successfully  
- [x] ✅ 65 bundles have constituents (32% coverage)
- [x] ✅ 140 bundles without constituents (68%)
- [x] ✅ Model Type matching confirmed working
- [x] ✅ Documentation complete

---

## 🔮 Next Steps

**Suggested Actions:**

1. **Review the 32% Coverage** - Determine if this is acceptable
2. **Analyze HD Bundles** - Investigate why HD bundles have low success rate
3. **Fix NULL Model Types** - Update DATA-* products to have proper Model Types
4. **Consider Relaxing Logic** - May need to allow some Model Type flexibility
5. **User Feedback** - Gather input on whether strict matching is desired

---

## 📞 Support

**Related Documentation:**
- [Peril Matching Update](./BUNDLE-CONSTITUENTS-PERIL-MATCHING-UPDATE.md)
- [Regional Bundles Feature](../technical/Product-Catalogue-Regional-Bundles.md)

**Scripts:**
- Update: `scripts/database/update-bundle-constituents-with-model-type.js`
- Check Results: `scripts/database/check-model-type-matching-results.js`

---

## 🎯 Summary

**What:** Added Model Type attribute to constituent matching  
**Impact:** Constituent coverage dropped from 84% to 32%  
**Accuracy:** Highest precision - matches 3 attributes  
**Trade-off:** Fewer bundles have constituents, but those that do are highly accurate  
**Status:** ✅ Implemented - awaiting feedback on strictness level

---

**Update Date:** November 12, 2025  
**Version:** 1.5.0  
**Status:** ✅ Deployed  
**Coverage:** 32% (65 of 205 bundles)

⚠️ **Significant impact - review results before proceeding**







