# 🎯 Standardization Guide

**Date:** November 11, 2025  
**Status:** ✅ Complete  
**Version:** 1.0

---

## 📋 Table of Contents

1. [Response Formatting](#response-formatting)
2. [Error Handling](#error-handling)
3. [Configuration Management](#configuration-management)
4. [Database Access](#database-access)
5. [Quick Reference](#quick-reference)

---

## 📤 Response Formatting

### Overview

All API responses follow a standardized format with consistent structure, request tracking, and metadata.

### Standard Response Format

```javascript
{
    "success": true,
    "data": { ... },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123...",
        // Additional metadata...
    }
}
```

### Using ResponseFormatter

```javascript
const { ResponseFormatter } = require('../utils/response');

// Success response
router.get('/products/:id', async (req, res) => {
    const product = await productService.getProduct(req.params.id);
    return res.json(ResponseFormatter.success(product));
});

// Response with custom meta
router.get('/products', async (req, res) => {
    const products = await productService.getProducts();
    return res.json(ResponseFormatter.success(products, {
        cached: true,
        cacheExpiry: '5m'
    }));
});
```

### Paginated Responses

```javascript
// Paginated response
router.get('/products', async (req, res) => {
    const { products, pagination } = await productService.getProducts(req.query);
    
    return res.json(ResponseFormatter.paginated(products, {
        page: pagination.page,
        pageSize: pagination.limit,
        totalPages: pagination.totalPages,
        totalRecords: pagination.total
    }));
});

// Output:
// {
//     "success": true,
//     "data": [...],
//     "meta": {
//         "timestamp": "2025-11-11T12:00:00.000Z",
//         "requestId": "abc123...",
//         "page": 1,
//         "pageSize": 50,
//         "totalPages": 10,
//         "totalRecords": 500
//     }
// }
```

### List Responses

```javascript
// List with count
router.get('/categories', async (req, res) => {
    const categories = await productService.getCategories();
    return res.json(ResponseFormatter.list(categories, 'categories'));
});

// Output:
// {
//     "success": true,
//     "data": {
//         "categories": [...],
//         "count": 15
//     },
//     "meta": { ... }
// }
```

### Legacy Helpers (Backward Compatible)

```javascript
const { success, error, paginated } = require('../utils/response');

// These still work for backward compatibility
success(res, data, 200, { customMeta: 'value' });
error(res, 'Error message', 400);
paginated(res, data, page, limit, total);
```

---

## ⚠️ Error Handling

### Error Classes

All custom errors extend from `AppError` and include:
- HTTP status code
- Error code
- Operational flag
- Timestamp
- Stack trace (development only)

### Available Error Classes

```javascript
const {
    ValidationError,      // 400 - Invalid input
    BadRequestError,      // 400 - Malformed request
    UnauthorizedError,    // 401 - Authentication required
    ForbiddenError,       // 403 - Insufficient permissions
    NotFoundError,        // 404 - Resource not found
    TimeoutError,         // 408 - Operation timeout
    ConflictError,        // 409 - Resource conflict
    RateLimitError,       // 429 - Rate limit exceeded
    InternalServerError,  // 500 - Server error
    ServiceUnavailableError, // 503 - External service down
    DatabaseError,        // 500 - Database error
    ExternalAPIError      // 500 - External API error
} = require('../utils/errors');
```

### Using Custom Errors

```javascript
// In services
async getProduct(id) {
    const product = await productRepository.findById(id);
    
    if (!product) {
        throw new NotFoundError('Product');
    }
    
    return product;
}

// In routes with validation
router.post('/products', async (req, res, next) => {
    try {
        const { name, price } = req.body;
        
        if (!name || !price) {
            throw new ValidationError('Name and price are required', {
                fields: ['name', 'price']
            });
        }
        
        const product = await productService.createProduct(req.body);
        return res.status(201).json(ResponseFormatter.success(product));
        
    } catch (error) {
        next(error); // Pass to error middleware
    }
});
```

### Error Middleware

```javascript
// middleware/error-handler.js
const { formatErrorResponse, isOperationalError } = require('../utils/errors');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    // Log error
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Operational errors (expected)
    if (isOperationalError(err)) {
        return res.status(err.statusCode).json(
            formatErrorResponse(err)
        );
    }

    // Programming errors (unexpected)
    return res.status(500).json(
        formatErrorResponse(new InternalServerError())
    );
}
```

### Error Response Format

```javascript
{
    "success": false,
    "error": {
        "message": "Product not found",
        "code": "NOT_FOUND",
        "details": { ... }  // Optional
    },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123..."
    }
}
```

---

## ⚙️ Configuration Management

### Centralized Configuration

All environment variables and configuration in one place.

```javascript
const config = require('../config/environment');

// Access configuration
const port = config.app.port;
const dbUrl = config.database.url;
const jwtSecret = config.auth.jwtSecret;

// Environment checks
if (config.app.isDevelopment) {
    console.log('Running in development mode');
}

if (config.app.isProduction) {
    // Production-specific logic
}
```

### Configuration Sections

```javascript
// App Configuration
config.app.name
config.app.port
config.app.env
config.app.isDevelopment
config.app.isProduction
config.app.isTest

// Database Configuration
config.database.url
config.database.ssl
config.database.poolSize
config.database.idleTimeout

// Salesforce Configuration
config.salesforce.loginUrl
config.salesforce.clientId
config.salesforce.clientSecret
config.salesforce.apiVersion

// Authentication Configuration
config.auth.jwtSecret
config.auth.sessionTimeout
config.auth.bcryptRounds

// Feature Flags
config.features.enableSML
config.features.enableJira
config.features.enableAuditTrail
```

### Helper Methods

```javascript
// Get nested configuration value
const apiTimeout = config.get('sml.apiTimeout', 30000);

// Check feature flag
if (config.isFeatureEnabled('enableSML')) {
    // SML-specific logic
}

// Get Salesforce status
const sfStatus = config.getSalesforceStatus();
// Returns: { configured: true, hasCredentials: true, loginUrl: '...' }

// Get database pool configuration
const poolConfig = config.getDatabasePoolConfig();
```

### Feature Flags

```javascript
// In routes
router.get('/sml/data', async (req, res) => {
    if (!config.isFeatureEnabled('enableSML')) {
        return res.status(503).json(
            ResponseFormatter.error(
                'SML feature is currently disabled',
                'FEATURE_DISABLED'
            )
        );
    }
    
    // SML logic...
});
```

---

## 🗄️ Database Access

### Using Database Instance

```javascript
const { database } = require('../database');

// Execute query with monitoring
const result = await database.query(
    'SELECT * FROM products WHERE id = $1',
    [productId]
);

// Get connection for transaction
const client = await database.getClient();
try {
    await client.query('BEGIN');
    // ... transaction operations
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
} finally {
    client.release();
}

// Test connection
const status = await database.testConnection();

// Get pool statistics
const stats = database.getPoolStats();
console.log('Average query time:', stats.averageQueryTime, 'ms');
```

### Query Monitoring

The database module automatically tracks:
- Total queries executed
- Successful/failed queries
- Average query time
- Slow query detection (>1000ms)

---

## 📖 Quick Reference

### Complete Request Handler Example

```javascript
const { ResponseFormatter } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const config = require('../config/environment');
const logger = require('../utils/logger');

router.post('/products/:id', async (req, res, next) => {
    try {
        // Check feature flag
        if (!config.isFeatureEnabled('enableProductUpdates')) {
            throw new ServiceUnavailableError('Product updates are disabled');
        }
        
        // Validate input
        const { name, price } = req.body;
        if (!name) {
            throw new ValidationError('Name is required', { field: 'name' });
        }
        
        // Use repository through service
        const product = await productService.updateProduct(
            req.params.id,
            req.body
        );
        
        if (!product) {
            throw new NotFoundError('Product');
        }
        
        // Log success
        logger.info('Product updated', {
            productId: product.id,
            userId: req.user.id
        });
        
        // Return formatted response
        return res.json(ResponseFormatter.success(product, {
            operation: 'update',
            userId: req.user.id
        }));
        
    } catch (error) {
        next(error);
    }
});
```

### Service Layer Example

```javascript
const productRepository = require('../repositories/product.repository');
const { NotFoundError, DatabaseError } = require('../utils/errors');
const logger = require('../utils/logger');

class ProductService {
    async updateProduct(id, updates) {
        try {
            logger.info('Updating product', { id, updates });
            
            // Use repository
            const product = await productRepository.update(id, updates);
            
            if (!product) {
                throw new NotFoundError('Product');
            }
            
            return product;
            
        } catch (error) {
            if (error.code === '23505') {
                throw new ConflictError('Product code already exists');
            }
            throw new DatabaseError('Failed to update product', error);
        }
    }
}
```

---

## 📚 Related Documentation

- [Repository Pattern Guide](./REPOSITORY-PATTERN-GUIDE.md)
- [Error Handling Documentation](./utils/errors.js)
- [Configuration Documentation](./config/environment.js)
- [Response Formatter Documentation](./utils/response.js)

---

**Last Updated:** November 11, 2025  
**Maintained By:** Development Team


