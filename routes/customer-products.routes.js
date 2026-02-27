/**
 * Customer Products Routes
 * API endpoints for customer product management
 */

const express = require('express');
const router = express.Router();
const customerProductsService = require('../services/customer-products.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get aggregated customer products for an account
 * GET /api/customer-products
 * Query params:
 *   - account: Account name (required)
 *   - includeExpired: Include expired products (default: false)
 */
router.get('/', asyncHandler(async (req, res) => {
    logger.debug('Customer products API called', req.query);
    
    const accountName = req.query.account;
    const includeExpired = req.query.includeExpired === 'true';
    
    const result = await customerProductsService.getCustomerProducts(accountName, includeExpired);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

