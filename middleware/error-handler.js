/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses across the application
 */

const logger = require('../utils/logger');

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(message, statusCode = 500, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true; // Distinguish operational errors from programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Create specific error types
 */
class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', details = {}) {
        super(message, 400, details);
    }
}

class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

class ConflictError extends ApiError {
    constructor(message = 'Conflict', details = {}) {
        super(message, 409, details);
    }
}

class ValidationError extends ApiError {
    constructor(message = 'Validation failed', errors = []) {
        super(message, 422, { validationErrors: errors });
    }
}

class TooManyRequestsError extends ApiError {
    constructor(message = 'Too many requests') {
        super(message, 429);
    }
}

class InternalServerError extends ApiError {
    constructor(message = 'Internal server error', details = {}) {
        super(message, 500, details);
    }
}

class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503);
    }
}

/**
 * Error handler middleware
 * Should be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.logError(err, {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userId: req.user?.id
    });

    // Default to 500 if statusCode is not set
    const statusCode = err.statusCode || 500;
    
    // Build error response
    const errorResponse = {
        success: false,
        error: err.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };

    // Add additional details if available
    if (err.details && Object.keys(err.details).length > 0) {
        errorResponse.details = err.details;
    }

    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 Not Found
 */
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
    next(error);
};

/**
 * Async handler wrapper
 * Catches async errors and passes them to error middleware
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validate request using a validation function
 */
const validate = (validationFn) => {
    return asyncHandler(async (req, res, next) => {
        try {
            await validationFn(req.body, req.query, req.params);
            next();
        } catch (err) {
            if (err.name === 'ZodError') {
                // Handle Zod validation errors
                const errors = err.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }));
                throw new ValidationError('Request validation failed', errors);
            }
            throw err;
        }
    });
};

/**
 * Handle database errors
 */
const handleDatabaseError = (err) => {
    // PostgreSQL error codes
    const pgErrorCodes = {
        '23505': 'unique_violation',
        '23503': 'foreign_key_violation',
        '23502': 'not_null_violation',
        '23514': 'check_violation',
        '42P01': 'undefined_table',
        '42703': 'undefined_column'
    };

    if (err.code && pgErrorCodes[err.code]) {
        const errorType = pgErrorCodes[err.code];
        
        switch (errorType) {
            case 'unique_violation':
                return new ConflictError('A record with this value already exists', {
                    constraint: err.constraint,
                    detail: err.detail
                });
            
            case 'foreign_key_violation':
                return new BadRequestError('Referenced record does not exist', {
                    constraint: err.constraint,
                    detail: err.detail
                });
            
            case 'not_null_violation':
                return new BadRequestError('Required field is missing', {
                    column: err.column
                });
            
            case 'undefined_table':
            case 'undefined_column':
                return new InternalServerError('Database schema error');
            
            default:
                return new InternalServerError('Database error', {
                    code: err.code
                });
        }
    }

    return new InternalServerError('Database error');
};

/**
 * Wrap database operations with error handling
 */
const dbErrorHandler = (fn) => {
    return asyncHandler(async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (err) {
            const handledError = handleDatabaseError(err);
            next(handledError);
        }
    });
};

module.exports = {
    // Error classes
    ApiError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    TooManyRequestsError,
    InternalServerError,
    ServiceUnavailableError,
    
    // Middleware
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validate,
    dbErrorHandler
};

