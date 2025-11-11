/**
 * Centralized Configuration Module
 * All environment variables and configuration settings in one place
 */

require('dotenv').config();

const config = {
    // Application Configuration
    app: {
        name: 'DeployAssist',
        port: parseInt(process.env.PORT || '5000', 10),
        env: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
        isProduction: process.env.NODE_ENV === 'production',
        isTest: process.env.NODE_ENV === 'test'
    },

    // Database Configuration
    database: {
        url: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10)
    },

    // Salesforce Configuration
    salesforce: {
        loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
        clientId: process.env.SF_CLIENT_ID,
        clientSecret: process.env.SF_CLIENT_SECRET,
        redirectUri: process.env.SF_REDIRECT_URI,
        username: process.env.SF_USERNAME,
        password: process.env.SF_PASSWORD,
        securityToken: process.env.SF_SECURITY_TOKEN,
        apiVersion: process.env.SF_API_VERSION || '58.0'
    },

    // Authentication Configuration
    auth: {
        jwtSecret: process.env.JWT_SECRET,
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10), // 1 hour default
        cookieSecret: process.env.COOKIE_SECRET,
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10)
    },

    // Jira/Atlassian Configuration
    jira: {
        email: process.env.ATLASSIAN_EMAIL,
        apiToken: process.env.ATLASSIAN_API_TOKEN,
        siteUrl: process.env.ATLASSIAN_SITE_URL,
        cloudId: process.env.ATLASSIAN_CLOUD_ID,
        enabled: !!(process.env.ATLASSIAN_EMAIL && process.env.ATLASSIAN_API_TOKEN)
    },

    // SML Configuration
    sml: {
        baseUrl: process.env.SML_BASE_URL,
        apiTimeout: parseInt(process.env.SML_API_TIMEOUT || '30000', 10),
        enabled: !!process.env.SML_BASE_URL
    },

    // Server Configuration
    server: {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            credentials: process.env.CORS_CREDENTIALS === 'true'
        },
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
        }
    },

    // Feature Flags
    features: {
        enableSML: process.env.ENABLE_SML !== 'false',
        enableJira: process.env.ENABLE_JIRA !== 'false',
        enableAuditTrail: process.env.ENABLE_AUDIT_TRAIL !== 'false',
        enableExpirationMonitor: process.env.ENABLE_EXPIRATION_MONITOR !== 'false'
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        logToFile: process.env.LOG_TO_FILE === 'true',
        logFilePath: process.env.LOG_FILE_PATH || './logs/app.log'
    }
};

/**
 * Validate required configuration
 * @throws {Error} If required configuration is missing
 */
function validateConfig() {
    const required = {
        'DATABASE_URL': config.database.url,
        'JWT_SECRET': config.auth.jwtSecret
    };

    const missing = Object.keys(required).filter(key => !required[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

/**
 * Get configuration value by path
 * @param {String} path - Dot-notated path (e.g., 'database.url')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Configuration value
 */
function get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = config;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }

    return value !== undefined ? value : defaultValue;
}

/**
 * Check if feature is enabled
 * @param {String} featureName - Feature name
 * @returns {Boolean} True if enabled
 */
function isFeatureEnabled(featureName) {
    return config.features[featureName] === true;
}

/**
 * Get Salesforce configuration status
 * @returns {Object} Salesforce config status
 */
function getSalesforceStatus() {
    return {
        configured: !!(config.salesforce.clientId && config.salesforce.clientSecret),
        hasCredentials: !!(config.salesforce.username && config.salesforce.password),
        loginUrl: config.salesforce.loginUrl
    };
}

/**
 * Get database configuration for pg Pool
 * @returns {Object} Database pool configuration
 */
function getDatabasePoolConfig() {
    return {
        connectionString: config.database.url,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        max: config.database.poolSize,
        idleTimeoutMillis: config.database.idleTimeout,
        connectionTimeoutMillis: config.database.connectionTimeout
    };
}

// Validate configuration on module load (only in non-test environments)
if (!config.app.isTest) {
    try {
        validateConfig();
    } catch (error) {
        console.error('❌ Configuration Error:', error.message);
        if (config.app.isProduction) {
            process.exit(1);
        }
    }
}

module.exports = {
    ...config,
    get,
    isFeatureEnabled,
    getSalesforceStatus,
    getDatabasePoolConfig,
    validateConfig
};


