import { test, expect } from '@playwright/test';

test.describe('Help Page', () => {
  test.beforeEach(async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);
    await page.waitForLoadState('networkidle');
  });

  test('help page is accessible via navigation', async ({ page }) => {
    // Click Help navigation
    await page.click('#nav-help');
    
    // Verify page is shown
    await expect(page.locator('#page-help')).toBeVisible();
    
    // Verify page title and content
    await expect(page.locator('h1:has-text("Help & User Guide")')).toBeVisible();
    await expect(page.locator('p:has-text("Complete guide to using the Deployment Assistant")')).toBeVisible();
  });

  test('navigation highlights correctly when help page is active', async ({ page }) => {
    // Navigate to help page
    await page.click('#nav-help');
    
    // Verify help nav item is active
    await expect(page.locator('#nav-help')).toHaveClass(/active/);
    await expect(page.locator('#nav-help')).toHaveClass(/bg-accent/);
    
    // Verify other nav items are not active
    await expect(page.locator('#nav-dashboard')).not.toHaveClass(/active/);
  });

  test('table of contents links work', async ({ page }) => {
    // Navigate to help page
    await page.click('#nav-help');
    await page.waitForSelector('#page-help', { state: 'visible' });
    
    // Test clicking a table of contents link
    await page.click('a[href="#getting-started"]');
    
    // Verify the corresponding section is visible
    await expect(page.locator('#getting-started')).toBeInViewport();
  });

  test('all help sections are present', async ({ page }) => {
    // Navigate to help page
    await page.click('#nav-help');
    await page.waitForSelector('#page-help', { state: 'visible' });
    
    // Check all main sections exist
    const sections = [
      '#getting-started',
      '#dashboard', 
      '#provisioning',
      '#validation',
      '#analytics',
      '#roadmap',
      '#settings',
      '#troubleshooting'
    ];
    
    for (const section of sections) {
      await expect(page.locator(section)).toBeVisible();
    }
  });

  test('help page contains comprehensive content', async ({ page }) => {
    // Navigate to help page
    await page.click('#nav-help');
    await page.waitForSelector('#page-help', { state: 'visible' });
    
    // Check for key content elements within the help page using specific selectors
    await expect(page.locator('#page-help h3:has-text("Data Validation Monitor")')).toBeVisible();
    await expect(page.locator('#page-help h4:has-text("App Quantity Validation")')).toBeVisible();
    await expect(page.locator('#page-help h2:has-text("Provisioning Monitor")')).toBeVisible();
    await expect(page.locator('#page-help h2:has-text("Troubleshooting")')).toBeVisible();
    await expect(page.locator('#page-help h3:has-text("Performance Tips")')).toBeVisible();
  });

  test('help page can navigate back to other pages', async ({ page }) => {
    // Start on dashboard
    await page.click('#nav-dashboard');
    await expect(page.locator('#page-dashboard')).toBeVisible();
    
    // Go to help
    await page.click('#nav-help');
    await expect(page.locator('#page-help')).toBeVisible();
    
    // Go back to dashboard
    await page.click('#nav-dashboard');
    await expect(page.locator('#page-dashboard')).toBeVisible();
    await expect(page.locator('#page-help')).toBeHidden();
  });

  test('help page maintains proper styling', async ({ page }) => {
    // Navigate to help page
    await page.click('#nav-help');
    await page.waitForSelector('#page-help', { state: 'visible' });
    
    // Check for proper styling classes
    await expect(page.locator('#page-help .container')).toBeVisible();
    await expect(page.locator('#page-help section')).toHaveCount(8); // 8 main sections
    
    // Check table of contents styling
    await expect(page.locator('#page-help .grid.grid-cols-1.md\\:grid-cols-2')).toBeVisible();
  });
});
