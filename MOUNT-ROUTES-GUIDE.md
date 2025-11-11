# Mounting Routes in app.js - Implementation Guide

**Purpose:** This guide shows how to mount all the extracted routes in app.js

---

## ✅ Routes Extracted So Far (6 domains)

1. **Bundles** ✅
2. **Customer Products** ✅
3. **Package Mappings** ✅
4. **Validation** ✅
5. **Product Updates** ✅
6. **Auth** (already existed) ✅
7. **User** (already existed) ✅
8. **SML** (already existed) ✅

---

## 📝 How to Mount Routes in app.js

### Step 1: Add Imports (near top of app.js, after other requires)

```javascript
// ===== ROUTE IMPORTS =====
// Authentication routes (existing)
const createAuthRoutes = require('./auth-routes');
const createUserRoutes = require('./user-routes');
const smlRoutes = require('./sml-routes');

// New extracted routes
const bundlesRoutes = require('./routes/bundles.routes');
const customerProductsRoutes = require('./routes/customer-products.routes');
const packageMappingsRoutes = require('./routes/package-mappings.routes');
const validationRoutes = require('./routes/validation.routes');
const productUpdatesRoutes = require('./routes/product-updates.routes');

// TODO: Add remaining routes as they are extracted
// const packagesRoutes = require('./routes/packages.routes');
// const psAuditRoutes = require('./routes/ps-audit.routes');
// const ghostAccountsRoutes = require('./routes/ghost-accounts.routes');
// const expirationRoutes = require('./routes/expiration.routes');
// const productCatalogueRoutes = require('./routes/product-catalogue.routes');
// const packageChangesRoutes = require('./routes/package-changes.routes');
// const salesforceRoutes = require('./routes/salesforce.routes');
```

### Step 2: Mount Routes (after authentication setup, before static files)

```javascript
// ===== AUTHENTICATION ROUTES (PUBLIC) =====
app.use('/api/auth', createAuthRoutes(authService, authenticate));
app.use('/api/users', createUserRoutes(db.pool, authService, authenticate, requireAdmin));
app.use('/api/sml', smlRoutes);

// ===== EXTRACTED ROUTES (AUTHENTICATED) =====
// Bundles
app.use('/api/bundles', authenticate, bundlesRoutes);

// Customer Products
app.use('/api/customer-products', authenticate, customerProductsRoutes);

// Package Mappings
app.use('/api/package-product-mappings', authenticate, packageMappingsRoutes);

// Validation
app.use('/api/validation', authenticate, validationRoutes);

// Product Updates
app.use('/api/product-update', authenticate, productUpdatesRoutes);

// TODO: Mount remaining routes as they are extracted
// app.use('/api/packages', authenticate, packagesRoutes);
// app.use('/api/audit-trail', authenticate, psAuditRoutes);
// app.use('/api/ghost-accounts', authenticate, ghostAccountsRoutes);
// app.use('/api/expiration', authenticate, expirationRoutes);
// app.use('/api/product-catalogue', authenticate, productCatalogueRoutes);
// app.use('/api/package-changes', authenticate, packageChangesRoutes);
// app.use('/api/salesforce', authenticate, salesforceRoutes);
```

### Step 3: Remove Old Route Definitions

After mounting each new route, remove the old endpoint definitions from app.js:

**Example - Remove these lines:**
```javascript
// OLD: Lines 5386-5995 (Bundles) - DELETE THESE
app.get('/api/bundles', authenticate, async (req, res) => {
    // ... old code ...
});
// ... more old bundle routes ...

// OLD: Lines 4193-4236 (Customer Products) - DELETE THESE
app.get('/api/customer-products', async (req, res) => {
    // ... old code ...
});

// Continue removing old code for each extracted domain
```

---

## 🎯 Complete Mounting Script

Here's the complete code to add to app.js (add after line ~93, where other routes are mounted):

```javascript
// ===== EXTRACTED API ROUTES =====
// All routes below require authentication unless specified otherwise

// Import route modules
const bundlesRoutes = require('./routes/bundles.routes');
const customerProductsRoutes = require('./routes/customer-products.routes');
const packageMappingsRoutes = require('./routes/package-mappings.routes');
const validationRoutes = require('./routes/validation.routes');
const productUpdatesRoutes = require('./routes/product-updates.routes');

// Mount routes
app.use('/api/bundles', authenticate, bundlesRoutes);
app.use('/api/customer-products', authenticate, customerProductsRoutes);
app.use('/api/package-product-mappings', authenticate, packageMappingsRoutes);
app.use('/api/validation', authenticate, validationRoutes);
app.use('/api/product-update', authenticate, productUpdatesRoutes);

console.log('✅ Extracted routes mounted');
```

---

## 🔍 Verification Checklist

After mounting routes:

- [ ] All route imports are at the top of the file
- [ ] All routes are mounted in the middleware section
- [ ] Authentication middleware is applied where needed
- [ ] Old route definitions are removed from app.js
- [ ] Server starts without errors
- [ ] Test each endpoint with curl or Postman
- [ ] Verify API responses match original behavior
- [ ] Check logs for any errors
- [ ] Run existing test suite

---

## 🧪 Testing Commands

```bash
# Start server
npm start

# Test bundles endpoint
curl http://localhost:5000/api/bundles \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test customer products
curl "http://localhost:5000/api/customer-products?account=TestAccount" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test validation
curl "http://localhost:5000/api/validation/errors?timeFrame=1w" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test product updates
curl http://localhost:5000/api/product-update/options \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ Important Notes

### Route Order Matters

Mount specific routes BEFORE generic routes:
```javascript
// ✅ CORRECT ORDER:
app.use('/api/bundles/:id/products', specificRoute);
app.use('/api/bundles', generalRoute);

// ❌ WRONG ORDER (generic catches all):
app.use('/api/bundles', generalRoute);
app.use('/api/bundles/:id/products', specificRoute); // Never reached!
```

### Authentication

Most routes need authentication:
```javascript
app.use('/api/bundles', authenticate, bundlesRoutes);
```

Some routes are public (no authenticate middleware):
```javascript
app.use('/api/public-data', publicRoutes); // No authenticate
```

### Error Handling

All routes use centralized error handler:
```javascript
// This should be LAST middleware
app.use(errorHandler);
```

---

## 📋 Mounting Checklist by Domain

- [x] **Bundles** - Mounted at `/api/bundles`
- [x] **Customer Products** - Mounted at `/api/customer-products`
- [x] **Package Mappings** - Mounted at `/api/package-product-mappings`
  - Note: Also handles `/api/packages/:id/products` and `/api/products/:code/packages`
- [x] **Validation** - Mounted at `/api/validation`
- [x] **Product Updates** - Mounted at `/api/product-update`
- [ ] **Packages** - Mount at `/api/packages`
- [ ] **PS Audit** - Mount at `/api/audit-trail`
- [ ] **Ghost Accounts** - Mount at `/api/ghost-accounts`
- [ ] **Expiration Monitor** - Mount at `/api/expiration`
- [ ] **Product Catalogue** - Mount at `/api/product-catalogue`
- [ ] **Package Changes** - Mount at `/api/package-changes`
- [ ] **Salesforce** - Mount at `/api/salesforce`

---

## 🎯 Next Steps

1. **Extract remaining routes** (6 more domains)
2. **Import each new route** in app.js
3. **Mount each route** with proper authentication
4. **Remove old code** from app.js
5. **Test each route** thoroughly
6. **Verify app.js < 250 lines**
7. **Run full test suite**
8. **Phase 1 complete!** 🎉

---

## 📊 Progress Tracking

| Domain | Extracted | Mounted | Old Code Removed | Tested |
|--------|-----------|---------|------------------|--------|
| Bundles | ✅ | ⏳ | ⏳ | ⏳ |
| Customer Products | ✅ | ⏳ | ⏳ | ⏳ |
| Package Mappings | ✅ | ⏳ | ⏳ | ⏳ |
| Validation | ✅ | ⏳ | ⏳ | ⏳ |
| Product Updates | ✅ | ⏳ | ⏳ | ⏳ |
| Packages | ⏳ | ⏳ | ⏳ | ⏳ |
| PS Audit | ⏳ | ⏳ | ⏳ | ⏳ |
| Ghost Accounts | ⏳ | ⏳ | ⏳ | ⏳ |
| Expiration | ⏳ | ⏳ | ⏳ | ⏳ |
| Product Catalogue | ⏳ | ⏳ | ⏳ | ⏳ |
| Package Changes | ⏳ | ⏳ | ⏳ | ⏳ |
| Salesforce | ⏳ | ⏳ | ⏳ | ⏳ |

---

**Ready to mount?** Add the imports and mount code to app.js, then test each endpoint!

