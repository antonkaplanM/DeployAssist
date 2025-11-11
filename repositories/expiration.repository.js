/**
 * Expiration Repository
 * Handles database operations for expiration monitoring
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class ExpirationRepository extends BaseRepository {
    constructor() {
        super('entitlements');
    }

    /**
     * Find expiring entitlements within date range
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Expiring entitlements
     */
    async findExpiringEntitlements(options = {}) {
        const { 
            daysAhead = 30, 
            accountName, 
            productName, 
            region, 
            sortBy = 'end_date' 
        } = options;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Date range filter
        whereConditions.push(`end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysAhead} days'`);

        // Account filter
        if (accountName) {
            whereConditions.push(`account_name ILIKE $${paramIndex++}`);
            queryParams.push(`%${accountName}%`);
        }

        // Product filter
        if (productName) {
            whereConditions.push(`product_name ILIKE $${paramIndex++}`);
            queryParams.push(`%${productName}%`);
        }

        // Region filter
        if (region) {
            whereConditions.push(`region = $${paramIndex++}`);
            queryParams.push(region);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const validSortFields = ['end_date', 'account_name', 'product_name', 'region'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'end_date';

        const query = `
            SELECT 
                *,
                (end_date - CURRENT_DATE) as days_until_expiration
            FROM ${this.tableName}
            ${whereClause}
            ORDER BY ${sortField} ASC, end_date ASC
        `;

        return await this.executeQuery(query, queryParams);
    }

    /**
     * Find expired entitlements
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Expired entitlements
     */
    async findExpiredEntitlements(options = {}) {
        const { accountName, productName, category, excludeProduct, groupByAccount = false } = options;

        let whereConditions = ['end_date < CURRENT_DATE'];
        let queryParams = [];
        let paramIndex = 1;

        if (accountName) {
            whereConditions.push(`account_name ILIKE $${paramIndex++}`);
            queryParams.push(`%${accountName}%`);
        }

        if (productName) {
            whereConditions.push(`product_name ILIKE $${paramIndex++}`);
            queryParams.push(`%${productName}%`);
        }

        if (category) {
            whereConditions.push(`product_category = $${paramIndex++}`);
            queryParams.push(category);
        }

        if (excludeProduct) {
            whereConditions.push(`product_name NOT ILIKE $${paramIndex++}`);
            queryParams.push(`%${excludeProduct}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        if (groupByAccount) {
            const query = `
                SELECT 
                    account_name,
                    account_salesforce_id,
                    COUNT(*) as expired_count,
                    string_agg(DISTINCT product_name, ', ') as expired_products
                FROM ${this.tableName}
                ${whereClause}
                GROUP BY account_name, account_salesforce_id
                ORDER BY expired_count DESC, account_name
            `;

            return await this.executeQuery(query, queryParams);
        } else {
            const query = `
                SELECT * FROM ${this.tableName}
                ${whereClause}
                ORDER BY end_date DESC, account_name
            `;

            return await this.executeQuery(query, queryParams);
        }
    }

    /**
     * Get expiration statistics
     * @param {Number} daysAhead - Days to look ahead
     * @returns {Promise<Object>} Statistics
     */
    async getExpirationStats(daysAhead = 30) {
        const query = `
            SELECT 
                COUNT(*) as total_expiring,
                COUNT(DISTINCT account_name) as unique_accounts,
                COUNT(DISTINCT product_name) as unique_products,
                COUNT(*) FILTER (WHERE region = 'NAM') as nam_count,
                COUNT(*) FILTER (WHERE region = 'EMEA') as emea_count,
                COUNT(*) FILTER (WHERE region = 'APAC') as apac_count,
                MIN(end_date) as earliest_expiration,
                MAX(end_date) as latest_expiration
            FROM ${this.tableName}
            WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${daysAhead} days'
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            totalExpiring: parseInt(stats.total_expiring),
            uniqueAccounts: parseInt(stats.unique_accounts),
            uniqueProducts: parseInt(stats.unique_products),
            byRegion: {
                NAM: parseInt(stats.nam_count),
                EMEA: parseInt(stats.emea_count),
                APAC: parseInt(stats.apac_count)
            },
            earliestExpiration: stats.earliest_expiration,
            latestExpiration: stats.latest_expiration
        };
    }

    /**
     * Find entitlements by account
     * @param {String} accountName - Account name
     * @returns {Promise<Array>} Entitlements
     */
    async findByAccount(accountName) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE account_name ILIKE $1
            ORDER BY end_date ASC
        `;

        return await this.executeQuery(query, [`%${accountName}%`]);
    }

    /**
     * Get last refresh time
     * @returns {Promise<Date|null>} Last refresh timestamp
     */
    async getLastRefreshTime() {
        const query = `SELECT MAX(synced_at) as last_refresh FROM ${this.tableName}`;
        const result = await this.query(query);
        return result.rows[0].last_refresh;
    }
}

module.exports = new ExpirationRepository();


