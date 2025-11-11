# App.js Route Mounting Guide

## Overview
This guide provides the code needed to mount all extracted routes in `app.js`.

## 🔧 Step-by-Step Instructions

### Step 1: Add Route Imports (after existing requires)

Add these imports after the existing middleware imports in `app.js`:

```javascript
// ===== EXTRACTED ROUTE MODULES =====
const bundlesRoutes = require('./routes/bundles.routes');
const customerProductsRoutes = require('./routes/customer-products.routes');
const packageMappingsRoutes = require('./routes/package-mappings.routes');
const validationRoutes = require('./routes/validation.routes');
const productUpdatesRoutes = require('./routes/product-updates.routes');
const packagesRoutes = require('./routes/packages.routes');
const psAuditRoutes = require('./routes/ps-audit.routes');
const ghostAccountsRoutes = require('./routes/ghost-accounts.routes');
const expirationRoutes = require('./routes/expiration.routes');
const productCatalogueRoutes = require('./routes/product-catalogue.routes');
const packageChangesRoutes = require('./routes/package-changes.routes');
const salesforceApiRoutes = require('./routes/salesforce-api.routes');
```

### Step 2: Mount Routes (after middleware setup, before error handlers)

Add these route mountings in the appropriate location in `app.js`:

```javascript
// ===== MOUNT EXTRACTED ROUTES =====

// Salesforce OAuth, Analytics, Provisioning
// Mounts: /auth/salesforce, /auth/salesforce/callback, /api/analytics/*, /api/provisioning/*
app.use('/', salesforceApiRoutes);

// Validation endpoints
app.use('/api/validation', validationRoutes);

// Expiration Monitor endpoints
app.use('/api/expiration', expirationRoutes);

// Package Change Analytics endpoints
app.use('/api/analytics/package-changes', packageChangesRoutes);

// Ghost Accounts endpoints
app.use('/api/ghost-accounts', ghostAccountsRoutes);

// Customer Products endpoints
app.use('/api/customer-products', customerProductsRoutes);

// Product Update Workflow endpoints
app.use('/api/product-updates', productUpdatesRoutes);

// Package Management endpoints
app.use('/api/packages', packagesRoutes);

// Package-Product Mapping endpoints
app.use('/api/package-mappings', packageMappingsRoutes);

// Product Catalogue endpoints (requires authentication)
app.use('/api/product-catalogue', authenticate, productCatalogueRoutes);

// Product Bundles endpoints
app.use('/api/bundles', bundlesRoutes);

// PS Audit Trail endpoints
app.use('/api/ps-audit', psAuditRoutes);
```

### Step 3: Remove Extracted Code Sections

After mounting the routes, remove the following sections from `app.js`. These line numbers are approximate and based on the original file:

#### Sections to Remove:

1. **Salesforce/Analytics/Provisioning** (lines 843-1854) - 1,012 lines
   - Comment: `// ===== SALESFORCE API ENDPOINTS =====`
   - Remove through line 1854 (before `// ===== VALIDATION ERRORS API =====`)

2. **Validation** (lines 1856-2024) - 169 lines
   - Comment: `// ===== VALIDATION ERRORS API =====`
   - Also: `// ===== ASYNC VALIDATION RESULTS API =====`
   - Remove through line 2196 (before `// ===== EXPIRATION MONITOR API ENDPOINTS =====`)

3. **Expiration Monitor** (lines 2197-2609) - 413 lines
   - Comment: `// ===== EXPIRATION MONITOR API ENDPOINTS =====`
   - Remove through line 2609 (before `// ===== PACKAGE CHANGE ANALYSIS API ENDPOINTS =====`)

4. **Package Changes** (lines 2611-3319) - 709 lines
   - Comment: `// ===== PACKAGE CHANGE ANALYSIS API ENDPOINTS =====`
   - Remove through line 3319 (before `// ===== GHOST ACCOUNTS API ENDPOINTS =====`)

5. **Ghost Accounts** (lines 3321-3643) - 323 lines
   - Comment: `// ===== GHOST ACCOUNTS API ENDPOINTS =====`
   - Remove through line 3643 (before `// ===== SML GHOST ACCOUNTS API ENDPOINTS =====` or next section)

6. **Customer Products** (lines 4193-4236) - 44 lines
   - Comment: `// ===== CUSTOMER PRODUCTS API ENDPOINTS =====`
   - Remove through line 4236 (before `// ===== PRODUCT UPDATE WORKFLOW ENDPOINTS =====`)

7. **Product Updates** (lines 4238-4441) - 204 lines
   - Comment: `// ===== PRODUCT UPDATE WORKFLOW ENDPOINTS =====`
   - Remove through line 4441 (before `// ===== PACKAGE ENDPOINTS =====`)

8. **Packages** (lines 4443-4724) - 282 lines
   - Comment: `// ===== PACKAGE ENDPOINTS =====`
   - Remove through line 4724 (before `// ===== PACKAGE-PRODUCT MAPPING API ENDPOINTS =====`)

9. **Package Mappings** (lines 4726-4839) - 114 lines
   - Comment: `// ===== PACKAGE-PRODUCT MAPPING API ENDPOINTS =====`
   - Remove through line 4839 (before `// ===== PRODUCT CATALOGUE API ENDPOINTS =====`)

10. **Product Catalogue** (lines 4841-5384) - 544 lines
    - Comment: `// ===== PRODUCT CATALOGUE API ENDPOINTS =====`
    - Remove through line 5384 (before `// ===== PRODUCT BUNDLES API ENDPOINTS =====`)

11. **Product Bundles** (lines 5386-5995) - 610 lines
    - Comment: `// ===== PRODUCT BUNDLES API ENDPOINTS =====`
    - Remove through line 5995 (before `// ===== PS AUDIT TRAIL API ENDPOINTS =====`)

12. **PS Audit Trail** (lines 5996-6303) - 308 lines
    - Comment: `// ===== PS AUDIT TRAIL API ENDPOINTS =====`
    - Remove through end of section

### Step 4: Add Error Handler Middleware (if not already present)

Add at the end of route mountings, before `app.listen()`:

```javascript
// ===== ERROR HANDLING MIDDLEWARE =====
const { errorHandler } = require('./middleware/error-handler');

// Global error handler (must be last)
app.use(errorHandler);
```

### Step 5: Verify Server Startup

After making changes, test that the server starts without errors:

```bash
node app.js
```

Check that all endpoints are accessible:
- `/api/bundles`
- `/api/customer-products`
- `/api/package-mappings`
- `/api/validation`
- `/api/product-updates`
- `/api/packages`
- `/api/ps-audit`
- `/api/ghost-accounts`
- `/api/expiration`
- `/api/product-catalogue`
- `/api/analytics/package-changes`
- `/api/analytics/validation-trend`
- `/api/analytics/request-types-week`
- `/api/analytics/completion-times`
- `/api/provisioning/*`
- `/auth/salesforce`

## 📊 Expected Results

### Before:
- **app.js:** 6,323 lines
- **Structure:** Monolithic, all routes inline

### After:
- **app.js:** ~1,600 lines (74% reduction)
- **Structure:** Modular, routes properly organized
- **New Files:** 12 route modules, 10 service modules

## ⚠️ Important Notes

1. **Authentication Middleware:** The `authenticate` middleware is applied to the Product Catalogue routes. Ensure this middleware is defined before route mounting.

2. **Route Order:** The Salesforce API routes are mounted at root (`/`) because they handle multiple path prefixes (`/auth/*`, `/api/analytics/*`, `/api/provisioning/*`). Mount them first to avoid conflicts.

3. **Error Handling:** The global error handler must be mounted LAST, after all routes.

4. **Testing:** Test all endpoints after mounting to ensure no breaking changes.

5. **Logging:** Monitor console output on first startup to catch any missing dependencies or errors.

## 🔍 Verification Checklist

- [ ] All route imports added
- [ ] All routes mounted in correct order
- [ ] Extracted code sections removed from app.js
- [ ] Error handler middleware added at the end
- [ ] Server starts without errors
- [ ] Sample endpoints tested and working
- [ ] No console errors during startup
- [ ] Authentication still works for protected routes

## 📝 Final app.js Structure

After refactoring, your `app.js` should have this structure:

```javascript
// 1. Core requires and setup
// 2. Database and external service connections
// 3. Middleware configuration (body-parser, cors, auth, etc.)
// 4. Import extracted route modules
// 5. Mount routes
// 6. Error handling middleware
// 7. Server listen
```

Estimated final size: **~1,600 lines** (from 6,323)

---

**Generated:** November 11, 2025  
**Status:** Ready for Implementation  
**Phase:** 1 - Route Extraction Complete

