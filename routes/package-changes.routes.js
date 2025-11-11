/**
 * Package Change Analysis Routes
 * API endpoints for package change analytics
 */

const express = require('express');
const router = express.Router();
const packageChangesService = require('../services/package-changes.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get package change summary statistics
 * GET /api/analytics/package-changes/summary
 * Query params:
 *   - timeFrame: Time frame for analysis (default: '1y')
 */
router.get('/summary', asyncHandler(async (req, res) => {
    logger.info('Package change summary API called', req.query);
    
    const timeFrame = req.query.timeFrame || '1y';
    
    const result = await packageChangesService.getPackageChangeSummary(timeFrame);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get package changes grouped by product
 * GET /api/analytics/package-changes/by-product
 * Query params:
 *   - timeFrame: Time frame for analysis (default: '1y')
 */
router.get('/by-product', asyncHandler(async (req, res) => {
    logger.info('Package changes by product API called', req.query);
    
    const timeFrame = req.query.timeFrame || '1y';
    
    const result = await packageChangesService.getPackageChangesByProduct(timeFrame);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get package changes grouped by account
 * GET /api/analytics/package-changes/by-account
 * Query params:
 *   - timeFrame: Time frame for analysis (default: '1y')
 *   - limit: Max results (optional)
 */
router.get('/by-account', asyncHandler(async (req, res) => {
    logger.info('Package changes by account API called', req.query);
    
    const timeFrame = req.query.timeFrame || '1y';
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    
    const result = await packageChangesService.getPackageChangesByAccount(timeFrame, limit);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get recent package changes
 * GET /api/analytics/package-changes/recent
 * Query params:
 *   - limit: Max results (default: 20)
 */
router.get('/recent', asyncHandler(async (req, res) => {
    logger.info('Recent package changes API called', req.query);
    
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await packageChangesService.getRecentPackageChanges(limit);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Trigger package change analysis refresh
 * POST /api/analytics/package-changes/refresh
 * Body:
 *   - lookbackYears: Years to look back (default: 2)
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    logger.info('Package change analysis refresh requested');
    
    const lookbackYears = parseInt(req.body.lookbackYears) || 2;
    
    const result = await packageChangesService.refreshPackageChangeAnalysis(lookbackYears);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get package change analysis status
 * GET /api/analytics/package-changes/status
 */
router.get('/status', asyncHandler(async (req, res) => {
    const result = await packageChangesService.getPackageChangeAnalysisStatus();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Export package changes to Excel
 * GET /api/analytics/package-changes/export
 * Query params:
 *   - timeFrame: Time frame for analysis (default: '1y')
 */
router.get('/export', asyncHandler(async (req, res) => {
    logger.info('Package changes Excel export requested', req.query);
    
    const timeFrame = req.query.timeFrame || '1y';
    
    const { workbook, filename } = await packageChangesService.exportPackageChangesToExcel(timeFrame);
    
    // Set headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
}));

module.exports = router;

