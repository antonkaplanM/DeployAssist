/**
 * Provisioning Repository
 * Handles database operations for provisioning requests (Technical Team Requests)
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class ProvisioningRepository extends BaseRepository {
    constructor() {
        super('technical_team_requests');
    }

    /**
     * Search provisioning requests
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Requests and pagination
     */
    async searchRequests(options = {}) {
        const { query: searchQuery, status, limit = 50, page = 1 } = options;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (searchQuery) {
            whereConditions.push(`(
                account_name ILIKE $${paramIndex} OR
                request_id ILIKE $${paramIndex} OR
                request_content::text ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${searchQuery}%`);
            paramIndex++;
        }

        if (status) {
            whereConditions.push(`status = $${paramIndex++}`);
            queryParams.push(status);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const countResult = await this.query(countQuery, queryParams);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get requests
        queryParams.push(limit, offset);
        const dataQuery = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const dataResult = await this.query(dataQuery, queryParams);

        return {
            requests: dataResult.rows,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    }

    /**
     * Find request by ID or request_id
     * @param {String} identifier - Request ID or internal ID
     * @returns {Promise<Object|null>} Request
     */
    async findByIdentifier(identifier) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE request_id = $1 OR id::text = $1
            LIMIT 1
        `;

        const result = await this.query(query, [identifier]);
        return result.rows[0] || null;
    }

    /**
     * Get new requests since date
     * @param {Date} sinceDate - Since date
     * @param {Number} limit - Limit
     * @returns {Promise<Array>} New requests
     */
    async findNewSince(sinceDate, limit = 50) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE created_at >= $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        return await this.executeQuery(query, [sinceDate, limit]);
    }

    /**
     * Get product removal requests
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Removal requests
     */
    async findRemovalRequests(options = {}) {
        const { accountName, limit = 50 } = options;

        let whereConditions = ["request_type = 'Product Removal' OR request_content::text ILIKE '%remove%'"];
        let queryParams = [];
        let paramIndex = 1;

        if (accountName) {
            whereConditions.push(`account_name ILIKE $${paramIndex++}`);
            queryParams.push(`%${accountName}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        queryParams.push(limit);

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex}
        `;

        return await this.executeQuery(query, queryParams);
    }

    /**
     * Get validation errors
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Validation errors
     */
    async findValidationErrors(options = {}) {
        const { severity, limit = 50 } = options;

        let whereConditions = ['validation_errors IS NOT NULL'];
        let queryParams = [];
        let paramIndex = 1;

        if (severity) {
            whereConditions.push(`validation_errors::text ILIKE $${paramIndex++}`);
            queryParams.push(`%"severity":"${severity}"%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        queryParams.push(limit);

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex}
        `;

        return await this.executeQuery(query, queryParams);
    }

    /**
     * Get request statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE validation_errors IS NOT NULL) as with_errors,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as last_7_days,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as last_30_days
            FROM ${this.tableName}
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            total: parseInt(stats.total_requests),
            byStatus: {
                pending: parseInt(stats.pending),
                completed: parseInt(stats.completed),
                failed: parseInt(stats.failed)
            },
            withErrors: parseInt(stats.with_errors),
            recent: {
                last7Days: parseInt(stats.last_7_days),
                last30Days: parseInt(stats.last_30_days)
            }
        };
    }

    /**
     * Get request type breakdown for current week
     * @returns {Promise<Array>} Request types
     */
    async getRequestTypesThisWeek() {
        const query = `
            SELECT 
                request_type,
                COUNT(*) as count
            FROM ${this.tableName}
            WHERE created_at >= date_trunc('week', CURRENT_DATE)
            GROUP BY request_type
            ORDER BY count DESC
        `;

        return await this.executeQuery(query);
    }

    /**
     * Get request volume over time
     * @param {Number} months - Number of months
     * @returns {Promise<Array>} Volume stats
     */
    async getRequestVolume(months = 6) {
        const query = `
            SELECT 
                date_trunc('week', created_at) as week,
                COUNT(*) as request_count
            FROM ${this.tableName}
            WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
            GROUP BY week
            ORDER BY week DESC
        `;

        return await this.executeQuery(query);
    }
}

module.exports = new ProvisioningRepository();





