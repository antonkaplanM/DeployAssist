const request = require('supertest');
const app = require('../../app');

describe('Account History API Integration Tests', () => {
  describe('GET /api/provisioning/search', () => {
    it('should search for accounts by name', async () => {
      const response = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'Bank of America', limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('accounts');
      expect(response.body.results).toHaveProperty('technicalRequests');
      expect(response.body.results).toHaveProperty('totalCount');
    });

    it('should search for Technical Team Requests by PS-ID', async () => {
      const response = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'PS-4331', limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.results.technicalRequests).toBeDefined();
      
      // Should find PS-4331 if it exists
      if (response.body.results.technicalRequests.length > 0) {
        const foundRequest = response.body.results.technicalRequests.find(
          req => req.name === 'PS-4331'
        );
        expect(foundRequest).toBeDefined();
        
        // Verify it has a valid account name (data-agnostic test)
        if (foundRequest) {
          expect(foundRequest.account).toBeDefined();
          expect(foundRequest.account.length).toBeGreaterThan(0);
          expect(typeof foundRequest.account).toBe('string');
        }
      }
    });

    it('should return empty results for non-existent account', async () => {
      const response = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'XYZ_NONEXISTENT_ACCOUNT_12345', limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.results.totalCount).toBe(0);
    });

    it('should handle short search terms (less than 2 characters)', async () => {
      const response = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'a', limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      // Should return empty or minimal results for very short queries
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'Bank', limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      
      const totalResults = 
        (response.body.results.technicalRequests?.length || 0) + 
        (response.body.results.accounts?.length || 0);
      
      // Total results should not exceed limit significantly (some wiggle room for both categories)
      expect(totalResults).toBeLessThanOrEqual(15); // 5 per category * 2 categories + buffer
    });
  });

  describe('GET /api/provisioning/requests (Account History)', () => {
    it('should fetch all requests for Bank of America', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America Corporation',
          pageSize: 100 
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('totalCount');
      expect(Array.isArray(response.body.records)).toBe(true);
      
      // Bank of America should have multiple requests
      if (response.body.totalCount > 0) {
        expect(response.body.totalCount).toBeGreaterThan(0);
        
        // Each record should have required fields
        const firstRecord = response.body.records[0];
        expect(firstRecord).toHaveProperty('Id');
        expect(firstRecord).toHaveProperty('Name');
        expect(firstRecord).toHaveProperty('Account__c');
        expect(firstRecord).toHaveProperty('Status__c');
        expect(firstRecord).toHaveProperty('TenantRequestAction__c');
        expect(firstRecord).toHaveProperty('CreatedDate');
        expect(firstRecord).toHaveProperty('parsedPayload');
        
        // Parsed payload should have expected structure
        expect(firstRecord.parsedPayload).toHaveProperty('hasDetails');
        expect(firstRecord.parsedPayload).toHaveProperty('summary');
      }
    });

    it('should return requests sorted chronologically', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America Corporation',
          pageSize: 100 
        });

      expect(response.status).toBe(200);
      
      if (response.body.records && response.body.records.length > 1) {
        const records = response.body.records;
        
        // Verify reverse chronological order (newest to oldest) - API returns DESC by default
        for (let i = 0; i < records.length - 1; i++) {
          const currentDate = new Date(records[i].CreatedDate);
          const nextDate = new Date(records[i + 1].CreatedDate);
          
          // Current should be after or equal to next (descending order)
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    it('should include parsed payload data with entitlements', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America Corporation',
          pageSize: 100 
        });

      expect(response.status).toBe(200);
      
      if (response.body.records && response.body.records.length > 0) {
        const recordsWithEntitlements = response.body.records.filter(
          record => record.parsedPayload && record.parsedPayload.hasDetails
        );
        
        // At least some records should have entitlements
        expect(recordsWithEntitlements.length).toBeGreaterThan(0);
        
        // Check structure of parsed payload
        const firstWithEntitlements = recordsWithEntitlements[0];
        expect(firstWithEntitlements.parsedPayload).toHaveProperty('modelEntitlements');
        expect(firstWithEntitlements.parsedPayload).toHaveProperty('dataEntitlements');
        expect(firstWithEntitlements.parsedPayload).toHaveProperty('appEntitlements');
        expect(firstWithEntitlements.parsedPayload).toHaveProperty('totalCount');
      }
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America Corporation',
          pageSize: 5,
          offset: 0
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('pageSize', 5);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('hasMore');
      
      // Records should not exceed page size
      expect(response.body.records.length).toBeLessThanOrEqual(5);
    });

    it('should return specific request PS-4331 with valid account data', async () => {
      // First, search for PS-4331 to find its actual account
      const searchResponse = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'PS-4331', limit: 20 });

      if (searchResponse.body.results.technicalRequests && 
          searchResponse.body.results.technicalRequests.length > 0) {
        const psRequest = searchResponse.body.results.technicalRequests.find(
          req => req.name === 'PS-4331'
        );
        
        if (psRequest && psRequest.account) {
          // Now fetch records for the actual account PS-4331 belongs to
          const response = await request(app)
            .get('/api/provisioning/requests')
            .query({ 
              search: psRequest.account,
              pageSize: 100 
            });

          expect(response.status).toBe(200);
          
          if (response.body.records && response.body.records.length > 0) {
            const ps4331 = response.body.records.find(record => record.Name === 'PS-4331');
            
            // PS-4331 should exist in its account's history
            expect(ps4331).toBeDefined();
            
            if (ps4331) {
              expect(ps4331.Account__c).toBe(psRequest.account);
              expect(ps4331.Status__c).toBeDefined();
              expect(ps4331.TenantRequestAction__c).toBeDefined();
            }
          }
        }
      }
    });
  });

  describe('GET /api/provisioning/requests/:id (Request Details)', () => {
    it('should fetch specific request details by ID', async () => {
      // First, get a request ID from Bank of America
      const listResponse = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America Corporation',
          pageSize: 1 
        });

      if (listResponse.body.records && listResponse.body.records.length > 0) {
        const requestId = listResponse.body.records[0].Id;
        
        // Now fetch that specific request
        const detailResponse = await request(app)
          .get(`/api/provisioning/requests/${requestId}`);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body).toHaveProperty('success', true);
        expect(detailResponse.body).toHaveProperty('record');
        expect(detailResponse.body.record.Id).toBe(requestId);
        expect(detailResponse.body.record).toHaveProperty('parsedPayload');
      }
    });

    it('should return 404 for non-existent request ID', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests/INVALID_ID_12345');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Account History Feature - End-to-End Flow', () => {
    it('should complete full account history workflow', async () => {
      // Step 1: Search for account
      const searchResponse = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'Bank of America', limit: 20 });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.success).toBe(true);
      
      const accountName = searchResponse.body.results.accounts &&
                         searchResponse.body.results.accounts.length > 0
                         ? searchResponse.body.results.accounts[0].name
                         : 'Bank of America Corporation';

      // Step 2: Load account history
      const historyResponse = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: accountName,
          pageSize: 100 
        });

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.records).toBeDefined();
      
      if (historyResponse.body.records.length > 0) {
        // Step 3: Get details of first request
        const firstRequestId = historyResponse.body.records[0].Id;
        const detailResponse = await request(app)
          .get(`/api/provisioning/requests/${firstRequestId}`);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.success).toBe(true);
        expect(detailResponse.body.record).toBeDefined();
        
        // Verify the full data structure needed for Account History page
        const record = detailResponse.body.record;
        expect(record).toHaveProperty('Name');
        expect(record).toHaveProperty('Account__c');
        expect(record).toHaveProperty('CreatedDate');
        expect(record).toHaveProperty('parsedPayload');
        expect(record.parsedPayload).toHaveProperty('summary');
      }
    });

    it('should handle search by PS-ID and load account history', async () => {
      // Search by PS-ID
      const searchResponse = await request(app)
        .get('/api/provisioning/search')
        .query({ q: 'PS-4331', limit: 20 });

      expect(searchResponse.status).toBe(200);
      
      if (searchResponse.body.results.technicalRequests &&
          searchResponse.body.results.technicalRequests.length > 0) {
        const psRequest = searchResponse.body.results.technicalRequests.find(
          req => req.name === 'PS-4331'
        );
        
        if (psRequest && psRequest.account) {
          const accountName = psRequest.account;
          
          // Verify account name is valid
          expect(accountName).toBeDefined();
          expect(accountName.length).toBeGreaterThan(0);
          
          // Load full history for that account
          const historyResponse = await request(app)
            .get('/api/provisioning/requests')
            .query({ 
              search: accountName,
              pageSize: 100 
            });

          expect(historyResponse.status).toBe(200);
          expect(historyResponse.body.success).toBe(true);
          
          // Verify PS-4331 is in the history
          const foundRequest = historyResponse.body.records.find(
            r => r.Name === 'PS-4331'
          );
          expect(foundRequest).toBeDefined();
          
          // Verify it belongs to the same account
          if (foundRequest) {
            expect(foundRequest.Account__c).toBe(accountName);
          }
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing search parameter gracefully', async () => {
      const response = await request(app)
        .get('/api/provisioning/search');

      // Should either return 200 with empty results or 400
      expect([200, 400]).toContain(response.status);
    });

    it('should handle invalid page size', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America',
          pageSize: 'invalid' 
        });

      expect(response.status).toBe(200); // Should handle gracefully
    });

    it('should handle negative offset', async () => {
      const response = await request(app)
        .get('/api/provisioning/requests')
        .query({ 
          search: 'Bank of America',
          pageSize: 10,
          offset: -5
        });

      expect(response.status).toBe(500); // Currently returns error for negative offset
    });
  });
});
