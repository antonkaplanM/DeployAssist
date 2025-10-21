/**
 * Account History E2E Tests - React App Version
 * Tests the redesigned Account History page in the React app
 */

import { test, expect } from '@playwright/test';

test.describe('Account History Feature (React App)', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test.describe('Navigation', () => {
    test('should navigate to Account History page via URL', async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
      
      // Account History page should be visible
      await expect(page.locator('#page-account-history')).toBeVisible();
      
      // Should show empty state initially
      await expect(page.locator('#account-history-empty-state')).toBeVisible();
    });

    test('should navigate to Account History via sidebar', async ({ page }) => {
      await page.goto(baseUrl);
      
      // Click Analytics to expand submenu
      await page.click('#nav-analytics');
      
      // Wait for subnav to appear
      await expect(page.locator('#analytics-subnav')).toBeVisible();
      
      // Click Account History
      await page.click('#nav-account-history');
      
      // Should navigate to account history page
      await expect(page).toHaveURL(/\/analytics\/account-history/);
      await expect(page.locator('#page-account-history')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
    });

    test('should show search input', async ({ page }) => {
      const searchInput = page.locator('#account-history-search');
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toHaveAttribute('placeholder', /account name or PS-ID/i);
    });

    test('should display search results when typing', async ({ page }) => {
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank');
      
      // Wait for debounce and search results
      await page.waitForTimeout(500);
      
      // Search results dropdown should become visible
      const searchResults = page.locator('#account-history-search-results');
      await expect(searchResults).toBeVisible({ timeout: 5000 });
    });

    test('should select account and load history', async ({ page }) => {
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      
      // Click first result
      const firstResult = page.locator('#account-history-search-results button').first();
      await firstResult.click();
      
      // Should show account summary
      await expect(page.locator('#account-summary-section')).toBeVisible({ timeout: 10000 });
      
      // Empty state should be hidden
      await expect(page.locator('#account-history-empty-state')).not.toBeVisible();
    });
  });

  test.describe('Request History Table', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
      
      // Search and select an account
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank');
      await page.waitForTimeout(500);
      
      const firstResult = page.locator('#account-history-search-results button').first();
      await firstResult.click();
      await page.waitForTimeout(2000);
    });

    test('should display request history table', async ({ page }) => {
      await expect(page.locator('#account-history-table-section')).toBeVisible();
      
      // Check for table columns
      const table = page.locator('#account-history-table-section table');
      await expect(table.locator('th:has-text("Select")')).toBeVisible();
      await expect(table.locator('th:has-text("Request ID")')).toBeVisible();
      await expect(table.locator('th:has-text("Date")')).toBeVisible();
      await expect(table.locator('th:has-text("Deployment")')).toBeVisible();
      await expect(table.locator('th:has-text("Status")')).toBeVisible();
      await expect(table.locator('th:has-text("Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Products")')).toBeVisible();
      await expect(table.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should have working deployment filter', async ({ page }) => {
      const filter = page.locator('#deployment-filter');
      await expect(filter).toBeVisible();
      
      // Should have "All Deployments" option
      await expect(filter.locator('option:has-text("All Deployments")')).toBeVisible();
    });

    test('should have working show limit selector', async ({ page }) => {
      const limitSelector = page.locator('#show-limit');
      await expect(limitSelector).toBeVisible();
      
      // Should have limit options
      await expect(limitSelector.locator('option:has-text("Latest 5")')).toBeVisible();
      await expect(limitSelector.locator('option:has-text("Latest 10")')).toBeVisible();
      await expect(limitSelector.locator('option:has-text("All Requests")')).toBeVisible();
      
      // Change to 10
      await limitSelector.selectOption('10');
      await page.waitForTimeout(300);
      
      // Count indicator should update
      await expect(page.locator('#account-history-count-indicator')).toContainText('10');
    });

    test('should have product changes toggle', async ({ page }) => {
      const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: 'Show Product Changes' });
      await expect(checkbox).toBeVisible();
      
      // Should be unchecked by default
      await expect(checkbox).not.toBeChecked();
      
      // Toggle it
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe('Comparison Feature', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
      
      // Search and select an account
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank');
      await page.waitForTimeout(500);
      
      const firstResult = page.locator('#account-history-search-results button').first();
      await firstResult.click();
      await page.waitForTimeout(2000);
    });

    test('should allow selecting requests for comparison', async ({ page }) => {
      const checkboxes = page.locator('table tbody input[type="checkbox"]');
      const count = await checkboxes.count();
      
      if (count >= 2) {
        // Select first checkbox
        await checkboxes.nth(0).check();
        await expect(checkboxes.nth(0)).toBeChecked();
        
        // Select second checkbox
        await checkboxes.nth(1).check();
        await expect(checkboxes.nth(1)).toBeChecked();
        
        // View Side-by-Side button should be enabled
        const compareBtn = page.locator('button:has-text("View Side-by-Side")');
        await expect(compareBtn).toBeEnabled();
      }
    });

    test('should open comparison modal', async ({ page }) => {
      const checkboxes = page.locator('table tbody input[type="checkbox"]');
      const count = await checkboxes.count();
      
      if (count >= 2) {
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        
        const compareBtn = page.locator('button:has-text("View Side-by-Side")');
        await compareBtn.click();
        
        // Modal should appear
        await expect(page.locator('text=Side-by-Side Comparison')).toBeVisible();
        
        // Should have close button
        await expect(page.locator('button').filter({ hasText: 'Close' })).toBeVisible();
      }
    });
  });

  test.describe('Clear Selection', () => {
    test('should clear selection and return to empty state', async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
      
      // Search and select account
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank');
      await page.waitForTimeout(500);
      
      const firstResult = page.locator('#account-history-search-results button').first();
      await firstResult.click();
      await page.waitForTimeout(2000);
      
      // Should show account summary
      await expect(page.locator('#account-summary-section')).toBeVisible();
      
      // Click clear button
      const clearBtn = page.locator('button:has-text("Clear Selection")').first();
      await clearBtn.click();
      
      // Should return to empty state
      await expect(page.locator('#account-history-empty-state')).toBeVisible();
      await expect(page.locator('#account-summary-section')).not.toBeVisible();
      
      // Search input should be cleared
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');
    });
  });
});

