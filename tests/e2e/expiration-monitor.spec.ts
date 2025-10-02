import { test, expect } from '@playwright/test';

test.describe('Expiration Monitor', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080');
        
        // Navigate to Expiration Monitor page
        await page.click('text=Provisioning');
        await page.click('text=Expiration Monitor');
        
        // Wait for page to load
        await page.waitForSelector('#page-expiration-monitor', { state: 'visible' });
    });

    test('should display expiration monitor page with key elements', async ({ page }) => {
        // Check page title
        await expect(page.locator('h1')).toContainText('Expiration Monitor');
        
        // Check summary cards exist
        await expect(page.locator('#expiration-total')).toBeVisible();
        await expect(page.locator('#expiration-at-risk')).toBeVisible();
        await expect(page.locator('#expiration-extended')).toBeVisible();
        await expect(page.locator('#expiration-accounts')).toBeVisible();
        
        // Check controls exist
        await expect(page.locator('#expiration-window-select')).toBeVisible();
        await expect(page.locator('#show-extended-checkbox')).toBeVisible();
        await expect(page.locator('#refresh-expiration-btn')).toBeVisible();
    });

    test('should display last analyzed timestamp', async ({ page }) => {
        const lastAnalyzed = page.locator('#expiration-last-analyzed');
        await expect(lastAnalyzed).toBeVisible();
        await expect(lastAnalyzed).toContainText('Last analyzed:');
    });

    test('should allow changing expiration window', async ({ page }) => {
        const windowSelect = page.locator('#expiration-window-select');
        
        // Change to 7 days
        await windowSelect.selectOption('7');
        await page.waitForTimeout(500); // Wait for data reload
        
        // Verify selection
        await expect(windowSelect).toHaveValue('7');
        
        // Change to 90 days
        await windowSelect.selectOption('90');
        await page.waitForTimeout(500);
        await expect(windowSelect).toHaveValue('90');
    });

    test('should toggle show extended checkbox', async ({ page }) => {
        const checkbox = page.locator('#show-extended-checkbox');
        
        // Initially should be checked
        await expect(checkbox).toBeChecked();
        
        // Uncheck
        await checkbox.uncheck();
        await page.waitForTimeout(500);
        await expect(checkbox).not.toBeChecked();
        
        // Check again
        await checkbox.check();
        await page.waitForTimeout(500);
        await expect(checkbox).toBeChecked();
    });

    test('should display table or empty state', async ({ page }) => {
        // Either table or empty state should be visible
        const table = page.locator('#expiration-table-body');
        const emptyState = page.locator('#expiration-empty-state');
        
        const tableVisible = await table.isVisible();
        const emptyVisible = await emptyState.isVisible();
        
        // One of them should be visible
        expect(tableVisible || emptyVisible).toBeTruthy();
    });

    test('should show refresh analysis button', async ({ page }) => {
        const refreshBtn = page.locator('#refresh-expiration-btn');
        await expect(refreshBtn).toBeVisible();
        await expect(refreshBtn).toContainText('Refresh Analysis');
    });

    test('should have correct table columns when data exists', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        
        // Check if table has data
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Check table headers
            await expect(page.locator('th:has-text("Account")')).toBeVisible();
            await expect(page.locator('th:has-text("PS Record")')).toBeVisible();
            await expect(page.locator('th:has-text("Expiring Products")')).toBeVisible();
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
            await expect(page.locator('th:has-text("Earliest Expiry")')).toBeVisible();
            await expect(page.locator('th:has-text("Actions")')).toBeVisible();
        }
    });

    test('should open details modal when View Details clicked', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Click first View Details button
            await page.click('button:has-text("View Details")');
            
            // Wait for modal to appear
            const modal = page.locator('#modal-overlay');
            await expect(modal).toBeVisible();
            
            // Check modal has title
            const modalTitle = page.locator('#modal-title');
            await expect(modalTitle).toContainText('Expiring Products');
            
            // Check modal has content
            const modalContent = page.locator('#modal-content');
            await expect(modalContent).not.toBeEmpty();
        }
    });

    test('should close modal when close button clicked', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Open modal
            await page.click('button:has-text("View Details")');
            const modal = page.locator('#modal-overlay');
            await expect(modal).toBeVisible();
            
            // Close modal
            await page.click('#modal-overlay button:has-text("×")');
            await page.waitForTimeout(300);
            
            // Modal should be hidden
            await expect(modal).toHaveCSS('display', 'none');
        }
    });

    test('should display status badges correctly', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Check for status badges (either At-Risk or Extended)
            const statusBadges = page.locator('tr span:has-text("At-Risk"), tr span:has-text("Extended")');
            const badgeCount = await statusBadges.count();
            expect(badgeCount).toBeGreaterThan(0);
        }
    });

    test('should display product category badges with correct colors', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Check for product badges (Models, Data, Apps)
            const productBadges = page.locator('tr span:has-text("Models"), tr span:has-text("Data"), tr span:has-text("Apps")');
            
            // If any product badges exist, verify they have color classes
            const badgeCount = await productBadges.count();
            if (badgeCount > 0) {
                const firstBadge = productBadges.first();
                const classes = await firstBadge.getAttribute('class');
                
                // Should have either red (at-risk), blue (models), green (data), or purple (apps) background
                expect(classes).toMatch(/bg-(red|blue|green|purple)-/);
            }
        }
    });

    test('should refresh analysis when refresh button clicked', async ({ page }) => {
        const refreshBtn = page.locator('#refresh-expiration-btn');
        
        // Click refresh
        await refreshBtn.click();
        
        // Button should show loading state
        await expect(refreshBtn).toContainText('Analyzing');
        
        // Wait for analysis to complete (max 60 seconds)
        await page.waitForSelector('#refresh-expiration-btn:has-text("Refresh Analysis")', { 
            timeout: 60000 
        });
        
        // Verify status updated
        const status = page.locator('#expiration-status');
        await expect(status).not.toContainText('Loading...');
    });

    test('should display console logs for debugging', async ({ page }) => {
        const logs: string[] = [];
        
        // Capture console logs
        page.on('console', msg => {
            if (msg.text().includes('[Expiration]')) {
                logs.push(msg.text());
            }
        });
        
        // Reload page to trigger logs
        await page.reload();
        await page.waitForTimeout(2000);
        
        // Should have some expiration-related logs
        expect(logs.length).toBeGreaterThan(0);
        expect(logs.some(log => log.includes('[Expiration]'))).toBeTruthy();
    });

    test('should handle empty state correctly', async ({ page }) => {
        // If no data, should show empty state
        const emptyState = page.locator('#expiration-empty-state');
        const isVisible = await emptyState.isVisible();
        
        if (isVisible) {
            await expect(emptyState).toContainText('No expiring products found');
            await expect(page.locator('#refresh-empty-btn')).toBeVisible();
        }
    });

    test('should navigate back to provisioning from breadcrumb', async ({ page }) => {
        // Click breadcrumb to go back
        await page.click('text=Provisioning');
        
        // Should be on provisioning page
        await expect(page.locator('#page-provisioning')).toBeVisible();
    });

    test('should have Monitor button in actions column', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Check for Monitor button
            const monitorButtons = page.locator('button:has-text("Monitor")');
            const monitorCount = await monitorButtons.count();
            
            // Should have at least one Monitor button
            expect(monitorCount).toBeGreaterThan(0);
            
            // Verify button has eye icon
            const firstMonitorBtn = monitorButtons.first();
            await expect(firstMonitorBtn).toBeVisible();
            
            // Check button has proper styling
            const classes = await firstMonitorBtn.getAttribute('class');
            expect(classes).toContain('inline-flex');
        }
    });

    test('should navigate to provisioning monitor when Monitor button clicked', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            // Get the PS record name from the first row
            const firstRow = table.locator('tr').first();
            const psRecordCell = firstRow.locator('td:nth-child(2)');
            const psRecordName = await psRecordCell.textContent();
            
            // Click Monitor button
            const monitorBtn = firstRow.locator('button:has-text("Monitor")');
            await monitorBtn.click();
            
            // Wait for navigation to provisioning page
            await page.waitForSelector('#page-provisioning', { state: 'visible', timeout: 5000 });
            
            // Should be on provisioning page
            await expect(page.locator('#page-provisioning')).toBeVisible();
            
            // Wait for search to complete
            await page.waitForTimeout(2000);
            
            // Search input should have PS record name
            const searchInput = page.locator('#provisioning-search');
            const searchValue = await searchInput.inputValue();
            expect(searchValue).toContain(psRecordName?.trim() || '');
        }
    });

    test('should have both View Details and Monitor buttons in each row', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            const firstRow = table.locator('tr').first();
            
            // Should have View Details button
            await expect(firstRow.locator('button:has-text("View Details")')).toBeVisible();
            
            // Should have Monitor button
            await expect(firstRow.locator('button:has-text("Monitor")')).toBeVisible();
            
            // Both buttons should be in the Actions column (last td)
            const actionsCell = firstRow.locator('td:last-child');
            const buttonsInActions = await actionsCell.locator('button').count();
            expect(buttonsInActions).toBe(2);
        }
    });

    test('should display Monitor button tooltip', async ({ page }) => {
        const table = page.locator('#expiration-table-body');
        const hasRows = await table.locator('tr').count() > 0;
        
        if (hasRows) {
            const monitorBtn = page.locator('button:has-text("Monitor")').first();
            
            // Check title attribute
            const title = await monitorBtn.getAttribute('title');
            expect(title).toBe('View in Provisioning Monitor');
        }
    });
});




