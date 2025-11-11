/**
 * Package Mappings Service
 * Business logic for package-product mappings
 */

const packageMappingRepository = require('../repositories/package-mapping.repository');
const logger = require('../utils/logger');

class PackageMappingsService {
    /**
     * Get products for a specific package
     * @param {String} packageName - Package name
     * @returns {Promise<Object>} Products mapped to the package
     */
    async getProductsForPackage(packageName) {
        logger.info(`Fetching products for package: ${packageName}`);
        
        const products = await packageMappingRepository.findByPackageName(packageName);
        
        return {
            package: packageName,
            products,
            count: products.length
        };
    }

    /**
     * Get packages for a specific product
     * @param {String} productCode - Product code
     * @returns {Promise<Object>} Packages mapped to the product
     */
    async getPackagesForProduct(productCode) {
        logger.info(`Fetching packages for product: ${productCode}`);
        
        const packages = await packageMappingRepository.findByProductCode(productCode);
        
        return {
            product: productCode,
            packages,
            count: packages.length
        };
    }

    /**
     * Get all package-product mappings
     * @returns {Promise<Object>} All mappings
     */
    async getAllMappings() {
        logger.info('Fetching all package-product mappings');
        
        const mappings = await packageMappingRepository.findAllWithDetails();
        
        return {
            mappings,
            count: mappings.length
        };
    }
}

module.exports = new PackageMappingsService();

