/**
 * Package Mappings Service
 * Business logic for package-product mappings
 */

const db = require('../database');
const logger = require('../utils/logger');

class PackageMappingsService {
    /**
     * Get products for a specific package
     * @param {String} packageName - Package name
     * @returns {Promise<Object>} Products mapped to the package
     */
    async getProductsForPackage(packageName) {
        logger.info(`Fetching products for package: ${packageName}`);
        
        const query = `
            SELECT product_code, confidence_score, occurrence_count
            FROM package_product_mapping
            WHERE package_name = $1
            ORDER BY occurrence_count DESC, product_code
        `;
        
        const result = await db.query(query, [packageName]);
        
        return {
            package: packageName,
            products: result.rows,
            count: result.rows.length
        };
    }

    /**
     * Get packages for a specific product
     * @param {String} productCode - Product code
     * @returns {Promise<Object>} Packages mapped to the product
     */
    async getPackagesForProduct(productCode) {
        logger.info(`Fetching packages for product: ${productCode}`);
        
        const query = `
            SELECT package_name, confidence_score, occurrence_count
            FROM package_product_mapping
            WHERE product_code = $1
            ORDER BY occurrence_count DESC, package_name
        `;
        
        const result = await db.query(query, [productCode]);
        
        return {
            product: productCode,
            packages: result.rows,
            count: result.rows.length
        };
    }

    /**
     * Get all package-product mappings
     * @returns {Promise<Object>} All mappings
     */
    async getAllMappings() {
        logger.info('Fetching all package-product mappings');
        
        const query = `
            SELECT 
                package_name,
                product_code,
                confidence_score,
                occurrence_count,
                source,
                last_seen
            FROM package_product_mapping
            ORDER BY package_name, occurrence_count DESC
        `;
        
        const result = await db.query(query);
        
        return {
            mappings: result.rows,
            count: result.rows.length
        };
    }
}

module.exports = new PackageMappingsService();

