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
        description: 'Weekly breakdown of Technical Team Request types (New License, Product Update, Deprovision) with counts and validation failure rates',
        params: [
            { name: 'months', type: 'number', description: 'Number of months to look back (default: 6, max: 24)', default: 6 }
        ],
        responseShape: {
            summary: 'Array of weekly records with request type, count, and failure counts',
            fields: ['week', 'type', 'count', 'validationFailures']
        }
    },
    {
        id: 'analytics.validation-trend',
        endpoint: '/api/analytics/validation-trend',
        category: 'Analytics',
        description: 'Validation error trends over time showing how data quality has changed',
        params: [
            { name: 'days', type: 'number', description: 'Number of days to look back (default: 30, max: 90)', default: 30 }
        ],
        responseShape: {
            summary: 'Time series of validation error counts by date',
            fields: ['date', 'errorCount', 'warningCount', 'totalRecords']
        }
    },
    {
        id: 'analytics.completion-times',
        endpoint: '/api/analytics/completion-times',
        category: 'Analytics',
        description: 'Average completion times for provisioning requests broken down by request type',
        params: [
            { name: 'months', type: 'number', description: 'Number of months to look back', default: 6 }
        ],
        responseShape: {
            summary: 'Average processing time per request type',
            fields: ['type', 'avgDays', 'minDays', 'maxDays', 'count']
        }
    },
    {
        id: 'analytics.ps-request-volume',
        endpoint: '/api/analytics/ps-request-volume',
        category: 'Analytics',
        description: 'Professional Services request volume statistics with weekly breakdown',
        params: [
            { name: 'months', type: 'number', description: 'Number of months (default: 6, max: 24)', default: 6 }
        ],
        responseShape: {
            summary: 'Weekly PS request counts with running averages',
            fields: ['week', 'count', 'runningAverage']
        }
    },

    // ===== Package Changes =====
    {
        id: 'package-changes.summary',
        endpoint: '/api/analytics/package-changes/summary',
        category: 'Package Changes',
        description: 'Summary statistics of package changes including total additions, removals, and modifications',
        params: [],
        responseShape: {
            summary: 'Aggregate counts of package change types',
            fields: ['totalChanges', 'additions', 'removals', 'modifications', 'lastAnalyzed']
        }
    },
    {
        id: 'package-changes.by-product',
        endpoint: '/api/analytics/package-changes/by-product',
        category: 'Package Changes',
        description: 'Package changes grouped by product showing which products have most activity',
        params: [
            { name: 'limit', type: 'number', description: 'Max products to return (default: 20)', default: 20 }
        ],
        responseShape: {
            summary: 'Product-level change counts',
            fields: ['product', 'additions', 'removals', 'modifications', 'totalChanges']
        }
    },
    {
        id: 'package-changes.by-account',
        endpoint: '/api/analytics/package-changes/by-account',
        category: 'Package Changes',
        description: 'Package changes grouped by customer account',
        params: [
            { name: 'limit', type: 'number', description: 'Max accounts to return (default: 20)', default: 20 }
        ],
        responseShape: {
            summary: 'Account-level change counts',
            fields: ['account', 'additions', 'removals', 'modifications', 'totalChanges']
        }
    },
    {
        id: 'package-changes.recent',
        endpoint: '/api/analytics/package-changes/recent',
        category: 'Package Changes',
        description: 'Most recent package changes across all accounts with timestamps',
        params: [
            { name: 'limit', type: 'number', description: 'Max changes to return (default: 50)', default: 50 },
            { name: 'changeType', type: 'string', description: 'Filter: addition, removal, or modification', optional: true }
        ],
        responseShape: {
            summary: 'List of recent package changes',
            fields: ['account', 'product', 'changeType', 'timestamp', 'details']
        }
    },

    // ===== Provisioning =====
    {
        id: 'provisioning.list',
        endpoint: '/api/provisioning/requests',
        category: 'Provisioning',
        description: 'List all provisioning requests (Technical Team Requests) with pagination',
        params: [
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 },
            { name: 'page', type: 'number', description: 'Page number', default: 1 }
        ],
        responseShape: {
            summary: 'Paginated list of provisioning requests',
            fields: ['id', 'accountName', 'requestType', 'status', 'createdDate', 'completedDate']
        }
    },
    {
        id: 'provisioning.search',
        endpoint: '/api/provisioning/search',
        category: 'Provisioning',
        description: 'Search provisioning requests by account name, request ID, or text content',
        params: [
            { name: 'query', type: 'string', description: 'Search query text' },
            { name: 'status', type: 'string', description: 'Filter by status: pending, completed, failed, in_progress', optional: true },
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'Filtered provisioning requests matching search criteria',
            fields: ['id', 'accountName', 'requestType', 'status', 'createdDate']
        }
    },
    {
        id: 'provisioning.validation-errors',
        endpoint: '/api/validation/errors',
        category: 'Provisioning',
        description: 'Current validation errors in provisioning requests with severity levels',
        params: [
            { name: 'severity', type: 'string', description: 'Filter: error, warning, info', optional: true },
            { name: 'limit', type: 'number', description: 'Max errors to return (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'List of validation errors with details',
            fields: ['requestId', 'field', 'message', 'severity', 'timestamp']
        }
    },
    {
        id: 'provisioning.removals',
        endpoint: '/api/provisioning/removals',
        category: 'Provisioning',
        description: 'Product removal/deprovision requests from customer accounts',
        params: [
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'limit', type: 'number', description: 'Max removals to return (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'List of product removal requests',
            fields: ['accountName', 'productName', 'requestDate', 'status']
        }
    },

    // ===== Expiration =====
    {
        id: 'expiration.monitor',
        endpoint: '/api/expiration/monitor',
        category: 'Expiration',
        description: 'Products and entitlements expiring within a specified timeframe',
        params: [
            { name: 'days', type: 'number', description: 'Days to look ahead (default: 30, max: 90)', default: 30 },
            { name: 'region', type: 'string', description: 'Filter by region: NAM, EMEA, APAC, LATAM', optional: true },
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true }
        ],
        responseShape: {
            summary: 'List of expiring products with account details',
            fields: ['accountName', 'productName', 'expirationDate', 'daysUntilExpiry', 'region']
        }
    },
    {
        id: 'expiration.status',
        endpoint: '/api/expiration/status',
        category: 'Expiration',
        description: 'Expiration monitor system status and health metrics',
        params: [],
        responseShape: {
            summary: 'System status including last refresh and total tracked',
            fields: ['lastRefresh', 'totalEntitlements', 'expiringCount', 'healthy']
        }
    },
    {
        id: 'expiration.expired-products',
        endpoint: '/api/expiration/expired-products',
        category: 'Expiration',
        description: 'Already-expired products with flexible filtering by category',
        params: [
            { name: 'category', type: 'string', description: 'Filter: Model, Data, App', optional: true },
            { name: 'excludeProduct', type: 'string', description: 'Exclude products containing this string', optional: true },
            { name: 'limit', type: 'number', description: 'Max results (default: 100)', default: 100 }
        ],
        responseShape: {
            summary: 'Grouped expired products by account',
            fields: ['accountName', 'productName', 'category', 'expiredDate']
        }
    },

    // ===== Customer Products =====
    {
        id: 'customer-products.list',
        endpoint: '/api/customer-products',
        category: 'Customer Products',
        description: 'Active products for customers organized by region and product category',
        params: [
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'region', type: 'string', description: 'Filter by region: NAM, EMEA, APAC, LATAM', optional: true },
            { name: 'category', type: 'string', description: 'Filter: Core, Add-on, Professional Services, Support', optional: true },
            { name: 'limit', type: 'number', description: 'Max results (default: 100)', default: 100 }
        ],
        responseShape: {
            summary: 'Customer product entitlements',
            fields: ['accountName', 'productName', 'category', 'region', 'startDate', 'endDate', 'quantity']
        }
    },
    {
        id: 'customer-products.update-requests',
        endpoint: '/api/product-update/requests',
        category: 'Customer Products',
        description: 'Product update requests with status tracking (pending, approved, completed)',
        params: [
            { name: 'status', type: 'string', description: 'Filter: pending, approved, rejected, completed, cancelled', optional: true },
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'limit', type: 'number', description: 'Results per page (default: 50)', default: 50 }
        ],
        responseShape: {
            summary: 'List of product update requests',
            fields: ['id', 'accountName', 'productName', 'actionType', 'status', 'requestedBy', 'createdAt']
        }
    },

    // ===== Ghost Accounts =====
    {
        id: 'ghost-accounts.list',
        endpoint: '/api/ghost-accounts',
        category: 'Ghost Accounts',
        description: 'Customer accounts with expired or expiring products that may need cleanup',
        params: [
            { name: 'isReviewed', type: 'boolean', description: 'Filter by review status', optional: true },
            { name: 'accountSearch', type: 'string', description: 'Search by account name', optional: true }
        ],
        responseShape: {
            summary: 'Ghost accounts with review status',
            fields: ['accountName', 'accountId', 'isReviewed', 'expiredProductCount', 'lastExpiry']
        }
    },
    {
        id: 'ghost-accounts.deprovisioned',
        endpoint: '/api/ghost-accounts/deprovisioned',
        category: 'Ghost Accounts',
        description: 'Accounts that have been deprovisioned (historical)',
        params: [
            { name: 'daysBack', type: 'number', description: 'Days to look back (default: 30)', default: 30 }
        ],
        responseShape: {
            summary: 'Recently deprovisioned accounts',
            fields: ['accountName', 'deprovisionDate', 'productCount']
        }
    },

    // ===== Packages =====
    {
        id: 'packages.list',
        endpoint: '/api/packages',
        category: 'Packages',
        description: 'Software packages from the package repository with metadata',
        params: [
            { name: 'type', type: 'string', description: 'Filter by package type', optional: true },
            { name: 'limit', type: 'number', description: 'Max packages (default: 100)', default: 100 }
        ],
        responseShape: {
            summary: 'Package catalog entries',
            fields: ['name', 'type', 'description', 'version', 'dependencies']
        }
    },
    {
        id: 'packages.stats',
        endpoint: '/api/packages/stats',
        category: 'Packages',
        description: 'Package repository summary statistics and health metrics',
        params: [],
        responseShape: {
            summary: 'Aggregate package stats',
            fields: ['totalPackages', 'typeBreakdown', 'mostUsed']
        }
    },

    // ===== Audit Trail =====
    {
        id: 'audit-trail.stats',
        endpoint: '/api/audit-trail/stats',
        category: 'Audit Trail',
        description: 'PS audit trail statistics including total records and activity summary',
        params: [],
        responseShape: {
            summary: 'Audit trail aggregate metrics',
            fields: ['totalRecords', 'statusChanges', 'lastCapture']
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
            summary: 'Matching PS audit records with change history',
            fields: ['recordName', 'accountName', 'status', 'lastModified', 'changeCount']
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
    return dataCatalog.map(source => ({
        id: source.id,
        endpoint: source.endpoint,
        description: source.description,
        params: source.params,
        returns: source.responseShape.summary,
        fields: source.responseShape.fields
    }));
}

module.exports = {
    getDataCatalog,
    getDataCatalogByCategory,
    isEndpointAllowed,
    getCatalogEntry,
    getCatalogForPrompt
};
