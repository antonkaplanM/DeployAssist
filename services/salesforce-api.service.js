/**
 * Salesforce API Service  
 * Business logic for Salesforce OAuth, Analytics, and Provisioning
 */

const salesforce = require('../salesforce');
const db = require('../database');
const logger = require('../utils/logger');
const { BadRequestError, UnauthorizedError, InternalServerError } = require('../middleware/error-handler');

class SalesforceApiService {
    /**
     * Get Salesforce OAuth authorization URL
     * @returns {String} Authorization URL
     */
    getAuthUrl() {
        return salesforce.getAuthUrl();
    }

    /**
     * Handle Salesforce OAuth callback
     * @param {String} code - Authorization code
     * @returns {Promise<Object>} Authentication result
     */
    async handleOAuthCallback(code) {
        if (!code) {
            throw new BadRequestError('No authorization code received');
        }

        const result = await salesforce.handleOAuthCallback(code);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Authentication failed');
        }

        return {
            message: 'Salesforce authentication successful!',
            organizationId: result.organizationId,
            instanceUrl: result.instanceUrl
        };
    }

    /**
     * Get validation failure trend
     * @param {Number} months - Number of months to look back
     * @param {Array} enabledRuleIds - Enabled validation rule IDs
     * @returns {Promise<Object>} Trend data
     */
    async getValidationTrend(months = 3, enabledRuleIds = null) {
        // Calculate time period
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - months);

        // Get enabled rules if not provided
        if (!enabledRuleIds) {
            const validationEngine = require('../validation-engine');
            enabledRuleIds = validationEngine.getEnabledValidationRules().map(r => r.id);
        }

        const result = await salesforce.getValidationFailureTrend(startDate, endDate, enabledRuleIds);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch validation trend');
        }

        return {
            trendData: result.trendData,
            period: result.period
        };
    }

    /**
     * Get weekly request type analytics
     * @param {Number} months - Number of months to look back
     * @param {Array} enabledRuleIds - Enabled validation rule IDs
     * @returns {Promise<Object>} Analytics data
     */
    async getRequestTypesAnalytics(months = 12, enabledRuleIds = null) {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - months);

        // Get enabled rules if not provided
        if (!enabledRuleIds) {
            const validationEngine = require('../validation-engine');
            enabledRuleIds = validationEngine.getEnabledValidationRules().map(r => r.id);
        }

        logger.info(`Analytics using ${enabledRuleIds.length} enabled validation rules`);

        const result = await salesforce.getWeeklyRequestTypeAnalytics(startDate, endDate, enabledRuleIds);
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch analytics data');
        }

        return {
            data: result.data,
            period: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            }
        };
    }

    /**
     * Get weekly provisioning completion times
     * @returns {Promise<Object>} Completion time statistics
     */
    async getCompletionTimes() {
        // Starting point: Monday Oct 13, 2025
        const startDate = new Date('2025-10-13');

        const query = `
            WITH first_appearance AS (
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    captured_at as first_seen_at,
                    status as first_status
                FROM ps_audit_trail
                WHERE captured_at >= $1
                ORDER BY ps_record_id, captured_at ASC
            ),
            completed_records AS (
                SELECT DISTINCT 
                    ps_record_id,
                    ps_record_name,
                    MIN(captured_at) FILTER (WHERE status = 'Tenant Request Completed') as completed_at
                FROM ps_audit_trail
                WHERE captured_at >= $1
                    AND status = 'Tenant Request Completed'
                GROUP BY ps_record_id, ps_record_name
            ),
            completion_times AS (
                SELECT 
                    cr.ps_record_id,
                    cr.ps_record_name,
                    cr.completed_at,
                    fa.first_seen_at,
                    EXTRACT(EPOCH FROM (cr.completed_at - fa.first_seen_at)) / 3600 as hours_to_complete,
                    DATE_TRUNC('week', cr.completed_at::date)::date as week_start
                FROM completed_records cr
                INNER JOIN first_appearance fa ON cr.ps_record_id = fa.ps_record_id
                WHERE cr.completed_at IS NOT NULL
                    AND fa.first_seen_at IS NOT NULL
                    AND cr.completed_at >= $1
                    AND fa.first_status != 'Tenant Request Completed'
                    AND cr.completed_at > fa.first_seen_at
            )
            SELECT 
                week_start,
                COUNT(*) as completed_count,
                AVG(hours_to_complete) as avg_hours,
                MIN(hours_to_complete) as min_hours,
                MAX(hours_to_complete) as max_hours,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_complete) as median_hours,
                STRING_AGG(ps_record_name, ', ' ORDER BY ps_record_name) as ps_records
            FROM completion_times
            WHERE week_start >= $1::date
            GROUP BY week_start
            ORDER BY week_start ASC;
        `;

        const result = await db.query(query, [startDate]);

        logger.info(`Completion times query returned ${result.rows.length} weeks`);

        // Format data for chart
        const chartData = result.rows.map(row => ({
            weekStart: row.week_start,
            weekLabel: this._formatWeekLabel(new Date(row.week_start)),
            avgHours: parseFloat(row.avg_hours || 0),
            avgDays: parseFloat((row.avg_hours || 0) / 24).toFixed(2),
            completedCount: parseInt(row.completed_count),
            minHours: parseFloat(row.min_hours || 0),
            maxHours: parseFloat(row.max_hours || 0),
            medianHours: parseFloat(row.median_hours || 0),
            psRecords: row.ps_records
        }));

        const now = new Date();

        return {
            data: chartData,
            period: {
                startDate: startDate.toISOString(),
                endDate: now.toISOString()
            }
        };
    }

    /**
     * Get provisioning requests (list with pagination)
     * @param {Number} pageSize - Maximum results per page
     * @param {Number} offset - Pagination offset
     * @param {Object} additionalFilters - Additional filter parameters
     * @returns {Promise<Object>} Provisioning requests
     */
    async getProvisioningRequests(pageSize = 25, offset = 0, additionalFilters = {}) {
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication');
            return {
                records: [],
                totalCount: 0,
                hasMore: false,
                note: 'No Salesforce authentication - please configure in Settings'
            };
        }

        logger.info(`Fetching PS requests (pageSize: ${pageSize}, offset: ${offset})`);

        const filters = {
            pageSize,
            offset,
            ...additionalFilters
        };

        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });

        const result = await salesforce.queryProfServicesRequests(filters);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch provisioning requests');
        }

        return {
            records: result.records,
            totalCount: result.totalCount,
            pageSize: result.pageSize,
            offset: result.offset,
            hasMore: result.hasMore,
            currentPage: result.currentPage,
            totalPages: result.totalPages
        };
    }

    /**
     * Search provisioning requests
     * @param {String} searchTerm - Search term
     * @param {Number} limit - Max results (optional)
     * @returns {Promise<Object>} Search results
     */
    async searchProvisioningRequests(searchTerm, limit = 20) {
        if (!searchTerm || searchTerm.trim().length === 0) {
            throw new BadRequestError('Search term is required');
        }

        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication');
            return {
                results: {
                    technicalRequests: [],
                    accounts: [],
                    totalCount: 0
                }
            };
        }

        logger.info(`Searching provisioning data: "${searchTerm}"`);

        const result = await salesforce.searchProvisioningData(searchTerm, limit);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to search provisioning data');
        }

        return result.results;
    }

    /**
     * Get a specific provisioning request by ID
     * @param {String} id - Request ID
     * @returns {Promise<Object>} Request details
     */
    async getProvisioningRequestById(id) {
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            throw new UnauthorizedError('No Salesforce authentication available');
        }

        logger.info(`Fetching PS request details: ${id}`);

        const result = await salesforce.getProfServicesRequestById(id);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch request details');
        }

        return {
            request: result.record
        };
    }

    /**
     * Get provisioning filter options
     * @returns {Promise<Object>} Filter options
     */
    async getProvisioningFilterOptions() {
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication');
            return {
                statuses: [],
                requestTypes: [],
                note: 'No Salesforce authentication'
            };
        }

        const result = await salesforce.getProfServicesFilterOptions();

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch filter options');
        }

        return {
            statuses: result.statuses,
            requestTypes: result.requestTypes
        };
    }

    /**
     * Get new provisioning records since a timestamp
     * @param {String} sinceTimestamp - ISO timestamp
     * @returns {Promise<Object>} New records
     */
    async getNewProvisioningRecords(sinceTimestamp) {
        if (!sinceTimestamp) {
            throw new BadRequestError('Missing "since" timestamp parameter');
        }

        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return {
                newRecords: [],
                totalNew: 0,
                checkTimestamp: new Date().toISOString(),
                note: 'No Salesforce authentication'
            };
        }

        logger.info(`Checking for new PS records since ${sinceTimestamp}`);

        // Query for new records created after the provided timestamp
        const conn = await salesforce.getConnection();

        // Convert ISO timestamp to Salesforce datetime format
        const sinceDate = new Date(sinceTimestamp);
        const soqlTimestamp = sinceDate.toISOString().replace('.000Z', 'Z');

        const soqlQuery = `
            SELECT Id, Name, TenantRequestAction__c, Account__c, Account_Site__c, 
                   Status__c, CreatedDate, LastModifiedDate
            FROM Prof_Services_Request__c
            WHERE CreatedDate > ${soqlTimestamp}
            ORDER BY CreatedDate DESC
            LIMIT 10
        `;

        const result = await conn.query(soqlQuery);
        const records = result.records || [];

        logger.info(`Found ${records.length} new PS record(s) since ${sinceTimestamp}`);

        // Format records for notification display
        const newRecords = records.map(record => ({
            id: record.Id,
            name: record.Name,
            requestType: record.TenantRequestAction__c || 'Unknown',
            account: record.Account__c,
            accountSite: record.Account_Site__c,
            status: record.Status__c,
            createdDate: record.CreatedDate
        }));

        return {
            newRecords: newRecords,
            totalNew: newRecords.length,
            checkTimestamp: new Date().toISOString()
        };
    }

    /**
     * Get PS requests with product removals
     * @param {String} timeFrame - Time frame (e.g., '1w', '1m')
     * @returns {Promise<Object>} Removal requests
     */
    async getProvisioningRemovals(timeFrame = '1w') {
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication');
            return {
                requests: [],
                totalCount: 0,
                timeFrame: timeFrame,
                startDate: new Date().toISOString().split('T')[0],
                note: 'No Salesforce authentication - please configure in Settings'
            };
        }

        logger.info(`Fetching PS requests with removals (${timeFrame})`);

        const result = await salesforce.getPSRequestsWithRemovals(timeFrame);

        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch PS requests with removals');
        }

        return {
            requests: result.requests,
            totalCount: result.totalCount,
            timeFrame: result.timeFrame,
            startDate: result.startDate
        };
    }

    /**
     * Helper: Format week label for display
     * @param {Date} date - Week start date
     * @returns {String} Formatted week label
     */
    _formatWeekLabel(date) {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
    }
}

module.exports = new SalesforceApiService();

