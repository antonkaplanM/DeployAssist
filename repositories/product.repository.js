/**
 * Product Repository
 * Handles database operations for products table
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class ProductRepository extends BaseRepository {
    constructor() {
        super('products');
    }

    /**
     * Find products with filters
     * @param {Object} filters - Query filters
     * @returns {Promise<Array>} Products
     */
    async findWithFilters(filters = {}) {
        const {
            search,
            family,
            productGroup,
            productSelectionGrouping,
            isActive = true,
            isArchived = false,
            limit = 100,
            offset = 0
        } = filters;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Active/archived filters
        if (isActive !== undefined) {
            whereConditions.push(`is_active = $${paramIndex++}`);
            queryParams.push(isActive);
        }
        if (isArchived !== undefined) {
            whereConditions.push(`is_archived = $${paramIndex++}`);
            queryParams.push(isArchived);
        }

        // Family filter
        if (family && family !== 'all') {
            whereConditions.push(`family = $${paramIndex++}`);
            queryParams.push(family);
        }

        // Product group filter
        if (productGroup && productGroup !== 'all') {
            whereConditions.push(`product_group = $${paramIndex++}`);
            queryParams.push(productGroup);
        }

        // Product selection grouping filter
        if (productSelectionGrouping && productSelectionGrouping !== 'all') {
            whereConditions.push(`product_selection_grouping = $${paramIndex++}`);
            queryParams.push(productSelectionGrouping);
        }

        // Search filter
        if (search) {
            whereConditions.push(`(
                name ILIKE $${paramIndex} OR 
                product_code ILIKE $${paramIndex} OR 
                description ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                is_active as "IsActive",
                is_archived as "IsArchived",
                display_url as "DisplayUrl",
                product_group as "Product_Group__c",
                product_selection_grouping as "Product_Selection_Grouping__c",
                continent as "Continent__c",
                country as "Country__c",
                ri_platform_region as "RI_Platform_Region__c",
                ri_platform_sub_region as "RI_Platform_Sub_Region__c",
                model_type as "Model_Type__c",
                model_subtype as "Model_Subtype__c",
                irp_bundle_region as "IRP_Bundle_Region__c",
                irp_bundle_subregion as "IRP_Bundle_Subregion__c",
                data_api_name as "Data_API_Name__c",
                peril as "Peril__c",
                data_type as "Data_Type__c"
            FROM ${this.tableName}
            ${whereClause}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        queryParams.push(limit, offset);
        return await this.executeQuery(query, queryParams);
    }

    /**
     * Get total count with filters
     * @param {Object} filters - Query filters
     * @returns {Promise<Number>} Count
     */
    async countWithFilters(filters = {}) {
        const {
            search,
            family,
            productGroup,
            productSelectionGrouping,
            isActive = true,
            isArchived = false
        } = filters;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        if (isActive !== undefined) {
            whereConditions.push(`is_active = $${paramIndex++}`);
            queryParams.push(isActive);
        }
        if (isArchived !== undefined) {
            whereConditions.push(`is_archived = $${paramIndex++}`);
            queryParams.push(isArchived);
        }
        if (family && family !== 'all') {
            whereConditions.push(`family = $${paramIndex++}`);
            queryParams.push(family);
        }
        if (productGroup && productGroup !== 'all') {
            whereConditions.push(`product_group = $${paramIndex++}`);
            queryParams.push(productGroup);
        }
        if (productSelectionGrouping && productSelectionGrouping !== 'all') {
            whereConditions.push(`product_selection_grouping = $${paramIndex++}`);
            queryParams.push(productSelectionGrouping);
        }
        if (search) {
            whereConditions.push(`(
                name ILIKE $${paramIndex} OR 
                product_code ILIKE $${paramIndex} OR 
                description ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
        const result = await this.query(query, queryParams);
        return parseInt(result.rows[0].count);
    }

    /**
     * Get distinct filter options
     * @returns {Promise<Object>} Filter options
     */
    async getFilterOptions() {
        const familiesQuery = `
            SELECT DISTINCT family 
            FROM ${this.tableName}
            WHERE is_active = true AND is_archived = false AND family IS NOT NULL
            ORDER BY family
        `;
        const familiesResult = await this.query(familiesQuery);

        const productGroupsQuery = `
            SELECT DISTINCT product_group 
            FROM ${this.tableName}
            WHERE is_active = true AND is_archived = false AND product_group IS NOT NULL
            ORDER BY product_group
        `;
        const productGroupsResult = await this.query(productGroupsQuery);

        const productSelectionGroupingsQuery = `
            SELECT DISTINCT product_selection_grouping 
            FROM ${this.tableName}
            WHERE is_active = true AND is_archived = false AND product_selection_grouping IS NOT NULL
            ORDER BY product_selection_grouping
        `;
        const productSelectionGroupingsResult = await this.query(productSelectionGroupingsQuery);

        return {
            families: familiesResult.rows.map(r => r.family),
            productGroups: productGroupsResult.rows.map(r => r.product_group),
            productSelectionGroupings: productSelectionGroupingsResult.rows.map(r => r.product_selection_grouping)
        };
    }

    /**
     * Find product by Salesforce ID
     * @param {String} salesforceId - Salesforce ID
     * @returns {Promise<Object|null>} Product
     */
    async findBySalesforceId(salesforceId) {
        return await this.findById(salesforceId, 'salesforce_id');
    }

    /**
     * Find product by product code
     * @param {String} productCode - Product code
     * @returns {Promise<Object|null>} Product
     */
    async findByProductCode(productCode) {
        const query = `SELECT * FROM ${this.tableName} WHERE product_code = $1 LIMIT 1`;
        const result = await this.query(query, [productCode]);
        return result.rows[0] || null;
    }

    /**
     * Get products for export (with related packages)
     * @returns {Promise<Array>} Products with packages
     */
    async findAllForExport() {
        const query = `
            SELECT 
                p.name,
                p.product_code,
                p.salesforce_id,
                p.description,
                p.family,
                p.product_group,
                p.product_selection_grouping,
                p.country,
                p.continent,
                p.ri_platform_region,
                p.ri_platform_sub_region,
                p.model_type,
                p.model_subtype,
                p.irp_bundle_region,
                p.irp_bundle_subregion,
                p.data_api_name,
                p.peril,
                p.data_type,
                COALESCE(
                    string_agg(DISTINCT m.package_name, ', ' ORDER BY m.package_name),
                    ''
                ) as related_packages
            FROM ${this.tableName} p
            LEFT JOIN package_product_mapping m ON p.product_code = m.product_code
            WHERE p.is_active = true AND p.is_archived = false
            GROUP BY p.id, p.name, p.product_code, p.salesforce_id, p.description, p.family, 
                     p.product_group, p.product_selection_grouping,
                     p.country, p.continent, p.ri_platform_region, p.ri_platform_sub_region,
                     p.model_type, p.model_subtype, p.irp_bundle_region, p.irp_bundle_subregion,
                     p.data_api_name, p.peril, p.data_type
            ORDER BY p.name ASC
        `;

        return await this.executeQuery(query);
    }

    /**
     * Get product statistics
     * @returns {Promise<Object>} Product stats
     */
    async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_active = true) as active,
                COUNT(*) FILTER (WHERE is_archived = true) as archived,
                MAX(synced_at) as last_sync
            FROM ${this.tableName}
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            total: parseInt(stats.total),
            active: parseInt(stats.active),
            archived: parseInt(stats.archived),
            lastSync: stats.last_sync
        };
    }
}

module.exports = new ProductRepository();

