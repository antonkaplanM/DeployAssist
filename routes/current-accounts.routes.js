/**
 * Current Accounts Routes
 * API endpoints for the Current Accounts analytics page
 */

const express = require('express');
const router = express.Router();
const currentAccountsService = require('../services/current-accounts.service');
const SMLGhostAccountsService = require('../services/sml-ghost-accounts.service');

// SML service instance for token status checks
const smlGhostService = new SMLGhostAccountsService();

/**
 * GET /api/current-accounts/sml-status
 * Check SML token status before syncing
 */
router.get('/sml-status', async (req, res) => {
    try {
        console.log('📡 GET /api/current-accounts/sml-status');

        const tokenInfo = smlGhostService.checkTokenStatus();
        const authValidation = await smlGhostService.validateAuthentication();

        res.json({
            success: true,
            sml: {
                configured: tokenInfo.hasToken,
                tokenValid: !tokenInfo.expired && tokenInfo.hasToken,
                tokenExpired: tokenInfo.expired,
                expiresAt: tokenInfo.expiresAt,
                remainingMinutes: tokenInfo.remainingMinutes,
                message: authValidation.valid 
                    ? `Token valid for ${tokenInfo.remainingMinutes} minutes` 
                    : authValidation.error
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in GET /api/current-accounts/sml-status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/current-accounts
 * Get all current accounts with pagination and sorting
 */
router.get('/', async (req, res) => {
    try {
        console.log('📡 GET /api/current-accounts');

        const {
            page = 1,
            pageSize = 50,
            sortBy = 'completion_date',
            sortOrder = 'DESC',
            includeRemoved = 'false',
            search = ''
        } = req.query;

        const result = await currentAccountsService.getAccounts({
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            sortBy,
            sortOrder,
            includeRemoved: includeRemoved === 'true',
            search: search || null
        });

        res.json(result);
    } catch (error) {
        console.error('❌ Error in GET /api/current-accounts:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/current-accounts/sync-status
 * Get sync status and statistics
 */
router.get('/sync-status', async (req, res) => {
    try {
        console.log('📡 GET /api/current-accounts/sync-status');

        const result = await currentAccountsService.getSyncStatus();
        res.json(result);
    } catch (error) {
        console.error('❌ Error in GET /api/current-accounts/sync-status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/current-accounts/sync
 * Trigger a manual sync of current accounts data
 */
router.post('/sync', async (req, res) => {
    try {
        console.log('📡 POST /api/current-accounts/sync');

        // Get user info from request (if authenticated)
        const initiatedBy = req.user?.email || req.user?.username || 'manual';

        // Start sync (this may take a while)
        const result = await currentAccountsService.syncAccounts(initiatedBy);

        // Handle token expiration with 401 status
        if (!result.success && result.tokenExpired) {
            console.error('❌ SML token expired - returning 401');
            return res.status(401).json({
                ...result,
                errorCode: 'SML_TOKEN_EXPIRED',
                resolution: 'Please refresh your SML token in Settings → SML Configuration',
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in POST /api/current-accounts/sync:', error);
        
        // Check if error message indicates token expiration
        const isTokenError = error.message?.includes('401') || 
                            error.message?.includes('expired') ||
                            error.message?.includes('authentication');
        
        res.status(isTokenError ? 401 : 500).json({
            success: false,
            error: error.message,
            errorCode: isTokenError ? 'SML_TOKEN_EXPIRED' : 'SYNC_ERROR',
            resolution: isTokenError ? 'Please refresh your SML token in Settings → SML Configuration' : null,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * PATCH /api/current-accounts/:id/comments
 * Update comments for a specific account row
 */
router.patch('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { comments } = req.body;

        console.log(`📡 PATCH /api/current-accounts/${id}/comments`);

        if (comments === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Comments field is required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await currentAccountsService.updateComments(
            parseInt(id),
            comments
        );

        if (!result.success) {
            return res.status(404).json({
                ...result,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`❌ Error in PATCH /api/current-accounts/${req.params.id}/comments:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/current-accounts/export
 * Export current accounts data as CSV
 */
router.get('/export', async (req, res) => {
    try {
        console.log('📡 GET /api/current-accounts/export');

        const { includeRemoved = 'false' } = req.query;

        // Get all records (no pagination)
        const result = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000, // Large limit for export
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: includeRemoved === 'true'
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Build CSV
        const headers = [
            'Client',
            'Services',
            'Type',
            'CSM/Owner',
            'Provisioning Status',
            'Completion Date',
            'Size',
            'Region',
            'Tenant Name',
            'Tenant URL',
            'Tenant ID',
            'Salesforce Account ID',
            'Initial Tenant Admin',
            'Comments',
            'Status'
        ];

        const rows = result.accounts.map(account => [
            account.client || '',
            account.services || '',
            account.account_type || '',
            account.csm_owner || '',
            account.provisioning_status || '',
            account.completion_date ? new Date(account.completion_date).toLocaleDateString() : '',
            account.size || '',
            account.region || '',
            account.tenant_name || '',
            account.tenant_url || '',
            account.tenant_id || '',
            account.salesforce_account_id || '',
            account.initial_tenant_admin || '',
            account.comments || '',
            account.record_status || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => 
                row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="current-accounts-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('❌ Error in GET /api/current-accounts/export:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;



