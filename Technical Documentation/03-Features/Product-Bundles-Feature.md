# Product Bundles Feature

**Status:** ✅ Complete  
**Date:** October 31, 2025  
**Location:** Catalogue Page (Experimental)  
**Route:** `/experimental/product-catalogue`

---

## 📋 Overview

Enhanced the Product Catalogue page into a comprehensive **Catalogue** page with two tabs:
1. **Products Tab** - Browse and search products from Salesforce
2. **Bundles Tab** - Create and manage deployment bundles of products

Users can now create reusable bundles of products that they might want to deploy together, with full CRUD operations and an intuitive side-by-side builder interface.

---

## ✨ Features

### 1. **Bundle Management**
- **Create** new bundles with name and description
- **Edit** existing bundles (add/remove products, update quantities)
- **Delete** bundles
- **Duplicate** bundles with a new name
- **Search** bundles by name or description
- **Sort** bundles by name or creation date

### 2. **Bundle Builder (Side-by-Side View)**
- **Left Panel**: Product catalogue with multi-select
  - Search/filter products
  - Select multiple products with checkboxes
  - Shows only products not yet in the bundle
  - "Add to Bundle" button for selected products
  
- **Right Panel**: Bundle contents
  - List of products in the bundle
  - Editable quantity for each product
  - Remove individual products
  - Real-time updates

### 3. **Product Quantities**
- Each product in a bundle has a quantity field
- Default quantity: 1
- Users can update quantities inline in the builder
- Quantities preserved when duplicating bundles

### 4. **Bundle Metadata**
- **Bundle ID**: Sequential format (BUNDLE-001, BUNDLE-002, etc.)
- **Name**: User-defined, unique
- **Description**: Optional text field
- **Created By**: Tracks user who created the bundle
- **Created At**: Timestamp
- **Updated At**: Timestamp (auto-updated)
- **Product Count**: Displayed on bundle cards

### 5. **User Interface**
- **List View**: Grid of bundle cards
  - Shows bundle name, ID, description, product count, creation date
  - Edit, Duplicate, and Delete actions on each card
  - Create Bundle button
  - Search and sort controls
  
- **Builder View**: Side-by-side layout
  - Back to list navigation
  - Bundle header with name and ID
  - Two-column layout for easy product selection
  - Multi-select capability with visual feedback

---

## 🏗️ Architecture

### Database Schema

#### `product_bundles` Table
```sql
- id (SERIAL PRIMARY KEY)
- bundle_id (VARCHAR(50) UNIQUE) - Sequential: BUNDLE-001, BUNDLE-002
- name (VARCHAR(255) NOT NULL, UNIQUE)
- description (TEXT)
- created_by (INTEGER) - References users table
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `bundle_products` Table (Junction)
```sql
- id (SERIAL PRIMARY KEY)
- bundle_id (INTEGER) - References product_bundles(id)
- product_salesforce_id (VARCHAR(255)) - References products.salesforce_id
- quantity (INTEGER DEFAULT 1, CHECK > 0)
- sort_order (INTEGER DEFAULT 0)
- added_at (TIMESTAMP)
- UNIQUE(bundle_id, product_salesforce_id)
```

#### `bundle_id_seq` Sequence
- Generates sequential numbers for bundle IDs
- Format: BUNDLE-{padded 3-digit number}

### Backend API Endpoints

All endpoints require authentication.

#### **GET /api/bundles**
List all bundles
- Query params: `search`, `sortBy` (name|created_at), `sortOrder` (asc|desc)
- Returns: Array of bundles with product counts

#### **GET /api/bundles/:bundleId**
Get specific bundle with products
- Returns: Bundle details + array of products with quantities

#### **POST /api/bundles**
Create new bundle
- Body: `{ name, description }`
- Returns: Created bundle with generated bundle_id

#### **PUT /api/bundles/:bundleId**
Update bundle metadata
- Body: `{ name, description }`
- Returns: Updated bundle

#### **DELETE /api/bundles/:bundleId**
Delete bundle (cascade deletes products)
- Returns: Success message

#### **POST /api/bundles/:bundleId/duplicate**
Duplicate bundle
- Body: `{ name }` - New bundle name
- Returns: New bundle with copied products

#### **POST /api/bundles/:bundleId/products**
Add products to bundle
- Body: `{ products: [{ productId, quantity }] }`
- Returns: Added products count

#### **PUT /api/bundles/:bundleId/products/:productId**
Update product quantity
- Body: `{ quantity }`
- Returns: Updated product

#### **DELETE /api/bundles/:bundleId/products/:productId**
Remove product from bundle
- Returns: Success message

### Frontend Structure

#### **Pages**
- `Catalogue.jsx` - Main container with tabs
- `ProductCatalogueTab.jsx` - Products view (refactored from original)
- `BundlesTab.jsx` - Bundles list and builder views

#### **Components**
- `BundleCard.jsx` - Bundle card display
- `CreateBundleModal.jsx` - Modal for creating/duplicating bundles

#### **Services**
- `bundleService.js` - API client for all bundle operations

#### **Routing**
- Route: `/experimental/product-catalogue`
- Component: `Catalogue` (tabbed interface)
- Page permissions: Unchanged (experimental.product-catalogue)

---

## 🎨 UI/UX Design

### Tab Navigation
- Clean tab interface at the top of the page
- Icons for visual identification (Cube for Products, Stack for Bundles)
- Active tab highlighted with blue accent

### Bundle List View
- Responsive grid layout (1/2/3 columns)
- Cards show key information at a glance
- Search bar and sort dropdown
- Prominent "Create Bundle" button
- Empty state with helpful guidance

### Bundle Builder View
- Back button to return to list
- Bundle name and ID in header
- Two equal-width columns on desktop (stacks on mobile)
- Checkbox selection with visual feedback
- Inline quantity inputs
- Remove buttons for each product
- Real-time updates without page refresh

### Color Coding
- Blue accents for primary actions
- Green for success states
- Red for delete actions
- Gray for neutral elements

---

## 🔒 Permissions

- All users with access to the Catalogue page can:
  - Create bundles
  - Edit their own and others' bundles
  - Delete bundles
  - Duplicate bundles
  
- No special admin-only restrictions
- Bundle creator is tracked for audit purposes

---

## 📊 Data Flow

### Creating a Bundle
1. User clicks "Create Bundle"
2. Modal prompts for name and description
3. Backend generates sequential bundle_id
4. Bundle created in database
5. User redirected to builder view
6. User adds products from left panel
7. Products saved to bundle_products table

### Editing a Bundle
1. User clicks "Edit" on bundle card
2. System loads bundle with products
3. Builder view opens with current state
4. User modifies products/quantities
5. Changes saved via API calls
6. UI updates in real-time

### Duplicating a Bundle
1. User clicks duplicate icon
2. Modal prompts for new name
3. Backend creates new bundle
4. Products copied from original
5. User returned to list view

---

## 🧪 Testing Checklist

- [ ] Create new bundle
- [ ] Add products to bundle
- [ ] Update product quantities
- [ ] Remove products from bundle
- [ ] Edit bundle name/description
- [ ] Delete bundle
- [ ] Duplicate bundle
- [ ] Search bundles
- [ ] Sort bundles (name, date)
- [ ] Multi-select products
- [ ] View bundle with many products (50+)
- [ ] Test with duplicate product names
- [ ] Test error handling (network errors, validation)

---

## 📝 Migration

**File:** `database/add-bundles-feature.sql`

**Run Command:**
```bash
node database/run-bundle-migration.js
```

**What It Does:**
- Creates `product_bundles` table
- Creates `bundle_products` table
- Creates `bundle_id_seq` sequence
- Updates page display name to "Catalogue"
- Adds indexes for performance

---

## 🚀 Future Enhancements

Potential future improvements:
- Bundle templates (system-defined bundles)
- Bundle categories/tags
- Bundle sharing between users
- Export bundle as deployment manifest
- Bundle usage tracking
- Bundle versioning
- Bulk operations on bundles
- Product recommendations based on bundle patterns

---

## 🐛 Known Limitations

None identified at this time.

---

## 📚 Related Documentation

- [Product Catalogue Feature](./Product-Catalogue-Feature.md)
- [Product Catalogue Implementation Summary](./Product-Catalogue-Implementation-Summary.md)
- [Database Schema](../../04-Database/Database-Schema.md)

---

**Implementation Date:** October 31, 2025  
**Developer:** AI Assistant  
**Status:** Production Ready ✅

