# E2E Tests Authentication Setup

## Overview
The E2E tests now use a global authentication setup that logs in once before all tests run, and then reuses that authenticated session across all tests. This prevents repeated login attempts and improves test performance.

## How It Works

1. **`auth.setup.ts`**: This file runs once before any tests and:
   - Navigates to the login page
   - Logs in with admin credentials
   - Saves the authentication state to `.auth/user.json`

2. **`playwright.config.ts`**: Configured to:
   - Run the setup project first
   - Use the saved authentication state for all subsequent tests
   - All tests run with an already authenticated session

## Running Tests

```bash
# Run all e2e tests (will automatically run setup first)
npm run test:e2e

# Run specific test file
npm run test:e2e -- account-history

# Run in headed mode (see the browser)
npm run test:e2e -- --headed

# Debug mode
npm run test:e2e -- --debug
```

## Environment Variables

Set these in your `.env` file or environment:

- `E2E_BASE_URL`: Base URL for tests (default: `http://localhost:8080`)
- `DEFAULT_ADMIN_USERNAME`: Admin username (default: `admin`)
- `DEFAULT_ADMIN_PASSWORD`: Admin password (default: `admin123`)

## Troubleshooting

### Login keeps failing
- Ensure the app server is running on port 8080 (old app) or 5173 (new React app)
- Check that the admin credentials are correct
- Delete `.auth/user.json` and let the setup run again

### Tests fail with "not logged in" errors
- Delete `.auth/` folder and run tests again
- Check that `storageState` is properly configured in `playwright.config.ts`

### Authentication state gets stale
- Playwright will automatically re-run setup if `.auth/user.json` doesn't exist
- You can manually delete `.auth/` folder to force a fresh login

