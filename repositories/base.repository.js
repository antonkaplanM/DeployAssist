/**
 * Base Repository
 * Provides common database operations for all repositories
 */

const db = require('../database');
const logger = require('../utils/logger');

class BaseRepository {
    /**
     * @param {String} tableName - Name of the database table
     */
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    /**
     * Execute a query
     * @param {String} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Query result
     */
    async query(query, params = []) {
        try {
            return await this.db.query(query, params);
        } catch (error) {
            logger.error(`Database query failed in ${this.constructor.name}`, {
                error: error.message,
                query: query.substring(0, 100),
                table: this.tableName
            });
            throw error;
        }
    }

    /**
     * Find all records with optional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of records
     */
    async findAll(options = {}) {
        const { limit, offset, orderBy = 'id', orderDir = 'ASC' } = options;
        
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        
        if (limit) {
            params.push(limit);
            query += ` LIMIT $${params.length}`;
        }
        
        if (offset) {
            params.push(offset);
            query += ` OFFSET $${params.length}`;
        }
        
        query += ` ORDER BY ${orderBy} ${orderDir}`;
        
        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Find a single record by ID
     * @param {Number|String} id - Record ID
     * @param {String} idColumn - ID column name (default: 'id')
     * @returns {Promise<Object|null>} Record or null
     */
    async findById(id, idColumn = 'id') {
        const query = `SELECT * FROM ${this.tableName} WHERE ${idColumn} = $1 LIMIT 1`;
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Find records by condition
     * @param {Object} conditions - Where conditions {column: value}
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of records
     */
    async findWhere(conditions, options = {}) {
        const { limit, offset, orderBy = 'id', orderDir = 'ASC' } = options;
        
        const whereKeys = Object.keys(conditions);
        if (whereKeys.length === 0) {
            return this.findAll(options);
        }
        
        const whereClauses = whereKeys.map((key, index) => `${key} = $${index + 1}`);
        const params = whereKeys.map(key => conditions[key]);
        
        let query = `SELECT * FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')}`;
        query += ` ORDER BY ${orderBy} ${orderDir}`;
        
        if (limit) {
            params.push(limit);
            query += ` LIMIT $${params.length}`;
        }
        
        if (offset) {
            params.push(offset);
            query += ` OFFSET $${params.length}`;
        }
        
        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Count records with optional conditions
     * @param {Object} conditions - Where conditions
     * @returns {Promise<Number>} Count
     */
    async count(conditions = {}) {
        const whereKeys = Object.keys(conditions);
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        
        if (whereKeys.length > 0) {
            const whereClauses = whereKeys.map((key, index) => `${key} = $${index + 1}`);
            const params = whereKeys.map(key => conditions[key]);
            query += ` WHERE ${whereClauses.join(' AND ')}`;
            
            const result = await this.query(query, params);
            return parseInt(result.rows[0].count);
        }
        
        const result = await this.query(query);
        return parseInt(result.rows[0].count);
    }

    /**
     * Create a new record
     * @param {Object} data - Data to insert
     * @returns {Promise<Object>} Created record
     */
    async create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`);
        
        const query = `
            INSERT INTO ${this.tableName} (${keys.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    /**
     * Update a record by ID
     * @param {Number|String} id - Record ID
     * @param {Object} data - Data to update
     * @param {String} idColumn - ID column name (default: 'id')
     * @returns {Promise<Object>} Updated record
     */
    async update(id, data, idColumn = 'id') {
        const keys = Object.keys(data);
        const values = Object.values(data);
        
        const setClauses = keys.map((key, index) => `${key} = $${index + 1}`);
        values.push(id);
        
        const query = `
            UPDATE ${this.tableName}
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE ${idColumn} = $${values.length}
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0] || null;
    }

    /**
     * Delete a record by ID
     * @param {Number|String} id - Record ID
     * @param {String} idColumn - ID column name (default: 'id')
     * @returns {Promise<Object>} Deleted record
     */
    async delete(id, idColumn = 'id') {
        const query = `
            DELETE FROM ${this.tableName}
            WHERE ${idColumn} = $1
            RETURNING *
        `;
        
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Check if a record exists
     * @param {Object} conditions - Where conditions
     * @returns {Promise<Boolean>} True if exists
     */
    async exists(conditions) {
        const count = await this.count(conditions);
        return count > 0;
    }

    /**
     * Execute a custom query with error handling
     * @param {String} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query results
     */
    async executeQuery(query, params = []) {
        const result = await this.query(query, params);
        return result.rows;
    }

    /**
     * Get database client for transactions
     * @returns {Promise<Object>} Database client
     */
    async getClient() {
        return await this.db.getClient();
    }
}

module.exports = BaseRepository;

