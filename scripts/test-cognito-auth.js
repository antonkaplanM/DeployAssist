/**
 * Test AWS Cognito OAuth2 Authentication
 * 
 * Using discovered Cognito configuration:
 * - User Pool Domain: rms-tenant-zero-eu.auth.eu-west-1.amazoncognito.com
 * - Client ID: 1f5t5qmd1agtb4ttvsm4e0vjb8
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Allow self-signed certificates for corporate environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const COGNITO_DOMAIN = 'rms-tenant-zero-eu.auth.eu-west-1.amazoncognito.com';
const CLIENT_ID = '1f5t5qmd1agtb4ttvsm4e0vjb8';
const REDIRECT_URI = 'https://tenant-zero-eu.rms.com/home/login';

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code) {
  return new Promise((resolve) => {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', CLIENT_ID);
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    
    const body = params.toString();
    
    console.log('\nExchanging code for tokens...');
    
    const req = https.request({
      hostname: COGNITO_DOMAIN,
      port: 443,
      path: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message, status: 0 }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'timeout', status: 0 }); });
    req.write(body);
    req.end();
  });
}

/**
 * Test token with SML API
 */
async function testAPIWithToken(token, tokenName) {
  return new Promise((resolve) => {
    const endpoint = '/sml/entitlements/v1/skus/data';
    console.log(`\n  Testing ${tokenName} on ${endpoint}`);
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`    Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log('    ✅ SUCCESS!');
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              console.log(`    Items: ${parsed.length}`);
            } else if (parsed.value) {
              console.log(`    Items: ${parsed.value.length}`);
            }
          } catch (e) {}
          resolve(true);
        } else {
          console.log(`    Response: ${data.substring(0, 150)}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => { console.log(`    Error: ${e.message}`); resolve(false); });
    req.setTimeout(15000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * Test Chubb tenant entitlements
 */
async function testChubbEntitlements(token) {
  console.log('\n--- Testing Chubb Tenant Entitlements ---\n');
  
  // First find Chubb tenant ID
  const tenants = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: '/sml/tenant-provisioning/v1/tenants/?includingTaskDetail=false&isDeleted=false&pageSize=100',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        } else {
          console.log(`  Tenants list failed: ${res.statusCode}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.end();
  });
  
  if (tenants && tenants.value) {
    const chubbTenants = tenants.value.filter(t => 
      (t.tenantName || '').toLowerCase().includes('chubb') ||
      (t.tenantDisplayName || '').toLowerCase().includes('chubb')
    );
    
    if (chubbTenants.length > 0) {
      console.log(`Found ${chubbTenants.length} Chubb tenant(s):`);
      for (const tenant of chubbTenants) {
        console.log(`  - ${tenant.tenantName} (ID: ${tenant.tenantId})`);
        
        // Test entitlements endpoints
        const endpoints = [
          `/sml/entitlements/v1/tenants/${tenant.tenantId}/apps/current`,
          `/v1/tenants/${tenant.tenantId}/models/current`,
          `/v1/tenants/${tenant.tenantId}/data/current`
        ];
        
        for (const ep of endpoints) {
          await new Promise((resolve) => {
            const req = https.request({
              hostname: 'api-euw1.rms.com',
              port: 443,
              path: ep,
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
              }
            }, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                const shortEp = ep.split('/').slice(-2).join('/');
                if (res.statusCode === 200) {
                  try {
                    const parsed = JSON.parse(data);
                    const items = parsed.apps || parsed.models || parsed.data || parsed.entitlements || [];
                    console.log(`    ${shortEp}: ✅ ${items.length} items`);
                  } catch (e) {
                    console.log(`    ${shortEp}: ✅ (parse error)`);
                  }
                } else {
                  console.log(`    ${shortEp}: ❌ ${res.statusCode}`);
                }
                resolve();
              });
            });
            req.on('error', () => resolve());
            req.setTimeout(15000, () => { req.destroy(); resolve(); });
            req.end();
          });
        }
      }
    } else {
      console.log('  No Chubb tenants found in first 100 results');
    }
  }
}

async function main() {
  const input = process.argv[2];
  
  console.log('='.repeat(70));
  console.log('AWS Cognito / SML API Token Test');
  console.log('='.repeat(70));
  console.log('');
  
  if (!input) {
    console.log('Usage:');
    console.log('  node scripts/test-cognito-auth.js <authorization-code>');
    console.log('  node scripts/test-cognito-auth.js token <access-token>');
    console.log('');
    console.log('To test with a token directly:');
    console.log('  Copy the access_token from browser DevTools and run:');
    console.log('  node scripts/test-cognito-auth.js token "eyJ..."');
    return;
  }
  
  // Check if testing with a token directly
  if (input === 'token' && process.argv[3]) {
    const token = process.argv[3];
    console.log(`Testing with provided token (${token.length} chars)...\n`);
    
    const success = await testAPIWithToken(token, 'Provided Token');
    
    if (success) {
      console.log('\n✅ Token works! Testing Chubb entitlements...');
      await testChubbEntitlements(token);
      
      // Save for later use
      const tokenPath = path.join(__dirname, '..', '.sml_working_token.json');
      fs.writeFileSync(tokenPath, JSON.stringify({ 
        access_token: token,
        saved_at: new Date().toISOString()
      }, null, 2));
      console.log(`\nToken saved to .sml_working_token.json`);
    }
    return;
  }
  
  // Otherwise treat as authorization code
  const code = input;
  console.log(`Exchanging authorization code: ${code.substring(0, 20)}...\n`);
  
  const result = await exchangeCodeForTokens(code);
  console.log(`Status: ${result.status}`);
  
  try {
    const parsed = JSON.parse(result.body);
    
    if (parsed.access_token) {
      console.log('\n✅ SUCCESS! Got tokens!');
      console.log(`Token Type: ${parsed.token_type}`);
      console.log(`Expires In: ${parsed.expires_in} seconds`);
      
      // Save tokens
      const tokenPath = path.join(__dirname, '..', '.sml_cognito_token.json');
      fs.writeFileSync(tokenPath, JSON.stringify(parsed, null, 2));
      console.log(`Tokens saved to .sml_cognito_token.json`);
      
      // Test with API
      const success = await testAPIWithToken(parsed.access_token, 'Cognito Access Token');
      
      if (success) {
        await testChubbEntitlements(parsed.access_token);
      } else if (parsed.id_token) {
        await testAPIWithToken(parsed.id_token, 'Cognito ID Token');
      }
      
    } else if (parsed.error) {
      console.log(`\n❌ Error: ${parsed.error}`);
      console.log(`Description: ${parsed.error_description || 'N/A'}`);
      console.log(`\nTip: Copy the Bearer token from your browser DevTools and run:`);
      console.log(`  node scripts/test-cognito-auth.js token "YOUR_TOKEN_HERE"`);
    }
  } catch (e) {
    console.log(`Response: ${result.body}`);
  }
}

main().catch(console.error);





