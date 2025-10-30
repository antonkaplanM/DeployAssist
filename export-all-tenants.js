/**
 * Export All SML Tenants to Excel
 * Fetches all tenants and their entitlements from SML and exports to Excel
 */

const { chromium } = require('@playwright/test');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;

// SML Configuration
const SML_CONFIG_FILE = '.sml_config.json';
const CHECKPOINT_FILE = '.sml_export_checkpoint.json';
const TENANTS_CACHE_FILE = '.sml_tenants_cache.json';

async function loadSMLConfig() {
    try {
        const configData = await fs.readFile(SML_CONFIG_FILE, 'utf8');
        const config = JSON.parse(configData);
        console.log('✅ SML configuration loaded');
        return config;
    } catch (error) {
        console.error('❌ Failed to load SML configuration:', error.message);
        throw new Error('SML configuration not found. Please configure SML in Settings first.');
    }
}

async function loadCheckpoint() {
    try {
        const checkpointData = await fs.readFile(CHECKPOINT_FILE, 'utf8');
        const checkpoint = JSON.parse(checkpointData);
        console.log(`📂 Found checkpoint: ${checkpoint.processedTenants} tenants processed, ${checkpoint.entitlements.length} entitlements collected`);
        return checkpoint;
    } catch (error) {
        console.log('📂 No checkpoint found, starting fresh');
        return {
            processedTenants: 0,
            processedTenantIds: [],
            entitlements: [],
            lastUpdated: new Date().toISOString()
        };
    }
}

async function saveCheckpoint(checkpoint) {
    try {
        checkpoint.lastUpdated = new Date().toISOString();
        await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
        console.warn('⚠️  Failed to save checkpoint:', error.message);
    }
}

async function loadTenantsCache() {
    try {
        const cacheData = await fs.readFile(TENANTS_CACHE_FILE, 'utf8');
        const cache = JSON.parse(cacheData);
        console.log(`📂 Loaded tenants cache: ${cache.tenants.length} tenants`);
        return cache.tenants;
    } catch (error) {
        console.log('📂 No tenants cache found');
        return null;
    }
}

async function saveTenantsCache(tenants) {
    try {
        await fs.writeFile(TENANTS_CACHE_FILE, JSON.stringify({
            tenants,
            cachedAt: new Date().toISOString()
        }, null, 2));
        console.log(`📂 Saved tenants cache: ${tenants.length} tenants`);
    } catch (error) {
        console.warn('⚠️  Failed to save tenants cache:', error.message);
    }
}

async function fetchAllTenants(config) {
    let browser;
    const allTenants = [];
    
    try {
        const BASE_URL = config.environment === 'euw1' 
            ? 'https://api-euw1.rms.com' 
            : 'https://api-use1.rms.com';
        
        console.log('🚀 Launching headless browser...');
        browser = await chromium.launch({
            headless: true,
            args: ['--ignore-certificate-errors']
        });
        
        const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${config.authCookie}`,
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const page = await context.newPage();
        
        const pageSize = 100;
        const maxPages = 100; // Safety limit
        let pageNum = 1;
        
        console.log('📥 Fetching all tenants...');
        
        for (pageNum = 1; pageNum <= maxPages; pageNum++) {
            let url = `${BASE_URL}/sml/tenant-provisioning/v1/tenants/?includingTaskDetail=false&isDeleted=false&pageSize=${pageSize}`;
            
            if (pageNum > 1) {
                const nextLink = await page.evaluate(() => window.__nextLink);
                if (!nextLink) {
                    console.log(`   No more pages (nextLink is null)`);
                    break;
                }
                
                let nextLinkParam;
                if (typeof nextLink === 'string') {
                    nextLinkParam = nextLink;
                } else {
                    nextLinkParam = encodeURIComponent(JSON.stringify(nextLink));
                }
                
                url += `&nextLink=${nextLinkParam}`;
            }
            
            console.log(`   Page ${pageNum}: Fetching...`);
            
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            const status = response.status();
            
            if (status !== 200) {
                throw new Error(`API request failed with status ${status}`);
            }

            const data = await response.json();
            const tenants = data.value || [];
            
            console.log(`   Page ${pageNum}: Found ${tenants.length} tenants`);
            allTenants.push(...tenants);
            
            // Store nextLink for next iteration
            if (data.nextLink) {
                await page.evaluate((link) => { window.__nextLink = link; }, data.nextLink);
            }
            
            if (!data.hasNext) {
                console.log(`   No more pages (hasNext: false)`);
                break;
            }
        }
        
        console.log(`✅ Total tenants fetched: ${allTenants.length}`);
        return allTenants;
        
    } catch (error) {
        console.error('❌ Error fetching tenants:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }
}

async function fetchTenantDetails(config, tenantId) {
    let browser;
    
    try {
        const BASE_URL = config.environment === 'euw1' 
            ? 'https://api-euw1.rms.com' 
            : 'https://api-use1.rms.com';
        
        browser = await chromium.launch({
            headless: true,
            args: ['--ignore-certificate-errors']
        });
        
        const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            extraHTTPHeaders: {
                'Authorization': `Bearer ${config.authCookie}`,
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const page = await context.newPage();
        
        const url = `${BASE_URL}/sml/tenant-provisioning/v1/tenants/${encodeURIComponent(tenantId)}?expandModels=true&includingDetail=true`;
        
        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        const status = response.status();

        if (status !== 200) {
            throw new Error(`API request failed with status ${status}`);
        }

        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error(`❌ Error fetching details for tenant ${tenantId}:`, error.message);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

function determineProductCategory(productCode) {
    if (!productCode) return 'Unknown';
    
    const code = productCode.toUpperCase();
    
    // Data products
    if (code.includes('DATA') || code.includes('DATASET') || code.includes('EXPOSURE') || 
        code.includes('GEOGRAPHY') || code.includes('HAZARD')) {
        return 'Data';
    }
    
    // App products
    if (code.includes('APP') || code.includes('PLATFORM') || code.includes('PORTAL') ||
        code.includes('ANALYTICS') || code.includes('DASHBOARD')) {
        return 'Apps';
    }
    
    // Model products
    if (code.includes('MODEL') || code.includes('RISK') || code.includes('ENGINE')) {
        return 'Models';
    }
    
    // Default based on patterns
    if (code.match(/^[A-Z]{2,3}$/)) return 'Models'; // e.g., EQ, TC, FL
    if (code.includes('-')) return 'Data'; // e.g., US-EXPOSURES
    
    return 'Unknown';
}

function extractEntitlements(tenantDetails, tenantName, tenantId) {
    const rows = [];
    
    if (!tenantDetails || !tenantDetails.extensionData) {
        console.warn(`   ⚠️  No extension data for tenant ${tenantName} (${tenantId})`);
        return rows;
    }
    
    const extensionData = tenantDetails.extensionData;
    
    // Process App Entitlements
    const appEntitlements = extensionData.appEntitlements || [];
    appEntitlements.forEach(entitlement => {
        rows.push({
            tenantName: tenantName,
            tenantId: tenantId,
            productCategory: 'Apps',
            productCode: entitlement.productCode || '',
            quantity: entitlement.quantity || 1,
            packageName: entitlement.packageName || entitlement.package || '',
            startDate: entitlement.startDate || '',
            endDate: entitlement.endDate || ''
        });
    });
    
    // Process Model Entitlements
    const modelEntitlements = extensionData.modelEntitlements || [];
    modelEntitlements.forEach(entitlement => {
        rows.push({
            tenantName: tenantName,
            tenantId: tenantId,
            productCategory: 'Models',
            productCode: entitlement.productCode || '',
            quantity: entitlement.quantity || 1,
            packageName: entitlement.packageName || entitlement.package || '',
            startDate: entitlement.startDate || '',
            endDate: entitlement.endDate || ''
        });
    });
    
    // Process Data Entitlements
    const dataEntitlements = extensionData.dataEntitlements || [];
    dataEntitlements.forEach(entitlement => {
        rows.push({
            tenantName: tenantName,
            tenantId: tenantId,
            productCategory: 'Data',
            productCode: entitlement.productCode || '',
            quantity: entitlement.quantity || 1,
            packageName: entitlement.packageName || entitlement.package || '',
            startDate: entitlement.startDate || '',
            endDate: entitlement.endDate || ''
        });
    });
    
    return rows;
}

async function exportToExcel(data, filename) {
    console.log(`📊 Creating Excel workbook...`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SML Tenants');
    
    // Define columns
    worksheet.columns = [
        { header: 'Tenant Name', key: 'tenantName', width: 30 },
        { header: 'Tenant ID', key: 'tenantId', width: 15 },
        { header: 'Product Category', key: 'productCategory', width: 15 },
        { header: 'Product Code', key: 'productCode', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Package Name', key: 'packageName', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'End Date', key: 'endDate', width: 15 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Add data rows
    data.forEach(row => {
        worksheet.addRow(row);
    });
    
    // Add filters
    worksheet.autoFilter = {
        from: 'A1',
        to: 'H1'
    };
    
    // Freeze header row
    worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
    
    // Save workbook
    await workbook.xlsx.writeFile(filename);
    console.log(`✅ Excel file created: ${filename}`);
}

async function main() {
    let checkpoint = null;
    
    try {
        console.log('🚀 Starting SML Tenant Export with Checkpoint/Resume...');
        console.log('');
        
        // Load SML configuration
        const config = await loadSMLConfig();
        console.log(`   Environment: ${config.environment}`);
        console.log('');
        
        // Load checkpoint
        checkpoint = await loadCheckpoint();
        console.log('');
        
        // Fetch all tenants (use cache if available)
        let tenants = await loadTenantsCache();
        if (!tenants) {
            tenants = await fetchAllTenants(config);
            await saveTenantsCache(tenants);
        } else {
            console.log('✅ Using cached tenant list');
        }
        console.log('');
        
        // Filter out already processed tenants
        const remainingTenants = tenants.filter(t => !checkpoint.processedTenantIds.includes(t.tenantId));
        
        if (remainingTenants.length === 0) {
            console.log('✅ All tenants already processed!');
            console.log('');
        } else {
            console.log(`📦 Processing ${remainingTenants.length} remaining tenants (${checkpoint.processedTenants} already done)...`);
            console.log('');
            
            let successCount = 0;
            let errorCount = 0;
            let tokenExpired = false;
            
            for (let i = 0; i < remainingTenants.length; i++) {
                const tenant = remainingTenants[i];
                const tenantName = tenant.tenantName || tenant.tenantId;
                const tenantId = tenant.tenantId;
                
                const totalProcessed = checkpoint.processedTenants + i + 1;
                console.log(`   [${totalProcessed}/${tenants.length}] ${tenantName} (${tenantId})`);
                
                try {
                    const details = await fetchTenantDetails(config, tenantId);
                    
                    if (details) {
                        const rows = extractEntitlements(details, tenantName, tenantId);
                        checkpoint.entitlements.push(...rows);
                        console.log(`      ✅ ${rows.length} entitlements extracted`);
                        successCount++;
                    } else {
                        console.log(`      ⚠️  Failed to fetch details`);
                        errorCount++;
                    }
                    
                    // Mark as processed
                    checkpoint.processedTenantIds.push(tenantId);
                    checkpoint.processedTenants++;
                    
                    // Save checkpoint every 10 tenants
                    if (checkpoint.processedTenants % 10 === 0) {
                        await saveCheckpoint(checkpoint);
                        console.log(`      💾 Checkpoint saved (${checkpoint.processedTenants} tenants, ${checkpoint.entitlements.length} entitlements)`);
                    }
                    
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`      ❌ Error: ${error.message}`);
                    
                    // Check if token expired
                    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                        console.log('');
                        console.log('🔑 Token expired! Saving progress...');
                        tokenExpired = true;
                        errorCount++;
                        break;
                    }
                    
                    errorCount++;
                }
            }
            
            // Save final checkpoint
            await saveCheckpoint(checkpoint);
            
            console.log('');
            console.log(`✅ Processed: ${successCount} successful, ${errorCount} errors`);
            
            if (tokenExpired) {
                console.log('');
                console.log('⚠️  Token expired during processing');
                console.log(`📊 Collected ${checkpoint.entitlements.length} entitlements so far`);
                console.log('');
                console.log('To continue:');
                console.log('1. Update the SML token in the app settings');
                console.log('2. Run this script again - it will resume from where it left off');
            }
        }
        
        console.log('');
        console.log(`📊 Total entitlements collected: ${checkpoint.entitlements.length}`);
        console.log('');
        
        // Export to Excel
        const timestamp = new Date().toISOString().split('T')[0];
        const completionStatus = checkpoint.processedTenants === tenants.length ? 'Complete' : 'Partial';
        const filename = `SML_Tenants_Export_${completionStatus}_${timestamp}.xlsx`;
        await exportToExcel(checkpoint.entitlements, filename);
        
        console.log('');
        console.log('🎉 Export complete!');
        console.log(`   File: ${filename}`);
        console.log(`   Status: ${completionStatus} (${checkpoint.processedTenants}/${tenants.length} tenants)`);
        console.log(`   Total rows: ${checkpoint.entitlements.length}`);
        console.log('');
        
        // Summary by category
        const summary = {
            Apps: checkpoint.entitlements.filter(r => r.productCategory === 'Apps').length,
            Models: checkpoint.entitlements.filter(r => r.productCategory === 'Models').length,
            Data: checkpoint.entitlements.filter(r => r.productCategory === 'Data').length
        };
        
        console.log('📈 Summary by Category:');
        console.log(`   Apps: ${summary.Apps}`);
        console.log(`   Models: ${summary.Models}`);
        console.log(`   Data: ${summary.Data}`);
        
        if (checkpoint.processedTenants === tenants.length) {
            console.log('');
            console.log('✅ All tenants processed! Cleaning up checkpoint files...');
            try {
                await fs.unlink(CHECKPOINT_FILE);
                await fs.unlink(TENANTS_CACHE_FILE);
                console.log('✅ Checkpoint files removed');
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
    } catch (error) {
        console.error('');
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
        
        // Try to save checkpoint even on error
        if (checkpoint) {
            await saveCheckpoint(checkpoint);
            console.log('💾 Progress saved to checkpoint');
        }
        
        process.exit(1);
    }
}

// Run the script
main();

