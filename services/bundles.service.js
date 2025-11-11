/**
 * Bundles Service
 * Business logic for product bundle management
 */

const db = require('../database');
const logger = require('../utils/logger');
const { NotFoundError, ConflictError, BadRequestError } = require('../middleware/error-handler');

class BundlesService {
    /**
     * Get all bundles with optional filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Bundles list
     */
    async getBundles(options = {}) {
        const { search, sortBy = 'created_at', sortOrder = 'DESC' } = options;
        
        logger.info(`Fetching bundles (search: ${search || 'none'})`);
        
        let whereCondition = '';
        let queryParams = [];
        
        if (search) {
            whereCondition = 'WHERE name ILIKE $1 OR description ILIKE $1';
            queryParams.push(`%${search}%`);
        }
        
        // Validate sort parameters
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
            FROM product_bundles pb
            LEFT JOIN users u ON pb.created_by = u.id
            LEFT JOIN bundle_products bp ON pb.id = bp.bundle_id
            ${whereCondition}
            GROUP BY pb.id, pb.bundle_id, pb.name, pb.description, pb.created_by, pb.created_at, pb.updated_at, u.username
            ORDER BY pb.${sortField} ${sortDirection}
        `;
        
        const result = await db.query(query, queryParams);
        
        return {
            bundles: result.rows,
            count: result.rows.length
        };
    }

    /**
     * Get a specific bundle with its products
     * @param {String} bundleId - Bundle ID (bundle_id or internal id)
     * @returns {Promise<Object>} Bundle with products
     */
    async getBundleById(bundleId) {
        logger.info(`Fetching bundle details: ${bundleId}`);
        
        // Get bundle info
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
            FROM product_bundles pb
            LEFT JOIN users u ON pb.created_by = u.id
            WHERE pb.bundle_id = $1 OR pb.id::text = $1
        `;
        
        const bundleResult = await db.query(bundleQuery, [bundleId]);
        
        if (bundleResult.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        const bundle = bundleResult.rows[0];
        
        // Get products in bundle
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
        
        const productsResult = await db.query(productsQuery, [bundle.id]);
        
        return {
            ...bundle,
            products: productsResult.rows
        };
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
        const sequenceResult = await db.query("SELECT nextval('bundle_id_seq') as seq");
        const sequenceNum = sequenceResult.rows[0].seq;
        const bundleId = `BUNDLE-${String(sequenceNum).padStart(3, '0')}`;
        
        // Insert bundle
        const query = `
            INSERT INTO product_bundles (bundle_id, name, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING 
                id,
                bundle_id,
                name,
                description,
                created_by,
                created_at,
                updated_at
        `;
        
        try {
            const result = await db.query(query, [bundleId, name.trim(), description.trim(), userId]);
            return result.rows[0];
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
        
        const query = `
            UPDATE product_bundles
            SET 
                name = $1,
                description = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE bundle_id = $3 OR id::text = $3
            RETURNING 
                id,
                bundle_id,
                name,
                description,
                created_by,
                created_at,
                updated_at
        `;
        
        try {
            const result = await db.query(query, [name.trim(), description?.trim() || '', bundleId]);
            
            if (result.rows.length === 0) {
                throw new NotFoundError('Bundle not found');
            }
            
            return result.rows[0];
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
        
        const query = `
            DELETE FROM product_bundles
            WHERE bundle_id = $1 OR id::text = $1
            RETURNING bundle_id, name
        `;
        
        const result = await db.query(query, [bundleId]);
        
        if (result.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        return result.rows[0];
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
        const originalBundle = await db.query(
            'SELECT * FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (originalBundle.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        // Generate new bundle ID
        const sequenceResult = await db.query("SELECT nextval('bundle_id_seq') as seq");
        const sequenceNum = sequenceResult.rows[0].seq;
        const newBundleId = `BUNDLE-${String(sequenceNum).padStart(3, '0')}`;
        
        // Create new bundle
        const insertBundleQuery = `
            INSERT INTO product_bundles (bundle_id, name, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id, bundle_id, name, description, created_by, created_at, updated_at
        `;
        
        try {
            const newBundle = await db.query(insertBundleQuery, [
                newBundleId,
                newName.trim(),
                originalBundle.rows[0].description,
                userId
            ]);
            
            // Copy products from original bundle
            const copyProductsQuery = `
                INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
                SELECT $1, product_salesforce_id, quantity, sort_order
                FROM bundle_products
                WHERE bundle_id = $2
            `;
            
            await db.query(copyProductsQuery, [newBundle.rows[0].id, originalBundle.rows[0].id]);
            
            return newBundle.rows[0];
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
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        const bundleInternalId = bundleResult.rows[0].id;
        
        // Get current max sort_order
        const maxSortResult = await db.query(
            'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM bundle_products WHERE bundle_id = $1',
            [bundleInternalId]
        );
        let sortOrder = maxSortResult.rows[0].max_sort + 1;
        
        // Insert products
        const insertedProducts = [];
        for (const product of products) {
            const { productId, quantity = 1 } = product;
            
            try {
                const insertQuery = `
                    INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (bundle_id, product_salesforce_id) DO UPDATE
                    SET quantity = bundle_products.quantity + EXCLUDED.quantity
                    RETURNING id, product_salesforce_id, quantity, sort_order
                `;
                
                const result = await db.query(insertQuery, [bundleInternalId, productId, quantity, sortOrder]);
                insertedProducts.push(result.rows[0]);
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
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        const query = `
            UPDATE bundle_products
            SET quantity = $1
            WHERE bundle_id = $2 AND product_salesforce_id = $3
            RETURNING id, product_salesforce_id, quantity
        `;
        
        const result = await db.query(query, [quantity, bundleResult.rows[0].id, productId]);
        
        if (result.rows.length === 0) {
            throw new NotFoundError('Product not found in bundle');
        }
        
        return result.rows[0];
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
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            throw new NotFoundError('Bundle not found');
        }
        
        const query = `
            DELETE FROM bundle_products
            WHERE bundle_id = $1 AND product_salesforce_id = $2
            RETURNING product_salesforce_id
        `;
        
        const result = await db.query(query, [bundleResult.rows[0].id, productId]);
        
        if (result.rows.length === 0) {
            throw new NotFoundError('Product not found in bundle');
        }
        
        return result.rows[0];
    }
}

module.exports = new BundlesService();

