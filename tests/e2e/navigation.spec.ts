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
});

