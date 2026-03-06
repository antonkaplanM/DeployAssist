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
     * Get an aggregate summary of all tenants and their entitlements.
     * Answers questions like "how many tenants are in SML?" without needing a specific name.
     */
    async getTenantsSummary() {
        const result = await db.getSMLTenants({ isDeleted: false });

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to query tenants');
        }

        const tenants = result.tenants;
        const uniqueAccounts = new Set(tenants.map(t => t.account_name).filter(Boolean));

        const tenantList = tenants.map(t => ({
            tenantName: t.tenant_name,
            accountName: t.account_name || null,
            displayName: t.tenant_display_name || null,
            tenantId: t.tenant_id,
            lastSynced: t.last_synced
        }));

        return {
            tenants: tenantList,
            summary: {
                totalTenants: tenants.length,
                uniqueAccounts: uniqueAccounts.size,
                lastSynced: tenants.length > 0
                    ? tenants.reduce((latest, t) => {
                        const d = t.last_synced ? new Date(t.last_synced) : new Date(0);
                        return d > latest ? d : latest;
                    }, new Date(0)).toISOString()
                    : null
            }
        };
    }

    /**
     * Analyze entitlement status across all tenants.
     * Returns per-tenant breakdown of active/expiring/expired counts.
     * Supports filtering to specific statuses (e.g., only tenants where all products expired).
     */
    async getTenantsEntitlementAnalysis(filters = {}) {
        const result = await db.getAllSMLTenantEntitlements();

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to query tenant entitlements');
        }

        const now = new Date();
        const tenantRows = [];
        let tenantsWithAllExpired = 0;
        let tenantsWithSomeExpiring = 0;
        let tenantsFullyActive = 0;

        for (const tenant of result.tenants) {
            const pe = tenant.product_entitlements;
            if (!pe) continue;

            const entitlements = [];
            this._flattenCategory(entitlements, tenant, pe.appEntitlements, 'apps', now);
            this._flattenCategory(entitlements, tenant, pe.modelEntitlements, 'models', now);
            this._flattenCategory(entitlements, tenant, pe.dataEntitlements, 'data', now);

            if (entitlements.length === 0) continue;

            const activeCount = entitlements.filter(e => e.status === 'Active').length;
            const expiringCount = entitlements.filter(e => e.status === 'Expiring Soon').length;
            const expiredCount = entitlements.filter(e => e.status === 'Expired').length;
            const allExpired = expiredCount === entitlements.length;

            if (allExpired) tenantsWithAllExpired++;
            else if (expiringCount > 0) tenantsWithSomeExpiring++;
            else tenantsFullyActive++;

            const row = {
                tenantName: tenant.tenant_name,
                accountName: tenant.account_name || null,
                tenantId: tenant.tenant_id,
                totalEntitlements: entitlements.length,
                activeCount,
                expiringCount,
                expiredCount,
                allExpired,
                lastSynced: tenant.last_synced
            };

            if (filters.status === 'allExpired' && !allExpired) continue;
            if (filters.status === 'hasExpiring' && expiringCount === 0) continue;
            if (filters.status === 'fullyActive' && (expiredCount > 0 || expiringCount > 0)) continue;

            tenantRows.push(row);
        }

        return {
            tenants: tenantRows,
            summary: {
                totalTenantsAnalyzed: result.count,
                tenantsWithAllExpired,
                tenantsWithSomeExpiring,
                tenantsFullyActive,
                tenantsReturned: tenantRows.length
            }
        };
    }

    /**
     * Aggregate entitlements by product across tenants.
     * Returns product-level counts suitable for pie charts and bar charts.
     * Supports filtering by tenant status (e.g., only products from all-expired tenants).
     */
    async getProductBreakdown(filters = {}) {
        const result = await db.getAllSMLTenantEntitlements();

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to query tenant entitlements');
        }

        const now = new Date();
        const productCounts = new Map();
        let tenantsProcessed = 0;

        for (const tenant of result.tenants) {
            const pe = tenant.product_entitlements;
            if (!pe) continue;

            const entitlements = [];
            this._flattenCategory(entitlements, tenant, pe.appEntitlements, 'apps', now);
            this._flattenCategory(entitlements, tenant, pe.modelEntitlements, 'models', now);
            this._flattenCategory(entitlements, tenant, pe.dataEntitlements, 'data', now);

            if (entitlements.length === 0) continue;

            const activeCount = entitlements.filter(e => e.status === 'Active').length;
            const expiringCount = entitlements.filter(e => e.status === 'Expiring Soon').length;
            const expiredCount = entitlements.filter(e => e.status === 'Expired').length;
            const allExpired = expiredCount === entitlements.length;

            if (filters.tenantStatus === 'allExpired' && !allExpired) continue;
            if (filters.tenantStatus === 'hasExpiring' && expiringCount === 0) continue;
            if (filters.tenantStatus === 'fullyActive' && (expiredCount > 0 || expiringCount > 0)) continue;

            tenantsProcessed++;

            const statusFilter = filters.productStatus;
            for (const e of entitlements) {
                if (statusFilter && e.status !== statusFilter) continue;

                const key = e.productCode || e.productName || 'Unknown';
                const existing = productCounts.get(key);
                if (existing) {
                    existing.count++;
                    existing.tenantCount.add(tenant.tenant_name);
                } else {
                    productCounts.set(key, {
                        productCode: e.productCode || '',
                        productName: e.productName || key,
                        category: e.category,
                        count: 1,
                        tenantCount: new Set([tenant.tenant_name])
                    });
                }
            }
        }

        const products = Array.from(productCounts.values())
            .map(p => ({
                productCode: p.productCode,
                productName: p.productName,
                category: p.category,
                count: p.count,
                tenantCount: p.tenantCount.size
            }))
            .sort((a, b) => b.count - a.count);

        return {
            products,
            summary: {
                totalProducts: products.length,
                totalEntitlements: products.reduce((sum, p) => sum + p.count, 0),
                tenantsProcessed
            }
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
