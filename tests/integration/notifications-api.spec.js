const request = require('supertest');
const app = require('../../app');

describe('Notifications API', () => {
  describe('GET /api/provisioning/new-records', () => {
    it('should return 400 if since parameter is missing', async () => {
      const res = await request(app).get('/api/provisioning/new-records');
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('since');
    });

    it('should return success response with timestamp parameter', async () => {
      const timestamp = new Date().toISOString();
      const res = await request(app)
        .get('/api/provisioning/new-records')
        .query({ since: timestamp });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('newRecords');
      expect(res.body).toHaveProperty('totalNew');
      expect(res.body).toHaveProperty('checkTimestamp');
      expect(Array.isArray(res.body.newRecords)).toBe(true);
    });

    it('should return empty array when no authentication', async () => {
      const timestamp = new Date().toISOString();
      const res = await request(app)
        .get('/api/provisioning/new-records')
        .query({ since: timestamp });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      // Without Salesforce auth, should return empty array
      expect(res.body.newRecords).toEqual([]);
      expect(res.body.totalNew).toBe(0);
    });

    it('should accept valid ISO timestamp', async () => {
      const validTimestamps = [
        '2025-10-07T10:30:00.000Z',
        '2025-10-07T10:30:00Z',
        new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      ];

      for (const timestamp of validTimestamps) {
        const res = await request(app)
          .get('/api/provisioning/new-records')
          .query({ since: timestamp });
        
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
      }
    });

    it('should return proper structure for new records', async () => {
      const timestamp = new Date(Date.now() - 3600000).toISOString();
      const res = await request(app)
        .get('/api/provisioning/new-records')
        .query({ since: timestamp });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('newRecords');
      
      // If records exist, verify structure
      if (res.body.newRecords.length > 0) {
        const record = res.body.newRecords[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
        expect(record).toHaveProperty('requestType');
        expect(record).toHaveProperty('account');
        expect(record).toHaveProperty('status');
        expect(record).toHaveProperty('createdDate');
      }
    });

    it('should include checkTimestamp in response', async () => {
      const requestTime = new Date();
      const timestamp = requestTime.toISOString();
      
      const res = await request(app)
        .get('/api/provisioning/new-records')
        .query({ since: timestamp });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('checkTimestamp');
      
      // Check timestamp should be after or equal to request time
      const checkTime = new Date(res.body.checkTimestamp);
      expect(checkTime.getTime()).toBeGreaterThanOrEqual(requestTime.getTime());
    });

    it('should handle recent timestamp queries', async () => {
      // Query for records from 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const res = await request(app)
        .get('/api/provisioning/new-records')
        .query({ since: fiveMinutesAgo });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('totalNew');
      expect(typeof res.body.totalNew).toBe('number');
    });
  });
});

