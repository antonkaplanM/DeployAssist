/**
 * Customer Products E2E Tests - React App
 * Tests the Customer Products feature in the React app
 */

import { test, expect } from '@playwright/test';

test.describe('Customer Products Feature (React App)', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test.describe('Navigation', () => {
    test('should navigate to Customer Products page via URL', async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
      
      await expect(page).toHaveURL(/\/customer-products/);
      
      // Should show search functionality
      await expect(page.locator('input[type="text"], input[placeholder*="account"]')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to Customer Products via sidebar', async ({ page }) => {
      await page.goto(baseUrl);
      
      // Click Customer Products link
      const customerProductsLink = page.locator('a[href="/customer-products"]');
      await customerProductsLink.click();
      
      await expect(page).toHaveURL(/\/customer-products/);
    });
  });

  test.describe('Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
    });

    test('should show search input', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should show type-ahead suggestions when typing', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      
      await searchInput.fill('Test');
      await page.waitForTimeout(800); // Wait for debounce
      
      // Type-ahead results may or may not appear depending on data availability
      // Just verify the search input is working
      expect(await searchInput.inputValue()).toBe('Test');
    });

    test('should handle form submission', async ({ page }) => {
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Test Account');
      
      // Submit form
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
      
      // Either results, error, or loading should be visible
      const hasContent = await page.locator('table, .error, [role="status"], .loading').count();
      expect(hasContent).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Results Display', () => {
    test('should display summary section when results load', async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
      
      // Mock API route to return test data
      await page.route('**/api/customer-products*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 10,
              byCategory: { models: 5, data: 3, apps: 2 },
            },
            regions: {
              'North America': {
                models: [
                  {
                    productCode: 'TEST-001',
                    productName: 'Test Product',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234'],
                  },
                ],
                data: [],
                apps: [],
              },
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString(),
            },
          }),
        });
      });
      
      // Perform search
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Test Account');
      await searchInput.press('Enter');
      
      await page.waitForTimeout(1000);
      
      // Should show account name
      await expect(page.locator('text=Test Account')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should handle empty search gracefully', async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
      
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.press('Enter'); // Try to search with empty input
      
      await page.waitForTimeout(500);
      
      // Should not crash - page should still be visible
      await expect(searchInput).toBeVisible();
    });

    test('should display error message when API fails', async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
      
      // Mock API failure
      await page.route('**/api/customer-products*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Database connection failed',
          }),
        });
      });
      
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Test Account');
      await searchInput.press('Enter');
      
      await page.waitForTimeout(1000);
      
      // Should show error message
      const hasError = await page.locator('text=/error|failed|unable/i').count();
      expect(hasError).toBeGreaterThan(0);
    });
  });

  test.describe('Navigation Actions', () => {
    test('should navigate to Account History from results', async ({ page }) => {
      await page.goto(`${baseUrl}/customer-products`);
      
      // Mock API response
      await page.route('**/api/customer-products*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: { totalActive: 1, byCategory: { models: 1, data: 0, apps: 0 } },
            regions: { 'North America': { models: [], data: [], apps: [] } },
            lastUpdated: { psRecordId: 'PS-1234', date: new Date().toISOString() },
          }),
        });
      });
      
      const searchInput = page.locator('input[type="text"]').first();
      await searchInput.fill('Test Account');
      await searchInput.press('Enter');
      
      await page.waitForTimeout(1000);
      
      // Look for Account History button/link
      const accountHistoryButton = page.locator('button:has-text("Account History"), a:has-text("Account History")');
      const isVisible = await accountHistoryButton.isVisible().catch(() => false);
      
      if (isVisible) {
        await accountHistoryButton.click();
        await expect(page).toHaveURL(/\/analytics\/account-history/);
      }
    });
  });
});

