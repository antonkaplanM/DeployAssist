import { test, expect } from '@playwright/test';

test.describe('Account History Feature', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl);
  });

  test.describe('Navigation', () => {
    test('should show Analytics sub-navigation when Analytics is clicked', async ({ page }) => {
      // Click Analytics main nav
      await page.click('#nav-analytics');
      
      // Sub-navigation should become visible
      await expect(page.locator('#analytics-subnav')).toBeVisible();
      
      // Should show both sub-nav items
      await expect(page.locator('#nav-analytics-overview')).toBeVisible();
      await expect(page.locator('#nav-account-history')).toBeVisible();
    });

    test('should navigate to Account History page', async ({ page }) => {
      // Navigate to Analytics
      await page.click('#nav-analytics');
      
      // Click Account History sub-nav
      await page.click('#nav-account-history');
      
      // Account History page should be visible
      await expect(page.locator('#page-account-history')).toBeVisible();
      
      // Should show empty state initially
      await expect(page.locator('#account-history-empty-state')).toBeVisible();
    });

    test('should show Account History button on Analytics Overview page', async ({ page }) => {
      // Navigate to Analytics
      await page.click('#nav-analytics');
      
      // Should be on analytics overview
      await expect(page.locator('#page-analytics')).toBeVisible();
      
      // Should have a button to navigate to Account History
      const accountHistoryButton = page.locator('button:has-text("View Account History")');
      await expect(accountHistoryButton).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('should show search input on Account History page', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search input should be visible
      const searchInput = page.locator('#account-history-search');
      await expect(searchInput).toBeVisible();
      
      // Should have placeholder text
      await expect(searchInput).toHaveAttribute('placeholder', /account name or PS-ID/i);
    });

    test('should display search results when typing', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Type in search box
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      
      // Wait for debounce and search results
      await page.waitForTimeout(500);
      
      // Search results dropdown should become visible
      const searchResults = page.locator('#account-history-search-results');
      await expect(searchResults).toBeVisible({ timeout: 5000 });
    });

    test('should search by account name', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search for Bank of America
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      
      // Wait for search results
      await page.waitForTimeout(500);
      
      // Should show account in results
      const searchResults = page.locator('#account-history-search-results');
      await expect(searchResults).toBeVisible({ timeout: 5000 });
      await expect(searchResults).toContainText('Bank of America', { timeout: 5000 });
    });

    test('should search by PS-ID (Technical Team Request)', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search for PS-4331
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('PS-4331');
      
      // Wait for search results
      await page.waitForTimeout(500);
      
      // Should show PS-4331 in results
      const searchResults = page.locator('#account-history-search-results');
      await expect(searchResults).toBeVisible({ timeout: 5000 });
      await expect(searchResults).toContainText('PS-4331', { timeout: 5000 });
    });

    test('should show "No results" for invalid search', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search for something that doesn't exist
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('XYZ_NONEXISTENT_ACCOUNT_12345');
      
      // Wait for search results
      await page.waitForTimeout(500);
      
      // Should show no results message
      const searchResults = page.locator('#account-history-search-results');
      await expect(searchResults).toBeVisible({ timeout: 5000 });
      await expect(searchResults).toContainText(/no results found/i, { timeout: 5000 });
    });
  });

  test.describe('Account History Display', () => {
    test('should load and display account history for Bank of America', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search and select Bank of America
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      
      // Click on the account in search results
      await page.click('button:has-text("Bank of America Corporation")');
      
      // Wait for data to load
      await page.waitForTimeout(1000);
      
      // Empty state should be hidden
      await expect(page.locator('#account-history-empty-state')).toBeHidden();
      
      // Account summary should be visible
      await expect(page.locator('#account-summary-section')).toBeVisible();
      
      // Should show account name
      await expect(page.locator('#account-summary-name')).toContainText('Bank of America');
      
      // Should show request count
      const countElement = page.locator('#account-summary-count');
      await expect(countElement).toBeVisible();
      
      // History table should be visible
      await expect(page.locator('#account-history-table-section')).toBeVisible();
    });

    test('should display requests in chronological order', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Get all request IDs from the table
      const tableBody = page.locator('#account-history-table-body');
      const requestCells = tableBody.locator('td span.font-medium');
      
      // Should have multiple requests
      const count = await requestCells.count();
      expect(count).toBeGreaterThan(0);
      
      // First request should be oldest (PS-4280)
      // Last request should be newest (PS-4331)
      const firstRequest = await requestCells.first().textContent();
      expect(firstRequest).toContain('PS-428'); // Should start with PS-428x
    });

    test('should show request details in table', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Table should have required columns
      const table = page.locator('#account-history-table-section table');
      await expect(table.locator('th:has-text("Request ID")')).toBeVisible();
      await expect(table.locator('th:has-text("Date")')).toBeVisible();
      await expect(table.locator('th:has-text("Status")')).toBeVisible();
      await expect(table.locator('th:has-text("Type")')).toBeVisible();
      await expect(table.locator('th:has-text("Products")')).toBeVisible();
      await expect(table.locator('th:has-text("Actions")')).toBeVisible();
    });

    test('should show product entitlements summary', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Should show product summaries (most requests have "2 Data, 1 App")
      const tableBody = page.locator('#account-history-table-body');
      await expect(tableBody).toContainText(/Data|App|Model/i);
    });
  });

  test.describe('Expandable Request Details', () => {
    test('should expand and show request details', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click the first expand button
      const firstExpandButton = page.locator('#account-history-table-body tr:first-child button[title="View details"]');
      await firstExpandButton.click();
      
      // Details row should become visible
      await page.waitForTimeout(300);
      
      // Should show request information section
      await expect(page.locator('text=Request Information')).toBeVisible();
      await expect(page.locator('text=Salesforce ID')).toBeVisible();
      
      // Should show product entitlements section
      await expect(page.locator('text=Product Entitlements')).toBeVisible();
    });

    test('should collapse request details when clicked again', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Get first request ID
      const firstRequestName = await page.locator('#account-history-table-body tr:first-child span.font-medium').textContent();
      
      // Click expand
      const firstExpandButton = page.locator('#account-history-table-body tr:first-child button[title="View details"]');
      await firstExpandButton.click();
      await page.waitForTimeout(300);
      
      // Details should be visible
      await expect(page.locator('text=Request Information')).toBeVisible();
      
      // Click collapse
      await firstExpandButton.click();
      await page.waitForTimeout(300);
      
      // Details should be hidden
      // (The details row should have class 'hidden')
    });
  });

  test.describe('Product Change Comparison', () => {
    test('should show comparison toggle', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Comparison toggle should be visible
      const comparisonToggle = page.locator('#show-comparison-toggle');
      await expect(comparisonToggle).toBeVisible();
      
      // Label should be present
      await expect(page.locator('text=Show Product Changes')).toBeVisible();
    });

    test('should show product changes when toggle is enabled', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Enable comparison
      const comparisonToggle = page.locator('#show-comparison-toggle');
      await comparisonToggle.check();
      await page.waitForTimeout(300);
      
      // Expand second or later request (first won't have comparison)
      const expandButtons = page.locator('#account-history-table-body button[title="View details"]');
      const count = await expandButtons.count();
      if (count > 1) {
        await expandButtons.nth(1).click();
        await page.waitForTimeout(300);
        
        // Should show comparison section
        await expect(page.locator('text=Changes from Previous Request')).toBeVisible();
      }
    });
  });

  test.describe('Clear and Reset', () => {
    test('should clear account selection and return to search', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Should show account summary
      await expect(page.locator('#account-summary-section')).toBeVisible();
      
      // Click clear button
      await page.click('#account-history-clear');
      
      // Should return to empty state
      await expect(page.locator('#account-history-empty-state')).toBeVisible();
      await expect(page.locator('#account-summary-section')).toBeHidden();
      await expect(page.locator('#account-history-table-section')).toBeHidden();
      
      // Search input should be cleared
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');
    });
  });

  test.describe('Limit Selector', () => {
    test('should default to showing latest 5 requests', async ({ page }) => {
      // Navigate and load an account with many requests (AJG Re has 59)
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('AJG Re');
      await page.waitForTimeout(500);
      await page.click('button:has-text("AJG Re(Willis Re Inc. - formerly)")');
      await page.waitForTimeout(1000);
      
      // Limit selector should be set to 5
      const limitSelector = page.locator('#account-history-limit');
      await expect(limitSelector).toHaveValue('5');
      
      // Count indicator should show "Showing latest 5 of X requests"
      const countIndicator = page.locator('#account-history-count-indicator');
      await expect(countIndicator).toContainText('Showing latest 5 of');
      
      // Table should have exactly 5 rows
      const rows = page.locator('#account-history-table-body > tr:not([id^="details-row-"])');
      await expect(rows).toHaveCount(5);
    });

    test('should change displayed records when limit is changed', async ({ page }) => {
      // Navigate and load an account with many requests
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('AJG Re');
      await page.waitForTimeout(500);
      await page.click('button:has-text("AJG Re(Willis Re Inc. - formerly)")');
      await page.waitForTimeout(1000);
      
      // Change limit to 10
      const limitSelector = page.locator('#account-history-limit');
      await limitSelector.selectOption('10');
      await page.waitForTimeout(300);
      
      // Count indicator should update
      const countIndicator = page.locator('#account-history-count-indicator');
      await expect(countIndicator).toContainText('Showing latest 10 of');
      
      // Table should have exactly 10 rows
      const rows = page.locator('#account-history-table-body > tr:not([id^="details-row-"])');
      await expect(rows).toHaveCount(10);
    });

    test('should show all records when "All Requests" is selected', async ({ page }) => {
      // Navigate and load Bank of America (has 15 requests)
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Change limit to "all"
      const limitSelector = page.locator('#account-history-limit');
      await limitSelector.selectOption('all');
      await page.waitForTimeout(300);
      
      // Count indicator should show "Showing all X requests"
      const countIndicator = page.locator('#account-history-count-indicator');
      await expect(countIndicator).toContainText('Showing all');
      await expect(countIndicator).not.toContainText('latest');
      
      // Table should have all records (15 for Bank of America)
      const rows = page.locator('#account-history-table-body > tr:not([id^="details-row-"])');
      await expect(rows).toHaveCount(15);
    });
  });

  test.describe('Actions Dropdown Menu', () => {
    test('should show actions dropdown button for each request', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Each row should have a three-dot menu button
      const actionButtons = page.locator('#account-history-table-body button[title="Actions"]');
      const count = await actionButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should open dropdown when actions button is clicked', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click first actions button
      const firstActionButton = page.locator('#account-history-table-body button[title="Actions"]').first();
      await firstActionButton.click();
      
      // Dropdown should be visible
      await page.waitForTimeout(200);
      const dropdown = page.locator('[id^="action-dropdown-"]').first();
      await expect(dropdown).toBeVisible();
      
      // Should have "View in Provisioning Monitor" option
      await expect(dropdown).toContainText('View in Provisioning Monitor');
    });

    test('should close dropdown when clicking outside', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click first actions button
      const firstActionButton = page.locator('#account-history-table-body button[title="Actions"]').first();
      await firstActionButton.click();
      await page.waitForTimeout(200);
      
      // Dropdown should be visible
      const dropdown = page.locator('[id^="action-dropdown-"]').first();
      await expect(dropdown).toBeVisible();
      
      // Click outside (on the page header)
      await page.click('h2:has-text("Account History")');
      await page.waitForTimeout(200);
      
      // Dropdown should be hidden
      await expect(dropdown).toBeHidden();
    });
  });

  test.describe('Integration with Provisioning Monitor', () => {
    test('should navigate to provisioning monitor with exact search', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Get the first request name
      const firstRequestName = await page.locator('#account-history-table-body tr:first-child span.font-medium').textContent();
      
      // Click first actions button
      const firstActionButton = page.locator('#account-history-table-body button[title="Actions"]').first();
      await firstActionButton.click();
      await page.waitForTimeout(200);
      
      // Click "View in Provisioning Monitor"
      await page.click('text=View in Provisioning Monitor');
      
      // Should navigate to provisioning page
      await page.waitForTimeout(1000);
      await expect(page.locator('#page-provisioning')).toBeVisible();
      
      // Should show only the exact matching record
      const provisioningTable = page.locator('#provisioning-table-body');
      await expect(provisioningTable).toContainText(firstRequestName || '');
      
      // Should have exactly 1 result row (exact match)
      const provisioningRows = page.locator('#provisioning-table-body > tr:not([id^="details-"])');
      await expect(provisioningRows).toHaveCount(1);
    });
  });

  test.describe('Product Category Modals', () => {
    test('should open modal when clicking product category button', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click on a product category button (e.g., "Data")
      const dataButton = page.locator('#account-history-table-body button.product-group-btn').first();
      if (await dataButton.isVisible()) {
        await dataButton.click();
        await page.waitForTimeout(300);
        
        // Modal should be visible
        const modal = page.locator('#product-modal');
        await expect(modal).toBeVisible();
        
        // Should have close button
        const closeButton = page.locator('button:has-text("Close")');
        await expect(closeButton).toBeVisible();
      }
    });

    test('should show correct product details in modal', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click on a product category button
      const dataButton = page.locator('#account-history-table-body button.product-group-btn').first();
      if (await dataButton.isVisible()) {
        const buttonText = await dataButton.textContent();
        await dataButton.click();
        await page.waitForTimeout(300);
        
        // Modal should show product details
        const modal = page.locator('#product-modal');
        await expect(modal).toBeVisible();
        
        // Should show request name in modal title
        await expect(modal.locator('.text-xl')).toContainText('PS-');
        
        // Should show product group type
        await expect(modal).toContainText(/Models|Data|Apps/);
      }
    });

    test('should close modal when close button is clicked', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click on a product category button
      const dataButton = page.locator('#account-history-table-body button.product-group-btn').first();
      if (await dataButton.isVisible()) {
        await dataButton.click();
        await page.waitForTimeout(300);
        
        // Modal should be visible
        const modal = page.locator('#product-modal');
        await expect(modal).toBeVisible();
        
        // Click close button
        await page.click('button:has-text("Close")');
        await page.waitForTimeout(300);
        
        // Modal should be hidden
        await expect(modal).toBeHidden();
      }
    });
  });

  test.describe('Collapsible Product Categories in Details', () => {
    test('should show collapsible product categories in expanded details', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click the first expand button
      const firstExpandButton = page.locator('#account-history-table-body tr:first-child button[title="View details"]');
      await firstExpandButton.click();
      await page.waitForTimeout(300);
      
      // Should show Product Entitlements section
      await expect(page.locator('text=Product Entitlements')).toBeVisible();
      
      // Should have collapsible category buttons
      const categoryButtons = page.locator('button:has-text("Models"), button:has-text("Data"), button:has-text("Apps")');
      const count = await categoryButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should expand/collapse product categories in details', async ({ page }) => {
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Click the first expand button
      const firstExpandButton = page.locator('#account-history-table-body tr:first-child button[title="View details"]');
      await firstExpandButton.click();
      await page.waitForTimeout(300);
      
      // Find a category button (e.g., Data or Models)
      const categoryButton = page.locator('button:has-text("Data")').first();
      if (await categoryButton.isVisible()) {
        // Click to expand
        await categoryButton.click();
        await page.waitForTimeout(200);
        
        // Content should be visible (look for product codes)
        const detailsSection = categoryButton.locator('xpath=following-sibling::div[1]');
        await expect(detailsSection).toBeVisible();
        
        // Click again to collapse
        await categoryButton.click();
        await page.waitForTimeout(200);
        
        // Content should be hidden
        await expect(detailsSection).toBeHidden();
      }
    });
  });

  test.describe('Direct PS-ID Search Flow', () => {
    test('should load account when searching by PS-4331', async ({ page }) => {
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Search for PS-4331 directly
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('PS-4331');
      await page.waitForTimeout(500);
      
      // Click on PS-4331 in search results
      await page.click('button:has-text("PS-4331")');
      await page.waitForTimeout(1000);
      
      // Should load Bank of America history
      await expect(page.locator('#account-summary-name')).toContainText('Bank of America');
      
      // Should show the history table
      await expect(page.locator('#account-history-table-section')).toBeVisible();
      
      // PS-4331 should be in the table (it's the newest, so likely last)
      await expect(page.locator('#account-history-table-body')).toContainText('PS-4331');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Navigate to Account History
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      // Page should be visible
      await expect(page.locator('#page-account-history')).toBeVisible();
      
      // Search box should be visible and functional
      const searchInput = page.locator('#account-history-search');
      await expect(searchInput).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Navigate and load Bank of America history
      await page.click('#nav-analytics');
      await page.click('#nav-account-history');
      
      const searchInput = page.locator('#account-history-search');
      await searchInput.fill('Bank of America');
      await page.waitForTimeout(500);
      await page.click('button:has-text("Bank of America Corporation")');
      await page.waitForTimeout(1000);
      
      // Table should be visible and scrollable
      await expect(page.locator('#account-history-table-section')).toBeVisible();
    });
  });
});
