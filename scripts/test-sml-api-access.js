/**
 * Test SML Direct API Access with OAuth2/Okta SSO Discovery
 * 
 * This script tests direct API access to SML entitlements endpoints
 * and discovers the OAuth2/Okta authentication flow.
 * 
 * Usage: node scripts/test-sml-api-access.js [mode]
 *   Modes:
 *     discover - Discover OAuth2/Okta endpoints by following redirects
 *     test     - Test with a provided token
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Configuration
const SML_CONFIG_FILE = path.join(__dirname, '..', '.sml_config.json');

// SSO User
const SSO_USERNAME = 'anton.kaplan@rms.com';

// SML Base URLs by environment
const SML_BASE_URLS = {
  euw1: 'https://api-euw1.rms.com',
  use1: 'https://api-use1.rms.com'
};

// Test endpoints
const TEST_ENDPOINTS = [
  '/sml/entitlements/v1/skus/data',  // Endpoint user confirmed works in UI
  '/sml/tenant-provisioning/v1/tenants/?includingTaskDetail=false&isDeleted=false&pageSize=10'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

/**
 * Load SML configuration
 */
function loadConfig() {
  try {
    const configData = fs.readFileSync(SML_CONFIG_FILE, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    return { environment: 'euw1', authCookie: null };
  }
}

/**
 * Make HTTPS request with redirect following and detailed logging
 */
function makeRequestWithRedirects(urlString, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const redirectChain = [];
    
    function doRequest(currentUrl, redirectCount) {
      const url = new URL(currentUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Accept': 'application/json, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeployAssist-SML-Test/1.0',
          ...(options.headers || {})
        }
      };

      log(`\n   📡 Request #${redirectCount + 1}: ${url.toString()}`, 'cyan');
      if (options.headers?.Authorization) {
        log(`      Auth: ${options.headers.Authorization.substring(0, 30)}...`, 'cyan');
      }
      
      const req = lib.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const result = {
            url: currentUrl,
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          };
          
          redirectChain.push(result);
          
          log(`      Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
          
          // Log important headers
          if (res.headers['www-authenticate']) {
            log(`      WWW-Authenticate: ${res.headers['www-authenticate']}`, 'yellow');
          }
          if (res.headers['location']) {
            log(`      Location: ${res.headers['location'].substring(0, 100)}...`, 'yellow');
          }
          if (res.headers['set-cookie']) {
            log(`      Set-Cookie: ${res.headers['set-cookie'].length} cookie(s)`, 'cyan');
          }
          
          // Handle redirects
          if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) 
              && res.headers.location && redirectCount < maxRedirects) {
            
            let redirectUrl = res.headers.location;
            // Handle relative redirects
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = new URL(redirectUrl, currentUrl).toString();
            }
            
            log(`      ➡️  Following redirect to: ${redirectUrl.substring(0, 80)}...`, 'blue');
            doRequest(redirectUrl, redirectCount + 1);
          } else {
            resolve({
              finalResponse: result,
              redirectChain,
              redirectCount
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    }
    
    doRequest(urlString, 0);
  });
}

/**
 * Parse OAuth2/OIDC parameters from a URL
 */
function parseOAuthParams(urlString) {
  try {
    const url = new URL(urlString);
    const params = {};
    
    // Check for OAuth2 parameters in query string
    for (const [key, value] of url.searchParams) {
      params[key] = value;
    }
    
    // Check for OAuth2 parameters in hash fragment
    if (url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      for (const [key, value] of hashParams) {
        params[key] = value;
      }
    }
    
    return {
      host: url.host,
      pathname: url.pathname,
      params
    };
  } catch (e) {
    return null;
  }
}

/**
 * Discover OAuth2/Okta configuration
 */
async function discoverOAuth2Config(baseUrl) {
  logSection('🔍 Discovering OAuth2/Okta Configuration');
  
  const discoveryEndpoints = [
    '/.well-known/openid-configuration',
    '/.well-known/oauth-authorization-server',
    '/oauth2/default/.well-known/openid-configuration'
  ];
  
  for (const endpoint of discoveryEndpoints) {
    const url = baseUrl + endpoint;
    log(`\n   Trying: ${url}`, 'cyan');
    
    try {
      const result = await makeRequestWithRedirects(url, {}, 0);
      if (result.finalResponse.statusCode === 200) {
        try {
          const config = JSON.parse(result.finalResponse.body);
          log(`   ✅ Found OAuth2 configuration!`, 'green');
          return config;
        } catch (e) {
          log(`   ❌ Invalid JSON response`, 'yellow');
        }
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
    }
  }
  
  return null;
}

/**
 * Test API endpoint and analyze the authentication flow
 */
async function testEndpointAndAnalyzeAuth(endpoint, baseUrl) {
  logSection(`🔐 Testing Endpoint: ${endpoint}`);
  
  const fullUrl = baseUrl + endpoint;
  
  try {
    const result = await makeRequestWithRedirects(fullUrl, {}, 10);
    
    logSection('📊 Redirect Chain Analysis');
    
    for (let i = 0; i < result.redirectChain.length; i++) {
      const step = result.redirectChain[i];
      log(`\n   Step ${i + 1}: ${step.statusCode}`, step.statusCode === 200 ? 'green' : 'yellow');
      
      const parsedUrl = parseOAuthParams(step.url);
      if (parsedUrl) {
        log(`      Host: ${parsedUrl.host}`, 'cyan');
        log(`      Path: ${parsedUrl.pathname}`, 'cyan');
        
        // Check for Okta
        if (parsedUrl.host.includes('okta')) {
          log(`      🔑 OKTA DETECTED!`, 'green');
        }
        
        // Log OAuth2 parameters if present
        const oauthParams = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'nonce', 'code', 'access_token', 'id_token'];
        for (const param of oauthParams) {
          if (parsedUrl.params[param]) {
            log(`      ${param}: ${parsedUrl.params[param].substring(0, 50)}${parsedUrl.params[param].length > 50 ? '...' : ''}`, 'magenta');
          }
        }
      }
    }
    
    // Analyze final response
    const final = result.finalResponse;
    logSection('📋 Final Response Analysis');
    log(`   Status: ${final.statusCode}`, final.statusCode === 200 ? 'green' : 'yellow');
    log(`   URL: ${final.url}`, 'cyan');
    
    // Check if we got an HTML login page
    if (final.body.includes('<html') || final.body.includes('<!DOCTYPE')) {
      log(`   Response Type: HTML page (likely login form)`, 'yellow');
      
      // Look for form action URLs
      const formMatch = final.body.match(/action="([^"]+)"/);
      if (formMatch) {
        log(`   Form Action: ${formMatch[1]}`, 'magenta');
      }
      
      // Look for Okta-specific elements
      if (final.body.includes('okta') || final.body.includes('Okta')) {
        log(`   🔑 Okta login page detected`, 'green');
      }
      
      // Look for OAuth2 client ID in the page
      const clientIdMatch = final.body.match(/client_id['":\s]+([a-zA-Z0-9]+)/);
      if (clientIdMatch) {
        log(`   Client ID found: ${clientIdMatch[1]}`, 'magenta');
      }
    } else if (final.statusCode === 200) {
      log(`   Response Type: JSON data`, 'green');
      try {
        const data = JSON.parse(final.body);
        log(`   ✅ Successfully got data!`, 'green');
        if (Array.isArray(data)) {
          log(`   Data: Array with ${data.length} items`, 'cyan');
        } else if (data.value) {
          log(`   Data: Object with 'value' array (${data.value.length} items)`, 'cyan');
        }
      } catch (e) {
        log(`   Response preview: ${final.body.substring(0, 200)}...`, 'cyan');
      }
    } else if (final.statusCode === 401) {
      log(`   Response Type: Unauthorized`, 'red');
      log(`   WWW-Authenticate: ${final.headers['www-authenticate'] || 'not provided'}`, 'yellow');
    }
    
    return result;
    
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Try OAuth2 Resource Owner Password Credentials (ROPC) flow
 */
async function tryROPCFlow(tokenEndpoint, clientId, username, password) {
  logSection('🔐 Trying OAuth2 ROPC Flow');
  
  log(`   Token Endpoint: ${tokenEndpoint}`, 'cyan');
  log(`   Username: ${username}`, 'cyan');
  
  const body = new URLSearchParams({
    grant_type: 'password',
    username: username,
    password: password || '',
    client_id: clientId,
    scope: 'openid profile email'
  }).toString();
  
  try {
    const url = new URL(tokenEndpoint);
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          log(`   Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
          
          try {
            const result = JSON.parse(data);
            if (result.access_token) {
              log(`   ✅ Got access token!`, 'green');
              log(`   Token type: ${result.token_type}`, 'cyan');
              log(`   Expires in: ${result.expires_in} seconds`, 'cyan');
              resolve(result);
            } else if (result.error) {
              log(`   ❌ Error: ${result.error}`, 'red');
              log(`   Description: ${result.error_description || 'N/A'}`, 'yellow');
              resolve(null);
            }
          } catch (e) {
            log(`   Response: ${data.substring(0, 200)}`, 'yellow');
            resolve(null);
          }
        });
      });
      
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Try OAuth2 Client Credentials flow
 */
async function tryClientCredentialsFlow(tokenEndpoint, clientId, clientSecret) {
  logSection('🔐 Trying OAuth2 Client Credentials Flow');
  
  log(`   Token Endpoint: ${tokenEndpoint}`, 'cyan');
  log(`   Client ID: ${clientId}`, 'cyan');
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret || '',
    scope: 'openid'
  }).toString();
  
  try {
    const url = new URL(tokenEndpoint);
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          log(`   Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
          
          try {
            const result = JSON.parse(data);
            if (result.access_token) {
              log(`   ✅ Got access token!`, 'green');
              resolve(result);
            } else if (result.error) {
              log(`   ❌ Error: ${result.error}`, 'red');
              log(`   Description: ${result.error_description || 'N/A'}`, 'yellow');
              resolve(null);
            }
          } catch (e) {
            log(`   Response: ${data.substring(0, 200)}`, 'yellow');
            resolve(null);
          }
        });
      });
      
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Test entitlement endpoints with a token
 */
async function testEntitlementsWithToken(baseUrl, token, tenantId) {
  logSection(`🎯 Testing Entitlements for Tenant: ${tenantId}`);
  
  const endpoints = [
    `/sml/entitlements/v1/tenants/${tenantId}/apps/current`,
    `/v1/tenants/${tenantId}/models/current`,
    `/v1/tenants/${tenantId}/data/current`
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    log(`\n   Testing: ${endpoint}`, 'cyan');
    
    try {
      const result = await makeRequestWithRedirects(baseUrl + endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, 0);
      
      const status = result.finalResponse.statusCode;
      log(`   Status: ${status}`, status === 200 ? 'green' : 'red');
      
      if (status === 200) {
        try {
          const data = JSON.parse(result.finalResponse.body);
          const items = data.apps || data.models || data.data || data.entitlements || [];
          log(`   ✅ Found ${items.length} items`, 'green');
          results.push({ endpoint, success: true, count: items.length });
        } catch (e) {
          results.push({ endpoint, success: false, error: 'Parse error' });
        }
      } else {
        results.push({ endpoint, success: false, statusCode: status });
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
      results.push({ endpoint, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  const mode = process.argv[2] || 'discover';
  
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║       SML Direct API Access - OAuth2/Okta Discovery                 ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝', 'cyan');
  
  const config = loadConfig();
  const baseUrl = SML_BASE_URLS[config.environment || 'euw1'];
  
  logSection('📋 Configuration');
  log(`   Environment: ${config.environment || 'euw1'}`, 'green');
  log(`   Base URL: ${baseUrl}`, 'green');
  log(`   SSO Username: ${SSO_USERNAME}`, 'green');
  log(`   Mode: ${mode}`, 'green');
  
  if (mode === 'discover') {
    // Step 1: Try to discover OAuth2 configuration from various endpoints
    logSection('🔍 Searching for OAuth2/OIDC Configuration');
    
    // Potential Okta domains for RMS
    const potentialOktaDomains = [
      'https://rms.okta.com',
      'https://rms-inc.okta.com', 
      'https://login.rms.com',
      'https://sso.rms.com',
      'https://auth.rms.com',
      'https://id.rms.com',
      baseUrl  // Also try the API domain itself
    ];
    
    let foundOAuthConfig = null;
    let foundDomain = null;
    
    for (const domain of potentialOktaDomains) {
      log(`\n   Trying domain: ${domain}`, 'cyan');
      const oauthConfig = await discoverOAuth2Config(domain);
      if (oauthConfig && oauthConfig.token_endpoint) {
        foundOAuthConfig = oauthConfig;
        foundDomain = domain;
        log(`   ✅ Found OAuth2 configuration!`, 'green');
        break;
      }
    }
    
    if (foundOAuthConfig) {
      logSection('🔑 OAuth2 Configuration Found');
      log(`   Domain: ${foundDomain}`, 'green');
      log(`   Issuer: ${foundOAuthConfig.issuer}`, 'cyan');
      log(`   Token Endpoint: ${foundOAuthConfig.token_endpoint}`, 'cyan');
      log(`   Authorization Endpoint: ${foundOAuthConfig.authorization_endpoint}`, 'cyan');
      
      if (foundOAuthConfig.grant_types_supported) {
        log(`   Supported Grant Types:`, 'magenta');
        foundOAuthConfig.grant_types_supported.forEach(g => log(`     - ${g}`, 'magenta'));
      }
      
      // Save config
      const discoveredConfig = {
        ...config,
        oauth2: {
          issuer: foundOAuthConfig.issuer,
          tokenEndpoint: foundOAuthConfig.token_endpoint,
          authorizationEndpoint: foundOAuthConfig.authorization_endpoint
        }
      };
      
      fs.writeFileSync(
        path.join(__dirname, '..', '.sml_oauth_config.json'),
        JSON.stringify(discoveredConfig, null, 2)
      );
      log(`\n   ✅ OAuth2 configuration saved to .sml_oauth_config.json`, 'green');
    }
    
    // Step 2: Test the endpoints and analyze response
    for (const endpoint of TEST_ENDPOINTS) {
      const result = await testEndpointAndAnalyzeAuth(endpoint, baseUrl);
      
      if (result) {
        // Check the 401 response body for hints
        const body = result.finalResponse.body;
        if (body) {
          try {
            const errorData = JSON.parse(body);
            if (errorData.error || errorData.message) {
              logSection('📝 API Error Details');
              log(`   Error: ${errorData.error || 'N/A'}`, 'yellow');
              log(`   Message: ${errorData.message || 'N/A'}`, 'yellow');
              if (errorData.error_description) {
                log(`   Description: ${errorData.error_description}`, 'yellow');
              }
            }
          } catch (e) {
            // Not JSON, check if it contains useful info
            if (body.length > 0 && body.length < 500) {
              log(`   Response body: ${body}`, 'yellow');
            }
          }
        }
        
        // Look for OAuth2/Okta in the redirect chain
        for (const step of result.redirectChain) {
          if (step.url.includes('okta')) {
            logSection('🔑 Okta Information Extracted');
            
            const parsed = parseOAuthParams(step.url);
            if (parsed) {
              log(`   Okta Domain: ${parsed.host}`, 'green');
              
              if (parsed.params.client_id) {
                log(`   Client ID: ${parsed.params.client_id}`, 'magenta');
              }
              if (parsed.params.redirect_uri) {
                log(`   Redirect URI: ${parsed.params.redirect_uri}`, 'magenta');
              }
              if (parsed.params.scope) {
                log(`   Scope: ${parsed.params.scope}`, 'magenta');
              }
            }
            break;
          }
        }
      }
    }
    
    logSection('📝 Summary & Next Steps');
    log(`\n   The API returns 401 without redirecting to Okta.`, 'yellow');
    log(`   This means the API expects a Bearer token directly.`, 'yellow');
    log(`\n   To get a token programmatically, you typically need:`, 'cyan');
    log(`   1. OAuth2 Client Credentials (client_id + client_secret) from your admin`, 'cyan');
    log(`   2. Or an API Key provisioned for your user`, 'cyan');
    log(`   3. Or use the existing Playwright-based flow that handles browser SSO`, 'cyan');
    log(`\n   If you have credentials, run:`, 'yellow');
    log(`   node scripts/test-sml-api-access.js auth <client_id> <client_secret>`, 'cyan');
    
  } else if (mode === 'password') {
    // Try OAuth2 Password Grant (ROPC) flow
    // Usage: node script.js password <client_id> <password>
    const clientId = process.argv[3];
    const password = process.argv[4];
    
    if (!clientId || !password) {
      log('\n   Usage: node scripts/test-sml-api-access.js password <client_id> <password>', 'yellow');
      log('   Example: node scripts/test-sml-api-access.js password 0oa123abc yourpassword', 'cyan');
      process.exit(1);
    }
    
    logSection('🔐 OAuth2 Password Grant (ROPC) Flow');
    log(`   Token Endpoint: https://rms.okta.com/oauth2/v1/token`, 'cyan');
    log(`   Username: ${SSO_USERNAME}`, 'cyan');
    log(`   Client ID: ${clientId}`, 'cyan');
    
    const tokenResult = await tryROPCFlow(
      'https://rms.okta.com/oauth2/v1/token',
      clientId,
      SSO_USERNAME,
      password
    );
    
    if (tokenResult && tokenResult.access_token) {
      // Save the token
      const tokenConfig = {
        ...config,
        accessToken: tokenResult.access_token,
        tokenType: tokenResult.token_type,
        expiresIn: tokenResult.expires_in,
        obtainedAt: new Date().toISOString()
      };
      fs.writeFileSync(
        path.join(__dirname, '..', '.sml_token.json'),
        JSON.stringify(tokenConfig, null, 2)
      );
      log(`\n   ✅ Token saved to .sml_token.json`, 'green');
      
      // Test with the new token
      const results = await testEntitlementsWithToken(baseUrl, tokenResult.access_token, 'chubb');
      
      logSection('📊 Test Results');
      for (const r of results) {
        const status = r.success ? '✅' : '❌';
        log(`   ${status} ${r.endpoint}: ${r.success ? r.count + ' items' : r.error || r.statusCode}`, 
            r.success ? 'green' : 'red');
      }
    }
    
  } else if (mode === 'device') {
    // Try OAuth2 Device Authorization Grant flow
    logSection('🔐 OAuth2 Device Authorization Flow');
    log('   This flow allows you to authenticate in a browser', 'cyan');
    
    // We need a client_id that supports device flow
    const clientId = process.argv[3];
    
    if (!clientId) {
      log('\n   Usage: node scripts/test-sml-api-access.js device <client_id>', 'yellow');
      process.exit(1);
    }
    
    // Request device code
    log(`\n   Requesting device code...`, 'cyan');
    
    const deviceCodeResult = await new Promise((resolve, reject) => {
      const body = new URLSearchParams({
        client_id: clientId,
        scope: 'openid profile email'
      }).toString();
      
      const req = https.request({
        hostname: 'rms.okta.com',
        port: 443,
        path: '/oauth2/v1/device/authorize',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          log(`   Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            log(`   Response: ${data.substring(0, 200)}`, 'yellow');
            resolve(null);
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    
    if (deviceCodeResult && deviceCodeResult.verification_uri_complete) {
      logSection('📱 Device Authorization');
      log(`\n   1. Open this URL in your browser:`, 'green');
      log(`      ${deviceCodeResult.verification_uri_complete}`, 'bright');
      log(`\n   2. Or go to: ${deviceCodeResult.verification_uri}`, 'cyan');
      log(`      And enter code: ${deviceCodeResult.user_code}`, 'bright');
      log(`\n   3. After you authenticate, press Enter here to continue...`, 'yellow');
      
      // Wait for user to press Enter
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
      
      // Poll for token
      log(`\n   Checking for token...`, 'cyan');
      
      const tokenResult = await new Promise((resolve, reject) => {
        const body = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: clientId,
          device_code: deviceCodeResult.device_code
        }).toString();
        
        const req = https.request({
          hostname: 'rms.okta.com',
          port: 443,
          path: '/oauth2/v1/token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            log(`   Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ error: data });
            }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      
      if (tokenResult.access_token) {
        log(`   ✅ Got access token!`, 'green');
        
        // Save token
        const tokenConfig = {
          ...config,
          accessToken: tokenResult.access_token,
          tokenType: tokenResult.token_type,
          expiresIn: tokenResult.expires_in,
          obtainedAt: new Date().toISOString()
        };
        fs.writeFileSync(
          path.join(__dirname, '..', '.sml_token.json'),
          JSON.stringify(tokenConfig, null, 2)
        );
        log(`   ✅ Token saved to .sml_token.json`, 'green');
        
        // Test with the new token
        const results = await testEntitlementsWithToken(baseUrl, tokenResult.access_token, 'chubb');
        
        logSection('📊 Test Results');
        for (const r of results) {
          const status = r.success ? '✅' : '❌';
          log(`   ${status} ${r.endpoint}: ${r.success ? r.count + ' items' : r.error || r.statusCode}`, 
              r.success ? 'green' : 'red');
        }
      } else {
        log(`   ❌ Error: ${JSON.stringify(tokenResult)}`, 'red');
      }
    } else if (deviceCodeResult?.error) {
      log(`   ❌ Error: ${deviceCodeResult.error}`, 'red');
      log(`   ${deviceCodeResult.error_description || ''}`, 'yellow');
    }
    
  } else if (mode === 'auth' && process.argv[3]) {
    // Try OAuth2 flows with provided credentials
    const clientId = process.argv[3];
    const clientSecret = process.argv[4] || '';
    
    // Try to load OAuth2 config
    let oauthConfig;
    try {
      oauthConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.sml_oauth_config.json'), 'utf8'));
    } catch (e) {
      log('   ❌ No OAuth2 config found. Run discover mode first.', 'red');
      process.exit(1);
    }
    
    if (oauthConfig.oauth2?.tokenEndpoint) {
      // Try client credentials flow
      const token = await tryClientCredentialsFlow(
        oauthConfig.oauth2.tokenEndpoint,
        clientId,
        clientSecret
      );
      
      if (token) {
        // Test the entitlements endpoints
        const results = await testEntitlementsWithToken(baseUrl, token.access_token, 'chubb');
        
        logSection('📊 Test Results');
        for (const r of results) {
          const status = r.success ? '✅' : '❌';
          log(`   ${status} ${r.endpoint}: ${r.success ? r.count + ' items' : r.error || r.statusCode}`, 
              r.success ? 'green' : 'red');
        }
      }
    }
    
  } else if (mode === 'token' && process.argv[3]) {
    // Test with a provided Bearer token
    const token = process.argv[3];
    const tenantId = process.argv[4] || 'chubb';
    
    const results = await testEntitlementsWithToken(baseUrl, token, tenantId);
    
    logSection('📊 Test Results');
    for (const r of results) {
      const status = r.success ? '✅' : '❌';
      log(`   ${status} ${r.endpoint}: ${r.success ? r.count + ' items' : r.error || r.statusCode}`, 
          r.success ? 'green' : 'red');
    }
  }
  
  console.log('\n');
}

// Run
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});





