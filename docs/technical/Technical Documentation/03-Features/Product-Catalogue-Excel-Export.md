# Product Catalogue Excel Export Feature

**Status:** ✅ Complete (Updated with Packages Tab)  
**Date:** November 3, 2025 (Updated November 3, 2025)  
**Location:** Product Catalogue Page (`/experimental/product-catalogue`)

---

## 📋 Overview

Added Excel export functionality to the Product Catalogue page, allowing users to download all active products **and packages** in a structured Excel spreadsheet format with **two tabs**: Products and Packages.

---

## ✨ Features

### 1. **Export Button**
- Located next to the Refresh button on the Product Catalogue tab
- Green button with download icon for easy identification
- Disabled when no products are available or during export
- Shows "Exporting..." status while generating the file

### 2. **Excel Format**
The exported Excel file now contains **two tabs/sheets**:

#### 📊 **Tab 1: Products**
| Column | Description |
|--------|-------------|
| **Name** | Product name |
| **Code** | Product code |
| **Description** | Product description |
| **Family** | Product family |
| **Selection Groupings** | Product selection grouping |
| **Related Packages** | Comma-separated list of associated packages |
| **Attributes** | All other product attributes (formatted as key-value pairs) |

#### 📦 **Tab 2: Packages**
| Column | Description |
|--------|-------------|
| **Package Name** | Package identifier |
| **RI Package Name** | RI-specific package name |
| **Type** | Package type |
| **Description** | Package description |
| **Related Products** | Comma-separated list of associated products |
| **Specifications** | Package limits and specifications (formatted as key-value pairs) |

### 3. **Attributes & Specifications Columns**

#### Products Tab - Attributes Column
Contains additional product information:
- Product Group
- Product Family L2
- Product Reporting Group
- Product Variant
- Product Versions
- Type of Configuration
- Is Expansion Pack
- Product Selection Restriction
- Display URL
- Salesforce ID

#### Packages Tab - Specifications Column
Contains package limits and technical specifications:
- Locations
- Max Concurrent Model
- Max Concurrent Non-Model
- Max Jobs/Day
- Max Users
- Number of EDMs
- Max Exposure Storage (TB)
- Max Other Storage (TB)
- API RPS
- Salesforce ID

All attributes and specifications are formatted as multi-line text with "Key: Value" pairs for easy reading.

---

## 🔧 Technical Implementation

### Backend API Endpoint

**Endpoint:** `GET /api/product-catalogue/export`  
**Authentication:** Required  
**Response:** Excel file (.xlsx) as binary stream

The endpoint:
1. Queries all active products with related packages from the database
2. Transforms product data into Excel-friendly format
3. Creates Products worksheet with proper column widths
4. Queries all packages with related products from the database
5. Transforms package data into Excel-friendly format (matching product style)
6. Creates Packages worksheet with proper column widths
7. Combines both worksheets into a single workbook
8. Streams the file directly to the browser

### Frontend Components

1. **Service Function** (`productCatalogueService.js`)
   ```javascript
   exportProductCatalogueToExcel()
   ```
   - Makes API call with `responseType: 'blob'`
   - Creates download link dynamically
   - Triggers automatic file download
   - Cleans up temporary resources

2. **UI Component** (`ProductCatalogueTab.jsx`)
   - Export button with loading state
   - Toast notifications for success/error
   - Disabled state when no products available

### Standalone Script

A standalone Node.js script is also available for command-line exports:

```bash
npm run products:export
```

**File:** `export-product-catalogue.js`

This script:
- Exports products directly to a file in the project root
- Does not require authentication
- Useful for automated backups or batch processing

---

## 🎯 Usage

### From the Web Interface

1. Navigate to the Product Catalogue page
2. Browse or search for products (optional - export includes all active products)
3. Click the "Export to Excel" button
4. The file will download automatically with the name: `Product_Catalogue_YYYY-MM-DD.xlsx`

### From Command Line

```bash
npm run products:export
```

The file will be saved in the project root directory.

---

## 📦 File Details

**Filename Format:** `Product_Catalogue_YYYY-MM-DD.xlsx`  
**Sheet Name:** "Product Catalogue"  
**Column Widths:** Optimized for readability  
**Text Wrapping:** Enabled for all cells

---

## 🔐 Security

- Export endpoint requires authentication
- Only active (non-archived) products are included
- No sensitive internal data is exposed
- File is generated on-demand (not cached)

---

## 🎨 User Experience

- **Visual Feedback:** Button shows loading state during export
- **Success Notification:** Toast message confirms successful export
- **Error Handling:** Clear error messages if export fails
- **Disabled State:** Button is disabled when no products are available
- **File Naming:** Automatic timestamp in filename for easy organization

---

## 🧪 Testing

Test the export functionality:

1. **With Products:**
   - Click export button
   - Verify file downloads
   - Open file and check data format
   - Verify all columns are present

2. **Edge Cases:**
   - Empty product list (button should be disabled)
   - Network errors (should show error toast)
   - Large product counts (should handle gracefully)

---

## 📝 Future Enhancements

Potential improvements:
- [ ] Allow exporting filtered results only
- [ ] Add option to include archived products
- [ ] Support for additional export formats (CSV, PDF)
- [ ] Email export option for scheduled reports
- [ ] Export templates with custom column selection

---

## 🐛 Known Issues

None reported as of November 3, 2025.

---

## 📚 Related Documentation

- [Product Bundles Feature](./Product-Bundles-Feature.md)
- [Product Catalogue API](../05-Integrations/Salesforce-Integration.md)
- [Database Schema](../04-Database/Database-Schema.md)

