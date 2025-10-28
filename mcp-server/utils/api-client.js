const axios = require('axios');
const config = require('../config/mcp-config');

/**
 * API Client for making requests to the internal DeployAssist API
 */
class ApiClient {
  constructor(authToken = null) {
    this.authToken = authToken;
    this.baseURL = config.internalApi.url;
    this.timeout = config.internalApi.timeout;
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add auth token if provided
    if (this.authToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          // Server responded with error status
          const apiError = new Error(error.response.data?.message || error.message);
          apiError.status = error.response.status;
          apiError.code = error.response.data?.code;
          throw apiError;
        } else if (error.request) {
          // Request made but no response received
          throw new Error('No response from API server. Is the application running?');
        } else {
          // Error setting up the request
          throw new Error(`API request error: ${error.message}`);
        }
      }
    );
  }
  
  /**
   * Make GET request
   */
  async get(path, options = {}) {
    const startTime = Date.now();
    try {
      const response = await this.client.get(path, options);
      const duration = Date.now() - startTime;
      return {
        data: response.data,
        status: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw this._enrichError(error, 'GET', path, duration);
    }
  }
  
  /**
   * Make POST request
   */
  async post(path, data = {}, options = {}) {
    const startTime = Date.now();
    try {
      const response = await this.client.post(path, data, options);
      const duration = Date.now() - startTime;
      return {
        data: response.data,
        status: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw this._enrichError(error, 'POST', path, duration);
    }
  }
  
  /**
   * Make PATCH request
   */
  async patch(path, data = {}, options = {}) {
    const startTime = Date.now();
    try {
      const response = await this.client.patch(path, data, options);
      const duration = Date.now() - startTime;
      return {
        data: response.data,
        status: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw this._enrichError(error, 'PATCH', path, duration);
    }
  }
  
  /**
   * Make DELETE request
   */
  async delete(path, options = {}) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(path, options);
      const duration = Date.now() - startTime;
      return {
        data: response.data,
        status: response.status,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      throw this._enrichError(error, 'DELETE', path, duration);
    }
  }
  
  /**
   * Test API connectivity
   */
  async testConnection() {
    try {
      const response = await this.get('/health');
      return {
        connected: true,
        status: response.status,
        message: 'API connection successful',
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        message: 'Failed to connect to API',
      };
    }
  }
  
  /**
   * Enrich error with additional context
   */
  _enrichError(error, method, path, duration) {
    error.method = method;
    error.path = path;
    error.duration = duration;
    return error;
  }
  
  /**
   * Set auth token (for updating during runtime)
   */
  setAuthToken(token) {
    this.authToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  /**
   * Clear auth token
   */
  clearAuthToken() {
    this.authToken = null;
    delete this.client.defaults.headers.common['Authorization'];
  }
}

module.exports = ApiClient;






