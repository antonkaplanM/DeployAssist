/**
 * Ghost Accounts Routes
 * API endpoints for ghost account management
 */

const express = require('express');
const router = express.Router();
const salesforce = require('../salesforce');
const db = require('../database');
const { asyncHandler } = require('../middleware/error-handler');
const { success, badRequest, unauthorized, notFound } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get all ghost accounts with filters
 * GET /api/ghost-accounts
 * Query params: isReviewed, accountSearch, expiryBefore, expiryAfter
 */
router.get('/', asyncHandler(async (req, res) => {
    logger.debug('Ghost accounts API called', req.query);
    
    // Check if we have a valid Salesforce connection
    const hasValidAuth = await salesforce.hasValidAuthentication();
    if (!hasValidAuth) {
        logger.warn('No valid Salesforce authentication - returning empty data');
        return res.json({
            success: true,
            ghostAccounts: [],
            summary: {
                totalGhostAccounts: 0,
                unreviewed: 0,
                reviewed: 0
            },
            note: 'No Salesforce authentication - please configure in Settings',
            timestamp: new Date().toISOString()
        });
    }
    
    const filters = {
        isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
        accountSearch: req.query.accountSearch,
        expiryBefore: req.query.expiryBefore,
        expiryAfter: req.query.expiryAfter
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
            delete filters[key];
        }
    });
    
    logger.info('Fetching ghost accounts with filters:', filters);
    
    const result = await db.getGhostAccounts(filters);
    const summaryResult = await db.getGhostAccountsSummary();
    
    if (result.success) {
        // Fetch MA Account IDs for all ghost accounts
        const accountNames = result.ghostAccounts.map(acc => acc.account_name);
        const externalIdsResult = await salesforce.getAccountExternalIds(accountNames);
        
        // Enrich ghost accounts with MA SF Links
        const enrichedGhostAccounts = result.ghostAccounts.map(account => ({
            ...account,
            ma_sf_account_id: externalIdsResult.accountIds[account.account_name] || null,
            ma_sf_link: externalIdsResult.accountIds[account.account_name] 
                ? `https://moodysanalytics.my.salesforce.com/${externalIdsResult.accountIds[account.account_name]}`
                : null
        }));
        
        res.json({
            success: true,
            ghostAccounts: enrichedGhostAccounts,
            summary: summaryResult.success ? summaryResult.summary : {
                totalGhostAccounts: 0,
                unreviewed: 0,
                reviewed: 0
            },
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            ghostAccounts: [],
            summary: {
                totalGhostAccounts: 0,
                unreviewed: 0,
                reviewed: 0
            },
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Refresh ghost accounts analysis
 * POST /api/ghost-accounts/refresh
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    logger.info('Ghost accounts refresh requested');
    
    // Check if we have a valid Salesforce connection
    const hasValidAuth = await salesforce.hasValidAuthentication();
    if (!hasValidAuth) {
        return unauthorized(res, 'No Salesforce authentication available');
    }
    
    const analysisStarted = new Date();
    
    logger.info('Starting ghost accounts identification');
    
    const result = await salesforce.identifyGhostAccounts();
    
    const analysisCompleted = new Date();
    const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
    
    if (result.success) {
        logger.info(`Ghost accounts analysis complete: ${result.ghostCount} ghost accounts found`);
        
        res.json({
            success: true,
            message: 'Ghost accounts analysis completed successfully',
            summary: {
                totalAnalyzed: result.totalAnalyzed,
                ghostAccountsFound: result.ghostCount,
                duration: durationSeconds
            },
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            message: 'Ghost accounts analysis failed',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Mark ghost account as reviewed
 * POST /api/ghost-accounts/:accountId/review
 * Body: { reviewedBy, notes }
 */
router.post('/:accountId/review', asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const { reviewedBy, notes } = req.body;
    
    if (!reviewedBy) {
        return badRequest(res, 'reviewedBy is required');
    }
    
    logger.info(`Marking ghost account as reviewed: ${accountId}`);
    
    const result = await db.markGhostAccountReviewed(accountId, reviewedBy, notes);
    
    if (result.success) {
        res.json({
            success: true,
            message: 'Ghost account marked as reviewed',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get expired products/entitlements for a specific ghost account
 * GET /api/ghost-accounts/:accountId/products
 * Query params: category, excludeProduct
 */
router.get('/:accountId/products', asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    const { category, excludeProduct } = req.query;
    
    logger.info(`Fetching products for ghost account: ${accountId}`);
    
    // Check if we have a valid Salesforce connection
    const hasValidAuth = await salesforce.hasValidAuthentication();
    if (!hasValidAuth) {
        return unauthorized(res, 'No Salesforce authentication available');
    }
    
    // Get the account from database to get the account name
    const accountResult = await db.getAccount(accountId);
    if (!accountResult.success || !accountResult.account) {
        return notFound(res, 'Account not found');
    }
    
    const accountName = accountResult.account.account_name;
    
    // Fetch and parse entitlements from Salesforce
    const productsResult = await salesforce.getAccountExpiredProducts(
        accountId, 
        accountName,
        { category, excludeProduct }
    );
    
    if (productsResult.success) {
        res.json({
            success: true,
            accountId: accountId,
            accountName: accountName,
            products: productsResult.products,
            summary: productsResult.summary,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: productsResult.error,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Remove ghost account from tracking
 * DELETE /api/ghost-accounts/:accountId
 */
router.delete('/:accountId', asyncHandler(async (req, res) => {
    const { accountId } = req.params;
    
    logger.info(`Removing ghost account: ${accountId}`);
    
    const result = await db.removeGhostAccount(accountId);
    
    if (result.success) {
        res.json({
            success: true,
            message: 'Ghost account removed from tracking',
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get recently deprovisioned accounts
 * GET /api/ghost-accounts/deprovisioned
 * Query params: daysBack (default: 30)
 */
router.get('/deprovisioned', asyncHandler(async (req, res) => {
    logger.debug('Recently deprovisioned accounts API called', req.query);
    
    // Check if we have a valid Salesforce connection
    const hasValidAuth = await salesforce.hasValidAuthentication();
    if (!hasValidAuth) {
        logger.warn('No valid Salesforce authentication - returning empty data');
        return res.json({
            success: true,
            deprovisionedAccounts: [],
            daysBack: parseInt(req.query.daysBack) || 30,
            count: 0,
            note: 'No Salesforce authentication - please configure in Settings',
            timestamp: new Date().toISOString()
        });
    }
    
    const daysBack = parseInt(req.query.daysBack) || 30;
    
    logger.info(`Fetching accounts deprovisioned in last ${daysBack} days`);
    
    const result = await salesforce.getRecentlyDeprovisionedAccounts(daysBack);
    
    if (result.success) {
        res.json({
            success: true,
            deprovisionedAccounts: result.deprovisionedAccounts,
            totalAnalyzed: result.totalAnalyzed,
            daysBack: result.daysBack,
            count: result.count,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            deprovisionedAccounts: [],
            count: 0,
            timestamp: new Date().toISOString()
        });
    }
}));

module.exports = router;

