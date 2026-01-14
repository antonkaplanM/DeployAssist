/**
 * Test Script: Extract Salesforce Session from Browser and Query Product2
 * 
 * This script uses Playwright to:
 * 1. Open a browser to Moody's Analytics Salesforce
 * 2. Wait for you to complete login (Okta SSO/MFA)
 * 3. Extract the session token
 * 4. Query the Product2 object via REST API
 * 5. Save results to a JSON file
 * 
 * Usage: node scripts/test-ma-salesforce-session.js
 */

const { chromium } = require('playwright');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const MA_SALESFORCE_URL = 'https://moodysanalytics.lightning.force.com/';
const MA_INSTANCE_URL = 'https://moodysanalytics.my.salesforce.com';
const API_VERSION = 'v59.0';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'data');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make an HTTPS request with the session token
 */
function makeRequest(url, sessionId) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        // Create a custom agent with relaxed SSL settings
        const agent = new https.Agent({
            rejectUnauthorized: false,
            secureProtocol: 'TLSv1_2_method',
            servername: urlObj.hostname // Important: set SNI
        });
        
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            agent: agent,
            headers: {
                'Authorization': `Bearer ${sessionId}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Host': urlObj.hostname
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: result, statusCode: res.statusCode });
                    } else {
                        resolve({ success: false, error: result, statusCode: res.statusCode });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: data, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (error) => {
            log(`⚠️  Request error: ${error.message}`, 'yellow');
            reject(error);
        });

        req.end();
    });
}

/**
 * Query Salesforce using SOQL
 */
async function querySalesforce(sessionId, instanceUrl, soqlQuery) {
    const encodedQuery = encodeURIComponent(soqlQuery);
    const url = `${instanceUrl}/services/data/${API_VERSION}/query?q=${encodedQuery}`;
    
    log(`\n📊 Executing SOQL Query:`, 'cyan');
    log(soqlQuery, 'yellow');
    
    return await makeRequest(url, sessionId);
}

/**
 * Get object metadata
 */
async function describeObject(sessionId, instanceUrl, objectName) {
    const url = `${instanceUrl}/services/data/${API_VERSION}/sobjects/${objectName}/describe`;
    return await makeRequest(url, sessionId);
}

/**
 * Test API connection by getting user identity
 */
async function testConnection(sessionId, instanceUrl) {
    const url = `${instanceUrl}/services/oauth2/userinfo`;
    return await makeRequest(url, sessionId);
}

/**
 * Main function
 */
async function main() {
    log('\n' + '='.repeat(70), 'cyan');
    log('  Moody\'s Analytics Salesforce - Session Extraction & Product2 Query', 'cyan');
    log('='.repeat(70) + '\n', 'cyan');

    log('📌 This script will:', 'yellow');
    log('   1. Open a browser to MA Salesforce', 'reset');
    log('   2. Wait for you to log in via Okta SSO', 'reset');
    log('   3. Extract the session token automatically', 'reset');
    log('   4. Query the Product2 object', 'reset');
    log('   5. Save results to docs/data/\n', 'reset');

    let browser;
    let sessionId;
    let actualInstanceUrl = MA_INSTANCE_URL;

    try {
        // Launch browser with visible UI
        log('🚀 Launching browser...', 'green');
        browser = await chromium.launch({
            headless: false,
            slowMo: 100, // Slow down for visibility
            args: ['--start-maximized']
        });

        const context = await browser.newContext({
            viewport: null, // Use full window
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();

        // Navigate to Salesforce
        log(`🌐 Navigating to: ${MA_SALESFORCE_URL}`, 'green');
        await page.goto(MA_SALESFORCE_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // Check if we're on Okta login page
        const currentUrl = page.url();
        if (currentUrl.includes('okta') || currentUrl.includes('login')) {
            log('\n⏳ Waiting for you to complete login...', 'yellow');
            log('   Please log in using Okta SSO in the browser window', 'yellow');
            log('   (Complete any MFA prompts if required)\n', 'yellow');
        }

        // Wait for successful login - use multiple detection strategies
        log('⏳ Waiting for Salesforce Lightning page to load...', 'cyan');
        log('   (Press ENTER in the terminal once you are fully logged in)', 'yellow');
        
        // Create a promise that resolves when user presses Enter
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const userConfirm = new Promise((resolve) => {
            rl.question('\n>>> Press ENTER when you are logged into Salesforce: ', () => {
                rl.close();
                resolve('user');
            });
        });
        
        // Also set up automatic detection as backup
        const autoDetect = page.waitForFunction(() => {
            // Check for Lightning Experience indicators
            return window.location.href.includes('lightning.force.com') &&
                   (document.querySelector('.desktop') || 
                    document.querySelector('[class*="slds"]') ||
                    document.querySelector('one-app-nav-bar'));
        }, { timeout: 300000 }).then(() => 'auto').catch(() => null);
        
        // Wait for either user confirmation or auto-detection
        const detection = await Promise.race([userConfirm, autoDetect]);
        log(`\n✅ Login detected via: ${detection}`, 'green');

        log('✅ Login detected! Extracting session...', 'green');

        // Wait a moment for all cookies to be set
        await page.waitForTimeout(3000);

        // Get the final URL to determine instance
        const finalUrl = page.url();
        log(`📍 Current URL: ${finalUrl}`, 'cyan');

        // Extract cookies
        const cookies = await context.cookies();
        
        // Find the session ID cookie
        const sidCookie = cookies.find(c => c.name === 'sid');
        const oidCookie = cookies.find(c => c.name === 'oid'); // Org ID

        if (!sidCookie) {
            // Try to get session from page context
            log('⚠️  SID cookie not found directly, trying alternative method...', 'yellow');
            
            // Try to extract from Salesforce's internal API
            const sessionInfo = await page.evaluate(() => {
                // Try various ways to get session info
                if (window.$A && window.$A.get) {
                    try {
                        return {
                            sessionId: window.$A.get('$SObjectType.CurrentUser.SessionId'),
                            userId: window.$A.get('$SObjectType.CurrentUser.Id')
                        };
                    } catch (e) {}
                }
                return null;
            });

            if (sessionInfo?.sessionId) {
                sessionId = sessionInfo.sessionId;
                log(`✅ Session ID extracted via JavaScript`, 'green');
            }
        } else {
            sessionId = sidCookie.value;
            log(`✅ Session ID extracted from cookie`, 'green');
        }

        if (oidCookie) {
            log(`📋 Organization ID: ${oidCookie.value}`, 'cyan');
        }

        // Determine the correct instance URL
        // For lightning.force.com URLs, the API URL is typically the .my.salesforce.com version
        if (finalUrl.includes('moodysanalytics.lightning.force.com')) {
            actualInstanceUrl = 'https://moodysanalytics.my.salesforce.com';
        } else if (finalUrl.includes('.lightning.force.com')) {
            // Extract org name from lightning URL
            const match = finalUrl.match(/https:\/\/([^.]+)\.lightning\.force\.com/);
            if (match) {
                actualInstanceUrl = `https://${match[1]}.my.salesforce.com`;
            }
        } else if (finalUrl.includes('.my.salesforce.com')) {
            const match = finalUrl.match(/(https:\/\/[^\/]+\.my\.salesforce\.com)/);
            if (match) {
                actualInstanceUrl = match[1];
            }
        }
        
        // Fallback: check instance cookie but validate it looks like a hostname
        const instanceCookie = cookies.find(c => c.name === 'inst');
        if (instanceCookie && instanceCookie.value.includes('.salesforce.com')) {
            actualInstanceUrl = `https://${instanceCookie.value}`;
        }

        log(`📍 Instance URL: ${actualInstanceUrl}`, 'cyan');
        log(`🔑 Session ID: ${sessionId.substring(0, 20)}...`, 'cyan');

        // Create a new API request context with the session ID as Bearer token
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Querying Product2 via API with Session Token', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        // Create a new request context with explicit Authorization header
        const { request } = require('playwright');
        const apiContext = await request.newContext({
            baseURL: actualInstanceUrl,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${sessionId}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ignoreHTTPSErrors: true
        });
        
        // First test the connection
        log('\n🔌 Testing API connection...', 'cyan');
        
        try {
            const userInfoResponse = await apiContext.get('/services/oauth2/userinfo');
            const userInfoText = await userInfoResponse.text();
            log(`   Response status: ${userInfoResponse.status()}`, 'reset');
            
            if (userInfoResponse.ok()) {
                const userInfo = JSON.parse(userInfoText);
                log('✅ API Connection successful!', 'green');
                log(`   User: ${userInfo.name || userInfo.preferred_username || 'Unknown'}`, 'reset');
                log(`   Email: ${userInfo.email || 'N/A'}`, 'reset');
            } else {
                log(`⚠️  User info response: ${userInfoText.substring(0, 200)}`, 'yellow');
            }
        } catch (e) {
            log(`⚠️  User info error: ${e.message}`, 'yellow');
        }

        // Get Product2 object description
        log('\n📋 Getting Product2 object metadata...', 'cyan');
        try {
            const describeResponse = await apiContext.get(`/services/data/${API_VERSION}/sobjects/Product2/describe`);
            if (describeResponse.ok()) {
                const describeData = await describeResponse.json();
                const allFields = describeData.fields.map(f => f.name);
                log(`✅ Found ${allFields.length} fields on Product2`, 'green');
                
                // Save field list
                const fieldsFile = path.join(OUTPUT_DIR, 'MA_Product2_Fields.json');
                fs.writeFileSync(fieldsFile, JSON.stringify(describeData.fields, null, 2));
                log(`   Saved field metadata to: ${fieldsFile}`, 'reset');
            } else {
                const errorText = await describeResponse.text();
                log(`⚠️  Could not describe Product2: ${describeResponse.status()}`, 'yellow');
                log(`   Response: ${errorText.substring(0, 200)}`, 'yellow');
            }
        } catch (e) {
            log(`⚠️  Describe error: ${e.message}`, 'yellow');
        }

        // Query Product2 using Playwright's request context
        log('\n📋 Querying Product2 records...', 'cyan');
        
        const product2Query = `SELECT Id, Name, ProductCode, Family, Description, IsActive, CreatedDate, LastModifiedDate FROM Product2 ORDER BY Name ASC LIMIT 2000`;
        const encodedQuery = encodeURIComponent(product2Query);
        const queryUrl = `/services/data/${API_VERSION}/query?q=${encodedQuery}`;
        
        log(`   Query: ${product2Query}`, 'yellow');
        
        let queryResult;
        try {
            const queryResponse = await apiContext.get(queryUrl);
            const responseText = await queryResponse.text();
            
            if (queryResponse.ok()) {
                const responseData = JSON.parse(responseText);
                queryResult = { 
                    success: true, 
                    statusCode: queryResponse.status(), 
                    data: responseData 
                };
            } else {
                log(`⚠️  Query response: ${responseText.substring(0, 300)}`, 'yellow');
                queryResult = { 
                    success: false, 
                    statusCode: queryResponse.status(), 
                    error: responseText 
                };
            }
        } catch (e) {
            queryResult = { success: false, error: e.message };
        }

        // Dispose of the API context
        await apiContext.dispose();

        // Close browser now
        log('\n🔒 Closing browser...', 'green');
        await browser.close();
        browser = null;

        if (!sessionId) {
            throw new Error('Could not extract session ID. Please try again.');
        }

        // The query was already done via browser above, now just process results
        const fieldsToQuery = ['Id', 'Name', 'ProductCode', 'Family', 'Description', 'IsActive', 'CreatedDate', 'LastModifiedDate'];

        if (queryResult.success) {
            const records = queryResult.data.records || [];
            log(`\n✅ Query successful! Retrieved ${records.length} products`, 'green');
            log(`   Total records available: ${queryResult.data.totalSize}`, 'reset');

            // Save results
            const outputFile = path.join(OUTPUT_DIR, 'MA_Product2_Data.json');
            fs.writeFileSync(outputFile, JSON.stringify(queryResult.data, null, 2));
            log(`\n💾 Saved results to: ${outputFile}`, 'green');

            // Show sample data
            if (records.length > 0) {
                log(`\n${'─'.repeat(70)}`, 'cyan');
                log('  Sample Products (first 10)', 'cyan');
                log(`${'─'.repeat(70)}`, 'cyan');
                
                records.slice(0, 10).forEach((record, i) => {
                    log(`\n${i + 1}. ${record.Name}`, 'yellow');
                    log(`   Code: ${record.ProductCode || 'N/A'}`, 'reset');
                    log(`   Family: ${record.Family || 'N/A'}`, 'reset');
                    log(`   Active: ${record.IsActive}`, 'reset');
                });
            }

            // Create a simple CSV export too
            const csvFile = path.join(OUTPUT_DIR, 'MA_Product2_Data.csv');
            const csvHeader = fieldsToQuery.join(',');
            const csvRows = records.map(r => 
                fieldsToQuery.map(f => {
                    const val = r[f];
                    if (val === null || val === undefined) return '';
                    // Escape quotes and wrap in quotes if contains comma
                    const strVal = String(val).replace(/"/g, '""');
                    return strVal.includes(',') ? `"${strVal}"` : strVal;
                }).join(',')
            );
            fs.writeFileSync(csvFile, [csvHeader, ...csvRows].join('\n'));
            log(`\n💾 Saved CSV to: ${csvFile}`, 'green');

        } else {
            log(`\n❌ Query failed with status: ${queryResult.statusCode}`, 'red');
            log(`   Error: ${JSON.stringify(queryResult.error)}`, 'red');
            
            // Save error for debugging
            const errorFile = path.join(OUTPUT_DIR, 'MA_Product2_Error.json');
            fs.writeFileSync(errorFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                statusCode: queryResult.statusCode,
                error: queryResult.error
            }, null, 2));
            log(`   Error details saved to: ${errorFile}`, 'yellow');
        }

        log(`\n${'='.repeat(70)}`, 'green');
        log('  Script completed!', 'green');
        log(`${'='.repeat(70)}\n`, 'green');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        console.error(error);
        
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
}

// Run the script
main();
