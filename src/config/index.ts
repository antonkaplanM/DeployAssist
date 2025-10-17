/**
 * Application Configuration
 * Centralized configuration management with validation
 */

import dotenv from 'dotenv';
import { AppConfig } from '../types/common.types';
import { ConfigurationError } from '../middleware/errors';
import * as fs from 'fs';
import * as https from 'https';

// Load environment variables
dotenv.config();

/**
 * Get required environment variable or throw error
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Configure SSL/TLS settings properly
 * Instead of disabling SSL validation globally, configure it per-connection
 */
export function configureSSL(): void {
  const sslMode = process.env.SSL_MODE || 'strict';
  
  if (sslMode === 'disabled') {
    console.warn('⚠️  WARNING: SSL certificate validation is DISABLED');
    console.warn('⚠️  This is insecure and should only be used in development');
    console.warn('⚠️  Set SSL_MODE=strict and configure proper certificates for production');
    
    // Only disable if explicitly set
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  } else if (sslMode === 'custom') {
    // Use custom CA certificates
    const caPath = process.env.SSL_CA_PATH;
    if (caPath && fs.existsSync(caPath)) {
      const ca = fs.readFileSync(caPath);
      https.globalAgent.options.ca = ca;
      console.log('✅ Using custom CA certificates from:', caPath);
    } else {
      throw new ConfigurationError(
        'SSL_MODE is set to "custom" but SSL_CA_PATH is not configured or file not found'
      );
    }
  } else {
    // Strict mode (default) - use system certificates
    console.log('✅ SSL certificate validation enabled (strict mode)');
  }
}

/**
 * Application Configuration Object
 */
export const config: AppConfig = {
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
  } : undefined,
  
  // Authentication configuration
  auth: {
    jwtSecret: getRequiredEnv('JWT_SECRET'),
    defaultAdminUsername: getOptionalEnv('DEFAULT_ADMIN_USERNAME', 'admin'),
    defaultAdminPassword: getRequiredEnv('DEFAULT_ADMIN_PASSWORD'),
    defaultAdminFullName: getOptionalEnv('DEFAULT_ADMIN_FULL_NAME', 'System Administrator')
  }
};

/**
 * Validate configuration on startup
 */
export function validateConfig(): void {
  console.log('🔧 Validating configuration...');
  
  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new ConfigurationError(`Invalid port number: ${config.port}`);
  }
  
  // Validate database config
  if (!config.database.host) {
    throw new ConfigurationError('Database host is required');
  }
  
  // Validate Salesforce config
  if (!config.salesforce.loginUrl.startsWith('https://')) {
    throw new ConfigurationError('Salesforce login URL must use HTTPS');
  }
  
  console.log('✅ Configuration validated successfully');
}

/**
 * Print configuration (sanitized)
 */
export function printConfig(): void {
  console.log('📋 Application Configuration:');
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Log Level: ${config.logLevel}`);
  console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log(`   Salesforce: ${config.salesforce.loginUrl}`);
  if (config.atlassian) {
    console.log(`   Atlassian: ${config.atlassian.siteUrl}`);
  }
}

// Export configured https agent for use in external API calls
export function getHttpsAgent(): https.Agent {
  const sslMode = process.env.SSL_MODE || 'strict';
  
  if (sslMode === 'disabled') {
    return new https.Agent({
      rejectUnauthorized: false
    });
  } else if (sslMode === 'custom') {
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

export default config;

