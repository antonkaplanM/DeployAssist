import { test, expect } from '@playwright/test';

test.describe('Validation Monitoring Dashboard Tile', () => {
  test('displays validation monitoring tile on dashboard', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);

    // Verify we're on the dashboard
    await expect(page.locator('#page-dashboard')).toBeVisible();

    // Check that the validation monitoring tile is present on the dashboard
    await expect(page.locator('#page-dashboard h2:has-text("Data Validation Monitor")')).toBeVisible();
    
    // Verify the time frame selector is present with correct options
    const timeFrameSelect = page.locator('#time-frame-select');
    await expect(timeFrameSelect).toBeVisible();
    
    // Check all time frame options are available
    await expect(timeFrameSelect.locator('option[value="1d"]')).toHaveText('Last 1 Day');
    await expect(timeFrameSelect.locator('option[value="1w"]')).toHaveText('Last 1 Week');
    await expect(timeFrameSelect.locator('option[value="1m"]')).toHaveText('Last 1 Month');
    await expect(timeFrameSelect.locator('option[value="1y"]')).toHaveText('Last 1 Year');
    
    // Verify 1w is selected by default
    await expect(timeFrameSelect).toHaveValue('1w');
    
    // Check that validation status section is present
    await expect(page.locator('#validation-status')).toBeVisible();
  });

  test('time frame selector changes trigger API calls', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);

    // Listen for API calls
    let apiCallCount = 0;
    let lastApiCall = '';
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/validation/errors')) {
        apiCallCount++;
        lastApiCall = url;
      }
    });

    // Wait for initial load
    await page.waitForTimeout(1000);
    
    // Change time frame to 1 day
    await page.selectOption('#time-frame-select', '1d');
    await page.waitForTimeout(500);
    
    // Verify API was called with correct parameter
    expect(lastApiCall).toContain('timeFrame=1d');
    
    // Change to 1 month
    await page.selectOption('#time-frame-select', '1m');
    await page.waitForTimeout(500);
    
    // Verify API was called with new parameter
    expect(lastApiCall).toContain('timeFrame=1m');
    
    // Should have made at least 2 API calls (initial + 2 changes)
    expect(apiCallCount).toBeGreaterThanOrEqual(2);
  });

  test('handles no validation errors state correctly', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    
    // Mock the API response for no errors
    await page.route('**/api/validation/errors*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          errors: [],
          summary: {
            totalRecords: 50,
            validRecords: 50,
            invalidRecords: 0,
            timeFrame: '1w',
            enabledRulesCount: 3
          }
        })
      });
    });
    
    await page.goto(base);
    
    // Wait for the API call to complete
    await page.waitForTimeout(1000);
    
    // Check that success state is displayed
    await expect(page.getByText('No validation failures found')).toBeVisible();
    await expect(page.getByText('All 50 PS records from the last week passed validation')).toBeVisible();
    
    // Verify that validation errors section is hidden
    await expect(page.locator('#validation-errors')).toHaveClass(/hidden/);
  });

  test('displays validation errors when present', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    
    // Mock the API response with validation errors
    await page.route('**/api/validation/errors*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          errors: [
            {
              recordId: 'PS-001',
              recordName: 'Test PS Request 1',
              account: 'Test Account A',
              requestType: 'Provisioning',
              createdDate: '2025-01-20T10:00:00Z',
              failedRules: [
                {
                  ruleId: 'app-quantity-validation',
                  ruleName: 'App Quantity Validation',
                  message: 'App1: quantity 5, expected 1 or IC-DATABRIDGE',
                  details: {}
                }
              ]
            },
            {
              recordId: 'PS-002',
              recordName: 'Test PS Request 2',
              account: 'Test Account B',
              requestType: 'Deployment',
              createdDate: '2025-01-21T14:30:00Z',
              failedRules: [
                {
                  ruleId: 'model-count-validation',
                  ruleName: 'Model Count Validation',
                  message: 'Model count 150 exceeds limit of 100',
                  details: {}
                }
              ]
            }
          ],
          summary: {
            totalRecords: 25,
            validRecords: 23,
            invalidRecords: 2,
            timeFrame: '1w',
            enabledRulesCount: 3
          }
        })
      });
    });
    
    await page.goto(base);
    
    // Wait for the API call to complete
    await page.waitForTimeout(1000);
    
    // Check that error state is displayed
    await expect(page.getByText('2 validation errors found')).toBeVisible();
    await expect(page.getByText('2 of 25 PS records from the last week failed validation')).toBeVisible();
    
    // Verify that validation errors section is visible
    await expect(page.locator('#validation-errors')).not.toHaveClass(/hidden/);
    
    // Check that individual error details are shown
    await expect(page.getByText('Test PS Request 1')).toBeVisible();
    await expect(page.getByText('Test Account A')).toBeVisible();
    await expect(page.getByText('App Quantity Validation:')).toBeVisible();
    await expect(page.getByText('App1: quantity 5, expected 1 or IC-DATABRIDGE')).toBeVisible();
    
    await expect(page.getByText('Test PS Request 2')).toBeVisible();
    await expect(page.getByText('Test Account B')).toBeVisible();
    await expect(page.getByText('Model Count Validation:')).toBeVisible();
    await expect(page.getByText('Model count 150 exceeds limit of 100')).toBeVisible();
    
    // Check that "View Record" buttons are present on dashboard
    const viewButtons = page.locator('#page-dashboard').getByRole('button', { name: 'View Record' });
    await expect(viewButtons).toHaveCount(2);
  });

  test('handles API error states gracefully', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    
    // Mock API failure
    await page.route('**/api/validation/errors*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Database connection failed'
        })
      });
    });
    
    await page.goto(base);
    
    // Wait for the API call to complete
    await page.waitForTimeout(1000);
    
    // Check that error state is displayed on dashboard
    await expect(page.locator('#page-dashboard').getByText('Unable to load validation data')).toBeVisible();
    await expect(page.getByText('Database connection failed')).toBeVisible();
    
    // Verify that validation errors section is hidden
    await expect(page.locator('#validation-errors')).toHaveClass(/hidden/);
  });

  test('handles authentication required state', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    
    // Mock authentication required response
    await page.route('**/api/validation/errors*', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'No valid Salesforce authentication found. Please authenticate via /auth/salesforce'
        })
      });
    });
    
    await page.goto(base);
    
    // Wait for the API call to complete
    await page.waitForTimeout(1000);
    
    // Check that authentication error is displayed on dashboard
    await expect(page.locator('#page-dashboard').getByText('Unable to load validation data')).toBeVisible();
    await expect(page.locator('#page-dashboard').getByText(/Salesforce authentication/)).toBeVisible();
  });

  test('view record button functionality', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    
    // Mock the API response with validation errors
    await page.route('**/api/validation/errors*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          errors: [
            {
              recordId: 'PS-TEST-001',
              recordName: 'Test PS Request',
              account: 'Test Account',
              requestType: 'Provisioning',
              createdDate: '2025-01-20T10:00:00Z',
              failedRules: [
                {
                  ruleId: 'app-quantity-validation',
                  ruleName: 'App Quantity Validation',
                  message: 'Test validation failure',
                  details: {}
                }
              ]
            }
          ],
          summary: {
            totalRecords: 1,
            validRecords: 0,
            invalidRecords: 1,
            timeFrame: '1w',
            enabledRulesCount: 3
          }
        })
      });
    });
    
    await page.goto(base);
    
    // Wait for the API call to complete
    await page.waitForTimeout(1000);
    
    // Mock the provisioning search API to return the specific record
    await page.route('**/api/provisioning/requests*', async route => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');
      
      if (search && search.includes('Test PS Request')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{
              Id: 'PS-TEST-001',
              Name: 'Test PS Request',
              Account__c: 'Test Account',
              Status__c: 'Active',
              TenantRequestAction__c: 'Standard'
            }],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalCount: 1,
              pageSize: 25
            }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json', 
          body: JSON.stringify({
            success: true,
            data: [],
            pagination: { currentPage: 1, totalPages: 0, totalCount: 0, pageSize: 25 }
          })
        });
      }
    });
    
    // Click the "View Record" button on dashboard
    await page.locator('#page-dashboard').getByRole('button', { name: 'View Record' }).first().click();
    
    // Verify that we navigate to the provisioning page
    await expect(page.locator('#page-provisioning')).toBeVisible();
    await expect(page.locator('#page-dashboard')).toHaveClass(/hidden/);
    
    // Wait for the search to be triggered and verify search input contains the record name
    await page.waitForTimeout(1000); // Give more time for async search
    const searchInput = page.locator('#provisioning-search');
    await expect(searchInput).toHaveValue('Test PS Request');
    
    // Verify that the search was triggered (search input should be focused)
    await expect(searchInput).toBeFocused();
    
    // Verify that a search request was made (should happen automatically)
    // The search should have filtered results to show only the target record
  });
});
