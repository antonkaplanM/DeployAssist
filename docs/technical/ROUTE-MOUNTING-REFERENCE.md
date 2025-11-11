# Route Mounting Reference

## Current Route Mappings in app.js

This document shows how all extracted routes are mounted in the application.

### ✅ Working Routes

| Frontend Path | Mount Point | Route Module |
|--------------|-------------|--------------|
| `/api/analytics/*` | `/` | salesforceApiRoutes |
| `/api/provisioning/*` | `/` | salesforceApiRoutes |
| `/api/validation/*` | `/api/validation` | validationRoutes |
| `/api/expiration/*` | `/api/expiration` | expirationRoutes |
| `/api/analytics/package-changes/*` | `/api/analytics/package-changes` | packageChangesRoutes |
| `/api/ghost-accounts/*` | `/api/ghost-accounts` | ghostAccountsRoutes |
| `/api/customer-products/*` | `/api/customer-products` | customerProductsRoutes |
| `/api/product-update/*` | `/api/product-update` | productUpdatesRoutes ✅ Fixed |
| `/api/packages/*` | `/api/packages` | packagesRoutes |
| `/api/package-mappings/*` | `/api/package-mappings` | packageMappingsRoutes |
| `/api/product-catalogue/*` | `/api/product-catalogue` | productCatalogueRoutes |
| `/api/bundles/*` | `/api/bundles` | bundlesRoutes |
| `/api/audit-trail/*` | `/api/audit-trail` | psAuditRoutes ✅ Fixed |

## Recent Fixes

### Issue #6: Product Update Routes (2025-11-11)
- **Problem**: Frontend calling `/api/product-update/*` but mounted at `/api/product-updates/*`
- **Fix**: Changed mount from `/api/product-updates` → `/api/product-update`
- **Impact**: Pending Requests page now loads

### Issue #7: PS Audit Trail Routes (2025-11-11)
- **Problem**: Frontend calling `/api/audit-trail/*` but mounted at `/api/ps-audit/*`
- **Fix**: Changed mount from `/api/ps-audit` → `/api/audit-trail`
- **Impact**: PS Audit Trail page statistics now load

## Pattern for Route Mounting

### Standard API Routes
Most API routes follow this pattern:
```javascript
app.use('/api/{resource-name}', {resourceName}Routes);
```

Example:
```javascript
app.use('/api/packages', packagesRoutes);
```

This means:
- Route file defines: `router.get('/stats', ...)`
- Actual URL becomes: `GET /api/packages/stats`

### Special Cases

#### Salesforce API Routes
Mounted at root to handle multiple prefixes:
```javascript
app.use('/', salesforceApiRoutes);
```
Routes define full paths: `router.get('/api/analytics/validation-trend', ...)`

#### Audit Trail Routes
Standard API path:
```javascript
app.use('/api/audit-trail', psAuditRoutes);
```
Routes: `GET /api/audit-trail/stats`, `GET /api/audit-trail/records`, etc.

## Troubleshooting 404 Errors

If you see a 404 error:

1. **Check the frontend request URL** - look in browser console/Network tab
2. **Check the route mounting** - look in `app.js` for `app.use(...)`
3. **Check the route definition** - look in the route file for `router.get/post/put/delete(...)`

The actual URL is: `{mount point} + {route path}`

Example:
- Mount: `/api/products`
- Route: `/list`
- Actual URL: `/api/products/list`

## Quick Reference: App.js Route Section

```javascript
// Line ~860-893 in app.js

// Salesforce routes (handles /api/analytics/* and /api/provisioning/*)
app.use('/', salesforceApiRoutes);

// Standard API routes
app.use('/api/validation', validationRoutes);
app.use('/api/expiration', expirationRoutes);
app.use('/api/analytics/package-changes', packageChangesRoutes);
app.use('/api/ghost-accounts', ghostAccountsRoutes);
app.use('/api/customer-products', customerProductsRoutes);
app.use('/api/product-update', productUpdatesRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/package-mappings', packageMappingsRoutes);
app.use('/api/product-catalogue', authenticate, productCatalogueRoutes);
app.use('/api/bundles', bundlesRoutes);

// PS Audit Trail routes
app.use('/api/audit-trail', psAuditRoutes);
```

## Notes

- Authentication middleware (`authenticate`) is applied to Product Catalogue routes only
- All routes use the global error handler middleware
- Response format is standardized across all routes (flat JSON structure)
- All routes return timestamps in ISO 8601 format

