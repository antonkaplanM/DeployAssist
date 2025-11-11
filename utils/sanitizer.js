/**
 * Input Sanitization Utilities
 * Provides functions for sanitizing user input
 */

/**
 * Sanitize user-provided strings for safe use in JQL (Jira Query Language)
 * Escapes special characters and removes control characters
 * @param {String} value - Value to sanitize
 * @returns {String} Sanitized value
 */
function sanitizeForJql(value) {
    if (!value) return '';
    
    return String(value)
        .replace(/["\\]/g, '\\$&') // escape quotes and backslashes
        .replace(/[\r\n\t]/g, ' ')   // remove control characters
        .trim();
}

/**
 * Sanitize SQL LIKE pattern
 * Escapes special characters used in SQL LIKE patterns
 * @param {String} value - Value to sanitize
 * @returns {String} Sanitized value
 */
function sanitizeForLike(value) {
    if (!value) return '';
    
    return String(value)
        .replace(/[%_\\]/g, '\\$&') // escape LIKE wildcards
        .trim();
}

/**
 * Sanitize file name
 * Removes potentially dangerous characters from file names
 * @param {String} fileName - File name to sanitize
 * @returns {String} Sanitized file name
 */
function sanitizeFileName(fileName) {
    if (!fileName) return 'download';
    
    return String(fileName)
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace non-alphanumeric with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^[._-]+/, '') // Remove leading dots, underscores, hyphens
        .substring(0, 255); // Limit length
}

/**
 * Sanitize HTML to prevent XSS
 * Escapes HTML special characters
 * @param {String} html - HTML string to sanitize
 * @returns {String} Sanitized HTML
 */
function sanitizeHtml(html) {
    if (!html) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return String(html).replace(/[&<>"'\/]/g, (char) => map[char]);
}

/**
 * Sanitize email address
 * Basic email validation and sanitization
 * @param {String} email - Email to sanitize
 * @returns {String|null} Sanitized email or null if invalid
 */
function sanitizeEmail(email) {
    if (!email) return null;
    
    const sanitized = String(email).trim().toLowerCase();
    
    // Basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return emailRegex.test(sanitized) ? sanitized : null;
}

/**
 * Sanitize integer input
 * @param {*} value - Value to sanitize
 * @param {Number} defaultValue - Default value if invalid
 * @param {Number} min - Minimum allowed value
 * @param {Number} max - Maximum allowed value
 * @returns {Number} Sanitized integer
 */
function sanitizeInteger(value, defaultValue = 0, min = null, max = null) {
    const parsed = parseInt(value, 10);
    
    if (isNaN(parsed)) {
        return defaultValue;
    }
    
    let result = parsed;
    
    if (min !== null && result < min) {
        result = min;
    }
    
    if (max !== null && result > max) {
        result = max;
    }
    
    return result;
}

/**
 * Sanitize boolean input
 * @param {*} value - Value to sanitize
 * @param {Boolean} defaultValue - Default value if invalid
 * @returns {Boolean} Sanitized boolean
 */
function sanitizeBoolean(value, defaultValue = false) {
    if (value === true || value === false) {
        return value;
    }
    
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
            return true;
        }
        if (lower === 'false' || lower === '0' || lower === 'no') {
            return false;
        }
    }
    
    if (typeof value === 'number') {
        return value !== 0;
    }
    
    return defaultValue;
}

/**
 * Sanitize sort order
 * @param {String} order - Sort order ('asc' or 'desc')
 * @param {String} defaultOrder - Default order
 * @returns {String} 'ASC' or 'DESC'
 */
function sanitizeSortOrder(order, defaultOrder = 'DESC') {
    if (!order) return defaultOrder;
    
    const upper = String(order).toUpperCase();
    return (upper === 'ASC' || upper === 'DESC') ? upper : defaultOrder;
}

/**
 * Sanitize sort field against whitelist
 * @param {String} field - Sort field
 * @param {Array} allowedFields - Array of allowed field names
 * @param {String} defaultField - Default field
 * @returns {String} Sanitized field name
 */
function sanitizeSortField(field, allowedFields, defaultField) {
    if (!field || !allowedFields.includes(field)) {
        return defaultField;
    }
    return field;
}

/**
 * Sanitize array of strings
 * @param {*} value - Value to sanitize (string, array, or comma-separated)
 * @param {Number} maxItems - Maximum number of items
 * @returns {Array} Array of sanitized strings
 */
function sanitizeStringArray(value, maxItems = 100) {
    if (!value) return [];
    
    let items = [];
    
    if (Array.isArray(value)) {
        items = value;
    } else if (typeof value === 'string') {
        items = value.split(',').map(item => item.trim()).filter(item => item);
    } else {
        return [];
    }
    
    return items.slice(0, maxItems);
}

/**
 * Remove null/undefined values from object
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
function removeNullValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {});
}

module.exports = {
    sanitizeForJql,
    sanitizeForLike,
    sanitizeFileName,
    sanitizeHtml,
    sanitizeEmail,
    sanitizeInteger,
    sanitizeBoolean,
    sanitizeSortOrder,
    sanitizeSortField,
    sanitizeStringArray,
    removeNullValues
};

