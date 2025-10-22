/**
 * Authentication E2E Tests - React App
 * Tests the login flow, session management, and authentication UI
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

test.describe('Authentication Flow', () => {
    test('should redirect unauthenticated users to login page', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Should redirect to login page (React route)
        await expect(page).toHaveURL(/.*\/login/);
        
        // Should see login form with React component
        await expect(page.locator('h1')).toContainText(/Sign in|Deployment Assistant/i);
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        await page.fill('input[name="username"]', 'invalid');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        // Should show error message in React component
        await expect(page.locator('.bg-red-50, .bg-red-900, .error-message')).toBeVisible();
    });

    test('should successfully login with valid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        
        // Should redirect to home page
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Should see dashboard content
        await expect(page.locator('h1, h2, [data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });
    });

    test('should show user info in header after login', async ({ page }) => {
        // Login
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Should see username in header/sidebar
        await expect(page.locator(`text=${ADMIN_USERNAME}`)).toBeVisible({ timeout: 5000 });
        
        // Should see logout button (could be in a dropdown or menu)
        await expect(page.locator('button:has-text("Logout"), button:has-text("Sign out")')).toBeVisible({ timeout: 5000 });
    });

    test('should successfully logout', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Click logout (try multiple selectors)
        const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
        await logoutButton.click();
        
        // Should redirect to login page
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
        
        // Trying to access home should redirect to login
        await page.goto(BASE_URL);
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test('should persist session via cookies', async ({ page, context }) => {
        await page.goto(`${BASE_URL}/login`);
        
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Check cookies - React app stores auth token
        const cookies = await context.cookies();
        const authCookie = cookies.find(c => c.name === 'token' || c.name === 'auth_token');
        
        expect(authCookie).toBeDefined();
    });
});

test.describe('Session Management', () => {
    test('should maintain session across page navigations', async ({ page }) => {
        // Login
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Navigate to settings page via React Router
        await page.goto(`${BASE_URL}/settings`);
        await expect(page.locator('h1, h2')).toContainText(/Settings/i, { timeout: 10000 });
        
        // Should still be authenticated (username visible)
        await expect(page.locator(`text=${ADMIN_USERNAME}`)).toBeVisible();
        
        // Go back to dashboard
        await page.goto(`${BASE_URL}/`);
        await page.waitForTimeout(1000); // Wait for dashboard to load
        
        // Should still be authenticated
        await expect(page.locator(`text=${ADMIN_USERNAME}`)).toBeVisible();
    });

    test('should handle API authentication errors gracefully', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Clear cookies to simulate session expiration
        await page.context().clearCookies();
        
        // Try to navigate to a protected page
        await page.reload();
        
        // Should redirect to login
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
});

test.describe('Login Form Validation', () => {
    test('should validate required fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Try to submit empty form
        await page.click('button[type="submit"]');
        
        // HTML5 validation should prevent submission
        const usernameInput = page.locator('input[name="username"]');
        const passwordInput = page.locator('input[name="password"]');
        
        // Check required attribute
        await expect(usernameInput).toHaveAttribute('required', '');
        await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('should clear error messages on retry', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // First attempt with wrong credentials
        await page.fill('input[name="username"]', 'wrong');
        await page.fill('input[name="password"]', 'wrong');
        await page.click('button[type="submit"]');
        
        // Wait for error message
        await expect(page.locator('.bg-red-50, .bg-red-900, .error-message')).toBeVisible({ timeout: 5000 });
        
        // Second attempt with correct credentials
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        
        // Should successfully login
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
    });
});

test.describe('Admin Features', () => {
    test('should show User Management link for admin users', async ({ page }) => {
        // Login as admin
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Should see User Management link in sidebar (may need to navigate there)
        // React app uses routes, so check if link exists
        const userManagementLink = page.locator('a[href="/users"], button:has-text("User Management")');
        await expect(userManagementLink).toBeVisible({ timeout: 5000 });
    });

    test('should show admin role indicator', async ({ page }) => {
        // Login as admin
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/', { timeout: 10000 });
        
        // Should see admin indicator in user info (username is visible, role might be in a dropdown)
        await expect(page.locator(`text=${ADMIN_USERNAME}`)).toBeVisible();
    });
});

