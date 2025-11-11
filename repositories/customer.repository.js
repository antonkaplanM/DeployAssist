/**
 * Customer Repository
 * Handles database operations for customer/account data
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class CustomerRepository extends BaseRepository {
    constructor() {
        super('accounts');
    }

    /**
     * Find customer by Salesforce ID
     * @param {String} salesforceId - Salesforce ID
     * @returns {Promise<Object|null>} Customer
     */
    async findBySalesforceId(salesforceId) {
        return await this.findById(salesforceId, 'salesforce_id');
    }

    /**
     * Find customer by name
     * @param {String} name - Customer name
     * @returns {Promise<Object|null>} Customer
     */
    async findByName(name) {
        const query = `SELECT * FROM ${this.tableName} WHERE name ILIKE $1 LIMIT 1`;
        const result = await this.query(query, [`%${name}%`]);
        return result.rows[0] || null;
    }

    /**
     * Search customers
     * @param {String} searchTerm - Search term
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Customers
     */
    async search(searchTerm, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT *
            FROM ${this.tableName}
            WHERE name ILIKE $1 OR salesforce_id ILIKE $1
            ORDER BY name
            LIMIT $2 OFFSET $3
        `;

        return await this.executeQuery(query, [`%${searchTerm}%`, limit, offset]);
    }

    /**
     * Get customer products
     * @param {String} accountId - Account Salesforce ID
     * @returns {Promise<Array>} Products
     */
    async getCustomerProducts(accountId) {
        const query = `
            SELECT 
                e.product_name,
                e.product_code,
                e.product_category,
                e.start_date,
                e.end_date,
                e.quantity,
                e.status,
                (e.end_date - CURRENT_DATE) as days_until_expiration
            FROM entitlements e
            WHERE e.account_salesforce_id = $1
            ORDER BY e.end_date DESC, e.product_name
        `;

        return await this.executeQuery(query, [accountId]);
    }

    /**
     * Get active customers by region
     * @param {String} region - Region (NAM, EMEA, APAC, etc.)
     * @returns {Promise<Array>} Customers
     */
    async findByRegion(region) {
        const query = `
            SELECT * FROM ${this.tableName}
            WHERE region = $1 AND is_active = true
            ORDER BY name
        `;

        return await this.executeQuery(query, [region]);
    }

    /**
     * Get customer statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total_customers,
                COUNT(*) FILTER (WHERE is_active = true) as active_customers,
                COUNT(*) FILTER (WHERE region = 'NAM') as nam_customers,
                COUNT(*) FILTER (WHERE region = 'EMEA') as emea_customers,
                COUNT(*) FILTER (WHERE region = 'APAC') as apac_customers
            FROM ${this.tableName}
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            total: parseInt(stats.total_customers),
            active: parseInt(stats.active_customers),
            byRegion: {
                NAM: parseInt(stats.nam_customers),
                EMEA: parseInt(stats.emea_customers),
                APAC: parseInt(stats.apac_customers)
            }
        };
    }
}

module.exports = new CustomerRepository();


