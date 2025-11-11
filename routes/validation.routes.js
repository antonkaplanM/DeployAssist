/**
 * Validation Routes
 * API endpoints for PS request validation
 */

const express = require('express');
const router = express.Router();
const validationService = require('../services/validation.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get validation errors for dashboard monitoring
 * GET /api/validation/errors
 * Query params:
 *   - timeFrame: 1d, 1w, 1m, 1y (default: 1w)
 *   - enabledRules: Optional JSON array or comma-separated list of rule IDs
 */
router.get('/errors', asyncHandler(async (req, res) => {
    logger.info('Fetching validation errors for dashboard monitoring', req.query);
    
    const { timeFrame = '1w' } = req.query;
    
    // Parse enabled rules if provided
    let enabledRuleIds = null;
    const clientEnabledRules = req.body?.enabledRules || req.query.enabledRules;
    
    if (clientEnabledRules) {
        try {
            enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                JSON.parse(clientEnabledRules) : clientEnabledRules;
        } catch (error) {
            logger.warn('Error parsing client enabled rules, using defaults:', error);
        }
    }
    
    const result = await validationService.getValidationErrors(timeFrame, enabledRuleIds);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        errors: result.errors,
        summary: result.summary,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

