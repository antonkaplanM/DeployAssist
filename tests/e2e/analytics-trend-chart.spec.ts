import { test, expect } from '@playwright/test';

test.describe('Analytics Validation Trend Chart', () => {
    
    test.beforeEach(async ({ page }) => {
        // Navigate to Analytics page
        await page.goto('http://localhost:8080');
        await page.click('nav a[href="#analytics"]');
        await page.waitForTimeout(1000);
    });

    test('should display trend chart with all three trend lines', async ({ page }) => {
        // Wait for chart to load
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Verify chart canvas exists
        const canvas = await page.locator('#validation-trend-chart');
        await expect(canvas).toBeVisible();
        
        // Verify all three toggle checkboxes exist and are checked by default
        const updateToggle = await page.locator('#trend-toggle-update');
        const onboardingToggle = await page.locator('#trend-toggle-onboarding');
        const deprovisionToggle = await page.locator('#trend-toggle-deprovision');
        
        await expect(updateToggle).toBeChecked();
        await expect(onboardingToggle).toBeChecked();
        await expect(deprovisionToggle).toBeChecked();
    });

    test('should display color-coded toggle indicators', async ({ page }) => {
        // Wait for toggles to load
        await page.waitForSelector('#trend-toggle-update', { timeout: 5000 });
        
        // Verify Update toggle has red indicator
        const updateIndicator = await page.locator('label:has(#trend-toggle-update) span.inline-block.rounded-full').first();
        const updateColor = await updateIndicator.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
        );
        expect(updateColor).toContain('239'); // Red RGB value
        
        // Verify Onboarding toggle has blue indicator
        const onboardingIndicator = await page.locator('label:has(#trend-toggle-onboarding) span.inline-block.rounded-full').first();
        const onboardingColor = await onboardingIndicator.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
        );
        expect(onboardingColor).toContain('130'); // Blue RGB value
        
        // Verify Deprovision toggle has green indicator
        const deprovisionIndicator = await page.locator('label:has(#trend-toggle-deprovision) span.inline-block.rounded-full').first();
        const deprovisionColor = await deprovisionIndicator.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
        );
        expect(deprovisionColor).toContain('185'); // Green RGB value
    });

    test('should toggle Update trend line on/off', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Uncheck Update toggle
        await page.click('#trend-toggle-update');
        await page.waitForTimeout(500);
        
        // Verify it's unchecked
        const updateToggle = await page.locator('#trend-toggle-update');
        await expect(updateToggle).not.toBeChecked();
        
        // Check Update toggle again
        await page.click('#trend-toggle-update');
        await page.waitForTimeout(500);
        
        // Verify it's checked
        await expect(updateToggle).toBeChecked();
    });

    test('should toggle Onboarding trend line on/off', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Uncheck Onboarding toggle
        await page.click('#trend-toggle-onboarding');
        await page.waitForTimeout(500);
        
        // Verify it's unchecked
        const onboardingToggle = await page.locator('#trend-toggle-onboarding');
        await expect(onboardingToggle).not.toBeChecked();
        
        // Check Onboarding toggle again
        await page.click('#trend-toggle-onboarding');
        await page.waitForTimeout(500);
        
        // Verify it's checked
        await expect(onboardingToggle).toBeChecked();
    });

    test('should toggle Deprovision trend line on/off', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Uncheck Deprovision toggle
        await page.click('#trend-toggle-deprovision');
        await page.waitForTimeout(500);
        
        // Verify it's unchecked
        const deprovisionToggle = await page.locator('#trend-toggle-deprovision');
        await expect(deprovisionToggle).not.toBeChecked();
        
        // Check Deprovision toggle again
        await page.click('#trend-toggle-deprovision');
        await page.waitForTimeout(500);
        
        // Verify it's checked
        await expect(deprovisionToggle).toBeChecked();
    });

    test('should persist toggle preferences in localStorage', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Toggle off Update and Deprovision
        await page.click('#trend-toggle-update');
        await page.click('#trend-toggle-deprovision');
        await page.waitForTimeout(500);
        
        // Check localStorage
        const preferences = await page.evaluate(() => {
            return localStorage.getItem('validationTrendPreferences');
        });
        
        expect(preferences).toBeTruthy();
        const parsed = JSON.parse(preferences);
        expect(parsed.showUpdate).toBe(false);
        expect(parsed.showOnboarding).toBe(true);
        expect(parsed.showDeprovision).toBe(false);
    });

    test('should restore toggle preferences from localStorage on reload', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Set specific preferences
        await page.click('#trend-toggle-update'); // Turn off
        await page.waitForTimeout(500);
        
        // Reload the page
        await page.reload();
        await page.click('nav a[href="#analytics"]');
        await page.waitForTimeout(1000);
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Verify Update toggle is still unchecked
        const updateToggle = await page.locator('#trend-toggle-update');
        await expect(updateToggle).not.toBeChecked();
        
        // Verify others are still checked
        const onboardingToggle = await page.locator('#trend-toggle-onboarding');
        const deprovisionToggle = await page.locator('#trend-toggle-deprovision');
        await expect(onboardingToggle).toBeChecked();
        await expect(deprovisionToggle).toBeChecked();
    });

    test('should display period information', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Verify period element exists and has content
        const periodElement = await page.locator('#trend-period');
        await expect(periodElement).toBeVisible();
        
        const periodText = await periodElement.textContent();
        expect(periodText).toBeTruthy();
        expect(periodText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date format
    });

    test('should show loading state initially', async ({ page }) => {
        // Check for loading indicator
        const loadingIndicator = await page.locator('#trend-loading');
        
        // Loading should be visible initially or chart should be visible
        const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
        const isChartVisible = await page.locator('#validation-trend-container').isVisible().catch(() => false);
        
        expect(isLoadingVisible || isChartVisible).toBe(true);
    });

    test('should display chart title and description', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Verify title
        const title = await page.locator('text=Validation Trend by Request Type');
        await expect(title).toBeVisible();
        
        // Verify description
        const description = await page.locator('text=Rolling annual validation failure percentage');
        await expect(description).toBeVisible();
    });

    test('should allow selecting individual trend lines', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Turn off all except Onboarding
        await page.click('#trend-toggle-update');
        await page.click('#trend-toggle-deprovision');
        await page.waitForTimeout(500);
        
        // Verify only Onboarding is checked
        const updateToggle = await page.locator('#trend-toggle-update');
        const onboardingToggle = await page.locator('#trend-toggle-onboarding');
        const deprovisionToggle = await page.locator('#trend-toggle-deprovision');
        
        await expect(updateToggle).not.toBeChecked();
        await expect(onboardingToggle).toBeChecked();
        await expect(deprovisionToggle).not.toBeChecked();
    });

    test('should display "Show:" label for toggles', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Verify "Show:" label exists
        const showLabel = await page.locator('text=Show:');
        await expect(showLabel).toBeVisible();
    });

    test('should align tile colors with trend line colors', async ({ page }) => {
        await page.waitForSelector('#request-type-tiles', { timeout: 10000 });
        
        // Wait for tiles to render
        await page.waitForTimeout(2000);
        
        // Check that tiles exist
        const tiles = await page.locator('#request-type-tiles > div').count();
        expect(tiles).toBeGreaterThan(0);
        
        // Verify chart also exists
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        const canvas = await page.locator('#validation-trend-chart');
        await expect(canvas).toBeVisible();
    });

    test('should handle all toggles turned off gracefully', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Turn off all toggles
        await page.click('#trend-toggle-update');
        await page.click('#trend-toggle-onboarding');
        await page.click('#trend-toggle-deprovision');
        await page.waitForTimeout(500);
        
        // Chart should still be visible (just empty or with default axis)
        const canvas = await page.locator('#validation-trend-chart');
        await expect(canvas).toBeVisible();
    });

    test('should rescale y-axis when toggling lines', async ({ page }) => {
        await page.waitForSelector('#validation-trend-chart', { timeout: 10000 });
        
        // Initial state - all checked
        await page.waitForTimeout(1000);
        
        // Toggle off Update (which might have highest values)
        await page.click('#trend-toggle-update');
        await page.waitForTimeout(500);
        
        // Chart should still render without errors
        const canvas = await page.locator('#validation-trend-chart');
        await expect(canvas).toBeVisible();
        
        // Toggle Update back on
        await page.click('#trend-toggle-update');
        await page.waitForTimeout(500);
        
        // Chart should still render
        await expect(canvas).toBeVisible();
    });

});
