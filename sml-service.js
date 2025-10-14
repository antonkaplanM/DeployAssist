/**
 * SML Service (JavaScript version)
 * Business logic for SML operations
 */

const SMLRepository = require('./sml-repository');

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
}

module.exports = SMLService;

