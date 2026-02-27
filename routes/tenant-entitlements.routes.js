/**
 * Tenant Entitlements Routes
 * API endpoints for SML-based entitlement data (from sml_tenant_data)
 */

const express = require('express');
const router = express.Router();
const tenantEntitlementsService = require('../services/tenant-entitlements.service');
const { asyncHandler } = require('../middleware/error-handler');
const logger = require('../utils/logger');

/**
 * Get entitlements for a specific account from sml_tenant_data
 * GET /api/tenant-entitlements?account=<name>&includeExpired=true|false
 */
router.get('/', asyncHandler(async (req, res) => {
    logger.debug('Tenant entitlements API called', req.query);

    const accountName = req.query.account;
    const includeExpired = req.query.includeExpired === 'true';

    const result = await tenantEntitlementsService.getEntitlementsByAccount(accountName, includeExpired);

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
