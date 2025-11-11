# Phase 2: Data Layer & Standards Implementation Guide

## Overview

With Phase 1 complete (route extraction), Phase 2 focuses on implementing the repository pattern, standardizing patterns, and improving data access across the application.

**Duration:** 2-3 weeks  
**Priority:** High  
**Prerequisites:** ✅ Phase 1 Complete

---

## 📋 Goals

1. **Repository Pattern** - Centralize all database access
2. **Data Access Consistency** - Standardize SQL queries
3. **Configuration Management** - Centralize environment config
4. **Response Standardization** - Ensure consistent API responses
5. **Database Connection Optimization** - Remove duplicate connections

---

## 🗂️ Phase 2 Task Breakdown

### Task 2.1: Create Repository Layer (High Priority)

**Objective:** Move all SQL queries from services to dedicated repository classes.

#### Repositories to Create:

1. **`repositories/product.repository.js`**
   - Product catalogue queries
   - Product search and filtering
   - Product sync operations

2. **`repositories/bundle.repository.js`**
   - Bundle CRUD operations
   - Bundle-product relationship queries
   - Bundle search and filtering

3. **`repositories/package.repository.js`**
   - Package management queries
   - Package-product mapping queries
   - Package sync operations

4. **`repositories/customer.repository.js`**
   - Customer product queries
   - Account-based queries
   - Customer entitlement queries

5. **`repositories/audit.repository.js`**
   - PS audit trail queries
   - Status change tracking
   - Audit history queries

6. **`repositories/validation.repository.js`**
   - Validation error queries
   - Async validation results
   - Validation trend analysis

7. **`repositories/expiration.repository.js`**
   - Expiration monitor queries
   - Expired product queries
   - Expiration analysis logging

8. **`repositories/ghost-account.repository.js`**
   - Ghost account queries
   - Product expiration queries for ghost accounts
   - Review status management

9. **`repositories/analytics.repository.js`**
   - Package change analytics queries
   - Request type analytics
   - Completion time analytics

#### Repository Pattern Example:

```javascript
/**
 * Product Repository
 * Handles all database operations for products
 */

const db = require('../database');

class ProductRepository {
    /**
     * Find product by ID
     * @param {String} productId - Salesforce product ID
     * @returns {Promise<Object|null>} Product or null
     */
    async findById(productId) {
        const query = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                is_active as "IsActive"
            FROM products
            WHERE salesforce_id = $1
            LIMIT 1
        `;
        
        const result = await db.query(query, [productId]);
        return result.rows[0] || null;
    }

    /**
     * Find products with filters
     * @param {Object} filters - Search filters
     * @param {Number} limit - Max results
     * @param {Number} offset - Pagination offset
     * @returns {Promise<Array>} Products
     */
    async findWithFilters(filters, limit = 100, offset = 0) {
        // Build dynamic query
        let whereConditions = ['is_active = $1', 'is_archived = $2'];
        let queryParams = [true, false];
        let paramIndex = 3;

        if (filters.family) {
            whereConditions.push(`family = $${paramIndex++}`);
            queryParams.push(filters.family);
        }

        if (filters.search) {
            whereConditions.push(`(
                name ILIKE $${paramIndex} OR 
                product_code ILIKE $${paramIndex} OR 
                description ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${filters.search}%`);
            paramIndex++;
        }

        const query = `
            SELECT * FROM products
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        queryParams.push(limit, offset);
        const result = await db.query(query, queryParams);
        return result.rows;
    }

    /**
     * Count products with filters
     * @param {Object} filters - Search filters
     * @returns {Promise<Number>} Count
     */
    async countWithFilters(filters) {
        // Similar to findWithFilters but with COUNT(*)
        // Implementation details...
    }

    /**
     * Update product
     * @param {String} productId - Product ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated product
     */
    async update(productId, updates) {
        // Dynamic UPDATE query
        // Implementation details...
    }

    /**
     * Bulk insert products
     * @param {Array} products - Products to insert
     * @returns {Promise<Number>} Number of products inserted
     */
    async bulkInsert(products) {
        // Batch INSERT with ON CONFLICT handling
        // Implementation details...
    }
}

module.exports = new ProductRepository();
```

#### Service Refactoring Example:

**Before (Service with SQL):**
```javascript
async getProductById(productId) {
    const query = `SELECT * FROM products WHERE salesforce_id = $1`;
    const result = await db.query(query, [productId]);
    if (result.rows.length === 0) {
        throw new NotFoundError('Product not found');
    }
    return { product: result.rows[0] };
}
```

**After (Service using Repository):**
```javascript
async getProductById(productId) {
    const product = await productRepository.findById(productId);
    if (!product) {
        throw new NotFoundError('Product not found');
    }
    return { product, source: 'local_database' };
}
```

---

### Task 2.2: Refactor Services to Use Repositories (High Priority)

**Objective:** Update all services to use repositories instead of direct database queries.

#### Services to Refactor:

1. ✅ `services/product-catalogue.service.js` → Use `ProductRepository`
2. ✅ `services/bundles.service.js` → Use `BundleRepository`
3. ✅ `services/packages.service.js` → Use `PackageRepository`
4. ✅ `services/customer-products.service.js` → Use `CustomerRepository`
5. ✅ `services/ps-audit.service.js` → Use `AuditRepository`
6. ✅ `services/validation.service.js` → Use `ValidationRepository`
7. ✅ `services/expiration.service.js` → Use `ExpirationRepository`
8. ✅ `services/ghost-accounts.service.js` → Use `GhostAccountRepository`
9. ✅ `services/package-changes.service.js` → Use `AnalyticsRepository`

#### Refactoring Checklist Per Service:

- [ ] Identify all direct `db.query()` calls
- [ ] Move SQL to appropriate repository method
- [ ] Replace `db.query()` with repository call
- [ ] Remove SQL query strings from service
- [ ] Add repository import
- [ ] Update tests to mock repository instead of db

---

### Task 2.3: Standardize Response Formats (Medium Priority)

**Objective:** Audit all API responses and ensure consistent formatting.

#### Response Format Standards:

**Success Response:**
```javascript
{
    success: true,
    data: { ... },
    timestamp: "2025-11-11T12:00:00.000Z",
    meta: { ... } // Optional: pagination, counts, etc.
}
```

**Error Response:**
```javascript
{
    success: false,
    error: "Error message",
    errorCode: "ERROR_CODE",
    timestamp: "2025-11-11T12:00:00.000Z",
    details: { ... } // Optional: additional error context
}
```

**Paginated Response:**
```javascript
{
    success: true,
    data: [ ... ],
    pagination: {
        totalItems: 100,
        currentPage: 1,
        itemsPerPage: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: false
    },
    timestamp: "2025-11-11T12:00:00.000Z"
}
```

#### Audit Checklist:

- [ ] Review all route handlers
- [ ] Ensure all use `utils/response.js` helpers
- [ ] Convert any custom response formats
- [ ] Add pagination info where applicable
- [ ] Document response schemas

---

### Task 2.4: Centralize Configuration (Medium Priority)

**Objective:** Move all configuration to centralized config modules.

#### Config Structure:

```
config/
├── environment.js      # Environment-specific config
├── database.js         # Database connection config
├── salesforce.js       # Salesforce API config (enhance existing)
├── authentication.js   # JWT and auth config
├── logging.js          # Winston logger config
└── index.js           # Config aggregator
```

#### Example: `config/environment.js`

```javascript
/**
 * Environment Configuration
 * Centralized environment variable management
 */

const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SF_CLIENT_ID',
    'SF_CLIENT_SECRET'
];

// Validate required env vars
const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = {
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    
    // Database
    database: {
        url: process.env.DATABASE_URL,
        poolMin: parseInt(process.env.DB_POOL_MIN) || 2,
        poolMax: parseInt(process.env.DB_POOL_MAX) || 10
    },
    
    // Authentication
    auth: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600
    },
    
    // Salesforce
    salesforce: {
        clientId: process.env.SF_CLIENT_ID,
        clientSecret: process.env.SF_CLIENT_SECRET,
        redirectUri: process.env.SF_REDIRECT_URI,
        loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
    },
    
    // Atlassian
    atlassian: {
        email: process.env.ATLASSIAN_EMAIL,
        apiToken: process.env.ATLASSIAN_API_TOKEN,
        siteUrl: process.env.ATLASSIAN_SITE_URL
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        directory: process.env.LOG_DIR || 'logs'
    }
};
```

#### Config Refactoring Checklist:

- [ ] Create config directory structure
- [ ] Move database config from `database.js`
- [ ] Centralize Salesforce config
- [ ] Create authentication config
- [ ] Update all services to use config
- [ ] Remove hardcoded values

---

### Task 2.5: Database Connection Consistency (High Priority)

**Objective:** Ensure all database access uses the centralized `database.js` module.

#### Audit Steps:

1. **Search for direct Pool creations:**
   ```bash
   grep -r "new Pool" --include="*.js"
   ```

2. **Search for direct pg imports:**
   ```bash
   grep -r "require('pg')" --include="*.js"
   ```

3. **Verify all use central db module:**
   - All services should `require('./database')` or `require('../database')`
   - No inline Pool creations
   - No duplicate connection logic

#### Database Module Enhancement:

```javascript
// database.js enhancements

// Add transaction support
async withTransaction(callback) {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Add query logging (development only)
async query(text, params) {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 SQL Query:', text);
        console.log('📊 Parameters:', params);
    }
    return this.pool.query(text, params);
}
```

---

## 🎯 Success Criteria

Phase 2 will be considered complete when:

- ✅ All database access goes through repositories
- ✅ Services contain only business logic
- ✅ Consistent response format across all endpoints
- ✅ All configuration centralized in `config/`
- ✅ No duplicate database connections
- ✅ Tests updated to mock repositories
- ✅ Documentation updated

---

## 📊 Estimated Timeline

| Task | Duration | Priority |
|------|----------|----------|
| 2.1: Create Repositories | 1 week | High |
| 2.2: Refactor Services | 1 week | High |
| 2.3: Standardize Responses | 2 days | Medium |
| 2.4: Centralize Config | 3 days | Medium |
| 2.5: Database Consistency | 2 days | High |
| **Total** | **2-3 weeks** | - |

---

## 🚀 Getting Started

### Week 1: Repositories & Services

**Days 1-3:** Create core repositories
- Product, Bundle, Package repositories
- Test with existing service methods

**Days 4-5:** Refactor services to use repositories
- Update product-catalogue.service.js
- Update bundles.service.js
- Update packages.service.js

### Week 2: Standards & Config

**Days 6-8:** Continue service refactoring
- Update remaining services
- Test all endpoints

**Days 9-10:** Standardize responses
- Audit all routes
- Update response formats
- Test consistency

**Days 11-13:** Centralize configuration
- Create config modules
- Update services to use config
- Remove hardcoded values

### Week 3: Polish & Test

**Days 14-15:** Database consistency
- Audit connections
- Add transaction support
- Add query logging

**Days 16-18:** Testing & Documentation
- Unit tests for repositories
- Integration tests
- Update documentation

---

## 📚 Reference Documentation

- Repository Pattern: [martinfowler.com/eaaCatalog/repository.html](https://martinfowler.com/eaaCatalog/repository.html)
- Configuration Management: [12factor.net/config](https://12factor.net/config)
- Database Best Practices: [node-postgres.com/guides/project-structure](https://node-postgres.com/guides/project-structure)

---

**Next Phase:** Phase 3 - TypeScript Migration & Testing

**Generated:** November 11, 2025  
**Status:** Ready to Begin

