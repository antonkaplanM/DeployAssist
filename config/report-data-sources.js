/**
 * Canonical Data Source Schema — v4.0 (Origin-Based)
 *
 * Single source of truth for all report-eligible API endpoints,
 * organized by DATA ORIGIN rather than app page/feature.
 *
 * Categories:
 *   PRIMARY   — data read directly from external systems (Salesforce, SML, Package repo)
 *   DERIVED   — data computed/cached locally from primary sources
 *   PRESERVED — data captured because it is ephemeral in the source
 *
 * Each entry includes sourceType, sourceRef, and primarySource fields
 * so the LLM and developers can trace every data point back to its origin.
 *
 * Generates:
 *   1. OpenAI function-calling tool definitions (report LLM)
 *   2. MCP tool inputSchema + description (Cursor agent)
 *   3. Endpoint allowlist (Zod validation)
 *   4. Data catalog for the frontend capabilities endpoint
 *
 * When adding a new data source, add it here and create the
 * corresponding MCP tool execute function. See the Cursor rule
 * `.cursor/rules/data-source-alignment.mdc` for the full checklist.
 */

const { VALID_COMPONENT_TYPES, VALID_FORMATS, VALID_LAYOUTS, VALID_CF_OPERATORS, VALID_CF_STYLES, MAX_COMPONENTS } = require('./report-config-schema');

// Valid source types for filtering and validation
const SOURCE_TYPES = ['primary', 'derived', 'preserved'];

const DATA_SOURCES = [
    // ═══════════════════════════════════════════════════════════
    //  PRIMARY SOURCES — Direct from external systems
    // ═══════════════════════════════════════════════════════════

    // ───────────── Primary: Salesforce (Prof_Services_Request__c) ─────────────
    {
        id: 'primary.salesforce.provisioning-list',
        endpoint: '/api/provisioning/requests',
        category: 'Primary: Salesforce',
        sourceType: 'primary',
        sourceRef: 'salesforce',
        primarySource: 'Prof_Services_Request__c',
        mcpToolName: 'list_provisioning_requests',
        description: 'List all provisioning requests (Technical Team Requests) with pagination and filtering. Returns raw Salesforce records.',
        params: [
            { name: 'pageSize', type: 'number', description: 'Results per page (default 25)', default: 25 },
            { name: 'offset', type: 'number', description: 'Offset for pagination (default 0)', default: 0 },
            { name: 'requestType', type: 'string', description: 'Filter by request type (e.g. "New", "Update", "Deprovision")', optional: true },
            { name: 'accountId', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'status', type: 'string', description: 'Filter by effective status (e.g. "Tenant Request Completed", "Provisioning Failed")', optional: true },
            { name: 'startDate', type: 'string', description: 'Filter records created on or after this date (SOQL datetime, e.g. "2026-02-01T00:00:00Z")', optional: true },
            { name: 'endDate', type: 'string', description: 'Filter records created on or before this date (SOQL datetime, e.g. "2026-03-31T23:59:59Z")', optional: true },
            { name: 'search', type: 'string', description: 'Search in PS record name and account name', optional: true }
        ],
        responseShape: {
            arrayKey: 'records',
            summary: 'Paginated list of provisioning requests.',
            fields: ['Id', 'Name', 'Account__c', 'Status__c', 'TenantRequestAction__c', 'Tenant_Name__c', 'CreatedDate', 'LastModifiedDate']
        },
        dependencies: ['salesforce'],
        reportEligible: true
    },
    {
        id: 'primary.salesforce.provisioning-search',
        endpoint: '/api/provisioning/search',
        category: 'Primary: Salesforce',
        sourceType: 'primary',
        sourceRef: 'salesforce',
        primarySource: 'Prof_Services_Request__c',
        mcpToolName: 'search_provisioning_requests',
        description: 'Search provisioning requests by account name, request ID, or text. Returns categorized results.',
        params: [
            { name: 'q', type: 'string', description: 'Search query text' },
            { name: 'limit', type: 'number', description: 'Max results (default 20)', default: 20 }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Search results grouped into categories. Response object "results" contains "technicalRequests", "accounts", and "tenants" arrays.',
            fields: ['id', 'name', 'account', 'status', 'requestType'],
            note: 'Use the technicalRequests array for table data. The "results" object contains "technicalRequests", "accounts", and "tenants" arrays.'
        },
        dependencies: ['salesforce'],
        reportEligible: true
    },
    {
        id: 'primary.salesforce.validation-errors',
        endpoint: '/api/validation/errors',
        category: 'Primary: Salesforce',
        sourceType: 'primary',
        sourceRef: 'salesforce',
        primarySource: 'Prof_Services_Request__c',
        mcpToolName: 'get_validation_errors',
        description: 'Current validation errors in provisioning requests with failed rule details.',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame (default "1w")', default: '1w', optional: true },
            { name: 'enabledRules', type: 'string', description: 'JSON array or comma-separated list of rule IDs to check (omit for all rules)', optional: true }
        ],
        responseShape: {
            arrayKey: 'errors',
            summary: 'List of validation errors. Also includes "summary" object.',
            fields: ['recordId', 'recordName', 'account', 'requestType', 'createdDate', 'failedRules']
        },
        dependencies: ['salesforce'],
        reportEligible: true
    },
    {
        id: 'primary.salesforce.provisioning-removals',
        endpoint: '/api/provisioning/removals',
        category: 'Primary: Salesforce',
        sourceType: 'primary',
        sourceRef: 'salesforce',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c)',
        mcpToolName: 'get_provisioning_removals',
        description: 'Product removal/deprovision requests showing what was removed from customer accounts.',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame (default "1w")', default: '1w', optional: true }
        ],
        responseShape: {
            arrayKey: 'requests',
            summary: 'List of removal requests. Each item has currentRequest and removals objects.',
            fields: ['currentRequest.id', 'currentRequest.name', 'currentRequest.account', 'currentRequest.status', 'currentRequest.createdDate', 'removals.hasRemovals', 'removals.removedModels', 'removals.removedData', 'removals.removedApps']
        },
        dependencies: ['salesforce'],
        reportEligible: true
    },
    {
        id: 'primary.salesforce.customer-products',
        endpoint: '/api/customer-products',
        category: 'Primary: Salesforce',
        sourceType: 'primary',
        sourceRef: 'salesforce',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c)',
        mcpToolName: 'list_customer_products',
        description: 'Active products for a specific customer organized by region and product category (from PS records). Requires an account name.',
        params: [
            { name: 'account', type: 'string', description: 'Account name to look up (required)', required: true },
            { name: 'includeExpired', type: 'boolean', description: 'Include expired products (default false)', default: false, optional: true }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Products organized under productsByRegion[region].models/data/apps arrays. Complex nested structure — not a flat array.',
            fields: ['account', 'productsByRegion', 'summary', 'lastUpdated', 'psRecordsAnalyzed']
        },
        dependencies: ['salesforce'],
        reportEligible: true
    },

    // ───────────── Primary: SML (Tenant Provisioning API) ─────────────
    {
        id: 'primary.sml.entitlements',
        endpoint: '/api/tenant-entitlements',
        category: 'Primary: SML',
        sourceType: 'primary',
        sourceRef: 'sml',
        primarySource: 'sml_tenant_data (product_entitlements JSONB)',
        mcpToolName: null,
        description: 'Product entitlements for a SPECIFIC tenant or account from SML tenant data. Returns a flat array of entitlement rows with status and expiry info. REQUIRES either "tenant" or "account" parameter — will error without one. For overview/count queries use /api/tenant-entitlements/summary instead. All entitlements (including expired) are returned by default. Pass includeExpired=false to exclude expired.',
        params: [
            { name: 'tenant', type: 'string', description: 'Tenant name to look up (preferred — direct SML match)', optional: true },
            { name: 'account', type: 'string', description: 'Account name to look up (legacy)', optional: true },
            { name: 'includeExpired', type: 'boolean', description: 'Include expired entitlements (default true). Set to false to show only active/expiring.', optional: true }
        ],
        requireOneOf: ['tenant', 'account'],
        responseShape: {
            arrayKey: 'entitlements',
            summary: 'Flat array of entitlement rows. Also includes "summary" object with counts.',
            fields: ['tenantName', 'tenantId', 'category', 'productCode', 'productName', 'packageName', 'productModifier', 'quantity', 'startDate', 'endDate', 'status', 'daysRemaining'],
            note: 'One of "tenant" or "account" is required. "category" is apps/models/data. "status" is Active/Expiring Soon/Expired.'
        },
        dependencies: [],
        reportEligible: true
    },
    {
        id: 'primary.sml.entitlements-suggest',
        endpoint: '/api/tenant-entitlements/suggest',
        category: 'Primary: SML',
        sourceType: 'primary',
        sourceRef: 'sml',
        primarySource: 'sml_tenant_data',
        mcpToolName: null,
        description: 'Typeahead suggestions searching sml_tenant_data by tenant_name, account_name, and tenant_display_name. Use as suggestEndpoint for typeahead filters targeting entitlement data.',
        params: [
            { name: 'search', type: 'string', description: 'Search term (min 2 chars)' },
            { name: 'limit', type: 'number', description: 'Max results (default 10)', default: 10, optional: true, maximum: 25 }
        ],
        responseShape: {
            arrayKey: 'tenants',
            summary: 'Array of matching tenants.',
            fields: ['tenant_name', 'account_name', 'tenant_display_name', 'tenant_id'],
            note: 'Use as suggestEndpoint for typeahead filters with suggestResultKey "tenants", suggestDisplayField "tenant_name", and suggestSecondaryField "account_name".'
        },
        dependencies: [],
        reportEligible: true
    },
    {
        id: 'primary.sml.tenant-summary',
        endpoint: '/api/tenant-entitlements/summary',
        category: 'Primary: SML',
        sourceType: 'primary',
        sourceRef: 'sml',
        primarySource: 'sml_tenant_data',
        mcpToolName: null,
        description: 'Aggregate summary of all SML tenants. Returns a list of all tenants with their account names, display names, and last sync timestamps, plus summary counts (totalTenants, uniqueAccounts). No parameters required — use this to answer overview questions like "how many tenants are there?".',
        params: [],
        responseShape: {
            arrayKey: 'tenants',
            summary: 'Array of all active tenants. Also includes "summary" object with totalTenants and uniqueAccounts.',
            fields: ['tenantName', 'accountName', 'displayName', 'tenantId', 'lastSynced'],
            note: 'No parameters required. Returns all non-deleted tenants.'
        },
        dependencies: [],
        reportEligible: true
    },
    {
        id: 'primary.sml.entitlement-analysis',
        endpoint: '/api/tenant-entitlements/analysis',
        category: 'Primary: SML',
        sourceType: 'primary',
        sourceRef: 'sml',
        primarySource: 'sml_tenant_data (product_entitlements JSONB)',
        mcpToolName: null,
        description: 'Per-tenant entitlement status analysis across ALL SML tenants. Returns each tenant with counts of active, expiring, and expired entitlements plus an "allExpired" flag. IMPORTANT: without the "status" filter, this returns ALL tenants. When building a report component for a specific subset (e.g., "tenants with all expired products"), you MUST pass the corresponding status filter in the report config params — the same filter you used when exploring with fetch_endpoint_data.',
        params: [
            { name: 'status', type: 'string', description: 'REQUIRED for filtered views. Values: "allExpired" (only tenants where every entitlement is expired), "hasExpiring" (tenants with at least one expiring product), "fullyActive" (tenants with no expired or expiring products). Without this, ALL tenants are returned regardless of status.', optional: true }
        ],
        responseShape: {
            arrayKey: 'tenants',
            summary: 'Array of tenant rows with entitlement counts. Also includes "summary" with aggregate totals.',
            fields: ['tenantName', 'accountName', 'tenantId', 'totalEntitlements', 'activeCount', 'expiringCount', 'expiredCount', 'allExpired', 'lastSynced'],
            note: 'Use status=allExpired to find tenants needing deprovisioning. The "allExpired" field is a boolean per tenant. ALWAYS pass the status filter in the report config params, not just during exploration.'
        },
        dependencies: [],
        reportEligible: true
    },

    {
        id: 'primary.sml.product-breakdown',
        endpoint: '/api/tenant-entitlements/product-breakdown',
        category: 'Primary: SML',
        sourceType: 'primary',
        sourceRef: 'sml',
        primarySource: 'sml_tenant_data (product_entitlements JSONB)',
        mcpToolName: null,
        description: 'Product-level aggregation across all SML tenants. Returns each unique product with its total count and the number of tenants that have it. Ideal for pie charts and bar charts showing product distribution. Use tenantStatus to filter to specific tenant subsets (e.g., "allExpired" to see only products from tenants where everything is expired).',
        params: [
            { name: 'tenantStatus', type: 'string', description: 'Filter tenants before aggregating: "allExpired", "hasExpiring", "fullyActive". Omit for all tenants.', optional: true },
            { name: 'productStatus', type: 'string', description: 'Filter to specific product status: "Active", "Expiring Soon", "Expired". Omit for all products.', optional: true }
        ],
        responseShape: {
            arrayKey: 'products',
            summary: 'Array of products sorted by count descending. Also includes "summary" with totalProducts, totalEntitlements, tenantsProcessed.',
            fields: ['productCode', 'productName', 'category', 'count', 'tenantCount'],
            note: 'Use tenantStatus=allExpired to see which products exist in fully-expired tenants. "count" is total entitlement instances, "tenantCount" is distinct tenants having that product.'
        },
        dependencies: [],
        reportEligible: true
    },

    // ───────────── Primary: Package Repository ─────────────
    {
        id: 'primary.packages.list',
        endpoint: '/api/packages',
        category: 'Primary: Packages',
        sourceType: 'primary',
        sourceRef: 'packages',
        primarySource: 'packages table (synced from Salesforce Package__c)',
        mcpToolName: 'list_packages',
        description: 'Software packages from the package repository with resource limits and metadata.',
        params: [
            { name: 'type', type: 'string', description: 'Filter by package type (e.g. "Base", "Expansion")', optional: true },
            { name: 'includeDeleted', type: 'boolean', description: 'Include soft-deleted packages (default false)', default: false, optional: true }
        ],
        responseShape: {
            arrayKey: 'packages',
            summary: 'Package catalog entries.',
            fields: ['id', 'package_name', 'ri_package_name', 'package_type', 'locations', 'description', 'max_users', 'max_jobs_day', 'related_products']
        },
        dependencies: [],
        reportEligible: true
    },
    {
        id: 'primary.packages.stats',
        endpoint: '/api/packages/summary/stats',
        category: 'Primary: Packages',
        sourceType: 'primary',
        sourceRef: 'packages',
        primarySource: 'packages table (synced from Salesforce Package__c)',
        mcpToolName: 'get_package_stats',
        description: 'Package repository summary statistics.',
        params: [],
        responseShape: {
            arrayKey: null,
            summary: 'Aggregate package stats under the "summary" key (not an array). Use dot-path "summary.totalPackages" for KPI.',
            fields: ['summary.totalPackages', 'summary.basePackages', 'summary.expansionPackages', 'summary.uniqueLocations', 'summary.lastSyncTime']
        },
        dependencies: [],
        reportEligible: true
    },

    // ═══════════════════════════════════════════════════════════
    //  DERIVED DATA — Computed from primary sources, cached locally
    // ═══════════════════════════════════════════════════════════

    // ───────────── Derived: Provisioning Analytics ─────────────
    {
        id: 'derived.provisioning-analytics.request-types',
        endpoint: '/api/analytics/request-types-week',
        category: 'Derived: Provisioning Analytics',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (via ps_audit_trail)',
        mcpToolName: 'get_request_types_week',
        description: 'Provisioning REQUEST TYPE breakdown (New License, Product Update, Deprovision) with counts and validation failure rates. Measures request volume by type — NOT product upgrade/downgrade trends.',
        params: [
            { name: 'months', type: 'number', description: 'Months to look back (default 12)', default: 12, minimum: 1, maximum: 24 },
            { name: 'enabledRules', type: 'string', description: 'JSON array of validation rule IDs to include in failure rate calculation (omit for all rules)', optional: true }
        ],
        responseShape: {
            arrayKey: 'data',
            summary: 'Array of records per request type with counts and failure rates.',
            fields: ['requestType', 'count', 'validationFailures', 'validationFailureRate', 'percentage']
        },
        dependencies: ['ps-audit-trail'],
        reportEligible: true
    },
    {
        id: 'derived.provisioning-analytics.validation-trend',
        endpoint: '/api/analytics/validation-trend',
        category: 'Derived: Provisioning Analytics',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (via ps_audit_trail)',
        mcpToolName: 'get_validation_trend',
        description: 'VALIDATION FAILURE rates over time — how many provisioning requests failed automated rule checks, by request type. Has NOTHING to do with product upgrades or downgrades.',
        params: [
            { name: 'months', type: 'number', description: 'Months to look back (default 3)', default: 3, minimum: 1, maximum: 12 },
            { name: 'enabledRules', type: 'string', description: 'JSON array of validation rule IDs to include (omit for all rules)', optional: true }
        ],
        responseShape: {
            arrayKey: 'trendData',
            summary: 'Time series of validation failure percentages by date and request type.',
            fields: ['date', 'displayDate', 'updateTotal', 'updateFailures', 'updateFailurePercentage', 'newTotal', 'newFailures', 'newFailurePercentage', 'deprovisionTotal', 'deprovisionFailures', 'deprovisionFailurePercentage', 'total', 'failures', 'failurePercentage']
        },
        dependencies: ['ps-audit-trail'],
        reportEligible: true
    },
    {
        id: 'derived.provisioning-analytics.completion-times',
        endpoint: '/api/analytics/completion-times',
        category: 'Derived: Provisioning Analytics',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (via ps_audit_trail)',
        mcpToolName: null,
        description: 'Weekly average COMPLETION TIMES for provisioning requests — how long requests take to process, with min/max/median hours. NOT about product changes or upgrades.',
        params: [],
        responseShape: {
            arrayKey: 'data',
            summary: 'Weekly time series of completion time statistics.',
            fields: ['weekStart', 'weekLabel', 'avgHours', 'avgDays', 'completedCount', 'minHours', 'maxHours', 'medianHours', 'psRecords']
        },
        dependencies: ['ps-audit-trail'],
        reportEligible: true
    },

    // ───────────── Derived: Package Changes ─────────────
    {
        id: 'derived.package-changes.summary',
        endpoint: '/api/analytics/package-changes/summary',
        category: 'Derived: Package Changes',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c → package_change_analysis)',
        mcpToolName: 'get_package_changes_summary',
        description: 'Summary statistics of package changes: total upgrades, downgrades, affected accounts. Data is in the "summary" object (not an array).',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default "1y")', default: '1y' }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Aggregate counts under the "summary" key. Use dot-path "summary.total_changes" for KPI valueField.',
            fields: ['summary.total_changes', 'summary.total_upgrades', 'summary.total_downgrades', 'summary.ps_records_with_changes', 'summary.accounts_affected', 'summary.deployments_affected', 'summary.products_changed']
        },
        dependencies: ['package-change-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.package-changes.by-product',
        endpoint: '/api/analytics/package-changes/by-product',
        category: 'Derived: Package Changes',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c → package_change_analysis)',
        mcpToolName: 'get_package_changes_by_product',
        description: 'Package changes grouped by product — which products have the most upgrade/downgrade activity.',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default "1y")', default: '1y' }
        ],
        responseShape: {
            arrayKey: 'data',
            summary: 'Product-level change counts.',
            fields: ['product_code', 'product_name', 'total_changes', 'upgrades', 'downgrades', 'ps_records', 'accounts']
        },
        dependencies: ['package-change-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.package-changes.by-account',
        endpoint: '/api/analytics/package-changes/by-account',
        category: 'Derived: Package Changes',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c → package_change_analysis)',
        mcpToolName: 'get_package_changes_by_account',
        description: 'Package changes grouped by customer account with nested deployment and product details.',
        params: [
            { name: 'timeFrame', type: 'string', description: 'Time frame for analysis (default "1y")', default: '1y' },
            { name: 'limit', type: 'number', description: 'Max accounts to return', optional: true }
        ],
        responseShape: {
            arrayKey: 'data',
            summary: 'Account-level change counts with nested deployments.',
            fields: ['account_name', 'account_id', 'total_changes', 'upgrades', 'downgrades', 'ps_records', 'products_changed']
        },
        dependencies: ['package-change-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.package-changes.recent',
        endpoint: '/api/analytics/package-changes/recent',
        category: 'Derived: Package Changes',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'Prof_Services_Request__c (Payload_Data__c → package_change_analysis)',
        mcpToolName: 'get_recent_package_changes',
        description: 'Most recent individual package changes (upgrades/downgrades) across all accounts. NOT aggregated by time period — returns one row per change event.',
        params: [
            { name: 'limit', type: 'number', description: 'Max changes to return (default 20)', default: 20 }
        ],
        responseShape: {
            arrayKey: 'data',
            summary: 'List of recent individual package change records.',
            fields: ['account_name', 'product_code', 'product_name', 'change_type', 'previous_package', 'new_package', 'ps_created_date', 'ps_record_name', 'deployment_number', 'tenant_name']
        },
        dependencies: ['package-change-analysis'],
        reportEligible: true
    },

    // ───────────── Derived: Expiration ─────────────
    {
        id: 'derived.expiration.monitor',
        endpoint: '/api/expiration/monitor',
        category: 'Derived: Expiration',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'expiration_monitor table (computed from PS + entitlement data)',
        mcpToolName: 'get_expiration_monitor',
        description: 'Products and entitlements expiring within a specified timeframe, grouped by account.',
        params: [
            { name: 'expirationWindow', type: 'number', description: 'Days to look ahead (default 30, max 90)', default: 30, minimum: 1, maximum: 90 },
            { name: 'showExtended', type: 'boolean', description: 'Include products that have been extended (default false)', default: false, optional: true }
        ],
        responseShape: {
            arrayKey: 'expirations',
            summary: 'List of accounts with expiring products. Also includes "summary" object.',
            fields: ['account.id', 'account.name', 'psRecord.id', 'psRecord.name', 'earliestExpiry', 'earliestDaysUntilExpiry', 'status']
        },
        dependencies: ['expiration-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.expiration.status',
        endpoint: '/api/expiration/status',
        category: 'Derived: Expiration',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'expiration_monitor table',
        mcpToolName: 'get_expiration_status',
        description: 'Expiration analysis system status and last run details.',
        params: [],
        responseShape: {
            arrayKey: null,
            summary: 'Analysis status object. When hasAnalysis is true, "analysis" contains run details.',
            fields: ['hasAnalysis', 'analysis.lastRun', 'analysis.lastRunAgo', 'analysis.status', 'analysis.recordsAnalyzed', 'analysis.entitlementsProcessed', 'analysis.expirationsFound', 'analysis.extensionsFound']
        },
        dependencies: ['expiration-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.expiration.expired-products',
        endpoint: '/api/expiration/expired-products',
        category: 'Derived: Expiration',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'expiration_monitor table',
        mcpToolName: 'query_expired_products',
        description: 'Already-expired products grouped by account with product type filtering.',
        params: [
            { name: 'category', type: 'string', description: 'Filter by product type: Model, Data, App', optional: true },
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'productName', type: 'string', description: 'Filter by product name (partial match)', optional: true },
            { name: 'excludeProduct', type: 'string', description: 'Exclude products containing this string', optional: true },
            { name: 'region', type: 'string', description: 'Filter by region', optional: true },
            { name: 'includeGhostAccountsOnly', type: 'boolean', description: 'Only show accounts flagged as ghost accounts (default false)', default: false, optional: true },
            { name: 'limit', type: 'number', description: 'Max results (default 100)', default: 100, minimum: 1, maximum: 500 },
            { name: 'groupByAccount', type: 'boolean', description: 'Group results by account (default true)', default: true, optional: true }
        ],
        responseShape: {
            arrayKey: 'accounts',
            summary: 'Expired products grouped by account (default) or flat under "products" key when groupByAccount=false. Also includes "summary" object.',
            fields: ['account_name', 'ma_sf_account_id', 'is_ghost_account'],
            note: 'Each account has an "expired_products" array with: product_name, product_type, expiration_date.'
        },
        dependencies: ['expiration-analysis'],
        reportEligible: true
    },

    // ───────────── Derived: Ghost Accounts ─────────────
    {
        id: 'derived.ghost-accounts.list',
        endpoint: '/api/ghost-accounts',
        category: 'Derived: Ghost Accounts',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'ghost_accounts table (computed from expiration analysis)',
        mcpToolName: 'list_ghost_accounts',
        description: 'Customer accounts with expired products that may need cleanup or deprovisioning.',
        params: [
            { name: 'isReviewed', type: 'boolean', description: 'Filter by review status', optional: true },
            { name: 'accountSearch', type: 'string', description: 'Search by account name', optional: true },
            { name: 'expiryBefore', type: 'string', description: 'Filter accounts with latest expiry before this date (ISO date string)', optional: true },
            { name: 'expiryAfter', type: 'string', description: 'Filter accounts with latest expiry after this date (ISO date string)', optional: true }
        ],
        responseShape: {
            arrayKey: 'ghostAccounts',
            summary: 'Ghost accounts with review status. Also includes "summary" object.',
            fields: ['id', 'account_id', 'account_name', 'total_expired_products', 'latest_expiry_date', 'last_checked', 'is_reviewed', 'reviewed_at', 'reviewed_by', 'notes', 'ma_sf_account_id', 'ma_sf_link']
        },
        dependencies: ['ghost-account-analysis'],
        reportEligible: true
    },
    {
        id: 'derived.ghost-accounts.deprovisioned',
        endpoint: '/api/ghost-accounts/deprovisioned',
        category: 'Derived: Ghost Accounts',
        sourceType: 'derived',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'ghost_accounts table + Salesforce deprovision records',
        mcpToolName: 'get_deprovisioned_accounts',
        description: 'Accounts that have been recently deprovisioned with deprovision details.',
        params: [
            { name: 'daysBack', type: 'number', description: 'Days to look back (default 30)', default: 30 }
        ],
        responseShape: {
            arrayKey: 'deprovisionedAccounts',
            summary: 'Recently deprovisioned accounts.',
            fields: ['accountId', 'accountName', 'totalExpiredProducts', 'latestExpiryDate', 'daysSinceDeprovisioning', 'deprovisioningRecord.id', 'deprovisioningRecord.name', 'deprovisioningRecord.createdDate', 'deprovisioningRecord.status']
        },
        dependencies: ['ghost-account-analysis'],
        reportEligible: true
    },

    // ───────────── Derived: Current Accounts ─────────────
    {
        id: 'derived.current-accounts.list',
        endpoint: '/api/current-accounts',
        category: 'Derived: Current Accounts',
        sourceType: 'derived',
        sourceRef: 'sml+salesforce',
        primarySource: 'current_accounts table (merged from SML tenants + Salesforce PS records)',
        mcpToolName: null,
        description: 'Enriched tenant account data combining SML tenant info with Salesforce provisioning records. Paginated list with search, sorting, and status filtering.',
        params: [
            { name: 'page', type: 'number', description: 'Page number (default 1)', default: 1, optional: true },
            { name: 'pageSize', type: 'number', description: 'Results per page (default 50)', default: 50, optional: true },
            { name: 'sortBy', type: 'string', description: 'Sort field (default "completion_date")', default: 'completion_date', optional: true },
            { name: 'sortOrder', type: 'string', description: 'Sort direction: ASC or DESC (default DESC)', default: 'DESC', optional: true },
            { name: 'includeRemoved', type: 'boolean', description: 'Include removed records (default false)', default: false, optional: true },
            { name: 'search', type: 'string', description: 'Search across client, tenant name, services', optional: true }
        ],
        responseShape: {
            arrayKey: 'accounts',
            summary: 'Paginated list of current accounts with enriched tenant data. Also includes "pagination" object.',
            fields: ['client', 'services', 'account_type', 'csm_owner', 'provisioning_status', 'completion_date', 'size', 'region', 'tenant_name', 'tenant_url', 'tenant_id', 'salesforce_account_id', 'initial_tenant_admin', 'comments', 'record_status']
        },
        dependencies: ['sml-sync'],
        reportEligible: true
    },

    // ───────────── Primary: Mixpanel ─────────────
    {
        id: 'primary.mixpanel.events',
        endpoint: '/api/mixpanel/events',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Raw Event Export API',
        mcpToolName: 'export_mixpanel_events',
        description: 'Export raw product-usage events from Mixpanel. Returns individual event records with properties and timestamps.',
        params: [
            { name: 'fromDate', type: 'string', description: 'Start date (YYYY-MM-DD)', required: true },
            { name: 'toDate', type: 'string', description: 'End date (YYYY-MM-DD)', required: true },
            { name: 'event', type: 'string', description: 'JSON-encoded array of event names to filter, e.g. \'["Login","Signup"]\'. Omit for all events.', optional: true },
            { name: 'limit', type: 'number', description: 'Max events to return', default: 1000, optional: true }
        ],
        responseShape: {
            arrayKey: 'events',
            summary: 'Raw Mixpanel events with properties. Also includes "eventCounts" summary and "dateRange".',
            fields: ['event', 'properties.time', 'properties.$insert_id', 'properties.mp_processing_time_ms', 'properties.distinct_id']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },
    {
        id: 'primary.mixpanel.insights',
        endpoint: '/api/mixpanel/insights',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Insights Query API',
        mcpToolName: 'query_mixpanel_insights',
        description: 'Query a Mixpanel Insights report. Returns aggregated analytics data (event counts, breakdowns). Requires a Growth or Enterprise plan.',
        params: [
            { name: 'bookmarkId', type: 'string', description: 'Saved Insights report bookmark ID', optional: true }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Aggregated insights data under the "results" key. Structure depends on the report configuration.',
            fields: ['results', 'projectId']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },
    {
        id: 'primary.mixpanel.funnels',
        endpoint: '/api/mixpanel/funnels',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Funnels Query API',
        mcpToolName: 'query_mixpanel_funnels',
        description: 'Query a Mixpanel Funnels report. Returns step-by-step conversion data. Requires a Growth or Enterprise plan.',
        params: [
            { name: 'funnelId', type: 'string', description: 'Saved funnel report ID', optional: true }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Funnel conversion data under the "results" key. Structure depends on the funnel definition.',
            fields: ['results', 'projectId']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },
    {
        id: 'primary.mixpanel.retention',
        endpoint: '/api/mixpanel/retention',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Retention Query API',
        mcpToolName: 'query_mixpanel_retention',
        description: 'Query a Mixpanel Retention report. Returns cohort-based retention rates over time. Requires a Growth or Enterprise plan.',
        params: [
            { name: 'bookmarkId', type: 'string', description: 'Saved retention report bookmark ID', optional: true }
        ],
        responseShape: {
            arrayKey: null,
            summary: 'Retention cohort data under the "results" key. Structure depends on the retention definition.',
            fields: ['results', 'projectId']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },
    {
        id: 'primary.mixpanel.profiles',
        endpoint: '/api/mixpanel/profiles',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Engage (Profiles) API',
        mcpToolName: 'query_mixpanel_profiles',
        description: 'Query user/group profiles from Mixpanel. Returns profile properties like last seen, email, custom attributes.',
        params: [
            { name: 'where', type: 'string', description: 'Filter expression for profiles (Mixpanel expression syntax)', optional: true },
            { name: 'outputProperties', type: 'string', description: 'JSON array of property names to return, e.g. \'["$email","$last_seen"]\'. Omit for all.', optional: true }
        ],
        responseShape: {
            arrayKey: 'profiles',
            summary: 'User/group profile records with properties.',
            fields: ['$distinct_id', '$properties.$email', '$properties.$first_name', '$properties.$last_name', '$properties.$last_seen', '$properties.$created']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },
    {
        id: 'primary.mixpanel.event-names',
        endpoint: '/api/mixpanel/event-names',
        category: 'Primary: Mixpanel',
        sourceType: 'primary',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel Event Names API',
        mcpToolName: 'list_mixpanel_event_names',
        description: 'List all distinct event names tracked in the Mixpanel project. Useful for discovering available events before querying.',
        params: [],
        responseShape: {
            arrayKey: 'eventNames',
            summary: 'Array of event name strings tracked in the project.',
            fields: ['eventNames']
        },
        dependencies: ['mixpanel'],
        reportEligible: true
    },

    // ───────────── Derived: Mixpanel Usage ─────────────
    {
        id: 'derived.mixpanel.usage-limits',
        endpoint: '/api/mixpanel/usage-limits',
        category: 'Derived: Mixpanel Usage',
        sourceType: 'derived',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel raw events (DailyJobsRun, DailyUnderwriterJobsRun, StorageStatus, etc.)',
        mcpToolName: 'get_usage_limits',
        description: 'Aggregated quota and storage utilization per tenant from Mixpanel. Shows which customers are at or exceeding usage limits.',
        params: [
            { name: 'days', type: 'number', required: false, description: 'Number of days to look back (default 7, max 365)' }
        ],
        responseShape: {
            arrayKey: 'tenants',
            summary: 'Each tenant has tenantId, overallStatus (exceeded/warning/ok), maxQuotaUtilization, quotaMetrics array, and storageMetrics array. Summary object has totalTenants, exceeded, warning, ok counts.',
            fields: [
                'tenantId', 'overallStatus', 'maxQuotaUtilization', 'lastSeen',
                'quotaMetrics[].metricType', 'quotaMetrics[].currentValue', 'quotaMetrics[].limit',
                'quotaMetrics[].utilization', 'quotaMetrics[].status', 'quotaMetrics[].serviceId',
                'storageMetrics[].metricType', 'storageMetrics[].value',
                'storageMetrics[].totalDiskMb', 'storageMetrics[].usedDiskMb', 'storageMetrics[].utilization'
            ]
        },
        dependencies: ['mixpanel-credentials'],
        reportEligible: true
    },
    {
        id: 'derived.mixpanel.daily-exceedances',
        endpoint: '/api/mixpanel/daily-exceedances',
        category: 'Derived: Mixpanel Usage',
        sourceType: 'derived',
        sourceRef: 'mixpanel',
        primarySource: 'Mixpanel raw quota events (DailyJobsRun, DailyUnderwriterJobsRun, etc.) aggregated per day',
        mcpToolName: 'get_daily_exceedances',
        description: 'Per-day quota limit exceedances by tenant. Shows which customers exceeded at least one daily quota limit and on how many days within the given period.',
        params: [
            { name: 'days', type: 'number', required: false, description: 'Number of days to look back (default 14, max 365)' }
        ],
        responseShape: {
            arrayKey: 'tenants',
            summary: 'Only tenants with at least one exceedance day are returned. Each tenant has totalExceedanceDays and an exceedances array with per-day metric breakdowns. Summary has totalTenantsExceeded, totalExceedanceDays, periodDays.',
            fields: [
                'tenantId', 'tenantName', 'accountName', 'totalExceedanceDays',
                'exceedances[].date',
                'exceedances[].metrics[].metricType', 'exceedances[].metrics[].value',
                'exceedances[].metrics[].limit', 'exceedances[].metrics[].utilization'
            ]
        },
        dependencies: ['mixpanel-credentials'],
        reportEligible: true
    },

    // ═══════════════════════════════════════════════════════════
    //  PRESERVED DATA — Captured because ephemeral in source
    // ═══════════════════════════════════════════════════════════

    // ───────────── Preserved: Audit Trail ─────────────
    {
        id: 'preserved.audit-trail.stats',
        endpoint: '/api/audit-trail/stats',
        category: 'Preserved: Audit Trail',
        sourceType: 'preserved',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'ps_audit_trail table (snapshots of Prof_Services_Request__c)',
        mcpToolName: 'get_audit_stats',
        description: 'PS audit trail statistics including total records, snapshots, and status changes.',
        params: [],
        responseShape: {
            arrayKey: null,
            summary: 'Audit trail aggregate metrics under the "stats" key (not an array). Use dot-path "stats.total_ps_records" for KPI.',
            fields: ['stats.total_ps_records', 'stats.total_snapshots', 'stats.total_status_changes', 'stats.earliest_snapshot', 'stats.latest_snapshot']
        },
        dependencies: ['ps-audit-trail'],
        reportEligible: true
    },
    {
        id: 'preserved.audit-trail.search',
        endpoint: '/api/audit-trail/search',
        category: 'Preserved: Audit Trail',
        sourceType: 'preserved',
        sourceRef: 'salesforce.provisioning',
        primarySource: 'ps_audit_trail table (snapshots of Prof_Services_Request__c)',
        mcpToolName: 'search_ps_records',
        description: 'Search PS audit records by name or account. Minimum 2 characters required.',
        params: [
            { name: 'q', type: 'string', description: 'Search text for PS record name, account name, or record ID (min 2 chars)' }
        ],
        responseShape: {
            arrayKey: 'results',
            summary: 'Matching PS audit records.',
            fields: ['ps_record_id', 'ps_record_name', 'account_name', 'status', 'captured_at']
        },
        dependencies: ['ps-audit-trail'],
        reportEligible: true
    },

    // ───────────── Preserved: Product Updates ─────────────
    {
        id: 'preserved.product-updates.list',
        endpoint: '/api/product-update/requests',
        category: 'Preserved: Product Updates',
        sourceType: 'preserved',
        sourceRef: 'user-created',
        primarySource: 'product_update_requests table (user workflow data)',
        mcpToolName: 'get_product_update_requests',
        description: 'Product update requests with status tracking and approval workflow.',
        params: [
            { name: 'status', type: 'string', description: 'Filter: pending, approved, rejected, completed, cancelled', optional: true },
            { name: 'accountName', type: 'string', description: 'Filter by account name', optional: true },
            { name: 'requestedBy', type: 'string', description: 'Filter by the user who submitted the request', optional: true }
        ],
        responseShape: {
            arrayKey: 'requests',
            summary: 'List of product update requests.',
            fields: ['id', 'requestNumber', 'accountName', 'accountId', 'requestedBy', 'status', 'priority', 'requestType', 'region', 'changes', 'notes', 'createdAt', 'submittedAt', 'completedAt']
        },
        dependencies: [],
        reportEligible: true
    }
];

// Backward-compatibility map: old canonical ID → new canonical ID
const LEGACY_ID_MAP = {
    'analytics.request-types-week': 'derived.provisioning-analytics.request-types',
    'analytics.validation-trend': 'derived.provisioning-analytics.validation-trend',
    'analytics.completion-times': 'derived.provisioning-analytics.completion-times',
    'package-changes.summary': 'derived.package-changes.summary',
    'package-changes.by-product': 'derived.package-changes.by-product',
    'package-changes.by-account': 'derived.package-changes.by-account',
    'package-changes.recent': 'derived.package-changes.recent',
    'provisioning.list': 'primary.salesforce.provisioning-list',
    'provisioning.search': 'primary.salesforce.provisioning-search',
    'provisioning.validation-errors': 'primary.salesforce.validation-errors',
    'provisioning.removals': 'primary.salesforce.provisioning-removals',
    'expiration.monitor': 'derived.expiration.monitor',
    'expiration.status': 'derived.expiration.status',
    'expiration.expired-products': 'derived.expiration.expired-products',
    'customer-products.list': 'primary.salesforce.customer-products',
    'customer-products.update-requests': 'preserved.product-updates.list',
    'tenant-entitlements.suggest': 'primary.sml.entitlements-suggest',
    'tenant-entitlements.list': 'primary.sml.entitlements',
    'ghost-accounts.list': 'derived.ghost-accounts.list',
    'ghost-accounts.deprovisioned': 'derived.ghost-accounts.deprovisioned',
    'packages.list': 'primary.packages.list',
    'packages.stats': 'primary.packages.stats',
    'audit-trail.stats': 'preserved.audit-trail.stats',
    'audit-trail.search': 'preserved.audit-trail.search'
};

// ─────────────────────────────────────────────────────────────
//  Derived helpers
// ─────────────────────────────────────────────────────────────

function _resolveId(id) {
    return LEGACY_ID_MAP[id] || id;
}

function getAll() {
    return DATA_SOURCES;
}

function getById(id) {
    const resolved = _resolveId(id);
    return DATA_SOURCES.find(s => s.id === resolved) || null;
}

function getByEndpoint(endpoint) {
    return DATA_SOURCES.find(s => s.endpoint === endpoint) || null;
}

function isEndpointAllowed(endpoint) {
    return DATA_SOURCES.some(s => s.endpoint === endpoint && s.reportEligible);
}

function getReportEligible() {
    return DATA_SOURCES.filter(s => s.reportEligible);
}

function getByCategory() {
    const grouped = {};
    for (const source of DATA_SOURCES) {
        if (!grouped[source.category]) grouped[source.category] = [];
        grouped[source.category].push(source);
    }
    return grouped;
}

function getBySourceType(sourceType) {
    return DATA_SOURCES.filter(s => s.sourceType === sourceType);
}

function getBySourceRef(sourceRef) {
    return DATA_SOURCES.filter(s => s.sourceRef === sourceRef);
}

// ─────────────────────────────────────────────────────────────
//  MCP helpers — used by mcp-server/tools/ to import schemas
// ─────────────────────────────────────────────────────────────

function _buildJsonSchemaProps(params) {
    const properties = {};
    const required = [];

    for (const p of params) {
        const prop = { type: p.type, description: p.description };
        if (p.default !== undefined) prop.default = p.default;
        if (p.minimum !== undefined) prop.minimum = p.minimum;
        if (p.maximum !== undefined) prop.maximum = p.maximum;
        if (p.enum) prop.enum = p.enum;
        properties[p.name] = prop;
        if (p.required) required.push(p.name);
    }

    return { properties, required };
}

/**
 * Get MCP-compatible { name, description, inputSchema } for a data source.
 * Import this in MCP tool files instead of defining inputSchema inline.
 * Accepts both new IDs (e.g. 'primary.salesforce.provisioning-list')
 * and legacy IDs (e.g. 'provisioning.list') for backward compatibility.
 */
function getToolSchema(canonicalId) {
    const resolved = _resolveId(canonicalId);
    const source = DATA_SOURCES.find(s => s.id === resolved);
    if (!source) throw new Error(`Unknown canonical data source: ${canonicalId} (resolved: ${resolved})`);
    if (!source.mcpToolName) throw new Error(`Data source ${resolved} has no MCP tool mapping`);

    const { properties, required } = _buildJsonSchemaProps(source.params);
    const schema = { type: 'object', properties };
    if (required.length) schema.required = required;

    return {
        name: source.mcpToolName,
        description: source.description,
        inputSchema: schema
    };
}

/**
 * List all canonical entries that have an MCP tool mapping.
 */
function getMcpToolList() {
    return DATA_SOURCES
        .filter(s => s.mcpToolName)
        .map(s => ({ id: s.id, mcpToolName: s.mcpToolName, endpoint: s.endpoint }));
}

/**
 * List canonical entries that should have an MCP tool but don't yet.
 */
function getMissingMcpTools() {
    return DATA_SOURCES
        .filter(s => s.reportEligible && !s.mcpToolName)
        .map(s => ({ id: s.id, endpoint: s.endpoint, category: s.category }));
}

// ─────────────────────────────────────────────────────────────
//  OpenAI function-calling tool definition
// ─────────────────────────────────────────────────────────────

function _buildEndpointEnum() {
    const eligible = getReportEligible();
    return eligible.map(s => s.endpoint);
}

function _buildEndpointDescription() {
    const eligible = getReportEligible();
    const lines = eligible.map(s => {
        const sourceTag = s.sourceType === 'primary'
            ? `[PRIMARY: ${s.sourceRef}]`
            : s.sourceType === 'derived'
                ? `[DERIVED from ${s.sourceRef}]`
                : `[PRESERVED from ${s.sourceRef}]`;
        const filterParams = s.params.filter(p => p.name !== 'pageSize' && p.name !== 'offset' && p.name !== 'page');
        const paramHint = filterParams.length > 0
            ? ` Filter params: ${filterParams.map(p => `${p.name}${p.description ? ' (' + p.description + ')' : ''}`).join('; ')}.`
            : '';
        return `  ${s.endpoint}: ${sourceTag} ${s.description}${paramHint}`;
    });
    return 'API endpoint to fetch data from. Choose based on what the component ACTUALLY needs to show. ALWAYS pass filter params to narrow results — do NOT fetch all records and rely on client-side filtering.\n' + lines.join('\n');
}

function _buildEndpointFieldMap() {
    const eligible = getReportEligible();
    const lines = eligible.map(s => {
        const arrayInfo = s.responseShape.arrayKey
            ? `Data array key: "${s.responseShape.arrayKey}".`
            : 'Returns an object, not an array.';
        const paramNames = s.params.length > 0
            ? ` Params: ${s.params.map(p => p.required ? p.name + ' (required)' : p.name).join(', ')}.`
            : '';
        return `  ${s.endpoint}: ${arrayInfo} Fields: ${s.responseShape.fields.join(', ')}.${paramNames}`;
    });
    return lines.join('\n');
}

/**
 * Build the OpenAI tools array for the report-agent chat.
 * Returns two tools:
 *   1. generate_report_config — produces the JSON config
 *   2. describe_available_data — lets the LLM explore data sources by category and source type
 */
function buildOpenAITools() {
    const endpointEnum = _buildEndpointEnum();
    const endpointDesc = _buildEndpointDescription();

    const generateTool = {
        type: 'function',
        function: {
            name: 'generate_report_config',
            description: 'Generate a complete dashboard report configuration. Call this when you have gathered enough requirements from the user to propose a report. The configuration will be validated and previewed. If part of the user\'s request cannot be fulfilled by available data sources, produce only the components you CAN build correctly and explain the gaps in your text response.',
            parameters: {
                type: 'object',
                required: ['title', 'components'],
                properties: {
                    title: { type: 'string', description: 'Report title (1-255 chars)' },
                    description: { type: 'string', description: 'Report description (optional, max 1000 chars)' },
                    layout: { type: 'string', enum: VALID_LAYOUTS, description: 'Layout mode (default "grid")' },
                    filters: {
                        type: 'array',
                        description: 'Top-level filters (max 5). Filters apply globally to ALL components via mapsToParam.',
                        items: {
                            type: 'object',
                            required: ['id', 'type', 'label', 'mapsToParam'],
                            properties: {
                                id: { type: 'string' },
                                type: { type: 'string', enum: ['select', 'text', 'typeahead', 'date-range'] },
                                label: { type: 'string' },
                                options: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } } },
                                default: { type: 'string' },
                                mapsToParam: { type: 'string', description: 'Query parameter name sent to data endpoints' },
                                suggestEndpoint: { type: 'string' },
                                suggestParam: { type: 'string' },
                                suggestResultKey: { type: 'string' },
                                suggestDisplayField: { type: 'string' },
                                suggestSecondaryField: { type: 'string' }
                            }
                        }
                    },
                    components: {
                        type: 'array',
                        description: `1-${MAX_COMPONENTS} components. Each component fetches data from one endpoint and renders it.`,
                        items: {
                            type: 'object',
                            required: ['id', 'type', 'title', 'dataSource'],
                            properties: {
                                id: { type: 'string', description: 'Unique component ID (letters, numbers, hyphens, underscores)' },
                                type: { type: 'string', enum: VALID_COMPONENT_TYPES, description: 'Component type. Prefer "echarts" for charts and "ag-grid" for tables.' },
                                title: { type: 'string', description: 'Component title. MUST accurately describe the data being shown.' },
                                gridSpan: { type: 'number', description: 'Grid columns to span (1-3). Grid is 3 columns wide.' },
                                dataSource: {
                                    type: 'object',
                                    required: ['endpoint'],
                                    properties: {
                                        endpoint: {
                                            type: 'string',
                                            enum: endpointEnum,
                                            description: endpointDesc
                                        },
                                        params: { type: 'object', description: 'Query parameters to send to the endpoint' },
                                        linkedParams: { type: 'object', description: 'ONLY for row-click linking between components. Maps param name to a paramId from another component\'s onRowClick.' },
                                        arrayKey: { type: 'string', description: 'Key in the API response that contains the data array (e.g. "tenants", "products", "entitlements", "expirations"). Check the endpoint field reference for the correct value. If omitted, the system will try to auto-detect it.' },
                                        enrich: {
                                            type: 'object',
                                            description: 'Join data from a second endpoint onto primary rows. Use when a table needs fields from two different data sources (e.g., adding tenant_name from current-accounts to expiration data). The server fetches both endpoints and merges the results. IMPORTANT: For paginated enrichment endpoints like /api/current-accounts, pass params with a large pageSize (e.g. 1000) to ensure all rows are available for matching.',
                                            properties: {
                                                endpoint: { type: 'string', description: 'Second endpoint to fetch enrichment data from (must be in the data catalog)' },
                                                params: { type: 'object', description: 'Query parameters for the enrichment endpoint (e.g. { "pageSize": 1000 } for paginated endpoints)' },
                                                arrayKey: { type: 'string', description: 'Key in the enrichment response containing the data array' },
                                                sourceField: { type: 'string', description: 'Dot-path field in the PRIMARY data row to use as the join key (e.g. "account.name")' },
                                                matchField: { type: 'string', description: 'Field in the ENRICHMENT data to match against sourceField (e.g. "client")' },
                                                fields: { type: 'array', items: { type: 'string' }, description: 'Fields to copy from the matched enrichment row onto each primary row (e.g. ["tenant_name", "tenant_id"])' }
                                            },
                                            required: ['endpoint', 'sourceField', 'matchField', 'fields']
                                        }
                                    }
                                },
                                valueField: { type: 'string', description: 'Dot-path to the value in the response (kpi-card)' },
                                format: { type: 'string', enum: VALID_FORMATS },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                option: { type: 'object', description: 'ECharts option object. Use dataset + encode pattern. NEVER include JS functions.' },
                                columnDefs: { type: 'array', description: 'AG Grid column definitions', items: { type: 'object', properties: { field: { type: 'string', description: 'Dot-path to a field in the data. If the field resolves to an array, values are auto-joined with ", ".' }, headerName: { type: 'string' }, sortable: { type: 'boolean' }, filter: { type: 'boolean' }, format: { type: 'string', enum: VALID_FORMATS }, flex: { type: 'number' }, valueFields: { type: 'array', items: { type: 'string' }, description: 'Merge multiple dot-paths into one column. Values from each path are resolved (arrays flattened) and joined. Use instead of "field" when data is spread across multiple nested paths (e.g. ["expiringProducts.models", "expiringProducts.data", "expiringProducts.apps"]).' }, separator: { type: 'string', description: 'Join separator for valueFields (default ", ")' }, displayField: { type: 'string', description: 'When valueFields resolve to arrays of objects, extract this property for display (e.g. "productCode"). If omitted, auto-detects: tries name, code, productCode, label, id.' } } } },
                                columns: { type: 'array', description: 'data-table columns', items: { type: 'object', properties: { field: { type: 'string', description: 'Dot-path to a field. Arrays are auto-joined.' }, header: { type: 'string' }, format: { type: 'string', enum: VALID_FORMATS }, valueFields: { type: 'array', items: { type: 'string' }, description: 'Merge multiple dot-paths into one column (same as AG Grid valueFields).' }, separator: { type: 'string', description: 'Join separator (default ", ")' }, displayField: { type: 'string', description: 'Property to extract from objects in arrays (e.g. "productCode").' } } } },
                                defaultColDef: { type: 'object' },
                                pageSize: { type: 'number' },
                                pagination: { type: 'boolean' },
                                searchable: { type: 'boolean' },
                                onRowClick: { type: 'object', properties: { paramId: { type: 'string' }, valueField: { type: 'string' } } },
                                conditionalFormatting: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            field: { type: 'string' },
                                            operator: { type: 'string', enum: VALID_CF_OPERATORS },
                                            value: {},
                                            style: { type: 'string', enum: VALID_CF_STYLES }
                                        }
                                    }
                                },
                                xField: { type: 'string' },
                                yField: { type: 'string' },
                                colors: { type: 'array', items: { type: 'string' } },
                                stacked: { type: 'boolean' },
                                horizontal: { type: 'boolean' },
                                fill: { type: 'boolean' },
                                labelField: { type: 'string' },
                                doughnut: { type: 'boolean' }
                            }
                        }
                    }
                }
            }
        }
    };

    const categories = [...new Set(DATA_SOURCES.filter(s => s.reportEligible).map(s => s.category))];

    const describeTool = {
        type: 'function',
        function: {
            name: 'describe_available_data',
            description: 'Get detailed information about available data sources before building a report. Call this when you need to understand what endpoints are available, what fields they return, or what parameters they accept. You can filter by category or source type to narrow results. Source types: "primary" (direct from external systems), "derived" (computed/cached locally), "preserved" (captured because ephemeral in source).',
            parameters: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        enum: categories,
                        description: 'Filter by data category. Omit to see all categories.'
                    },
                    sourceType: {
                        type: 'string',
                        enum: SOURCE_TYPES,
                        description: 'Filter by source type: "primary", "derived", or "preserved". Omit to see all types.'
                    }
                }
            }
        }
    };

    const fetchTool = {
        type: 'function',
        function: {
            name: 'fetch_endpoint_data',
            description: 'Fetch LIVE data from an API endpoint to see what it actually returns. Use this BEFORE calling generate_report_config so you can verify record counts, inspect field names, and confirm data exists. Returns a summarized preview (first 5 records, total count, summary stats, and field types). You should call this whenever you need to: (1) verify an endpoint has data, (2) check how many records exist, (3) inspect actual field values to choose correct field mappings, or (4) understand the response structure.',
            parameters: {
                type: 'object',
                required: ['endpoint'],
                properties: {
                    endpoint: {
                        type: 'string',
                        enum: endpointEnum,
                        description: 'API endpoint to query. Same endpoints available as in generate_report_config.'
                    },
                    params: {
                        type: 'object',
                        description: 'Query parameters to send (e.g. { "expirationWindow": 90, "timeFrame": "1y" }). Use these to control the data scope.'
                    }
                }
            }
        }
    };

    return [generateTool, describeTool, fetchTool];
}

/**
 * Summarize raw API response data for the LLM.
 * Keeps token usage manageable while giving the LLM enough to make informed decisions.
 */
function summarizeEndpointData(rawResponse, endpoint) {
    const source = getByEndpoint(endpoint);
    const arrayKey = source?.responseShape?.arrayKey;

    const result = {
        endpoint,
        responseKeys: Object.keys(rawResponse || {}),
        totalRecords: null,
        totalAvailable: null,
        hasMore: null,
        sampleRecords: null,
        summary: null,
        fieldTypes: null,
        paginationWarning: null
    };

    if (rawResponse?.summary) {
        result.summary = rawResponse.summary;
    }

    if (arrayKey && Array.isArray(rawResponse?.[arrayKey])) {
        const arr = rawResponse[arrayKey];
        result.totalRecords = arr.length;
        result.sampleRecords = arr.slice(0, 5);

        const serverTotal = rawResponse.total ?? rawResponse.totalSize ?? rawResponse.totalCount ?? null;
        if (serverTotal != null) {
            result.totalAvailable = serverTotal;
        }
        if (rawResponse.hasMore != null) {
            result.hasMore = rawResponse.hasMore;
        }
        if (result.hasMore || (serverTotal != null && serverTotal > arr.length)) {
            result.paginationWarning = `Only ${arr.length} of ${serverTotal ?? 'more'} records returned. Set pageSize=${serverTotal || arr.length * 2} in your report config params to get all records.`;
        }

        if (arr.length > 0) {
            result.fieldTypes = {};
            const sample = arr[0];
            for (const [key, val] of Object.entries(sample)) {
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    for (const [subKey, subVal] of Object.entries(val)) {
                        result.fieldTypes[`${key}.${subKey}`] = typeof subVal;
                    }
                } else {
                    result.fieldTypes[key] = Array.isArray(val) ? 'array' : typeof val;
                }
            }
        }
    } else if (!arrayKey) {
        result.totalRecords = 1;
        result.sampleRecords = [rawResponse];
        result.fieldTypes = {};
        for (const [key, val] of Object.entries(rawResponse || {})) {
            result.fieldTypes[key] = Array.isArray(val) ? 'array' : typeof val;
        }
    }

    return result;
}

/**
 * Handle a describe_available_data tool call — return catalog info with source lineage.
 */
function handleDescribeData(args) {
    let eligible = getReportEligible();

    if (args.category) {
        eligible = eligible.filter(s => s.category === args.category);
    }
    if (args.sourceType) {
        eligible = eligible.filter(s => s.sourceType === args.sourceType);
    }

    return eligible.map(s => ({
        endpoint: s.endpoint,
        category: s.category,
        sourceType: s.sourceType,
        sourceRef: s.sourceRef,
        primarySource: s.primarySource,
        description: s.description,
        params: s.params.map(p => ({
            name: p.name,
            type: p.type,
            description: p.description,
            required: !!p.required,
            default: p.default
        })),
        responseFields: s.responseShape.fields,
        responseArrayKey: s.responseShape.arrayKey,
        note: s.responseShape.note || null,
        dependencies: s.dependencies
    }));
}

// ─────────────────────────────────────────────────────────────
//  Legacy compatibility — replaces report-data-catalog.js
// ─────────────────────────────────────────────────────────────

function getDataCatalog() {
    return DATA_SOURCES.map(s => ({
        id: s.id,
        endpoint: s.endpoint,
        category: s.category,
        sourceType: s.sourceType,
        sourceRef: s.sourceRef,
        primarySource: s.primarySource,
        description: s.description,
        params: s.params,
        responseShape: s.responseShape
    }));
}

function getDataCatalogByCategory() {
    const catalog = getDataCatalog();
    const grouped = {};
    for (const source of catalog) {
        if (!grouped[source.category]) grouped[source.category] = [];
        grouped[source.category].push(source);
    }
    return grouped;
}

function getCatalogEntry(id) {
    return getById(id);
}

/**
 * Validate that required params are present for the given endpoint.
 * Returns an array of error messages (empty if valid).
 * Checks: required params, requireOneOf groups.
 * Skips params covered by linkedParams (filled at render time via row clicks).
 */
function validateEndpointParams(endpoint, params = {}, linkedParams = {}) {
    const source = getByEndpoint(endpoint);
    if (!source) return [];

    const errors = [];
    const allProvided = { ...params };
    for (const [paramName] of Object.entries(linkedParams)) {
        allProvided[paramName] = '__linked__';
    }

    for (const p of (source.params || [])) {
        if (p.required && !p.optional && allProvided[p.name] == null) {
            errors.push(`Endpoint ${endpoint} requires parameter "${p.name}"`);
        }
    }

    if (source.requireOneOf && source.requireOneOf.length > 0) {
        const hasOne = source.requireOneOf.some(name => allProvided[name] != null);
        if (!hasOne) {
            errors.push(`Endpoint ${endpoint} requires at least one of: ${source.requireOneOf.join(', ')}`);
        }
    }

    return errors;
}

module.exports = {
    DATA_SOURCES,
    SOURCE_TYPES,
    LEGACY_ID_MAP,
    getAll,
    getById,
    getByEndpoint,
    isEndpointAllowed,
    getReportEligible,
    getByCategory,
    getBySourceType,
    getBySourceRef,
    getToolSchema,
    getMcpToolList,
    getMissingMcpTools,
    buildOpenAITools,
    handleDescribeData,
    summarizeEndpointData,
    getDataCatalog,
    getDataCatalogByCategory,
    getCatalogEntry,
    validateEndpointParams,
    _buildEndpointFieldMap
};
