/**
 * Report Data Catalog
 * 
 * Defines the allowlisted API endpoints that custom reports can query.
 * Only GET endpoints are permitted. The AI agent receives this catalog
 * as context and can only reference endpoints listed here.
 */

const dataCatalog = [
    // ===== Analytics =====
    {
        id: 'analytics.request-types-week',
        endpoint: '/api/analytics/request-types-week',
        category: 'Analytics',
        description: 'Breakdown of Technical Team Request types (New License, Product Update, Deprovision) with counts and validation failure rates',
        params: [
            { name: 'months', type: 'number', description: 'Number of months to look back (default: 6, max: 24)', default: 6 }
        ],
        responseShape: {
            summary: 'Array of records per request type with counts and failure rates. Response array is under the "data" key.',
            fields: ['requestType', 'count', 'validationFailures', 'validationFailureRate', 'percentage']
        }
    },
    {
        id: 'analytics.validation-trend',
        endpoint: '/api/analytics/validation-trend',
        category: 'Analytics',
        description: 'Validation failure trends over time broken down by request type (update, new, deprovision)',
        params: [
            { name: 'days', type: 'number', description: 'Number of days to look back (default: 30, max: 90)', default: 30 }
        ],
        responseShape: {
            summary: 'Time series of validation failure percentages by date and request type. Response array is under the "trendData" key.',
            fields: ['date', 'displayDate', 'updateTotal', 'updateFailures', 'updateFailurePercentage', 'newTotal', 'newFailures', 'newFailurePercentage', 'deprovisionTotal', 'deprovisionFailures', 'deprovisionFailurePercentage', 'total', 'failures', 'failurePercentage']
        }
    },
    {
        id: 'analytics.completion-times',
        endpoint: '/api/analytics/completion-times',
        category: 'Analytics',
        description: 'Weekly average completion times for provisioning requests with min/max/median hours',
        params: [
            { name: 'months', type: 'number', description: 'Number of months to look back', default: 6 }
        ],
        responseShape: {
            summary: 'Weekly time series of completion time statistics. Response array is under the "data" key.',
            fields: ['weekStart', 'weekLabel', 'avgHours', 'avgDays', 'completedCount', 'minHours', 'maxHours', 'medianHours', 'psRecords']
        }
    },

    // ===== Package Changes =====
    {
        id: 'package-changes.summary',
        endpoint: '/api/analytics/package-changes/summary',
        category: 'Package Changes',
        description: 'Summary statistics of package changes including total upgrades, downgrades, and affected accounts. Data is in the "summary" object (not an array).',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default: "1y")', default: '1y' }
        ],
        responseShape: {
            summary: 'Aggregate counts under the "summary" key. Use dot-path "summary.total_changes" for KPI valueField. Top-level also has timeFrame, startDate, endDate.',
            fields: ['summary.total_changes', 'summary.total_upgrades', 'summary.total_downgrades', 'summary.ps_records_with_changes', 'summary.accounts_affected', 'summary.deployments_affected', 'summary.products_changed']
        }
    },
    {
        id: 'package-changes.by-product',
        endpoint: '/api/analytics/package-changes/by-product',
        category: 'Package Changes',
        description: 'Package changes grouped by product showing which products have most upgrade/downgrade activity',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default: "1y")', default: '1y' }
        ],
        responseShape: {
            summary: 'Product-level change counts. Response array is under the "data" key.',
            fields: ['product_code', 'product_name', 'total_changes', 'upgrades', 'downgrades', 'ps_records', 'accounts']
        }
    },
    {
        id: 'package-changes.by-account',
        endpoint: '/api/analytics/package-changes/by-account',
        category: 'Package Changes',
        description: 'Package changes grouped by customer account with nested deployment and product details',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default: "1y")', default: '1y' },
            { name: 'limit', type: 'number', description: 'Max accounts to return', optional: true }
        ],
        responseShape: {
            summary: 'Account-level change counts with nested deployments. Response array is under the "data" key.',
            fields: ['account_name', 'account_id', 'total_changes', 'upgrades', 'downgrades', 'ps_records', 'products_changed']
        }
    },
    {
        id: 'package-changes.recent',
        endpoint: '/api/analytics/package-changes/recent',
        category: 'Package Changes',
        description: 'Most recent package changes (upgrades/downgrades) across all accounts with full details',
        params: [
            { name: 'limit', type: 'number', description: 'Max changes to return (default: 20)', default: 20 }
        ],
        responseShape: {
            summary: 'List of recent package changes. Response array is under the "data" key.',
            fields: ['account_name', 'product_code', 'product_name', 'change_type', 'previous_package', 'new_package', 'ps_created_date', 'ps_record_name', 'deployment_number', 'tenant_name']
        }
    },

    // ===== Provisioning =====
    {
        id: 'provisioning.list',
        endpoint: '/api/provisioning/requests',
        category: 'Provisioning',
        description: 'List all provisioning requests (Technical Team Requests) with pagination. Returns raw Salesforce records.',
        params: [
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 },
            { name: 'page', type: 'number', description: 'Page number', default: 1 }
        ],
        responseShape: {
            summary: 'Paginated list of provisioning requests. Response array is under the "records" key.',
            fields: ['Id', 'Name', 'Account__c', 'Status__c', 'TenantRequestAction__c', 'Tenant_Name__c', 'CreatedDate', 'LastModifiedDate']
        }
    },
    {
        id: 'provisioning.search',
        endpoint: '/api/provisioning/search',
        category: 'Provisioning',
        description: 'Search provisioning requests by account name, request ID, or text. Returns categorized results (technicalRequests, accounts, tenants).',
        params: [
            { name: 'query', type: 'string', description: 'Search query text' }
        ],
        responseShape: {
            summary: 'Search results grouped into categories. Response object "results" contains "technicalRequests" array, "accounts" array, "tenants" array, and "totalCount".',
            fields: ['id', 'name', 'account', 'status', 'requestType'],
            note: 'The "results" object contains "technicalRequests", "accounts", and "tenants" arrays. Use the technicalRequests array for table data.'
        }
    },
    {
        id: 'provisioning.validation-errors',
        endpoint: '/api/validation/errors',
        category: 'Provisioning',
        description: 'Current validation errors in provisioning requests with failed rule details',
        params: [],
        responseShape: {
            summary: 'List of validation errors. Response array is under the "errors" key. Also includes "summary" object.',
            fields: ['recordId', 'recordName', 'account', 'requestType', 'createdDate', 'failedRules']
        }
    },
    {
        id: 'provisioning.removals',
        endpoint: '/api/provisioning/removals',
        category: 'Provisioning',
        description: 'Product removal/deprovision requests showing what was removed from customer accounts',
        params: [
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'limit', type: 'number', description: 'Max removals to return (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'List of removal requests. Response array is under the "requests" key. Each item has currentRequest object and removals object.',
            fields: ['currentRequest.id', 'currentRequest.name', 'currentRequest.account', 'currentRequest.status', 'currentRequest.createdDate', 'removals.hasRemovals', 'removals.removedModels', 'removals.removedData', 'removals.removedApps']
        }
    },

    // ===== Expiration =====
    {
        id: 'expiration.monitor',
        endpoint: '/api/expiration/monitor',
        category: 'Expiration',
        description: 'Products and entitlements expiring within a specified timeframe, grouped by account',
        params: [
            { name: 'expirationWindow', type: 'number', description: 'Days to look ahead (default: 30, max: 90)', default: 30 }
        ],
        responseShape: {
            summary: 'List of accounts with expiring products. Response array is under the "expirations" key. Also includes "summary" object.',
            fields: ['account.id', 'account.name', 'psRecord.id', 'psRecord.name', 'earliestExpiry', 'earliestDaysUntilExpiry', 'status']
        }
    },
    {
        id: 'expiration.status',
        endpoint: '/api/expiration/status',
        category: 'Expiration',
        description: 'Expiration analysis system status and last run details',
        params: [],
        responseShape: {
            summary: 'Analysis status object. When hasAnalysis is true, "analysis" contains run details.',
            fields: ['hasAnalysis', 'analysis.lastRun', 'analysis.lastRunAgo', 'analysis.status', 'analysis.recordsAnalyzed', 'analysis.entitlementsProcessed', 'analysis.expirationsFound', 'analysis.extensionsFound']
        }
    },
    {
        id: 'expiration.expired-products',
        endpoint: '/api/expiration/expired-products',
        category: 'Expiration',
        description: 'Already-expired products grouped by account with product type filtering',
        params: [
            { name: 'category', type: 'string', description: 'Filter by product type: Model, Data, App', optional: true },
            { name: 'excludeProduct', type: 'string', description: 'Exclude products containing this string', optional: true },
            { name: 'limit', type: 'number', description: 'Max results (default: 100)', default: 100 }
        ],
        responseShape: {
            summary: 'Expired products grouped by account. Response array is under "accounts" key (default) or "products" key when groupByAccount=false. Also includes "summary" object.',
            fields: ['account_name', 'ma_sf_account_id', 'is_ghost_account'],
            note: 'Each account has an "expired_products" array with items containing: product_name, product_type, expiration_date. When groupByAccount=false, returns flat array under "products" key with fields: account_name, product_name, product_type, expiration_date.'
        }
    },

    // ===== Customer Products =====
    {
        id: 'customer-products.list',
        endpoint: '/api/customer-products',
        category: 'Customer Products',
        description: 'Active products for a specific customer organized by region and product category (from PS records). Requires an account name.',
        params: [
            { name: 'account', type: 'string', description: 'Account name to look up (required)' }
        ],
        responseShape: {
            summary: 'Products organized under productsByRegion[region].models/data/apps arrays. Not a flat array – complex nested structure.',
            fields: ['account', 'productsByRegion', 'summary', 'lastUpdated', 'psRecordsAnalyzed']
        }
    },

    // ===== Tenant Entitlements =====
    {
        id: 'tenant-entitlements.list',
        endpoint: '/api/tenant-entitlements',
        category: 'Tenant Entitlements',
        description: 'Product entitlements for a specific account from SML tenant data. Returns a flat array of entitlement rows with status and expiry info. Preferred over customer-products.list for entitlement reports.',
        params: [
            { name: 'account', type: 'string', description: 'Account name to look up (required)' },
            { name: 'includeExpired', type: 'boolean', description: 'Include expired entitlements (default: false)', optional: true }
        ],
        responseShape: {
            summary: 'Flat array of entitlement rows. Response array is under the "entitlements" key. Also includes "summary" object with counts.',
            fields: ['tenantName', 'tenantId', 'category', 'productCode', 'productName', 'packageName', 'productModifier', 'quantity', 'startDate', 'endDate', 'status', 'daysRemaining'],
            note: 'Each row is one entitlement product. "category" is apps/models/data. "status" is Active/Expiring Soon/Expired. Summary has totalEntitlements, activeCount, expiringCount, expiredCount, tenantCount.'
        }
    },
    {
        id: 'customer-products.update-requests',
        endpoint: '/api/product-update/requests',
        category: 'Customer Products',
        description: 'Product update requests with status tracking and approval workflow',
        params: [
            { name: 'status', type: 'string', description: 'Filter: pending, approved, rejected, completed, cancelled', optional: true },
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'List of product update requests. Response array is under the "requests" key.',
            fields: ['id', 'requestNumber', 'accountName', 'accountId', 'requestedBy', 'status', 'priority', 'requestType', 'region', 'changes', 'notes', 'createdAt', 'submittedAt', 'completedAt']
        }
    },

    // ===== Ghost Accounts =====
    {
        id: 'ghost-accounts.list',
        endpoint: '/api/ghost-accounts',
        category: 'Ghost Accounts',
        description: 'Customer accounts with expired products that may need cleanup or deprovisioning',
        params: [
            { name: 'isReviewed', type: 'boolean', description: 'Filter by review status', optional: true },
            { name: 'accountSearch', type: 'string', description: 'Search by account name', optional: true }
        ],
        responseShape: {
            summary: 'Ghost accounts with review status. Response array is under the "ghostAccounts" key. Also includes "summary" object.',
            fields: ['id', 'account_id', 'account_name', 'total_expired_products', 'latest_expiry_date', 'last_checked', 'is_reviewed', 'reviewed_at', 'reviewed_by', 'notes', 'ma_sf_account_id', 'ma_sf_link']
        }
    },
    {
        id: 'ghost-accounts.deprovisioned',
        endpoint: '/api/ghost-accounts/deprovisioned',
        category: 'Ghost Accounts',
        description: 'Accounts that have been recently deprovisioned with deprovision details',
        params: [
            { name: 'daysBack', type: 'number', description: 'Days to look back (default: 30)', default: 30 }
        ],
        responseShape: {
            summary: 'Recently deprovisioned accounts. Response array is under the "deprovisionedAccounts" key.',
            fields: ['accountId', 'accountName', 'totalExpiredProducts', 'latestExpiryDate', 'daysSinceDeprovisioning', 'deprovisioningRecord.id', 'deprovisioningRecord.name', 'deprovisioningRecord.createdDate', 'deprovisioningRecord.status']
        }
    },

    // ===== Packages =====
    {
        id: 'packages.list',
        endpoint: '/api/packages',
        category: 'Packages',
        description: 'Software packages from the package repository with resource limits and metadata',
        params: [
            { name: 'type', type: 'string', description: 'Filter by package type', optional: true },
            { name: 'limit', type: 'number', description: 'Max packages (default: 100)', default: 100 }
        ],
        responseShape: {
            summary: 'Package catalog entries. Response array is under the "packages" key.',
            fields: ['id', 'package_name', 'ri_package_name', 'package_type', 'locations', 'description', 'max_users', 'max_jobs_day', 'related_products']
        }
    },
    {
        id: 'packages.stats',
        endpoint: '/api/packages/summary/stats',
        category: 'Packages',
        description: 'Package repository summary statistics',
        params: [],
        responseShape: {
            summary: 'Aggregate package stats under the "summary" key (not an array). Use dot-path "summary.totalPackages" for KPI.',
            fields: ['summary.totalPackages', 'summary.basePackages', 'summary.expansionPackages', 'summary.uniqueLocations', 'summary.lastSyncTime']
        }
    },

    // ===== Audit Trail =====
    {
        id: 'audit-trail.stats',
        endpoint: '/api/audit-trail/stats',
        category: 'Audit Trail',
        description: 'PS audit trail statistics including total records, snapshots, and status changes',
        params: [],
        responseShape: {
            summary: 'Audit trail aggregate metrics under the "stats" key (not an array). Use dot-path "stats.total_ps_records" for KPI.',
            fields: ['stats.total_ps_records', 'stats.total_snapshots', 'stats.total_status_changes', 'stats.earliest_snapshot', 'stats.latest_snapshot']
        }
    },
    {
        id: 'audit-trail.search',
        endpoint: '/api/audit-trail/search',
        category: 'Audit Trail',
        description: 'Search PS audit records by name, account, or status',
        params: [
            { name: 'query', type: 'string', description: 'Search text for PS record name or account' },
            { name: 'status', type: 'string', description: 'Filter by PS record status', optional: true },
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'Matching PS audit records. Response array is under the "results" key.',
            fields: ['ps_record_id', 'ps_record_name', 'account_name', 'status', 'captured_at']
        }
    }
];

/**
 * Get the full data catalog
 */
function getDataCatalog() {
    return dataCatalog;
}

/**
 * Get catalog grouped by category
 */
function getDataCatalogByCategory() {
    const grouped = {};
    for (const source of dataCatalog) {
        if (!grouped[source.category]) {
            grouped[source.category] = [];
        }
        grouped[source.category].push(source);
    }
    return grouped;
}

/**
 * Check if an endpoint is in the allowlist
 */
function isEndpointAllowed(endpoint) {
    return dataCatalog.some(source => source.endpoint === endpoint);
}

/**
 * Get a catalog entry by its ID
 */
function getCatalogEntry(id) {
    return dataCatalog.find(source => source.id === id) || null;
}

/**
 * Get a compact version of the catalog suitable for LLM system prompts
 */
function getCatalogForPrompt() {
    return dataCatalog.map(source => {
        const entry = {
            id: source.id,
            endpoint: source.endpoint,
            description: source.description,
            params: source.params,
            returns: source.responseShape.summary,
            fields: source.responseShape.fields
        };
        if (source.responseShape.note) {
            entry.note = source.responseShape.note;
        }
        return entry;
    });
}

module.exports = {
    getDataCatalog,
    getDataCatalogByCategory,
    isEndpointAllowed,
    getCatalogEntry,
    getCatalogForPrompt
};
