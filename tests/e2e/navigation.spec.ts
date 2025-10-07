import { test, expect } from '@playwright/test';

test.describe('UI Navigation', () => {
  test('navigates to Dashboard, Analytics, Roadmap, Provisioning, Settings', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);

    // Dashboard visible
    await expect(page.locator('#page-dashboard')).toBeVisible();

    // Navigate Analytics
    await page.click('#nav-analytics');
    await expect(page.locator('#page-analytics')).toBeVisible();

    // Navigate Roadmap
    await page.click('#nav-roadmap');
    await expect(page.locator('#page-roadmap')).toBeVisible();

    // Provisioning section toggle and page
    await page.click('#nav-provisioning');
    await expect(page.locator('#page-provisioning')).toBeVisible();

    // Settings
    await page.click('#nav-settings');
    await expect(page.locator('#page-settings')).toBeVisible();
  });

  test('navigates to Analytics sub-pages (Overview and Account History)', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);

    // Navigate to Analytics - should show sub-navigation
    await page.click('#nav-analytics');
    await expect(page.locator('#analytics-subnav')).toBeVisible();
    await expect(page.locator('#page-analytics')).toBeVisible();

    // Navigate to Analytics Overview
    await page.click('#nav-analytics-overview');
    await expect(page.locator('#page-analytics')).toBeVisible();

    // Navigate to Account History
    await page.click('#nav-account-history');
    await expect(page.locator('#page-account-history')).toBeVisible();
  });

  test('accesses Validation Rules from Settings page', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);

    // Navigate to Settings
    await page.click('#nav-settings');
    await expect(page.locator('#page-settings')).toBeVisible();

    // Find and click Validation Rules section toggle
    const validationRulesToggle = page.locator('[data-section="validation-rules"]');
    await expect(validationRulesToggle).toBeVisible();
    await validationRulesToggle.click();

    // Verify Validation Rules content is visible
    await expect(page.locator('#validation-rules-content')).toBeVisible();
    await expect(page.locator('#validation-rules-container')).toBeVisible();
  });
});

