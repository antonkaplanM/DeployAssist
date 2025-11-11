/**
 * Expiration Monitor Service
 * Business logic for product expiration monitoring
 */

const salesforce = require('../salesforce');
const db = require('../database');
const logger = require('../utils/logger');
const { UnauthorizedError, InternalServerError } = require('../middleware/error-handler');

class ExpirationService {
    /**
     * Get expiration monitor data
     * @param {Number} expirationWindow - Days to look ahead
     * @param {Boolean} showExtended - Include extended licenses
     * @returns {Promise<Object>} Expiration data
     */
    async getExpirationMonitor(expirationWindow = 30, showExtended = false) {
        logger.info(`Fetching expiration data (window: ${expirationWindow} days, showExtended: ${showExtended})`);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication - returning empty data');
            return {
                summary: {
                    totalExpiring: 0,
                    atRisk: 0,
                    extended: 0,
                    accountsAffected: 0
                },
                expirations: [],
                lastAnalyzed: null,
                note: 'No Salesforce authentication - please configure in Settings'
            };
        }
        
        // Get expiring entitlements grouped by account/PS record
        const result = await salesforce.getExpiringEntitlements(expirationWindow, showExtended);
        
        // Get last analysis status
        const analysisStatus = await db.getLatestAnalysisStatus();
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch expiration data');
        }
        
        // Calculate summary based on status categories
        const atRiskCount = result.expirations.filter(e => e.status === 'at-risk').length;
        const upcomingCount = result.expirations.filter(e => e.status === 'upcoming').length;
        const currentCount = result.expirations.filter(e => e.status === 'current').length;
        
        // Get unique accounts
        const uniqueAccounts = new Set(result.expirations.map(e => e.account.id));
        
        return {
            summary: {
                totalExpiring: result.expirations.length,
                atRisk: atRiskCount,
                upcoming: upcomingCount,
                current: currentCount,
                accountsAffected: uniqueAccounts.size
            },
            expirations: result.expirations,
            expirationWindow: expirationWindow,
            lastAnalyzed: analysisStatus.hasAnalysis ? analysisStatus.analysis.analysis_completed : null
        };
    }

    /**
     * Refresh expiration analysis
     * @param {Number} lookbackYears - Years to look back
     * @param {Number} expirationWindow - Days to look ahead
     * @returns {Promise<Object>} Analysis results
     */
    async refreshExpirationAnalysis(lookbackYears = 5, expirationWindow = 30) {
        logger.info(`Starting expiration analysis: ${lookbackYears} year lookback, ${expirationWindow} day window`);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            throw new UnauthorizedError('No Salesforce authentication available');
        }
        
        const analysisStarted = new Date();
        
        try {
            // Start analysis (this could take a while with 5 years of data)
            const result = await salesforce.analyzeExpirations(lookbackYears, expirationWindow);
            
            const analysisCompleted = new Date();
            
            if (!result.success) {
                // Log the failed analysis
                await db.logExpirationAnalysis({
                    analysisStarted: analysisStarted,
                    analysisCompleted: new Date(),
                    recordsAnalyzed: 0,
                    entitlementsProcessed: 0,
                    expirationsFound: 0,
                    extensionsFound: 0,
                    lookbackYears: lookbackYears,
                    status: 'failed',
                    errorMessage: result.error
                });
                
                throw new InternalServerError(result.error || 'Expiration analysis failed');
            }
            
            // Clear existing cache
            await db.clearExpirationCache();
            
            // Insert new expiration data into database
            await db.insertExpirationData(result.expirationData);
            
            // Log the analysis
            await db.logExpirationAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: analysisCompleted,
                recordsAnalyzed: result.recordsAnalyzed,
                entitlementsProcessed: result.entitlementsProcessed,
                expirationsFound: result.expirationsFound,
                extensionsFound: result.extensionsFound,
                lookbackYears: lookbackYears,
                status: 'completed'
            });
            
            logger.info(`Expiration analysis complete: ${result.expirationsFound} expirations found (${result.removedInSubsequentRecord || 0} filtered out)`);
            
            return {
                message: 'Expiration analysis completed successfully',
                summary: {
                    recordsAnalyzed: result.recordsAnalyzed,
                    entitlementsProcessed: result.entitlementsProcessed,
                    expirationsFound: result.expirationsFound,
                    extensionsFound: result.extensionsFound,
                    removedInSubsequentRecord: result.removedInSubsequentRecord || 0,
                    lookbackYears: lookbackYears,
                    expirationWindow: expirationWindow,
                    duration: (analysisCompleted - analysisStarted) / 1000 // seconds
                }
            };
        } catch (err) {
            // Log the error
            await db.logExpirationAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: new Date(),
                recordsAnalyzed: 0,
                entitlementsProcessed: 0,
                expirationsFound: 0,
                extensionsFound: 0,
                lookbackYears: lookbackYears,
                status: 'failed',
                errorMessage: err.message
            });
            
            throw err;
        }
    }

    /**
     * Get expiration analysis status
     * @returns {Promise<Object>} Analysis status
     */
    async getExpirationStatus() {
        const analysisStatus = await db.getLatestAnalysisStatus();
        
        if (!analysisStatus.success) {
            throw new InternalServerError(analysisStatus.error || 'Failed to get expiration status');
        }
        
        if (!analysisStatus.hasAnalysis) {
            return {
                hasAnalysis: false,
                message: 'No analysis has been run yet. Click "Refresh" to analyze expirations.'
            };
        }
        
        const analysis = analysisStatus.analysis;
        
        // Calculate age of analysis
        const analysisAge = new Date() - new Date(analysis.analysis_completed);
        const ageHours = Math.floor(analysisAge / (1000 * 60 * 60));
        const ageMinutes = Math.floor((analysisAge % (1000 * 60 * 60)) / (1000 * 60));
        
        let ageText;
        if (ageHours > 24) {
            const ageDays = Math.floor(ageHours / 24);
            ageText = `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
        } else if (ageHours > 0) {
            ageText = `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
        } else {
            ageText = `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
        }
        
        return {
            hasAnalysis: true,
            analysis: {
                lastRun: analysis.analysis_completed,
                lastRunAgo: ageText,
                status: analysis.status,
                recordsAnalyzed: analysis.records_analyzed,
                entitlementsProcessed: analysis.entitlements_processed,
                expirationsFound: analysis.expirations_found,
                extensionsFound: analysis.extensions_found,
                lookbackYears: analysis.lookback_years,
                errorMessage: analysis.error_message
            }
        };
    }

    /**
     * Query expired products with filtering
     * @param {Object} filters - Query filters
     * @returns {Promise<Object>} Expired products
     */
    async queryExpiredProducts(filters = {}) {
        logger.info('Querying expired products', filters);
        
        const {
            category,
            accountName,
            productName,
            excludeProduct,
            region,
            includeGhostAccountsOnly,
            limit = 100,
            groupByAccount = true
        } = filters;
        
        // Build the query
        let query = `
            SELECT 
                em.account_name,
                em.product_name,
                em.product_type,
                em.end_date,
                em.account_id as ma_sf_account_id,
                ga.id as ghost_account_id
            FROM expiration_monitor em
            LEFT JOIN ghost_accounts ga ON em.account_name = ga.account_name
            WHERE em.end_date < CURRENT_DATE
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Add filters
        if (category) {
            query += ` AND em.product_type = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        
        if (accountName) {
            query += ` AND em.account_name ILIKE $${paramIndex}`;
            params.push(`%${accountName}%`);
            paramIndex++;
        }
        
        if (productName) {
            query += ` AND em.product_name ILIKE $${paramIndex}`;
            params.push(`%${productName}%`);
            paramIndex++;
        }
        
        if (excludeProduct) {
            query += ` AND em.product_name NOT ILIKE $${paramIndex}`;
            params.push(`%${excludeProduct}%`);
            paramIndex++;
        }
        
        if (includeGhostAccountsOnly === 'true' || includeGhostAccountsOnly === true) {
            query += ` AND ga.id IS NOT NULL`;
        }
        
        query += ` ORDER BY em.account_name, em.product_name`;
        query += ` LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        
        const result = await db.query(query, params);
        
        // Process results
        if (groupByAccount === 'true' || groupByAccount === true) {
            // Group by account
            const accountMap = new Map();
            
            result.rows.forEach(row => {
                if (!accountMap.has(row.account_name)) {
                    accountMap.set(row.account_name, {
                        account_name: row.account_name,
                        ma_sf_account_id: row.ma_sf_account_id,
                        ma_sf_link: row.ma_sf_account_id ? 
                            `https://moodysanalytics.my.salesforce.com/${row.ma_sf_account_id}` : null,
                        is_ghost_account: row.ghost_account_id !== null,
                        expired_products: []
                    });
                }
                
                accountMap.get(row.account_name).expired_products.push({
                    product_name: row.product_name,
                    product_type: row.product_type,
                    expiration_date: row.end_date
                });
            });
            
            const accounts = Array.from(accountMap.values());
            
            return {
                accounts: accounts,
                summary: {
                    total_accounts: accounts.length,
                    total_expired_products: result.rows.length,
                    ghost_accounts: accounts.filter(a => a.is_ghost_account).length,
                    regular_accounts: accounts.filter(a => !a.is_ghost_account).length
                },
                filters: {
                    category,
                    accountName,
                    productName,
                    excludeProduct,
                    region,
                    includeGhostAccountsOnly
                }
            };
        } else {
            // Flat list of products
            const products = result.rows.map(row => ({
                account_name: row.account_name,
                product_name: row.product_name,
                product_type: row.product_type,
                expiration_date: row.end_date,
                ma_sf_account_id: row.ma_sf_account_id,
                ma_sf_link: row.ma_sf_account_id ? 
                    `https://moodysanalytics.my.salesforce.com/${row.ma_sf_account_id}` : null,
                is_ghost_account: row.ghost_account_id !== null
            }));
            
            return {
                products: products,
                summary: {
                    total_products: products.length
                },
                filters: {
                    category,
                    accountName,
                    productName,
                    excludeProduct,
                    region,
                    includeGhostAccountsOnly
                }
            };
        }
    }
}

module.exports = new ExpirationService();

