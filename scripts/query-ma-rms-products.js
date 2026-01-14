/**
 * Query MA Salesforce for RMS Products (L2 Hierarchy = Risk Management Solutions)
 * 
 * This script uses Playwright to:
 * 1. Open a browser to Moody's Analytics Salesforce
 * 2. Wait for you to complete login (Okta SSO/MFA)
 * 3. Extract the session token
 * 4. Query Product2 where L2 Hierarchy = 'Risk Management Solutions'
 * 5. Save results to JSON and CSV files
 * 
 * Usage: node scripts/query-ma-rms-products.js
 */

const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const MA_SALESFORCE_URL = 'https://moodysanalytics.lightning.force.com/';
const MA_INSTANCE_URL = 'https://moodysanalytics.my.salesforce.com';
const API_VERSION = 'v59.0';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'data');

// Query configuration
const L2_HIERARCHY_FILTER = 'Risk Management Solutions';
const FIELDS_TO_QUERY = [
    'Id',
    'Name',                    // Product Name
    'ProductCode',             // Product Code
    'L1Hierarchy__c',          // L1 Hierarchy
    'L2Hierarchy__c',          // L2 Hierarchy
    'L3Hierarchy__c',          // L3 Hierarchy
    'L4Hierarchy__c',          // L4 Hierarchy
    'Legacy_Product_ID__c'     // Old / Legacy Product Code
];

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
 * Main function
 */
async function main() {
    log('\n' + '='.repeat(70), 'cyan');
    log('  MA Salesforce - RMS Products Query', 'cyan');
    log('  Filter: L2 Hierarchy = "Risk Management Solutions"', 'cyan');
    log('='.repeat(70) + '\n', 'cyan');

    log('📌 Fields to retrieve:', 'yellow');
    log('   - Product Name (Name)', 'reset');
    log('   - Product Code (ProductCode)', 'reset');
    log('   - L1 Hierarchy (L1Hierarchy__c)', 'reset');
    log('   - L2 Hierarchy (L2Hierarchy__c)', 'reset');
    log('   - L3 Hierarchy (L3Hierarchy__c)', 'reset');
    log('   - L4 Hierarchy (L4Hierarchy__c)', 'reset');
    log('   - Legacy Product ID (Legacy_Product_ID__c)\n', 'reset');

    let browser;
    let sessionId;
    let actualInstanceUrl = MA_INSTANCE_URL;

    try {
        // Launch browser with visible UI
        log('🚀 Launching browser...', 'green');
        browser = await chromium.launch({
            headless: false,
            slowMo: 100,
            args: ['--start-maximized']
        });

        const context = await browser.newContext({
            viewport: null,
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

        // Wait for login
        log('⏳ Waiting for Salesforce Lightning page to load...', 'cyan');
        log('   (Press ENTER in the terminal once you are fully logged in)', 'yellow');
        
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
        
        const autoDetect = page.waitForFunction(() => {
            return window.location.href.includes('lightning.force.com') &&
                   (document.querySelector('.desktop') || 
                    document.querySelector('[class*="slds"]') ||
                    document.querySelector('one-app-nav-bar'));
        }, { timeout: 300000 }).then(() => 'auto').catch(() => null);
        
        const detection = await Promise.race([userConfirm, autoDetect]);
        log(`\n✅ Login detected via: ${detection}`, 'green');
        log('✅ Login detected! Extracting session...', 'green');

        // Wait for cookies
        await page.waitForTimeout(3000);

        // Get the final URL
        const finalUrl = page.url();
        log(`📍 Current URL: ${finalUrl}`, 'cyan');

        // Extract cookies
        const cookies = await context.cookies();
        const sidCookie = cookies.find(c => c.name === 'sid');
        const oidCookie = cookies.find(c => c.name === 'oid');

        if (!sidCookie) {
            throw new Error('Could not find session ID cookie');
        }

        sessionId = sidCookie.value;
        log(`✅ Session ID extracted from cookie`, 'green');

        if (oidCookie) {
            log(`📋 Organization ID: ${oidCookie.value}`, 'cyan');
        }

        // Determine instance URL
        if (finalUrl.includes('moodysanalytics.lightning.force.com')) {
            actualInstanceUrl = 'https://moodysanalytics.my.salesforce.com';
        }

        log(`📍 Instance URL: ${actualInstanceUrl}`, 'cyan');
        log(`🔑 Session ID: ${sessionId.substring(0, 20)}...`, 'cyan');

        // Create API context with session token
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Querying RMS Products', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        const apiContext = await request.newContext({
            baseURL: actualInstanceUrl,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${sessionId}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ignoreHTTPSErrors: true
        });

        // Build SOQL query - get ALL records (no LIMIT)
        // Salesforce returns up to 2000 per batch, we'll handle pagination
        const soqlQuery = `SELECT ${FIELDS_TO_QUERY.join(', ')} FROM Product2 WHERE L2Hierarchy__c = '${L2_HIERARCHY_FILTER}' ORDER BY Name ASC`;
        
        log(`\n📊 SOQL Query:`, 'cyan');
        log(`   ${soqlQuery}`, 'yellow');

        // Execute query with pagination
        let allRecords = [];
        let queryUrl = `/services/data/${API_VERSION}/query?q=${encodeURIComponent(soqlQuery)}`;
        let batchNumber = 1;

        while (queryUrl) {
            log(`\n📥 Fetching batch ${batchNumber}...`, 'cyan');
            
            const queryResponse = await apiContext.get(queryUrl);
            
            if (!queryResponse.ok()) {
                const errorText = await queryResponse.text();
                throw new Error(`Query failed: ${queryResponse.status()} - ${errorText}`);
            }

            const responseData = await queryResponse.json();
            const records = responseData.records || [];
            allRecords = allRecords.concat(records);

            log(`   Retrieved ${records.length} records (total: ${allRecords.length} / ${responseData.totalSize})`, 'green');

            // Check for more records
            if (responseData.nextRecordsUrl) {
                queryUrl = responseData.nextRecordsUrl;
                batchNumber++;
            } else {
                queryUrl = null;
            }
        }

        // Dispose of API context
        await apiContext.dispose();

        // Close browser
        log('\n🔒 Closing browser...', 'green');
        await browser.close();
        browser = null;

        // Process and save results
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Results', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        log(`\n✅ Total RMS Products retrieved: ${allRecords.length}`, 'green');

        if (allRecords.length > 0) {
            // Save JSON
            const jsonOutput = {
                query: soqlQuery,
                filter: `L2 Hierarchy = '${L2_HIERARCHY_FILTER}'`,
                totalRecords: allRecords.length,
                retrievedAt: new Date().toISOString(),
                records: allRecords.map(r => ({
                    Id: r.Id,
                    ProductName: r.Name,
                    ProductCode: r.ProductCode,
                    L1Hierarchy: r.L1Hierarchy__c,
                    L2Hierarchy: r.L2Hierarchy__c,
                    L3Hierarchy: r.L3Hierarchy__c,
                    L4Hierarchy: r.L4Hierarchy__c,
                    LegacyProductCode: r.Legacy_Product_ID__c
                }))
            };

            const jsonFile = path.join(OUTPUT_DIR, 'MA_RMS_Products.json');
            fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
            log(`\n💾 Saved JSON to: ${jsonFile}`, 'green');

            // Save CSV
            const csvHeader = 'Product Name,Product Code,L1 Hierarchy,L2 Hierarchy,L3 Hierarchy,L4 Hierarchy,Legacy Product Code';
            const csvRows = allRecords.map(r => {
                const escape = (val) => {
                    if (val === null || val === undefined) return '';
                    const strVal = String(val).replace(/"/g, '""');
                    return strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') 
                        ? `"${strVal}"` 
                        : strVal;
                };
                return [
                    escape(r.Name),
                    escape(r.ProductCode),
                    escape(r.L1Hierarchy__c),
                    escape(r.L2Hierarchy__c),
                    escape(r.L3Hierarchy__c),
                    escape(r.L4Hierarchy__c),
                    escape(r.Legacy_Product_ID__c)
                ].join(',');
            });

            const csvFile = path.join(OUTPUT_DIR, 'MA_RMS_Products.csv');
            fs.writeFileSync(csvFile, [csvHeader, ...csvRows].join('\n'));
            log(`💾 Saved CSV to: ${csvFile}`, 'green');

            // Show sample
            log(`\n${'─'.repeat(70)}`, 'cyan');
            log('  Sample Products (first 15)', 'cyan');
            log(`${'─'.repeat(70)}`, 'cyan');

            allRecords.slice(0, 15).forEach((r, i) => {
                log(`\n${i + 1}. ${r.Name}`, 'yellow');
                log(`   Code: ${r.ProductCode || 'N/A'}`, 'reset');
                log(`   L1: ${r.L1Hierarchy__c || 'N/A'}`, 'reset');
                log(`   L2: ${r.L2Hierarchy__c || 'N/A'}`, 'reset');
                log(`   L3: ${r.L3Hierarchy__c || 'N/A'}`, 'reset');
                log(`   L4: ${r.L4Hierarchy__c || 'N/A'}`, 'reset');
                log(`   Legacy: ${r.Legacy_Product_ID__c || 'N/A'}`, 'reset');
            });

            // Summary by L3 Hierarchy
            log(`\n${'─'.repeat(70)}`, 'cyan');
            log('  Summary by L3 Hierarchy', 'cyan');
            log(`${'─'.repeat(70)}`, 'cyan');

            const l3Summary = {};
            allRecords.forEach(r => {
                const l3 = r.L3Hierarchy__c || '(No L3 Hierarchy)';
                l3Summary[l3] = (l3Summary[l3] || 0) + 1;
            });

            Object.entries(l3Summary)
                .sort((a, b) => b[1] - a[1])
                .forEach(([l3, count]) => {
                    log(`   ${l3}: ${count} products`, 'reset');
                });
        }

        log(`\n${'='.repeat(70)}`, 'green');
        log('  Script completed successfully!', 'green');
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
