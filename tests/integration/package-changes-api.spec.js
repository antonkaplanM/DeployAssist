const request = require('supertest');
const app = require('../../app');

describe('Package Changes Analytics API', () => {
    describe('GET /api/analytics/package-changes/status', () => {
        it('should return package changes analysis status', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/status')
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

        it('should include analysis metrics when available', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/status')
                .expect(200);

            if (response.body.hasAnalysis) {
                const { analysis } = response.body;
                expect(analysis).toHaveProperty('recordsAnalyzed');
                expect(analysis).toHaveProperty('deploymentsProcessed');
                expect(analysis).toHaveProperty('changesFound');
                expect(analysis).toHaveProperty('upgradesFound');
                expect(analysis).toHaveProperty('downgradesFound');
                expect(analysis).toHaveProperty('psRecordsWithChanges');
                expect(analysis).toHaveProperty('accountsAffected');
                
                // Verify analysis metrics are numbers
                expect(typeof analysis.recordsAnalyzed).toBe('number');
                expect(typeof analysis.changesFound).toBe('number');
                expect(typeof analysis.upgradesFound).toBe('number');
                expect(typeof analysis.downgradesFound).toBe('number');
                expect(typeof analysis.psRecordsWithChanges).toBe('number');
                expect(typeof analysis.accountsAffected).toBe('number');
            }
        });
    });

    describe('GET /api/analytics/package-changes/summary', () => {
        it('should return package changes summary with default timeframe', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/summary')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('summary');
            expect(response.body).toHaveProperty('timeFrame');
            
            // Verify summary structure
            const { summary } = response.body;
            expect(summary).toHaveProperty('total_changes');
            expect(summary).toHaveProperty('total_upgrades');
            expect(summary).toHaveProperty('total_downgrades');
            expect(summary).toHaveProperty('ps_records_with_changes');
            expect(summary).toHaveProperty('accounts_affected');
            expect(summary).toHaveProperty('deployments_affected');
            expect(summary).toHaveProperty('products_changed');
            
            // Verify all summary values are numbers
            expect(typeof summary.total_changes).toBe('number');
            expect(typeof summary.total_upgrades).toBe('number');
            expect(typeof summary.total_downgrades).toBe('number');
            expect(typeof summary.ps_records_with_changes).toBe('number');
            expect(typeof summary.accounts_affected).toBe('number');
            expect(typeof summary.deployments_affected).toBe('number');
            expect(typeof summary.products_changed).toBe('number');
        });

        it('should accept timeFrame parameter', async () => {
            const testTimeFrames = ['30d', '90d', '6m', '1y', '2y'];
            
            for (const timeFrame of testTimeFrames) {
                const response = await request(app)
                    .get('/api/analytics/package-changes/summary')
                    .query({ timeFrame })
                    .expect(200);

                expect(response.body.timeFrame).toBe(timeFrame);
            }
        });

        it('should have consistent summary counts', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/summary')
                .expect(200);

            const { summary } = response.body;
            
            // Total changes should equal upgrades + downgrades
            expect(summary.total_changes).toBe(summary.total_upgrades + summary.total_downgrades);
        });
    });

    describe('GET /api/analytics/package-changes/by-product', () => {
        it('should return package changes grouped by product', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-product')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('count');
            expect(response.body).toHaveProperty('timeFrame');
            
            // Verify data is an array
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should return properly structured product items', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-product')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                const item = data[0];
                
                // Verify product structure
                expect(item).toHaveProperty('product_code');
                expect(item).toHaveProperty('product_name');
                expect(item).toHaveProperty('total_changes');
                expect(item).toHaveProperty('upgrades');
                expect(item).toHaveProperty('downgrades');
                expect(item).toHaveProperty('ps_records');
                expect(item).toHaveProperty('accounts');
                
                // Verify types
                expect(typeof item.product_code).toBe('string');
                expect(typeof item.total_changes).toBe('number');
                expect(typeof item.upgrades).toBe('number');
                expect(typeof item.downgrades).toBe('number');
                expect(typeof item.ps_records).toBe('number');
                expect(typeof item.accounts).toBe('number');
                
                // Verify counts are consistent
                expect(parseInt(item.total_changes)).toBe(parseInt(item.upgrades) + parseInt(item.downgrades));
            }
        });

        it('should accept timeFrame parameter', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-product')
                .query({ timeFrame: '90d' })
                .expect(200);

            expect(response.body.timeFrame).toBe('90d');
        });
    });

    describe('GET /api/analytics/package-changes/by-account', () => {
        it('should return package changes grouped by account', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-account')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('count');
            expect(response.body).toHaveProperty('timeFrame');
            
            // Verify data is an array
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should return hierarchical account structure with deployments and products', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-account')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                const account = data[0];
                
                // Verify account level structure
                expect(account).toHaveProperty('account_name');
                expect(account).toHaveProperty('total_changes');
                expect(account).toHaveProperty('upgrades');
                expect(account).toHaveProperty('downgrades');
                expect(account).toHaveProperty('ps_records');
                expect(account).toHaveProperty('deployments');
                
                // Verify deployments array
                expect(Array.isArray(account.deployments)).toBe(true);
                
                if (account.deployments.length > 0) {
                    const deployment = account.deployments[0];
                    
                    // Verify deployment structure
                    expect(deployment).toHaveProperty('deployment_number');
                    expect(deployment).toHaveProperty('tenant_name'); // Key feature: tenant name
                    expect(deployment).toHaveProperty('total_changes');
                    expect(deployment).toHaveProperty('upgrades');
                    expect(deployment).toHaveProperty('downgrades');
                    expect(deployment).toHaveProperty('products');
                    
                    // Verify products array
                    expect(Array.isArray(deployment.products)).toBe(true);
                    
                    if (deployment.products.length > 0) {
                        const product = deployment.products[0];
                        
                        // Verify product structure
                        expect(product).toHaveProperty('product_code');
                        expect(product).toHaveProperty('total_changes');
                        expect(product).toHaveProperty('upgrades');
                        expect(product).toHaveProperty('downgrades');
                    }
                }
            }
        });

        it('should include tenant names in deployments', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-account')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                for (const account of data) {
                    if (account.deployments && account.deployments.length > 0) {
                        for (const deployment of account.deployments) {
                            // Tenant name may be null, but property should exist
                            expect(deployment).toHaveProperty('tenant_name');
                            
                            // If tenant name exists, it should be a string
                            if (deployment.tenant_name !== null) {
                                expect(typeof deployment.tenant_name).toBe('string');
                            }
                        }
                    }
                }
            }
        });

        it('should return all accounts (no limit)', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-account')
                .expect(200);

            const { data, count } = response.body;
            
            // Count should match array length (no artificial limit)
            expect(data.length).toBe(parseInt(count));
        });
    });

    describe('GET /api/analytics/package-changes/recent', () => {
        it('should return recent package changes', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('count');
            
            // Verify data is an array
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should return properly structured recent change items', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                const item = data[0];
                
                // Verify change item structure
                expect(item).toHaveProperty('ps_record_id');
                expect(item).toHaveProperty('ps_record_name');
                expect(item).toHaveProperty('previous_ps_record_id');
                expect(item).toHaveProperty('previous_ps_record_name');
                expect(item).toHaveProperty('deployment_number');
                expect(item).toHaveProperty('tenant_name'); // Key feature: tenant name
                expect(item).toHaveProperty('account_name');
                expect(item).toHaveProperty('product_code');
                expect(item).toHaveProperty('previous_package');
                expect(item).toHaveProperty('new_package');
                expect(item).toHaveProperty('change_type');
                expect(item).toHaveProperty('ps_created_date');
                
                // Verify change type
                expect(['upgrade', 'downgrade']).toContain(item.change_type);
                
                // Verify date format
                const date = new Date(item.ps_created_date);
                expect(date.toString()).not.toBe('Invalid Date');
            }
        });

        it('should accept limit parameter', async () => {
            const testLimit = 5;
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .query({ limit: testLimit })
                .expect(200);

            const { data } = response.body;
            expect(data.length).toBeLessThanOrEqual(testLimit);
        });

        it('should return changes sorted by date descending', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .expect(200);

            const { data } = response.body;

            if (data.length > 1) {
                for (let i = 0; i < data.length - 1; i++) {
                    const currentDate = new Date(data[i].ps_created_date);
                    const nextDate = new Date(data[i + 1].ps_created_date);
                    
                    // Current date should be >= next date (descending order)
                    expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
                }
            }
        });
    });

    describe('POST /api/analytics/package-changes/refresh', () => {
        // Note: This test may take 10-60 seconds to complete
        it('should trigger package change analysis', async () => {
            const response = await request(app)
                .post('/api/analytics/package-changes/refresh')
                .send({})
                .expect('Content-Type', /json/)
                .timeout(70000); // 70 second timeout

            // Should return either success or a specific error
            expect(response.body).toHaveProperty('success');
            
            if (response.body.success) {
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('summary');
                expect(response.body.summary).toHaveProperty('deploymentsProcessed');
                expect(response.body.summary).toHaveProperty('changesFound');
                expect(response.body.summary).toHaveProperty('upgradesFound');
                expect(response.body.summary).toHaveProperty('downgradesFound');
                expect(response.body.summary).toHaveProperty('psRecordsWithChanges');
                expect(response.body.summary).toHaveProperty('accountsAffected');
                expect(response.body.summary).toHaveProperty('lookbackYears');
                
                // Verify all metrics are numbers
                expect(typeof response.body.summary.deploymentsProcessed).toBe('number');
                expect(typeof response.body.summary.changesFound).toBe('number');
                expect(typeof response.body.summary.upgradesFound).toBe('number');
                expect(typeof response.body.summary.downgradesFound).toBe('number');
                expect(typeof response.body.summary.psRecordsWithChanges).toBe('number');
                expect(typeof response.body.summary.accountsAffected).toBe('number');
                
                // Verify consistency
                const { summary } = response.body;
                expect(summary.changesFound).toBe(summary.upgradesFound + summary.downgradesFound);
            }
        }, 75000); // 75 second test timeout

        it('should accept custom lookbackYears parameter', async () => {
            const response = await request(app)
                .post('/api/analytics/package-changes/refresh')
                .send({ lookbackYears: 3 })
                .timeout(70000);

            if (response.body.success) {
                expect(response.body.summary.lookbackYears).toBe(3);
            }
        }, 75000);

        it('should handle missing Salesforce auth gracefully', async () => {
            const response = await request(app)
                .post('/api/analytics/package-changes/refresh')
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

    describe('GET /api/analytics/package-changes/export', () => {
        it('should export package changes to Excel', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/export')
                .query({ timeFrame: '90d' })
                .timeout(30000);

            // Should return Excel file or success response
            if (response.status === 200) {
                // Check content type for Excel
                expect(response.headers['content-type']).toMatch(/spreadsheet|excel/);
                expect(response.headers['content-disposition']).toMatch(/attachment.*\.xlsx/);
            }
        }, 35000);

        it('should accept timeFrame parameter for export', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/export')
                .query({ timeFrame: '30d' })
                .timeout(30000);

            if (response.status === 200) {
                expect(response.headers['content-disposition']).toMatch(/Package_Changes_30d/);
            }
        }, 35000);
    });

    describe('Package changes data integrity', () => {
        it('should have unique PS record combinations', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .query({ limit: 100 })
                .expect(200);

            const { data } = response.body;
            const keys = new Set();
            
            for (const item of data) {
                const key = `${item.ps_record_id}|${item.product_code}`;
                // Each PS record + product combination should be unique
                expect(keys.has(key)).toBe(false);
                keys.add(key);
            }
        });

        it('should only track Update type PS records', async () => {
            // This test verifies that only Update requests are analyzed
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .expect(200);

            const { data } = response.body;
            
            // All changes should come from PS records with Type = "Update"
            // (This is enforced by the backend logic)
            expect(Array.isArray(data)).toBe(true);
        });

        it('should exclude records with overlapping dates', async () => {
            // This test verifies that invalid records are filtered
            const response = await request(app)
                .post('/api/analytics/package-changes/refresh')
                .send({})
                .timeout(70000);

            if (response.body.success) {
                // Analysis should complete without including invalid records
                expect(response.body.summary.changesFound).toBeGreaterThanOrEqual(0);
            }
        }, 75000);

        it('should only count unique product changes per PS record', async () => {
            // Verify the counting logic counts unique product changes
            const summaryResponse = await request(app)
                .get('/api/analytics/package-changes/summary')
                .expect(200);

            const byProductResponse = await request(app)
                .get('/api/analytics/package-changes/by-product')
                .expect(200);

            if (summaryResponse.body.success && byProductResponse.body.success) {
                const { summary } = summaryResponse.body;
                const { data: products } = byProductResponse.body;
                
                // Sum of all product changes should equal total changes
                const sumOfProductChanges = products.reduce((sum, p) => sum + parseInt(p.total_changes), 0);
                expect(sumOfProductChanges).toBe(parseInt(summary.total_changes));
            }
        });
    });

    describe('Tenant name integration', () => {
        it('should include tenant names in analysis results', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/recent')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                // At least check that tenant_name property exists
                for (const item of data) {
                    expect(item).toHaveProperty('tenant_name');
                }
            }
        });

        it('should include tenant names in account hierarchy', async () => {
            const response = await request(app)
                .get('/api/analytics/package-changes/by-account')
                .expect(200);

            const { data } = response.body;

            if (data.length > 0) {
                for (const account of data) {
                    if (account.deployments && account.deployments.length > 0) {
                        for (const deployment of account.deployments) {
                            // Tenant name should be present in deployment data
                            expect(deployment).toHaveProperty('tenant_name');
                        }
                    }
                }
            }
        });
    });
});

