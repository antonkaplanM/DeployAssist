/**
 * Bundles Service
 * Business logic for product bundle management
 */

const bundleRepository = require('../repositories/bundle.repository');
const logger = require('../utils/logger');
const { NotFoundError, ConflictError, BadRequestError } = require('../middleware/error-handler');

class BundlesService {
    /**
     * Get all bundles with optional filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Bundles list
     */
    async getBundles(options = {}) {
        logger.info(`Fetching bundles (search: ${options.search || 'none'})`);
        
        const bundles = await bundleRepository.findAllWithCounts(options);
        
        return {
            bundles,
            count: bundles.length
        };
    }

    /**
     * Get a specific bundle with its products
     * @param {String} bundleId - Bundle ID (bundle_id or internal id)
     * @returns {Promise<Object>} Bundle with products
     */
    async getBundleById(bundleId) {
        logger.info(`Fetching bundle details: ${bundleId}`);
        
        const bundle = await bundleRepository.findByIdWithProducts(bundleId);
        
        if (!bundle) {
            throw new NotFoundError('Bundle not found');
        }
        
        return bundle;
    }

    /**
     * Create a new bundle
     * @param {Object} bundleData - Bundle data
     * @param {Number} userId - User ID creating the bundle
     * @returns {Promise<Object>} Created bundle
     */
    async createBundle(bundleData, userId) {
        const { name, description = '' } = bundleData;
        
        if (!name || name.trim().length === 0) {
            throw new BadRequestError('Bundle name is required');
        }
        
        logger.info(`Creating new bundle: ${name}`);
        
        // Generate sequential bundle ID
        const bundleId = await bundleRepository.getNextBundleId();
        
        // Create bundle
        try {
            return await bundleRepository.create({
                bundle_id: bundleId,
                name: name.trim(),
                description: description.trim(),
                created_by: userId
            });
        } catch (err) {
            if (err.constraint === 'unique_bundle_name') {
                throw new ConflictError('A bundle with this name already exists');
            }
            throw err;
        }
    }

    /**
     * Update a bundle
     * @param {String} bundleId - Bundle ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated bundle
     */
    async updateBundle(bundleId, updateData) {
        const { name, description } = updateData;
        
        if (!name || name.trim().length === 0) {
            throw new BadRequestError('Bundle name is required');
        }
        
        logger.info(`Updating bundle: ${bundleId}`);
        
        try {
            const result = await bundleRepository.updateByBundleId(bundleId, {
                name: name.trim(),
                description: description?.trim() || ''
            });
            
            if (!result) {
                throw new NotFoundError('Bundle not found');
            }
            
            return result;
        } catch (err) {
            if (err.constraint === 'unique_bundle_name') {
                throw new ConflictError('A bundle with this name already exists');
            }
            throw err;
        }
    }

    /**
     * Delete a bundle
     * @param {String} bundleId - Bundle ID
     * @returns {Promise<Object>} Deleted bundle info
     */
    async deleteBundle(bundleId) {
        logger.info(`Deleting bundle: ${bundleId}`);
        
        const result = await bundleRepository.deleteByBundleId(bundleId);
        
        if (!result) {
            throw new NotFoundError('Bundle not found');
        }
        
        return result;
    }

    /**
     * Duplicate a bundle
     * @param {String} bundleId - Bundle ID to duplicate
     * @param {String} newName - Name for the new bundle
     * @param {Number} userId - User ID creating the duplicate
     * @returns {Promise<Object>} New bundle
     */
    async duplicateBundle(bundleId, newName, userId) {
        if (!newName || newName.trim().length === 0) {
            throw new BadRequestError('New bundle name is required');
        }
        
        logger.info(`Duplicating bundle: ${bundleId} as "${newName}"`);
        
        // Get original bundle
        const originalBundle = await bundleRepository.findByBundleId(bundleId);
        
        if (!originalBundle) {
            throw new NotFoundError('Bundle not found');
        }
        
        // Generate new bundle ID
        const newBundleId = await bundleRepository.getNextBundleId();
        
        // Create new bundle
        try {
            const newBundle = await bundleRepository.create({
                bundle_id: newBundleId,
                name: newName.trim(),
                description: originalBundle.description,
                created_by: userId
            });
            
            // Copy products from original bundle
            await bundleRepository.duplicateBundleProducts(originalBundle.id, newBundle.id);
            
            return newBundle;
        } catch (err) {
            if (err.constraint === 'unique_bundle_name') {
                throw new ConflictError('A bundle with this name already exists');
            }
            throw err;
        }
    }

    /**
     * Add products to a bundle
     * @param {String} bundleId - Bundle ID
     * @param {Array} products - Array of {productId, quantity}
     * @returns {Promise<Object>} Added products
     */
    async addProductsToBundle(bundleId, products) {
        if (!products || !Array.isArray(products) || products.length === 0) {
            throw new BadRequestError('Products array is required');
        }
        
        logger.info(`Adding ${products.length} product(s) to bundle: ${bundleId}`);
        
        // Get bundle internal ID
        const bundle = await bundleRepository.findByBundleId(bundleId);
        
        if (!bundle) {
            throw new NotFoundError('Bundle not found');
        }
        
        const bundleInternalId = bundle.id;
        
        // Get current max sort_order
        let sortOrder = await bundleRepository.getMaxSortOrder(bundleInternalId) + 1;
        
        // Insert products
        const insertedProducts = [];
        for (const product of products) {
            const { productId, quantity = 1 } = product;
            
            try {
                const result = await bundleRepository.addProductToBundle(
                    bundleInternalId,
                    productId,
                    quantity,
                    sortOrder
                );
                insertedProducts.push(result);
                sortOrder++;
            } catch (err) {
                logger.warn(`Failed to add product ${productId}:`, err.message);
            }
        }
        
        return {
            addedProducts: insertedProducts,
            count: insertedProducts.length
        };
    }

    /**
     * Update product quantity in bundle
     * @param {String} bundleId - Bundle ID
     * @param {String} productId - Product Salesforce ID
     * @param {Number} quantity - New quantity
     * @returns {Promise<Object>} Updated product
     */
    async updateProductQuantity(bundleId, productId, quantity) {
        if (!quantity || quantity < 1) {
            throw new BadRequestError('Valid quantity is required (minimum 1)');
        }
        
        logger.info(`Updating product quantity in bundle ${bundleId}: ${productId} = ${quantity}`);
        
        // Get bundle internal ID
        const bundle = await bundleRepository.findByBundleId(bundleId);
        
        if (!bundle) {
            throw new NotFoundError('Bundle not found');
        }
        
        const result = await bundleRepository.updateProductQuantity(bundle.id, productId, quantity);
        
        if (!result) {
            throw new NotFoundError('Product not found in bundle');
        }
        
        return result;
    }

    /**
     * Remove a product from bundle
     * @param {String} bundleId - Bundle ID
     * @param {String} productId - Product Salesforce ID
     * @returns {Promise<Object>} Removed product info
     */
    async removeProductFromBundle(bundleId, productId) {
        logger.info(`Removing product from bundle ${bundleId}: ${productId}`);
        
        // Get bundle internal ID
        const bundle = await bundleRepository.findByBundleId(bundleId);
        
        if (!bundle) {
            throw new NotFoundError('Bundle not found');
        }
        
        const result = await bundleRepository.removeProductFromBundle(bundle.id, productId);
        
        if (!result) {
            throw new NotFoundError('Product not found in bundle');
        }
        
        return result;
    }
}

module.exports = new BundlesService();

