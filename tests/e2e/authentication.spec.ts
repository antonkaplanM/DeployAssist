/**
 * Authentication E2E Tests
 * Tests the login flow, session management, and authentication UI
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '';

test.describe('Authentication Flow', () => {
    test('should redirect unauthenticated users to login page', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Should redirect to login page
        await expect(page).toHaveURL(/.*login\.html/);
        
        // Should see login form
        await expect(page.locator('h1')).toContainText('Sign In');
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login.html`);
        
        await page.fill('input[name="username"]', 'invalid');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        // Should show error message
        await expect(page.locator('.error-message, .alert-error')).toBeVisible();
    });

    test('should successfully login with valid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login.html`);
        
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        
        // Should redirect to home page
        await page.waitForURL(BASE_URL + '/');
        
        // Should see dashboard
        await expect(page.locator('h1, .header')).toContainText(/Dashboard|Deployment Assistant/i);
    });

    test('should show user info in sidebar after login', async ({ page }) => {
        // Login
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Should see username in sidebar
        await expect(page.locator('text=' + ADMIN_USERNAME)).toBeVisible();
        
        // Should see logout button
        await expect(page.locator('button:has-text("Logout"), #nav-logout')).toBeVisible();
    });

    test('should successfully logout', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Click logout
        await page.click('button:has-text("Logout"), #nav-logout');
        
        // Should redirect to login page
        await expect(page).toHaveURL(/.*login\.html/);
        
        // Trying to access home should redirect to login
        await page.goto(BASE_URL);
        await expect(page).toHaveURL(/.*login\.html/);
    });

    test('should persist session with remember me', async ({ page, context }) => {
        await page.goto(`${BASE_URL}/login.html`);
        
        // Check remember me
        await page.check('input[name="rememberMe"]');
        
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Check cookies
        const cookies = await context.cookies();
        const authCookie = cookies.find(c => c.name === 'token');
        
        expect(authCookie).toBeDefined();
        
        // Cookie should have longer expiration (30 days ≈ 2592000 seconds)
        if (authCookie) {
            const now = Date.now() / 1000;
            const expirationTime = authCookie.expires;
            const timeDiff = expirationTime - now;
            
            // Should be close to 30 days (allowing some margin)
            expect(timeDiff).toBeGreaterThan(25 * 24 * 60 * 60); // At least 25 days
        }
    });
});

test.describe('Session Management', () => {
    test('should maintain session across page navigations', async ({ page }) => {
        // Login
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Navigate to different pages
        await page.click('text=Settings');
        await expect(page.locator('h1, h2')).toContainText(/Settings/i);
        
        // Should still be authenticated (username visible)
        await expect(page.locator('text=' + ADMIN_USERNAME)).toBeVisible();
        
        // Go back to dashboard
        await page.click('text=Dashboard');
        await expect(page.locator('h1, .header')).toContainText(/Dashboard/i);
        
        // Should still be authenticated
        await expect(page.locator('text=' + ADMIN_USERNAME)).toBeVisible();
    });

    test('should handle API authentication errors gracefully', async ({ page }) => {
        // Login first
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Clear cookies to simulate session expiration
        await page.context().clearCookies();
        
        // Try to navigate to a protected page
        await page.reload();
        
        // Should redirect to login
        await expect(page).toHaveURL(/.*login\.html/);
    });
});

test.describe('Login Form Validation', () => {
    test('should validate required fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/login.html`);
        
        // Try to submit empty form
        await page.click('button[type="submit"]');
        
        // HTML5 validation or custom validation should prevent submission
        const usernameInput = page.locator('input[name="username"]');
        const passwordInput = page.locator('input[name="password"]');
        
        // Check required attribute or validation message
        await expect(usernameInput).toHaveAttribute('required', '');
        await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('should clear error messages on retry', async ({ page }) => {
        await page.goto(`${BASE_URL}/login.html`);
        
        // First attempt with wrong credentials
        await page.fill('input[name="username"]', 'wrong');
        await page.fill('input[name="password"]', 'wrong');
        await page.click('button[type="submit"]');
        
        // Wait for error
        await page.waitForSelector('.error-message, .alert-error', { timeout: 5000 }).catch(() => {});
        
        // Second attempt
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        
        // Should successfully login
        await page.waitForURL(BASE_URL + '/');
        await expect(page.locator('h1, .header')).toContainText(/Dashboard|Deployment Assistant/i);
    });
});

test.describe('Admin Features', () => {
    test('should show User Management link for admin users', async ({ page }) => {
        // Login as admin
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Should see User Management link in sidebar
        await expect(page.locator('button:has-text("User Management"), #nav-user-mgmt')).toBeVisible();
    });

    test('should show admin role badge', async ({ page }) => {
        // Login as admin
        await page.goto(`${BASE_URL}/login.html`);
        await page.fill('input[name="username"]', ADMIN_USERNAME);
        await page.fill('input[name="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(BASE_URL + '/');
        
        // Should see admin badge in user info
        await expect(page.locator('.badge:has-text("admin"), span:has-text("admin")')).toBeVisible();
    });
});

