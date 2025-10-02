const request = require('supertest');
const app = require('../../app');

describe('Customer Products API Integration Tests', () => {
  describe('GET /api/customer-products', () => {
    it('should return 400 when account name is missing', async () => {
      const response = await request(app)
        .get('/api/customer-products');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Account name is required');
    });

    it('should return customer products data structure', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('account');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('productsByRegion');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return correct summary structure', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success) {
        expect(response.body.summary).toHaveProperty('totalActive');
        expect(response.body.summary).toHaveProperty('byCategory');
        expect(response.body.summary.byCategory).toHaveProperty('models');
        expect(response.body.summary.byCategory).toHaveProperty('data');
        expect(response.body.summary.byCategory).toHaveProperty('apps');
        
        // Counts should be numbers
        expect(typeof response.body.summary.totalActive).toBe('number');
        expect(typeof response.body.summary.byCategory.models).toBe('number');
        expect(typeof response.body.summary.byCategory.data).toBe('number');
        expect(typeof response.body.summary.byCategory.apps).toBe('number');
      }
    });

    it('should return products organized by region', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 0) {
        expect(response.body.productsByRegion).toBeDefined();
        expect(typeof response.body.productsByRegion).toBe('object');
        
        // Each region should have models, data, and apps arrays
        Object.keys(response.body.productsByRegion).forEach(region => {
          const regionProducts = response.body.productsByRegion[region];
          expect(regionProducts).toHaveProperty('models');
          expect(regionProducts).toHaveProperty('data');
          expect(regionProducts).toHaveProperty('apps');
          expect(Array.isArray(regionProducts.models)).toBe(true);
          expect(Array.isArray(regionProducts.data)).toBe(true);
          expect(Array.isArray(regionProducts.apps)).toBe(true);
        });
      }
    });

    it('should return products with required fields', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 0) {
        // Find first product in any region/category
        const regions = response.body.productsByRegion;
        let foundProduct = null;
        
        for (const region in regions) {
          const categories = ['models', 'data', 'apps'];
          for (const category of categories) {
            if (regions[region][category].length > 0) {
              foundProduct = regions[region][category][0];
              break;
            }
          }
          if (foundProduct) break;
        }
        
        if (foundProduct) {
          // Verify product structure
          expect(foundProduct).toHaveProperty('productCode');
          expect(foundProduct).toHaveProperty('productName');
          expect(foundProduct).toHaveProperty('category');
          expect(foundProduct).toHaveProperty('region');
          expect(foundProduct).toHaveProperty('startDate');
          expect(foundProduct).toHaveProperty('endDate');
          expect(foundProduct).toHaveProperty('status');
          expect(foundProduct).toHaveProperty('daysRemaining');
          expect(foundProduct).toHaveProperty('sourcePSRecords');
          
          // Verify data types
          expect(typeof foundProduct.productCode).toBe('string');
          expect(typeof foundProduct.productName).toBe('string');
          expect(typeof foundProduct.status).toBe('string');
          expect(typeof foundProduct.daysRemaining).toBe('number');
          expect(Array.isArray(foundProduct.sourcePSRecords)).toBe(true);
          
          // Status should be one of the expected values
          expect(['active', 'expiring-soon', 'expiring']).toContain(foundProduct.status);
          
          // Days remaining should be positive for active products
          expect(foundProduct.daysRemaining).toBeGreaterThan(0);
        }
      }
    });

    it('should only return active products (endDate >= today)', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check all products across all regions
        const regions = response.body.productsByRegion;
        for (const region in regions) {
          const categories = ['models', 'data', 'apps'];
          for (const category of categories) {
            regions[region][category].forEach(product => {
              const endDate = new Date(product.endDate);
              // Product should not be expired
              expect(endDate >= today).toBe(true);
            });
          }
        }
      }
    });

    it('should include lastUpdated information', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.lastUpdated) {
        expect(response.body.lastUpdated).toHaveProperty('psRecordId');
        expect(response.body.lastUpdated).toHaveProperty('date');
        
        // PS Record ID should match pattern
        expect(response.body.lastUpdated.psRecordId).toMatch(/^PS-\d+$/);
        
        // Date should be valid ISO string
        expect(new Date(response.body.lastUpdated.date)).toBeInstanceOf(Date);
      }
    });

    it('should return empty data for non-existent account', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'XYZ_NONEXISTENT_ACCOUNT_12345' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.account).toBe('XYZ_NONEXISTENT_ACCOUNT_12345');
      expect(response.body.summary.totalActive).toBe(0);
      expect(Object.keys(response.body.productsByRegion)).toHaveLength(0);
    });

    it('should handle special characters in account name', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: "Test Account with 'quotes' and \"double quotes\"" });

      // Should not crash and should handle the query safely
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });

    it('should return consistent category counts', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success) {
        const summary = response.body.summary;
        const regions = response.body.productsByRegion;
        
        // Count products manually
        let manualModelsCount = 0;
        let manualDataCount = 0;
        let manualAppsCount = 0;
        
        for (const region in regions) {
          manualModelsCount += regions[region].models.length;
          manualDataCount += regions[region].data.length;
          manualAppsCount += regions[region].apps.length;
        }
        
        // Summary counts should match actual product counts
        expect(summary.byCategory.models).toBe(manualModelsCount);
        expect(summary.byCategory.data).toBe(manualDataCount);
        expect(summary.byCategory.apps).toBe(manualAppsCount);
        expect(summary.totalActive).toBe(manualModelsCount + manualDataCount + manualAppsCount);
      }
    });

    it('should include packageName for Apps', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success) {
        const regions = response.body.productsByRegion;
        
        // Check if any apps exist
        let foundApp = false;
        for (const region in regions) {
          if (regions[region].apps.length > 0) {
            foundApp = true;
            // Apps should have packageName field (may be null)
            regions[region].apps.forEach(app => {
              expect(app).toHaveProperty('packageName');
              // If packageName exists, it should be a string
              if (app.packageName !== null) {
                expect(typeof app.packageName).toBe('string');
              }
            });
          }
        }
      }
    });

    it('should handle products from multiple PS records', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 0) {
        const regions = response.body.productsByRegion;
        
        // At least one product might have multiple source PS records
        let foundMergedProduct = false;
        for (const region in regions) {
          const categories = ['models', 'data', 'apps'];
          for (const category of categories) {
            regions[region][category].forEach(product => {
              if (product.sourcePSRecords.length > 1) {
                foundMergedProduct = true;
                // All source PS records should match pattern
                product.sourcePSRecords.forEach(psId => {
                  expect(psId).toMatch(/^PS-\d+$/);
                });
              }
            });
          }
        }
        
        // Note: It's okay if no merged products are found (depends on data)
      }
    });

    it('should return response within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      
      // API should respond within 10 seconds (real-time aggregation)
      expect(duration).toBeLessThan(10000);
    });

    it('should gracefully handle no Salesforce authentication', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      // Should return success with empty data or note about authentication
      expect(response.body).toHaveProperty('success', true);
      
      if (!response.body.note) {
        // If authenticated, should have normal structure
        expect(response.body).toHaveProperty('productsByRegion');
      } else {
        // If not authenticated, should have note
        expect(response.body.note).toContain('Salesforce authentication');
        expect(response.body.summary.totalActive).toBe(0);
      }
    });
  });

  describe('Data Aggregation Logic', () => {
    it('should merge products by region/category/productCode', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 0) {
        const regions = response.body.productsByRegion;
        
        // Within each region and category, product codes should be unique
        // (except for databridge which can have duplicates)
        for (const region in regions) {
          const categories = ['models', 'data', 'apps'];
          for (const category of categories) {
            const products = regions[region][category];
            const productCodes = products.map(p => p.productCode);
            
            // Check for duplicates
            const nonDatabridgeProducts = products.filter(
              p => !p.productCode.toLowerCase().includes('databridge')
            );
            const nonDatabridgeCodes = nonDatabridgeProducts.map(p => p.productCode);
            const uniqueNonDatabridgeCodes = [...new Set(nonDatabridgeCodes)];
            
            // Non-databridge products should have unique codes
            expect(uniqueNonDatabridgeCodes.length).toBe(nonDatabridgeCodes.length);
          }
        }
      }
    });

    it('should sort products by productCode within categories', async () => {
      const response = await request(app)
        .get('/api/customer-products')
        .query({ account: 'Test Account' });

      expect(response.status).toBe(200);
      
      if (response.body.success && response.body.summary.totalActive > 1) {
        const regions = response.body.productsByRegion;
        
        for (const region in regions) {
          const categories = ['models', 'data', 'apps'];
          for (const category of categories) {
            const products = regions[region][category];
            
            if (products.length > 1) {
              // Check if sorted by product code
              for (let i = 0; i < products.length - 1; i++) {
                expect(products[i].productCode.localeCompare(products[i + 1].productCode))
                  .toBeLessThanOrEqual(0);
              }
            }
          }
        }
      }
    });
  });
});

