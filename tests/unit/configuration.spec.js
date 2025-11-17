/**
 * Unit Tests for Configuration Module
 * Tests centralized configuration management
 */

describe('Configuration Module', () => {
    let config;
    let originalEnv;

    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };
        
        // Clear require cache to get fresh config
        jest.resetModules();
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('App Configuration', () => {
        it('should load app configuration with defaults', () => {
            config = require('../../config/environment');

            expect(config.app).toBeDefined();
            expect(config.app.name).toBe('DeployAssist');
            expect(config.app.port).toBe(5000);
            expect(config.app.env).toBeDefined();
        });

        it('should use PORT from environment', () => {
            process.env.PORT = '3000';
            config = require('../../config/environment');

            expect(config.app.port).toBe(3000);
        });

        it('should detect development environment', () => {
            process.env.NODE_ENV = 'development';
            config = require('../../config/environment');

            expect(config.app.env).toBe('development');
            expect(config.app.isDevelopment).toBe(true);
            expect(config.app.isProduction).toBe(false);
            expect(config.app.isTest).toBe(false);
        });

        it('should detect production environment', () => {
            process.env.NODE_ENV = 'production';
            config = require('../../config/environment');

            expect(config.app.env).toBe('production');
            expect(config.app.isDevelopment).toBe(false);
            expect(config.app.isProduction).toBe(true);
            expect(config.app.isTest).toBe(false);
        });

        it('should detect test environment', () => {
            process.env.NODE_ENV = 'test';
            config = require('../../config/environment');

            expect(config.app.isTest).toBe(true);
        });
    });

    describe('Database Configuration', () => {
        it('should load database configuration', () => {
            process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
            config = require('../../config/environment');

            expect(config.database).toBeDefined();
            expect(config.database.url).toBe('postgresql://localhost:5432/test');
            expect(config.database.poolSize).toBe(10);
        });

        it('should use custom pool size', () => {
            process.env.DB_POOL_SIZE = '20';
            config = require('../../config/environment');

            expect(config.database.poolSize).toBe(20);
        });

        it('should handle SSL configuration', () => {
            process.env.DATABASE_SSL = 'true';
            config = require('../../config/environment');

            expect(config.database.ssl).toBe(true);
        });
    });

    describe('Salesforce Configuration', () => {
        it('should load Salesforce configuration', () => {
            process.env.SF_CLIENT_ID = 'test-client-id';
            process.env.SF_CLIENT_SECRET = 'test-secret';
            config = require('../../config/environment');

            expect(config.salesforce).toBeDefined();
            expect(config.salesforce.clientId).toBe('test-client-id');
            expect(config.salesforce.clientSecret).toBe('test-secret');
            expect(config.salesforce.apiVersion).toBe('58.0');
        });

        it('should use custom API version', () => {
            process.env.SF_API_VERSION = '59.0';
            config = require('../../config/environment');

            expect(config.salesforce.apiVersion).toBe('59.0');
        });
    });

    describe('Authentication Configuration', () => {
        it('should load auth configuration', () => {
            process.env.JWT_SECRET = 'test-secret';
            config = require('../../config/environment');

            expect(config.auth).toBeDefined();
            expect(config.auth.jwtSecret).toBe('test-secret');
            expect(config.auth.sessionTimeout).toBe(3600);
            expect(config.auth.bcryptRounds).toBe(10);
        });

        it('should use custom session timeout', () => {
            process.env.SESSION_TIMEOUT = '7200';
            config = require('../../config/environment');

            expect(config.auth.sessionTimeout).toBe(7200);
        });
    });

    describe('Feature Flags', () => {
        it('should have feature flags enabled by default', () => {
            config = require('../../config/environment');

            expect(config.features.enableSML).toBe(true);
            expect(config.features.enableJira).toBe(true);
            expect(config.features.enableAuditTrail).toBe(true);
            expect(config.features.enableExpirationMonitor).toBe(true);
        });

        it('should allow disabling features', () => {
            process.env.ENABLE_SML = 'false';
            process.env.ENABLE_JIRA = 'false';
            config = require('../../config/environment');

            expect(config.features.enableSML).toBe(false);
            expect(config.features.enableJira).toBe(false);
        });
    });

    describe('Helper Methods', () => {
        beforeEach(() => {
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.JWT_SECRET = 'secret';
            config = require('../../config/environment');
        });

        describe('get()', () => {
            it('should get configuration value by path', () => {
                const port = config.get('app.port');
                expect(port).toBe(5000);
            });

            it('should get nested configuration value', () => {
                const apiVersion = config.get('salesforce.apiVersion');
                expect(apiVersion).toBe('58.0');
            });

            it('should return default value if path not found', () => {
                const value = config.get('non.existent.path', 'default');
                expect(value).toBe('default');
            });

            it('should return undefined if no default provided', () => {
                const value = config.get('non.existent.path');
                expect(value).toBeUndefined();
            });
        });

        describe('isFeatureEnabled()', () => {
            it('should return true for enabled features', () => {
                expect(config.isFeatureEnabled('enableSML')).toBe(true);
            });

            it('should return false for disabled features', () => {
                process.env.ENABLE_SML = 'false';
                config = require('../../config/environment');
                
                expect(config.isFeatureEnabled('enableSML')).toBe(false);
            });
        });

        describe('getSalesforceStatus()', () => {
            it('should return Salesforce configuration status', () => {
                process.env.SF_CLIENT_ID = 'client-id';
                process.env.SF_CLIENT_SECRET = 'secret';
                process.env.SF_USERNAME = 'user';
                process.env.SF_PASSWORD = 'pass';
                config = require('../../config/environment');

                const status = config.getSalesforceStatus();

                expect(status).toHaveProperty('configured', true);
                expect(status).toHaveProperty('hasCredentials', true);
                expect(status).toHaveProperty('loginUrl');
            });

            it('should detect incomplete configuration', () => {
                config = require('../../config/environment');
                const status = config.getSalesforceStatus();

                expect(status.configured).toBe(false);
            });
        });

        describe('getDatabasePoolConfig()', () => {
            it('should return database pool configuration', () => {
                process.env.DATABASE_URL = 'postgresql://localhost/test';
                process.env.DB_POOL_SIZE = '15';
                config = require('../../config/environment');

                const poolConfig = config.getDatabasePoolConfig();

                expect(poolConfig).toHaveProperty('connectionString');
                expect(poolConfig).toHaveProperty('ssl');
                expect(poolConfig).toHaveProperty('max', 15);
                expect(poolConfig).toHaveProperty('idleTimeoutMillis');
                expect(poolConfig).toHaveProperty('connectionTimeoutMillis');
            });

            it('should configure SSL for production', () => {
                process.env.DATABASE_SSL = 'true';
                config = require('../../config/environment');

                const poolConfig = config.getDatabasePoolConfig();

                expect(poolConfig.ssl).toEqual({ rejectUnauthorized: false });
            });

            it('should disable SSL when not required', () => {
                process.env.DATABASE_SSL = 'false';
                config = require('../../config/environment');

                const poolConfig = config.getDatabasePoolConfig();

                expect(poolConfig.ssl).toBe(false);
            });
        });

        describe('validateConfig()', () => {
            it('should validate required configuration', () => {
                process.env.DATABASE_URL = 'postgresql://localhost/test';
                process.env.JWT_SECRET = 'secret';
                
                config = require('../../config/environment');

                expect(() => config.validateConfig()).not.toThrow();
            });

            it('should throw error for missing DATABASE_URL', () => {
                delete process.env.DATABASE_URL;
                process.env.JWT_SECRET = 'secret';
                process.env.NODE_ENV = 'production';
                
                expect(() => {
                    config = require('../../config/environment');
                }).toThrow();
            });

            it('should throw error for missing JWT_SECRET', () => {
                process.env.DATABASE_URL = 'postgresql://localhost/test';
                delete process.env.JWT_SECRET;
                process.env.NODE_ENV = 'production';
                
                expect(() => {
                    config = require('../../config/environment');
                }).toThrow();
            });
        });
    });

    describe('Server Configuration', () => {
        it('should load CORS configuration', () => {
            process.env.CORS_ORIGIN = 'http://localhost:3000';
            process.env.CORS_CREDENTIALS = 'true';
            config = require('../../config/environment');

            expect(config.server.cors.origin).toBe('http://localhost:3000');
            expect(config.server.cors.credentials).toBe(true);
        });

        it('should load rate limit configuration', () => {
            process.env.RATE_LIMIT_WINDOW = '600000';
            process.env.RATE_LIMIT_MAX = '200';
            config = require('../../config/environment');

            expect(config.server.rateLimit.windowMs).toBe(600000);
            expect(config.server.rateLimit.max).toBe(200);
        });
    });

    describe('Jira Configuration', () => {
        it('should detect Jira configuration', () => {
            process.env.ATLASSIAN_EMAIL = 'test@example.com';
            process.env.ATLASSIAN_API_TOKEN = 'token';
            config = require('../../config/environment');

            expect(config.jira.enabled).toBe(true);
            expect(config.jira.email).toBe('test@example.com');
            expect(config.jira.apiToken).toBe('token');
        });

        it('should detect missing Jira configuration', () => {
            delete process.env.ATLASSIAN_EMAIL;
            delete process.env.ATLASSIAN_API_TOKEN;
            config = require('../../config/environment');

            expect(config.jira.enabled).toBe(false);
        });
    });

    describe('Logging Configuration', () => {
        it('should load logging configuration', () => {
            process.env.LOG_LEVEL = 'debug';
            process.env.LOG_FORMAT = 'pretty';
            process.env.LOG_TO_FILE = 'true';
            config = require('../../config/environment');

            expect(config.logging.level).toBe('debug');
            expect(config.logging.format).toBe('pretty');
            expect(config.logging.logToFile).toBe(true);
        });
    });
});



