/**
 * Bundle Repository
 * Handles database operations for product_bundles and bundle_products tables
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class BundleRepository extends BaseRepository {
    constructor() {
        super('product_bundles');
    }

    /**
     * Find all bundles with product counts
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Bundles
     */
    async findAllWithCounts(options = {}) {
        const { search, sortBy = 'created_at', sortOrder = 'DESC' } = options;

        let whereCondition = '';
        let queryParams = [];

        if (search) {
            whereCondition = 'WHERE name ILIKE $1 OR description ILIKE $1';
            queryParams.push(`%${search}%`);
        }

        const validSortFields = ['name', 'created_at'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        const query = `
            SELECT 
                pb.id,
                pb.bundle_id,
                pb.name,
                pb.description,
                pb.created_by,
                pb.created_at,
                pb.updated_at,
                u.username as created_by_username,
                COUNT(bp.id) as product_count
            FROM ${this.tableName} pb
            LEFT JOIN users u ON pb.created_by = u.id
            LEFT JOIN bundle_products bp ON pb.id = bp.bundle_id
            ${whereCondition}
            GROUP BY pb.id, pb.bundle_id, pb.name, pb.description, pb.created_by, pb.created_at, pb.updated_at, u.username
            ORDER BY pb.${sortField} ${sortDirection}
        `;

        return await this.executeQuery(query, queryParams);
    }

    /**
     * Find bundle with products
     * @param {String} bundleId - Bundle ID or internal ID
     * @returns {Promise<Object|null>} Bundle with products
     */
    async findByIdWithProducts(bundleId) {
        // Get bundle
        const bundleQuery = `
            SELECT 
                pb.id,
                pb.bundle_id,
                pb.name,
                pb.description,
                pb.created_by,
                pb.created_at,
                pb.updated_at,
                u.username as created_by_username
            FROM ${this.tableName} pb
            LEFT JOIN users u ON pb.created_by = u.id
            WHERE pb.bundle_id = $1 OR pb.id::text = $1
        `;

        const bundleResult = await this.query(bundleQuery, [bundleId]);
        const bundle = bundleResult.rows[0];

        if (!bundle) {
            return null;
        }

        // Get products
        const productsQuery = `
            SELECT 
                bp.id as bundle_product_id,
                bp.quantity,
                bp.sort_order,
                bp.added_at,
                p.salesforce_id as "Id",
                p.name as "Name",
                p.product_code as "ProductCode",
                p.description as "Description",
                p.family as "Family",
                p.is_active as "IsActive",
                p.product_group as "Product_Group__c",
                p.product_selection_grouping as "Product_Selection_Grouping__c"
            FROM bundle_products bp
            LEFT JOIN products p ON bp.product_salesforce_id = p.salesforce_id
            WHERE bp.bundle_id = $1
            ORDER BY bp.sort_order, bp.added_at
        `;

        const productsResult = await this.query(productsQuery, [bundle.id]);

        return {
            ...bundle,
            products: productsResult.rows
        };
    }

    /**
     * Get next bundle sequence number
     * @returns {Promise<String>} Bundle ID
     */
    async getNextBundleId() {
        const result = await this.query("SELECT nextval('bundle_id_seq') as seq");
        const sequenceNum = result.rows[0].seq;
        return `BUNDLE-${String(sequenceNum).padStart(3, '0')}`;
    }

    /**
     * Find bundle by bundle_id or internal id
     * @param {String} bundleId - Bundle ID
     * @returns {Promise<Object|null>} Bundle
     */
    async findByBundleId(bundleId) {
        const query = `SELECT * FROM ${this.tableName} WHERE bundle_id = $1 OR id::text = $1 LIMIT 1`;
        const result = await this.query(query, [bundleId]);
        return result.rows[0] || null;
    }

    /**
     * Update bundle by bundle_id
     * @param {String} bundleId - Bundle ID
     * @param {Object} data - Update data
     * @returns {Promise<Object|null>} Updated bundle
     */
    async updateByBundleId(bundleId, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);

        const setClauses = keys.map((key, index) => `${key} = $${index + 1}`);
        values.push(bundleId);

        const query = `
            UPDATE ${this.tableName}
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE bundle_id = $${values.length} OR id::text = $${values.length}
            RETURNING *
        `;

        const result = await this.query(query, values);
        return result.rows[0] || null;
    }

    /**
     * Delete bundle by bundle_id
     * @param {String} bundleId - Bundle ID
     * @returns {Promise<Object|null>} Deleted bundle
     */
    async deleteByBundleId(bundleId) {
        const query = `
            DELETE FROM ${this.tableName}
            WHERE bundle_id = $1 OR id::text = $1
            RETURNING bundle_id, name
        `;

        const result = await this.query(query, [bundleId]);
        return result.rows[0] || null;
    }

    /**
     * Duplicate bundle with products
     * @param {Number} originalBundleInternalId - Original bundle internal ID
     * @param {Number} newBundleInternalId - New bundle internal ID
     * @returns {Promise<Number>} Number of products copied
     */
    async duplicateBundleProducts(originalBundleInternalId, newBundleInternalId) {
        const query = `
            INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
            SELECT $1, product_salesforce_id, quantity, sort_order
            FROM bundle_products
            WHERE bundle_id = $2
        `;

        const result = await this.query(query, [newBundleInternalId, originalBundleInternalId]);
        return result.rowCount;
    }

    // === Bundle Products Operations ===

    /**
     * Add product to bundle
     * @param {Number} bundleInternalId - Bundle internal ID
     * @param {String} productId - Product Salesforce ID
     * @param {Number} quantity - Quantity
     * @param {Number} sortOrder - Sort order
     * @returns {Promise<Object>} Inserted product
     */
    async addProductToBundle(bundleInternalId, productId, quantity, sortOrder) {
        const query = `
            INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (bundle_id, product_salesforce_id) DO UPDATE
            SET quantity = bundle_products.quantity + EXCLUDED.quantity
            RETURNING *
        `;

        const result = await this.query(query, [bundleInternalId, productId, quantity, sortOrder]);
        return result.rows[0];
    }

    /**
     * Get max sort order for bundle
     * @param {Number} bundleInternalId - Bundle internal ID
     * @returns {Promise<Number>} Max sort order
     */
    async getMaxSortOrder(bundleInternalId) {
        const query = 'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM bundle_products WHERE bundle_id = $1';
        const result = await this.query(query, [bundleInternalId]);
        return result.rows[0].max_sort;
    }

    /**
     * Update product quantity in bundle
     * @param {Number} bundleInternalId - Bundle internal ID
     * @param {String} productId - Product Salesforce ID
     * @param {Number} quantity - New quantity
     * @returns {Promise<Object|null>} Updated product
     */
    async updateProductQuantity(bundleInternalId, productId, quantity) {
        const query = `
            UPDATE bundle_products
            SET quantity = $1
            WHERE bundle_id = $2 AND product_salesforce_id = $3
            RETURNING *
        `;

        const result = await this.query(query, [quantity, bundleInternalId, productId]);
        return result.rows[0] || null;
    }

    /**
     * Remove product from bundle
     * @param {Number} bundleInternalId - Bundle internal ID
     * @param {String} productId - Product Salesforce ID
     * @returns {Promise<Object|null>} Removed product
     */
    async removeProductFromBundle(bundleInternalId, productId) {
        const query = `
            DELETE FROM bundle_products
            WHERE bundle_id = $1 AND product_salesforce_id = $2
            RETURNING product_salesforce_id
        `;

        const result = await this.query(query, [bundleInternalId, productId]);
        return result.rows[0] || null;
    }
}

module.exports = new BundleRepository();

