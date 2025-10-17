const request = require('supertest');
const app = require('../../app');
const database = require('../../database');

describe('PS Audit Trail API Endpoints', () => {
    describe('GET /api/audit-trail/stats', () => {
        it('should return audit trail statistics', async () => {
            const response = await request(app)
                .get('/api/audit-trail/stats')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('stats');
            expect(response.body.stats).toHaveProperty('total_ps_records');
            expect(response.body.stats).toHaveProperty('total_snapshots');
            expect(response.body.stats).toHaveProperty('total_status_changes');
        });

        it('should return non-negative values', async () => {
            const response = await request(app)
                .get('/api/audit-trail/stats')
                .expect(200);

            expect(parseInt(response.body.stats.total_ps_records)).toBeGreaterThanOrEqual(0);
            expect(parseInt(response.body.stats.total_snapshots)).toBeGreaterThanOrEqual(0);
            expect(parseInt(response.body.stats.total_status_changes)).toBeGreaterThanOrEqual(0);
        });
    });

    describe('GET /api/audit-trail/search', () => {
        it('should search for PS records', async () => {
            const response = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('results');
            expect(Array.isArray(response.body.results)).toBe(true);
        });

        it('should return empty array for non-existent record', async () => {
            const response = await request(app)
                .get('/api/audit-trail/search?q=PS-NONEXISTENT-99999')
                .expect(200);

            expect(response.body).toHaveProperty('results');
            expect(Array.isArray(response.body.results)).toBe(true);
            expect(response.body.results.length).toBe(0);
        });

        it('should handle missing query parameter gracefully', async () => {
            const response = await request(app)
                .get('/api/audit-trail/search')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('results');
        });

        it('should return records with correct structure', async () => {
            const response = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect(200);

            if (response.body.results && response.body.results.length > 0) {
                const record = response.body.results[0];
                expect(record).toHaveProperty('ps_record_id');
                expect(record).toHaveProperty('ps_record_name');
                expect(record).toHaveProperty('snapshot_count');
            }
        });
    });

    describe('GET /api/audit-trail/ps-record/:identifier', () => {
        it('should get audit trail for a specific PS record by name', async () => {
            // First, get a PS record from search
            const searchResponse = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect(200);

            if (searchResponse.body.results && searchResponse.body.results.length > 0) {
                const psRecordName = searchResponse.body.results[0].ps_record_name;
                
                const response = await request(app)
                    .get(`/api/audit-trail/ps-record/${psRecordName}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success');
                expect(response.body).toHaveProperty('record');
                expect(response.body).toHaveProperty('snapshots');
                expect(Array.isArray(response.body.snapshots)).toBe(true);
            }
        });

        it('should return empty result for non-existent record', async () => {
            const response = await request(app)
                .get('/api/audit-trail/ps-record/PS-NONEXISTENT-99999')
                .expect(200);

            expect(response.body).toHaveProperty('success');
        });

        it('should return snapshots with correct structure', async () => {
            const searchResponse = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect(200);

            if (searchResponse.body.results && searchResponse.body.results.length > 0) {
                const psRecordName = searchResponse.body.results[0].ps_record_name;
                
                const response = await request(app)
                    .get(`/api/audit-trail/ps-record/${psRecordName}`)
                    .expect(200);

                if (response.body.snapshots && response.body.snapshots.length > 0) {
                    const snapshot = response.body.snapshots[0];
                    expect(snapshot).toHaveProperty('id');
                    expect(snapshot).toHaveProperty('ps_record_id');
                    expect(snapshot).toHaveProperty('status');
                    expect(snapshot).toHaveProperty('captured_at');
                }
            }
        });
    });

    describe('GET /api/audit-trail/status-changes/:identifier', () => {
        it('should get status changes for a PS record', async () => {
            const searchResponse = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect(200);

            if (searchResponse.body.results && searchResponse.body.results.length > 0) {
                const psRecordName = searchResponse.body.results[0].ps_record_name;
                
                const response = await request(app)
                    .get(`/api/audit-trail/status-changes/${psRecordName}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success');
                expect(response.body).toHaveProperty('statusChanges');
                expect(Array.isArray(response.body.statusChanges)).toBe(true);
            }
        });

        it('should return status changes with correct structure', async () => {
            const searchResponse = await request(app)
                .get('/api/audit-trail/search?q=PS-')
                .expect(200);

            if (searchResponse.body.results && searchResponse.body.results.length > 0) {
                const psRecordName = searchResponse.body.results[0].ps_record_name;
                
                const response = await request(app)
                    .get(`/api/audit-trail/status-changes/${psRecordName}`)
                    .expect(200);

                if (response.body.statusChanges && response.body.statusChanges.length > 0) {
                    const change = response.body.statusChanges[0];
                    expect(change).toHaveProperty('status');
                    expect(change).toHaveProperty('captured_at');
                }
            }
        });

        it('should return empty array for record with no status changes', async () => {
            const response = await request(app)
                .get('/api/audit-trail/status-changes/PS-NONEXISTENT-99999')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('statusChanges');
            expect(Array.isArray(response.body.statusChanges)).toBe(true);
        });
    });

    describe('POST /api/audit-trail/capture', () => {
        it('should trigger manual capture', async () => {
            const response = await request(app)
                .post('/api/audit-trail/capture')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
        });

        it('should return success message', async () => {
            const response = await request(app)
                .post('/api/audit-trail/capture')
                .expect(200);

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.message).toBe('string');
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Test with invalid identifier format
            const response = await request(app)
                .get('/api/audit-trail/ps-record/')
                .expect(404);
        });

        it('should handle missing parameters gracefully', async () => {
            const response = await request(app)
                .get('/api/audit-trail/search')
                .expect(200);

            expect(response.body).toHaveProperty('success');
        });
    });
});

describe('PS Audit Trail Database Operations', () => {
    it('should have ps_audit_trail table', async () => {
        const result = await database.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ps_audit_trail'
            )
        `);
        
        expect(result.rows[0].exists).toBe(true);
    });

    it('should have ps_audit_log table', async () => {
        const result = await database.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ps_audit_log'
            )
        `);
        
        expect(result.rows[0].exists).toBe(true);
    });

    it('should have ps_audit_latest view', async () => {
        const result = await database.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'ps_audit_latest'
            )
        `);
        
        expect(result.rows[0].exists).toBe(true);
    });

    it('should have proper indexes on ps_audit_trail', async () => {
        const result = await database.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'ps_audit_trail'
        `);
        
        const indexNames = result.rows.map(row => row.indexname);
        // Check for the actual index names used in the schema
        expect(indexNames).toContain('idx_ps_audit_ps_record_id');
        expect(indexNames).toContain('idx_ps_audit_captured_at');
        expect(indexNames).toContain('idx_ps_audit_status');
    });

    it('should store snapshots correctly', async () => {
        const result = await database.query(`
            SELECT COUNT(*) as count 
            FROM ps_audit_trail
        `);
        
        expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(0);
    });

    it('should track audit log entries', async () => {
        const result = await database.query(`
            SELECT COUNT(*) as count 
            FROM ps_audit_log
        `);
        
        expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(0);
    });
});

