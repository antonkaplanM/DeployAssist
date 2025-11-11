/**
 * Package Mapping Repository
 * Handles database operations for package_product_mapping table
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class PackageMappingRepository extends BaseRepository {
    constructor() {
        super('package_product_mapping');
    }

    /**
     * Find mappings by package name
     * @param {String} packageName - Package name
     * @returns {Promise<Array>} Mappings
     */
    async findByPackageName(packageName) {
        const query = `SELECT * FROM ${this.tableName} WHERE package_name = $1 ORDER BY product_code`;
        return await this.executeQuery(query, [packageName]);
    }

    /**
     * Find mappings by product code
     * @param {String} productCode - Product code
     * @returns {Promise<Array>} Mappings
     */
    async findByProductCode(productCode) {
        const query = `SELECT * FROM ${this.tableName} WHERE product_code = $1 ORDER BY package_name`;
        return await this.executeQuery(query, [productCode]);
    }

    /**
     * Get all mappings with package and product details
     * @returns {Promise<Array>} Mappings with details
     */
    async findAllWithDetails() {
        const query = `
            SELECT 
                m.id,
                m.package_name,
                m.product_code,
                m.created_at,
                pkg.package_type,
                pkg.description as package_description,
                p.name as product_name,
                p.family as product_family
            FROM ${this.tableName} m
            LEFT JOIN packages pkg ON m.package_name = pkg.package_name
            LEFT JOIN products p ON m.product_code = p.product_code
            ORDER BY m.package_name, m.product_code
        `;

        return await this.executeQuery(query);
    }

    /**
     * Create or update mapping
     * @param {String} packageName - Package name
     * @param {String} productCode - Product code
     * @returns {Promise<Object>} Mapping
     */
    async upsertMapping(packageName, productCode) {
        const query = `
            INSERT INTO ${this.tableName} (package_name, product_code)
            VALUES ($1, $2)
            ON CONFLICT (package_name, product_code) DO NOTHING
            RETURNING *
        `;

        const result = await this.query(query, [packageName, productCode]);
        return result.rows[0];
    }

    /**
     * Delete mapping
     * @param {String} packageName - Package name
     * @param {String} productCode - Product code
     * @returns {Promise<Boolean>} Success
     */
    async deleteMapping(packageName, productCode) {
        const query = `
            DELETE FROM ${this.tableName}
            WHERE package_name = $1 AND product_code = $2
        `;

        const result = await this.query(query, [packageName, productCode]);
        return result.rowCount > 0;
    }

    /**
     * Get product count per package
     * @returns {Promise<Array>} Counts
     */
    async getProductCountsPerPackage() {
        const query = `
            SELECT 
                package_name,
                COUNT(*) as product_count
            FROM ${this.tableName}
            GROUP BY package_name
            ORDER BY product_count DESC, package_name
        `;

        return await this.executeQuery(query);
    }

    /**
     * Get package count per product
     * @returns {Promise<Array>} Counts
     */
    async getPackageCountsPerProduct() {
        const query = `
            SELECT 
                product_code,
                COUNT(*) as package_count
            FROM ${this.tableName}
            GROUP BY product_code
            ORDER BY package_count DESC, product_code
        `;

        return await this.executeQuery(query);
    }
}

module.exports = new PackageMappingRepository();

