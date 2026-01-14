/**
 * SML Ghost Accounts Service
 * Handles syncing tenants from SML and analyzing them for ghost status
 */

const SMLService = require('./sml.service');
const db = require('../database');

class SMLGhostAccountsService {
    constructor() {
        this.smlService = new SMLService();
    }

    /**
     * Check if SML token is valid and not expired
     * @returns {Object} Token status with hasToken, expired, remainingMinutes
     */
    checkTokenStatus() {
        return this.smlService.getTokenInfo();
    }

    /**
     * Validate SML authentication and check token expiration
     * Returns error object if token is missing or expired
     */
    async validateAuthentication() {
        // IMPORTANT: Always reload config from disk before validation
        // This ensures we get the latest token after it's been refreshed via Settings UI
        await this.smlService.repository.reloadConfig();
        
        const config = this.smlService.getConfig();
        
        if (!config || !config.authCookie) {
            return {
                valid: false,
                error: 'SML authentication not configured. Please configure SML in Settings → SML Configuration.'
            };
        }

        // Check token expiration
        const tokenInfo = this.smlService.getTokenInfo();
        
        if (tokenInfo.expired) {
            const expiryMessage = tokenInfo.expiresAt 
                ? `Token expired at ${tokenInfo.expiresAt.toLocaleString()}`
                : 'Token has expired';
            
            return {
                valid: false,
                error: `SML authentication expired (401 Unauthorized). ${expiryMessage}. Please refresh your SML token in Settings → SML Configuration → Refresh Token.`,
                tokenExpired: true,
                expiresAt: tokenInfo.expiresAt
            };
        }

        // Token is valid - show remaining time
        console.log(`✅ SML token valid, expires in ${tokenInfo.remainingMinutes} minutes`);
        
        return {
            valid: true,
            remainingMinutes: tokenInfo.remainingMinutes,
            expiresAt: tokenInfo.expiresAt
        };
    }

    /**
     * Fetch only the tenant list from SML (no entitlements/details)
     * This is fast - just gets tenant IDs and names
     * @returns {Promise<Object>} Result with tenants array
     */
    async fetchTenantListOnly() {
        try {
            console.log('🔄 Fetching tenant list from SML (list only)...');
            
            // Validate authentication first
            const authValidation = await this.validateAuthentication();
            if (!authValidation.valid) {
                return {
                    success: false,
                    error: authValidation.error,
                    tokenExpired: authValidation.tokenExpired || false
                };
            }

            const config = this.smlService.getConfig();
            const BASE_URL = config.environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';

            // Fetch all tenants using Playwright (just the list, no details)
            const tenantsResult = await this._fetchAllTenantsWithPlaywright(config, BASE_URL);
            
            if (!tenantsResult.success) {
                return {
                    success: false,
                    error: tenantsResult.error,
                    tokenExpired: tenantsResult.error?.includes('401') || tenantsResult.error?.includes('expired')
                };
            }

            console.log(`✅ Fetched ${tenantsResult.tenants.length} tenant names from SML`);
            return {
                success: true,
                tenants: tenantsResult.tenants
            };

        } catch (error) {
            console.error('❌ Error fetching tenant list:', error.message);
            return {
                success: false,
                error: error.message,
                tokenExpired: error.message?.includes('401') || error.message?.includes('expired')
            };
        }
    }

    /**
     * Sync only specific tenants from SML (fetch details only for these)
     * This is much faster when you only need a subset of tenants
     * @param {Array} tenants - Array of tenant objects with tenantId and tenantName
     * @returns {Promise<Object>} Result with sync stats
     */
    async syncSpecificTenants(tenants) {
        try {
            console.log(`🔄 Syncing ${tenants.length} specific tenants from SML...`);
            
            // Validate authentication first
            const authValidation = await this.validateAuthentication();
            if (!authValidation.valid) {
                return {
                    success: false,
                    error: authValidation.error,
                    tokenExpired: authValidation.tokenExpired || false
                };
            }

            const config = this.smlService.getConfig();
            const BASE_URL = config.environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';

            let newCount = 0;
            let updatedCount = 0;
            let mappedCount = 0;

            for (let i = 0; i < tenants.length; i++) {
                const tenant = tenants[i];
                const tenantId = tenant.tenantId;
                const tenantName = tenant.tenantName;
                
                // Try to find account name mapping
                const accountNameResult = await db.findAccountNameForTenant(tenantName);
                const accountName = accountNameResult.accountName;
                
                if (accountName) {
                    mappedCount++;
                    console.log(`  ✓ Mapped ${tenantName} → ${accountName}`);
                }

                // Fetch full tenant details with entitlements
                console.log(`  [${i + 1}/${tenants.length}] Fetching entitlements for ${tenantName}...`);
                const tenantDetails = await this._fetchTenantProductsWithPlaywright(tenantId, config, BASE_URL);
                
                const tenantData = {
                    tenantId: tenantId,
                    tenantName: tenantName,
                    accountName: accountName,
                    tenantDisplayName: tenant.tenantDisplayName || null,
                    isDeleted: tenant.isDeleted || false,
                    rawData: tenant,
                    productEntitlements: tenantDetails?.extensionData || null
                };

                // Check if tenant already exists
                const existingResult = await db.getSMLTenantById(tenantId);
                
                const result = await db.upsertSMLTenant(tenantData);
                
                if (result.success) {
                    if (existingResult.success && existingResult.tenant) {
                        updatedCount++;
                    } else {
                        newCount++;
                    }
                }
            }

            console.log(`✅ Synced ${tenants.length} specific tenants:`);
            console.log(`   New: ${newCount}`);
            console.log(`   Updated: ${updatedCount}`);
            console.log(`   Mapped to accounts: ${mappedCount}`);

            return {
                success: true,
                totalTenants: tenants.length,
                newTenants: newCount,
                updatedTenants: updatedCount,
                mappedTenants: mappedCount
            };

        } catch (error) {
            console.error('❌ Error syncing specific tenants:', error.message);
            return {
                success: false,
                error: error.message,
                tokenExpired: error.message?.includes('401') || error.message?.includes('expired')
            };
        }
    }

    /**
     * Sync all tenants from SML to local database
     * This fetches all tenants from SML API and stores them with account name mapping
     */
    async syncAllTenantsFromSML() {
        try {
            console.log('🔄 Starting SML tenant sync...');
            
            // Validate authentication and check token expiration BEFORE making API calls
            const authValidation = await this.validateAuthentication();
            if (!authValidation.valid) {
                console.error('❌ SML authentication validation failed:', authValidation.error);
                return {
                    success: false,
                    error: authValidation.error,
                    tokenExpired: authValidation.tokenExpired || false
                };
            }

            // Get config for API calls
            const config = this.smlService.getConfig();

            const BASE_URL = config.environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';

            // Fetch all tenants using Playwright (handles pagination automatically)
            console.log('📥 Fetching all tenants from SML...');
            const tenantsResult = await this._fetchAllTenantsWithPlaywright(config, BASE_URL);
            
            if (!tenantsResult.success) {
                return {
                    success: false,
                    error: tenantsResult.error
                };
            }

            const tenants = tenantsResult.tenants;
            console.log(`✅ Fetched ${tenants.length} tenants from SML`);

            // Process and store each tenant with account name mapping and entitlement data
            let newCount = 0;
            let updatedCount = 0;
            let mappedCount = 0;

            console.log('📦 Fetching entitlement data for each tenant...');

            for (let i = 0; i < tenants.length; i++) {
                const tenant = tenants[i];
                const tenantId = tenant.tenantId;
                const tenantName = tenant.tenantName;
                
                // Try to find account name mapping
                const accountNameResult = await db.findAccountNameForTenant(tenantName);
                const accountName = accountNameResult.accountName;
                
                if (accountName) {
                    mappedCount++;
                    console.log(`  ✓ Mapped ${tenantName} → ${accountName}`);
                }

                // Fetch full tenant details with entitlements
                console.log(`  [${i + 1}/${tenants.length}] Fetching entitlements for ${tenantName}...`);
                const tenantDetails = await this._fetchTenantProductsWithPlaywright(tenantId, config, BASE_URL);
                
                const tenantData = {
                    tenantId: tenantId,
                    tenantName: tenantName,
                    accountName: accountName,
                    tenantDisplayName: tenant.tenantDisplayName || null,
                    isDeleted: tenant.isDeleted || false,
                    rawData: tenant, // Store basic tenant info
                    productEntitlements: tenantDetails?.extensionData || null // Store entitlements separately
                };

                // Check if tenant already exists
                const existingResult = await db.getSMLTenantById(tenantId);
                
                const result = await db.upsertSMLTenant(tenantData);
                
                if (result.success) {
                    if (existingResult.success && existingResult.tenant) {
                        updatedCount++;
                    } else {
                        newCount++;
                    }
                }
                
                // Progress indicator every 10 tenants
                if ((i + 1) % 10 === 0) {
                    console.log(`  Progress: ${i + 1}/${tenants.length} tenants processed`);
                }
            }

            console.log(`✅ SML tenant sync complete:`);
            console.log(`   Total: ${tenants.length}`);
            console.log(`   New: ${newCount}`);
            console.log(`   Updated: ${updatedCount}`);
            console.log(`   Mapped to accounts: ${mappedCount}`);

            return {
                success: true,
                totalTenants: tenants.length,
                newTenants: newCount,
                updatedTenants: updatedCount,
                mappedTenants: mappedCount
            };

        } catch (error) {
            console.error('❌ Error syncing tenants from SML:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Fetch all tenants from SML using Playwright
     * Uses the same header configuration as the working SML Compare feature
     */
    async _fetchAllTenantsWithPlaywright(config, baseUrl) {
        const { chromium } = require('@playwright/test');
        let browser;
        
        try {
            console.log('🎭 Launching browser to fetch tenants...');
            browser = await chromium.launch({
                headless: true,
                args: ['--ignore-certificate-errors']
            });

            // Use minimal headers - matches the working SML Compare implementation
            // Note: Origin/Referer headers cause 401 errors from SML API
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                extraHTTPHeaders: {
                    'Authorization': `Bearer ${config.authCookie}`,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const page = await context.newPage();
            
            const allTenants = [];
            const pageSize = 100;
            let pageNum = 1;
            let hasMore = true;

            while (hasMore) {
                let url = `${baseUrl}/sml/tenant-provisioning/v1/tenants/?includingTaskDetail=false&isDeleted=false&pageSize=${pageSize}`;
                
                if (pageNum > 1) {
                    const nextLink = await page.evaluate(() => window.__nextLink);
                    if (!nextLink) {
                        break;
                    }
                    
                    let nextLinkParam;
                    if (typeof nextLink === 'string') {
                        nextLinkParam = nextLink;
                    } else {
                        nextLinkParam = encodeURIComponent(JSON.stringify(nextLink));
                    }
                    
                    url += `&nextLink=${nextLinkParam}`;
                }
                
                console.log(`   Page ${pageNum}: Fetching...`);
                
                const response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });

                const status = response.status();
                
                if (status === 401) {
                    throw new Error('SML authentication failed (401 Unauthorized). Your SML token has expired. Please refresh your token in Settings → SML Configuration → Refresh Token.');
                }
                
                if (status === 403) {
                    throw new Error('SML authorization failed (403 Forbidden). You may not have access to this resource.');
                }
                
                if (status !== 200) {
                    throw new Error(`SML API request failed with status ${status}`);
                }

                const data = await response.json();
                const tenants = data.value || [];
                
                console.log(`   Page ${pageNum}: Found ${tenants.length} tenants`);
                
                allTenants.push(...tenants);
                
                // Store nextLink for next iteration
                if (data.nextLink && data.hasNext) {
                    await page.evaluate((link) => { window.__nextLink = link; }, data.nextLink);
                    pageNum++;
                } else {
                    hasMore = false;
                }
            }
            
            console.log(`✅ Fetched all ${allTenants.length} tenants across ${pageNum} pages`);
            
            return {
                success: true,
                tenants: allTenants
            };
            
        } catch (error) {
            console.error('❌ Error fetching tenants:', error.message);
            return {
                success: false,
                error: error.message,
                tenants: []
            };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Analyze all SML tenants for ghost status using cached entitlement data
     * A tenant is a ghost if all its products are expired
     */
    async analyzeGhostAccounts() {
        try {
            console.log('👻 Starting SML ghost accounts analysis (using cached data)...');
            
            // Get all tenants from local database (including cached entitlement data)
            const tenantsResult = await db.getSMLTenants({ isDeleted: false });
            
            if (!tenantsResult.success || tenantsResult.tenants.length === 0) {
                return {
                    success: true,
                    ghostCount: 0,
                    totalAnalyzed: 0,
                    message: 'No tenants found in database'
                };
            }

            const tenants = tenantsResult.tenants;
            console.log(`📊 Analyzing ${tenants.length} tenants from cached data...`);

            // Clear existing SML ghost accounts
            await db.clearSMLGhostAccounts();

            const ghostAccounts = [];
            let analyzed = 0;

            for (const tenant of tenants) {
                try {
                    // Get full tenant record with raw_data (entitlements)
                    const fullTenantResult = await db.getSMLTenantById(tenant.tenant_id);
                    
                    if (!fullTenantResult.success || !fullTenantResult.tenant) {
                        console.warn(`  ⚠️  No cached data for ${tenant.tenant_name}, skipping...`);
                        continue;
                    }
                    
                    const fullTenant = fullTenantResult.tenant;
                    const productEntitlements = typeof fullTenant.product_entitlements === 'string' 
                        ? JSON.parse(fullTenant.product_entitlements)
                        : fullTenant.product_entitlements;
                    
                    if (!productEntitlements) {
                        console.warn(`  ⚠️  No entitlement data for ${tenant.tenant_name}, skipping...`);
                        continue;
                    }
                    
                    // Analyze using cached data
                    const result = await this._analyzeTenantFromCachedData(
                        tenant.tenant_id, 
                        tenant.tenant_name,
                        tenant.account_name,
                        productEntitlements
                    );
                    
                    analyzed++;
                    
                    if (result.isGhost) {
                        ghostAccounts.push(result);
                        
                        // Store in database
                        await db.upsertSMLGhostAccount({
                            tenantId: tenant.tenant_id,
                            tenantName: tenant.tenant_name,
                            accountName: tenant.account_name,
                            totalExpiredProducts: result.expiredProducts.length,
                            latestExpiryDate: result.latestExpiryDate
                        });
                        
                        console.log(`  👻 Ghost found: ${tenant.tenant_name} (${result.expiredProducts.length} expired products)`);
                    }
                    
                    // Log progress every 10 tenants
                    if (analyzed % 10 === 0) {
                        console.log(`   Progress: ${analyzed}/${tenants.length} analyzed...`);
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error analyzing tenant ${tenant.tenant_name}:`, error.message);
                }
            }

            console.log(`✅ Analysis complete: ${ghostAccounts.length} ghost accounts found`);

            return {
                success: true,
                ghostCount: ghostAccounts.length,
                totalAnalyzed: analyzed,
                ghostAccounts: ghostAccounts
            };

        } catch (error) {
            console.error('❌ Error analyzing SML ghost accounts:', error.message);
            return {
                success: false,
                error: error.message,
                ghostCount: 0,
                totalAnalyzed: 0
            };
        }
    }

    /**
     * Analyze a single tenant for ghost status using cached entitlement data
     */
    async _analyzeTenantFromCachedData(tenantId, tenantName, accountName, productEntitlements) {
        try {
            // Extract and normalize products from cached product entitlements
            const appsRaw = productEntitlements.appEntitlements || [];
            const modelsRaw = productEntitlements.modelEntitlements || [];
            const dataRaw = productEntitlements.dataEntitlements || [];

            console.log(`  [${tenantName}] Found ${appsRaw.length} apps, ${modelsRaw.length} models, ${dataRaw.length} data products in cache`);

            // Normalize products using SML service methods (properly extracts dates and calculates status)
            const apps = this.smlService.normalizeApps({ apps: appsRaw });
            const models = this.smlService.normalizeModels({ models: modelsRaw });
            const data = this.smlService.normalizeData({ data: dataRaw });

            const allProducts = [...apps, ...models, ...data];

            console.log(`  [${tenantName}] Normalized to ${allProducts.length} total products`);

            if (allProducts.length === 0) {
                // No products at all - not a ghost, just an empty tenant
                return {
                    isGhost: false,
                    reason: 'No products found'
                };
            }

            // Check if all products are expired using the normalized 'status' field
            const expiredProducts = allProducts.filter(p => p.status === 'expired');
            const activeProducts = allProducts.filter(p => p.status === 'active');

            console.log(`  [${tenantName}] Analysis: ${expiredProducts.length} expired, ${activeProducts.length} active`);

            if (expiredProducts.length > 0 && activeProducts.length === 0) {
                // All products expired = Ghost account!
                const expiryDates = expiredProducts
                    .map(p => p.endDate)
                    .filter(d => d)
                    .sort((a, b) => new Date(b) - new Date(a));
                
                const latestExpiryDate = expiryDates.length > 0 ? expiryDates[0] : null;

                return {
                    isGhost: true,
                    tenantId: tenantId,
                    tenantName: tenantName,
                    accountName: accountName,
                    totalProducts: allProducts.length,
                    expiredProducts: expiredProducts,
                    latestExpiryDate: latestExpiryDate
                };
            }

            return {
                isGhost: false,
                reason: `Has ${activeProducts.length} active products`
            };

        } catch (error) {
            console.error(`❌ Error analyzing cached data for tenant ${tenantName}:`, error.message);
            return {
                isGhost: false,
                reason: `Analysis error: ${error.message}`
            };
        }
    }

    /**
     * Analyze a single tenant for ghost status
     * Uses Playwright to fetch tenant details (includes products)
     */
    async _analyzeTenantForGhostStatus(tenantId, tenantName, accountName, config, baseUrl) {
        try {
            // Fetch tenant details (includes products) using Playwright
            const tenantDetails = await this._fetchTenantProductsWithPlaywright(tenantId, config, baseUrl);
            
            if (!tenantDetails) {
                return {
                    isGhost: false,
                    reason: 'Failed to fetch tenant details'
                };
            }

            // Extract and normalize products from extensionData using SML service normalization
            const extensionData = tenantDetails.extensionData || {};
            const appsRaw = extensionData.appEntitlements || [];
            const modelsRaw = extensionData.modelEntitlements || [];
            const dataRaw = extensionData.dataEntitlements || [];

            // Normalize products using SML service methods (properly extracts dates and calculates status)
            const apps = this.smlService.normalizeApps({ apps: appsRaw });
            const models = this.smlService.normalizeModels({ models: modelsRaw });
            const data = this.smlService.normalizeData({ data: dataRaw });

            const allProducts = [...apps, ...models, ...data];

            if (allProducts.length === 0) {
                // No products at all - not a ghost, just an empty tenant
                return {
                    isGhost: false,
                    reason: 'No products found'
                };
            }

            // Check if all products are expired using the normalized 'status' field
            const expiredProducts = allProducts.filter(p => p.status === 'expired');
            const activeProducts = allProducts.filter(p => p.status === 'active');

            if (expiredProducts.length > 0 && activeProducts.length === 0) {
                // All products expired = Ghost account!
                const expiryDates = expiredProducts
                    .map(p => p.endDate)
                    .filter(d => d)
                    .sort((a, b) => new Date(b) - new Date(a));
                
                const latestExpiryDate = expiryDates.length > 0 ? expiryDates[0] : null;

                return {
                    isGhost: true,
                    tenantId: tenantId,
                    tenantName: tenantName,
                    accountName: accountName,
                    totalProducts: allProducts.length,
                    expiredProducts: expiredProducts,
                    latestExpiryDate: latestExpiryDate
                };
            }

            return {
                isGhost: false,
                reason: `Has ${activeProducts.length} active products`
            };

        } catch (error) {
            console.error(`❌ Error analyzing tenant ${tenantName}:`, error.message);
            return {
                isGhost: false,
                reason: `Analysis error: ${error.message}`
            };
        }
    }

    /**
     * Fetch tenant products using Playwright (more reliable than direct HTTP)
     * Uses the same header configuration as the working SML Compare feature
     */
    async _fetchTenantProductsWithPlaywright(tenantId, config, baseUrl) {
        const { chromium } = require('@playwright/test');
        let browser;
        
        try {
            browser = await chromium.launch({
                headless: true,
                args: ['--ignore-certificate-errors']
            });

            // Use minimal headers - matches the working SML Compare implementation
            // Note: Origin/Referer headers cause 401 errors from SML API
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                extraHTTPHeaders: {
                    'Authorization': `Bearer ${config.authCookie}`,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const page = await context.newPage();
            const url = `${baseUrl}/sml/tenant-provisioning/v1/tenants/${encodeURIComponent(tenantId)}?expandModels=true&includingDetail=true`;
            
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            const status = response.status();
            
            if (status === 401) {
                console.error(`❌ SML authentication failed for tenant ${tenantId}: Token expired (401)`);
                throw new Error('SML token expired - please refresh token in Settings');
            }
            
            if (status !== 200) {
                console.warn(`Failed to fetch tenant ${tenantId}: Status ${status}`);
                return null;
            }

            const data = await response.json();
            await browser.close();
            
            return data;

        } catch (error) {
            console.error(`Error fetching products for tenant ${tenantId}:`, error.message);
            if (browser) {
                await browser.close();
            }
            return null;
        }
    }

    /**
     * Full refresh: Sync tenants from SML and then analyze for ghost status
     * This is called when user clicks "Run Analysis" - fetches fresh data from SML
     */
    async refreshGhostAccountsFromSML() {
        try {
            console.log('🔄 Starting full SML ghost accounts refresh (fetching from SML)...');
            
            // Validate authentication BEFORE starting the sync
            const authValidation = await this.validateAuthentication();
            if (!authValidation.valid) {
                console.error('❌ Cannot refresh: SML authentication issue');
                return {
                    success: false,
                    error: authValidation.error,
                    tokenExpired: authValidation.tokenExpired || false
                };
            }
            
            console.log(`✅ SML token valid (${authValidation.remainingMinutes} minutes remaining)`);
            
            // Step 1: Sync all tenants from SML (includes fetching entitlements)
            console.log('📥 Step 1: Syncing tenants and entitlements from SML...');
            const syncResult = await this.syncAllTenantsFromSML();
            
            if (!syncResult.success) {
                return {
                    success: false,
                    error: `Failed to sync tenants: ${syncResult.error}`
                };
            }

            console.log(`✅ Synced ${syncResult.totalTenants} tenants (${syncResult.newTenants} new, ${syncResult.updatedTenants} updated)`);

            // Step 2: Analyze tenants for ghost status using the freshly cached data
            console.log('👻 Step 2: Analyzing tenants for ghost status...');
            const analysisResult = await this.analyzeGhostAccounts();
            
            if (!analysisResult.success) {
                return {
                    success: false,
                    error: `Failed to analyze ghost accounts: ${analysisResult.error}`
                };
            }

            console.log(`✅ Analysis complete: ${analysisResult.ghostCount} ghost accounts found`);

            return {
                success: true,
                syncResult: syncResult,
                analysisResult: analysisResult,
                summary: {
                    totalTenants: syncResult.totalTenants,
                    mappedTenants: syncResult.mappedTenants,
                    totalAnalyzed: analysisResult.totalAnalyzed,
                    ghostAccountsFound: analysisResult.ghostCount
                }
            };

        } catch (error) {
            console.error('❌ Error refreshing SML ghost accounts:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Re-analyze cached data without fetching from SML
     * This is called when user clicks "Refresh Data" - fast, uses DB cache
     */
    async reanalyzeFromCache() {
        try {
            console.log('🔄 Re-analyzing ghost accounts from cached data (no SML API calls)...');
            
            // Just run analysis on existing cached data
            const analysisResult = await this.analyzeGhostAccounts();
            
            if (!analysisResult.success) {
                return {
                    success: false,
                    error: `Failed to analyze ghost accounts: ${analysisResult.error}`
                };
            }

            console.log(`✅ Re-analysis complete: ${analysisResult.ghostCount} ghost accounts found`);

            return {
                success: true,
                summary: {
                    totalAnalyzed: analysisResult.totalAnalyzed,
                    ghostAccountsFound: analysisResult.ghostCount
                }
            };

        } catch (error) {
            console.error('❌ Error re-analyzing ghost accounts:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get expired products for a specific SML tenant
     * Uses Playwright to fetch tenant details reliably
     */
    async getTenantExpiredProducts(tenantId, tenantName, filters = {}) {
        try {
            // Validate authentication and check token expiration BEFORE making API calls
            const authValidation = await this.validateAuthentication();
            if (!authValidation.valid) {
                return {
                    success: false,
                    error: authValidation.error,
                    tokenExpired: authValidation.tokenExpired || false
                };
            }

            // Get SML config
            const config = this.smlService.getConfig();

            const baseUrl = config.environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';

            // Fetch tenant details using Playwright
            const tenantDetails = await this._fetchTenantProductsWithPlaywright(tenantId, config, baseUrl);
            
            if (!tenantDetails) {
                return {
                    success: false,
                    error: 'Failed to fetch tenant details from SML'
                };
            }

            // Extract and normalize products from extensionData using SML service normalization
            const extensionData = tenantDetails.extensionData || {};
            const appsRaw = extensionData.appEntitlements || [];
            const modelsRaw = extensionData.modelEntitlements || [];
            const dataRaw = extensionData.dataEntitlements || [];

            // Normalize products using SML service methods (properly extracts dates and calculates status)
            const apps = this.smlService.normalizeApps({ apps: appsRaw });
            const models = this.smlService.normalizeModels({ models: modelsRaw });
            const data = this.smlService.normalizeData({ data: dataRaw });

            const allProducts = [...apps, ...models, ...data];

            // Filter for expired products using the normalized 'status' field
            let expiredProducts = allProducts.filter(p => p.status === 'expired');

            // Apply category filter if provided
            if (filters.category) {
                expiredProducts = expiredProducts.filter(p => p.category === filters.category);
            }

            // Apply product name exclusion if provided
            if (filters.excludeProduct) {
                const excludeLower = filters.excludeProduct.toLowerCase();
                expiredProducts = expiredProducts.filter(p => 
                    !p.productCode?.toLowerCase().includes(excludeLower) &&
                    !p.productName?.toLowerCase().includes(excludeLower)
                );
            }

            const summary = {
                totalExpired: expiredProducts.length,
                byCategory: {
                    apps: expiredProducts.filter(p => p.category === 'apps').length,
                    models: expiredProducts.filter(p => p.category === 'models').length,
                    data: expiredProducts.filter(p => p.category === 'data').length
                }
            };

            return {
                success: true,
                products: expiredProducts,
                summary: summary
            };

        } catch (error) {
            console.error('❌ Error getting tenant expired products:', error.message);
            return {
                success: false,
                error: error.message,
                products: []
            };
        }
    }
}

module.exports = SMLGhostAccountsService;

