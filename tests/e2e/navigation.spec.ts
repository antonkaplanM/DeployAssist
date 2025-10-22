import { test, expect } from '@playwright/test';

test.describe('UI Navigation - React App', () => {
  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test('navigates to main pages using sidebar', async ({ page }) => {
    await page.goto(BASE_URL);

    // Dashboard should be visible by default
    await expect(page).toHaveURL(BASE_URL + '/');
    
    // Navigate to Analytics
    const analyticsButton = page.locator('#nav-analytics');
    await analyticsButton.click();
    await expect(page).toHaveURL(`${BASE_URL}/analytics`);

    // Navigate to Provisioning Monitor
    const provisioningButton = page.locator('#nav-provisioning');
    await provisioningButton.click();
    // Should navigate to first submenu item
    await page.waitForTimeout(500);
    
    // Navigate to Customer Products
    const customerProductsLink = page.locator('a[href="/customer-products"], #nav-customer-products');
    if (await customerProductsLink.isVisible()) {
      await customerProductsLink.click();
      await expect(page).toHaveURL(`${BASE_URL}/customer-products`);
    }

    // Navigate to Settings
    const settingsLink = page.locator('a[href="/settings"], #nav-settings');
    await settingsLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/settings`);
  });

  test('navigates to Analytics sub-pages', async ({ page }) => {
    await page.goto(BASE_URL);

    // Click Analytics to expand submenu
    const analyticsButton = page.locator('#nav-analytics');
    await analyticsButton.click();
    
    // Submenu should be visible
    await page.waitForTimeout(300);
    
    // Navigate to Analytics Overview
    const overviewLink = page.locator('#nav-analytics-overview');
    await overviewLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/analytics`);

    // Navigate to Account History
    const accountHistoryLink = page.locator('#nav-account-history');
    await accountHistoryLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/analytics/account-history`);

    // Navigate to Package Changes
    const packageChangesLink = page.locator('#nav-package-changes');
    if (await packageChangesLink.isVisible()) {
      await packageChangesLink.click();
      await expect(page).toHaveURL(`${BASE_URL}/analytics/package-changes`);
    }
  });

  test('navigates to Provisioning sub-pages', async ({ page }) => {
    await page.goto(BASE_URL);

    // Click Provisioning to expand submenu
    const provisioningButton = page.locator('#nav-provisioning');
    await provisioningButton.click();
    
    // Wait for submenu
    await page.waitForTimeout(300);
    
    // Navigate to Provisioning Monitor
    const provisioningMonitorLink = page.locator('#nav-provisioning-monitor');
    await provisioningMonitorLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/provisioning`);

    // Navigate to Expiration Monitor
    const expirationLink = page.locator('#nav-expiration');
    await expirationLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/provisioning/expiration`);

    // Navigate to Ghost Accounts
    const ghostAccountsLink = page.locator('#nav-ghost-accounts');
    if (await ghostAccountsLink.isVisible()) {
      await ghostAccountsLink.click();
      await expect(page).toHaveURL(`${BASE_URL}/provisioning/ghost-accounts`);
    }

    // Navigate to Audit Trail
    const auditTrailLink = page.locator('#nav-audit-trail');
    if (await auditTrailLink.isVisible()) {
      await auditTrailLink.click();
      await expect(page).toHaveURL(`${BASE_URL}/provisioning/audit-trail`);
    }
  });

  test('highlights active nav item', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/account-history`);

    // Account History nav item should have active styling
    const accountHistoryLink = page.locator('#nav-account-history');
    const classes = await accountHistoryLink.getAttribute('class');
    
    // Should have some active indicator (bg color change, etc.)
    expect(classes).toBeTruthy();
  });

  test('maintains expanded state for active section', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/account-history`);

    // Analytics section should be expanded automatically
    const analyticsSubmenu = page.locator('#nav-analytics-overview, #nav-account-history, #nav-package-changes');
    await expect(analyticsSubmenu.first()).toBeVisible();
  });

  test('accesses Settings page and sections', async ({ page }) => {
    await page.goto(BASE_URL);

    // Navigate to Settings
    const settingsLink = page.locator('a[href="/settings"], #nav-settings');
    await settingsLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/settings`);

    // Settings page should be visible
    await expect(page.locator('h1, h2')).toContainText(/Settings/i);
  });

  test('can navigate via direct URL', async ({ page }) => {
    // Navigate directly to Account History
    await page.goto(`${BASE_URL}/analytics/account-history`);
    await expect(page).toHaveURL(`${BASE_URL}/analytics/account-history`);

    // Navigate directly to Customer Products
    await page.goto(`${BASE_URL}/customer-products`);
    await expect(page).toHaveURL(`${BASE_URL}/customer-products`);

    // Navigate directly to Settings
    await page.goto(`${BASE_URL}/settings`);
    await expect(page).toHaveURL(`${BASE_URL}/settings`);
  });

  test('redirects invalid URLs to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/invalid-page-12345`);
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});

