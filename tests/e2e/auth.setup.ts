/**
 * Global Authentication Setup for E2E Tests
 * This logs in once and saves the authentication state to be reused by all tests
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
  const ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  console.log('🔐 Setting up authentication...');
  console.log('📍 Base URL:', BASE_URL);
  console.log('👤 Username:', ADMIN_USERNAME);
  
  // Navigate to base URL (will redirect to login if not authenticated)
  await page.goto(BASE_URL);
  
  // Wait for login page to load (React app)
  await page.waitForSelector('input[name="username"], [data-testid="login-username"]', { timeout: 10000 });
  
  console.log('📝 Filling in credentials...');
  
  // Fill in credentials (try both old and new selectors)
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  
  await usernameInput.fill(ADMIN_USERNAME);
  await passwordInput.fill(ADMIN_PASSWORD);
  
  console.log('🔘 Clicking submit button...');
  
  // Submit login form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete and dashboard to load
  await page.waitForTimeout(2000); // Give time for auth to process
  
  // Verify we're logged in by checking for dashboard or main content
  await expect(page.locator('#page-dashboard, .dashboard-content, #page-account-history, h1')).toBeVisible({ timeout: 10000 });
  
  console.log('✅ Authentication successful, saving state...');
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Auth state saved to', authFile);
});

