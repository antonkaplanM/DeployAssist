/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

const crypto = require('crypto');

/**
 * Generate a unique request ID for tracking
 * @returns {String} Request ID
 */
const generateRequestId = () => {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * ResponseFormatter Class
 * Provides static methods for standardized API responses
 */
class ResponseFormatter {
    /**
     * Format success response
     * @param {*} data - Response data
     * @param {Object} meta - Additional metadata
     * @returns {Object} Formatted response
     */
    static success(data, meta = {}) {
        return {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: meta.requestId || generateRequestId(),
                ...meta
            }
        };
    }

    /**
     * Format error response
     * @param {String} message - Error message
     * @param {String} code - Error code
     * @param {Object} details - Additional error details
     * @returns {Object} Formatted error response
     */
    static error(message, code = 'INTERNAL_ERROR', details = null) {
        const response = {
            success: false,
            error: {
                message,
                code,
                ...(details && { details })
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: generateRequestId()
            }
        };

        return response;
    }

    /**
     * Format paginated response
     * @param {*} data - Response data
     * @param {Object} pagination - Pagination info
     * @returns {Object} Formatted paginated response
     */
    static paginated(data, pagination) {
        return this.success(data, {
            page: parseInt(pagination.page),
            pageSize: parseInt(pagination.pageSize || pagination.limit),
            totalPages: parseInt(pagination.totalPages),
            totalRecords: parseInt(pagination.totalRecords || pagination.total)
        });
    }

    /**
     * Format list response with count
     * @param {Array} items - Array of items
     * @param {String} itemsKey - Key name for items
     * @returns {Object} Formatted list response
     */
    static list(items, itemsKey = 'items') {
        return this.success({
            [itemsKey]: items,
            count: items.length
        });
    }
}

/**
 * Send success response (legacy helper for backward compatibility)
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata
 */
const success = (res, data, statusCode = 200, meta = {}) => {
    const response = ResponseFormatter.success(data, meta);
    return res.status(statusCode).json(response);
};

/**
 * Send error response (legacy helper for backward compatibility)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {Object} details - Additional error details
 */
const error = (res, message, statusCode = 500, details = {}) => {
    // Determine error code based on status
    let errorCode = 'INTERNAL_ERROR';
    if (statusCode === 400) errorCode = 'BAD_REQUEST';
    else if (statusCode === 401) errorCode = 'UNAUTHORIZED';
    else if (statusCode === 403) errorCode = 'FORBIDDEN';
    else if (statusCode === 404) errorCode = 'NOT_FOUND';
    else if (statusCode === 409) errorCode = 'CONFLICT';
    else if (statusCode === 422) errorCode = 'VALIDATION_ERROR';

    const response = ResponseFormatter.error(message, errorCode, details);

    // In development, include stack trace
    if (process.env.NODE_ENV === 'development' && details.stack) {
        response.error.stack = details.stack;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send paginated response (legacy helper for backward compatibility)
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @param {Number} total - Total items count
 * @param {Object} meta - Additional metadata
 */
const paginated = (res, data, page, limit, total, meta = {}) => {
    const totalPages = Math.ceil(total / limit);
    
    const response = ResponseFormatter.paginated(data, {
        page,
        pageSize: limit,
        totalPages,
        totalRecords: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        ...meta
    });

    return res.status(200).json(response);
};

/**
 * Send list response with count
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {String} itemsKey - Key name for items (default: 'items')
 * @param {Object} meta - Additional metadata
 */
const list = (res, items, itemsKey = 'items', meta = {}) => {
    const response = {
        success: true,
        [itemsKey]: items,
        count: items.length,
        timestamp: new Date().toISOString(),
        ...meta
    };

    return res.status(200).json(response);
};

/**
 * Send created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {Object} meta - Additional metadata
 */
const created = (res, data, meta = {}) => {
    return success(res, data, 201, meta);
};

/**
 * Send no content response (204)
 * @param {Object} res - Express response object
 */
const noContent = (res) => {
    return res.status(204).send();
};

/**
 * Send bad request response (400)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Object} details - Validation errors or additional details
 */
const badRequest = (res, message = 'Bad Request', details = {}) => {
    return error(res, message, 400, details);
};

/**
 * Send unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
const unauthorized = (res, message = 'Unauthorized') => {
    return error(res, message, 401);
};

/**
 * Send forbidden response (403)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
const forbidden = (res, message = 'Forbidden') => {
    return error(res, message, 403);
};

/**
 * Send not found response (404)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
const notFound = (res, message = 'Resource not found') => {
    return error(res, message, 404);
};

/**
 * Send internal server error response (500)
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Error} err - Error object
 */
const serverError = (res, message = 'Internal server error', err = null) => {
    const details = {};
    if (err) {
        details.message = err.message;
        details.stack = err.stack;
    }
    return error(res, message, 500, details);
};

module.exports = {
    // New ResponseFormatter class for modern usage
    ResponseFormatter,
    generateRequestId,
    
    // Legacy helpers for backward compatibility
    success,
    error,
    paginated,
    list,
    created,
    noContent,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    serverError
};

