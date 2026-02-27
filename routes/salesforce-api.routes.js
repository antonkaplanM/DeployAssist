/**
 * Salesforce API Routes
 * API endpoints for Salesforce OAuth, Analytics, and Provisioning
 */

const express = require('express');
const router = express.Router();
const salesforceApiService = require('../services/salesforce-api.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

// ===== SALESFORCE OAUTH ENDPOINTS =====

/**
 * Initiate Salesforce OAuth flow
 * GET /auth/salesforce
 */
router.get('/auth/salesforce', (req, res) => {
    const authUrl = salesforceApiService.getAuthUrl();
    res.redirect(authUrl);
});

/**
 * Salesforce OAuth callback
 * GET /auth/salesforce/callback
 * Query params:
 *   - code: Authorization code
 *   - error: OAuth error (if any)
 */
router.get('/auth/salesforce/callback', asyncHandler(async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        logger.error('Salesforce OAuth error', error);
        return res.status(400).json({ error: `OAuth error: ${error}` });
    }
    
    const result = await salesforceApiService.handleOAuthCallback(code);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

// ===== ANALYTICS ENDPOINTS =====

/**
 * Get validation failure trend
 * GET /api/analytics/validation-trend
 * Query params:
 *   - months: Number of months to look back (default: 3)
 *   - enabledRules: JSON array of enabled rule IDs (optional)
 */
router.get('/api/analytics/validation-trend', asyncHandler(async (req, res) => {
    const months = parseInt(req.query.months) || 3;
    
    // Parse enabled rules from query params
    let enabledRuleIds = null;
    const clientEnabledRules = req.query.enabledRules;
    
    if (clientEnabledRules) {
        try {
            enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                JSON.parse(clientEnabledRules) : clientEnabledRules;
        } catch (error) {
            logger.warn('Error parsing enabled rules for trend, using defaults', error);
        }
    }
    
    const result = await salesforceApiService.getValidationTrend(months, enabledRuleIds);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get weekly request type analytics
 * GET /api/analytics/request-types-week
 * Query params:
 *   - months: Number of months to look back (default: 12)
 *   - enabledRules: JSON array of enabled rule IDs (optional)
 */
router.get('/api/analytics/request-types-week', asyncHandler(async (req, res) => {
    const months = parseInt(req.query.months) || 12;
    
    // Parse enabled rules from query params
    let enabledRuleIds = null;
    const clientEnabledRules = req.query.enabledRules;
    
    if (clientEnabledRules) {
        try {
            enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                JSON.parse(clientEnabledRules) : clientEnabledRules;
            logger.info(`Analytics using ${enabledRuleIds.length} client-specified enabled validation rules`);
        } catch (error) {
            logger.warn('Error parsing client enabled rules for analytics, using defaults', error);
        }
    }
    
    const result = await salesforceApiService.getRequestTypesAnalytics(months, enabledRuleIds);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get weekly provisioning completion times
 * GET /api/analytics/completion-times
 */
router.get('/api/analytics/completion-times', asyncHandler(async (req, res) => {
    const result = await salesforceApiService.getCompletionTimes();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

// Note: POST /api/analytics/publish-to-confluence endpoint is complex and requires
// additional helper functions (generateConfluenceHTML, updateConfluencePage).
// Consider extracting to a separate Confluence service in Phase 2.

// ===== PROVISIONING ENDPOINTS =====

/**
 * Get provisioning requests (list with pagination)
 * GET /api/provisioning/requests
 * Query params:
 *   - limit: Max results (default: 100)
 *   - offset: Pagination offset (default: 0)
 */
router.get('/api/provisioning/requests', asyncHandler(async (req, res) => {
    logger.debug('Provisioning requests API called', req.query);
    
    const pageSize = parseInt(req.query.pageSize) || parseInt(req.query.limit) || 25;
    const offset = parseInt(req.query.offset) || 0;
    
    // Extract additional filters
    const additionalFilters = {
        requestType: req.query.requestType,
        accountId: req.query.accountId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search
    };
    
    const result = await salesforceApiService.getProvisioningRequests(pageSize, offset, additionalFilters);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Search provisioning requests
 * GET /api/provisioning/search
 * Query params:
 *   - searchTerm: Search term (required)
 *   - status: Status filter (optional)
 */
router.get('/api/provisioning/search', asyncHandler(async (req, res) => {
    logger.debug('Provisioning search API called', req.query);
    
    const searchTerm = req.query.q || req.query.search || req.query.searchTerm || '';
    const limit = parseInt(req.query.limit) || 20;
    
    const results = await salesforceApiService.searchProvisioningRequests(searchTerm, limit);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        results,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get a specific provisioning request by ID
 * GET /api/provisioning/requests/:id
 * Path params:
 *   - id: Request ID
 */
router.get('/api/provisioning/requests/:id', asyncHandler(async (req, res) => {
    logger.debug('Provisioning request details API called', req.params);
    
    const { id } = req.params;
    
    const result = await salesforceApiService.getProvisioningRequestById(id);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get provisioning filter options
 * GET /api/provisioning/filter-options
 */
router.get('/api/provisioning/filter-options', asyncHandler(async (req, res) => {
    logger.debug('Provisioning filter options API called');
    
    const result = await salesforceApiService.getProvisioningFilterOptions();
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get new provisioning records since a timestamp
 * GET /api/provisioning/new-records
 * Query params:
 *   - since: ISO timestamp (required)
 */
router.get('/api/provisioning/new-records', asyncHandler(async (req, res) => {
    const sinceTimestamp = req.query.since;
    
    const result = await salesforceApiService.getNewProvisioningRecords(sinceTimestamp);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get PS requests with product removals
 * GET /api/provisioning/removals
 * Query params:
 *   - timeFrame: Time frame (default: '1w')
 */
router.get('/api/provisioning/removals', asyncHandler(async (req, res) => {
    logger.info('REMOVALS ENDPOINT CALLED - Fetching PS requests with removals', req.query);
    
    const timeFrame = req.query.timeFrame || '1w';
    
    const result = await salesforceApiService.getProvisioningRemovals(timeFrame);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

