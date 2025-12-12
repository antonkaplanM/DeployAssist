/**
 * Audit Repository
 * Handles database operations for Professional Services audit trail
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class AuditRepository extends BaseRepository {
    constructor() {
        super('ps_audit_trail');
    }

    /**
     * Search PS records
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Records and pagination
     */
    async searchRecords(options = {}) {
        const { query: searchQuery, status, limit = 50, page = 1 } = options;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (searchQuery) {
            whereConditions.push(`(
                ps_record_name ILIKE $${paramIndex} OR
                account_name ILIKE $${paramIndex} OR
                salesforce_id ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${searchQuery}%`);
            paramIndex++;
        }

        if (status) {
            whereConditions.push(`current_status = $${paramIndex++}`);
            queryParams.push(status);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const countResult = await this.query(countQuery, queryParams);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get records
        queryParams.push(limit, offset);
        const dataQuery = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY last_captured_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const dataResult = await this.query(dataQuery, queryParams);

        return {
            records: dataResult.rows,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    }

    /**
     * Find PS record by identifier
     * @param {String} identifier - Salesforce ID or record name
     * @returns {Promise<Object|null>} PS record
     */
    async findByIdentifier(identifier) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE salesforce_id = $1 OR ps_record_name ILIKE $1
            ORDER BY last_captured_at DESC
            LIMIT 1
        `;

        const result = await this.query(query, [identifier]);
        return result.rows[0] || null;
    }

    /**
     * Get status change history for a record
     * @param {String} identifier - Salesforce ID or record name
     * @returns {Promise<Array>} Status changes
     */
    async getStatusChanges(identifier) {
        const query = `
            SELECT 
                previous_status,
                current_status,
                status_changed_at,
                change_details
            FROM ps_status_changes
            WHERE ps_record_salesforce_id = $1 OR ps_record_name ILIKE $1
            ORDER BY status_changed_at DESC
        `;

        return await this.executeQuery(query, [identifier]);
    }

    /**
     * Get audit trail statistics
     * @returns {Promise<Object>} Statistics
     */
    async getAuditStats() {
        const query = `
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT account_name) as unique_accounts,
                COUNT(*) FILTER (WHERE current_status = 'Active') as active_records,
                COUNT(*) FILTER (WHERE current_status = 'Completed') as completed_records,
                COUNT(*) FILTER (WHERE current_status = 'On Hold') as on_hold_records,
                MAX(last_captured_at) as last_capture_time,
                COUNT(*) FILTER (WHERE last_captured_at >= CURRENT_DATE - INTERVAL '7 days') as updated_last_week
            FROM ${this.tableName}
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            total: parseInt(stats.total_records),
            uniqueAccounts: parseInt(stats.unique_accounts),
            byStatus: {
                active: parseInt(stats.active_records),
                completed: parseInt(stats.completed_records),
                onHold: parseInt(stats.on_hold_records)
            },
            lastCaptureTime: stats.last_capture_time,
            updatedLastWeek: parseInt(stats.updated_last_week)
        };
    }

    /**
     * Create or update audit record
     * @param {Object} data - Audit record data
     * @returns {Promise<Object>} Created/updated record
     */
    async upsertAuditRecord(data) {
        const {
            salesforceId,
            psRecordName,
            accountName,
            currentStatus,
            recordData
        } = data;

        const query = `
            INSERT INTO ${this.tableName} 
            (salesforce_id, ps_record_name, account_name, current_status, record_data, last_captured_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (salesforce_id) DO UPDATE
            SET 
                ps_record_name = EXCLUDED.ps_record_name,
                account_name = EXCLUDED.account_name,
                current_status = EXCLUDED.current_status,
                record_data = EXCLUDED.record_data,
                last_captured_at = CURRENT_TIMESTAMP,
                capture_count = ${this.tableName}.capture_count + 1
            RETURNING *
        `;

        const result = await this.query(query, [
            salesforceId,
            psRecordName,
            accountName,
            currentStatus,
            JSON.stringify(recordData)
        ]);

        return result.rows[0];
    }

    /**
     * Log status change
     * @param {Object} data - Status change data
     * @returns {Promise<Object>} Created log
     */
    async logStatusChange(data) {
        const {
            psRecordSalesforceId,
            psRecordName,
            previousStatus,
            currentStatus,
            changeDetails
        } = data;

        const query = `
            INSERT INTO ps_status_changes 
            (ps_record_salesforce_id, ps_record_name, previous_status, current_status, status_changed_at, change_details)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
            RETURNING *
        `;

        const result = await this.query(query, [
            psRecordSalesforceId,
            psRecordName,
            previousStatus,
            currentStatus,
            JSON.stringify(changeDetails || {})
        ]);

        return result.rows[0];
    }

    /**
     * Get records by account
     * @param {String} accountName - Account name
     * @returns {Promise<Array>} Records
     */
    async findByAccount(accountName) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE account_name ILIKE $1
            ORDER BY last_captured_at DESC
        `;

        return await this.executeQuery(query, [`%${accountName}%`]);
    }
}

module.exports = new AuditRepository();








