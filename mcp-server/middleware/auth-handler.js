const config = require('../config/mcp-config');

/**
 * Authentication Handler
 * Validates user authentication for MCP tool invocations
 */
class AuthHandler {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.mode = config.auth.mode;
    this.serviceAccountToken = config.auth.serviceAccountToken;
  }
  
  /**
   * Validate authentication token
   * @param {string} token - JWT token from request
   * @returns {Promise<Object>} User info
   */
  async validate(token) {
    if (!token) {
      throw new Error('Authentication token is required');
    }
    
    try {
      // Set token on API client
      this.apiClient.setAuthToken(token);
      
      // Validate token by calling a protected endpoint
      // We'll use the /api/auth/me endpoint (if it exists) or health check
      const response = await this.apiClient.get('/api/health/database');
      
      if (response.status === 200) {
        return {
          valid: true,
          token: token,
        };
      }
      
      throw new Error('Invalid authentication token');
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        throw new Error('Authentication failed: Invalid or expired token');
      }
      throw error;
    }
  }
  
  /**
   * Check if user has access to a specific page
   * @param {string} pageName - Name of the page to check
   * @returns {Promise<boolean>}
   */
  async checkPageAccess(pageName) {
    // For now, we'll assume all authenticated users have access
    // In production, this should query the page_entitlements system
    // TODO: Implement actual page entitlement checking
    return true;
  }
  
  /**
   * Get auth token from environment or context
   * @param {Object} context - Request context
   * @returns {string|null}
   */
  getTokenFromContext(context) {
    // Check if token is in environment (from MCP client config)
    if (process.env.AUTH_TOKEN) {
      return process.env.AUTH_TOKEN;
    }
    
    // Check if token is in context metadata
    if (context && context._meta && context._meta.auth_token) {
      return context._meta.auth_token;
    }
    
    // If using service account mode, return service account token
    if (this.mode === 'service_account' && this.serviceAccountToken) {
      return this.serviceAccountToken;
    }
    
    return null;
  }
  
  /**
   * Create authenticated context for tool execution
   * @param {string} token - JWT token
   * @returns {Object} Context with auth info
   */
  async createContext(token) {
    const authInfo = await this.validate(token);
    
    return {
      auth: {
        valid: true,
        token: token,
        mode: this.mode,
        validate: async () => authInfo,
        checkPageAccess: async (pageName) => this.checkPageAccess(pageName),
      },
      apiClient: this.apiClient,
    };
  }
}

module.exports = AuthHandler;





