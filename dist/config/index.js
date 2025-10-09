"use strict";
/**
 * Application Configuration
 * Centralized configuration management with validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.configureSSL = configureSSL;
exports.validateConfig = validateConfig;
exports.printConfig = printConfig;
exports.getHttpsAgent = getHttpsAgent;
const dotenv_1 = __importDefault(require("dotenv"));
const errors_1 = require("../middleware/errors");
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
// Load environment variables
dotenv_1.default.config();
/**
 * Get required environment variable or throw error
 */
function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new errors_1.ConfigurationError(`Missing required environment variable: ${key}`);
    }
    return value;
}
/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key, defaultValue) {
    return process.env[key] || defaultValue;
}
/**
 * Configure SSL/TLS settings properly
 * Instead of disabling SSL validation globally, configure it per-connection
 */
function configureSSL() {
    const sslMode = process.env.SSL_MODE || 'strict';
    if (sslMode === 'disabled') {
        console.warn('⚠️  WARNING: SSL certificate validation is DISABLED');
        console.warn('⚠️  This is insecure and should only be used in development');
        console.warn('⚠️  Set SSL_MODE=strict and configure proper certificates for production');
        // Only disable if explicitly set
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    else if (sslMode === 'custom') {
        // Use custom CA certificates
        const caPath = process.env.SSL_CA_PATH;
        if (caPath && fs.existsSync(caPath)) {
            const ca = fs.readFileSync(caPath);
            https.globalAgent.options.ca = ca;
            console.log('✅ Using custom CA certificates from:', caPath);
        }
        else {
            throw new errors_1.ConfigurationError('SSL_MODE is set to "custom" but SSL_CA_PATH is not configured or file not found');
        }
    }
    else {
        // Strict mode (default) - use system certificates
        console.log('✅ SSL certificate validation enabled (strict mode)');
    }
}
/**
 * Application Configuration Object
 */
exports.config = {
    // Server configuration
    port: parseInt(getOptionalEnv('PORT', '8080'), 10),
    nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
    enableSSL: getOptionalEnv('SSL_MODE', 'strict') !== 'disabled',
    // Database configuration
    database: {
        host: getOptionalEnv('DB_HOST', 'localhost'),
        port: parseInt(getOptionalEnv('DB_PORT', '5432'), 10),
        database: getOptionalEnv('DB_NAME', 'deployment_assistant'),
        user: getOptionalEnv('DB_USER', 'app_user'),
        password: getOptionalEnv('DB_PASSWORD', 'secure_password_123'),
        maxConnections: parseInt(getOptionalEnv('DB_POOL_MAX', '10'), 10)
    },
    // Salesforce configuration
    salesforce: {
        loginUrl: getRequiredEnv('SF_LOGIN_URL'),
        clientId: getRequiredEnv('SF_CLIENT_ID'),
        clientSecret: getRequiredEnv('SF_CLIENT_SECRET'),
        redirectUri: getRequiredEnv('SF_REDIRECT_URI'),
        tokenFile: getOptionalEnv('SF_TOKEN_FILE', '.salesforce_auth.json')
    },
    // Atlassian configuration (optional)
    atlassian: process.env.ATLASSIAN_EMAIL ? {
        email: getRequiredEnv('ATLASSIAN_EMAIL'),
        apiToken: getRequiredEnv('ATLASSIAN_API_TOKEN'),
        siteUrl: getRequiredEnv('ATLASSIAN_SITE_URL'),
        cloudId: process.env.ATLASSIAN_CLOUD_ID
    } : undefined
};
/**
 * Validate configuration on startup
 */
function validateConfig() {
    console.log('🔧 Validating configuration...');
    // Validate port
    if (exports.config.port < 1 || exports.config.port > 65535) {
        throw new errors_1.ConfigurationError(`Invalid port number: ${exports.config.port}`);
    }
    // Validate database config
    if (!exports.config.database.host) {
        throw new errors_1.ConfigurationError('Database host is required');
    }
    // Validate Salesforce config
    if (!exports.config.salesforce.loginUrl.startsWith('https://')) {
        throw new errors_1.ConfigurationError('Salesforce login URL must use HTTPS');
    }
    console.log('✅ Configuration validated successfully');
}
/**
 * Print configuration (sanitized)
 */
function printConfig() {
    console.log('📋 Application Configuration:');
    console.log(`   Environment: ${exports.config.nodeEnv}`);
    console.log(`   Port: ${exports.config.port}`);
    console.log(`   Log Level: ${exports.config.logLevel}`);
    console.log(`   Database: ${exports.config.database.host}:${exports.config.database.port}/${exports.config.database.database}`);
    console.log(`   Salesforce: ${exports.config.salesforce.loginUrl}`);
    if (exports.config.atlassian) {
        console.log(`   Atlassian: ${exports.config.atlassian.siteUrl}`);
    }
}
// Export configured https agent for use in external API calls
function getHttpsAgent() {
    const sslMode = process.env.SSL_MODE || 'strict';
    if (sslMode === 'disabled') {
        return new https.Agent({
            rejectUnauthorized: false
        });
    }
    else if (sslMode === 'custom') {
        const caPath = process.env.SSL_CA_PATH;
        if (caPath && fs.existsSync(caPath)) {
            const ca = fs.readFileSync(caPath);
            return new https.Agent({
                ca,
                rejectUnauthorized: true
            });
        }
    }
    // Default: use system certificates with strict validation
    return new https.Agent({
        rejectUnauthorized: true
    });
}
exports.default = exports.config;
//# sourceMappingURL=index.js.map