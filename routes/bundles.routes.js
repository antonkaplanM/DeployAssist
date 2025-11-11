/**
 * Bundles Routes
 * API endpoints for product bundle management
 */

const express = require('express');
const router = express.Router();
const bundlesService = require('../services/bundles.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success, created } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get all product bundles
 * GET /api/bundles
 * Query params:
 *   - search: search term for bundle name/description
 *   - sortBy: 'name', 'created_at' (default: 'created_at')
 *   - sortOrder: 'asc', 'desc' (default: 'desc')
 */
router.get('/', asyncHandler(async (req, res) => {
    const { search, sortBy, sortOrder } = req.query;
    
    const result = await bundlesService.getBundles({ search, sortBy, sortOrder });
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        bundles: result.bundles,
        count: result.count,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get a specific bundle with its products
 * GET /api/bundles/:bundleId
 */
router.get('/:bundleId', asyncHandler(async (req, res) => {
    const { bundleId } = req.params;
    
    const bundle = await bundlesService.getBundleById(bundleId);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        bundle,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Create a new bundle
 * POST /api/bundles
 * Body: { name, description }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const userId = req.user.id;
    
    const bundle = await bundlesService.createBundle({ name, description }, userId);
    
    // Return flat structure with 201 status for backwards compatibility
    res.status(201).json({
        success: true,
        bundle,
        message: 'Bundle created successfully',
        timestamp: new Date().toISOString()
    });
}));

/**
 * Update a bundle
 * PUT /api/bundles/:bundleId
 * Body: { name, description }
 */
router.put('/:bundleId', asyncHandler(async (req, res) => {
    const { bundleId } = req.params;
    const { name, description } = req.body;
    
    const bundle = await bundlesService.updateBundle(bundleId, { name, description });
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        bundle,
        message: 'Bundle updated successfully',
        timestamp: new Date().toISOString()
    });
}));

/**
 * Delete a bundle
 * DELETE /api/bundles/:bundleId
 */
router.delete('/:bundleId', asyncHandler(async (req, res) => {
    const { bundleId } = req.params;
    
    const deletedBundle = await bundlesService.deleteBundle(bundleId);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        message: `Bundle "${deletedBundle.name}" deleted successfully`,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Duplicate a bundle
 * POST /api/bundles/:bundleId/duplicate
 * Body: { name }
 */
router.post('/:bundleId/duplicate', asyncHandler(async (req, res) => {
    const { bundleId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;
    
    const bundle = await bundlesService.duplicateBundle(bundleId, name, userId);
    
    // Return flat structure with 201 status for backwards compatibility
    res.status(201).json({
        success: true,
        bundle,
        message: 'Bundle duplicated successfully',
        timestamp: new Date().toISOString()
    });
}));

/**
 * Add products to a bundle
 * POST /api/bundles/:bundleId/products
 * Body: { products: [{ productId, quantity }] }
 */
router.post('/:bundleId/products', asyncHandler(async (req, res) => {
    const { bundleId } = req.params;
    const { products } = req.body;
    
    const result = await bundlesService.addProductsToBundle(bundleId, products);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        addedProducts: result.addedProducts,
        count: result.count,
        message: `${result.count} product(s) added to bundle`,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Update product quantity in bundle
 * PUT /api/bundles/:bundleId/products/:productId
 * Body: { quantity }
 */
router.put('/:bundleId/products/:productId', asyncHandler(async (req, res) => {
    const { bundleId, productId } = req.params;
    const { quantity } = req.body;
    
    const product = await bundlesService.updateProductQuantity(bundleId, productId, quantity);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        product,
        message: 'Product quantity updated',
        timestamp: new Date().toISOString()
    });
}));

/**
 * Remove a product from bundle
 * DELETE /api/bundles/:bundleId/products/:productId
 */
router.delete('/:bundleId/products/:productId', asyncHandler(async (req, res) => {
    const { bundleId, productId } = req.params;
    
    await bundlesService.removeProductFromBundle(bundleId, productId);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        message: 'Product removed from bundle',
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

