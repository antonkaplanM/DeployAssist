/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata
 */
const success = (res, data, statusCode = 200, meta = {}) => {
    const response = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        ...meta
    };

    return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {Object} details - Additional error details
 */
const error = (res, message, statusCode = 500, details = {}) => {
    const response = {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        ...details
    };

    // In development, include additional details
    if (process.env.NODE_ENV === 'development' && details.stack) {
        response.stack = details.stack;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @param {Number} total - Total items count
 * @param {Object} meta - Additional metadata
 */
const paginated = (res, data, page, limit, total, meta = {}) => {
    const totalPages = Math.ceil(total / limit);
    
    const response = {
        success: true,
        data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total),
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        timestamp: new Date().toISOString(),
        ...meta
    };

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

