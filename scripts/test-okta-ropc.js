/**
 * Test OAuth2 Password Grant (ROPC) with Okta
 * 
 * Usage: node scripts/test-okta-ropc.js <client_id> <password>
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const username = 'anton.kaplan@rms.com';

async function tryROPC(username, password, clientId) {
  return new Promise((resolve) => {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username);
    params.append('password', password);
    params.append('scope', 'openid profile email');
    params.append('client_id', clientId);
    
    const body = params.toString();
    
    console.log('Making ROPC request to Okta...');
    console.log(`  Username: ${username}`);
    console.log(`  Client ID: ${clientId}`);
    
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
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

async function testAPIWithToken(token) {
  console.log('\nTesting token with SML API...');
  
  const endpoints = [
    '/sml/entitlements/v1/skus/data',
    '/sml/tenant-provisioning/v1/tenants/?pageSize=5'
  ];
  
  for (const endpoint of endpoints) {
    await new Promise((resolve) => {
      console.log(`\n  Testing: ${endpoint}`);
      
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
          console.log(`  Status: ${res.statusCode}`);
          if (res.statusCode === 200) {
            console.log('  ✅ SUCCESS!');
            try {
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed)) {
                console.log(`  Items: ${parsed.length}`);
              } else if (parsed.value) {
                console.log(`  Items: ${parsed.value.length}`);
              }
            } catch (e) {}
          } else {
            console.log(`  Response: ${data.substring(0, 150)}`);
          }
          resolve();
        });
      });
      
      req.on('error', (e) => { console.log(`  Error: ${e.message}`); resolve(); });
      req.setTimeout(15000, () => { req.destroy(); resolve(); });
      req.end();
    });
  }
}

async function main() {
  const clientId = process.argv[2];
  const password = process.argv[3];
  
  console.log('='.repeat(70));
  console.log('OAuth2 Password Grant (ROPC) Test');
  console.log('='.repeat(70));
  console.log('');
  
  if (!clientId || !password) {
    console.log('Usage: node scripts/test-okta-ropc.js <client_id> <password>');
    console.log('');
    console.log('How to find client_id:');
    console.log('  1. Open your browser and go to the SML portal');
    console.log('  2. Open Developer Tools (F12) → Network tab');
    console.log('  3. Clear the network log');
    console.log('  4. Click Login or navigate to trigger SSO');
    console.log('  5. Look for a request to rms.okta.com');
    console.log('  6. Find client_id in the URL parameters');
    console.log('  7. Copy the value (looks like: 0oaXXXXXXXXXXXXXXXXX)');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/test-okta-ropc.js 0oaABC123 "yourpassword"');
    process.exit(1);
  }
  
  console.log('Testing ROPC with provided credentials...\n');
  
  // Try with both username formats
  const usernamesToTry = [username, `SSO_${username.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('.')}@rms.com`];
  
  for (const user of usernamesToTry) {
    console.log(`\nTrying username: ${user}`);
    console.log('-'.repeat(50));
    
    const result = await tryROPC(user, password, clientId);
    console.log(`\nStatus: ${result.status}`);
    
    try {
      const parsed = JSON.parse(result.body);
      
      if (parsed.access_token) {
        console.log('\n✅ SUCCESS! Got access token!');
        console.log(`Token type: ${parsed.token_type}`);
        console.log(`Expires in: ${parsed.expires_in} seconds`);
        console.log(`Scope: ${parsed.scope}`);
        
        // Save tokens
        const tokenPath = path.join(__dirname, '..', '.sml_okta_token.json');
        fs.writeFileSync(tokenPath, JSON.stringify(parsed, null, 2));
        console.log(`\nToken saved to .sml_okta_token.json`);
        
        // Test with the API
        await testAPIWithToken(parsed.access_token);
        
        console.log('\n' + '='.repeat(70));
        console.log('If API access works, you can use this token for direct API calls!');
        console.log('='.repeat(70));
        return;
        
      } else if (parsed.error) {
        console.log(`Error: ${parsed.error}`);
        console.log(`Description: ${parsed.error_description || 'N/A'}`);
      } else {
        console.log(`Response: ${JSON.stringify(parsed, null, 2)}`);
      }
    } catch (e) {
      console.log(`Response: ${result.body}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('Authentication failed with all username formats.');
  console.log('Please verify:');
  console.log('  - The client_id is correct');
  console.log('  - The password is correct');
  console.log('  - ROPC flow is enabled for this app in Okta');
  console.log('='.repeat(70));
}

main().catch(console.error);
