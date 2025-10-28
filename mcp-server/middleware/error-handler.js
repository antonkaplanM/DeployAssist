const ResponseFormatter = require('../utils/response-formatter');

/**
 * Error Handler
 * Centralized error handling for MCP tools
 */
class ErrorHandler {
  constructor() {
    this.formatter = new ResponseFormatter();
  }
  
  /**
   * Handle tool execution error
   * @param {Error} error - Error object
   * @param {string} toolName - Name of the tool that failed
   * @returns {Object} Formatted error response
   */
  handle(error, toolName = 'unknown') {
    // Log error
    console.error(`[MCP Error] Tool: ${toolName}`, {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    
    // Classify and format error
    if (this._isAuthError(error)) {
      return this.formatter.authError(error.message);
    }
    
    if (this._isPermissionError(error)) {
      return this.formatter.permissionError(error.message);
    }
    
    if (this._isValidationError(error)) {
      return this.formatter.validationError(error.message);
    }
    
    if (this._isRateLimitError(error)) {
      return this.formatter.rateLimitError(error.message);
    }
    
    if (this._isNotFoundError(error)) {
      return this.formatter.error(error, 'NOT_FOUND');
    }
    
    // Generic error
    return this.formatter.error(error);
  }
  
  /**
   * Check if error is authentication related
   */
  _isAuthError(error) {
    return (
      error.status === 401 ||
      error.code === 'AUTH_FAILED' ||
      error.message.includes('authentication') ||
      error.message.includes('token')
    );
  }
  
  /**
   * Check if error is permission related
   */
  _isPermissionError(error) {
    return (
      error.status === 403 ||
      error.code === 'PERMISSION_DENIED' ||
      error.message.includes('permission') ||
      error.message.includes('access denied')
    );
  }
  
  /**
   * Check if error is validation related
   */
  _isValidationError(error) {
    return (
      error.status === 400 ||
      error.code === 'VALIDATION_ERROR' ||
      error.message.includes('invalid') ||
      error.message.includes('required field')
    );
  }
  
  /**
   * Check if error is rate limit related
   */
  _isRateLimitError(error) {
    return (
      error.status === 429 ||
      error.code === 'RATE_LIMIT_EXCEEDED' ||
      error.message.includes('rate limit')
    );
  }
  
  /**
   * Check if error is not found
   */
  _isNotFoundError(error) {
    return (
      error.status === 404 ||
      error.code === 'NOT_FOUND' ||
      error.message.includes('not found')
    );
  }
  
  /**
   * Create user-friendly error message
   */
  getUserMessage(error) {
    if (this._isAuthError(error)) {
      return 'Authentication failed. Please check your credentials and try again.';
    }
    
    if (this._isPermissionError(error)) {
      return 'You do not have permission to perform this action.';
    }
    
    if (this._isValidationError(error)) {
      return `Invalid input: ${error.message}`;
    }
    
    if (this._isRateLimitError(error)) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    
    if (this._isNotFoundError(error)) {
      return 'The requested resource was not found.';
    }
    
    return 'An unexpected error occurred. Please try again later.';
  }
}

module.exports = ErrorHandler;






