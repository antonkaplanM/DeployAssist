/**
 * Authentication API Integration Tests
 * Tests the authentication endpoints and user management API
 */

const request = require('supertest');
const { pool } = require('../../database');

// Note: These tests require the app to be running and database to be set up
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8080';

describe('Authentication API', () => {
    let agent;
    let adminCookie;
    let testUserId;

    beforeAll(async () => {
        agent = request.agent(baseURL);
    });

    afterAll(async () => {
        // Clean up test users
        if (testUserId) {
            try {
                await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
            } catch (error) {
                console.log('Cleanup error (may be expected):', error.message);
            }
        }
        await pool.end();
    });

    describe('POST /api/auth/login', () => {
        it('should reject login with invalid credentials', async () => {
            const response = await agent
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid');
        });

        it('should successfully login with valid admin credentials', async () => {
            const response = await agent
                .post('/api/auth/login')
                .send({
                    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                    password: process.env.DEFAULT_ADMIN_PASSWORD
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.username).toBe(process.env.DEFAULT_ADMIN_USERNAME || 'admin');
            expect(response.body.user.roles).toContainEqual(
                expect.objectContaining({ name: 'admin' })
            );

            // Save cookie for subsequent tests
            adminCookie = response.headers['set-cookie'];
            expect(adminCookie).toBeDefined();
        });

        it('should reject login with missing password', async () => {
            const response = await agent
                .post('/api/auth/login')
                .send({
                    username: 'admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user info when authenticated', async () => {
            const response = await agent
                .get('/api/auth/me')
                .set('Cookie', adminCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.username).toBe(process.env.DEFAULT_ADMIN_USERNAME || 'admin');
        });

        it('should return 401 when not authenticated', async () => {
            const response = await request(baseURL)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should successfully logout', async () => {
            // First login
            const loginResponse = await agent
                .post('/api/auth/login')
                .send({
                    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                    password: process.env.DEFAULT_ADMIN_PASSWORD
                });

            const cookie = loginResponse.headers['set-cookie'];

            // Then logout
            const response = await agent
                .post('/api/auth/logout')
                .set('Cookie', cookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify cookie is cleared
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies[0]).toContain('token=;');
        });
    });
});

describe('User Management API', () => {
    let agent;
    let adminCookie;
    let testUserId;

    beforeAll(async () => {
        agent = request.agent(baseURL);
        
        // Login as admin
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                password: process.env.DEFAULT_ADMIN_PASSWORD
            });

        adminCookie = loginResponse.headers['set-cookie'];
    });

    afterAll(async () => {
        // Clean up test user
        if (testUserId) {
            try {
                await agent
                    .delete(`/api/users/${testUserId}`)
                    .set('Cookie', adminCookie);
            } catch (error) {
                console.log('Cleanup error:', error.message);
            }
        }
    });

    describe('GET /api/users', () => {
        it('should return list of users for admin', async () => {
            const response = await agent
                .get('/api/users')
                .set('Cookie', adminCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.users)).toBe(true);
            expect(response.body.users.length).toBeGreaterThan(0);
        });

        it('should return 401 for unauthenticated request', async () => {
            const response = await request(baseURL)
                .get('/api/users');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/users', () => {
        it('should create new user with valid data', async () => {
            const roleResponse = await agent
                .get('/api/users/roles/all')
                .set('Cookie', adminCookie);

            const userRole = roleResponse.body.roles.find(r => r.name === 'user');

            const response = await agent
                .post('/api/users')
                .set('Cookie', adminCookie)
                .send({
                    username: 'testuser_' + Date.now(),
                    password: 'TestPassword123',
                    full_name: 'Test User',
                    roleIds: [userRole.id]
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            testUserId = response.body.user.id;
        });

        it('should reject user creation with weak password', async () => {
            const response = await agent
                .post('/api/users')
                .set('Cookie', adminCookie)
                .send({
                    username: 'testuser2',
                    password: 'weak',
                    full_name: 'Test User 2',
                    roleIds: [1]
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('8 characters');
        });

        it('should reject duplicate username', async () => {
            const response = await agent
                .post('/api/users')
                .set('Cookie', adminCookie)
                .send({
                    username: 'admin',
                    password: 'TestPassword123',
                    full_name: 'Duplicate Admin',
                    roleIds: [1]
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('exists');
        });
    });

    describe('GET /api/users/roles/all', () => {
        it('should return list of all roles', async () => {
            const response = await agent
                .get('/api/users/roles/all')
                .set('Cookie', adminCookie);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.roles)).toBe(true);
            expect(response.body.roles.length).toBeGreaterThanOrEqual(2);

            const adminRole = response.body.roles.find(r => r.name === 'admin');
            expect(adminRole).toBeDefined();
            expect(adminRole.is_system_role).toBe(true);
        });
    });

    describe('POST /api/users/roles', () => {
        let customRoleId;

        afterAll(async () => {
            if (customRoleId) {
                try {
                    await agent
                        .delete(`/api/users/roles/${customRoleId}`)
                        .set('Cookie', adminCookie);
                } catch (error) {
                    console.log('Role cleanup error:', error.message);
                }
            }
        });

        it('should create custom role', async () => {
            const response = await agent
                .post('/api/users/roles')
                .set('Cookie', adminCookie)
                .send({
                    name: 'test_role_' + Date.now(),
                    description: 'Test Role for Integration Tests'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.role).toBeDefined();
            expect(response.body.role.is_system_role).toBe(false);
            customRoleId = response.body.role.id;
        });

        it('should reject duplicate role name', async () => {
            const response = await agent
                .post('/api/users/roles')
                .set('Cookie', adminCookie)
                .send({
                    name: 'admin',
                    description: 'Duplicate admin role'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('exists');
        });
    });
});

describe('Password Management', () => {
    let agent;
    let adminCookie;

    beforeAll(async () => {
        agent = request.agent(baseURL);
        
        // Login as admin
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({
                username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
                password: process.env.DEFAULT_ADMIN_PASSWORD
            });

        adminCookie = loginResponse.headers['set-cookie'];
    });

    describe('PUT /api/auth/password', () => {
        it('should validate password complexity', async () => {
            const response = await agent
                .put('/api/auth/password')
                .set('Cookie', adminCookie)
                .send({
                    currentPassword: process.env.DEFAULT_ADMIN_PASSWORD,
                    newPassword: 'weak'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('8 characters');
        });
    });
});

