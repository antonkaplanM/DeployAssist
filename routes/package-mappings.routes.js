/**
 * Package Mappings Routes
 * API endpoints for package-product mapping management
 */

const express = require('express');
const router = express.Router();
const packageMappingsService = require('../services/package-mappings.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');

/**
 * Get all package-product mappings
 * GET /api/package-product-mappings
 */
router.get('/', asyncHandler(async (req, res) => {
    const result = await packageMappingsService.getAllMappings();
    res.json({
        success: true,
        mappings: result.mappings,
        count: result.count,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get products for a specific package
 * GET /api/package-product-mappings/package/:identifier/products
 */
router.get('/package/:identifier/products', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const result = await packageMappingsService.getProductsForPackage(identifier);
    res.json({
        success: true,
        products: result.products,
        package: result.package,
        count: result.count,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get packages for a specific product
 * GET /api/package-product-mappings/product/:productCode/packages
 */
router.get('/product/:productCode/packages', asyncHandler(async (req, res) => {
    const { productCode } = req.params;
    const result = await packageMappingsService.getPackagesForProduct(productCode);
    res.json({
        success: true,
        packages: result.packages,
        product: result.product,
        count: result.count,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

