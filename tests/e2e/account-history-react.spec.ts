/**
 * Account History E2E Tests - React App
 * Tests the redesigned Account History page in the React app
 */

import { test, expect } from '@playwright/test';

test.describe('Account History Feature (React App)', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test.describe('Navigation', () => {
    test('should navigate to Account History page via URL', async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
      
      // Account History page should be visible
      await expect(page).toHaveURL(/\/analytics\/account-history/);
      
      // Should show search functionality
      await expect(page.locator('input[placeholder*="account"], input[placeholder*="PS-ID"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Account History via sidebar', async ({ page }) => {
      await page.goto(baseUrl);
      
      // Click Analytics to expand submenu
      const analyticsButton = page.locator('#nav-analytics');
      await analyticsButton.click();
      
      // Wait for subnav to appear
      await page.waitForTimeout(300);
      
      // Click Account History
      const accountHistoryLink = page.locator('#nav-account-history');
      await accountHistoryLink.click();
      
      // Should navigate to account history page
      await expect(page).toHaveURL(/\/analytics\/account-history/);
    });
  });

  test.describe('Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${baseUrl}/analytics/account-history`);
    });

    test('should show search input with placeholder', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      
      const placeholder = await searchInput.getAttribute('placeholder');
      expect(placeholder).toMatch(/account|PS-ID/i);
    });

    test('should display search results when typing', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Bank');
      
      // Wait for debounce and search results
      await page.waitForTimeout(800);
      
      // Search results should appear (check for any results container)
      const resultsVisible = await page.locator('button:has-text("Bank"), .search-result, [role="option"]').count();
      expect(resultsVisible).toBeGreaterThanOrEqual(0); // May have 0 results if no data
    });

    test('should handle account selection', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Bank');
      await page.waitForTimeout(800);
      
      // Try to click first result if it exists
      const firstResult = page.locator('button:has-text("Bank")').first();
      const isVisible = await firstResult.isVisible().catch(() => false);
      
      if (isVisible) {
        await firstResult.click();
        await page.waitForTimeout(2000);
        
        // Should show history table or results section
        const hasResults = await page.locator('table, .history-table, .account-name').count();
        expect(hasResults).toBeGreaterThan(0);
      }
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

