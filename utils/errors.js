/**
 * Custom Error Classes
 * Standardized error handling across the application
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

/**
 * Validation Error (400)
 * Used for request validation failures
 */
class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

/**
 * Authentication Error (401)
 * Used for authentication failures
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

/**
 * Authorization Error (403)
 * Used for authorization/permission failures
 */
class ForbiddenError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * Not Found Error (404)
 * Used when a resource is not found
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.resource = resource;
    }
}

/**
 * Conflict Error (409)
 * Used for duplicate resources or conflicting operations
 */
class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

/**
 * Bad Request Error (400)
 * Used for malformed requests or invalid input
 */
class BadRequestError extends AppError {
    constructor(message = 'Bad request') {
        super(message, 400, 'BAD_REQUEST');
    }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
class InternalServerError extends AppError {
    constructor(message = 'Internal server error', details = null) {
        super(message, 500, 'INTERNAL_ERROR');
        this.details = details;
    }
}

/**
 * Service Unavailable Error (503)
 * Used when an external service is unavailable
 */
class ServiceUnavailableError extends AppError {
    constructor(service = 'Service', message = null) {
        super(message || `${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
        this.service = service;
    }
}

/**
 * Database Error
 * Used for database operation failures
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.originalError = originalError;
    }
}

/**
 * External API Error
 * Used for external API call failures
 */
class ExternalAPIError extends AppError {
    constructor(service, message = 'External API call failed', statusCode = 500) {
        super(message, statusCode, 'EXTERNAL_API_ERROR');
        this.service = service;
    }
}

/**
 * Rate Limit Error (429)
 * Used when rate limits are exceeded
 */
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

/**
 * Timeout Error (408)
 * Used when operations timeout
 */
class TimeoutError extends AppError {
    constructor(operation = 'Operation', timeout = null) {
        const message = timeout 
            ? `${operation} timed out after ${timeout}ms`
            : `${operation} timed out`;
        super(message, 408, 'TIMEOUT');
        this.operation = operation;
        this.timeout = timeout;
    }
}

/**
 * Check if error is operational (expected error)
 * @param {Error} error - Error to check
 * @returns {Boolean} True if operational
 */
function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}

/**
 * Format error for API response
 * @param {Error} error - Error to format
 * @returns {Object} Formatted error
 */
function formatErrorResponse(error) {
    if (error instanceof AppError) {
        return {
            success: false,
            error: {
                message: error.message,
                code: error.code,
                ...(error.details && { details: error.details })
            },
            meta: {
                timestamp: error.timestamp,
                requestId: error.requestId || generateRequestId()
            }
        };
    }

    // Handle unknown errors
    return {
        success: false,
        error: {
            message: process.env.NODE_ENV === 'development' 
                ? error.message 
                : 'An unexpected error occurred',
            code: 'INTERNAL_ERROR'
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Generate request ID
 * @returns {String} Request ID
 */
function generateRequestId() {
    return require('crypto').randomBytes(16).toString('hex');
}

module.exports = {
    // Base error
    AppError,
    
    // Client errors (4xx)
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    BadRequestError,
    RateLimitError,
    TimeoutError,
    
    // Server errors (5xx)
    InternalServerError,
    ServiceUnavailableError,
    DatabaseError,
    ExternalAPIError,
    
    // Utilities
    isOperationalError,
    formatErrorResponse
};





