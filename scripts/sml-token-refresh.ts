/**
 * SML Token Refresh Script using Playwright
 * 
 * Automatically authenticates via Okta SSO and captures the RMS JWT token
 * for SML API access.
 * 
 * Usage:
 *   npx ts-node scripts/sml-token-refresh.ts [environment]
 *   npx ts-node scripts/sml-token-refresh.ts euw1
 *   npx ts-node scripts/sml-token-refresh.ts use1
 * 
 * The script will:
 * 1. Open the SML portal login page
 * 2. Wait for Okta SSO authentication (may prompt for credentials)
 * 3. Capture the Bearer token from network requests
 * 4. Save to .sml_config.json
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface SMLConfig {
  environment: 'euw1' | 'use1';
  authCookie: string;
  refreshedAt?: string;
  expiresAt?: string;
}

interface TokenPayload {
  exp?: number;
  iat?: number;
  username?: string;
  tenant_id?: string;
  [key: string]: unknown;
}

// Configuration for different environments
const ENVIRONMENTS = {
  euw1: {
    baseUrl: 'https://tenant-zero-eu.rms.com',
    apiHost: 'api-euw1.rms.com',
    loginPath: '/home/login'
  },
  use1: {
    baseUrl: 'https://tenant-zero-us.rms.com', 
    apiHost: 'api-use1.rms.com',
    loginPath: '/home/login'
  }
};

const CONFIG_FILE = path.join(process.cwd(), '.sml_config.json');
const AUTH_STATE_FILE = path.join(process.cwd(), '.sml_auth_state.json');

/**
 * Decode JWT token payload (without verification)
 */
function decodeJWT(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 300; // 5 minutes buffer
  
  return payload.exp <= (now + bufferSeconds);
}

/**
 * Load existing config
 */
function loadConfig(): SMLConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Save config to disk
 */
function saveConfig(config: SMLConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✅ Configuration saved to ${CONFIG_FILE}`);
}

/**
 * Main token refresh function
 */
async function refreshToken(environment: 'euw1' | 'use1' = 'euw1'): Promise<string | null> {
  const env = ENVIRONMENTS[environment];
  if (!env) {
    console.error(`❌ Invalid environment: ${environment}. Use 'euw1' or 'use1'.`);
    return null;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SML Token Refresh - Playwright Authentication');
  console.log('='.repeat(60));
  console.log(`Environment: ${environment}`);
  console.log(`Target URL: ${env.baseUrl}`);
  console.log('');

  let browser: Browser | null = null;
  let capturedToken: string | null = null;

  try {
    // Launch browser (not headless for SSO login)
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: false, // Must be false for SSO authentication
      slowMo: 100
    });

    // Create context - try to reuse auth state if available
    const contextOptions: any = {
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Try to load saved authentication state
    if (fs.existsSync(AUTH_STATE_FILE)) {
      console.log('📂 Loading saved authentication state...');
      contextOptions.storageState = AUTH_STATE_FILE;
    }

    const context: BrowserContext = await browser.newContext(contextOptions);
    const page: Page = await context.newPage();

    // Set up network interception to capture the token
    let tokenCaptured = false;
    
    page.on('request', (request) => {
      const authHeader = request.headers()['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Only capture RMS-issued tokens (not Cognito/Okta tokens)
        const payload = decodeJWT(token);
        if (payload && payload.iss === 'RMS') {
          capturedToken = token;
          tokenCaptured = true;
          console.log('🔑 Captured RMS Bearer token!');
        }
      }
    });

    // Also capture from response headers/body
    page.on('response', async (response) => {
      try {
        const url = response.url();
        // Check for token in auth-related endpoints
        if (url.includes('/auth') || url.includes('/token') || url.includes('/login')) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const body = await response.json().catch(() => null);
            if (body && body.access_token) {
              const payload = decodeJWT(body.access_token);
              if (payload && payload.iss === 'RMS') {
                capturedToken = body.access_token;
                tokenCaptured = true;
                console.log('🔑 Captured RMS token from response!');
              }
            }
          }
        }
      } catch {
        // Ignore response parsing errors
      }
    });

    // Navigate to login page
    console.log(`📍 Navigating to ${env.baseUrl}${env.loginPath}...`);
    await page.goto(`${env.baseUrl}${env.loginPath}`, {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Check if already authenticated
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // Wait for authentication to complete
    // This will either:
    // 1. Auto-login if SSO session exists
    // 2. Show Okta login page for user to authenticate
    
    if (currentUrl.includes('okta.com') || currentUrl.includes('auth.') || currentUrl.includes('login')) {
      console.log('');
      console.log('🔐 SSO Login Required');
      console.log('   Please complete the login in the browser window.');
      console.log('   The script will continue automatically after login.');
      console.log('');
    }

    // Wait for navigation to home page or dashboard (indicating successful login)
    const successPatterns = ['/home', '/dashboard', '/tenant', '/admin'];
    
    console.log('⏳ Waiting for login to complete (up to 5 minutes)...');
    
    // Poll for URL change instead of waitForFunction to avoid timeout issues
    const startTime = Date.now();
    const maxWaitTime = 300000; // 5 minutes
    let loginComplete = false;
    
    while (Date.now() - startTime < maxWaitTime) {
      const url = page.url();
      if (successPatterns.some(p => url.includes(p)) && !url.includes('login')) {
        loginComplete = true;
        break;
      }
      await page.waitForTimeout(1000); // Check every second
    }
    
    if (!loginComplete) {
      throw new Error('Login timeout - please complete SSO login faster or run the script again');
    }

    console.log('✅ Login successful!');

    // Save authentication state for future runs
    await context.storageState({ path: AUTH_STATE_FILE });
    console.log('💾 Authentication state saved for future use');

    // Make a request to trigger token capture if not already captured
    if (!tokenCaptured) {
      console.log('🔄 Making API request to capture token...');
      
      // Navigate to a page that makes API calls
      await page.goto(`${env.baseUrl}/admin/tenants`, {
        waitUntil: 'networkidle',
        timeout: 30000
      }).catch(() => {
        // Try alternative page
        return page.goto(`${env.baseUrl}/home`, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
      });

      // Wait a bit for API calls to complete
      await page.waitForTimeout(3000);
    }

    // If still no token, try to extract from page/localStorage
    if (!capturedToken) {
      console.log('🔍 Checking localStorage for token...');
      
      // Use string-based evaluate to avoid TypeScript issues with browser globals
      const localStorageToken = await page.evaluate(`(function() {
        // Check various possible storage keys
        var keys = [
          'access_token',
          'authToken',
          'token',
          'jwtToken',
          'rms_token',
          'sml_token'
        ];
        
        for (var i = 0; i < keys.length; i++) {
          var value = localStorage.getItem(keys[i]);
          if (value && value.startsWith('eyJ')) {
            return value;
          }
        }

        // Check all localStorage items
        for (var j = 0; j < localStorage.length; j++) {
          var key = localStorage.key(j);
          if (key) {
            var val = localStorage.getItem(key);
            if (val && val.startsWith('eyJ') && val.includes('"iss":"RMS"')) {
              return val;
            }
          }
        }

        return null;
      })()`) as string | null;

      if (localStorageToken) {
        capturedToken = localStorageToken;
        console.log('🔑 Found token in localStorage!');
      }
    }

    // Close browser
    await browser.close();
    browser = null;

    if (capturedToken) {
      // Decode and show token info
      const payload = decodeJWT(capturedToken);
      if (payload) {
        console.log('');
        console.log('📋 Token Details:');
        console.log(`   Username: ${payload.username || 'N/A'}`);
        console.log(`   Tenant ID: ${payload.tenant_id || 'N/A'}`);
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000);
          console.log(`   Expires: ${expDate.toLocaleString()}`);
        }
      }

      // Save configuration
      const config: SMLConfig = {
        environment,
        authCookie: capturedToken,
        refreshedAt: new Date().toISOString(),
        expiresAt: payload?.exp 
          ? new Date(payload.exp * 1000).toISOString() 
          : undefined
      };

      saveConfig(config);

      console.log('');
      console.log('✅ Token refresh complete!');
      console.log(`   Token length: ${capturedToken.length} characters`);

      return capturedToken;
    } else {
      console.log('');
      console.log('❌ Failed to capture token. Please try again.');
      console.log('   Tip: Make sure you complete the SSO login and the page loads fully.');
      return null;
    }

  } catch (error) {
    console.error('❌ Error during token refresh:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Check if token needs refresh
 */
async function checkAndRefresh(environment?: 'euw1' | 'use1'): Promise<boolean> {
  const config = loadConfig();
  const env = environment || config?.environment || 'euw1';

  console.log('🔍 Checking current token status...');

  if (!config || !config.authCookie) {
    console.log('   No token found. Refresh needed.');
    const token = await refreshToken(env);
    return !!token;
  }

  if (isTokenExpired(config.authCookie)) {
    console.log('   Token expired or expiring soon. Refresh needed.');
    const token = await refreshToken(env);
    return !!token;
  }

  const payload = decodeJWT(config.authCookie);
  if (payload?.exp) {
    const expDate = new Date(payload.exp * 1000);
    const remaining = Math.floor((payload.exp * 1000 - Date.now()) / 60000);
    console.log(`   Token valid. Expires: ${expDate.toLocaleString()} (${remaining} minutes remaining)`);
  }

  return true;
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'check') {
    // Just check token status
    const env = args[1] as 'euw1' | 'use1' | undefined;
    const valid = await checkAndRefresh(env);
    process.exit(valid ? 0 : 1);
  } else if (command === 'force' || command === 'refresh') {
    // Force refresh even if token is valid
    const env = (args[1] || 'euw1') as 'euw1' | 'use1';
    const token = await refreshToken(env);
    process.exit(token ? 0 : 1);
  } else {
    // Default: check and refresh if needed
    const env = (args[0] || 'euw1') as 'euw1' | 'use1';
    
    // Validate environment
    if (!['euw1', 'use1'].includes(env)) {
      console.log('Usage:');
      console.log('  npx ts-node scripts/sml-token-refresh.ts [environment]');
      console.log('  npx ts-node scripts/sml-token-refresh.ts check [environment]');
      console.log('  npx ts-node scripts/sml-token-refresh.ts force [environment]');
      console.log('');
      console.log('Environments: euw1 (default), use1');
      process.exit(1);
    }

    const valid = await checkAndRefresh(env);
    process.exit(valid ? 0 : 1);
  }
}

// Export for programmatic use
export { refreshToken, checkAndRefresh, isTokenExpired, loadConfig, decodeJWT };

// Run if executed directly
main().catch(console.error);
