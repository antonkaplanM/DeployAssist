# Product Catalogue Feature

**Status:** ✅ Complete  
**Date:** October 30, 2025  
**Location:** Experimental Pages  
**Route:** `/experimental/product-catalogue`

---

## 📋 Overview

The Product Catalogue is a new experimental page that provides a searchable, browsable catalogue of all available products from Salesforce Product2 objects. Users can search by product name or code, filter by product family, and view detailed information about each product.

---

## ✨ Features

### 1. **Product Browsing**
- Grid layout displaying all active products
- Product cards show:
  - Product Name
  - Product Code
  - Product Family badge
  - Description (truncated)
  - Active/Inactive status
  - "View Details" link

### 2. **Search Functionality**
- Real-time search across:
  - Product Name
  - Product Code
  - Description
  - Product Family
- Case-insensitive search

### 3. **Filtering**
- Filter by Product Family (dropdown)
- Dynamically populated families from Salesforce
- "Clear filters" button

### 4. **Product Details Modal**
- Click any product card to view full details
- Displays all available product fields:
  - Salesforce ID
  - Product Name
  - Product Code
  - Description
  - Product Family
  - Product Service Name (L3)
  - Product Family (L2)
  - Product Group
  - Product Variant
  - Product Versions
  - Type of Configuration
  - Is Expansion Pack
  - Product Selection Grouping
  - Active/Archived status
  - Display URL
  - Created/Modified dates
- "View in Salesforce" button (opens product in Salesforce Lightning)

### 5. **Auto-Refresh**
- Last refresh timestamp displayed
- Manual refresh button

---

## 🏗️ Architecture

### Backend API Endpoints

#### **GET /api/product-catalogue**
Fetches products from Salesforce Product2 object.

**Query Parameters:**
- `search` (string): Search term for product name/code
- `family` (string): Filter by product family
- `isActive` (boolean): Filter by active status (default: true)
- `limit` (number): Max results (default: 100, max: 500)
- `offset` (number): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "products": [...],
  "count": 150,
  "totalSize": 150,
  "done": true,
  "filterOptions": {
    "families": ["APAC Inland Flood", "NAM Hurricane", ...]
  },
  "timestamp": "2025-10-30T23:00:00.000Z"
}
```

#### **GET /api/product-catalogue/:productId**
Fetches a specific product by Salesforce ID.

**Response:**
```json
{
  "success": true,
  "product": {
    "Id": "01t6Q000006kFJoQAM",
    "Name": "Climate on Demand - Standard",
    "ProductCode": "RI-COD-STN",
    "Description": "...",
    ...
  },
  "timestamp": "2025-10-30T23:00:00.000Z"
}
```

### Frontend Components

**Location:** `frontend/src/pages/ProductCatalogue.jsx`

**Service:** `frontend/src/services/productCatalogueService.js`

**Key Features:**
- Responsive grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)
- Product cards with hover effects
- Modal for detailed product view
- Search and filter state management
- Loading and error states

### Database Setup

**Migration:** `database/add-product-catalogue-page.sql`

Adds the page to the `pages` table:
- **Name:** `experimental.product-catalogue`
- **Display Name:** Product Catalogue
- **Parent:** `experimental`
- **Route:** `/experimental/product-catalogue`
- **Icon:** `box`
- **Sort Order:** 2

**Permissions:** Granted to both `admin` and `user` roles

---

## 🔌 Salesforce Integration

### Product2 Object Fields

The feature queries the following fields from Salesforce Product2:

**Core Fields:**
- `Id` - Salesforce unique identifier
- `Name` - Product name
- `ProductCode` - Product code
- `Description` - Product description
- `Family` - Product family
- `IsActive` - Active status
- `IsArchived` - Archived status
- `DisplayUrl` - Display URL

**Extended Fields:**
- `Product_Group__c` - Product Service Name (L3)
- `Product_Family_L2__c` - Product Family (L2)
- `ProductReportingGroup__c` - Product Group
- `Product_Variant__c` - Product Variant
- `ProductVersions__c` - Product Versions
- `TypeOfConfiguration__c` - Type of Configuration
- `IsExpansionPack__c` - Is Expansion Pack flag
- `Product_Selection_Grouping__c` - Product Selection Grouping

**Metadata Fields:**
- `CreatedDate` - Creation timestamp
- `LastModifiedDate` - Last modification timestamp
- `CreatedById` - Creator user ID
- `LastModifiedById` - Last modifier user ID

### SOQL Queries

**List Products:**
```sql
SELECT Id, Name, ProductCode, Description, Family, IsActive, DisplayUrl,
       Product_Group__c, Product_Family_L2__c, ProductReportingGroup__c,
       Product_Variant__c, ProductVersions__c, TypeOfConfiguration__c,
       IsExpansionPack__c, Product_Selection_Grouping__c, IsArchived
FROM Product2
WHERE IsDeleted = false AND IsActive = true
ORDER BY Name ASC
LIMIT 100 OFFSET 0
```

**Get Product Families (for filter):**
```sql
SELECT Family 
FROM Product2 
WHERE IsDeleted = false AND IsActive = true AND Family != null 
GROUP BY Family 
ORDER BY Family
```

**Get Single Product:**
```sql
SELECT Id, Name, ProductCode, Description, Family, IsActive, DisplayUrl,
       Product_Group__c, Product_Family_L2__c, ProductReportingGroup__c,
       Product_Variant__c, ProductVersions__c, TypeOfConfiguration__c,
       IsExpansionPack__c, Product_Selection_Grouping__c, IsArchived,
       CreatedDate, LastModifiedDate, CreatedById, LastModifiedById
FROM Product2
WHERE Id = '01t6Q000006kFJoQAM'
LIMIT 1
```

---

## 🔒 Security & Authentication

- **Route Protection:** All API endpoints require authentication (`authenticate` middleware)
- **Page Access Control:** Page visibility controlled by role-based permissions in database
- **SOQL Injection Prevention:** All user inputs are sanitized using `.replace(/'/g, "\\'")` 

---

## 🎨 User Interface

### Product Card Design
- White background with subtle shadow
- Hover effect (increased shadow)
- Product name as heading
- Product code in blue badge
- Family as gray badge
- Description (3 lines max, truncated)
- Active/Inactive status indicator
- "View Details →" link

### Details Modal
- Full-screen overlay with backdrop
- Large modal with header, body, footer
- Header shows product name, code, and family
- Body displays all fields in a definition list format
- Footer has "View in Salesforce" and "Close" buttons
- Click outside modal or X button to close

### Responsive Design
- Mobile: 1 column grid
- Tablet: 2 column grid
- Desktop: 3 column grid
- Modal: Responsive with max-width and scrollable content

---

## 📊 Data Flow

```
User Action
    ↓
ProductCatalogue.jsx (React Component)
    ↓
productCatalogueService.js (API Client)
    ↓
api.js (Axios instance with auth)
    ↓
app.js Backend (Express Routes)
    ↓
salesforce.js (Salesforce Connection)
    ↓
Salesforce Product2 Object
    ↓
Response flows back up the chain
    ↓
UI Updates with Product Data
```

---

## 🧪 Testing

### Manual Testing Checklist

- [x] ✅ Verify Salesforce connection and Product2 access
- [ ] Navigate to `/experimental/product-catalogue`
- [ ] Verify products load successfully
- [ ] Test search functionality (by name, code, description)
- [ ] Test family filter dropdown
- [ ] Click on a product card
- [ ] Verify modal opens with full details
- [ ] Click "View in Salesforce" button (opens in new tab)
- [ ] Close modal using X button
- [ ] Close modal by clicking backdrop
- [ ] Test refresh button
- [ ] Test clear filters button
- [ ] Verify responsive design (mobile, tablet, desktop)
- [ ] Check error handling (disconnect network, test error states)
- [ ] Verify loading states display correctly

### API Testing

**Test Product Catalogue Endpoint:**
```bash
curl -X GET "http://localhost:5000/api/product-catalogue?search=flood&family=APAC%20Inland%20Flood&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Test Single Product Endpoint:**
```bash
curl -X GET "http://localhost:5000/api/product-catalogue/01t6Q000006kFJoQAM" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 Usage Guide

### For End Users

1. **Access the Page:**
   - Navigate to "Experimental Pages" in the sidebar
   - Click "Product Catalogue"

2. **Browse Products:**
   - Scroll through the product grid
   - View product names, codes, and descriptions at a glance

3. **Search for Products:**
   - Use the search box to find products by name, code, or description
   - Search is real-time and case-insensitive

4. **Filter by Family:**
   - Use the dropdown to filter products by family
   - Clear filters using "Clear filters" button

5. **View Product Details:**
   - Click any product card
   - Modal opens with complete product information
   - Click "View in Salesforce" to see the product in Salesforce

6. **Refresh Data:**
   - Click "Refresh" button to reload latest products from Salesforce

---

## 🔧 Configuration

### Environment Variables
No additional environment variables required. Uses existing Salesforce configuration:
- `SF_LOGIN_URL`
- `SF_CLIENT_ID`
- `SF_CLIENT_SECRET`
- `SF_REDIRECT_URI`

### Database Configuration
Page automatically added via migration script. No manual configuration needed.

---

## 🚀 Deployment

### Files Added/Modified

**Backend:**
- `app.js` - Added product catalogue API endpoints

**Frontend:**
- `frontend/src/pages/ProductCatalogue.jsx` - New product catalogue page
- `frontend/src/services/productCatalogueService.js` - New API service
- `frontend/src/App.jsx` - Added route configuration

**Database:**
- `database/add-product-catalogue-page.sql` - Page migration script

**Documentation:**
- `Technical Documentation/03-Features/Product-Catalogue-Feature.md` - This file

### Deployment Steps

1. **Run Database Migration:**
   ```bash
   node -e "const db = require('./database'); db.pool.query(require('fs').readFileSync('database/add-product-catalogue-page.sql', 'utf8')).then(() => { console.log('✅ Migration successful'); process.exit(0); }).catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });"
   ```

2. **Restart Backend Server:**
   ```bash
   npm start
   ```

3. **Rebuild Frontend (if needed):**
   ```bash
   cd frontend
   npm run build
   ```

4. **Verify Access:**
   - Login to the application
   - Navigate to Experimental Pages → Product Catalogue
   - Verify products load successfully

---

## 📈 Future Enhancements

### Potential Features
1. **Pagination:** Support for large product catalogues (500+ products)
2. **Sorting:** Sort by name, code, family, created date, etc.
3. **Export:** Export product list to CSV/Excel
4. **Product Comparison:** Compare multiple products side-by-side
5. **Favorites:** Save favorite products for quick access
6. **Advanced Filters:** Multi-select filters, date range filters
7. **Product Images:** Display product images if available
8. **Related Products:** Show related or recommended products
9. **Audit Trail:** Track who viewed which products and when
10. **Bulk Operations:** Bulk export, bulk update (admin only)

---

## 🐛 Known Issues

None currently identified.

---

## 💡 Tips & Best Practices

1. **Search Performance:** For large catalogues (1000+ products), consider implementing server-side search instead of client-side filtering
2. **Caching:** Consider implementing cache for product families to reduce Salesforce API calls
3. **Error Handling:** Always check Salesforce connection status before querying
4. **Rate Limiting:** Be mindful of Salesforce API rate limits when implementing auto-refresh

---

## 📚 Related Documentation

- [Experimental Pages Roadmap](./Experimental-Pages-Roadmap.md)
- [Salesforce Integration Guide](../../05-Integrations/Salesforce-Integration-Guide.md)
- [Authentication Setup Guide](../../09-Authentication/Authentication-Setup-Guide.md)

---

## 👥 Contacts

**Feature Owner:** Development Team  
**Salesforce Admin:** Contact for Product2 object schema changes  
**Support:** For issues or feature requests, contact the development team

---

**Last Updated:** October 30, 2025

