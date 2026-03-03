/**
 * Salesforce API Routes
 * API endpoints for Salesforce OAuth (per-user + service-account),
 * per-user settings, Analytics, and Provisioning.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const salesforceApiService = require('../services/salesforce-api.service');
const salesforce = require('../salesforce');
const db = require('../database');
const { asyncHandler } = require('../middleware/error-handler');
const { encrypt, decrypt, mask } = require('../utils/encryption');
const logger = require('../utils/logger');

const sfTestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many test requests – please wait a minute.' },
    standardHeaders: true,
    legacyHeaders: false
});

function createSalesforceApiRoutes(authenticate, loadPermissions) {
    const router = express.Router();
    const { withSalesforceConnection } = require('../middleware/auth.middleware');
    const sfConn = withSalesforceConnection(db.pool);

    // ===== SALESFORCE PER-USER OAUTH ENDPOINTS =====

    /**
     * Initiate Salesforce OAuth flow (requires app login).
     * GET /auth/salesforce
     */
    router.get('/auth/salesforce', authenticate, (req, res) => {
        const authUrl = salesforce.getAuthUrl(req.user.id);
        res.redirect(authUrl);
    });

    /**
     * Salesforce OAuth callback.
     * GET /auth/salesforce/callback
     * Stores tokens per-user when state contains a userId, otherwise falls back
     * to legacy service-account storage.
     */
    router.get('/auth/salesforce/callback', authenticate, asyncHandler(async (req, res) => {
        const { code, error, state } = req.query;

        if (error) {
            logger.error('Salesforce OAuth error', error);
            return res.redirect('/settings?sf_error=' + encodeURIComponent(error));
        }

        const stateUserId = salesforce.decodeOAuthState(state);
        const userId = stateUserId || req.user?.id;

        if (userId && stateUserId) {
            const result = await salesforce.handlePerUserOAuthCallback(code, userId, db, encrypt);

            if (!result.success) {
                return res.redirect('/settings?sf_error=' + encodeURIComponent(result.error));
            }

            return res.redirect('/settings?sf_connected=1');
        }

        // Legacy fallback: service-account OAuth
        const result = await salesforceApiService.handleOAuthCallback(code);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    // ===== PER-USER SALESFORCE SETTINGS ENDPOINTS =====

    /**
     * GET /api/user-settings/salesforce
     * Returns the current user's Salesforce connection status.
     */
    router.get('/api/user-settings/salesforce', authenticate, loadPermissions, asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT setting_key, setting_value, is_encrypted
             FROM user_settings
             WHERE user_id = $1 AND setting_key IN ('sf_user_id', 'sf_connected_at', 'sf_preference', 'sf_access_token')`,
            [userId]
        );

        const settings = {};
        for (const row of result.rows) {
            settings[row.setting_key] = row.setting_value;
        }

        const connected = !!settings.sf_access_token;
        const permissions = req.user.permissions || [];
        const serviceAccountPermitted = permissions.some(
            p => p.name === 'salesforce.service_account' || p.name === 'salesforce.manage'
        );

        res.json({
            success: true,
            connected,
            sfUsername: settings.sf_user_id || null,
            connectedAt: settings.sf_connected_at || null,
            preference: settings.sf_preference || 'personal',
            serviceAccountPermitted
        });
    }));

    /**
     * PUT /api/user-settings/salesforce/preference
     * Set whether the user prefers personal credentials or the service account.
     * Body: { preference: 'personal' | 'service_account' }
     */
    router.put('/api/user-settings/salesforce/preference', authenticate, loadPermissions, asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { preference } = req.body;

        if (!['personal', 'service_account'].includes(preference)) {
            return res.status(400).json({ success: false, message: 'Invalid preference. Must be "personal" or "service_account".' });
        }

        if (preference === 'service_account') {
            const permissions = req.user.permissions || [];
            const allowed = permissions.some(
                p => p.name === 'salesforce.service_account' || p.name === 'salesforce.manage'
            );
            if (!allowed) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to use the Salesforce service account.',
                    code: 'SF_SERVICE_ACCOUNT_FORBIDDEN'
                });
            }
        }

        await db.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value, is_encrypted, updated_at)
             VALUES ($1, 'sf_preference', $2, FALSE, NOW())
             ON CONFLICT (user_id, setting_key)
             DO UPDATE SET setting_value = $2, updated_at = NOW()`,
            [userId, preference]
        );

        res.json({ success: true, message: `Salesforce preference set to "${preference}".` });
    }));

    /**
     * DELETE /api/user-settings/salesforce
     * Disconnect personal Salesforce credentials.
     */
    router.delete('/api/user-settings/salesforce', authenticate, asyncHandler(async (req, res) => {
        const userId = req.user.id;

        await db.query(
            `DELETE FROM user_settings
             WHERE user_id = $1 AND setting_key IN ('sf_access_token', 'sf_refresh_token', 'sf_instance_url', 'sf_user_id', 'sf_connected_at')`,
            [userId]
        );

        // Reset preference to personal
        await db.query(
            `UPDATE user_settings SET setting_value = 'personal', updated_at = NOW()
             WHERE user_id = $1 AND setting_key = 'sf_preference'`,
            [userId]
        );

        logger.info('User disconnected personal Salesforce credentials', { userId });
        res.json({ success: true, message: 'Salesforce credentials removed.' });
    }));

    /**
     * POST /api/user-settings/salesforce/test
     * Test the user's active Salesforce connection (whichever is currently preferred).
     */
    router.post('/api/user-settings/salesforce/test', authenticate, loadPermissions, sfTestLimiter, asyncHandler(async (req, res) => {
        const userId = req.user.id;

        try {
            const conn = await salesforce.getConnectionForRequest(
                userId,
                req.user.permissions || [],
                db,
                decrypt,
                encrypt
            );

            const identity = await conn.identity();
            res.json({
                success: true,
                message: 'Salesforce connection is working.',
                details: {
                    username: identity.username,
                    orgId: identity.organization_id,
                    displayName: identity.display_name
                }
            });
        } catch (err) {
            res.json({
                success: false,
                message: err.message,
                code: err.code || 'SF_TEST_FAILED'
            });
        }
    }));

    // ===== ANALYTICS ENDPOINTS =====

    /**
     * Get validation failure trend
     * GET /api/analytics/validation-trend
     */
    router.get('/api/analytics/validation-trend', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        const months = parseInt(req.query.months) || 3;

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
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Get weekly request type analytics
     * GET /api/analytics/request-types-week
     */
    router.get('/api/analytics/request-types-week', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        const months = parseInt(req.query.months) || 12;

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
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Get weekly provisioning completion times
     * GET /api/analytics/completion-times
     */
    router.get('/api/analytics/completion-times', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        const result = await salesforceApiService.getCompletionTimes();
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    // ===== PROVISIONING ENDPOINTS =====

    /**
     * Get provisioning requests (list with pagination)
     * GET /api/provisioning/requests
     */
    router.get('/api/provisioning/requests', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        logger.debug('Provisioning requests API called', req.query);

        const pageSize = parseInt(req.query.pageSize) || parseInt(req.query.limit) || 25;
        const offset = parseInt(req.query.offset) || 0;

        const additionalFilters = {
            requestType: req.query.requestType,
            accountId: req.query.accountId,
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            search: req.query.search
        };

        const result = await salesforceApiService.getProvisioningRequests(pageSize, offset, additionalFilters);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Search provisioning requests
     * GET /api/provisioning/search
     */
    router.get('/api/provisioning/search', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        logger.debug('Provisioning search API called', req.query);

        const searchTerm = req.query.q || req.query.search || req.query.searchTerm || '';
        const limit = parseInt(req.query.limit) || 20;

        const results = await salesforceApiService.searchProvisioningRequests(searchTerm, limit);
        res.json({ success: true, results, timestamp: new Date().toISOString() });
    }));

    /**
     * Get a specific provisioning request by ID
     * GET /api/provisioning/requests/:id
     */
    router.get('/api/provisioning/requests/:id', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        logger.debug('Provisioning request details API called', req.params);
        const { id } = req.params;
        const result = await salesforceApiService.getProvisioningRequestById(id);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Get provisioning filter options
     * GET /api/provisioning/filter-options
     */
    router.get('/api/provisioning/filter-options', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        logger.debug('Provisioning filter options API called');
        const result = await salesforceApiService.getProvisioningFilterOptions();
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Get new provisioning records since a timestamp
     * GET /api/provisioning/new-records
     */
    router.get('/api/provisioning/new-records', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        const sinceTimestamp = req.query.since;
        const result = await salesforceApiService.getNewProvisioningRecords(sinceTimestamp);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    /**
     * Get PS requests with product removals
     * GET /api/provisioning/removals
     */
    router.get('/api/provisioning/removals', authenticate, loadPermissions, sfConn, asyncHandler(async (req, res) => {
        logger.info('REMOVALS ENDPOINT CALLED - Fetching PS requests with removals', req.query);
        const timeFrame = req.query.timeFrame || '1w';
        const result = await salesforceApiService.getProvisioningRemovals(timeFrame);
        res.json({ success: true, ...result, timestamp: new Date().toISOString() });
    }));

    return router;
}

module.exports = createSalesforceApiRoutes;
