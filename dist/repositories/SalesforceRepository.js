"use strict";
/**
 * Salesforce Repository
 * Data access layer for Salesforce operations
 * Handles only connection and raw queries - no business logic
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesforceRepository = void 0;
const jsforce_1 = require("jsforce");
const fs = __importStar(require("fs/promises"));
const https = __importStar(require("https"));
const querystring = __importStar(require("querystring"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const errors_1 = require("../middleware/errors");
/**
 * Salesforce Repository Class
 */
class SalesforceRepository {
    constructor() {
        this.tokenFile = config_1.config.salesforce.tokenFile;
    }
    /**
     * Get or create Salesforce connection
     */
    async getConnection() {
        if (SalesforceRepository.connectionInstance) {
            return SalesforceRepository.connectionInstance;
        }
        // Create new connection
        const conn = new jsforce_1.Connection({
            loginUrl: config_1.config.salesforce.loginUrl
        });
        // Try to load existing access token
        const authInfo = await this.loadAuthFromDisk();
        if (authInfo && authInfo.accessToken) {
            try {
                conn.accessToken = authInfo.accessToken;
                conn.instanceUrl = authInfo.instanceUrl;
                // Test if the token is still valid
                await conn.identity();
                logger_1.Logger.salesforce('Using existing access token', { instanceUrl: authInfo.instanceUrl });
                SalesforceRepository.connectionInstance = conn;
                return conn;
            }
            catch (err) {
                logger_1.Logger.warn('Existing access token invalid, requesting new token');
                await this.clearAuthFromDisk();
            }
        }
        // Authenticate using Client Credentials Flow
        try {
            logger_1.Logger.salesforce('Authenticating with Client Credentials Flow', {});
            const postData = querystring.stringify({
                grant_type: 'client_credentials',
                client_id: config_1.config.salesforce.clientId,
                client_secret: config_1.config.salesforce.clientSecret
            });
            const authResult = await this.makeHttpsRequest(`${config_1.config.salesforce.loginUrl}/services/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                },
                body: postData
            });
            conn.accessToken = authResult.access_token;
            conn.instanceUrl = authResult.instance_url;
            // Save authentication
            await this.saveAuthToDisk({
                accessToken: authResult.access_token,
                instanceUrl: authResult.instance_url,
                tokenType: authResult.token_type,
                scope: authResult.scope,
                authenticatedAt: new Date().toISOString()
            });
            logger_1.Logger.salesforce('Authentication successful', { instanceUrl: authResult.instance_url });
            SalesforceRepository.connectionInstance = conn;
            return conn;
        }
        catch (error) {
            logger_1.Logger.error('Salesforce authentication failed', error);
            throw new errors_1.SalesforceConnectionError('Failed to authenticate with Salesforce', { error: error.message });
        }
    }
    /**
     * Check if valid authentication exists
     */
    async hasValidAuthentication() {
        try {
            const authData = await fs.readFile(this.tokenFile, 'utf8');
            const auth = JSON.parse(authData);
            return !!(auth.accessToken);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Execute a SOQL query
     */
    async query(soql) {
        try {
            const conn = await this.getConnection();
            logger_1.Logger.salesforce('Executing SOQL query', { query: soql.substring(0, 100) + '...' });
            const result = await conn.query(soql);
            logger_1.Logger.salesforce('Query executed successfully', { recordCount: result.records.length });
            return result;
        }
        catch (error) {
            logger_1.Logger.error('Salesforce query failed', error, { query: soql });
            throw new errors_1.SalesforceError('Failed to execute Salesforce query', { error: error.message, query: soql });
        }
    }
    /**
     * Get object description (metadata)
     */
    async describe(objectName) {
        try {
            const conn = await this.getConnection();
            return await conn.sobject(objectName).describe();
        }
        catch (error) {
            logger_1.Logger.error(`Failed to describe ${objectName}`, error);
            throw new errors_1.SalesforceError(`Failed to describe ${objectName}`, { error: error.message });
        }
    }
    /**
     * Get identity information
     */
    async getIdentity() {
        try {
            const conn = await this.getConnection();
            return await conn.identity();
        }
        catch (error) {
            logger_1.Logger.error('Failed to get Salesforce identity', error);
            throw new errors_1.SalesforceError('Failed to get Salesforce identity', { error: error.message });
        }
    }
    /**
     * Test connection
     */
    async testConnection() {
        try {
            const conn = await this.getConnection();
            const result = await conn.query("SELECT Id, Name FROM Organization LIMIT 1");
            return {
                success: true,
                details: {
                    recordCount: result.totalSize,
                    organizationName: result.records[0]?.['Name'],
                    instanceUrl: conn.instanceUrl
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Private: Make HTTPS request (for OAuth)
     */
    async makeHttpsRequest(url, options) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const httpsAgent = (0, config_1.getHttpsAgent)();
            const requestOptions = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: options.method || 'GET',
                headers: options.headers || {},
                agent: httpsAgent
            };
            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        }
                        else {
                            const result = JSON.parse(data);
                            reject(new Error(`HTTP ${res.statusCode}: ${result.error || 'Unknown error'} - ${result.error_description || data}`));
                        }
                    }
                    catch (parseError) {
                        reject(new Error(`Failed to parse response: ${data}`));
                    }
                });
            });
            req.on('error', reject);
            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }
    /**
     * Private: Load auth from disk
     */
    async loadAuthFromDisk() {
        try {
            const tokenData = await fs.readFile(this.tokenFile, 'utf8');
            return JSON.parse(tokenData);
        }
        catch (err) {
            return null;
        }
    }
    /**
     * Private: Save auth to disk
     */
    async saveAuthToDisk(authInfo) {
        try {
            await fs.writeFile(this.tokenFile, JSON.stringify(authInfo, null, 2));
            logger_1.Logger.salesforce('Auth token saved to disk', {});
        }
        catch (err) {
            logger_1.Logger.error('Failed to save auth token', err);
        }
    }
    /**
     * Private: Clear auth from disk
     */
    async clearAuthFromDisk() {
        try {
            await fs.unlink(this.tokenFile);
            logger_1.Logger.salesforce('Auth token cleared from disk', {});
        }
        catch (err) {
            // File might not exist, which is fine
        }
    }
}
exports.SalesforceRepository = SalesforceRepository;
SalesforceRepository.connectionInstance = null;
exports.default = SalesforceRepository;
//# sourceMappingURL=SalesforceRepository.js.map