"use strict";
/**
 * Error Handling Middleware
 * Custom error classes and Express error handling middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.ConfigurationError = exports.TimeoutError = exports.NotFoundError = exports.ExternalServiceError = exports.SalesforceConnectionError = exports.SalesforceError = exports.DatabaseConnectionError = exports.DatabaseError = exports.InvalidInputError = exports.ValidationError = exports.AuthorizationError = exports.AuthenticationError = exports.AppError = void 0;
const common_types_1 = require("../types/common.types");
const logger_1 = require("../utils/logger");
/**
 * Base Application Error Class
 * All custom errors extend this class
 */
class AppError extends Error {
    constructor(code, message, statusCode = 500, isOperational = true, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
        // Set the prototype explicitly
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
/**
 * Authentication Errors
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed', details) {
        super(common_types_1.ErrorCode.AUTH_INVALID, message, 401, true, details);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions', details) {
        super(common_types_1.ErrorCode.AUTH_INVALID, message, 403, true, details);
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Validation Errors
 */
class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(common_types_1.ErrorCode.VALIDATION_FAILED, message, 400, true, details);
    }
}
exports.ValidationError = ValidationError;
class InvalidInputError extends AppError {
    constructor(message = 'Invalid input provided', details) {
        super(common_types_1.ErrorCode.INVALID_INPUT, message, 400, true, details);
    }
}
exports.InvalidInputError = InvalidInputError;
/**
 * Database Errors
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', details) {
        super(common_types_1.ErrorCode.DATABASE_QUERY_FAILED, message, 500, true, details);
    }
}
exports.DatabaseError = DatabaseError;
class DatabaseConnectionError extends AppError {
    constructor(message = 'Database connection failed', details) {
        super(common_types_1.ErrorCode.DATABASE_CONNECTION_FAILED, message, 503, true, details);
    }
}
exports.DatabaseConnectionError = DatabaseConnectionError;
/**
 * External Service Errors
 */
class SalesforceError extends AppError {
    constructor(message = 'Salesforce operation failed', details) {
        super(common_types_1.ErrorCode.SALESFORCE_QUERY_FAILED, message, 502, true, details);
    }
}
exports.SalesforceError = SalesforceError;
class SalesforceConnectionError extends AppError {
    constructor(message = 'Salesforce connection failed', details) {
        super(common_types_1.ErrorCode.SALESFORCE_CONNECTION_FAILED, message, 503, true, details);
    }
}
exports.SalesforceConnectionError = SalesforceConnectionError;
class ExternalServiceError extends AppError {
    constructor(message = 'External service error', code, details) {
        super(code, message, 502, true, details);
    }
}
exports.ExternalServiceError = ExternalServiceError;
/**
 * Resource Errors
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource', details) {
        super(common_types_1.ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found`, 404, true, details);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * System Errors
 */
class TimeoutError extends AppError {
    constructor(message = 'Operation timed out', details) {
        super(common_types_1.ErrorCode.TIMEOUT_ERROR, message, 504, true, details);
    }
}
exports.TimeoutError = TimeoutError;
class ConfigurationError extends AppError {
    constructor(message = 'Configuration error', details) {
        super(common_types_1.ErrorCode.CONFIGURATION_ERROR, message, 500, false, details);
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Error Handling Middleware
 * Catches all errors and sends appropriate responses
 */
const errorHandler = (err, req, res, _next) => {
    // Default error properties
    let statusCode = 500;
    let errorCode = common_types_1.ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let isOperational = false;
    let details = undefined;
    // Handle AppError and its subclasses
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorCode = err.code;
        message = err.message;
        isOperational = err.isOperational;
        details = err.details;
    }
    // Handle other known error types
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = common_types_1.ErrorCode.VALIDATION_FAILED;
        message = err.message;
        isOperational = true;
    }
    else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = common_types_1.ErrorCode.AUTH_INVALID;
        message = 'Invalid or missing authentication';
        isOperational = true;
    }
    // Unhandled errors
    else {
        message = process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message;
    }
    // Log the error
    if (isOperational) {
        logger_1.Logger.warn(`Operational error: ${message}`, {
            path: req.path,
            method: req.method,
            statusCode,
            errorCode,
            details
        });
    }
    else {
        logger_1.Logger.error(`Unexpected error: ${message}`, err, {
            path: req.path,
            method: req.method,
            statusCode,
            errorCode,
            details
        });
    }
    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message,
            ...(process.env.NODE_ENV !== 'production' && {
                stack: err.stack,
                details
            })
        },
        timestamp: new Date().toISOString()
    });
};
exports.errorHandler = errorHandler;
/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch promise rejections
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * 404 Not Found Handler
 * Should be placed after all routes
 */
const notFoundHandler = (req, _res, next) => {
    const error = new NotFoundError('Route', {
        path: req.path,
        method: req.method
    });
    next(error);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errors.js.map