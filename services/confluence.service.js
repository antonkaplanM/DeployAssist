/**
 * Confluence Service
 * Handles Confluence API integration for publishing content
 */

const { makeHttpsRequest } = require('../utils/https-client');
const logger = require('../utils/logger');

class ConfluenceService {
    constructor() {
        this.config = {
            email: process.env.ATLASSIAN_EMAIL,
            apiToken: process.env.ATLASSIAN_API_TOKEN,
            siteUrl: process.env.ATLASSIAN_SITE_URL || 'https://yoursite.atlassian.net',
            // Default space ID (not key) for personal space
            defaultSpaceId: process.env.CONFLUENCE_SPACE_ID || '71202084b0c0d62c364df5b68d111f1d4f9bf1',
            // Known page IDs for direct updates (more reliable)
            knownPages: {
                'Current Accounts': process.env.CONFLUENCE_CURRENT_ACCOUNTS_PAGE_ID || '3701506049'
            }
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
     * Get authentication header for Atlassian API
     * @returns {string} Base64 encoded auth header
     */
    getAuthHeader() {
        const authString = `${this.config.email}:${this.config.apiToken}`;
        return `Basic ${Buffer.from(authString).toString('base64')}`;
    }

    /**
     * Get a page by its ID
     * @param {string} pageId - Confluence page ID
     * @returns {Promise<Object|null>} Page object or null if not found
     */
    async getPageById(pageId) {
        try {
            const pageUrl = `${this.config.siteUrl}/wiki/rest/api/content/${pageId}?expand=version`;
            
            logger.info('Fetching Confluence page by ID', { pageId });
            
            const result = await makeHttpsRequest(pageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            if (result.success && result.data) {
                logger.info('Found page', { 
                    pageId: result.data.id, 
                    title: result.data.title,
                    version: result.data.version?.number 
                });
                return result.data;
            }
            
            return null;
        } catch (error) {
            logger.error('Error fetching Confluence page by ID', { error: error.message, pageId });
            return null;
        }
    }

    /**
     * Search for an existing page by title in a space
     * @param {string} spaceKey - Confluence space key
     * @param {string} title - Page title to search for
     * @returns {Promise<Object|null>} Page object or null if not found
     */
    async findPageByTitle(spaceKey, title) {
        try {
            const searchUrl = `${this.config.siteUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(title)}&expand=version`;
            
            logger.info('Searching for Confluence page', { spaceKey, title });
            
            const result = await makeHttpsRequest(searchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json'
                }
            });

            if (result.success && result.data && result.data.results && result.data.results.length > 0) {
                return result.data.results[0];
            }
            
            return null;
        } catch (error) {
            logger.error('Error searching for Confluence page', { error: error.message });
            return null;
        }
    }

    /**
     * Create a new Confluence page
     * @param {string} spaceKey - Confluence space key
     * @param {string} title - Page title
     * @param {string} htmlContent - HTML content for the page
     * @returns {Promise<Object>} Result with page info
     */
    async createPage(spaceKey, title, htmlContent) {
        try {
            const createUrl = `${this.config.siteUrl}/wiki/rest/api/content`;
            
            const requestBody = {
                type: 'page',
                title: title,
                space: { key: spaceKey },
                body: {
                    storage: {
                        value: htmlContent,
                        representation: 'storage'
                    }
                }
            };

            logger.info('Creating new Confluence page', { spaceKey, title });
            
            const result = await makeHttpsRequest(createUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (result.success && result.data) {
                const pageUrl = `${this.config.siteUrl}/wiki${result.data._links?.webui || `/spaces/${spaceKey}/pages/${result.data.id}`}`;
                return {
                    success: true,
                    pageId: result.data.id,
                    pageUrl: pageUrl,
                    title: result.data.title,
                    created: true
                };
            }

            return {
                success: false,
                error: result.error || 'Failed to create page'
            };
        } catch (error) {
            logger.error('Error creating Confluence page', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update an existing Confluence page
     * @param {string} pageId - Confluence page ID
     * @param {string} title - Page title
     * @param {string} htmlContent - HTML content for the page
     * @param {number} currentVersion - Current page version number
     * @returns {Promise<Object>} Result with page info
     */
    async updatePage(pageId, title, htmlContent, currentVersion) {
        try {
            const updateUrl = `${this.config.siteUrl}/wiki/rest/api/content/${pageId}`;
            
            const requestBody = {
                type: 'page',
                title: title,
                version: {
                    number: currentVersion + 1
                },
                body: {
                    storage: {
                        value: htmlContent,
                        representation: 'storage'
                    }
                }
            };

            logger.info('Updating Confluence page', { pageId, title, newVersion: currentVersion + 1 });
            
            const result = await makeHttpsRequest(updateUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': this.getAuthHeader(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (result.success && result.data) {
                const pageUrl = `${this.config.siteUrl}/wiki${result.data._links?.webui || `/pages/${result.data.id}`}`;
                return {
                    success: true,
                    pageId: result.data.id,
                    pageUrl: pageUrl,
                    title: result.data.title,
                    version: result.data.version?.number,
                    updated: true
                };
            }

            return {
                success: false,
                error: result.error || 'Failed to update page'
            };
        } catch (error) {
            logger.error('Error updating Confluence page', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Publish or update a Confluence page (updates by ID if known, otherwise searches by title)
     * @param {string} spaceKey - Confluence space key (used for creating new pages)
     * @param {string} title - Page title
     * @param {string} htmlContent - HTML content for the page
     * @param {string} pageId - Optional page ID for direct update (most reliable)
     * @returns {Promise<Object>} Result with page info
     */
    async publishPage(spaceKey, title, htmlContent, pageId = null) {
        try {
            // Check for missing env vars
            const missing = this.getMissingEnvVars();
            if (missing.length > 0) {
                return {
                    success: false,
                    error: `Missing environment variables: ${missing.join(', ')}. Please configure Atlassian integration.`
                };
            }

            // Use provided pageId, or look up from known pages, or fall back to search
            let targetPageId = pageId || this.config.knownPages[title];
            let existingPage = null;

            if (targetPageId) {
                // Direct lookup by ID (most reliable)
                logger.info('Using known page ID for update', { pageId: targetPageId, title });
                existingPage = await this.getPageById(targetPageId);
            }
            
            if (!existingPage && spaceKey) {
                // Fall back to searching by title
                logger.info('No known page ID, searching by title', { spaceKey, title });
                existingPage = await this.findPageByTitle(spaceKey, title);
            }
            
            if (existingPage) {
                // Update existing page
                logger.info('Found existing page, updating', { 
                    pageId: existingPage.id, 
                    title: existingPage.title,
                    version: existingPage.version?.number 
                });
                return await this.updatePage(
                    existingPage.id,
                    title,
                    htmlContent,
                    existingPage.version?.number || 1
                );
            } else if (spaceKey) {
                // Create new page (only if spaceKey provided)
                logger.info('Page not found, creating new page');
                return await this.createPage(spaceKey, title, htmlContent);
            } else {
                return {
                    success: false,
                    error: `Page "${title}" not found and no space key provided to create it.`
                };
            }
        } catch (error) {
            logger.error('Error publishing to Confluence', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate HTML table from current accounts data
     * @param {Array} accounts - Array of account objects
     * @param {Object} stats - Statistics about the data
     * @returns {string} HTML content for Confluence
     */
    generateCurrentAccountsHTML(accounts, stats = {}) {
        const timestamp = new Date().toLocaleString();
        
        // Pre-sort accounts by completion_date descending (latest first)
        // Accounts without completion_date go to the bottom
        const sortedAccounts = [...accounts].sort((a, b) => {
            const dateA = a.completion_date ? new Date(a.completion_date) : null;
            const dateB = b.completion_date ? new Date(b.completion_date) : null;
            
            // If both have dates, sort descending (latest first)
            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            // If only A has a date, A comes first
            if (dateA && !dateB) return -1;
            // If only B has a date, B comes first
            if (!dateA && dateB) return 1;
            // If neither has a date, sort by client name as fallback
            return (a.client || '').localeCompare(b.client || '');
        });
        
        // Build statistics panel
        const statsHtml = `
            <ac:structured-macro ac:name="info">
                <ac:rich-text-body>
                    <p><strong>Last Updated:</strong> ${timestamp}</p>
                    <p><strong>Total Records:</strong> ${stats.totalCount || accounts.length}</p>
                    <p><strong>Active Records:</strong> ${stats.activeCount || accounts.length}</p>
                    <p><strong>Unique Clients:</strong> ${stats.uniqueClients || '—'}</p>
                    <p><strong>Unique Tenants:</strong> ${stats.uniqueTenants || '—'}</p>
                </ac:rich-text-body>
            </ac:structured-macro>
        `;

        // Build simple table header - let Confluence handle column sizing naturally
        const tableHeader = `
            <tr>
                <th>Client</th>
                <th>Services</th>
                <th>Type</th>
                <th>CSM/Owner</th>
                <th>PS Record</th>
                <th>Completed</th>
                <th>Size</th>
                <th>Region</th>
                <th>Tenant</th>
                <th>Tenant ID</th>
                <th>SF Account ID</th>
                <th>Tenant URL</th>
                <th>Admin</th>
                <th>Comments</th>
            </tr>
        `;

        // Build table rows - using natural word wrap, minimal columns for readability
        const tableRows = sortedAccounts.map(account => {
            const completionDate = account.completion_date 
                ? new Date(account.completion_date).toLocaleDateString() 
                : '—';
            
            // Type with Confluence status macro for visual distinction
            const typeHtml = account.account_type === 'Subscription' 
                ? '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Green</ac:parameter><ac:parameter ac:name="title">Subscription</ac:parameter></ac:structured-macro>'
                : account.account_type === 'POC' 
                    ? '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Yellow</ac:parameter><ac:parameter ac:name="title">POC</ac:parameter></ac:structured-macro>'
                    : this.escapeHtml(account.account_type || '—');

            // Build tenant URL as a clean link
            const tenantUrlHtml = account.tenant_url 
                ? `<a href="${this.escapeHtml(account.tenant_url)}">Open</a>`
                : '—';

            return `
                <tr>
                    <td>${this.escapeHtml(account.client || '—')}</td>
                    <td>${this.escapeHtml(account.services || '—')}</td>
                    <td>${typeHtml}</td>
                    <td>${this.escapeHtml(account.csm_owner || '—')}</td>
                    <td>${this.escapeHtml(account.ps_record_name || '—')}</td>
                    <td>${completionDate}</td>
                    <td>${this.escapeHtml(account.size || '—')}</td>
                    <td>${this.escapeHtml(account.region || '—')}</td>
                    <td>${this.escapeHtml(account.tenant_name || '—')}</td>
                    <td>${this.escapeHtml(account.tenant_id || '—')}</td>
                    <td>${this.escapeHtml(account.salesforce_account_id || '—')}</td>
                    <td>${tenantUrlHtml}</td>
                    <td>${this.escapeHtml(account.initial_tenant_admin || '—')}</td>
                    <td>${this.escapeHtml(account.comments || '')}</td>
                </tr>
            `;
        }).join('');

        // Combine into full HTML - using Confluence native table styling
        const html = `
            <h2>Current Accounts Overview</h2>
            ${statsHtml}
            
            <h3>Account Details (${sortedAccounts.length} records)</h3>
            <p><em>Sorted by completion date (latest first). Click column headers to sort in Confluence.</em></p>
            <table data-layout="full-width">
                <thead>${tableHeader}</thead>
                <tbody>${tableRows}</tbody>
            </table>
            
            <ac:structured-macro ac:name="info">
                <ac:rich-text-body>
                    <p>This page is automatically generated from DeployAssist. Last published: ${timestamp}</p>
                </ac:rich-text-body>
            </ac:structured-macro>
        `;

        return html;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = new ConfluenceService();

