# Test Suite Documentation

This document describes the testing infrastructure for the Deployment Assistant application, which has been updated to support the new React frontend while maintaining comprehensive backend testing.

## Overview

The test suite is organized into three main categories:

1. **Unit Tests** - Test individual functions, utilities, and components in isolation
2. **Integration Tests** - Test API endpoints and backend service integration
3. **End-to-End (E2E) Tests** - Test complete user workflows in the browser

## Test Structure

```
tests/
├── unit/              # Unit tests (Jest)
│   └── validation-rules.spec.js
├── integration/       # API integration tests (Jest + Supertest)
│   ├── account-history-api.spec.js
│   ├── auth-api.spec.js
│   ├── customer-products-api.spec.js
│   ├── expiration-api.spec.js
│   ├── health.spec.js
│   ├── notifications-api.spec.js
│   ├── package-changes-api.spec.js
│   └── ps-audit-trail-api.spec.js
├── e2e/               # End-to-end tests (Playwright)
│   ├── auth.setup.ts
│   ├── authentication.spec.ts
│   ├── navigation.spec.ts
│   ├── account-history-react.spec.ts
│   ├── customer-products-react.spec.ts
│   ├── expiration-monitor.spec.ts
│   ├── package-changes.spec.ts
│   ├── ps-audit-trail.spec.ts
│   └── ... (other E2E tests)
└── helpers/
    └── env.js

frontend/src/tests/    # Frontend unit/component tests (Vitest)
├── setup.ts           # Test environment setup
├── test-utils.tsx     # Custom render utilities and mocks
└── (component test files alongside source)
```

## Running Tests

### Backend Tests (Jest)

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only integration tests
npm run test:integration

# Run with coverage report
npm run test:ci
```

### Frontend Tests (Vitest)

```bash
# Navigate to frontend directory
cd frontend

# Run all frontend tests
npm test

# Run tests in watch mode (with UI)
npm run test:ui

# Run with coverage
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- account-history

# Run in headed mode (see the browser)
npm run test:e2e -- --headed

# Run in debug mode
npm run test:e2e -- --debug

# Install Playwright browsers (first time only)
npm run pw:install
```

## Frontend Testing Setup

### Vitest Configuration

The frontend uses Vitest for unit and component tests:

- **Test Framework**: Vitest (Vite-native test runner)
- **Component Testing**: React Testing Library
- **Environment**: jsdom (simulates browser DOM)
- **Assertions**: Vitest assertions + jest-dom matchers

### Test Utilities

Located in `frontend/src/tests/test-utils.tsx`, provides:

- `render()` - Custom render function with all providers (Auth, Theme, Toast, Router)
- `mockUser` - Mock authenticated admin user
- `mockLimitedUser` - Mock limited permissions user
- All React Testing Library utilities re-exported

### Example Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Example Hook Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import useMyHook from './useMyHook';

describe('useMyHook', () => {
  it('returns expected value', async () => {
    const { result } = renderHook(() => useMyHook());
    
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

## E2E Testing with Playwright

### Configuration

E2E tests use Playwright configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:8080` (React app via Vite)
- **Browser**: Chromium (can be extended to Firefox, WebKit)
- **Authentication**: Global setup runs once, saves auth state
- **Retries**: 0 (set to 2 for CI environments)

### Authentication Flow

E2E tests use a global authentication setup (`tests/e2e/auth.setup.ts`) that:

1. Logs in once with admin credentials
2. Saves authentication state to `.auth/user.json`
3. All subsequent tests reuse this authenticated session

This approach:
- Speeds up test execution (no repeated logins)
- Reduces flakiness
- More closely mimics real user sessions

### Writing E2E Tests

E2E tests for the React app should:

1. Use React Router URLs (`/analytics/account-history` not `analytics.html`)
2. Use semantic selectors (text, role, label) over IDs when possible
3. Wait for React state updates with appropriate timeouts
4. Handle loading states gracefully

Example:

```typescript
test('navigates to account history', async ({ page }) => {
  await page.goto('http://localhost:8080/analytics/account-history');
  
  // Wait for React to render
  await expect(page.locator('input[placeholder*="account"]')).toBeVisible({ timeout: 10000 });
  
  // Interact with components
  await page.fill('input[type="text"]', 'Bank');
  await page.waitForTimeout(800); // Wait for debounce
});
```

## Integration Tests

Integration tests verify backend API endpoints using Supertest. They:

- Test actual HTTP requests/responses
- Validate API contracts
- Test data flow through the stack
- **Do NOT require the frontend to be running**

The backend APIs serve both the old and new frontend, so these tests remain valid.

### Example Integration Test

```javascript
describe('Account History API', () => {
  it('should search for accounts by name', async () => {
    const response = await request(app)
      .get('/api/provisioning/search')
      .query({ q: 'Bank of America', limit: 20 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.results).toHaveProperty('accounts');
  });
});
```

## Unit Tests

Unit tests focus on testing individual functions and utilities:

- **Validation Rules**: Test business logic for data validation
- **Utility Functions**: Test helper functions
- **Frontend Hooks**: Test React hooks in isolation
- **Frontend Components**: Test React components with mocked dependencies

### Backend Unit Tests

Located in `tests/unit/`, these test pure JavaScript functions:

```javascript
describe('ValidationEngine', () => {
  it('passes when no payload is present', () => {
    const record = { Id: '001', Name: 'NoPayload' };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    expect(result.overallStatus).toBe('PASS');
  });
});
```

### Frontend Unit Tests

Located alongside source files in `frontend/src/`:

```typescript
describe('LoadingSpinner', () => {
  it('renders with custom message', () => {
    render(<LoadingSpinner message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });
});
```

## Environment Variables

### Backend Tests

Set in `.env` or via environment:

- `DEFAULT_ADMIN_USERNAME` - Admin username (default: `admin`)
- `DEFAULT_ADMIN_PASSWORD` - Admin password (default: `admin123`)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens

### E2E Tests

- `E2E_BASE_URL` - Base URL for E2E tests (default: `http://localhost:8080`)
- `DEFAULT_ADMIN_USERNAME` - Admin username for login
- `DEFAULT_ADMIN_PASSWORD` - Admin password for login

## Test Coverage

### Coverage Reports

Backend coverage reports are generated in `coverage/` directory:

```bash
npm test  # Generates coverage automatically
open coverage/index.html  # View HTML report
```

Frontend coverage:

```bash
cd frontend
npm run test:coverage
open coverage/index.html
```

### Coverage Goals

- **Backend API Routes**: > 80%
- **Business Logic (Services)**: > 85%
- **Validation Rules**: > 90%
- **Frontend Components**: > 70%
- **Frontend Hooks**: > 80%

## Continuous Integration

### Running Tests in CI

```bash
# Backend tests (with coverage)
npm run test:ci

# Frontend tests
cd frontend && npm test

# E2E tests (ensure app is running first)
npm start &  # Start backend
cd frontend && npm run dev &  # Start frontend
npm run test:e2e
```

### CI Recommendations

1. Run unit and integration tests in parallel
2. Run E2E tests after successful unit/integration tests
3. Use retries for E2E tests (flakiness)
4. Cache `node_modules` and Playwright browsers
5. Upload test reports and screenshots on failure

## Troubleshooting

### E2E Tests Fail with "Login failed"

- Ensure backend server is running on port 5000
- Ensure frontend server is running on port 8080
- Check admin credentials in `.env`
- Delete `.auth/` folder to force fresh login

### E2E Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check if React components are rendering slowly
- Verify API endpoints are responding

### Integration Tests Fail

- Ensure PostgreSQL database is running
- Check database connection string
- Verify test data is seeded correctly

### Frontend Tests Fail with "Cannot find module"

- Ensure dependencies are installed: `cd frontend && npm install`
- Check import paths are correct
- Verify Vitest configuration

## Best Practices

### E2E Tests

1. **Use semantic selectors** - Prefer text/role/label over IDs
2. **Wait for React** - Use appropriate timeouts for async operations
3. **Mock external APIs** - Use `page.route()` to mock API calls
4. **Keep tests independent** - Each test should work standalone
5. **Test user workflows** - Focus on complete user journeys

### Integration Tests

1. **Test API contracts** - Verify request/response structure
2. **Test error cases** - Include failure scenarios
3. **Keep tests fast** - Mock external services (Salesforce, etc.)
4. **Test data validation** - Verify input validation works

### Unit Tests

1. **Test one thing** - Each test should verify one behavior
2. **Use descriptive names** - Test names should explain what they verify
3. **Mock dependencies** - Isolate the unit under test
4. **Test edge cases** - Include boundary conditions

## Migration Notes

### From Old App to React

The test suite has been updated to support the new React frontend:

✅ **Updated:**
- E2E tests now use React Router URLs (`/analytics/account-history`)
- Added Vitest for frontend component/unit tests
- Updated authentication flow for React login
- Navigation tests updated for React components

✅ **Unchanged:**
- Integration tests (backend APIs unchanged)
- Backend unit tests (validation rules, etc.)
- Test configuration (Jest, Playwright)

❌ **Removed:**
- Old vanilla JS E2E tests (replaced with React versions)
- Tests for deprecated HTML pages

### Running Tests During Migration

During the migration period, you can run both old and new tests:

```bash
# Test old backend (still works)
npm test

# Test new React frontend
cd frontend && npm test

# Test E2E with React app
npm run test:e2e
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)

## Contributing

When adding new features:

1. **Add unit tests** for new functions/components
2. **Add integration tests** for new API endpoints
3. **Add E2E tests** for new user workflows
4. **Update this README** with any new patterns or conventions

## Questions?

For questions about the test suite, contact the development team or refer to the technical documentation in `Technical Documentation/06-Testing/`.

