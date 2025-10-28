require('dotenv').config();

/**
 * MCP Server Configuration
 */
module.exports = {
  // Server Identity
  serverName: process.env.MCP_SERVER_NAME || 'deployassist-mcp',
  serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
  
  // Server Settings
  enabled: process.env.MCP_SERVER_ENABLED !== 'false',
  port: parseInt(process.env.MCP_SERVER_PORT) || 3001,
  
  // Internal API Configuration
  internalApi: {
    url: process.env.INTERNAL_API_URL || 'http://localhost:5000',
    timeout: parseInt(process.env.INTERNAL_API_TIMEOUT) || 30000,
  },
  
  // Authentication
  auth: {
    mode: process.env.MCP_AUTH_MODE || 'passthrough', // 'passthrough' or 'service_account'
    serviceAccountToken: process.env.MCP_SERVICE_ACCOUNT_TOKEN || '',
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer',
  },
  
  // Security & Rate Limiting
  security: {
    rateLimitPerUser: parseInt(process.env.MCP_RATE_LIMIT_PER_USER) || 100, // per minute
    rateLimitPerTool: parseInt(process.env.MCP_RATE_LIMIT_PER_TOOL) || 20,  // per minute
    rateLimitGlobal: parseInt(process.env.MCP_RATE_LIMIT_GLOBAL) || 1000,   // per minute
  },
  
  // Logging
  logging: {
    auditLogging: process.env.MCP_AUDIT_LOGGING !== 'false',
    level: process.env.MCP_LOG_LEVEL || 'info', // debug, info, warn, error
    logToFile: process.env.MCP_LOG_TO_FILE === 'true',
    logFilePath: process.env.MCP_LOG_FILE_PATH || './logs/mcp-server.log',
  },
  
  // Feature Flags
  features: {
    writeOperationsEnabled: process.env.MCP_ENABLE_WRITE_OPS === 'true',
    cachingEnabled: process.env.MCP_ENABLE_CACHING === 'true',
    cacheTimeout: parseInt(process.env.MCP_CACHE_TIMEOUT) || 60000, // 1 minute
  },
};






