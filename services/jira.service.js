/**
 * Jira Service
 * Handles Jira API integration for fetching initiatives
 */

const { makeHttpsRequest } = require('../utils/https-client');
const { sanitizeForJql } = require('../utils/sanitizer');
const logger = require('../utils/logger');

class JiraService {
    constructor() {
        this.config = {
            email: process.env.ATLASSIAN_EMAIL,
            apiToken: process.env.ATLASSIAN_API_TOKEN,
            cloudId: process.env.ATLASSIAN_CLOUD_ID,
            baseUrl: process.env.ATLASSIAN_BASE_URL || 'https://api.atlassian.com/ex/jira',
            siteUrl: process.env.ATLASSIAN_SITE_URL || 'https://yoursite.atlassian.net'
        };
    }

    /**
     * Check for missing required environment variables
     * @returns {Array} Array of missing variable names
     */
    getMissingEnvVars() {
        const required = ['ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'ATLASSIAN_SITE_URL'];
        return required.filter(key => !process.env[key]);
    }

    /**
     * Fetch Jira initiatives for an assignee
     * @param {String} assigneeName - Name of assignee to search for
     * @returns {Promise<Object>} Response with issues or error
     */
    async fetchInitiatives(assigneeName) {
        try {
            logger.info('Fetching Jira initiatives', { assigneeName });
            
            // Ensure required env vars are present
            const missing = this.getMissingEnvVars();
            if (missing.length > 0) {
                logger.warn('Missing Atlassian environment variables', { missing });
                return {
                    issues: [],
                    total: 0,
                    success: false,
                    error: `Missing environment variables: ${missing.join(', ')}`
                };
            }
            
            // Build JQL query for assignee name
            const jqlQuery = this.buildJQLQuery(assigneeName);
            logger.debug('Built JQL query', { jqlQuery });
            
            // Prepare the API request
            const searchUrl = `${this.config.siteUrl}/rest/api/3/search/jql`;
            const requestBody = {
                jql: jqlQuery,
                fields: ['summary', 'description', 'status', 'issuetype', 'priority', 'created', 'updated', 'project', 'assignee'],
                maxResults: 100
            };
            
            // Create authentication header (Basic auth with email:token)
            const authString = `${this.config.email}:${this.config.apiToken}`;
            const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
            
            logger.info('Making request to Atlassian API', { url: searchUrl });
            
            // Make the HTTPS request
            const result = await makeHttpsRequest(searchUrl, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (result.success && result.data && result.data.issues) {
                logger.info('Successfully fetched issues from Atlassian API', {
                    count: result.data.issues.length,
                    assigneeName
                });
                
                // Transform the API response
                const transformedIssues = this.transformIssues(result.data.issues, assigneeName);
                
                return {
                    issues: transformedIssues,
                    total: transformedIssues.length,
                    success: true
                };
            } else {
                logger.warn('API request failed or returned no data', {
                    error: result.error,
                    assigneeName
                });
                return {
                    issues: [],
                    total: 0,
                    success: false,
                    error: result.error || 'No data returned from API'
                };
            }
            
        } catch (error) {
            logger.error('Error fetching Jira initiatives', {
                error: error.message,
                assigneeName
            });
            return {
                issues: [],
                total: 0,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Build JQL query for searching initiatives
     * @param {String} assigneeName - Assignee name
     * @returns {String} JQL query string
     */
    buildJQLQuery(assigneeName) {
        if (assigneeName) {
            const safeAssignee = sanitizeForJql(assigneeName);
            return `assignee in ("${safeAssignee}") AND (issuetype = "Initiative" OR issuetype = "Epic" OR issuetype = "Story" OR issuetype = "Task")`;
        }
        
        // Fallback query
        return 'issuetype = "Initiative" OR issuetype = "Epic"';
    }

    /**
     * Transform API issues to our format
     * @param {Array} issues - Raw issues from API
     * @param {String} assigneeName - Assignee name for fallback
     * @returns {Array} Transformed issues
     */
    transformIssues(issues, assigneeName) {
        return issues.map(issue => ({
            key: issue.key,
            summary: issue.fields.summary || 'No summary',
            status: issue.fields.status?.name || 'Unknown',
            created: issue.fields.created || new Date().toISOString(),
            updated: issue.fields.updated || new Date().toISOString(),
            project: issue.fields.project?.name || 'Unknown Project',
            priority: issue.fields.priority?.name || 'Medium',
            issuetype: issue.fields.issuetype?.name || 'Issue',
            assignee: issue.fields.assignee?.displayName || assigneeName || 'Unassigned',
            description: issue.fields.description || 'No description available'
        }));
    }

    /**
     * Get fallback initiatives when API is unavailable
     * @param {String} assigneeName - Assignee name
     * @returns {Array} Fallback initiatives
     */
    getFallbackInitiatives(assigneeName = 'Default User') {
        return [
            {
                key: 'PLAN-770',
                summary: 'Multi-factor Authentication (MFA) for IRP tenants',
                status: 'Open',
                created: '2025-08-12T11:25:16.776-0700',
                updated: '2025-08-12T11:27:46.266-0700',
                project: 'Strategy',
                assignee: assigneeName,
                description: `FALLBACK: MFA implementation for IRP tenants with SSOv2 migration. Assigned to ${assigneeName}.`
            },
            {
                key: 'PLAN-734',
                summary: 'IRP Provisioning / Entitlement / Telemetry for Praedicat',
                status: 'Proposed',
                created: '2025-04-25T14:44:16.183-0700',
                updated: '2025-06-17T16:02:06.928-0700',
                project: 'Strategy',
                assignee: assigneeName,
                description: `FALLBACK: Cometa integration onto IRP for Praedicat products. Assigned to ${assigneeName}.`
            },
            {
                key: 'PLAN-684',
                summary: 'IRP Platform Job Management',
                status: 'Proposed',
                created: '2025-03-24T12:56:30.187-0700',
                updated: '2025-07-15T08:51:36.109-0700',
                project: 'Strategy',
                assignee: assigneeName,
                description: `FALLBACK: Enhanced job management and scheduling capabilities. Assigned to ${assigneeName}.`
            }
        ];
    }
}

module.exports = JiraService;


