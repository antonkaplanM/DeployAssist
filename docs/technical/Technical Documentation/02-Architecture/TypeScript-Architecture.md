# TypeScript Source Code

This directory contains the refactored TypeScript codebase with improved architecture.

## Directory Structure

```
src/
├── app.ts                  # Main application entry point
├── config/                 # Configuration management
│   └── index.ts           # App config, SSL setup
├── types/                  # TypeScript type definitions
│   ├── salesforce.types.ts
│   ├── database.types.ts
│   └── common.types.ts
├── middleware/             # Express middleware
│   └── errors.ts          # Error handling
├── utils/                  # Utility functions
│   └── logger.ts          # Winston logger
├── repositories/           # Data access layer
│   └── SalesforceRepository.ts
├── services/               # Business logic layer
│   └── SalesforceService.ts
└── routes/                 # HTTP routes
    └── salesforce.routes.ts
```

## Key Concepts

### Layered Architecture

```
Routes (thin layer)
  ↓ calls
Services (business logic)
  ↓ calls
Repositories (data access)
  ↓ queries
External APIs / Database
```

### Responsibilities

- **Routes**: HTTP handling, request validation
- **Services**: Business logic, data transformation
- **Repositories**: Database queries, API calls
- **Middleware**: Cross-cutting concerns (logging, errors)
- **Utils**: Reusable utilities
- **Config**: Configuration management

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Build TypeScript
```bash
npm run build
```

### 4. Run Application
```bash
npm run start:ts
```

## Development Workflow

### Watch Mode
```bash
# Terminal 1: Watch TypeScript changes
npm run build:watch

# Terminal 2: Run the app
npm run start:ts
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## Adding New Features

### Example: Add a new API endpoint

#### 1. Define Types (types/myfeature.types.ts)
```typescript
export interface MyFeatureRequest {
  id: string;
  name: string;
}

export interface MyFeatureResponse {
  success: boolean;
  data: MyFeature[];
}
```

#### 2. Create Repository (repositories/MyFeatureRepository.ts)
```typescript
export class MyFeatureRepository {
  async getData(): Promise<any> {
    // Database or API calls here
  }
}
```

#### 3. Create Service (services/MyFeatureService.ts)
```typescript
export class MyFeatureService {
  constructor(private repo: MyFeatureRepository) {}
  
  async processData(): Promise<MyFeatureResponse> {
    const rawData = await this.repo.getData();
    // Business logic here
    return { success: true, data: rawData };
  }
}
```

#### 4. Create Routes (routes/myfeature.routes.ts)
```typescript
import { Router } from 'express';
import { MyFeatureService } from '../services/MyFeatureService';
import { asyncHandler } from '../middleware/errors';

const router = Router();
const service = new MyFeatureService();

router.get('/data', asyncHandler(async (req, res) => {
  const result = await service.processData();
  res.json(result);
}));

export default router;
```

#### 5. Register Routes (app.ts)
```typescript
import myFeatureRoutes from './routes/myfeature.routes';
app.use('/api/myfeature', myFeatureRoutes);
```

## Error Handling

All route handlers should use `asyncHandler`:

```typescript
router.get('/endpoint', asyncHandler(async (req, res) => {
  // Errors are automatically caught and formatted
  const result = await service.doSomething();
  res.json(result);
}));
```

Throw custom errors for specific scenarios:

```typescript
import { NotFoundError, ValidationError } from '../middleware/errors';

if (!record) {
  throw new NotFoundError('Record');
}

if (!isValid) {
  throw new ValidationError('Invalid input', { field: 'email' });
}
```

## Logging

Use structured logging:

```typescript
import { Logger } from '../utils/logger';

// Standard logs
Logger.info('Operation completed', { count: 10 });
Logger.error('Operation failed', error, { context: 'data' });

// Service-specific logs
Logger.salesforce('Query executed', { recordCount: 5 });
Logger.database('Connection pool stats', { idle: 3, active: 2 });
Logger.api('POST', '/api/endpoint', { statusCode: 200, duration: '45ms' });
```

## Testing

Create tests alongside your code:

```
services/
  MyFeatureService.ts
  __tests__/
    MyFeatureService.test.ts
```

Example test:

```typescript
import { MyFeatureService } from '../MyFeatureService';

describe('MyFeatureService', () => {
  it('should process data correctly', async () => {
    const service = new MyFeatureService();
    const result = await service.processData();
    expect(result.success).toBe(true);
  });
});
```

## Migration from JavaScript

See [MIGRATION-GUIDE.md](../MIGRATION-GUIDE.md) for detailed migration instructions.

## Best Practices

1. **Keep routes thin** - Only handle HTTP concerns
2. **Put business logic in services** - Reusable and testable
3. **Use repositories for data access** - Isolate external dependencies
4. **Type everything** - Leverage TypeScript's type system
5. **Use async/await** - No callback hell
6. **Log important operations** - Makes debugging easier
7. **Handle errors properly** - Use custom error classes
8. **Write tests** - Especially for services and repositories

