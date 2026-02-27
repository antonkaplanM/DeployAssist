/**
 * Expiration Monitor Routes
 * API endpoints for product expiration monitoring
 */

const express = require('express');
const router = express.Router();
const expirationService = require('../services/expiration.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get expiration monitor data
 * GET /api/expiration/monitor
 * Query params:
 *   - expirationWindow: Days to look ahead (default: 30)
 *   - showExtended: Include extended licenses (default: false)
 */
router.get('/monitor', asyncHandler(async (req, res) => {
    logger.debug('Expiration monitor API called', req.query);
    
    const expirationWindow = parseInt(req.query.expirationWindow) || 30;
    const showExtended = req.query.showExtended === 'true' || req.query.showExtended === true;
    
    const result = await expirationService.getExpirationMonitor(expirationWindow, showExtended);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Refresh expiration analysis (background job)
 * POST /api/expiration/refresh
 * Body:
 *   - lookbackYears: Years to look back (default: 5)
 *   - expirationWindow: Days to look ahead (default: 30)
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    logger.info('Expiration analysis refresh requested');
    
    const lookbackYears = parseInt(req.body.lookbackYears) || 5;
    const expirationWindow = parseInt(req.body.expirationWindow) || 30;
    
    const result = await expirationService.refreshExpirationAnalysis(lookbackYears, expirationWindow);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get expiration analysis status
 * GET /api/expiration/status
 */
router.get('/status', asyncHandler(async (req, res) => {
    const result = await expirationService.getExpirationStatus();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Query expired products with filtering
 * GET /api/expiration/expired-products
 * Query params:
 *   - category: Product type filter
 *   - accountName: Account name filter
 *   - productName: Product name filter
 *   - excludeProduct: Exclude products containing this string
 *   - region: Region filter
 *   - includeGhostAccountsOnly: Only show ghost accounts (default: false)
 *   - limit: Max results (default: 100)
 *   - groupByAccount: Group by account (default: true)
 */
router.get('/expired-products', asyncHandler(async (req, res) => {
    logger.info('Querying expired products', req.query);
    
    const result = await expirationService.queryExpiredProducts(req.query);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

