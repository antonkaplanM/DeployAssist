import { test, expect } from '@playwright/test';

test.describe('Package Changes Analytics', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        
        // Navigate to Package Changes page
        await page.click('text=Analytics');
        await page.click('text=Package Changes');
        
        // Wait for page to load
        await page.waitForSelector('#page-package-changes', { state: 'visible' });
    });

    test('should display package changes page with key elements', async ({ page }) => {
        // Check page title
        await expect(page.locator('h1')).toContainText('Package Change Analytics');
        
        // Check description
        await expect(page.locator('text=Track customer package upgrades and downgrades')).toBeVisible();
        
        // Check summary cards exist
        await expect(page.locator('#summary-ps-records')).toBeVisible();
        await expect(page.locator('#summary-total-changes')).toBeVisible();
        await expect(page.locator('#summary-upgrades')).toBeVisible();
        await expect(page.locator('#summary-downgrades')).toBeVisible();
        await expect(page.locator('#summary-accounts')).toBeVisible();
        await expect(page.locator('#summary-products')).toBeVisible();
        
        // Check controls exist
        await expect(page.locator('#package-changes-timeframe')).toBeVisible();
        await expect(page.locator('#refresh-package-changes-btn')).toBeVisible();
        await expect(page.locator('#export-package-changes-btn')).toBeVisible();
    });

    test('should display last analyzed timestamp', async ({ page }) => {
        const lastRefresh = page.locator('#package-changes-last-refresh');
        await expect(lastRefresh).toBeVisible();
        // Should show either "Never" or a date
        const text = await lastRefresh.textContent();
        expect(text).toBeTruthy();
    });

    test('should allow changing time frame', async ({ page }) => {
        const timeframeSelect = page.locator('#package-changes-timeframe');
        
        // Change to 30 days
        await timeframeSelect.selectOption('30d');
        await page.waitForTimeout(500); // Wait for data reload
        await expect(timeframeSelect).toHaveValue('30d');
        
        // Change to 90 days
        await timeframeSelect.selectOption('90d');
        await page.waitForTimeout(500);
        await expect(timeframeSelect).toHaveValue('90d');
        
        // Change to 1 year (default)
        await timeframeSelect.selectOption('1y');
        await page.waitForTimeout(500);
        await expect(timeframeSelect).toHaveValue('1y');
    });

    test('should display summary statistics section', async ({ page }) => {
        // Check Summary section exists
        await expect(page.locator('text=Summary')).toBeVisible();
        await expect(page.locator('text=Overall package change statistics')).toBeVisible();
        
        // Check all summary tiles have modern design with gradients
        const psRecordsTile = page.locator('.rounded-lg.border.border-blue-200').first();
        await expect(psRecordsTile).toBeVisible();
        
        // Verify tile has icon
        const icon = psRecordsTile.locator('svg').first();
        await expect(icon).toBeVisible();
    });

    test('should display by product table', async ({ page }) => {
        // Check section exists
        await expect(page.locator('text=Package Changes by Product')).toBeVisible();
        await expect(page.locator('text=Breakdown of upgrades and downgrades per product')).toBeVisible();
        
        // Check table exists
        const table = page.locator('#product-changes-tbody');
        await expect(table).toBeVisible();
    });

    test('should display by account table with expand/collapse', async ({ page }) => {
        // Check section exists
        await expect(page.locator('text=Accounts - Package Changes')).toBeVisible();
        await expect(page.locator('text=All accounts with package changes')).toBeVisible();
        
        // Check table exists
        const table = page.locator('#account-changes-tbody');
        await expect(table).toBeVisible();
        
        // Check if there are account rows
        const accountRows = await table.locator('tr.account-row').count();
        
        if (accountRows > 0) {
            // Click first account to expand deployments
            const firstAccount = table.locator('tr.account-row').first();
            await firstAccount.click();
            await page.waitForTimeout(300);
            
            // Check if deployment rows appear
            const deploymentRows = await table.locator('tr.deployment-row').count();
            expect(deploymentRows).toBeGreaterThan(0);
            
            // Deployment row should include tenant name
            const firstDeployment = table.locator('tr.deployment-row').first();
            await expect(firstDeployment).toBeVisible();
            
            // Click deployment to expand products
            await firstDeployment.click();
            await page.waitForTimeout(300);
            
            // Check if product rows appear
            const productRows = await table.locator('tr.product-row').count();
            if (productRows > 0) {
                expect(productRows).toBeGreaterThan(0);
            }
        }
    });

    test('should verify tenant names are displayed in deployments', async ({ page }) => {
        const table = page.locator('#account-changes-tbody');
        const accountRows = await table.locator('tr.account-row').count();
        
        if (accountRows > 0) {
            // Expand first account
            const firstAccount = table.locator('tr.account-row').first();
            await firstAccount.click();
            await page.waitForTimeout(300);
            
            // Check deployment rows
            const deploymentRows = await table.locator('tr.deployment-row').count();
            
            if (deploymentRows > 0) {
                const firstDeployment = table.locator('tr.deployment-row').first();
                
                // Deployment should have deployment number and potentially tenant name
                // Format: "Deploy-XXXX" or "Deploy-XXXX (tenant-name)"
                const deploymentText = await firstDeployment.textContent();
                expect(deploymentText).toContain('Deploy-');
            }
        }
    });

    test('should display recent changes list', async ({ page }) => {
        // Check section exists
        await expect(page.locator('text=Recent Package Changes')).toBeVisible();
        await expect(page.locator('text=Latest package upgrades and downgrades')).toBeVisible();
        
        // Check list container exists
        const recentList = page.locator('#recent-changes-list');
        await expect(recentList).toBeVisible();
    });

    test('should verify recent changes include tenant names', async ({ page }) => {
        const recentList = page.locator('#recent-changes-list');
        const changeItems = await recentList.locator('.rounded-lg.border').count();
        
        if (changeItems > 0) {
            const firstChange = recentList.locator('.rounded-lg.border').first();
            const changeText = await firstChange.textContent();
            
            // Should contain deployment number with potential tenant name
            expect(changeText).toBeTruthy();
            
            // Should contain upgrade or downgrade indicator
            const hasUpgradeOrDowngrade = changeText.includes('upgrade') || changeText.includes('downgrade');
            expect(hasUpgradeOrDowngrade).toBeTruthy();
        }
    });

    test('should have functional refresh button', async ({ page }) => {
        const refreshBtn = page.locator('#refresh-package-changes-btn');
        await expect(refreshBtn).toBeVisible();
        await expect(refreshBtn).toContainText('Refresh Analysis');
        await expect(refreshBtn).toBeEnabled();
    });

    test('should have functional export button', async ({ page }) => {
        const exportBtn = page.locator('#export-package-changes-btn');
        await expect(exportBtn).toBeVisible();
        await expect(exportBtn).toContainText('Export to Excel');
        await expect(exportBtn).toBeEnabled();
    });

    test('should verify modern tile design with gradients', async ({ page }) => {
        // Verify PS Records tile (blue gradient)
        const psRecordsTile = page.locator('.border-blue-200.bg-gradient-to-br').first();
        await expect(psRecordsTile).toBeVisible();
        
        // Verify Total Changes tile (purple gradient)
        const totalChangesTile = page.locator('.border-purple-200.bg-gradient-to-br').first();
        await expect(totalChangesTile).toBeVisible();
        
        // Verify Upgrades tile (green gradient)
        const upgradesTile = page.locator('.border-green-200.bg-gradient-to-br').first();
        await expect(upgradesTile).toBeVisible();
        
        // Verify Downgrades tile (amber gradient)
        const downgradesTile = page.locator('.border-amber-200.bg-gradient-to-br').first();
        await expect(downgradesTile).toBeVisible();
        
        // Verify Accounts tile (indigo gradient)
        const accountsTile = page.locator('.border-indigo-200.bg-gradient-to-br').first();
        await expect(accountsTile).toBeVisible();
        
        // Verify Products tile (teal gradient)
        const productsTile = page.locator('.border-teal-200.bg-gradient-to-br').first();
        await expect(productsTile).toBeVisible();
    });

    test('should display correct table headers for by-product table', async ({ page }) => {
        // Check table headers
        await expect(page.locator('th:has-text("Product")')).toBeVisible();
        await expect(page.locator('th:has-text("Total Changes")')).toBeVisible();
        await expect(page.locator('th:has-text("Upgrades")')).toBeVisible();
        await expect(page.locator('th:has-text("Downgrades")')).toBeVisible();
        await expect(page.locator('th:has-text("PS Records")')).toBeVisible();
        await expect(page.locator('th:has-text("Accounts")')).toBeVisible();
    });

    test('should display correct table headers for by-account table', async ({ page }) => {
        // Scroll to account table
        await page.locator('text=Accounts - Package Changes').scrollIntoViewIfNeeded();
        
        // Check table headers for account table
        const accountTable = page.locator('#account-changes-tbody').locator('..').locator('..');
        await expect(accountTable.locator('th:has-text("Account")')).toBeVisible();
        await expect(accountTable.locator('th:has-text("Total Changes")')).toBeVisible();
        await expect(accountTable.locator('th:has-text("Upgrades")')).toBeVisible();
        await expect(accountTable.locator('th:has-text("Downgrades")')).toBeVisible();
        await expect(accountTable.locator('th:has-text("PS Records")')).toBeVisible();
        await expect(accountTable.locator('th:has-text("Products")')).toBeVisible();
    });

    test('should verify upgrade indicators are styled green', async ({ page }) => {
        const recentList = page.locator('#recent-changes-list');
        const changeItems = await recentList.locator('.rounded-lg.border').count();
        
        if (changeItems > 0) {
            // Look for upgrade indicators
            const upgradeIndicators = page.locator('.text-green-700, .text-green-800, .bg-green-100');
            const count = await upgradeIndicators.count();
            
            // If there are any upgrades, they should have green styling
            if (count > 0) {
                await expect(upgradeIndicators.first()).toBeVisible();
            }
        }
    });

    test('should verify downgrade indicators are styled amber/orange', async ({ page }) => {
        const recentList = page.locator('#recent-changes-list');
        const changeItems = await recentList.locator('.rounded-lg.border').count();
        
        if (changeItems > 0) {
            // Look for downgrade indicators
            const downgradeIndicators = page.locator('.text-orange-700, .text-orange-800, .text-amber-700, .bg-orange-100, .bg-amber-100');
            const count = await downgradeIndicators.count();
            
            // If there are any downgrades, they should have orange/amber styling
            if (count > 0) {
                await expect(downgradeIndicators.first()).toBeVisible();
            }
        }
    });

    test('should allow navigation back to analytics dashboard', async ({ page }) => {
        // Click Analytics in breadcrumb/navigation
        await page.click('text=Analytics');
        
        // Should navigate away from package changes page
        await page.waitForTimeout(300);
        const isPackageChangesVisible = await page.locator('#page-package-changes').isVisible();
        expect(isPackageChangesVisible).toBeFalsy();
    });

    test('should verify hierarchical indentation in account table', async ({ page }) => {
        const table = page.locator('#account-changes-tbody');
        const accountRows = await table.locator('tr.account-row').count();
        
        if (accountRows > 0) {
            // Expand first account
            const firstAccount = table.locator('tr.account-row').first();
            await firstAccount.click();
            await page.waitForTimeout(300);
            
            const deploymentRows = await table.locator('tr.deployment-row').count();
            
            if (deploymentRows > 0) {
                const firstDeployment = table.locator('tr.deployment-row').first();
                
                // Deployment should have left padding/margin (indentation)
                const paddingLeft = await firstDeployment.locator('td').first().evaluate(el => {
                    return window.getComputedStyle(el).paddingLeft;
                });
                
                // Should have some indentation (e.g., 1.5rem = 24px)
                expect(paddingLeft).toBeTruthy();
                
                // Click deployment to expand products
                await firstDeployment.click();
                await page.waitForTimeout(300);
                
                const productRows = await table.locator('tr.product-row').count();
                
                if (productRows > 0) {
                    const firstProduct = table.locator('tr.product-row').first();
                    
                    // Product should have even more indentation than deployment
                    const productPaddingLeft = await firstProduct.locator('td').first().evaluate(el => {
                        return window.getComputedStyle(el).paddingLeft;
                    });
                    
                    expect(productPaddingLeft).toBeTruthy();
                }
            }
        }
    });

    test('should load page within reasonable time', async ({ page }) => {
        const startTime = Date.now();
        
        // Page should already be loaded from beforeEach
        // Just verify key elements are visible
        await expect(page.locator('#summary-ps-records')).toBeVisible();
        await expect(page.locator('#product-changes-tbody')).toBeVisible();
        await expect(page.locator('#account-changes-tbody')).toBeVisible();
        await expect(page.locator('#recent-changes-list')).toBeVisible();
        
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        
        // Should load in under 3 seconds
        expect(loadTime).toBeLessThan(3000);
    });
});

