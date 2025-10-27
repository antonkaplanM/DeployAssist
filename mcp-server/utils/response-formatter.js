/**
 * Response Formatter
 * Standardizes responses from tools
 */
class ResponseFormatter {
  /**
   * Format successful response
   */
  success(data, metadata = {}) {
    return {
      success: true,
      data: data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }
  
  /**
   * Format error response
   */
  error(error, code = 'UNKNOWN_ERROR') {
    // Extract error details
    const errorMessage = error.message || 'An unknown error occurred';
    const errorCode = error.code || code;
    const status = error.status || 500;
    
    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        status: status,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Format authentication error
   */
  authError(message = 'Authentication failed') {
    return this.error(
      { message, code: 'AUTH_FAILED', status: 401 },
      'AUTH_FAILED'
    );
  }
  
  /**
   * Format authorization error
   */
  permissionError(message = 'Permission denied') {
    return this.error(
      { message, code: 'PERMISSION_DENIED', status: 403 },
      'PERMISSION_DENIED'
    );
  }
  
  /**
   * Format validation error
   */
  validationError(message = 'Invalid input', details = {}) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: message,
        details: details,
        status: 400,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  /**
   * Format rate limit error
   */
  rateLimitError(message = 'Rate limit exceeded') {
    return this.error(
      { message, code: 'RATE_LIMIT_EXCEEDED', status: 429 },
      'RATE_LIMIT_EXCEEDED'
    );
  }
  
  /**
   * Format paginated response
   */
  paginated(data, pagination) {
    return this.success(data, {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 50,
        total: pagination.total || 0,
        hasMore: pagination.hasMore || false,
      },
    });
  }
  
  /**
   * Format empty response
   */
  empty(message = 'No results found') {
    return this.success([], {
      message: message,
      count: 0,
    });
  }
}

module.exports = ResponseFormatter;





