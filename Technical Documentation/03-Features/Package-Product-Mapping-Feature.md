# Package-Product Mapping Feature

**Status:** ✅ Fully Complete - Backend + Frontend + Excel Exports  
**Date:** November 3, 2025  
**Integration:** PS Audit Trail → Package-Product Relationships

---

## 📋 Overview

Successfully extracted and stored package-product relationships from PS Audit Trail data. The system now knows which products are associated with which packages (e.g., D-3-Large → IC-DATABRIDGE).

---

## ✨ What Was Built

### 1. **Data Extraction Script** (`extract-all-package-product-mappings.js`)

Analyzes ALL PS audit trail records to extract package-product relationships from entitlement data.

**Features:**
- Processes all PS records (4,248 records analyzed)
- Extracts from modelEntitlements, dataEntitlements, and appEntitlements
- Creates bidirectional mapping (package→products and product→packages)
- Exports to JSON for backup and reference

**Results:**
- ✅ 38 packages mapped
- ✅ 9 products identified  
- ✅ 47 total mappings created
- ✅ 6,379 entitlements with package info

**Run with:**
```bash
npm run mappings:extract
```

### 2. **Database Schema** (`database/init-scripts/15-package-product-mapping.sql`)

Created `package_product_mapping` table with:

**Fields:**
- `package_name` - Package identifier (e.g., "D-3-Large")
- `product_code` - Product code (e.g., "IC-DATABRIDGE")
- `confidence_score` - Confidence in mapping (0.0-1.0)
- `occurrence_count` - How many times seen in data
- `source` - Data source (ps_audit_trail)
- Timestamps: first_seen, last_seen, created_at, updated_at

**Views Created:**
- `packages_with_products` - Packages with their associated products (JSON aggregated)
- `products_with_packages` - Products with their associated packages (JSON aggregated)

**Functions Created:**
- `upsert_package_product_mapping()` - Insert/update mappings
- `get_products_for_package()` - Get products for a package
- `get_packages_for_product()` - Get packages for a product

### 3. **Population Script** (`populate-package-product-mappings.js`)

Populates the mapping table from extracted JSON data.

**Features:**
- Creates table if not exists
- Loads extracted mappings
- Clears old data (optional)
- Inserts all mappings
- Verifies data integrity
- Tests views and functions

**Run with:**
```bash
npm run mappings:populate
```

### 4. **API Endpoints** (added to `app.js`)

Three new REST endpoints:

#### GET `/api/packages/:identifier/products`
Get products associated with a package

**Example:**
```bash
GET /api/packages/D-3-Large/products
```

**Response:**
```json
{
  "success": true,
  "package": "D-3-Large",
  "products": [
    {
      "product_code": "IC-DATABRIDGE",
      "confidence_score": 1.0,
      "occurrence_count": 1
    }
  ],
  "count": 1
}
```

#### GET `/api/products/:productCode/packages`
Get packages associated with a product

**Example:**
```bash
GET /api/products/IC-DATABRIDGE/packages
```

**Response:**
```json
{
  "success": true,
  "product": "IC-DATABRIDGE",
  "packages": [
    {
      "package_name": "D-1",
      "confidence_score": 1.0,
      "occurrence_count": 1
    },
    {
      "package_name": "D-3-Large",
      "confidence_score": 1.0,
      "occurrence_count": 1
    }
    ...
  ],
  "count": 5
}
```

#### GET `/api/package-product-mappings`
Get all mappings

---

## 📊 Discovered Mappings

### Complete Package-Product Relationships

| Package | Product Code(s) |
|---------|----------------|
| **D-3-Large** | **IC-DATABRIDGE** |
| D-1 | IC-DATABRIDGE |
| D-1-Large | IC-DATABRIDGE |
| D-2 | IC-DATABRIDGE |
| D-2-Large | IC-DATABRIDGE |
| C1 | RI-COD-STN |
| DV-1, DV-3 | RI-DATAVAULT |
| P0-P9 | RI-RISKMODELER, RI-RISKMODELER-EXPOSURE_ADDON |
| P5/P6/P7 Expansion Pack | RI-RISKMODELER-EXPANSION |
| T1, T2, T3, T5 | RI-TREATYIQ |
| U1-U7 | RI-UNDERWRITEIQ |
| X1-X6 | RI-EXPOSUREIQ |

### Reverse Mapping (Products → Packages)

| Product Code | Associated Packages |
|--------------|---------------------|
| **IC-DATABRIDGE** | D-1, D-1-Large, D-2, D-2-Large, **D-3-Large** |
| RI-RISKMODELER | P0-P9 |
| RI-EXPOSUREIQ | X1-X6 |
| RI-UNDERWRITEIQ | U1-U7 |
| RI-TREATYIQ | T1, T2, T3, T5 |
| RI-DATAVAULT | DV-1, DV-3 |
| RI-COD-STN | C1 |

---

## ✅ UI Integration - COMPLETED

### Completed Tasks:

1. **✅ Updated PackagesCatalogueTab** (`frontend/src/pages/PackagesCatalogueTab.jsx`)
   - ✅ Added service call to fetch associated products
   - ✅ Display product codes in package detail modal
   - ✅ Related products shown in blue highlighted section

2. **✅ Updated ProductCatalogueTab** (`frontend/src/pages/ProductCatalogueTab.jsx`)
   - ✅ Added service call to fetch associated packages
   - ✅ Display package names in product detail modal
   - ✅ Related packages shown in green highlighted section

3. **✅ Updated Package Service** (`frontend/src/services/packageService.js`)
   - ✅ Added `getProductsForPackage(packageName)` function

4. **✅ Updated Product Service** (`frontend/src/services/productCatalogueService.js`)
   - ✅ Added `getPackagesForProduct(productCode)` function

5. **✅ Updated Excel Exports**
   - ✅ Added "Related Products" column to Packages export
   - ✅ Added "Related Packages" column to Products export
   - ✅ Both exports now include relationship data via SQL JOIN

---

## 🎨 UI Features

### Packages Tab - Product Display
When viewing a package in the Packages Catalogue:
- Click any package card to open the detail modal
- Related products appear at the top in a **blue highlighted section**
- Shows product codes as badges (e.g., IC-DATABRIDGE)
- Tooltip displays occurrence count on hover

### Products Tab - Package Display
When viewing a product in the Products Catalogue:
- Click any product card to open the detail modal
- Related packages appear at the top in a **green highlighted section**
- Shows package names as badges (e.g., D-3-Large, D-1, D-2)
- Tooltip displays occurrence count on hover

### Excel Exports
Both exports now include relationship columns:

**Product Catalogue Export** (`Product_Catalogue_YYYY-MM-DD.xlsx`):
- New column: **"Related Packages"**
- Shows comma-separated list of package names (e.g., "D-1, D-2, D-3-Large")
- Positioned between "Selection Groupings" and "Attributes"

**Packages Catalogue Export** (`Packages_Catalogue_YYYY-MM-DD.xlsx`):
- New column: **"Related Products"**
- Shows comma-separated list of product codes (e.g., "IC-DATABRIDGE")
- Positioned after "Package Type"

---

## 🔄 Data Refresh

To update mappings when new PS records are added:

```bash
# Extract latest mappings from PS audit trail
npm run mappings:extract

# Populate database with new mappings
npm run mappings:populate
```

**Recommendation:** Set up a scheduled task to run weekly/monthly to keep mappings current.

---

## 📝 Implementation Details

### Data Source

Mappings are extracted from PS Audit Trail payloads:
```json
{
  "properties": {
    "provisioningDetail": {
      "entitlements": {
        "appEntitlements": [
          {
            "productCode": "IC-DATABRIDGE",
            "packageName": "D-3-Large",
            ...
          }
        ]
      }
    }
  }
}
```

### Confidence Score

Currently set to 1.0 for all mappings (high confidence) because they come directly from actual provisioning data.

Future enhancements could use:
- Lower confidence for inferred relationships
- Higher confidence for frequently observed pairings

### Occurrence Count

Tracks how many times a specific package-product pairing has been seen in the data. Useful for:
- Identifying common vs. rare configurations
- Sorting results by relevance
- Validating mapping accuracy

---

## 🧪 Testing

### Verify Mapping Exists
```sql
SELECT * FROM package_product_mapping 
WHERE package_name = 'D-3-Large' AND product_code = 'IC-DATABRIDGE';
```

### Test API Endpoints
```bash
# Get products for D-3-Large package
curl http://localhost:8080/api/packages/D-3-Large/products

# Get packages for IC-DATABRIDGE product  
curl http://localhost:8080/api/products/IC-DATABRIDGE/packages

# Get all mappings
curl http://localhost:8080/api/package-product-mappings
```

### Test Views
```sql
-- Packages with their products
SELECT * FROM packages_with_products WHERE products IS NOT NULL LIMIT 10;

-- Products with their packages
SELECT * FROM products_with_packages WHERE packages IS NOT NULL LIMIT 10;
```

---

## 📚 Files Created

### Scripts
- `extract-all-package-product-mappings.js` - Data extraction
- `populate-package-product-mappings.js` - Database population
- `analyze-ps-payloads-for-packages.js` - Analysis tool (initial version)
- `query-package-product-relationship.js` - Diagnostic tool
- `find-package-product-link.js` - Investigation tool
- `check-product-description.js` - Investigation tool

### Database
- `database/init-scripts/15-package-product-mapping.sql` - Schema

### Data Files
- `package-to-products-2025-11-03.json` - Package→Products mapping
- `product-to-packages-2025-11-03.json` - Product→Packages mapping
- `package-product-mappings-complete-2025-11-03.json` - Combined with metadata

### Modified Backend Files
- `app.js` - Added 3 API endpoints + updated Excel exports
- `package.json` - Added npm scripts

### Modified Frontend Files
- `frontend/src/services/packageService.js` - Added `getProductsForPackage()`
- `frontend/src/services/productCatalogueService.js` - Added `getPackagesForProduct()`
- `frontend/src/pages/PackagesCatalogueTab.jsx` - Display related products in modal
- `frontend/src/pages/ProductCatalogueTab.jsx` - Display related packages in modal

---

## 🎯 Benefits

1. **Visibility:** Users can now see which products are associated with each package
2. **Discovery:** Easy to find all packages for a specific product
3. **Accuracy:** Data comes from actual provisioning records
4. **Automation:** No manual maintenance required - extracts from existing data
5. **Scalability:** Automatically updates as new PS records are added

---

## 🔮 Future Enhancements

- [ ] Automatic scheduled extraction (cron job)
- [ ] UI for manually adding/editing mappings
- [ ] Package recommendations based on product selections
- [ ] Historical tracking of mapping changes
- [ ] Confidence score refinement algorithm
- [ ] Integration with bundle builder
- [ ] Alert when unmapped packages are discovered

---

## ✅ Success Confirmation

✅ Data extraction working (4,248 PS records processed)  
✅ 47 mappings discovered (38 packages, 9 products)  
✅ Database table created and populated  
✅ Views and functions working  
✅ API endpoints implemented and tested  
✅ D-3-Large → IC-DATABRIDGE relationship confirmed  
✅ npm scripts added for easy execution  
✅ Frontend service functions added
✅ UI displays relationships in both Products and Packages tabs
✅ Excel exports include relationship columns

**Backend Status**: Complete ✓  
**Frontend Status**: Complete ✓  
**Excel Exports Status**: Complete ✓

---

## 📖 Related Documentation

- [Packages Integration Summary](../05-Integrations/Packages-Integration-Summary.md)
- [Packages Catalogue Tab](./Packages-Catalogue-Tab.md)
- [Product Catalogue Excel Export](./Product-Catalogue-Excel-Export.md)
- [PS Audit Trail](../02-Architecture/PS-Audit-Trail.md)

