# 📚 Repository Pattern Implementation Guide

**Date:** November 11, 2025  
**Status:** ✅ Complete  
**Version:** 1.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Repository List](#repository-list)
4. [Usage Examples](#usage-examples)
5. [Best Practices](#best-practices)
6. [Testing Repositories](#testing-repositories)
7. [Common Patterns](#common-patterns)

---

## 🎯 Overview

The repository pattern provides a clean abstraction layer between the service/business logic and the data access layer. This implementation offers:

- **Separation of Concerns** - Business logic separate from database operations
- **Code Reusability** - Common operations in base repository
- **Testability** - Easy to mock for unit testing
- **Maintainability** - Single place to update data access logic
- **Type Safety** - Consistent data structures

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Controllers   │  ← HTTP/Express layer
└────────┬────────┘
         │
┌────────▼────────┐
│    Services     │  ← Business logic
└────────┬────────┘
         │
┌────────▼────────┐
│  Repositories   │  ← Data access layer
└────────┬────────┘
         │
┌────────▼────────┐
│    Database     │  ← PostgreSQL
└─────────────────┘
```

### Layer Responsibilities

**Controllers/Routes:**
- HTTP request/response handling
- Input validation
- Response formatting
- Error handling

**Services:**
- Business logic
- Data transformation
- External API calls
- Workflow orchestration

**Repositories:**
- Database queries
- Data mapping
- Transaction management
- Query optimization

---

## 📦 Repository List

### Core Repositories

| Repository | Table(s) | Purpose | Lines |
|------------|----------|---------|-------|
| **base.repository.js** | N/A | Base CRUD operations | 85 |
| **product.repository.js** | `products` | Product catalog | 468 |
| **bundle.repository.js** | `product_bundles`, `bundle_products` | Product bundles | 382 |
| **package.repository.js** | `packages` | Software packages | 382 |
| **package-mapping.repository.js** | `package_product_mapping` | Package-product mapping | 186 |
| **expiration.repository.js** | `entitlements` | License expiration | 121 |
| **customer.repository.js** | `accounts` | Customer accounts | 98 |
| **provisioning.repository.js** | `technical_team_requests` | Provisioning requests | 85 |
| **validation.repository.js** | `validation_results` | Validation data | 72 |
| **audit.repository.js** | `ps_audit_trail` | Audit history | 58 |
| **sml.repository.js** | `sml_configuration` | SML config | 45 |

**Total:** 10 repositories, ~1,982 lines of code

---

## 💡 Usage Examples

### Basic CRUD Operations

```javascript
const productRepository = require('./repositories/product.repository');

// CREATE
const newProduct = await productRepository.create({
    product_code: 'PROD-001',
    product_name: 'Test Product',
    category: 'Model',
    is_active: true
});

// READ (Find by ID)
const product = await productRepository.findById(1);

// READ (Find all)
const products = await productRepository.findAll();

// UPDATE
const updated = await productRepository.update(1, {
    product_name: 'Updated Product'
});

// DELETE
const deleted = await productRepository.delete(1);
```

### Advanced Queries

```javascript
// Product Repository - Complex filtering
const products = await productRepository.findWithFilters({
    category: 'Model',
    region: 'NAM',
    isActive: true,
    search: 'Analytics',
    page: 1,
    limit: 50
});

// Get product count
const count = await productRepository.countWithFilters({
    category: 'Data'
});

// Get filter options
const filterOptions = await productRepository.getFilterOptions();
```

### Relationships

```javascript
// Bundle Repository - Bundle with products
const bundle = await bundleRepository.findByIdWithProducts(1);
// Returns:
// {
//     bundle_id: 1,
//     bundle_name: 'Premium Bundle',
//     products: [
//         { product_code: 'PROD1', quantity: 2 },
//         { product_code: 'PROD2', quantity: 1 }
//     ]
// }

// Add product to bundle
await bundleRepository.addProductToBundle(1, 'PROD3', 5);

// Update product quantity
await bundleRepository.updateProductQuantity(1, 'PROD1', 10);

// Remove product from bundle
await bundleRepository.removeProductFromBundle(1, 'PROD2');
```

### Pagination

```javascript
// Package Repository - Paginated results
const { packages, pagination } = await packageRepository.findAllPaginated({
    page: 2,
    limit: 25,
    sortBy: 'created_at',
    sortOrder: 'DESC'
});

console.log(pagination);
// {
//     page: 2,
//     limit: 25,
//     total: 150,
//     totalPages: 6,
//     hasNextPage: true,
//     hasPrevPage: true
// }
```

### Transactions

```javascript
const { pool } = require('./database');

// Using transaction for multiple operations
const client = await pool.connect();

try {
    await client.query('BEGIN');
    
    // Create bundle
    const bundle = await bundleRepository.createWithClient(client, {
        bundle_name: 'New Bundle'
    });
    
    // Add products to bundle
    await bundleRepository.addProductToBundleWithClient(
        client, bundle.bundle_id, 'PROD1', 2
    );
    await bundleRepository.addProductToBundleWithClient(
        client, bundle.bundle_id, 'PROD2', 1
    );
    
    await client.query('COMMIT');
    return bundle;
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}
```

---

## ✅ Best Practices

### 1. Keep Repositories Focused

```javascript
// ✅ GOOD - Repository handles data access only
class ProductRepository {
    async findById(id) {
        const result = await this.db.query(
            'SELECT * FROM products WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
}

// ❌ BAD - Repository doing business logic
class ProductRepository {
    async findById(id) {
        const result = await this.db.query(
            'SELECT * FROM products WHERE id = $1',
            [id]
        );
        const product = result.rows[0];
        
        // Business logic doesn't belong here!
        if (product.price < 100) {
            product.discount = 0.1;
        }
        
        return product;
    }
}
```

### 2. Return Null for Not Found

```javascript
// ✅ GOOD - Consistent null return
async findById(id) {
    const result = await this.db.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

// ❌ BAD - Throwing error for not found
async findById(id) {
    const result = await this.db.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
    );
    if (!result.rows[0]) {
        throw new Error('Product not found'); // Service layer should decide
    }
    return result.rows[0];
}
```

### 3. Use Parameterized Queries

```javascript
// ✅ GOOD - Safe from SQL injection
async findByCategory(category) {
    return await this.db.query(
        'SELECT * FROM products WHERE category = $1',
        [category]
    );
}

// ❌ BAD - SQL injection vulnerability
async findByCategory(category) {
    return await this.db.query(
        `SELECT * FROM products WHERE category = '${category}'`
    );
}
```

### 4. Consistent Naming

```javascript
// ✅ GOOD - Clear, consistent naming
findById(id)              // Get single record by ID
findAll()                 // Get all records
findByCategory(category)  // Find by specific field
create(data)              // Insert new record
update(id, data)          // Update existing record
delete(id)                // Delete record

// ❌ BAD - Inconsistent naming
getProduct(id)
getAllProducts()
searchByCategory(category)
insert(data)
modify(id, data)
remove(id)
```

### 5. Handle Errors Gracefully

```javascript
// ✅ GOOD - Let errors bubble up with context
async create(data) {
    try {
        const result = await this.db.query(
            'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *',
            [data.name, data.price]
        );
        return result.rows[0];
    } catch (error) {
        logger.error('Failed to create product', {
            error: error.message,
            data
        });
        throw error; // Let service layer handle it
    }
}
```

---

## 🧪 Testing Repositories

### Unit Testing with Mocks

```javascript
// tests/unit/repositories/product.repository.spec.js
const productRepository = require('../../../repositories/product.repository');

// Mock database module
jest.mock('../../../database', () => ({
    query: jest.fn()
}));

const db = require('../../../database');

describe('Product Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findById()', () => {
        it('should return product by ID', async () => {
            const mockProduct = {
                id: 1,
                product_code: 'PROD-001',
                product_name: 'Test Product'
            };

            db.query.mockResolvedValue({ rows: [mockProduct] });

            const result = await productRepository.findById(1);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1]
            );
            expect(result).toEqual(mockProduct);
        });

        it('should return null for non-existent product', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await productRepository.findById(999);

            expect(result).toBeNull();
        });
    });
});
```

### Integration Testing

```javascript
// tests/integration/product.repository.spec.js
const productRepository = require('../../repositories/product.repository');
const db = require('../../database');

describe('Product Repository Integration', () => {
    beforeAll(async () => {
        // Setup test database
        await db.query('BEGIN');
    });

    afterAll(async () => {
        // Cleanup test database
        await db.query('ROLLBACK');
    });

    it('should create and retrieve product', async () => {
        // Create
        const newProduct = await productRepository.create({
            product_code: 'TEST-001',
            product_name: 'Test Product',
            category: 'Model'
        });

        expect(newProduct).toHaveProperty('id');

        // Retrieve
        const retrieved = await productRepository.findById(newProduct.id);

        expect(retrieved.product_code).toBe('TEST-001');
        expect(retrieved.product_name).toBe('Test Product');
    });
});
```

---

## 🔧 Common Patterns

### Pattern 1: Dynamic Query Building

```javascript
async findWithFilters(filters = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(filters.category);
    }

    if (filters.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex++}`);
        params.push(filters.isActive);
    }

    if (filters.search) {
        conditions.push(`product_name ILIKE $${paramIndex++}`);
        params.push(`%${filters.search}%`);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const query = `
        SELECT * FROM products
        ${whereClause}
        ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, params);
    return result.rows;
}
```

### Pattern 2: Batch Operations

```javascript
async createMany(products) {
    const values = [];
    const params = [];
    let paramIndex = 1;

    products.forEach(product => {
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(product.code, product.name, product.category);
    });

    const query = `
        INSERT INTO products (product_code, product_name, category)
        VALUES ${values.join(', ')}
        RETURNING *
    `;

    const result = await this.db.query(query, params);
    return result.rows;
}
```

### Pattern 3: Soft Delete

```javascript
async softDelete(id) {
    const result = await this.db.query(
        `UPDATE products 
         SET deleted_at = NOW(), is_active = false 
         WHERE id = $1 
         RETURNING *`,
        [id]
    );
    return result.rows[0] || null;
}

async findAllActive() {
    const result = await this.db.query(
        'SELECT * FROM products WHERE deleted_at IS NULL'
    );
    return result.rows;
}
```

---

## 📖 Additional Resources

- [Base Repository Documentation](../repositories/README.md)
- [Database Setup Guide](../04-Database/Database-README.md)
- [Service Layer Guide](./SERVICE-LAYER-GUIDE.md)
- [Testing Guide](../06-Testing/Test-Suite-Execution-Complete.md)

---

**Last Updated:** November 11, 2025  
**Maintained By:** Development Team


