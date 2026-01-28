/**
 * Microsoft Authentication Service
 * Handles OAuth 2.0 authentication with Azure AD for Microsoft Graph API access
 */

const msal = require('@azure/msal-node');
const fs = require('fs');
const path = require('path');

// Token cache file path
const TOKEN_CACHE_FILE = path.join(__dirname, '..', 'config', 'microsoft-token-cache.json');

class MicrosoftAuthService {
    constructor() {
        this.msalConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET,
            },
            cache: {
                cachePlugin: {
                    beforeCacheAccess: async (cacheContext) => {
                        try {
                            if (fs.existsSync(TOKEN_CACHE_FILE)) {
                                const cacheData = fs.readFileSync(TOKEN_CACHE_FILE, 'utf8');
                                cacheContext.tokenCache.deserialize(cacheData);
                            }
                        } catch (error) {
                            console.error('Error reading token cache:', error);
                        }
                    },
                    afterCacheAccess: async (cacheContext) => {
                        if (cacheContext.cacheHasChanged) {
                            try {
                                const configDir = path.dirname(TOKEN_CACHE_FILE);
                                if (!fs.existsSync(configDir)) {
                                    fs.mkdirSync(configDir, { recursive: true });
                                }
                                fs.writeFileSync(TOKEN_CACHE_FILE, cacheContext.tokenCache.serialize());
                            } catch (error) {
                                console.error('Error writing token cache:', error);
                            }
                        }
                    }
                }
            }
        };

        // Permissions: Using Files.ReadWrite.All for full access to user's files including shared
        // Sites.Selected is also included for explicit site grants
        this.scopes = ['Files.ReadWrite.All', 'Sites.Selected', 'User.Read', 'offline_access'];
        this.redirectUri = process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/auth/microsoft/callback';
        
        this.pca = null;
        this.initializeClient();
    }

    /**
     * Initialize the MSAL confidential client
     */
    initializeClient() {
        if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_SECRET) {
            console.warn('⚠️ Microsoft Graph API not configured. Set AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET in .env');
            return;
        }

        try {
            this.pca = new msal.ConfidentialClientApplication(this.msalConfig);
            console.log('✅ Microsoft Auth Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Microsoft Auth Service:', error);
        }
    }

    /**
     * Check if Microsoft Graph is configured
     */
    isConfigured() {
        return !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET);
    }

    /**
     * Get the authorization URL for user login
     */
    async getAuthUrl() {
        if (!this.pca) {
            throw new Error('Microsoft Auth not configured');
        }

        const authCodeUrlParameters = {
            scopes: this.scopes,
            redirectUri: this.redirectUri,
        };

        try {
            const authUrl = await this.pca.getAuthCodeUrl(authCodeUrlParameters);
            return authUrl;
        } catch (error) {
            console.error('Error generating auth URL:', error);
            throw error;
        }
    }

    /**
     * Exchange authorization code for tokens
     */
    async acquireTokenByCode(authCode) {
        if (!this.pca) {
            throw new Error('Microsoft Auth not configured');
        }

        const tokenRequest = {
            code: authCode,
            scopes: this.scopes,
            redirectUri: this.redirectUri,
        };

        try {
            const response = await this.pca.acquireTokenByCode(tokenRequest);
            console.log('✅ Token acquired for user:', response.account?.username);
            return {
                success: true,
                accessToken: response.accessToken,
                account: response.account,
                expiresOn: response.expiresOn
            };
        } catch (error) {
            console.error('Error acquiring token by code:', error);
            throw error;
        }
    }

    /**
     * Get cached accounts for this tenant
     */
    async getAccounts() {
        if (!this.pca) {
            return [];
        }

        try {
            const cache = this.pca.getTokenCache();
            const allAccounts = await cache.getAllAccounts();
            
            // Filter to only accounts for our tenant
            const tenantId = process.env.AZURE_TENANT_ID;
            const filteredAccounts = allAccounts.filter(account => 
                account.tenantId === tenantId || 
                account.homeAccountId?.includes(tenantId)
            );
            
            console.log(`📋 Found ${allAccounts.length} accounts, ${filteredAccounts.length} for tenant ${tenantId}`);
            
            return filteredAccounts;
        } catch (error) {
            console.error('Error getting accounts:', error);
            return [];
        }
    }

    /**
     * Get access token silently (from cache or refresh)
     */
    async getAccessToken() {
        if (!this.pca) {
            throw new Error('Microsoft Auth not configured');
        }

        try {
            const accounts = await this.getAccounts();
            
            if (accounts.length === 0) {
                return { success: false, error: 'No authenticated user. Please connect to OneDrive first.' };
            }

            const silentRequest = {
                account: accounts[0],
                scopes: this.scopes,
            };

            const response = await this.pca.acquireTokenSilent(silentRequest);
            return {
                success: true,
                accessToken: response.accessToken,
                account: response.account,
                expiresOn: response.expiresOn
            };
        } catch (error) {
            console.error('Error acquiring token silently:', error);
            
            // If silent acquisition fails, user needs to re-authenticate
            if (error instanceof msal.InteractionRequiredAuthError) {
                return { success: false, error: 'Session expired. Please reconnect to OneDrive.' };
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        try {
            const accounts = await this.getAccounts();
            if (accounts.length === 0) {
                return { authenticated: false };
            }

            // Try to get a token silently to verify the session is still valid
            const tokenResult = await this.getAccessToken();
            
            return {
                authenticated: tokenResult.success,
                account: tokenResult.account,
                error: tokenResult.error
            };
        } catch (error) {
            return { authenticated: false, error: error.message };
        }
    }

    /**
     * Sign out - clear cached tokens
     */
    async signOut() {
        try {
            const accounts = await this.getAccounts();
            
            if (accounts.length > 0) {
                const cache = this.pca.getTokenCache();
                for (const account of accounts) {
                    await cache.removeAccount(account);
                }
            }

            // Also delete the cache file
            if (fs.existsSync(TOKEN_CACHE_FILE)) {
                fs.unlinkSync(TOKEN_CACHE_FILE);
            }

            console.log('✅ User signed out from Microsoft');
            return { success: true };
        } catch (error) {
            console.error('Error signing out:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get connection status for UI display
     */
    async getConnectionStatus() {
        const configured = this.isConfigured();
        
        if (!configured) {
            return {
                configured: false,
                connected: false,
                message: 'Microsoft Graph API not configured. Add Azure credentials to .env file.'
            };
        }

        const authStatus = await this.isAuthenticated();
        
        return {
            configured: true,
            connected: authStatus.authenticated,
            account: authStatus.account ? {
                username: authStatus.account.username,
                name: authStatus.account.name
            } : null,
            message: authStatus.authenticated 
                ? `Connected as ${authStatus.account?.username}`
                : authStatus.error || 'Not connected to OneDrive'
        };
    }
}

module.exports = new MicrosoftAuthService();
