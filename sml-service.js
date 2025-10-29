/**
 * SML Service (JavaScript version)
 * Business logic for SML operations
 */

const SMLRepository = require('./sml-repository');
const { chromium } = require('@playwright/test');

class SMLService {
    constructor() {
        this.repository = new SMLRepository();
    }

    async setAuthConfig(environment, authCookie) {
        const config = {
            environment,
            authCookie
        };
        await this.repository.saveConfig(config);
        console.log('✅ SML auth configuration updated', { environment });
    }

    getConfig() {
        return this.repository.getConfig();
    }

    async testConnection() {
        try {
            const config = this.repository.getConfig();
            
            if (!config || !config.authCookie) {
                return {
                    success: false,
                    error: 'SML authentication not configured'
                };
            }

            const result = await this.repository.testConnection();
            
            if (result.success) {
                return {
                    success: true,
                    environment: config.environment,
                    baseUrl: config.environment === 'euw1' 
                        ? 'https://api-euw1.rms.com' 
                        : 'https://api-use1.rms.com',
                    authenticated: true
                };
            } else {
                return {
                    success: false,
                    environment: config.environment,
                    error: result.error,
                    details: {
                        statusCode: result.details?.statusCode,
                        responsePreview: result.details?.responsePreview
                    }
                };
            }
        } catch (error) {
            console.error('SML connection test failed:', error);
            return {
                success: false,
                error: error.message,
                details: {
                    statusCode: error.statusCode,
                    responsePreview: error.responsePreview
                }
            };
        }
    }

    async fetchTenantProducts(tenantId, tenantName) {
        try {
            console.log('📦 Fetching SML products for tenant:', { tenantId, tenantName });

            const [appsResponse, modelsResponse, dataResponse] = await Promise.all([
                this.repository.fetchApps(tenantId).catch(err => {
                    console.warn('Failed to fetch apps:', err.message);
                    return { apps: [], entitlements: [], data: [] };
                }),
                this.repository.fetchModels(tenantId).catch(err => {
                    console.warn('Failed to fetch models:', err.message);
                    return { models: [], entitlements: [], data: [] };
                }),
                this.repository.fetchData(tenantId).catch(err => {
                    console.warn('Failed to fetch data:', err.message);
                    return { data: [], entitlements: [], datasets: [] };
                })
            ]);

            const apps = this.normalizeApps(appsResponse);
            const models = this.normalizeModels(modelsResponse);
            const data = this.normalizeData(dataResponse);

            const products = {
                apps,
                models,
                data
            };

            const summary = {
                totalActive: apps.length + models.length + data.length,
                byCategory: {
                    apps: apps.length,
                    models: models.length,
                    data: data.length
                }
            };

            console.log('✅ SML products fetched successfully:', summary);

            return {
                success: true,
                tenantId,
                tenantName: tenantName || null,
                products,
                summary,
                fetchedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to fetch tenant products:', error);
            return {
                success: false,
                tenantId,
                tenantName: tenantName || null,
                products: { apps: [], models: [], data: [] },
                summary: {
                    totalActive: 0,
                    byCategory: { apps: 0, models: 0, data: 0 }
                },
                fetchedAt: new Date().toISOString(),
                error: error.message
            };
        }
    }

    normalizeApps(response) {
        const apps = response.apps || response.entitlements || response.data || [];
        return apps.map(app => this.createProduct(app, 'apps'));
    }

    normalizeModels(response) {
        const models = response.models || response.entitlements || response.data || [];
        return models.map(model => this.createProduct(model, 'models'));
    }

    normalizeData(response) {
        const datasets = response.data || response.datasets || response.entitlements || [];
        return datasets.map(dataset => this.createProduct(dataset, 'data'));
    }

    createProduct(entitlement, category) {
        const productCode = entitlement.productCode;
        const productName = entitlement.productName || entitlement.name || null;
        const startDate = entitlement.startDate || null;
        const endDate = entitlement.endDate || null;

        const { status, daysRemaining } = this.calculateStatus(startDate, endDate);

        return {
            productCode,
            productName,
            category,
            startDate,
            endDate,
            status,
            daysRemaining,
            additionalInfo: entitlement
        };
    }

    calculateStatus(startDate, endDate) {
        const now = new Date();

        if (!endDate) {
            return { status: 'active', daysRemaining: null };
        }

        const end = new Date(endDate);
        const diffTime = end.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
            return { status: 'expired', daysRemaining };
        } else {
            return { status: 'active', daysRemaining };
        }
    }

    /**
     * Fetch tenant details from SML using headless browser (Playwright)
     * This bypasses CORS and handles gzip compression automatically
     */
    async fetchTenantDetailsWithPlaywright(tenantName, config) {
        let browser;
        
        try {
            console.log(`🎭 Fetching tenant details for "${tenantName}" using Playwright`);
            console.log(`   Environment: ${config.environment}`);
            console.log(`   Token length: ${config.authCookie?.length || 0}`);
            
            const BASE_URL = config.environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';
            
            console.log(`   Base URL: ${BASE_URL}`);
            
            // Launch browser
            console.log('   🚀 Launching headless browser...');
            browser = await chromium.launch({
                headless: true,
                args: ['--ignore-certificate-errors']
            });
            console.log('   ✓ Browser launched');
            
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                extraHTTPHeaders: {
                    'Authorization': `Bearer ${config.authCookie}`,
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            console.log('   ✓ Browser context created');

            const page = await context.newPage();
            console.log('   ✓ New page created');
            
            // Step 1: Search for tenant
            console.log(`   🔍 Searching for tenant: ${tenantName}...`);
            const tenantId = await this._searchTenantWithPlaywright(page, BASE_URL, tenantName);
            
            if (!tenantId) {
                console.log(`   ❌ Tenant not found: ${tenantName}`);
                return {
                    success: false,
                    error: `Tenant "${tenantName}" not found`
                };
            }
            
            console.log(`   ✅ Found tenant ID: ${tenantId}`);
            
            // Step 2: Fetch tenant details
            console.log(`   📥 Fetching tenant details...`);
            const tenantDetails = await this._fetchTenantDetailsByIdWithPlaywright(page, BASE_URL, tenantId);
            console.log(`   ✅ Tenant details fetched successfully`);
            
            return {
                success: true,
                tenantDetails
            };
            
        } catch (error) {
            console.error('❌ Error in Playwright fetch:', error.message);
            console.error('   Stack:', error.stack);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (browser) {
                try {
                    await browser.close();
                    console.log('   🔒 Browser closed');
                } catch (closeError) {
                    console.error('   ⚠️ Error closing browser:', closeError.message);
                }
            }
        }
    }

    /**
     * Search for tenant by name using Playwright
     */
    async _searchTenantWithPlaywright(page, baseUrl, tenantName) {
        const pageSize = 100;
        const maxPages = 20;
        const searchLower = tenantName.toLowerCase();
        let pageNum = 1;
        
        console.log(`      Searching for: "${searchLower}" (case-insensitive)`);
        
        for (pageNum = 1; pageNum <= maxPages; pageNum++) {
            let url = `${baseUrl}/sml/tenant-provisioning/v1/tenants/?includingTaskDetail=false&isDeleted=false&pageSize=${pageSize}`;
            
            if (pageNum > 1) {
                // Get nextLink from previous response (stored in page context)
                const nextLink = await page.evaluate(() => window.__nextLink);
                if (!nextLink) {
                    console.log(`      No more pages (nextLink is null)`);
                    break;
                }
                
                console.log(`      nextLink type: ${typeof nextLink}`);
                console.log(`      nextLink value:`, nextLink);
                
                // Handle nextLink - it comes pre-encoded from the API
                let nextLinkParam;
                if (typeof nextLink === 'string') {
                    // If it's already a string, use it as-is (it's already URL-encoded from the API)
                    nextLinkParam = nextLink;
                } else {
                    // If it's an object, stringify and encode it
                    nextLinkParam = encodeURIComponent(JSON.stringify(nextLink));
                }
                
                // Don't double-encode - nextLink is already encoded from the API response
                url += `&nextLink=${nextLinkParam}`;
                console.log(`      Full URL: ${url}`);
            }
            
            console.log(`      Page ${pageNum}: Fetching...`);
            
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            const status = response.status();
            console.log(`      Page ${pageNum}: Status ${status}`);

            if (status !== 200) {
                throw new Error(`API request failed with status ${status}`);
            }

            const data = await response.json();
            const tenants = data.value || [];
            
            console.log(`      Page ${pageNum}: Found ${tenants.length} tenants`);
            console.log(`      hasNext: ${data.hasNext}`);
            console.log(`      nextLink from response:`, typeof data.nextLink, data.nextLink);
            
            // Store nextLink for next iteration
            if (data.nextLink) {
                await page.evaluate((link) => { window.__nextLink = link; }, data.nextLink);
            }
            
            // Search for matching tenant
            const match = tenants.find(tenant => {
                const name = (tenant.tenantName || '').toLowerCase();
                const id = (tenant.tenantId || '').toLowerCase();
                const accountName = (tenant.accountName || '').toLowerCase();
                const displayName = (tenant.tenantDisplayName || '').toLowerCase();
                
                return name === searchLower || 
                       id === searchLower || 
                       accountName === searchLower ||
                       displayName === searchLower;
            });
            
            if (match) {
                console.log(`      ✅ Match found: ${match.tenantName} (ID: ${match.tenantId})`);
                return match.tenantId;
            }
            
            if (!data.hasNext) {
                console.log(`      No more pages (hasNext: false)`);
                break;
            }
        }
        
        console.log(`      ❌ No match found after searching ${pageNum} pages`);
        return null;
    }

    /**
     * Fetch tenant details by ID using Playwright
     */
    async _fetchTenantDetailsByIdWithPlaywright(page, baseUrl, tenantId) {
        const url = `${baseUrl}/sml/tenant-provisioning/v1/tenants/${encodeURIComponent(tenantId)}?expandModels=true&includingDetail=true`;
        
        console.log(`      Fetching details from: ${url}`);
        
        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        const status = response.status();
        console.log(`      Fetch details status: ${status}`);

        if (status !== 200) {
            throw new Error(`API request failed with status ${status}`);
        }

        const data = await response.json();
        
        console.log(`      Details fetched:`, {
            tenantId: data.tenantId,
            tenantName: data.tenantName,
            hasExtensionData: !!(data.extensionData),
            appCount: data.extensionData?.appEntitlements?.length || 0,
            modelCount: data.extensionData?.modelEntitlements?.length || 0,
            dataCount: data.extensionData?.dataEntitlements?.length || 0
        });
        
        return data;
    }
}

module.exports = SMLService;

