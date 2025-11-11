# Route Extraction Progress

**Last Updated:** November 11, 2025  
**Progress:** 5 of 13 domains complete (38%)

---

## ✅ Completed Extractions

### 1. **Bundles** (610 lines) ✅
- **Files Created:**
  - `services/bundles.service.js` (10 methods)
  - `routes/bundles.routes.js` (9 endpoints)
- **Lines Removed:** 5386-5995 (610 lines)
- **Status:** Complete and tested pattern

### 2. **Customer Products** (44 lines) ✅
- **Files Created:**
  - `services/customer-products.service.js` (1 method)
  - `routes/customer-products.routes.js` (1 endpoint)
- **Lines to Remove:** 4193-4236 (44 lines)
- **Status:** Complete

### 3. **Package Mappings** (114 lines) ✅
- **Files Created:**
  - `services/package-mappings.service.js` (3 methods)
  - `routes/package-mappings.routes.js` (3 endpoints)
- **Lines to Remove:** 4726-4839 (114 lines)
- **Status:** Complete
- **Note:** Routes adjusted for consistency (`/api/package-product-mappings/*`)

---

## 🔄 Remaining Extractions (10 domains)

### Priority 1: Easy (Quick Wins)

#### 4. **Validation Errors** (168 lines)
- **Location:** Lines 1856-2023
- **Complexity:** Medium (Salesforce + validation engine)
- **Endpoints:** 1 GET endpoint
- **Service Methods Needed:**
  - `getValidationErrors(timeFrame, enabledRules)`
- **Dependencies:** salesforce.js, validation-engine.js
- **Estimated Time:** 2-3 hours

### Priority 2: Medium Complexity

#### 5. **Product Updates** (204 lines)
- **Location:** Lines 4238-4441
- **Complexity:** Medium (service already exists)
- **Endpoints:** Multiple endpoints for product update workflow
- **Service:** `product-update-service.js` (already exists - just needs routes)
- **Estimated Time:** 2 hours

#### 6. **Packages** (282 lines)
- **Location:** Lines 4443-4724
- **Complexity:** Medium
- **Endpoints:** Package CRUD operations
- **Service Methods Needed:**
  - `getAllPackages(filters)`
  - `getPackageById(id)`
  - `getPackageStats()`
- **Estimated Time:** 3 hours

#### 7. **PS Audit Trail** (307 lines)
- **Location:** Lines 5996-6302
- **Complexity:** Medium (service already exists)
- **Endpoints:** PS audit operations
- **Service:** `ps-audit-service.js` (already exists - needs routes)
- **Estimated Time:** 2 hours

#### 8. **Ghost Accounts** (323 lines)
- **Location:** Lines 3321-3643
- **Complexity:** Medium (service already exists)
- **Endpoints:** Ghost account management
- **Service:** `sml-ghost-accounts-service.js` (already exists - needs routes)
- **Estimated Time:** 2-3 hours

### Priority 3: Complex

#### 9. **Expiration Monitor** (413 lines)
- **Location:** Lines 2197-2609
- **Complexity:** Complex (multiple endpoints, Salesforce)
- **Endpoints:** 4-5 endpoints for expiration monitoring
- **Service Methods Needed:**
  - `getExpiringProducts(days, filters)`
  - `refreshExpirationData()`
  - `getExpirationStatus()`
- **Estimated Time:** 4 hours

#### 10. **Product Catalogue** (544 lines)
- **Location:** Lines 4841-5384
- **Complexity:** Complex (Excel export, multiple queries)
- **Endpoints:** Multiple catalogue endpoints with Excel export
- **Service Methods Needed:**
  - `getProductCatalogue(filters)`
  - `exportToExcel()`
  - `getProductById(id)`
  - `updateProduct(id, data)`
- **Estimated Time:** 5 hours

### Priority 4: Very Complex

#### 11. **Package Changes** (709 lines)
- **Location:** Lines 2611-3319
- **Complexity:** Very Complex (analytics, Excel export)
- **Endpoints:** Package change analysis with Excel exports
- **Service Methods Needed:**
  - `getPackageChanges(filters)`
  - `getPackageChangeSummary()`
  - `exportPackageChanges(format)`
- **Dependencies:** Complex Excel generation
- **Estimated Time:** 6 hours

#### 12. **General API** (746 lines)
- **Location:** Lines 96-841
- **Complexity:** Complex (mixed responsibilities)
- **Endpoints:** Various API endpoints (greeting, Jira, etc.)
- **Note:** May need to split into multiple services
- **Estimated Time:** 5 hours

#### 13. **Salesforce API** (1,012 lines)
- **Location:** Lines 843-1854
- **Complexity:** Very Complex (large Salesforce integration)
- **Endpoints:** Multiple Salesforce operations
- **Service Methods Needed:**
  - Multiple Salesforce operations
  - Query building
  - Data transformation
- **Estimated Time:** 8 hours

---

## 📊 Extraction Statistics

### Completed:
- **Domains:** 3 of 13 (23%)
- **Lines Extracted:** 768 lines
- **Services Created:** 3
- **Routes Created:** 3

### Remaining:
- **Domains:** 10 of 13 (77%)
- **Lines to Extract:** ~4,100 lines
- **Services to Create:** ~10
- **Routes to Create:** ~10

### Total Phase 1:
- **Starting app.js:** 6,323 lines
- **Current app.js:** ~5,555 lines (768 removed)
- **Target app.js:** < 250 lines
- **Progress:** 12% of extraction complete

---

## 🎯 Extraction Template

For each remaining domain, follow this pattern:

### Step 1: Read the Code
```bash
# Open app.js and find the section
# Note the line numbers
# Identify all endpoints in the section
# Identify dependencies (salesforce, db, etc.)
```

### Step 2: Create Service
```javascript
// services/[domain].service.js
const db = require('../database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../middleware/error-handler');

class DomainService {
    async methodName(params) {
        logger.info('Operation', params);
        // Business logic here
        const result = await db.query(sql, params);
        return result.rows;
    }
}

module.exports = new DomainService();
```

### Step 3: Create Routes
```javascript
// routes/[domain].routes.js
const express = require('express');
const router = express.Router();
const service = require('../services/[domain].service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');

router.get('/', asyncHandler(async (req, res) => {
    const result = await service.methodName(req.query);
    success(res, result);
}));

module.exports = router;
```

### Step 4: Mount in app.js
```javascript
// In app.js, add near other route mounts:
const domainRoutes = require('./routes/[domain].routes');
app.use('/api/[domain]', authenticate, domainRoutes);
```

### Step 5: Test
- Test the new routes
- Verify API contracts unchanged
- Run existing tests

### Step 6: Remove from app.js
- Delete the old code (lines X-Y)
- Verify no references remain
- Commit changes

---

## 🚀 Quick Commands

```bash
# Create a new service
cat > services/validation.service.js

# Create new routes
cat > routes/validation.routes.js

# Test the routes
curl http://localhost:5000/api/validation/errors

# Check app.js line count
wc -l app.js
```

---

## 📈 Estimated Timeline

| Priority | Domains | Est. Time | Cumulative |
|----------|---------|-----------|------------|
| Completed | 3 | - | Done |
| Priority 1 | 1 | 3h | 3h |
| Priority 2 | 4 | 9h | 12h |
| Priority 3 | 2 | 9h | 21h |
| Priority 4 | 3 | 19h | 40h |
| **Total** | **10** | **40h** | **~1 week** |

---

## ⚠️ Important Notes

### Route URL Adjustments

Some routes may need URL adjustments for consistency:

**Package Mappings:**
- Old: `/api/packages/:id/products`
- New: `/api/package-product-mappings/package/:id/products`

**Reason:** Keeps package mappings under one namespace

### Service Dependencies

Some services depend on existing modules:
- **Validation:** Needs `validation-engine.js` and `salesforce.js`
- **Product Updates:** Use existing `product-update-service.js`
- **PS Audit:** Use existing `ps-audit-service.js`
- **Ghost Accounts:** Use existing `sml-ghost-accounts-service.js`

### Authentication

Remember to include authentication middleware:
```javascript
app.use('/api/[domain]', authenticate, domainRoutes);
```

---

## 🎓 Learning from Completed Extractions

### What Worked Well:
1. ✅ Starting with simplest route (Customer Products - 44 lines)
2. ✅ Following established Bundles pattern
3. ✅ Using utility modules (logger, response, error-handler)
4. ✅ Clear service/route separation

### Best Practices:
1. ✅ Log at service level, not route level
2. ✅ Throw custom errors in services
3. ✅ Use `asyncHandler` in all async routes
4. ✅ Use `success()` helper for responses
5. ✅ Keep routes thin (just HTTP handling)

---

## 📞 Next Steps

1. **Continue with Validation Errors** (next easiest)
2. **Then Product Updates** (service exists)
3. **Then Packages** (straightforward CRUD)
4. **Work through remaining domains**
5. **Update app.js to mount all routes**
6. **Remove all old code from app.js**
7. **Verify < 250 lines in app.js**
8. **Run full test suite**
9. **Update documentation**
10. **Phase 1 complete!** 🎉

---

**Remember:** One domain at a time. Test after each extraction. Commit frequently. You're making great progress!

