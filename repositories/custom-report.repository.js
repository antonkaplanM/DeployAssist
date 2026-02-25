/**
 * Custom Report Repository
 * Handles database operations for custom report definitions
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class CustomReportRepository extends BaseRepository {
    constructor() {
        super('custom_reports');
    }

    /**
     * Find a report by its URL slug
     * @param {string} slug
     * @returns {Promise<Object|null>}
     */
    async findBySlug(slug) {
        const query = `
            SELECT cr.*, u.username as created_by_username
            FROM ${this.tableName} cr
            LEFT JOIN users u ON cr.created_by = u.id
            WHERE cr.slug = $1 AND cr.is_active = true
            LIMIT 1
        `;
        const result = await this.query(query, [slug]);
        return result.rows[0] || null;
    }

    /**
     * List all active reports, optionally filtered by creator
     * @param {Object} options
     * @param {number} [options.createdBy] - Filter by user ID
     * @param {number} [options.limit]
     * @param {number} [options.offset]
     * @returns {Promise<{ reports: Array, total: number }>}
     */
    async listActive(options = {}) {
        const { createdBy, limit = 50, offset = 0 } = options;
        const params = [];
        const conditions = ['cr.is_active = true'];

        if (createdBy) {
            params.push(createdBy);
            conditions.push(`cr.created_by = $${params.length}`);
        }

        const whereClause = conditions.join(' AND ');

        const countQuery = `
            SELECT COUNT(*) as total
            FROM ${this.tableName} cr
            WHERE ${whereClause}
        `;
        const countResult = await this.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        const listParams = [...params, limit, offset];
        const listQuery = `
            SELECT cr.id, cr.name, cr.slug, cr.description,
                   cr.data_sources, cr.created_by, cr.created_at,
                   cr.updated_at, cr.version,
                   u.username as created_by_username
            FROM ${this.tableName} cr
            LEFT JOIN users u ON cr.created_by = u.id
            WHERE ${whereClause}
            ORDER BY cr.updated_at DESC
            LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `;
        const result = await this.query(listQuery, listParams);

        return { reports: result.rows, total };
    }

    /**
     * Create a new custom report
     * @param {Object} data
     * @param {string} data.name
     * @param {string} data.slug
     * @param {string} [data.description]
     * @param {Object} data.report_config - Report JSON configuration
     * @param {Object} [data.data_sources] - Data source references
     * @param {Object} [data.conversation_history] - Chat history that created this report
     * @param {number} data.created_by - User ID
     * @returns {Promise<Object>}
     */
    async createReport(data) {
        const query = `
            INSERT INTO ${this.tableName}
                (name, slug, description, report_config, data_sources, conversation_history, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const params = [
            data.name,
            data.slug,
            data.description || null,
            JSON.stringify(data.report_config),
            data.data_sources ? JSON.stringify(data.data_sources) : null,
            data.conversation_history ? JSON.stringify(data.conversation_history) : null,
            data.created_by
        ];

        const result = await this.query(query, params);
        return result.rows[0];
    }

    /**
     * Update an existing report's configuration
     * @param {number} id
     * @param {Object} data
     * @param {number} userId - Must match created_by for ownership check
     * @returns {Promise<Object|null>}
     */
    async updateReport(id, data, userId) {
        const setClauses = [];
        const params = [];

        if (data.name !== undefined) {
            params.push(data.name);
            setClauses.push(`name = $${params.length}`);
        }
        if (data.description !== undefined) {
            params.push(data.description);
            setClauses.push(`description = $${params.length}`);
        }
        if (data.report_config !== undefined) {
            params.push(JSON.stringify(data.report_config));
            setClauses.push(`report_config = $${params.length}`);
        }
        if (data.data_sources !== undefined) {
            params.push(JSON.stringify(data.data_sources));
            setClauses.push(`data_sources = $${params.length}`);
        }
        if (data.conversation_history !== undefined) {
            params.push(JSON.stringify(data.conversation_history));
            setClauses.push(`conversation_history = $${params.length}`);
        }

        if (setClauses.length === 0) {
            return await this.findById(id);
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        setClauses.push('version = version + 1');

        params.push(id);
        params.push(userId);

        const query = `
            UPDATE ${this.tableName}
            SET ${setClauses.join(', ')}
            WHERE id = $${params.length - 1}
              AND created_by = $${params.length}
              AND is_active = true
            RETURNING *
        `;

        const result = await this.query(query, params);
        return result.rows[0] || null;
    }

    /**
     * Soft-delete a report (set is_active = false)
     * @param {number} id
     * @param {number} userId - Must match created_by
     * @returns {Promise<Object|null>}
     */
    async softDelete(id, userId) {
        const query = `
            UPDATE ${this.tableName}
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND created_by = $2 AND is_active = true
            RETURNING *
        `;
        const result = await this.query(query, [id, userId]);
        return result.rows[0] || null;
    }

    /**
     * Check if a slug is already in use
     * @param {string} slug
     * @param {number} [excludeId] - Exclude this report ID from the check
     * @returns {Promise<boolean>}
     */
    async slugExists(slug, excludeId = null) {
        let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE slug = $1 AND is_active = true`;
        const params = [slug];

        if (excludeId) {
            params.push(excludeId);
            query += ` AND id != $${params.length}`;
        }

        const result = await this.query(query, params);
        return parseInt(result.rows[0].count) > 0;
    }

    /**
     * Get report with full config (including report_config JSONB)
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getFullReport(id) {
        const query = `
            SELECT cr.*, u.username as created_by_username
            FROM ${this.tableName} cr
            LEFT JOIN users u ON cr.created_by = u.id
            WHERE cr.id = $1 AND cr.is_active = true
            LIMIT 1
        `;
        const result = await this.query(query, [id]);
        return result.rows[0] || null;
    }
}

module.exports = new CustomReportRepository();
