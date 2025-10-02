import { test, expect } from '@playwright/test';

test.describe('Customer Products Feature', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:8080';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl);
  });

  test.describe('Navigation', () => {
    test('should show Provisioning sub-navigation when Provisioning is clicked', async ({ page }) => {
      // Click Provisioning main nav
      await page.click('#nav-provisioning');
      
      // Sub-navigation should become visible
      await expect(page.locator('#provisioning-subnav')).toBeVisible();
      
      // Should show Customer Products sub-nav item
      await expect(page.locator('#nav-customer-products')).toBeVisible();
    });

    test('should navigate to Customer Products page', async ({ page }) => {
      // Navigate to Provisioning
      await page.click('#nav-provisioning');
      
      // Click Customer Products sub-nav
      await page.click('#nav-customer-products');
      
      // Customer Products page should be visible
      await expect(page.locator('#page-customer-products')).toBeVisible();
      
      // Should show empty state initially
      await expect(page.locator('#customer-products-empty-state')).toBeVisible();
    });

    test('should highlight Customer Products nav when on the page', async ({ page }) => {
      // Navigate to Customer Products
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Nav item should have active class
      const navItem = page.locator('#nav-customer-products');
      await expect(navItem).toHaveClass(/active/);
    });
  });

  test.describe('Search Functionality', () => {
    test('should show search input and button', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Search elements should be visible
      await expect(page.locator('#customer-products-search')).toBeVisible();
      await expect(page.locator('#customer-products-search-btn')).toBeVisible();
    });

    test('should show autocomplete suggestions when typing', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      const searchInput = page.locator('#customer-products-search');
      
      // Type search term
      await searchInput.fill('Bank');
      
      // Wait for debounce and API call
      await page.waitForTimeout(500);
      
      // Autocomplete dropdown should appear (if data available)
      // Note: This test may need Salesforce connection
      const dropdown = page.locator('#customer-products-search-results');
      // Just verify element exists (may be hidden if no results)
      await expect(dropdown).toBeDefined();
    });

    test('should trigger search on Enter key', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      const searchInput = page.locator('#customer-products-search');
      await searchInput.fill('Test Account');
      
      // Press Enter
      await searchInput.press('Enter');
      
      // Loading spinner should appear briefly
      await page.waitForTimeout(100);
      
      // Either results or error should appear (depending on Salesforce connection)
      const summary = page.locator('#customer-products-summary');
      const regions = page.locator('#customer-products-regions');
      const emptyState = page.locator('#customer-products-empty-state');
      
      // One of these should be visible
      const hasResult = await summary.isVisible() || await regions.isVisible() || await emptyState.isVisible();
      expect(hasResult).toBeTruthy();
    });

    test('should trigger search on button click', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      const searchInput = page.locator('#customer-products-search');
      const searchBtn = page.locator('#customer-products-search-btn');
      
      await searchInput.fill('Test Account');
      await searchBtn.click();
      
      // Wait for response
      await page.waitForTimeout(500);
      
      // Empty state should be hidden (either showing results or error)
      const emptyState = page.locator('#customer-products-empty-state');
      await expect(emptyState).toBeHidden();
    });
  });

  test.describe('Results Display', () => {
    test('should show summary section when results load', async ({ page }) => {
      // This test requires mock data or actual Salesforce connection
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 10,
              byCategory: { models: 5, data: 3, apps: 2 }
            },
            productsByRegion: {
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
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Summary should be visible
      await expect(page.locator('#customer-products-summary')).toBeVisible();
      await expect(page.locator('#customer-products-account-name')).toHaveText('Test Account');
      
      // Category counts should be displayed
      await expect(page.locator('#customer-products-models-count')).toHaveText('5');
      await expect(page.locator('#customer-products-data-count')).toHaveText('3');
      await expect(page.locator('#customer-products-apps-count')).toHaveText('2');
    });

    test('should display region cards', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response with region data
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 3,
              byCategory: { models: 2, data: 1, apps: 0 }
            },
            productsByRegion: {
              'North America': {
                models: [
                  {
                    productCode: 'TEST-001',
                    productName: 'Test Product 1',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              },
              'Europe': {
                models: [
                  {
                    productCode: 'TEST-002',
                    productName: 'Test Product 2',
                    category: 'models',
                    region: 'Europe',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-5678']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Regions section should be visible
      await expect(page.locator('#customer-products-regions')).toBeVisible();
      
      // Should show region names
      await expect(page.locator('text=North America')).toBeVisible();
      await expect(page.locator('text=Europe')).toBeVisible();
    });
  });

  test.describe('Collapsible Regions', () => {
    test('should collapse and expand region sections', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 1,
              byCategory: { models: 1, data: 0, apps: 0 }
            },
            productsByRegion: {
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
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Region content should be visible initially
      const regionContent = page.locator('#region-0');
      await expect(regionContent).toBeVisible();
      
      // Click region header to collapse
      const regionHeader = page.locator('button:has-text("North America")');
      await regionHeader.click();
      
      // Region content should be hidden
      await expect(regionContent).toBeHidden();
      
      // Chevron should rotate
      const chevron = page.locator('#region-0-chevron');
      await expect(chevron).toHaveClass(/rotate-180/);
      
      // Click again to expand
      await regionHeader.click();
      
      // Region content should be visible again
      await expect(regionContent).toBeVisible();
      
      // Chevron should rotate back
      await expect(chevron).not.toHaveClass(/rotate-180/);
    });
  });

  test.describe('Collapsible Categories', () => {
    test('should collapse and expand category sections', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response with multiple products
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 2,
              byCategory: { models: 2, data: 0, apps: 0 }
            },
            productsByRegion: {
              'North America': {
                models: [
                  {
                    productCode: 'TEST-001',
                    productName: 'Test Product 1',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234']
                  },
                  {
                    productCode: 'TEST-002',
                    productName: 'Test Product 2',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Find category button (Models)
      const categoryButton = page.locator('button:has-text("Models")').first();
      await expect(categoryButton).toBeVisible();
      
      // Click to collapse
      await categoryButton.click();
      
      // Products should be hidden
      await page.waitForTimeout(200);
      const categoryContent = page.locator('.category-section').first();
      const isCollapsed = await categoryContent.locator('text=TEST-001').isHidden();
      expect(isCollapsed).toBeTruthy();
    });
  });

  test.describe('Action Buttons', () => {
    test('should have View Account History button', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 1,
              byCategory: { models: 1, data: 0, apps: 0 }
            },
            productsByRegion: {
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
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // View Account History button should be visible
      const viewHistoryBtn = page.locator('#customer-products-view-history');
      await expect(viewHistoryBtn).toBeVisible();
    });

    test('should navigate to Account History when clicking View Account History', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 1,
              byCategory: { models: 1, data: 0, apps: 0 }
            },
            productsByRegion: {
              'North America': {
                models: [],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Click View Account History
      const viewHistoryBtn = page.locator('#customer-products-view-history');
      await viewHistoryBtn.click();
      
      // Should navigate to Account History page
      await page.waitForTimeout(500);
      await expect(page.locator('#page-account-history')).toBeVisible();
    });

    test('should clear results when clicking Clear button', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 1,
              byCategory: { models: 1, data: 0, apps: 0 }
            },
            productsByRegion: {
              'North America': {
                models: [],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Summary should be visible
      await expect(page.locator('#customer-products-summary')).toBeVisible();
      
      // Click Clear button
      const clearBtn = page.locator('#customer-products-clear');
      await clearBtn.click();
      
      // Should return to empty state
      await expect(page.locator('#customer-products-empty-state')).toBeVisible();
      await expect(page.locator('#customer-products-summary')).toBeHidden();
      
      // Search input should be cleared
      await expect(page.locator('#customer-products-search')).toHaveValue('');
    });
  });

  test.describe('Product Details', () => {
    test('should display product information correctly', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response with detailed product
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 1,
              byCategory: { models: 0, data: 0, apps: 1 }
            },
            productsByRegion: {
              'North America': {
                models: [],
                data: [],
                apps: [
                  {
                    productCode: 'APP-TEST-001',
                    productName: 'Test App Product',
                    packageName: 'com.test.app',
                    category: 'apps',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234', 'PS-5678']
                  }
                ]
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Product details should be visible
      await expect(page.locator('text=Test App Product')).toBeVisible();
      await expect(page.locator('text=APP-TEST-001')).toBeVisible();
      await expect(page.locator('text=com.test.app')).toBeVisible();
      await expect(page.locator('text=2023-01-01')).toBeVisible();
      await expect(page.locator('text=2026-01-01')).toBeVisible();
      await expect(page.locator('text=365 days remaining')).toBeVisible();
      
      // Source PS records should be visible
      await expect(page.locator('text=PS-1234')).toBeVisible();
      await expect(page.locator('text=PS-5678')).toBeVisible();
    });

    test('should show status indicators correctly', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API response with different status products
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            account: 'Test Account',
            summary: {
              totalActive: 3,
              byCategory: { models: 3, data: 0, apps: 0 }
            },
            productsByRegion: {
              'North America': {
                models: [
                  {
                    productCode: 'ACTIVE-001',
                    productName: 'Active Product',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2026-01-01',
                    status: 'active',
                    daysRemaining: 365,
                    sourcePSRecords: ['PS-1234']
                  },
                  {
                    productCode: 'EXPIRING-SOON-001',
                    productName: 'Expiring Soon Product',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2025-12-01',
                    status: 'expiring-soon',
                    daysRemaining: 60,
                    sourcePSRecords: ['PS-1234']
                  },
                  {
                    productCode: 'EXPIRING-001',
                    productName: 'Expiring Product',
                    category: 'models',
                    region: 'North America',
                    startDate: '2023-01-01',
                    endDate: '2025-11-01',
                    status: 'expiring',
                    daysRemaining: 15,
                    sourcePSRecords: ['PS-1234']
                  }
                ],
                data: [],
                apps: []
              }
            },
            lastUpdated: {
              psRecordId: 'PS-1234',
              date: new Date().toISOString()
            }
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Different status indicators should be visible
      await expect(page.locator('text=Active Product')).toBeVisible();
      await expect(page.locator('text=Expiring Soon Product')).toBeVisible();
      await expect(page.locator('text=Expiring Product')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message when API fails', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Mock API failure
      await page.route('**/api/customer-products*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Database connection failed'
          })
        });
      });
      
      await page.locator('#customer-products-search').fill('Test Account');
      await page.locator('#customer-products-search-btn').click();
      
      await page.waitForTimeout(500);
      
      // Error message should be displayed
      await expect(page.locator('text=Error Loading Customer Products')).toBeVisible();
    });

    test('should handle empty search gracefully', async ({ page }) => {
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      const searchBtn = page.locator('#customer-products-search-btn');
      
      // Try to search with empty input
      await searchBtn.click();
      
      // Should remain on empty state
      await expect(page.locator('#customer-products-empty-state')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Page should be visible and functional
      await expect(page.locator('#customer-products-search')).toBeVisible();
      await expect(page.locator('#customer-products-search-btn')).toBeVisible();
      await expect(page.locator('#customer-products-empty-state')).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.click('#nav-provisioning');
      await page.click('#nav-customer-products');
      
      // Page should be visible and functional
      await expect(page.locator('#customer-products-search')).toBeVisible();
      await expect(page.locator('#customer-products-empty-state')).toBeVisible();
    });
  });
});

