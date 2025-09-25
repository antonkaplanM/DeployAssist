const request = require('supertest');
const app = require('../../app');

describe('Health endpoint', () => {
  it('GET /health returns OK and timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
  });
});

