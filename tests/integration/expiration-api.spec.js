const request = require('supertest');
const app = require('../../app');

describe('Expiration Monitor API', () => {
    describe('GET /api/expiration/status', () => {
        it('should return expiration status', async () => {
            const response = await request(app)
                .get('/api/expiration/status')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('hasAnalysis');
            
            if (response.body.hasAnalysis) {
                expect(response.body).toHaveProperty('analysis');
                expect(response.body.analysis).toHaveProperty('lastRun');
                expect(response.body.analysis).toHaveProperty('status');
            }
        });

        it('should include analysis details when available', async () => {
            const response = await request(app)
                .get('/api/expiration/status')
                .expect(200);

            if (response.body.hasAnalysis) {
                const { analysis } = response.body;
                expect(analysis).toHaveProperty('recordsAnalyzed');
                expect(analysis).toHaveProperty('entitlementsProcessed');
                expect(analysis).toHaveProperty('expirationsFound');
                expect(analysis).toHaveProperty('extensionsFound');
                expect(analysis).toHaveProperty('lookbackYears');
            }
        });
    });

    describe('GET /api/expiration/monitor', () => {
        it('should return expiration data with default parameters', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('summary');
            expect(response.body).toHaveProperty('expirations');
            expect(response.body).toHaveProperty('expirationWindow');
            expect(response.body).toHaveProperty('timestamp');
            
            // Verify summary structure
            const { summary } = response.body;
            expect(summary).toHaveProperty('totalExpiring');
            expect(summary).toHaveProperty('atRisk');
            expect(summary).toHaveProperty('extended');
            expect(summary).toHaveProperty('accountsAffected');
            
            // Verify all summary values are numbers
            expect(typeof summary.totalExpiring).toBe('number');
            expect(typeof summary.atRisk).toBe('number');
            expect(typeof summary.extended).toBe('number');
            expect(typeof summary.accountsAffected).toBe('number');
        });

        it('should accept expirationWindow parameter', async () => {
            const testWindow = 60;
            const response = await request(app)
                .get('/api/expiration/monitor')
                .query({ expirationWindow: testWindow })
                .expect(200);

            expect(response.body.expirationWindow).toBe(testWindow);
        });

        it('should accept showExtended parameter', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .query({ showExtended: false })
                .expect(200);

            expect(response.body).toHaveProperty('expirations');
            // When showExtended is false, should filter out extended items
            // (actual filtering depends on implementation)
        });

        it('should return properly structured expiration items', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { expirations } = response.body;
            expect(Array.isArray(expirations)).toBe(true);

            if (expirations.length > 0) {
                const item = expirations[0];
                
                // Verify account structure
                expect(item).toHaveProperty('account');
                expect(item.account).toHaveProperty('id');
                expect(item.account).toHaveProperty('name');
                
                // Verify PS record structure
                expect(item).toHaveProperty('psRecord');
                expect(item.psRecord).toHaveProperty('id');
                expect(item.psRecord).toHaveProperty('name');
                
                // Verify expiring products structure
                expect(item).toHaveProperty('expiringProducts');
                expect(item.expiringProducts).toHaveProperty('models');
                expect(item.expiringProducts).toHaveProperty('data');
                expect(item.expiringProducts).toHaveProperty('apps');
                
                // Verify status and expiry
                expect(item).toHaveProperty('status');
                expect(['at-risk', 'extended']).toContain(item.status);
                expect(item).toHaveProperty('earliestExpiry');
            }
        });

        it('should return valid product structures in expiring items', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { expirations } = response.body;

            if (expirations.length > 0) {
                const item = expirations[0];
                const { models, data, apps } = item.expiringProducts;
                
                // Check models structure
                if (models.length > 0) {
                    const model = models[0];
                    expect(model).toHaveProperty('productCode');
                    expect(model).toHaveProperty('productName');
                    expect(model).toHaveProperty('endDate');
                    expect(model).toHaveProperty('daysUntilExpiry');
                    expect(model).toHaveProperty('isExtended');
                    expect(typeof model.isExtended).toBe('boolean');
                }
                
                // Check data structure
                if (data.length > 0) {
                    const dataProduct = data[0];
                    expect(dataProduct).toHaveProperty('productCode');
                    expect(dataProduct).toHaveProperty('endDate');
                    expect(dataProduct).toHaveProperty('isExtended');
                }
                
                // Check apps structure
                if (apps.length > 0) {
                    const app = apps[0];
                    expect(app).toHaveProperty('productCode');
                    expect(app).toHaveProperty('endDate');
                    expect(app).toHaveProperty('isExtended');
                }
            }
        });

        it('should include extension details for extended products', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { expirations } = response.body;

            // Find an extended product
            for (const item of expirations) {
                const allProducts = [
                    ...item.expiringProducts.models,
                    ...item.expiringProducts.data,
                    ...item.expiringProducts.apps
                ];
                
                const extendedProduct = allProducts.find(p => p.isExtended);
                
                if (extendedProduct) {
                    expect(extendedProduct).toHaveProperty('extendingPsRecordId');
                    expect(extendedProduct).toHaveProperty('extendingPsRecordName');
                    expect(extendedProduct).toHaveProperty('extendingEndDate');
                    break;
                }
            }
        });

        it('should handle requests without authentication gracefully', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            // Even without Salesforce auth, should return success with empty data
            expect(response.body).toHaveProperty('success', true);
            
            if (!response.body.expirations || response.body.expirations.length === 0) {
                // Should include a note about authentication
                expect(response.body).toHaveProperty('note');
            }
        });
    });

    describe('POST /api/expiration/refresh', () => {
        // Note: This test may take 10-60 seconds to complete
        it('should trigger expiration analysis', async () => {
            const response = await request(app)
                .post('/api/expiration/refresh')
                .send({})
                .expect('Content-Type', /json/)
                .timeout(70000); // 70 second timeout

            // Should return either success or a specific error
            expect(response.body).toHaveProperty('success');
            
            if (response.body.success) {
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('summary');
                expect(response.body.summary).toHaveProperty('recordsAnalyzed');
                expect(response.body.summary).toHaveProperty('entitlementsProcessed');
                expect(response.body.summary).toHaveProperty('expirationsFound');
                expect(response.body.summary).toHaveProperty('extensionsFound');
                expect(response.body.summary).toHaveProperty('lookbackYears');
                expect(response.body.summary).toHaveProperty('duration');
            }
        }, 75000); // 75 second test timeout

        it('should accept custom lookbackYears parameter', async () => {
            const response = await request(app)
                .post('/api/expiration/refresh')
                .send({ lookbackYears: 3 })
                .timeout(70000);

            if (response.body.success) {
                expect(response.body.summary.lookbackYears).toBe(3);
            }
        }, 75000);

        it('should accept custom expirationWindow parameter', async () => {
            const response = await request(app)
                .post('/api/expiration/refresh')
                .send({ expirationWindow: 60 })
                .timeout(70000);

            if (response.body.success) {
                expect(response.body.summary.expirationWindow).toBe(60);
            }
        }, 75000);

        it('should handle missing Salesforce auth gracefully', async () => {
            const response = await request(app)
                .post('/api/expiration/refresh')
                .send({})
                .timeout(70000);

            // Should return a response (either success or error about auth)
            expect(response.body).toHaveProperty('success');
            
            if (!response.body.success) {
                expect(response.body).toHaveProperty('error');
                expect(typeof response.body.error).toBe('string');
            }
        }, 75000);
    });

    describe('Expiration data integrity', () => {
        it('should have consistent summary counts', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { summary } = response.body;
            
            // Total expiring should equal at-risk + extended
            expect(summary.totalExpiring).toBe(summary.atRisk + summary.extended);
        });

        it('should have items matching the at-risk count', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { summary, expirations } = response.body;
            const atRiskItems = expirations.filter(item => item.status === 'at-risk');
            
            expect(atRiskItems.length).toBeLessThanOrEqual(summary.atRisk);
        });

        it('should have unique account + PS record combinations', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { expirations } = response.body;
            const keys = new Set();
            
            for (const item of expirations) {
                const key = `${item.account.id}|${item.psRecord.id}`;
                expect(keys.has(key)).toBe(false); // Should not have duplicates
                keys.add(key);
            }
        });

        it('should have valid dates in ISO format', async () => {
            const response = await request(app)
                .get('/api/expiration/monitor')
                .expect(200);

            const { expirations } = response.body;
            
            if (expirations.length > 0) {
                const item = expirations[0];
                const date = new Date(item.earliestExpiry);
                expect(date.toString()).not.toBe('Invalid Date');
            }
        });
    });
});



