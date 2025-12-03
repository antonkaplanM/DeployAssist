/**
 * Validation Repository
 * Handles database operations for validation results and rules
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class ValidationRepository extends BaseRepository {
    constructor() {
        super('validation_results');
    }

    /**
     * Find validation results by record IDs
     * @param {Array} recordIds - Record IDs
     * @returns {Promise<Array>} Validation results
     */
    async findByRecordIds(recordIds) {
        if (!Array.isArray(recordIds) || recordIds.length === 0) {
            return [];
        }

        const placeholders = recordIds.map((_, index) => `$${index + 1}`).join(', ');
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE record_id IN (${placeholders})
            ORDER BY validated_at DESC
        `;

        return await this.executeQuery(query, recordIds);
    }

    /**
     * Find latest validation for a record
     * @param {String} recordId - Record ID
     * @returns {Promise<Object|null>} Latest validation
     */
    async findLatestByRecordId(recordId) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE record_id = $1
            ORDER BY validated_at DESC
            LIMIT 1
        `;

        const result = await this.query(query, [recordId]);
        return result.rows[0] || null;
    }

    /**
     * Get async validation status
     * @returns {Promise<Object>} Status
     */
    async getAsyncValidationStatus() {
        // Get latest processing log
        const logQuery = `
            SELECT * FROM async_validation_log
            ORDER BY started_at DESC
            LIMIT 1
        `;

        const logResult = await this.query(logQuery);

        // Get validation statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_validations,
                COUNT(*) FILTER (WHERE is_valid = true) as valid_count,
                COUNT(*) FILTER (WHERE is_valid = false) as invalid_count,
                MAX(validated_at) as last_validation_time
            FROM ${this.tableName}
            WHERE validated_at >= CURRENT_DATE - INTERVAL '7 days'
        `;

        const statsResult = await this.query(statsQuery);
        const stats = statsResult.rows[0];

        return {
            latestLog: logResult.rows[0] || null,
            statistics: {
                total: parseInt(stats.total_validations),
                valid: parseInt(stats.valid_count),
                invalid: parseInt(stats.invalid_count),
                lastValidation: stats.last_validation_time
            }
        };
    }

    /**
     * Get validation errors
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Validation errors
     */
    async findValidationErrors(options = {}) {
        const { limit = 100, offset = 0, severity } = options;

        let whereConditions = ['is_valid = false'];
        let queryParams = [];
        let paramIndex = 1;

        if (severity) {
            whereConditions.push(`errors::text ILIKE $${paramIndex++}`);
            queryParams.push(`%"severity":"${severity}"%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        queryParams.push(limit, offset);

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY validated_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        return await this.executeQuery(query, queryParams);
    }

    /**
     * Get validation error trend
     * @param {Number} days - Days to look back
     * @returns {Promise<Array>} Error trend
     */
    async getErrorTrend(days = 30) {
        const query = `
            SELECT 
                date_trunc('day', validated_at) as date,
                COUNT(*) as total_validations,
                COUNT(*) FILTER (WHERE is_valid = false) as error_count,
                ROUND((COUNT(*) FILTER (WHERE is_valid = false)::numeric / COUNT(*)::numeric) * 100, 2) as error_rate
            FROM ${this.tableName}
            WHERE validated_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY date
            ORDER BY date DESC
        `;

        return await this.executeQuery(query);
    }

    /**
     * Create validation result
     * @param {Object} data - Validation data
     * @returns {Promise<Object>} Created validation
     */
    async createValidationResult(data) {
        const { recordId, recordType, isValid, errors, validatedAt } = data;

        const query = `
            INSERT INTO ${this.tableName} (record_id, record_type, is_valid, errors, validated_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await this.query(query, [
            recordId,
            recordType,
            isValid,
            JSON.stringify(errors || []),
            validatedAt || new Date()
        ]);

        return result.rows[0];
    }

    /**
     * Log async validation run
     * @param {Object} data - Log data
     * @returns {Promise<Object>} Created log
     */
    async logAsyncValidation(data) {
        const { startedAt, completedAt, recordsProcessed, errorsFound, status } = data;

        const query = `
            INSERT INTO async_validation_log (started_at, completed_at, records_processed, errors_found, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const result = await this.query(query, [
            startedAt,
            completedAt,
            recordsProcessed,
            errorsFound,
            status
        ]);

        return result.rows[0];
    }
}

module.exports = new ValidationRepository();





