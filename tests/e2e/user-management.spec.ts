/**
 * User Management E2E Tests
 * Tests the user management and role management UI
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || '';

// Helper function to login
async function login(page: any) {
    await page.goto(`${BASE_URL}/login.html`);
    await page.fill('input[name="username"]', ADMIN_USERNAME);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(BASE_URL + '/');
}

test.describe('User Management UI', () => {
    test('should access user management page', async ({ page }) => {
        await login(page);
        
        // Click User Management
        await page.click('button:has-text("User Management"), #nav-user-mgmt');
        
        // Should navigate to user management page
        await expect(page).toHaveURL(/.*user-management\.html/);
        await expect(page.locator('h1')).toContainText('User Management');
    });

    test('should display list of users', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Should see users table
        await expect(page.locator('table, .users-table')).toBeVisible();
        
        // Should see at least admin user
        await expect(page.locator('text=' + ADMIN_USERNAME)).toBeVisible();
        
        // Should see action buttons
        await expect(page.locator('button:has-text("Edit")')).toBeVisible();
    });

    test('should open create user modal', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click Create User button
        await page.click('button:has-text("Create User"), button:has-text("+ Create User")');
        
        // Should see modal
        await expect(page.locator('#userModal, .modal')).toBeVisible();
        await expect(page.locator('h2:has-text("Create User")')).toBeVisible();
        
        // Should see form fields
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('input[name="full_name"]')).toBeVisible();
    });

    test('should create new user', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create modal
        await page.click('button:has-text("Create User"), button:has-text("+ Create User")');
        await page.waitForSelector('#userModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        const timestamp = Date.now();
        const username = `testuser_${timestamp}`;
        
        // Fill form
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', 'TestPassword123');
        await page.fill('input[name="full_name"]', 'Test User E2E');
        
        // Select user role
        await page.check('input[type="checkbox"][name="roles"]');
        
        // Submit
        await page.click('button:has-text("Create User")');
        
        // Wait for success message
        await page.waitForSelector('.alert-success, text=created successfully', { timeout: 5000 });
        
        // Should see new user in table
        await expect(page.locator(`text=${username}`)).toBeVisible();
        
        // Cleanup: Delete the test user
        await page.locator(`tr:has-text("${username}") button:has-text("Delete")`).click();
        await page.on('dialog', dialog => dialog.accept());
    });

    test('should validate password requirements', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create modal
        await page.click('button:has-text("Create User"), button:has-text("+ Create User")');
        await page.waitForSelector('#userModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Fill form with weak password
        await page.fill('input[name="username"]', 'weakpasswordtest');
        await page.fill('input[name="password"]', 'weak');
        await page.fill('input[name="full_name"]', 'Weak Password Test');
        
        // Select role
        await page.check('input[type="checkbox"][name="roles"]');
        
        // Submit
        await page.click('button:has-text("Create User")');
        
        // Should show error about password
        await expect(page.locator('.alert-error, .error-message')).toContainText(/8 characters|password/i);
    });

    test('should edit existing user', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Find and click edit button for admin user
        await page.locator(`tr:has-text("${ADMIN_USERNAME}") button:has-text("Edit")`).first().click();
        
        // Should see edit modal
        await expect(page.locator('h2:has-text("Edit User")')).toBeVisible();
        
        // Username should be disabled
        const usernameInput = page.locator('input[name="username"]');
        await expect(usernameInput).toBeDisabled();
        
        // Should have existing values
        await expect(usernameInput).toHaveValue(ADMIN_USERNAME);
        
        // Close modal
        await page.click('button:has-text("Cancel")');
    });

    test('should change user password', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click password button
        await page.locator(`tr:has-text("${ADMIN_USERNAME}") button:has-text("Password")`).first().click();
        
        // Should see password modal
        await expect(page.locator('#passwordModal, h2:has-text("Change Password")')).toBeVisible();
        await expect(page.locator('input[name="newPassword"]')).toBeVisible();
        
        // Close modal
        await page.click('button:has-text("Cancel")');
    });
});

test.describe('Role Management UI', () => {
    test('should display list of roles', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Should see roles section
        await expect(page.locator('h2:has-text("Roles")')).toBeVisible();
        
        // Should see roles table
        await expect(page.locator('#rolesTable, table:has-text("Role Name")')).toBeVisible();
        
        // Should see default roles
        await expect(page.locator('text=admin')).toBeVisible();
        await expect(page.locator('text=user')).toBeVisible();
    });

    test('should show system role badge', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Admin role should have system badge
        const adminRow = page.locator('tr:has-text("admin")');
        await expect(adminRow.locator('text=System')).toBeVisible();
        
        // System roles should not have delete button
        await expect(adminRow.locator('button:has-text("Delete")')).not.toBeVisible();
    });

    test('should open create role modal', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click Create Role button
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        
        // Should see modal
        await expect(page.locator('#roleModal, .modal:has-text("Create Role")')).toBeVisible();
        await expect(page.locator('input[name="roleName"]')).toBeVisible();
    });

    test('should create custom role with page selections', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click Create Role
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        await page.waitForSelector('#roleModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        const timestamp = Date.now();
        const roleName = `test_role_${timestamp}`;
        
        // Fill form
        await page.fill('input[name="roleName"]', roleName);
        await page.fill('input[name="roleDescription"]', 'Test Role E2E with Page Access');
        
        // Should see page checkboxes
        await expect(page.locator('#pagesCheckboxes')).toBeVisible();
        
        // Select at least one page (Dashboard)
        const pageCheckboxes = page.locator('input[name="pages"]');
        const dashboardCheckbox = pageCheckboxes.first();
        await dashboardCheckbox.check();
        
        // Submit
        await page.click('button[type="submit"]:has-text("Create Role")');
        
        // Wait for success
        await page.waitForSelector('.alert-success, text=created successfully', { timeout: 5000 });
        
        // Should see new role in table
        await expect(page.locator(`text=${roleName}`)).toBeVisible();
        
        // Should have Custom badge
        const roleRow = page.locator(`tr:has-text("${roleName}")`);
        await expect(roleRow.locator('text=Custom')).toBeVisible();
        
        // Should have Edit Pages button
        await expect(roleRow.locator('button:has-text("Edit Pages")')).toBeVisible();
        
        // Should have delete button
        await expect(roleRow.locator('button:has-text("Delete")')).toBeVisible();
        
        // Cleanup: Delete the test role
        await roleRow.locator('button:has-text("Delete")').click();
        await page.on('dialog', dialog => dialog.accept());
    });

    test('should require at least one page selected when creating role', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click Create Role
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        await page.waitForSelector('#roleModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Fill form
        await page.fill('input[name="roleName"]', 'test_no_pages');
        await page.fill('input[name="roleDescription"]', 'Test Role Without Pages');
        
        // Uncheck all pages
        const pageCheckboxes = page.locator('input[name="pages"]');
        const count = await pageCheckboxes.count();
        for (let i = 0; i < count; i++) {
            await pageCheckboxes.nth(i).uncheck();
        }
        
        // Submit
        await page.click('button[type="submit"]:has-text("Create Role")');
        
        // Should show error about selecting pages
        await expect(page.locator('.alert-error, text=page')).toBeVisible();
    });

    test('should not allow deleting system roles', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Admin role row
        const adminRow = page.locator('tr:has-text("admin")').first();
        
        // Should not have delete button (but should have Edit Pages)
        await expect(adminRow.locator('button:has-text("Delete")')).not.toBeVisible();
        await expect(adminRow.locator('button:has-text("Edit Pages")')).toBeVisible();
        
        // User role row
        const userRow = page.locator('tr:has-text("user")').first();
        
        // Should not have delete button (but should have Edit Pages)
        await expect(userRow.locator('button:has-text("Delete")')).not.toBeVisible();
        await expect(userRow.locator('button:has-text("Edit Pages")')).toBeVisible();
    });

    test('should edit role page assignments', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Click Edit Pages for user role
        const userRow = page.locator('tr:has-text("user")').first();
        await userRow.locator('button:has-text("Edit Pages")').click();
        
        // Should see edit modal
        await expect(page.locator('h2:has-text("Edit Role Pages")')).toBeVisible();
        
        // Role name should be disabled
        const roleNameInput = page.locator('input[name="roleName"]');
        await expect(roleNameInput).toBeDisabled();
        await expect(roleNameInput).toHaveValue('user');
        
        // Should see page checkboxes
        await expect(page.locator('#pagesCheckboxes')).toBeVisible();
        
        // Should have some pages checked
        const checkedPages = page.locator('input[name="pages"]:checked');
        const count = await checkedPages.count();
        expect(count).toBeGreaterThan(0);
        
        // Close modal without changes
        await page.click('button:has-text("Cancel")');
    });
});

test.describe('User Management Security', () => {
    test('should prevent non-admin access to user management', async ({ page }) => {
        // Try to access user management without admin role
        // (This would require creating a non-admin user first, which is complex in E2E)
        // For now, test that the page requires authentication
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Should redirect to login or show access denied
        await page.waitForURL(/.*login\.html/, { timeout: 5000 }).catch(() => {});
        
        const url = page.url();
        expect(url).toMatch(/login\.html|access.*denied/i);
    });

    test('should not allow deleting own account', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Admin row should not have delete button (can't delete self)
        const adminRow = page.locator(`tr:has-text("${ADMIN_USERNAME}")`).first();
        await expect(adminRow.locator('button:has-text("Delete")')).not.toBeVisible();
    });
});

test.describe('User Management Search and Filter', () => {
    test('should filter users by role', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Count total users
        const userRows = page.locator('tbody tr');
        const totalCount = await userRows.count();
        
        expect(totalCount).toBeGreaterThan(0);
        
        // All users should have role badges
        await expect(page.locator('.badge:has-text("admin"), .badge:has-text("user")')).toHaveCount(totalCount);
    });
});

test.describe('Page Entitlements', () => {
    test('should display page checkboxes when creating role', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create role modal
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        await page.waitForSelector('#roleModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Should see page access section
        await expect(page.locator('label:has-text("Page Access")')).toBeVisible();
        await expect(page.locator('#pagesCheckboxes')).toBeVisible();
        
        // Should have multiple pages
        const pageCheckboxes = page.locator('input[name="pages"]');
        const count = await pageCheckboxes.count();
        expect(count).toBeGreaterThanOrEqual(8); // At least 8 top-level pages
    });

    test('should show hierarchical page structure', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create role modal
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        await page.waitForSelector('#roleModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Should see parent pages
        await expect(page.locator('label:has-text("Dashboard")')).toBeVisible();
        await expect(page.locator('label:has-text("Analytics")')).toBeVisible();
        
        // Should see sub-pages (indented)
        const pagesContainer = page.locator('#pagesCheckboxes');
        await expect(pagesContainer.locator('text=Analytics Overview')).toBeVisible();
        await expect(pagesContainer.locator('text=Account History')).toBeVisible();
    });

    test('should save page assignments when creating role', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        const timestamp = Date.now();
        const roleName = `page_test_${timestamp}`;
        
        // Create role with specific pages
        await page.click('button:has-text("Create Role"), button:has-text("+ Create Role")');
        await page.waitForSelector('#roleModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        await page.fill('input[name="roleName"]', roleName);
        await page.fill('input[name="roleDescription"]', 'Test Page Entitlements');
        
        // Select only Dashboard
        const dashboardCheckbox = page.locator('input[name="pages"][value]:has-text(""), input[name="pages"]').first();
        await dashboardCheckbox.check();
        
        await page.click('button[type="submit"]:has-text("Create Role")');
        await page.waitForSelector('.alert-success', { timeout: 5000 });
        
        // Edit to verify pages were saved
        const roleRow = page.locator(`tr:has-text("${roleName}")`);
        await roleRow.locator('button:has-text("Edit Pages")').click();
        
        // At least one page should be checked
        const checkedPages = page.locator('input[name="pages"]:checked');
        const count = await checkedPages.count();
        expect(count).toBeGreaterThan(0);
        
        // Cleanup
        await page.click('button:has-text("Cancel")');
        await roleRow.locator('button:has-text("Delete")').click();
        await page.on('dialog', dialog => dialog.accept());
    });

    test('should get current user accessible pages', async ({ page }) => {
        await login(page);
        
        // Call API to get user's pages
        const response = await page.request.get(`${BASE_URL}/api/users/me/pages`);
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.pages).toBeDefined();
        expect(Array.isArray(data.pages)).toBe(true);
        expect(data.pages.length).toBeGreaterThan(0);
        
        // Admin should have access to user_management page
        const hasUserMgmt = data.pages.some((p: any) => p.name === 'user_management');
        expect(hasUserMgmt).toBe(true);
    });
});

test.describe('Role Assignment', () => {
    test('should show role checkboxes when creating user', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create modal
        await page.click('button:has-text("Create User"), button:has-text("+ Create User")');
        await page.waitForSelector('#userModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Should see role checkboxes
        const roleCheckboxes = page.locator('input[type="checkbox"][name="roles"]');
        const count = await roleCheckboxes.count();
        
        expect(count).toBeGreaterThanOrEqual(2); // At least admin and user roles
    });

    test('should require at least one role selected', async ({ page }) => {
        await login(page);
        await page.goto(`${BASE_URL}/user-management.html`);
        
        // Open create modal
        await page.click('button:has-text("Create User"), button:has-text("+ Create User")');
        await page.waitForSelector('#userModal.show, .modal.show', { timeout: 2000 }).catch(() => {});
        
        // Fill form without selecting roles
        await page.fill('input[name="username"]', 'noroletest');
        await page.fill('input[name="password"]', 'TestPassword123');
        await page.fill('input[name="full_name"]', 'No Role Test');
        
        // Uncheck all roles
        const roleCheckboxes = page.locator('input[type="checkbox"][name="roles"]');
        const count = await roleCheckboxes.count();
        for (let i = 0; i < count; i++) {
            await roleCheckboxes.nth(i).uncheck();
        }
        
        // Submit
        await page.click('button:has-text("Create User")');
        
        // Should show error about roles
        await expect(page.locator('.alert-error, text=role')).toBeVisible();
    });
});

