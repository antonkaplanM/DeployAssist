/**
 * Tenant Entitlements Service
 * Serves entitlement data from sml_tenant_data (synced from SML) 
 * instead of PS records from Salesforce.
 */

const db = require('../database');
const logger = require('../utils/logger');
const { BadRequestError, InternalServerError } = require('../middleware/error-handler');

class TenantEntitlementsService {

    /**
     * Get entitlements for an account from sml_tenant_data
     * Returns a flat array of entitlement rows suitable for data-table widgets
     */
    async getEntitlementsByAccount(accountName, includeExpired = false) {
        if (!accountName) {
            throw new BadRequestError('Account name is required');
        }

        const normalizedName = accountName.normalize('NFC');
        logger.info(`Fetching tenant entitlements from sml_tenant_data for: "${normalizedName}"`);

        const result = await db.getSMLTenantEntitlementsByAccount(normalizedName);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to query tenant entitlements');
        }

        if (result.count === 0) {
            logger.warn(`No tenant entitlements found for account "${normalizedName}" — account may not be mapped in sml_tenant_data`);
            return {
                account: accountName,
                entitlements: [],
                summary: { totalEntitlements: 0, activeCount: 0, expiringCount: 0, expiredCount: 0, tenantCount: 0 },
                source: 'sml_tenant_data'
            };
        }

        const entitlements = [];
        const now = new Date();

        for (const tenant of result.tenants) {
            const pe = tenant.product_entitlements;
            if (!pe) continue;

            this._flattenCategory(entitlements, tenant, pe.appEntitlements, 'apps', now);
            this._flattenCategory(entitlements, tenant, pe.modelEntitlements, 'models', now);
            this._flattenCategory(entitlements, tenant, pe.dataEntitlements, 'data', now);
        }

        const filtered = includeExpired
            ? entitlements
            : entitlements.filter(e => e.status !== 'Expired');

        const activeCount = filtered.filter(e => e.status === 'Active').length;
        const expiringCount = filtered.filter(e => e.status === 'Expiring Soon').length;
        const expiredCount = entitlements.filter(e => e.status === 'Expired').length;

        return {
            account: accountName,
            entitlements: filtered,
            summary: {
                totalEntitlements: filtered.length,
                activeCount,
                expiringCount,
                expiredCount,
                tenantCount: result.count
            },
            source: 'sml_tenant_data'
        };
    }

    /**
     * Get entitlements by tenant name (direct match — more reliable than account name).
     * Tenant names come directly from SML and are always present in sml_tenant_data.
     */
    async getEntitlementsByTenant(tenantName, includeExpired = false) {
        if (!tenantName) {
            throw new BadRequestError('Tenant name is required');
        }

        logger.info(`Fetching tenant entitlements by tenant name: "${tenantName}"`);

        const result = await db.getSMLTenantEntitlementsByTenantName(tenantName);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to query tenant entitlements');
        }

        if (result.count === 0) {
            logger.warn(`No tenant entitlements found for tenant "${tenantName}"`);
            return {
                tenant: tenantName,
                entitlements: [],
                summary: { totalEntitlements: 0, activeCount: 0, expiringCount: 0, expiredCount: 0, tenantCount: 0 },
                source: 'sml_tenant_data'
            };
        }

        const entitlements = [];
        const now = new Date();

        for (const tenant of result.tenants) {
            const pe = tenant.product_entitlements;
            if (!pe) continue;

            this._flattenCategory(entitlements, tenant, pe.appEntitlements, 'apps', now);
            this._flattenCategory(entitlements, tenant, pe.modelEntitlements, 'models', now);
            this._flattenCategory(entitlements, tenant, pe.dataEntitlements, 'data', now);
        }

        const filtered = includeExpired
            ? entitlements
            : entitlements.filter(e => e.status !== 'Expired');

        const activeCount = filtered.filter(e => e.status === 'Active').length;
        const expiringCount = filtered.filter(e => e.status === 'Expiring Soon').length;
        const expiredCount = entitlements.filter(e => e.status === 'Expired').length;

        return {
            tenant: tenantName,
            account: result.tenants[0]?.account_name || null,
            entitlements: filtered,
            summary: {
                totalEntitlements: filtered.length,
                activeCount,
                expiringCount,
                expiredCount,
                tenantCount: result.count
            },
            source: 'sml_tenant_data'
        };
    }

    /**
     * Search sml_tenant_data for typeahead suggestions.
     * Searches across tenant_name, account_name, and tenant_display_name.
     */
    async suggestTenants(searchTerm, limit = 10) {
        if (!searchTerm || searchTerm.length < 2) {
            return { tenants: [], count: 0 };
        }

        const result = await db.searchSMLTenantsForSuggest(searchTerm, limit);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to search tenants');
        }

        return {
            tenants: result.tenants.map(t => ({
                tenant_name: t.tenant_name,
                account_name: t.account_name || null,
                tenant_display_name: t.tenant_display_name || null,
                tenant_id: t.tenant_id
            })),
            count: result.count
        };
    }

    /**
     * Flatten one category (apps/models/data) of entitlements into the output array
     */
    _flattenCategory(output, tenant, items, category, now) {
        if (!Array.isArray(items)) return;

        for (const item of items) {
            const { status, daysRemaining } = this._calculateStatus(item.startDate, item.endDate, now);

            output.push({
                tenantName: tenant.tenant_name,
                tenantId: tenant.tenant_id,
                category,
                productCode: item.productCode || item.code || '',
                productName: item.productName || item.name || '',
                packageName: item.packageName || '',
                productModifier: item.productModifier || '',
                quantity: item.quantity ?? null,
                startDate: item.startDate || null,
                endDate: item.endDate || null,
                status,
                daysRemaining
            });

            if (Array.isArray(item.expansionPacks)) {
                for (const exp of item.expansionPacks) {
                    const expStatus = this._calculateStatus(exp.startDate, exp.endDate, now);
                    output.push({
                        tenantName: tenant.tenant_name,
                        tenantId: tenant.tenant_id,
                        category,
                        productCode: exp.productCode || exp.code || '',
                        productName: exp.productName || exp.name || '',
                        packageName: exp.packageName || item.packageName || '',
                        productModifier: exp.productModifier || '',
                        quantity: exp.quantity ?? null,
                        startDate: exp.startDate || null,
                        endDate: exp.endDate || null,
                        status: expStatus.status,
                        daysRemaining: expStatus.daysRemaining
                    });
                }
            }
        }
    }

    /**
     * Calculate product status based on start/end dates
     */
    _calculateStatus(startDate, endDate, now) {
        if (!endDate) {
            return { status: 'Active', daysRemaining: null };
        }

        const end = new Date(endDate);
        const diffMs = end - now;
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
            return { status: 'Expired', daysRemaining };
        }
        if (daysRemaining <= 30) {
            return { status: 'Expiring Soon', daysRemaining };
        }
        return { status: 'Active', daysRemaining };
    }
}

module.exports = new TenantEntitlementsService();
