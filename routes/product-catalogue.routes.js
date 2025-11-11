/**
 * Product Catalogue Routes
 * API endpoints for product catalogue management
 */

const express = require('express');
const router = express.Router();
const productCatalogueService = require('../services/product-catalogue.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');
const { requireBundleColumns } = require('../middleware/check-bundle-columns');

// NOTE: Middleware imports - these should be added when mounting in app.js:
// - authenticate: JWT authentication middleware
// - requireAdmin: Admin role check middleware

/**
 * Get product catalogue from local database
 * GET /api/product-catalogue
 * Query params: 
 *   - search: search term for product name/code/description
 *   - family: filter by product family
 *   - productGroup: filter by product group
 *   - productSelectionGrouping: filter by product selection grouping
 *   - isActive: filter by active status (default: true)
 *   - limit: max results (default: 100, max: 2000)
 *   - offset: pagination offset (default: 0)
 */
router.get('/', asyncHandler(async (req, res) => {
    const result = await productCatalogueService.getProductCatalogue(req.query);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Export product catalogue to Excel
 * GET /api/product-catalogue/export
 * Returns an Excel file with all products
 * NOTE: This route MUST come before the :productId route to avoid conflicts
 */
router.get('/export', asyncHandler(async (req, res) => {
    logger.info('Exporting product catalogue to Excel');
    
    const { buffer, filename } = await productCatalogueService.exportProductCatalogue();

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    // Send the file
    res.send(buffer);
}));

/**
 * Refresh product catalogue from Salesforce
 * POST /api/product-catalogue/refresh
 * Triggers a sync of all products from Salesforce to local database
 * Requires: authenticate, requireAdmin middleware
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    const result = await productCatalogueService.refreshProductCatalogue();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get product sync status and history
 * GET /api/product-catalogue/sync-status
 */
router.get('/sync-status', asyncHandler(async (req, res) => {
    const result = await productCatalogueService.getSyncStatus();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get regional bundles (products with multiple RI Subregion values)
 * GET /api/product-catalogue/regional-bundles
 * Query params: same as main catalogue
 * NOTE: This route MUST come before the :productId route to avoid conflicts
 * NOTE: Requires bundle columns to exist (run migration first)
 */
router.get('/regional-bundles', requireBundleColumns, asyncHandler(async (req, res) => {
    const result = await productCatalogueService.getRegionalBundles(req.query);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get a specific product by ID from local database
 * GET /api/product-catalogue/:productId
 * NOTE: This route with :productId param MUST come AFTER specific routes like /export and /regional-bundles
 */
router.get('/:productId', asyncHandler(async (req, res) => {
    const { productId } = req.params;
    
    const result = await productCatalogueService.getProductById(productId);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

