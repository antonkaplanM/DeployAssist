# TypeScript Refactoring Migration Guide

This guide explains how to gradually migrate your Node.js Deployment Assistant to TypeScript with improved architecture.

## Overview

The refactoring introduces:
- ✅ **TypeScript** for type safety and better IDE support
- ✅ **Service/Repository pattern** for separation of concerns
- ✅ **Error handling middleware** with custom error classes
- ✅ **Centralized logging** with Winston
- ✅ **Proper SSL configuration** (no more disabled certificate validation)
- ✅ **Circuit breakers** for external API resilience

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Directory Structure](#directory-structure)
3. [Migration Strategy](#migration-strategy)
4. [SSL Configuration](#ssl-configuration)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)

---

## Setup & Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:
- TypeScript and type definitions
- Winston for logging
- Opossum for circuit breakers
- Zod for runtime validation

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
# SSL Configuration (IMPORTANT!)
# Options: strict (default), custom, disabled
SSL_MODE=strict

# For corporate environments with custom CA:
# SSL_MODE=custom
# SSL_CA_PATH=./certs/corporate-ca.pem

# Only use disabled in development (insecure!)
# SSL_MODE=disabled
```

### 3. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

---

## Directory Structure

```
src/
├── types/              # TypeScript type definitions
│   ├── salesforce.types.ts
│   ├── database.types.ts
│   └── common.types.ts
├── config/             # Configuration management
│   └── index.ts
├── middleware/         # Express middleware
│   └── errors.ts       # Error handling
├── utils/              # Utility functions
│   └── logger.ts       # Winston logger
├── repositories/       # Data access layer
│   └── SalesforceRepository.ts
├── services/           # Business logic layer
│   └── SalesforceService.ts
├── routes/             # HTTP routes
│   └── salesforce.routes.ts
└── app.ts              # Main application (to be created)
```

---

## Migration Strategy

### Phase 1: Run Existing & New Side-by-Side

**Status**: Current phase

- ✅ Keep `app.js` running as-is (port 8080)
- ✅ Create new TypeScript endpoints
- ✅ Test TypeScript version thoroughly
- ⏭️ Gradually migrate endpoints

**Example**: Run both versions

```bash
# Terminal 1: Original app
npm start

# Terminal 2: TypeScript app (on port 8081)
PORT=8081 npm run dev:ts
```

### Phase 2: Migrate Existing Endpoints

For each endpoint in `app.js`:

#### Before (app.js)
```javascript
app.get('/api/provisioning/requests', async (req, res) => {
  try {
    const result = await salesforce.queryProfServicesRequests(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### After (TypeScript)
```typescript
// src/routes/salesforce.routes.ts
router.get('/provisioning/requests', asyncHandler(async (req: Request, res: Response) => {
  const filters = /* build from req.query */;
  const result = await salesforceService.queryProfServicesRequests(filters);
  res.json(result);
}));
```

**Benefits**:
- ✅ `asyncHandler` automatically catches errors
- ✅ Types prevent runtime errors
- ✅ Service layer is reusable and testable

### Phase 3: Deprecate Old Code

Once all endpoints are migrated:

1. **Update `app.js` to redirect** to new TypeScript endpoints
2. **Monitor for 1-2 weeks** to catch any issues
3. **Delete old code** once confident

---

## SSL Configuration

### ⚠️ Security Fix

The old code disabled SSL validation globally:

```javascript
// ❌ OLD (INSECURE)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

### ✅ New Approach

Configure SSL properly:

#### Option 1: Strict Mode (Default)
Use system CA certificates (secure):

```bash
SSL_MODE=strict
```

#### Option 2: Custom CA (For Corporate Environments)
Use custom CA certificates:

```bash
SSL_MODE=custom
SSL_CA_PATH=./certs/corporate-ca.pem
```

#### Option 3: Disabled (Development Only)
**⚠️ Use only for local development!**

```bash
SSL_MODE=disabled
```

### How It Works

```typescript
// src/config/index.ts
export function getHttpsAgent(): https.Agent {
  const sslMode = process.env.SSL_MODE || 'strict';
  
  if (sslMode === 'custom') {
    const ca = fs.readFileSync(process.env.SSL_CA_PATH);
    return new https.Agent({ ca, rejectUnauthorized: true });
  }
  
  return new https.Agent({ rejectUnauthorized: true });
}
```

---

## Running the Application

### Development

```bash
# Build TypeScript and run
npm run dev:ts

# Or build and watch for changes
npm run build:watch
# In another terminal:
npm run start:ts
```

### Production

```bash
# Build optimized version
npm run build

# Run compiled JavaScript
npm run start:ts
```

### Check Type Errors

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

---

## Testing

### Create Tests for TypeScript Code

Example test for `SalesforceService`:

```typescript
// src/services/__tests__/SalesforceService.test.ts
import { SalesforceService } from '../SalesforceService';
import { SalesforceRepository } from '../../repositories/SalesforceRepository';

describe('SalesforceService', () => {
  let service: SalesforceService;
  let mockRepository: jest.Mocked<SalesforceRepository>;

  beforeEach(() => {
    mockRepository = {
      query: jest.fn(),
      describe: jest.fn()
    } as any;
    
    service = new SalesforceService(mockRepository);
  });

  it('should query Prof Services Requests', async () => {
    mockRepository.query.mockResolvedValue({
      records: [{ Id: '1', Name: 'PS-1234' }],
      totalSize: 1
    });

    const result = await service.queryProfServicesRequests({ pageSize: 10 });
    
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
  });
});
```

---

## Architecture Benefits

### Before: Monolithic `app.js`
```
app.js (2125 lines)
  ├── Routes
  ├── Business Logic
  ├── Database Queries
  ├── Salesforce Queries
  └── Error Handling (ad-hoc)
```

**Problems**:
- ❌ Hard to test
- ❌ Difficult to maintain
- ❌ No type safety
- ❌ Mixed concerns

### After: Layered Architecture
```
Routes (thin layer)
  ↓
Services (business logic)
  ↓
Repositories (data access)
  ↓
Database / External APIs
```

**Benefits**:
- ✅ Each layer has single responsibility
- ✅ Easy to test (mock dependencies)
- ✅ Reusable services
- ✅ Type-safe contracts

---

## Error Handling

### Old Approach
```javascript
try {
  const result = await fetch();
  res.json(result);
} catch (err) {
  res.status(500).json({ error: err.message });
}
```

**Problems**:
- ❌ Inconsistent error responses
- ❌ No error classification
- ❌ Poor logging

### New Approach
```typescript
import { asyncHandler, SalesforceError } from '../middleware/errors';

router.get('/endpoint', asyncHandler(async (req, res) => {
  // Errors are automatically caught and formatted
  const result = await service.doSomething();
  res.json(result);
}));
```

**Benefits**:
- ✅ Consistent error responses
- ✅ Proper HTTP status codes
- ✅ Centralized logging
- ✅ Stack traces in development

---

## Logging

### Old Approach
```javascript
console.log('Query executed');
console.error('Error:', error.message);
```

### New Approach
```typescript
import { Logger } from '../utils/logger';

Logger.salesforce('Query executed', { recordCount: 10 });
Logger.error('Query failed', error, { query: soql });
```

**Benefits**:
- ✅ Log levels (error, warn, info, debug)
- ✅ Structured logging
- ✅ File rotation
- ✅ Searchable logs

---

## Next Steps

1. **Review the new code structure** in `src/`
2. **Run both apps side-by-side** to compare
3. **Migrate one route** as a proof of concept
4. **Write tests** for new code
5. **Document learnings** and update this guide

---

## Questions?

If you encounter issues:

1. Check `.env` configuration
2. Review TypeScript compiler errors: `npm run type-check`
3. Check logs in `logs/` directory
4. Compare with working examples in `src/routes/`

---

## Rollback Plan

If you need to rollback:

1. Keep running `app.js` (original)
2. TypeScript code is in `src/` (separate)
3. Delete `dist/` and `src/` if needed
4. No changes to original code

**The refactoring is additive, not destructive.**

