/**
 * Test Direct API Access with Various Auth Methods
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const usernames = ['anton.kaplan@rms.com', 'SSO_Anton.Kaplan@rms.com'];
const passwords = ['7T*CR7u"]hV4]B', '25FlyingBananas!!q3'];

const testEndpoint = '/sml/entitlements/v1/skus/data';

async function testWithBasicAuth(username, password) {
  return new Promise((resolve) => {
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
    
    console.log(`  Basic Auth: ${username}:****`);
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: testEndpoint,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.end();
  });
}

async function testWithApiKeyHeader(apiKey) {
  return new Promise((resolve) => {
    console.log(`  X-API-Key header`);
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: testEndpoint,
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
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
    req.end();
  });
}

async function testWithUsernameHeader(username, password) {
  return new Promise((resolve) => {
    console.log(`  X-Username/X-Password headers`);
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: testEndpoint,
      method: 'GET',
      headers: {
        'X-Username': username,
        'X-Password': password,
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
    req.end();
  });
}

async function testRMSLogin(username, password) {
  return new Promise((resolve) => {
    console.log(`  POST /auth/login with JSON body`);
    
    const body = JSON.stringify({ username, password });
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

async function testWithPasswordAsToken(password) {
  return new Promise((resolve) => {
    console.log(`  Bearer with password as token`);
    
    const req = https.request({
      hostname: 'api-euw1.rms.com',
      port: 443,
      path: testEndpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${password}`,
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
    req.end();
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('Testing Direct API Access with Various Auth Methods');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Endpoint: ${testEndpoint}`);
  console.log('');
  
  for (const password of passwords) {
    const maskedPw = password.substring(0, 4) + '***';
    console.log(`\nPassword: ${maskedPw}`);
    console.log('-'.repeat(50));
    
    for (const username of usernames) {
      console.log(`\nUsername: ${username}`);
      
      // Test Basic Auth
      const basicResult = await testWithBasicAuth(username, password);
      console.log(`    Status: ${basicResult.status}`);
      if (basicResult.status === 200) {
        console.log('    ✅ SUCCESS with Basic Auth!');
        return;
      }
      
      // Test X-Username/X-Password headers
      const headerResult = await testWithUsernameHeader(username, password);
      console.log(`    Status: ${headerResult.status}`);
      if (headerResult.status === 200) {
        console.log('    ✅ SUCCESS with X-Username headers!');
        return;
      }
      
      // Test RMS login endpoint
      const loginResult = await testRMSLogin(username, password);
      console.log(`    Status: ${loginResult.status}`);
      if (loginResult.status === 200) {
        console.log('    ✅ SUCCESS with /auth/login!');
        console.log(`    Response: ${loginResult.body.substring(0, 200)}`);
        return;
      }
    }
    
    // Test password as API key
    console.log(`\nTrying password as API key...`);
    const apiKeyResult = await testWithApiKeyHeader(password);
    console.log(`  Status: ${apiKeyResult.status}`);
    if (apiKeyResult.status === 200) {
      console.log('  ✅ SUCCESS with X-API-Key!');
      return;
    }
    
    // Test password as Bearer token
    const bearerResult = await testWithPasswordAsToken(password);
    console.log(`  Status: ${bearerResult.status}`);
    if (bearerResult.status === 200) {
      console.log('  ✅ SUCCESS with password as Bearer token!');
      return;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('None of the direct auth methods worked.');
  console.log('');
  console.log('The API requires a valid Bearer token from RMS.');
  console.log('You need either:');
  console.log('  1. An Okta client_id to use OAuth2 password grant');
  console.log('  2. An API key from your admin');
  console.log('  3. Continue using the Playwright-based approach');
  console.log('='.repeat(70));
}

main().catch(console.error);





