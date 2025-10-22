# Test Suite Quick Start Guide

This guide helps you get started with running and writing tests for the Deployment Assistant application.

## Prerequisites

1. **Install Dependencies**

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..

# Playwright browsers (E2E tests)
npm run pw:install
```

2. **Setup Environment**

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/deploy_assist

# Authentication
JWT_SECRET=your-secret-key
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# E2E Tests
E2E_BASE_URL=http://localhost:8080
```

3. **Start Services**

```bash
# Start PostgreSQL database (if not already running)
# Ensure database is seeded with test data

# Start backend server
npm start  # Runs on port 5000

# In another terminal, start frontend
cd frontend
npm run dev  # Runs on port 8080
```

## Running Tests

### Quick Commands

```bash
# Run ALL tests (fastest for development)
npm test                          # Backend unit + integration tests
cd frontend && npm test          # Frontend component tests
npm run test:e2e                 # E2E tests (requires servers running)

# Run specific test suite
npm run test:integration         # Backend integration tests only
npm run test:e2e -- auth         # Only auth E2E tests

# Run with coverage
npm test                         # Backend coverage (auto-generated)
cd frontend && npm run test:coverage  # Frontend coverage

# Run in watch mode (development)
npm run test:watch               # Backend tests
cd frontend && npm run test:ui  # Frontend tests with UI
```

### Step-by-Step Test Execution

#### 1. Backend Tests (No servers needed)

```bash
# Unit + Integration tests
npm test

# Expected output:
# ✓ tests/unit/validation-rules.spec.js
# ✓ tests/integration/health.spec.js
# ✓ tests/integration/account-history-api.spec.js
# ... (more tests)
# 
# Test Suites: 8 passed, 8 total
# Tests:       45 passed, 45 total
# Coverage:    82.5%
```

#### 2. Frontend Tests (No servers needed)

```bash
cd frontend
npm test

# Expected output:
# ✓ src/components/common/LoadingSpinner.test.tsx
# ✓ src/hooks/useTypeAheadSearch.test.js
# 
# Test Files: 2 passed, 2 total
# Tests:      15 passed, 15 total
```

#### 3. E2E Tests (Requires servers)

```bash
# Make sure both servers are running:
# Terminal 1: npm start (backend on port 5000)
# Terminal 2: cd frontend && npm run dev (frontend on port 8080)

# Run E2E tests
npm run test:e2e

# Expected output:
# Running 25 tests using 1 worker
# ✓ authentication.spec.ts:13:5 › should redirect unauthenticated users
# ✓ navigation.spec.ts:6:5 › navigates to main pages
# ✓ account-history-react.spec.ts:12:5 › should navigate via URL
# ...
# 
# 25 passed (45s)
```

## Writing Your First Test

### 1. Backend Unit Test

Create `tests/unit/my-function.spec.js`:

```javascript
describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

Run: `npm test -- my-function`

### 2. Frontend Component Test

Create `frontend/src/components/MyComponent.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npm test`

### 3. E2E Test

Create `tests/e2e/my-feature.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should work as expected', async ({ page }) => {
    await page.goto('http://localhost:8080/my-feature');
    
    await page.fill('input[name="search"]', 'test');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Results')).toBeVisible();
  });
});
```

Run: `npm run test:e2e -- my-feature`

## Common Issues & Solutions

### Issue: E2E tests fail with "Target closed"

**Solution**: Ensure the server is running
```bash
# Check if server is running
curl http://localhost:8080/health  # Backend + Frontend
```

### Issue: Tests timeout

**Solution**: Increase timeout in test file
```typescript
test('my slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### Issue: Authentication fails in E2E tests

**Solution**: Delete auth cache and retry
```bash
rm -rf .auth/
npm run test:e2e
```

### Issue: Database connection fails

**Solution**: Check PostgreSQL is running and connection string is correct
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

### Issue: Frontend tests fail with module errors

**Solution**: Clear cache and reinstall
```bash
cd frontend
rm -rf node_modules .vite
npm install
npm test
```

## Test Development Workflow

### 1. TDD Approach (Recommended)

```bash
# 1. Write failing test
npm run test:watch  # In terminal 1

# 2. Implement feature
# Edit source files

# 3. Watch tests pass automatically
# Tests re-run on file changes

# 4. Refactor with confidence
# Tests ensure no regression
```

### 2. E2E Development

```bash
# Run E2E tests in headed mode to see what's happening
npm run test:e2e -- --headed

# Debug specific test
npm run test:e2e -- --debug my-test

# Use Playwright Inspector to step through test
# Pauses execution, allows inspection of page state
```

## Test Coverage

View coverage reports after running tests:

```bash
# Backend coverage
npm test
open coverage/index.html

# Frontend coverage  
cd frontend
npm run test:coverage
open coverage/index.html
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
      
      - name: Run backend tests
        run: npm test
        
      - name: Run frontend tests
        run: cd frontend && npm test
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start servers
        run: |
          npm start &
          cd frontend && npm run dev &
          npx wait-on http://localhost:8080
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Next Steps

1. **Read the full documentation**: `tests/README.md`
2. **Explore existing tests**: Look at test files in `tests/` directories
3. **Run tests locally**: Practice with the commands above
4. **Write tests for your features**: Follow the patterns you see
5. **Ask for help**: Reach out to the team if you get stuck

## Useful Commands Cheat Sheet

```bash
# Backend Tests
npm test                    # Run all backend tests
npm run test:watch         # Watch mode
npm run test:integration   # Integration tests only
npm test -- my-test        # Run specific test

# Frontend Tests
cd frontend && npm test                # Run all frontend tests
cd frontend && npm run test:ui        # Watch mode with UI
cd frontend && npm run test:coverage  # With coverage

# E2E Tests
npm run test:e2e                      # Run all E2E tests
npm run test:e2e -- my-test          # Run specific test
npm run test:e2e -- --headed         # See browser
npm run test:e2e -- --debug          # Debug mode

# Coverage
npm test                              # Backend coverage
cd frontend && npm run test:coverage # Frontend coverage

# Playwright
npm run pw:install                    # Install browsers
npx playwright show-report           # View last E2E report
```

## Resources

- Full documentation: [`tests/README.md`](./README.md)
- Playwright docs: https://playwright.dev
- Vitest docs: https://vitest.dev
- React Testing Library: https://testing-library.com/react

## Support

If you encounter issues not covered here:

1. Check the full README: `tests/README.md`
2. Check existing test files for examples
3. Ask the development team
4. File an issue with error details

Happy testing! 🧪

