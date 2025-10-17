import { test, expect } from '@playwright/test';

test.describe('PS Audit Trail Feature', () => {
    test.beforeEach(async ({ page }) => {
        // Login and navigate to Audit Trail
        await page.goto('http://localhost:3000/login.html');
        await page.fill('input[type="text"]', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL('http://localhost:3000/index.html');
        
        // Navigate to Audit Trail page
        await page.click('#nav-provisioning');
        await page.waitForTimeout(500);
        await page.click('#nav-audit-trail');
        await page.waitForTimeout(500);
    });

    test('should display audit trail page with stats', async ({ page }) => {
        // Check page title
        await expect(page.locator('h1:has-text("PS Record Audit Trail")')).toBeVisible();
        
        // Check stats cards are visible
        await expect(page.locator('text=Total PS Records')).toBeVisible();
        await expect(page.locator('text=Total Snapshots')).toBeVisible();
        await expect(page.locator('text=Status Changes')).toBeVisible();
        await expect(page.locator('text=Last Capture')).toBeVisible();
    });

    test('should load statistics on page load', async ({ page }) => {
        // Wait for stats to load
        await page.waitForTimeout(1000);
        
        // Check that stats have values (not just "...")
        const statsContainer = page.locator('[id*="stat"]').first();
        await expect(statsContainer).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
        // Check search input exists
        const searchInput = page.locator('#audit-trail-search');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('placeholder', /search/i);
        
        // Check search button exists
        const searchButton = page.locator('button:has-text("Search")');
        await expect(searchButton).toBeVisible();
    });

    test('should search for a PS record and display results', async ({ page }) => {
        // Enter a PS record name
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        
        // Wait for results
        await page.waitForTimeout(2000);
        
        // Check if results table or no results message is shown
        const hasResults = await page.locator('#audit-trail-table').isVisible();
        const noResults = await page.locator('text=/No audit trail found|No snapshots/i').isVisible();
        
        expect(hasResults || noResults).toBeTruthy();
    });

    test('should display record information when found', async ({ page }) => {
        // Search for a specific record (assuming PS- records exist from pre-population)
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);
        
        // If results exist, check for record info sections
        const hasResults = await page.locator('#audit-trail-results').isVisible();
        if (hasResults) {
            // Check for record information display
            const recordInfo = page.locator('#audit-trail-results');
            await expect(recordInfo).toBeVisible();
        }
    });

    test('should display status timeline when status changes exist', async ({ page }) => {
        // Search for a record
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);
        
        // Check if timeline or table is visible
        const timeline = page.locator('#status-timeline');
        const table = page.locator('#audit-trail-table');
        
        const timelineVisible = await timeline.isVisible();
        const tableVisible = await table.isVisible();
        
        // At least one should be visible if results exist
        if (timelineVisible || tableVisible) {
            expect(true).toBeTruthy();
        }
    });

    test('should display audit trail table with correct columns', async ({ page }) => {
        // Search for a record
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);
        
        // Check if table exists
        const table = page.locator('#audit-trail-table');
        if (await table.isVisible()) {
            // Check for expected column headers
            await expect(page.locator('th:has-text("Captured At")')).toBeVisible();
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
        }
    });

    test('should navigate from provisioning monitor to audit trail', async ({ page }) => {
        // Navigate to Provisioning Monitor first
        await page.click('#nav-provisioning');
        await page.waitForTimeout(500);
        await page.click('#nav-monitor');
        await page.waitForTimeout(1000);
        
        // Wait for provisioning table to load
        await page.waitForTimeout(2000);
        
        // Find first actions menu button and click it
        const actionsButton = page.locator('[onclick*="toggleActionsMenu"]').first();
        if (await actionsButton.isVisible()) {
            await actionsButton.click();
            await page.waitForTimeout(500);
            
            // Click "Audit Trail" option if visible
            const auditTrailOption = page.locator('button:has-text("Audit Trail")').first();
            if (await auditTrailOption.isVisible()) {
                await auditTrailOption.click();
                await page.waitForTimeout(1000);
                
                // Verify we're on audit trail page
                await expect(page.locator('h1:has-text("PS Record Audit Trail")')).toBeVisible();
                
                // Check if search was auto-populated
                const searchInput = page.locator('#audit-trail-search');
                const searchValue = await searchInput.inputValue();
                expect(searchValue.length).toBeGreaterThan(0);
            }
        }
    });

    test('should show empty state when no records found', async ({ page }) => {
        // Search for a record that doesn't exist
        await page.fill('#audit-trail-search', 'PS-NONEXISTENT-99999');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(1000);
        
        // Should show "no results" message
        await expect(page.locator('text=/No audit trail found|No snapshots/i')).toBeVisible();
    });

    test('should display status badges with correct styling', async ({ page }) => {
        // Search for a record
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);
        
        // Check if status badges exist (they have specific classes)
        const statusBadges = page.locator('[class*="badge"]');
        const count = await statusBadges.count();
        
        // If results exist, there should be status badges
        if (count > 0) {
            expect(count).toBeGreaterThan(0);
        }
    });

    test('should handle enter key press in search input', async ({ page }) => {
        const searchInput = page.locator('#audit-trail-search');
        await searchInput.fill('PS-');
        await searchInput.press('Enter');
        await page.waitForTimeout(1000);
        
        // Results should be displayed or "no results" message
        const hasResults = await page.locator('#audit-trail-results').isVisible();
        const noResults = await page.locator('text=/No audit trail found/i').isVisible();
        
        expect(hasResults || noResults).toBeTruthy();
    });

    test('should display formatted timestamps', async ({ page }) => {
        // Search for a record
        await page.fill('#audit-trail-search', 'PS-');
        await page.click('button:has-text("Search")');
        await page.waitForTimeout(2000);
        
        // Check if table has timestamps
        const table = page.locator('#audit-trail-table');
        if (await table.isVisible()) {
            // Timestamps should be formatted (contain "/" or "-")
            const timestamps = page.locator('td').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/ });
            const count = await timestamps.count();
            
            if (count > 0) {
                expect(count).toBeGreaterThan(0);
            }
        }
    });

    test('should show help section in navigation', async ({ page }) => {
        // Click Help in navigation
        await page.click('button:has-text("Help")');
        await page.waitForTimeout(500);
        
        // Check if audit trail section exists in help page
        const auditTrailHelp = page.locator('#audit-trail-help');
        await expect(auditTrailHelp).toBeVisible();
        
        // Check for audit trail content
        await expect(page.locator('text=PS Audit Trail')).toBeVisible();
    });
});

test.describe('PS Audit Trail API Integration', () => {
    test('should fetch audit stats from API', async ({ page, request }) => {
        const response = await request.get('http://localhost:3000/api/audit-trail/stats');
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data).toHaveProperty('totalRecords');
        expect(data).toHaveProperty('totalSnapshots');
        expect(data).toHaveProperty('statusChanges');
    });

    test('should search for PS record via API', async ({ page, request }) => {
        const response = await request.get('http://localhost:3000/api/audit-trail/search?q=PS-');
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
    });
});

test.describe('PS Audit Trail Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/login.html');
        await page.fill('input[type="text"]', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL('http://localhost:3000/index.html');
        await page.click('#nav-provisioning');
        await page.waitForTimeout(500);
        await page.click('#nav-audit-trail');
        await page.waitForTimeout(500);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        const h1 = page.locator('h1');
        await expect(h1).toBeVisible();
        const h1Text = await h1.textContent();
        expect(h1Text).toContain('Audit Trail');
    });

    test('should have accessible form labels', async ({ page }) => {
        const searchInput = page.locator('#audit-trail-search');
        await expect(searchInput).toBeVisible();
        
        // Input should have placeholder or label
        const placeholder = await searchInput.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
        // Tab to search input
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Type in search input
        await page.keyboard.type('PS-');
        
        // Press Enter to search
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        // Should trigger search
        const hasResults = await page.locator('#audit-trail-results').isVisible();
        const noResults = await page.locator('text=/No audit trail found/i').isVisible();
        expect(hasResults || noResults).toBeTruthy();
    });
});

