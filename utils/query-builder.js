/**
 * SQL Query Builder Utilities
 * Provides utilities for building dynamic SQL queries safely
 */

/**
 * Build WHERE clause from filters
 * @param {Object} filters - Filter object
 * @param {Number} startParamIndex - Starting parameter index
 * @returns {Object} { whereClause, params }
 */
function buildWhereClause(filters, startParamIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startParamIndex;

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            conditions.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params, nextParamIndex: paramIndex };
}

/**
 * Build LIKE search conditions
 * @param {Array} searchFields - Array of field names to search
 * @param {String} searchTerm - Search term
 * @param {Number} startParamIndex - Starting parameter index
 * @returns {Object} { whereClause, params }
 */
function buildLikeSearch(searchFields, searchTerm, startParamIndex = 1) {
    if (!searchTerm || searchFields.length === 0) {
        return { whereClause: '', params: [], nextParamIndex: startParamIndex };
    }

    const conditions = searchFields.map((field, idx) => {
        return `${field} ILIKE $${startParamIndex}`;
    });

    const whereClause = `(${conditions.join(' OR ')})`;
    const params = [`%${searchTerm}%`];

    return { whereClause, params, nextParamIndex: startParamIndex + 1 };
}

/**
 * Build ORDER BY clause
 * @param {String} sortBy - Field to sort by
 * @param {String} sortOrder - Sort order (ASC/DESC)
 * @param {Array} allowedFields - Allowed fields for sorting
 * @param {String} defaultField - Default sort field
 * @returns {String} ORDER BY clause
 */
function buildOrderBy(sortBy, sortOrder = 'DESC', allowedFields = [], defaultField = 'created_at') {
    // Validate sort field
    const field = allowedFields.includes(sortBy) ? sortBy : defaultField;
    
    // Validate sort order
    const order = (sortOrder.toUpperCase() === 'ASC' || sortOrder.toUpperCase() === 'DESC') 
        ? sortOrder.toUpperCase() 
        : 'DESC';

    return `ORDER BY ${field} ${order}`;
}

/**
 * Build LIMIT and OFFSET clause for pagination
 * @param {Number} page - Page number (1-based)
 * @param {Number} limit - Items per page
 * @returns {String} LIMIT OFFSET clause
 */
function buildPagination(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * Build date range filter
 * @param {String} dateField - Name of date field
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Number} startParamIndex - Starting parameter index
 * @returns {Object} { whereClause, params }
 */
function buildDateRange(dateField, startDate, endDate, startParamIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startParamIndex;

    if (startDate) {
        conditions.push(`${dateField} >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        conditions.push(`${dateField} <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
    return { whereClause, params, nextParamIndex: paramIndex };
}

/**
 * Build IN clause
 * @param {String} field - Field name
 * @param {Array} values - Array of values
 * @param {Number} startParamIndex - Starting parameter index
 * @returns {Object} { whereClause, params }
 */
function buildInClause(field, values, startParamIndex = 1) {
    if (!values || values.length === 0) {
        return { whereClause: '', params: [], nextParamIndex: startParamIndex };
    }

    const placeholders = values.map((_, idx) => `$${startParamIndex + idx}`).join(', ');
    const whereClause = `${field} IN (${placeholders})`;

    return { whereClause, params: values, nextParamIndex: startParamIndex + values.length };
}

/**
 * Combine multiple WHERE conditions
 * @param {Array} conditions - Array of condition strings
 * @param {String} operator - Logical operator (AND/OR)
 * @returns {String} Combined WHERE clause
 */
function combineConditions(conditions, operator = 'AND') {
    const validConditions = conditions.filter(c => c && c.trim() !== '');
    
    if (validConditions.length === 0) {
        return '';
    }

    if (validConditions.length === 1) {
        return `WHERE ${validConditions[0]}`;
    }

    return `WHERE ${validConditions.join(` ${operator} `)}`;
}

/**
 * Build SELECT query with common patterns
 * @param {Object} options - Query options
 * @returns {Object} { query, params }
 */
function buildSelectQuery(options) {
    const {
        table,
        select = '*',
        joins = [],
        filters = {},
        search = null,
        searchFields = [],
        sortBy = 'created_at',
        sortOrder = 'DESC',
        allowedSortFields = [],
        page = null,
        limit = 50
    } = options;

    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // Build filter conditions
    if (Object.keys(filters).length > 0) {
        const filterResult = buildWhereClause(filters, paramIndex);
        if (filterResult.whereClause) {
            conditions.push(filterResult.whereClause.replace('WHERE ', ''));
            params.push(...filterResult.params);
            paramIndex = filterResult.nextParamIndex;
        }
    }

    // Build search conditions
    if (search && searchFields.length > 0) {
        const searchResult = buildLikeSearch(searchFields, search, paramIndex);
        if (searchResult.whereClause) {
            conditions.push(searchResult.whereClause);
            params.push(...searchResult.params);
            paramIndex = searchResult.nextParamIndex;
        }
    }

    // Build query
    let query = `SELECT ${select} FROM ${table}`;

    // Add joins
    if (joins.length > 0) {
        query += ' ' + joins.join(' ');
    }

    // Add WHERE clause
    if (conditions.length > 0) {
        query += ' ' + combineConditions(conditions);
    }

    // Add ORDER BY
    query += ' ' + buildOrderBy(sortBy, sortOrder, allowedSortFields, sortBy);

    // Add pagination
    if (page !== null) {
        query += ' ' + buildPagination(page, limit);
    }

    return { query, params };
}

/**
 * Build UPDATE query
 * @param {String} table - Table name
 * @param {Object} updates - Fields to update
 * @param {Object} conditions - WHERE conditions
 * @returns {Object} { query, params }
 */
function buildUpdateQuery(table, updates, conditions) {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    // Build SET clause
    Object.entries(updates).forEach(([key, value]) => {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
    });

    // Build WHERE clause
    const whereResult = buildWhereClause(conditions, paramIndex);
    params.push(...whereResult.params);

    const query = `
        UPDATE ${table}
        SET ${setClauses.join(', ')}
        ${whereResult.whereClause}
        RETURNING *
    `.trim();

    return { query, params };
}

/**
 * Build INSERT query
 * @param {String} table - Table name
 * @param {Object} data - Data to insert
 * @returns {Object} { query, params }
 */
function buildInsertQuery(table, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, idx) => `$${idx + 1}`);

    const query = `
        INSERT INTO ${table} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
    `.trim();

    return { query, params: values };
}

/**
 * Build DELETE query
 * @param {String} table - Table name
 * @param {Object} conditions - WHERE conditions
 * @returns {Object} { query, params }
 */
function buildDeleteQuery(table, conditions) {
    const whereResult = buildWhereClause(conditions, 1);

    const query = `
        DELETE FROM ${table}
        ${whereResult.whereClause}
        RETURNING *
    `.trim();

    return { query, params: whereResult.params };
}

/**
 * Escape identifier (table/column name)
 * @param {String} identifier - Identifier to escape
 * @returns {String} Escaped identifier
 */
function escapeIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
}

module.exports = {
    buildWhereClause,
    buildLikeSearch,
    buildOrderBy,
    buildPagination,
    buildDateRange,
    buildInClause,
    combineConditions,
    buildSelectQuery,
    buildUpdateQuery,
    buildInsertQuery,
    buildDeleteQuery,
    escapeIdentifier
};

