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
 * Aggregate summary of all tenants in sml_tenant_data.
 * GET /api/tenant-entitlements/summary
 * Returns tenant list with counts and metadata — no specific tenant/account required.
 */
router.get('/summary', asyncHandler(async (req, res) => {
    logger.debug('Tenant summary API called');

    const result = await tenantEntitlementsService.getTenantsSummary();

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Per-tenant entitlement status analysis.
 * GET /api/tenant-entitlements/analysis
 * Optional: ?status=allExpired|hasExpiring|fullyActive
 * Returns every tenant with active/expiring/expired counts.
 */
router.get('/analysis', asyncHandler(async (req, res) => {
    logger.debug('Tenant entitlements analysis API called', req.query);

    const filters = {};
    if (req.query.status) {
        const allowed = ['allExpired', 'hasExpiring', 'fullyActive'];
        if (allowed.includes(req.query.status)) {
            filters.status = req.query.status;
        }
    }

    const result = await tenantEntitlementsService.getTenantsEntitlementAnalysis(filters);

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Product-level aggregation across tenants.
 * GET /api/tenant-entitlements/product-breakdown
 * Optional: ?tenantStatus=allExpired|hasExpiring|fullyActive
 * Optional: ?productStatus=Active|Expiring Soon|Expired
 * Returns products with counts, sorted by count descending.
 */
router.get('/product-breakdown', asyncHandler(async (req, res) => {
    logger.debug('Tenant product breakdown API called', req.query);

    const filters = {};
    if (req.query.tenantStatus) {
        const allowed = ['allExpired', 'hasExpiring', 'fullyActive'];
        if (allowed.includes(req.query.tenantStatus)) {
            filters.tenantStatus = req.query.tenantStatus;
        }
    }
    if (req.query.productStatus) {
        const allowed = ['Active', 'Expiring Soon', 'Expired'];
        if (allowed.includes(req.query.productStatus)) {
            filters.productStatus = req.query.productStatus;
        }
    }

    const result = await tenantEntitlementsService.getProductBreakdown(filters);

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
 * Optional: &includeExpired=false  (defaults to true — all entitlements returned)
 */
router.get('/', asyncHandler(async (req, res) => {
    logger.debug('Tenant entitlements API called', req.query);

    const tenantName = req.query.tenant;
    const accountName = req.query.account;
    const includeExpired = req.query.includeExpired !== 'false';

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
