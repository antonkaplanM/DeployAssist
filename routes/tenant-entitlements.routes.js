/**
 * Tenant Entitlements Routes
 * API endpoints for SML-based entitlement data (from sml_tenant_data)
 */

const express = require('express');
const router = express.Router();
const tenantEntitlementsService = require('../services/tenant-entitlements.service');
const { asyncHandler, BadRequestError } = require('../middleware/error-handler');
const logger = require('../utils/logger');

/**
 * Typeahead suggestions from sml_tenant_data.
 * GET /api/tenant-entitlements/suggest?search=<term>&limit=10
 * Searches tenant_name, account_name, and tenant_display_name.
 */
router.get('/suggest', asyncHandler(async (req, res) => {
    logger.debug('Tenant suggest API called', req.query);

    const searchTerm = req.query.search || req.query.q || '';
    const limit = Math.min(parseInt(req.query.limit) || 10, 25);

    const result = await tenantEntitlementsService.suggestTenants(searchTerm, limit);

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get entitlements from sml_tenant_data.
 * GET /api/tenant-entitlements?tenant=<name>          (preferred — direct SML match)
 * GET /api/tenant-entitlements?account=<name>         (legacy — mapped account name)
 * Optional: &includeExpired=true
 */
router.get('/', asyncHandler(async (req, res) => {
    logger.debug('Tenant entitlements API called', req.query);

    const tenantName = req.query.tenant;
    const accountName = req.query.account;
    const includeExpired = req.query.includeExpired === 'true';

    if (!tenantName && !accountName) {
        throw new BadRequestError('Either "tenant" or "account" query parameter is required');
    }

    const result = tenantName
        ? await tenantEntitlementsService.getEntitlementsByTenant(tenantName, includeExpired)
        : await tenantEntitlementsService.getEntitlementsByAccount(accountName, includeExpired);

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
