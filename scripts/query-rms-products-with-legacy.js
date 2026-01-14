/**
 * Query MA Salesforce for RMS Products with Legacy Product Codes from SKU_Mapping__c
 * 
 * This script:
 * 1. Queries Product2 where L2 Hierarchy = 'Risk Management Solutions'
 * 2. Queries SKU_Mapping__c to get Old_Product_Code_Interim__c (Legacy codes)
 * 3. Joins the data and exports to Excel
 * 
 * Usage: node scripts/query-rms-products-with-legacy.js
 */

const { chromium, request } = require('playwright');
const ExcelJS = require('exceljs');
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
    log('  MA Salesforce - RMS Products with Legacy Codes', 'cyan');
    log('='.repeat(70) + '\n', 'cyan');

    let browser;
    let sessionId;
    let actualInstanceUrl = MA_INSTANCE_URL;

    try {
        // Launch browser
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
        log('✅ Extracting session...', 'green');

        await page.waitForTimeout(3000);

        // Extract cookies
        const cookies = await context.cookies();
        const sidCookie = cookies.find(c => c.name === 'sid');
        const oidCookie = cookies.find(c => c.name === 'oid');

        if (!sidCookie) {
            throw new Error('Could not find session ID cookie');
        }

        sessionId = sidCookie.value;
        log(`✅ Session ID extracted`, 'green');
        if (oidCookie) {
            log(`📋 Organization ID: ${oidCookie.value}`, 'cyan');
        }

        const finalUrl = page.url();
        if (finalUrl.includes('moodysanalytics.lightning.force.com')) {
            actualInstanceUrl = 'https://moodysanalytics.my.salesforce.com';
        }
        log(`📍 Instance URL: ${actualInstanceUrl}`, 'cyan');

        // Close browser - we have the session
        log('\n🔒 Closing browser...', 'green');
        await browser.close();
        browser = null;

        // Create API context
        const apiContext = await request.newContext({
            baseURL: actualInstanceUrl,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${sessionId}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ignoreHTTPSErrors: true
        });

        // ============================================
        // STEP 1: Query RMS Products from Product2
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 1: Querying RMS Products from Product2', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        const productQuery = `SELECT Id, Name, ProductCode, IsActive, L1Hierarchy__c, L2Hierarchy__c, L3Hierarchy__c, L4Hierarchy__c, Legacy_Product_ID__c FROM Product2 WHERE L2Hierarchy__c = '${L2_HIERARCHY_FILTER}' ORDER BY Name ASC`;
        
        log(`\n📊 Query: ${productQuery.substring(0, 100)}...`, 'yellow');

        let allProducts = [];
        let queryUrl = `/services/data/${API_VERSION}/query?q=${encodeURIComponent(productQuery)}`;
        let batchNumber = 1;

        while (queryUrl) {
            log(`   Fetching batch ${batchNumber}...`, 'cyan');
            const response = await apiContext.get(queryUrl);
            
            if (!response.ok()) {
                throw new Error(`Product query failed: ${response.status()}`);
            }

            const data = await response.json();
            allProducts = allProducts.concat(data.records);
            log(`   Retrieved ${data.records.length} (total: ${allProducts.length} / ${data.totalSize})`, 'green');

            queryUrl = data.nextRecordsUrl || null;
            batchNumber++;
        }

        log(`\n✅ Total RMS Products: ${allProducts.length}`, 'green');

        // Create a map of ProductCode -> Product for easy lookup
        const productByCode = new Map();
        const productById = new Map();
        allProducts.forEach(p => {
            if (p.ProductCode) productByCode.set(p.ProductCode, p);
            if (p.Id) productById.set(p.Id, p);
        });

        // ============================================
        // STEP 2: Query SKU_Mapping__c for Legacy Codes
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 2: Querying SKU_Mapping__c for Legacy Codes', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        // Query SKU mappings - get the legacy codes
        const skuQuery = `SELECT Id, New_Product_ID__c, New_Product_Code__c, New_Product_Name__c, Old_Product_Code__c, Old_Product_Name__c, Old_Product_Code_Interim__c, Old_Product_Name_Interim__c FROM SKU_Mapping__c WHERE Old_Product_Code_Interim__c != null ORDER BY New_Product_Code__c`;

        log(`\n📊 Query: ${skuQuery.substring(0, 100)}...`, 'yellow');

        let allSkuMappings = [];
        queryUrl = `/services/data/${API_VERSION}/query?q=${encodeURIComponent(skuQuery)}`;
        batchNumber = 1;

        while (queryUrl) {
            log(`   Fetching batch ${batchNumber}...`, 'cyan');
            const response = await apiContext.get(queryUrl);
            
            if (!response.ok()) {
                const errorText = await response.text();
                log(`   ⚠️ SKU query error: ${response.status()} - ${errorText.substring(0, 200)}`, 'yellow');
                break;
            }

            const data = await response.json();
            allSkuMappings = allSkuMappings.concat(data.records);
            log(`   Retrieved ${data.records.length} (total: ${allSkuMappings.length} / ${data.totalSize})`, 'green');

            queryUrl = data.nextRecordsUrl || null;
            batchNumber++;
        }

        log(`\n✅ Total SKU Mappings with Legacy Codes: ${allSkuMappings.length}`, 'green');

        // Create a map of ProductId -> Legacy Codes (can have multiple)
        const legacyByProductId = new Map();
        const legacyByProductCode = new Map();

        allSkuMappings.forEach(sku => {
            // Map by Product ID
            if (sku.New_Product_ID__c) {
                if (!legacyByProductId.has(sku.New_Product_ID__c)) {
                    legacyByProductId.set(sku.New_Product_ID__c, []);
                }
                legacyByProductId.get(sku.New_Product_ID__c).push({
                    legacyCode: sku.Old_Product_Code_Interim__c,
                    legacyName: sku.Old_Product_Name_Interim__c,
                    oldProductCode: sku.Old_Product_Code__c,
                    oldProductName: sku.Old_Product_Name__c
                });
            }

            // Also map by Product Code
            if (sku.New_Product_Code__c) {
                if (!legacyByProductCode.has(sku.New_Product_Code__c)) {
                    legacyByProductCode.set(sku.New_Product_Code__c, []);
                }
                legacyByProductCode.get(sku.New_Product_Code__c).push({
                    legacyCode: sku.Old_Product_Code_Interim__c,
                    legacyName: sku.Old_Product_Name_Interim__c,
                    oldProductCode: sku.Old_Product_Code__c,
                    oldProductName: sku.Old_Product_Name__c
                });
            }
        });

        // ============================================
        // STEP 3: Merge Data and Create Output
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 3: Merging Data', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        // Merge legacy codes into products
        const mergedProducts = allProducts.map(p => {
            // Try to find legacy codes by Product ID first, then by Product Code
            let legacyCodes = legacyByProductId.get(p.Id) || legacyByProductCode.get(p.ProductCode) || [];
            
            // Get unique legacy codes (there may be duplicates)
            const uniqueLegacyCodes = [...new Set(legacyCodes.map(l => l.legacyCode))].filter(Boolean);
            
            return {
                Id: p.Id,
                ProductName: p.Name,
                ProductCode: p.ProductCode,
                IsActive: p.IsActive,
                L1Hierarchy: p.L1Hierarchy__c,
                L2Hierarchy: p.L2Hierarchy__c,
                L3Hierarchy: p.L3Hierarchy__c,
                L4Hierarchy: p.L4Hierarchy__c,
                LegacyProductCode_Direct: p.Legacy_Product_ID__c || '',
                LegacyProductCodes_SKU: uniqueLegacyCodes.join('; '),
                LegacyCount: uniqueLegacyCodes.length
            };
        });

        // Count products with legacy codes
        const productsWithLegacy = mergedProducts.filter(p => p.LegacyProductCodes_SKU || p.LegacyProductCode_Direct);
        log(`\n✅ Products with Legacy Codes: ${productsWithLegacy.length} / ${mergedProducts.length}`, 'green');

        // Show sample of products with legacy codes
        log(`\n📋 Sample products with Legacy Codes:`, 'yellow');
        productsWithLegacy.slice(0, 10).forEach((p, i) => {
            log(`   ${i + 1}. ${p.ProductName} (${p.ProductCode})`, 'reset');
            log(`      Legacy: ${p.LegacyProductCodes_SKU || p.LegacyProductCode_Direct}`, 'cyan');
        });

        // ============================================
        // STEP 4: Save to JSON
        // ============================================
        log(`\n${'─'.repeat(70)}`, 'cyan');
        log('  Step 4: Saving Results', 'cyan');
        log(`${'─'.repeat(70)}`, 'cyan');

        const jsonOutput = {
            query: 'RMS Products with Legacy Codes from SKU_Mapping__c',
            filter: `L2 Hierarchy = '${L2_HIERARCHY_FILTER}'`,
            totalProducts: mergedProducts.length,
            productsWithLegacyCodes: productsWithLegacy.length,
            retrievedAt: new Date().toISOString(),
            records: mergedProducts
        };

        const jsonFile = path.join(OUTPUT_DIR, 'MA_RMS_Products_With_Legacy.json');
        fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
        log(`\n💾 Saved JSON to: ${jsonFile}`, 'green');

        // ============================================
        // STEP 5: Create Excel File
        // ============================================
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'DeployAssist';
        workbook.created = new Date();

        // Main sheet - RMS Products with Legacy Codes
        const mainSheet = workbook.addWorksheet('RMS Products', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        mainSheet.columns = [
            { header: 'Product Name', key: 'name', width: 50 },
            { header: 'Product Code', key: 'code', width: 15 },
            { header: 'Active', key: 'active', width: 10 },
            { header: 'L1 Hierarchy', key: 'l1', width: 20 },
            { header: 'L2 Hierarchy', key: 'l2', width: 28 },
            { header: 'L3 Hierarchy', key: 'l3', width: 20 },
            { header: 'L4 Hierarchy', key: 'l4', width: 25 },
            { header: 'Legacy Product Code (SKU Mapping)', key: 'legacySku', width: 35 },
            { header: 'Legacy Code Count', key: 'legacyCount', width: 18 }
        ];

        // Style header
        mainSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        mainSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        // Add data
        mergedProducts.forEach(p => {
            mainSheet.addRow({
                name: p.ProductName,
                code: p.ProductCode,
                active: p.IsActive ? 'Yes' : 'No',
                l1: p.L1Hierarchy,
                l2: p.L2Hierarchy,
                l3: p.L3Hierarchy,
                l4: p.L4Hierarchy,
                legacySku: p.LegacyProductCodes_SKU,
                legacyCount: p.LegacyCount
            });
        });

        // Auto filter
        mainSheet.autoFilter = { from: 'A1', to: 'I1' };

        // Highlight rows with legacy codes
        mainSheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                const legacyCount = row.getCell('legacyCount').value;
                if (legacyCount > 0) {
                    row.getCell('legacySku').fill = { 
                        type: 'pattern', 
                        pattern: 'solid', 
                        fgColor: { argb: 'FFE2EFDA' } 
                    };
                }
            }
        });

        // Summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 40 },
            { header: 'Value', key: 'value', width: 20 }
        ];

        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        const activeProducts = mergedProducts.filter(p => p.IsActive);
        const inactiveProducts = mergedProducts.filter(p => !p.IsActive);

        summarySheet.addRow({ metric: 'Total RMS Products', value: mergedProducts.length });
        summarySheet.addRow({ metric: 'Active Products', value: activeProducts.length });
        summarySheet.addRow({ metric: 'Inactive Products', value: inactiveProducts.length });
        summarySheet.addRow({ metric: 'Products with Legacy Codes', value: productsWithLegacy.length });
        summarySheet.addRow({ metric: 'Products without Legacy Codes', value: mergedProducts.length - productsWithLegacy.length });
        summarySheet.addRow({ metric: 'Total SKU Mappings Retrieved', value: allSkuMappings.length });
        summarySheet.addRow({ metric: 'Retrieved At', value: new Date().toISOString() });

        // Products with Legacy sheet
        const legacySheet = workbook.addWorksheet('Products with Legacy', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        legacySheet.columns = [
            { header: 'Product Name', key: 'name', width: 50 },
            { header: 'Product Code', key: 'code', width: 15 },
            { header: 'Active', key: 'active', width: 10 },
            { header: 'L3 Hierarchy', key: 'l3', width: 20 },
            { header: 'Legacy Product Codes', key: 'legacy', width: 50 },
            { header: 'Count', key: 'count', width: 10 }
        ];

        legacySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        legacySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        productsWithLegacy.forEach(p => {
            legacySheet.addRow({
                name: p.ProductName,
                code: p.ProductCode,
                active: p.IsActive ? 'Yes' : 'No',
                l3: p.L3Hierarchy,
                legacy: p.LegacyProductCodes_SKU,
                count: p.LegacyCount
            });
        });

        legacySheet.autoFilter = { from: 'A1', to: 'F1' };

        // Save Excel
        const excelFile = path.join(OUTPUT_DIR, 'MA_RMS_Products_With_Legacy.xlsx');
        await workbook.xlsx.writeFile(excelFile);
        log(`💾 Saved Excel to: ${excelFile}`, 'green');

        // Cleanup
        await apiContext.dispose();

        log(`\n${'='.repeat(70)}`, 'green');
        log('  Script completed successfully!', 'green');
        log(`${'='.repeat(70)}\n`, 'green');

        log('📊 Summary:', 'cyan');
        log(`   Total RMS Products: ${mergedProducts.length}`, 'reset');
        log(`   Products with Legacy Codes: ${productsWithLegacy.length}`, 'reset');
        log(`   SKU Mappings Retrieved: ${allSkuMappings.length}`, 'reset');

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        console.error(error);
        if (browser) await browser.close();
        process.exit(1);
    }
}

main();
