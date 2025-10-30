/**
 * SML Repository (JavaScript version)
 * Handles API communication with SML
 */

const https = require('https');
const fs = require('fs').promises;

const SML_BASE_URLS = {
    euw1: 'https://api-euw1.rms.com',
    use1: 'https://api-use1.rms.com'
};

const SML_CONFIG_FILE = '.sml_config.json';

class SMLRepository {
    constructor() {
        this.config = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(SML_CONFIG_FILE, 'utf8');
            this.config = JSON.parse(configData);
            console.log('✅ SML configuration loaded');
            return this.config;
        } catch (error) {
            console.log('⚠️  No SML configuration found - needs to be configured in Settings');
            this.config = null;
            return null;
        }
    }

    async saveConfig(config) {
        try {
            await fs.writeFile(SML_CONFIG_FILE, JSON.stringify(config, null, 2));
            this.config = config;
            console.log('✅ SML configuration saved', { environment: config.environment });
        } catch (error) {
            console.error('❌ Failed to save SML configuration:', error);
            throw new Error('Failed to save SML configuration');
        }
    }

    getConfig() {
        return this.config;
    }

    getBaseUrl() {
        if (!this.config || !this.config.environment) {
            throw new Error('SML environment not configured');
        }
        return SML_BASE_URLS[this.config.environment];
    }

    hasAuthentication() {
        return !!(this.config && this.config.authCookie);
    }

    async makeRequest(path) {
        if (!this.hasAuthentication()) {
            throw new Error('SML authentication token not configured');
        }

        const baseUrl = this.getBaseUrl();
        const url = new URL(path, baseUrl);

        console.log('📡 SML API Request:', url.toString());

        return new Promise((resolve, reject) => {
            // Determine origin based on environment
            const origin = this.config.environment === 'euw1' 
                ? 'https://tenant-zero.rms.com'
                : 'https://tenant-zero-us.rms.com';

            const requestOptions = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.authCookie}`,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': origin,
                    'Referer': `${origin}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
                },
                rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        console.log('📊 SML API Response:', {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            dataLength: data.length,
                            dataPreview: data.substring(0, 500)
                        });

                        if (res.statusCode === 401 || res.statusCode === 403) {
                            console.error('❌ SML authentication failed');
                            reject({
                                message: 'SML authentication failed - token may be expired',
                                statusCode: res.statusCode,
                                responsePreview: data.substring(0, 500)
                            });
                            return;
                        }

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const result = data ? JSON.parse(data) : {};
                            console.log('✅ SML API Response Success');
                            resolve(result);
                        } else {
                            console.error('❌ SML API Error:', res.statusCode);
                            reject({
                                message: `SML API request failed with status ${res.statusCode}`,
                                statusCode: res.statusCode,
                                responsePreview: data.substring(0, 500)
                            });
                        }
                    } catch (parseError) {
                        console.error('❌ Failed to parse SML response:', parseError);
                        reject({
                            message: 'Failed to parse SML API response - received non-JSON response',
                            statusCode: res.statusCode,
                            responsePreview: data.substring(0, 200)
                        });
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ SML API request failed:', error);
                reject(new Error(`Failed to connect to SML API: ${error.message}`));
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('SML API request timeout'));
            });

            req.end();
        });
    }

    async fetchApps(tenantId) {
        try {
            const path = `/sml/entitlements/v1/tenants/${encodeURIComponent(tenantId)}/apps/current`;
            return await this.makeRequest(path);
        } catch (error) {
            console.error('Failed to fetch SML apps:', error);
            throw error;
        }
    }

    async fetchModels(tenantId) {
        try {
            const path = `/v1/tenants/${encodeURIComponent(tenantId)}/models/current`;
            return await this.makeRequest(path);
        } catch (error) {
            console.error('Failed to fetch SML models:', error);
            throw error;
        }
    }

    async fetchData(tenantId) {
        try {
            const path = `/v1/tenants/${encodeURIComponent(tenantId)}/data/current`;
            return await this.makeRequest(path);
        } catch (error) {
            console.error('Failed to fetch SML data:', error);
            throw error;
        }
    }

    async testConnection(tenantId = '6000009') {
        try {
            if (!this.hasAuthentication()) {
                return {
                    success: false,
                    error: 'Authentication token not configured'
                };
            }

            console.log(`🧪 Testing SML connection with tenant ID: ${tenantId}`);
            await this.fetchApps(tenantId);
            
            return {
                success: true
            };
        } catch (error) {
            console.error('❌ Test connection failed:', error);
            return {
                success: false,
                error: error.message || 'Connection test failed',
                details: {
                    statusCode: error.statusCode,
                    responsePreview: error.responsePreview
                }
            };
        }
    }
}

module.exports = SMLRepository;

