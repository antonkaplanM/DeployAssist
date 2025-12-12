# 📦 Repository Layer Documentation

## Overview

The repository layer provides a **data access abstraction** between the application's business logic (services) and the database. This pattern ensures:

- **Separation of Concerns**: Business logic stays in services, data access stays in repositories
- **Reusability**: Common database operations are shared via base repository
- **Testability**: Services can be tested with mocked repositories
- **Maintainability**: Database queries are centralized and easier to update
- **Consistency**: All data access follows the same patterns

---

## Architecture

```
┌─────────────────┐
│     Routes      │  ← HTTP layer (request/response)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Services     │  ← Business logic layer
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Repositories   │  ← Data access layer
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Database     │  ← PostgreSQL
└─────────────────┘
```

---

## Available Repositories

### 1. **BaseRepository** (`base.repository.js`)
Base class providing common CRUD operations for all repositories.

**Common Methods:**
- `findAll(options)` - Get all records with pagination
- `findById(id, idColumn)` - Get single record by ID
- `findWhere(conditions, options)` - Get records by conditions
- `count(conditions)` - Count records
- `create(data)` - Create new record
- `update(id, data, idColumn)` - Update record
- `delete(id, idColumn)` - Delete record
- `exists(conditions)` - Check if record exists
- `executeQuery(query, params)` - Execute custom query
- `getClient()` - Get DB client for transactions

**Usage Example:**
```javascript
const BaseRepository = require('./base.repository');

class MyRepository extends BaseRepository {
    constructor() {
        super('my_table_name');
    }

    // Add custom methods...
}
```

---

### 2. **ProductRepository** (`product.repository.js`)
Manages product catalogue data.

**Table:** `products`

**Key Methods:**
- `findWithFilters(filters)` - Search products with filters
- `countWithFilters(filters)` - Count products matching filters
- `getFilterOptions()` - Get distinct filter options (families, groups, etc.)
- `findBySalesforceId(salesforceId)` - Find product by Salesforce ID
- `findByProductCode(productCode)` - Find product by product code
- `findAllForExport()` - Get products with related packages for Excel export
- `getStats()` - Get product statistics

**Usage:**
```javascript
const productRepository = require('../repositories/product.repository');

// In service:
const products = await productRepository.findWithFilters({
    search: 'flood',
    family: 'Model',
    isActive: true,
    limit: 50,
    offset: 0
});
```

---

### 3. **BundleRepository** (`bundle.repository.js`)
Manages product bundles and bundle-product associations.

**Tables:** `product_bundles`, `bundle_products`

**Key Methods:**
- `findAllWithCounts(options)` - Get bundles with product counts
- `findByIdWithProducts(bundleId)` - Get bundle with its products
- `getNextBundleId()` - Generate next bundle ID
- `findByBundleId(bundleId)` - Find bundle by ID
- `updateByBundleId(bundleId, data)` - Update bundle
- `deleteByBundleId(bundleId)` - Delete bundle
- `duplicateBundleProducts(originalId, newId)` - Duplicate bundle products
- `addProductToBundle(bundleId, productId, quantity, sortOrder)` - Add product
- `getMaxSortOrder(bundleId)` - Get max sort order
- `updateProductQuantity(bundleId, productId, quantity)` - Update quantity
- `removeProductFromBundle(bundleId, productId)` - Remove product

---

### 4. **PackageRepository** (`package.repository.js`)
Manages package catalogue.

**Table:** `packages`

**Key Methods:**
- `findAllPackages(options)` - Get all packages
- `findBasePackages()` - Get base packages only
- `findExpansionPackages()` - Get expansion packages only
- `findByPackageName(packageName)` - Find by package name
- `findBySalesforceId(sfPackageId)` - Find by Salesforce ID
- `getSummaryStats()` - Get package statistics
- `findAllForExport()` - Get packages with products for Excel export

---

### 5. **PackageMappingRepository** (`package-mapping.repository.js`)
Manages package-product mappings.

**Table:** `package_product_mapping`

**Key Methods:**
- `findByPackageName(packageName)` - Get products in package
- `findByProductCode(productCode)` - Get packages for product
- `findAllWithDetails()` - Get mappings with package/product details
- `upsertMapping(packageName, productCode)` - Create or update mapping
- `deleteMapping(packageName, productCode)` - Delete mapping
- `getProductCountsPerPackage()` - Get product counts per package
- `getPackageCountsPerProduct()` - Get package counts per product

---

### 6. **ExpirationRepository** (`expiration.repository.js`)
Manages entitlement expiration monitoring.

**Table:** `entitlements`

**Key Methods:**
- `findExpiringEntitlements(options)` - Get entitlements expiring soon
- `findExpiredEntitlements(options)` - Get expired entitlements
- `getExpirationStats(daysAhead)` - Get expiration statistics
- `findByAccount(accountName)` - Get entitlements for account
- `getLastRefreshTime()` - Get last sync time

---

### 7. **CustomerRepository** (`customer.repository.js`)
Manages customer/account data.

**Table:** `accounts`

**Key Methods:**
- `findBySalesforceId(salesforceId)` - Find customer by Salesforce ID
- `findByName(name)` - Find customer by name
- `search(searchTerm, options)` - Search customers
- `getCustomerProducts(accountId)` - Get customer's products
- `findByRegion(region)` - Get customers by region
- `getStats()` - Get customer statistics

---

### 8. **ProvisioningRepository** (`provisioning.repository.js`)
Manages technical team requests (provisioning).

**Table:** `technical_team_requests`

**Key Methods:**
- `searchRequests(options)` - Search provisioning requests
- `findByIdentifier(identifier)` - Find request by ID
- `findNewSince(sinceDate, limit)` - Get new requests since date
- `findRemovalRequests(options)` - Get product removal requests
- `findValidationErrors(options)` - Get validation errors
- `getStats()` - Get request statistics
- `getRequestTypesThisWeek()` - Get request type breakdown
- `getRequestVolume(months)` - Get request volume over time

---

### 9. **ValidationRepository** (`validation.repository.js`)
Manages validation results and logs.

**Tables:** `validation_results`, `async_validation_log`

**Key Methods:**
- `findByRecordIds(recordIds)` - Get validation results by IDs
- `findLatestByRecordId(recordId)` - Get latest validation for record
- `getAsyncValidationStatus()` - Get async validation status
- `findValidationErrors(options)` - Get validation errors
- `getErrorTrend(days)` - Get error trend over time
- `createValidationResult(data)` - Create validation result
- `logAsyncValidation(data)` - Log async validation run

---

### 10. **AuditRepository** (`audit.repository.js`)
Manages Professional Services audit trail.

**Tables:** `ps_audit_trail`, `ps_status_changes`

**Key Methods:**
- `searchRecords(options)` - Search PS records
- `findByIdentifier(identifier)` - Find PS record by ID/name
- `getStatusChanges(identifier)` - Get status change history
- `getAuditStats()` - Get audit statistics
- `upsertAuditRecord(data)` - Create or update audit record
- `logStatusChange(data)` - Log status change
- `findByAccount(accountName)` - Get records for account

---

## Usage Patterns

### Basic Usage in Services

```javascript
// services/my.service.js
const myRepository = require('../repositories/my.repository');
const logger = require('../utils/logger');

class MyService {
    async getItems(filters) {
        logger.info('Fetching items', { filters });
        
        // Repository handles data access
        const items = await myRepository.findWithFilters(filters);
        
        // Service handles business logic
        return this.formatItems(items);
    }

    formatItems(items) {
        // Business logic: transform, enrich, calculate, etc.
        return items.map(item => ({
            ...item,
            displayName: this.formatDisplayName(item)
        }));
    }

    formatDisplayName(item) {
        return `${item.name} (${item.code})`;
    }
}

module.exports = new MyService();
```

### Custom Queries

```javascript
// In repository
async findComplexData(param1, param2) {
    const query = `
        SELECT 
            t1.*,
            t2.related_field,
            COUNT(t3.id) as count
        FROM ${this.tableName} t1
        LEFT JOIN related_table t2 ON t1.id = t2.foreign_id
        LEFT JOIN another_table t3 ON t1.id = t3.ref_id
        WHERE t1.status = $1 AND t2.type = $2
        GROUP BY t1.id, t2.related_field
        ORDER BY count DESC
    `;

    return await this.executeQuery(query, [param1, param2]);
}
```

### Transactions

```javascript
// In service using transaction
async complexOperation(data) {
    const client = await myRepository.getClient();
    
    try {
        await client.query('BEGIN');
        
        // Multiple operations in transaction
        const result1 = await client.query('INSERT INTO table1 ...', [data.field1]);
        const result2 = await client.query('INSERT INTO table2 ...', [result1.rows[0].id]);
        
        await client.query('COMMIT');
        return result2.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
```

---

## Best Practices

### 1. **Keep Business Logic in Services**
```javascript
// ❌ BAD: Business logic in repository
async findActiveProducts() {
    const products = await this.executeQuery('SELECT * FROM products WHERE is_active = true');
    return products.map(p => ({ ...p, displayName: p.name.toUpperCase() })); // Business logic!
}

// ✅ GOOD: Repository only handles data access
async findActiveProducts() {
    return await this.executeQuery('SELECT * FROM products WHERE is_active = true');
}

// Business logic in service
async getActiveProducts() {
    const products = await productRepository.findActiveProducts();
    return products.map(p => this.formatProduct(p)); // Business logic in service
}
```

### 2. **Use Prepared Statements**
```javascript
// ❌ BAD: SQL injection risk
async findByName(name) {
    const query = `SELECT * FROM users WHERE name = '${name}'`; // DANGEROUS!
    return await this.executeQuery(query);
}

// ✅ GOOD: Parameterized query
async findByName(name) {
    const query = 'SELECT * FROM users WHERE name = $1';
    return await this.executeQuery(query, [name]);
}
```

### 3. **Return Consistent Data Structures**
```javascript
// ✅ GOOD: Consistent return structure
async findWithPagination(options) {
    const { limit = 50, page = 1 } = options;
    const offset = (page - 1) * limit;
    
    const countResult = await this.count();
    const dataResult = await this.findAll({ limit, offset });
    
    return {
        data: dataResult,
        pagination: {
            page,
            limit,
            totalCount: countResult,
            totalPages: Math.ceil(countResult / limit)
        }
    };
}
```

### 4. **Handle Errors Gracefully**
```javascript
async findById(id) {
    try {
        const result = await this.query('SELECT * FROM table WHERE id = $1', [id]);
        return result.rows[0] || null; // Return null instead of undefined
    } catch (error) {
        logger.error('Failed to find record', { id, error: error.message });
        throw error; // Re-throw for service to handle
    }
}
```

### 5. **Add JSDoc Comments**
```javascript
/**
 * Find products with advanced filtering
 * @param {Object} filters - Search filters
 * @param {String} [filters.search] - Search term
 * @param {String} [filters.family] - Product family
 * @param {Boolean} [filters.isActive=true] - Active status
 * @param {Number} [filters.limit=50] - Results limit
 * @param {Number} [filters.offset=0] - Results offset
 * @returns {Promise<Array>} Array of products
 */
async findWithFilters(filters = {}) {
    // Implementation...
}
```

---

## Testing Repositories

### Unit Test Example

```javascript
// tests/unit/repositories/product.repository.spec.js
const productRepository = require('../../../repositories/product.repository');
const db = require('../../../database');

jest.mock('../../../database');

describe('ProductRepository', () => {
    describe('findBySalesforceId', () => {
        it('should find product by Salesforce ID', async () => {
            const mockProduct = { id: 1, salesforce_id: 'SF123', name: 'Test Product' };
            db.query.mockResolvedValue({ rows: [mockProduct] });

            const result = await productRepository.findBySalesforceId('SF123');

            expect(result).toEqual(mockProduct);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE salesforce_id = $1'),
                ['SF123']
            );
        });

        it('should return null when product not found', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await productRepository.findBySalesforceId('NOTFOUND');

            expect(result).toBeNull();
        });
    });
});
```

---

## Migration Guide

### Before (Direct DB Access in Service)

```javascript
class BundlesService {
    async getBundles(options) {
        const query = `SELECT * FROM product_bundles WHERE name ILIKE $1`;
        const result = await db.query(query, [`%${options.search}%`]);
        return result.rows;
    }
}
```

### After (Using Repository)

```javascript
class BundlesService {
    constructor() {
        this.bundleRepository = require('../repositories/bundle.repository');
    }

    async getBundles(options) {
        const bundles = await this.bundleRepository.findAllWithCounts(options);
        return this.formatBundles(bundles); // Business logic
    }

    formatBundles(bundles) {
        // Transform/enrich data as needed
        return bundles;
    }
}
```

---

## Performance Considerations

1. **Use Indexes**: Ensure database tables have proper indexes
2. **Limit Results**: Always use pagination for large datasets
3. **Select Specific Columns**: Avoid `SELECT *` when possible
4. **Connection Pooling**: Reuse database connections (handled by `database.js`)
5. **Query Optimization**: Use EXPLAIN ANALYZE to optimize slow queries

---

## Future Enhancements

- [ ] Add caching layer (Redis)
- [ ] Add query builder for dynamic queries
- [ ] Add soft delete functionality
- [ ] Add audit logging for all write operations
- [ ] Add database migration tracking
- [ ] Add query performance monitoring

---

**Created:** November 11, 2025  
**Last Updated:** November 11, 2025  
**Status:** ✅ Complete - Ready for use








