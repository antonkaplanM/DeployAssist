import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    headless: true
  },
  projects: [
    // Setup project - runs once before all tests
    { 
      name: 'setup', 
      testMatch: /.*\.setup\.ts/,
    },
    // Main test project - depends on setup
    { 
      name: 'Chromium', 
      use: { 
        ...devices['Desktop Chrome'],
        // Use saved authentication state
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ]
});

