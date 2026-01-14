/**
 * Explore SKU_Mapping__c Object in MA Salesforce
 * 
 * This script will:
 * 1. Describe the SKU_Mapping__c object to find all fields
 * 2. Find the relationship to Product2
 * 3. Find the legacy product code field
 * 
 * Usage: node scripts/explore-sku-mapping.js
 */

const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration - SAME AS WORKING SCRIPT
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

async function main() {
    log('\n' + '='.repeat(70), 'cyan');
    log('  Exploring SKU_Mapping__c Object in MA Salesforce', 'cyan');
    log('='.repeat(70) + '\n', 'cyan');

    let browser;
    let sessionId;
    let actualInstanceUrl = MA_INSTANCE_URL;

    try {
        // Launch browser - SAME AS WORKING SCRIPT
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

        // Check if on login page
        const currentUrl = page.url();
        if (currentUrl.includes('okta') || currentUrl.includes('login')) {
            log('\n⏳ Waiting for you to complete login...', 'yellow');
            log('   Please log in using Okta SSO in the browser window', 'yellow');
            log('   (Complete any MFA prompts if required)\n', 'yellow');
        }

        // Wait for login - SAME AS WORKING SCRIPT
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

        // Extract cookies - SAME AS WORKING SCRIPT
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

        // Create API context - SAME AS WORKING SCRIPT
        const apiContext = await request.newContext({
            baseURL: actualInstanceUrl,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${sessionId}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ignoreHTTPSErrors: true
        });

        // Close browser early - we have the session
        log('\n🔒 Closing browser...', 'green');
        await browser.close();
        browser = null;

        // ============================================
        // STEP 1: Find SKU-related objects
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 1: Finding SKU-related objects', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        // Get all objects
        log('\n🔍 Fetching list of all Salesforce objects...', 'yellow');
        const globalDescribe = await apiContext.get(`/services/data/${API_VERSION}/sobjects`);
        
        if (!globalDescribe.ok()) {
            throw new Error(`Failed to get sobjects: ${globalDescribe.status()}`);
        }

        const allObjects = await globalDescribe.json();
        const skuObjects = allObjects.sobjects.filter(o => 
            o.name.toLowerCase().includes('sku') || 
            (o.name.toLowerCase().includes('mapping') && o.name.includes('__c'))
        );
        
        log(`\n✅ Found ${skuObjects.length} SKU/Mapping related objects:`, 'green');
        skuObjects.forEach(o => {
            log(`   - ${o.name} (${o.label})`, 'reset');
        });

        // Save the list
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'MA_SKU_Related_Objects.json'),
            JSON.stringify(skuObjects, null, 2)
        );

        // ============================================
        // STEP 2: Describe each SKU-related object
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 2: Analyzing SKU-related objects', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        for (const obj of skuObjects) {
            log(`\n📋 Describing: ${obj.name}`, 'yellow');
            
            const describeResponse = await apiContext.get(`/services/data/${API_VERSION}/sobjects/${obj.name}/describe`);
            
            if (describeResponse.ok()) {
                const describeData = await describeResponse.json();
                
                // Find legacy/old product code fields
                const relevantFields = describeData.fields.filter(f => 
                    f.name.toLowerCase().includes('legacy') ||
                    f.name.toLowerCase().includes('old') ||
                    f.name.toLowerCase().includes('interim') ||
                    f.name.toLowerCase().includes('product') ||
                    f.name.toLowerCase().includes('code') ||
                    f.name.toLowerCase().includes('sku')
                );

                log(`   Found ${relevantFields.length} relevant fields:`, 'green');
                relevantFields.forEach(f => {
                    log(`      ${f.name} -> "${f.label}" (${f.type})`, 'reset');
                });

                // Save fields
                fs.writeFileSync(
                    path.join(OUTPUT_DIR, `MA_${obj.name}_Fields.json`),
                    JSON.stringify(describeData.fields, null, 2)
                );

                // Check for relationships
                const relationshipFields = describeData.fields.filter(f => 
                    f.type === 'reference'
                );
                
                if (relationshipFields.length > 0) {
                    log(`\n   🔗 Relationships:`, 'cyan');
                    relationshipFields.forEach(f => {
                        log(`      ${f.name} -> ${f.referenceTo?.join(', ') || 'N/A'}`, 'reset');
                    });
                }

                // Query sample records
                log(`\n   📊 Sample records from ${obj.name}:`, 'yellow');
                const sampleFields = relevantFields.slice(0, 15).map(f => f.name);
                if (sampleFields.length > 0) {
                    const sampleQuery = `SELECT ${sampleFields.join(', ')} FROM ${obj.name} LIMIT 5`;
                    
                    const queryResponse = await apiContext.get(`/services/data/${API_VERSION}/query?q=${encodeURIComponent(sampleQuery)}`);
                    if (queryResponse.ok()) {
                        const queryData = await queryResponse.json();
                        log(`   Retrieved ${queryData.records.length} sample records`, 'green');
                        
                        queryData.records.forEach((r, i) => {
                            log(`\n   Record ${i + 1}:`, 'yellow');
                            Object.keys(r).filter(k => k !== 'attributes').forEach(k => {
                                if (r[k] !== null && r[k] !== undefined) {
                                    log(`      ${k}: ${r[k]}`, 'reset');
                                }
                            });
                        });

                        // Save sample data
                        fs.writeFileSync(
                            path.join(OUTPUT_DIR, `MA_${obj.name}_Sample.json`),
                            JSON.stringify(queryData, null, 2)
                        );
                    }
                }
            } else {
                log(`   ⚠️ Could not describe: ${describeResponse.status()}`, 'yellow');
            }
        }

        // ============================================
        // STEP 3: Check Product2 child relationships
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 3: Check Product2 child relationships', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        const product2Describe = await apiContext.get(`/services/data/${API_VERSION}/sobjects/Product2/describe`);
        if (product2Describe.ok()) {
            const product2Data = await product2Describe.json();
            
            // Find SKU-related child relationships
            const skuRelatedChildren = product2Data.childRelationships.filter(r =>
                r.childSObject.toLowerCase().includes('sku') ||
                r.childSObject.toLowerCase().includes('mapping') ||
                r.relationshipName?.toLowerCase().includes('sku') ||
                r.relationshipName?.toLowerCase().includes('mapping')
            );

            if (skuRelatedChildren.length > 0) {
                log(`\n🔗 SKU-related child relationships on Product2:`, 'green');
                skuRelatedChildren.forEach(r => {
                    log(`   ${r.relationshipName || '(no name)'} -> ${r.childSObject} (via ${r.field})`, 'reset');
                });

                // Save for reference
                fs.writeFileSync(
                    path.join(OUTPUT_DIR, 'MA_Product2_SKU_Relationships.json'),
                    JSON.stringify(skuRelatedChildren, null, 2)
                );
            } else {
                log('\n⚠️ No SKU-related child relationships found on Product2', 'yellow');
                
                // Show all child relationships
                log('\n📋 All child relationships on Product2:', 'cyan');
                product2Data.childRelationships.slice(0, 20).forEach(r => {
                    log(`   ${r.relationshipName || '(no name)'} -> ${r.childSObject}`, 'reset');
                });
            }
        }

        // Cleanup
        await apiContext.dispose();

        log(`\n${'='.repeat(70)}`, 'green');
        log('  Exploration complete! Check docs/data/ for saved files.', 'green');
        log(`${'='.repeat(70)}\n`, 'green');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        console.error(error);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
