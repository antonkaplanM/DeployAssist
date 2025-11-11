/**
 * Request Validation Middleware
 * Provides reusable validation functions for common patterns
 */

const { BadRequestError, ValidationError } = require('./error-handler');
const { sanitizeInteger, sanitizeBoolean, sanitizeSortOrder, sanitizeSortField } = require('../utils/sanitizer');

/**
 * Validate pagination parameters
 * @param {Object} options - Validation options
 */
const validatePagination = (options = {}) => {
    const {
        defaultPage = 1,
        defaultLimit = 50,
        maxLimit = 200
    } = options;

    return (req, res, next) => {
        const page = sanitizeInteger(req.query.page, defaultPage, 1, 10000);
        const limit = sanitizeInteger(req.query.limit, defaultLimit, 1, maxLimit);

        // Attach sanitized values to request
        req.pagination = { page, limit };
        
        next();
    };
};

/**
 * Validate sort parameters
 * @param {Array} allowedFields - Array of allowed sort fields
 * @param {String} defaultField - Default sort field
 */
const validateSort = (allowedFields, defaultField) => {
    return (req, res, next) => {
        const sortBy = sanitizeSortField(
            req.query.sortBy || req.query.sort_by,
            allowedFields,
            defaultField
        );
        const sortOrder = sanitizeSortOrder(
            req.query.sortOrder || req.query.sort_order,
            'DESC'
        );

        // Attach sanitized values to request
        req.sort = { sortBy, sortOrder };
        
        next();
    };
};

/**
 * Validate required fields in request body
 * @param {Array} requiredFields - Array of required field names
 */
const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        const missingFields = [];

        requiredFields.forEach(field => {
            if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
                missingFields.push(field);
            }
        });

        if (missingFields.length > 0) {
            throw new ValidationError(
                'Required fields are missing',
                missingFields.map(field => ({
                    field,
                    message: `${field} is required`
                }))
            );
        }

        next();
    };
};

/**
 * Validate UUID parameter
 * @param {String} paramName - Name of the parameter
 */
const validateUUID = (paramName = 'id') => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return (req, res, next) => {
        const value = req.params[paramName];

        if (!value || !uuidRegex.test(value)) {
            throw new BadRequestError(`Invalid ${paramName}: must be a valid UUID`);
        }

        next();
    };
};

/**
 * Validate date range parameters
 * @param {Object} options - Validation options
 */
const validateDateRange = (options = {}) => {
    const {
        startDateParam = 'startDate',
        endDateParam = 'endDate',
        required = false,
        maxDays = null
    } = options;

    return (req, res, next) => {
        const startDateStr = req.query[startDateParam];
        const endDateStr = req.query[endDateParam];

        if (required && (!startDateStr || !endDateStr)) {
            throw new BadRequestError('Start date and end date are required');
        }

        let startDate = null;
        let endDate = null;

        if (startDateStr) {
            startDate = new Date(startDateStr);
            if (isNaN(startDate.getTime())) {
                throw new BadRequestError('Invalid start date format');
            }
        }

        if (endDateStr) {
            endDate = new Date(endDateStr);
            if (isNaN(endDate.getTime())) {
                throw new BadRequestError('Invalid end date format');
            }
        }

        if (startDate && endDate && startDate > endDate) {
            throw new BadRequestError('Start date must be before end date');
        }

        if (maxDays && startDate && endDate) {
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > maxDays) {
                throw new BadRequestError(`Date range cannot exceed ${maxDays} days`);
            }
        }

        // Attach to request
        req.dateRange = { startDate, endDate };

        next();
    };
};

/**
 * Validate search parameter
 * @param {Object} options - Validation options
 */
const validateSearch = (options = {}) => {
    const {
        paramName = 'search',
        minLength = 1,
        maxLength = 500
    } = options;

    return (req, res, next) => {
        const search = req.query[paramName];

        if (search) {
            const trimmed = search.trim();
            
            if (trimmed.length < minLength) {
                throw new BadRequestError(`Search term must be at least ${minLength} characters`);
            }

            if (trimmed.length > maxLength) {
                throw new BadRequestError(`Search term cannot exceed ${maxLength} characters`);
            }

            req.search = trimmed;
        } else {
            req.search = null;
        }

        next();
    };
};

/**
 * Validate enum value
 * @param {String} paramName - Parameter name
 * @param {Array} allowedValues - Array of allowed values
 * @param {Boolean} required - Whether parameter is required
 */
const validateEnum = (paramName, allowedValues, required = false) => {
    return (req, res, next) => {
        const source = req.body[paramName] !== undefined ? req.body : req.query;
        const value = source[paramName];

        if (!value) {
            if (required) {
                throw new BadRequestError(`${paramName} is required`);
            }
            return next();
        }

        if (!allowedValues.includes(value)) {
            throw new BadRequestError(
                `Invalid ${paramName}. Allowed values: ${allowedValues.join(', ')}`
            );
        }

        next();
    };
};

/**
 * Validate numeric range
 * @param {String} paramName - Parameter name
 * @param {Number} min - Minimum value
 * @param {Number} max - Maximum value
 * @param {Boolean} required - Whether parameter is required
 */
const validateNumericRange = (paramName, min, max, required = false) => {
    return (req, res, next) => {
        const source = req.body[paramName] !== undefined ? req.body : req.query;
        const value = source[paramName];

        if (value === undefined || value === null || value === '') {
            if (required) {
                throw new BadRequestError(`${paramName} is required`);
            }
            return next();
        }

        const numValue = Number(value);

        if (isNaN(numValue)) {
            throw new BadRequestError(`${paramName} must be a number`);
        }

        if (min !== null && numValue < min) {
            throw new BadRequestError(`${paramName} must be at least ${min}`);
        }

        if (max !== null && numValue > max) {
            throw new BadRequestError(`${paramName} cannot exceed ${max}`);
        }

        // Attach sanitized value
        source[paramName] = numValue;

        next();
    };
};

/**
 * Validate array parameter
 * @param {String} paramName - Parameter name
 * @param {Number} maxItems - Maximum number of items
 * @param {Boolean} required - Whether parameter is required
 */
const validateArray = (paramName, maxItems = 100, required = false) => {
    return (req, res, next) => {
        const source = req.body[paramName] !== undefined ? req.body : req.query;
        let value = source[paramName];

        if (!value || (Array.isArray(value) && value.length === 0)) {
            if (required) {
                throw new BadRequestError(`${paramName} is required`);
            }
            source[paramName] = [];
            return next();
        }

        // Convert comma-separated string to array
        if (typeof value === 'string') {
            value = value.split(',').map(item => item.trim()).filter(item => item);
        }

        if (!Array.isArray(value)) {
            throw new BadRequestError(`${paramName} must be an array`);
        }

        if (value.length > maxItems) {
            throw new BadRequestError(`${paramName} cannot contain more than ${maxItems} items`);
        }

        source[paramName] = value;

        next();
    };
};

/**
 * Validate file upload
 * @param {Object} options - Validation options
 */
const validateFileUpload = (options = {}) => {
    const {
        required = false,
        maxSize = 10 * 1024 * 1024, // 10MB default
        allowedTypes = []
    } = options;

    return (req, res, next) => {
        const file = req.file;

        if (!file) {
            if (required) {
                throw new BadRequestError('File upload is required');
            }
            return next();
        }

        if (file.size > maxSize) {
            throw new BadRequestError(`File size cannot exceed ${maxSize / 1024 / 1024}MB`);
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
            throw new BadRequestError(
                `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
            );
        }

        next();
    };
};

/**
 * Combine multiple validation middlewares
 * @param {Array} validators - Array of validation middleware functions
 */
const combineValidators = (...validators) => {
    return (req, res, next) => {
        const runValidator = (index) => {
            if (index >= validators.length) {
                return next();
            }

            try {
                validators[index](req, res, (err) => {
                    if (err) {
                        return next(err);
                    }
                    runValidator(index + 1);
                });
            } catch (err) {
                next(err);
            }
        };

        runValidator(0);
    };
};

module.exports = {
    validatePagination,
    validateSort,
    validateRequiredFields,
    validateUUID,
    validateDateRange,
    validateSearch,
    validateEnum,
    validateNumericRange,
    validateArray,
    validateFileUpload,
    combineValidators
};

