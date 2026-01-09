/**
 * Compare Risk Intelligence Spreadsheet (Production tab) vs Current Accounts Database
 * Focus: Identify record discrepancies and find common factors
 * 
 * Key insight: Spreadsheet uses friendly names, DB uses product codes
 */

const xlsx = require('xlsx');
const path = require('path');

// Use the existing database module which has proper connection settings
const db = require('../database');

// SERVICE NAME MAPPING: Spreadsheet friendly name -> DB product code
const SERVICE_NAME_MAP = {
    'Risk Modeler': 'RI-RISKMODELER',
    'Risk Modeler ': 'RI-RISKMODELER', // Note: there's a trailing space in some entries
    'Data Bridge': 'IC-DATABRIDGE',
    'LI API': 'DATAAPI-LOCINTEL',
    'ExposureIQ': 'RI-EXPOSUREIQ',
    'UnderwriteIQ': 'RI-UNDERWRITEIQ',
    'Exposure Add-on': 'RI-RISKMODELER-EXPOSURE_ADDON',
    'TreatyIQ': 'RI-TREATYIQ',
    'ESG': 'RI-EXPOSUREIQ-ESG',
    'OME': 'RI-OME-NASDAQ',
    'Data Vault': 'RI-DATAVAULT',
    'Risk Data Lake': 'IC-RISKDATALAKE',
    'Cometa': 'RI-COMETA',
    'PCAF': 'RI-EXPOSUREIQ-PCAF',
    'VPN': 'IC-VPN',
    'SiteIQ': 'RI-COD-STN', // SiteIQ may map to COD-STN or be deprecated
    'RiskBrowser': 'RMS-INFORMATION-CENTRAL',
    'UIQ': 'RI-UNDERWRITEIQ'
};

// Reverse mapping for lookup
const DB_CODE_TO_FRIENDLY = {};
Object.entries(SERVICE_NAME_MAP).forEach(([friendly, code]) => {
    DB_CODE_TO_FRIENDLY[code] = friendly;
});

// Helper to normalize service name for comparison
function normalizeService(serviceName) {
    const trimmed = (serviceName || '').trim();
    // Try to map spreadsheet name to DB code
    if (SERVICE_NAME_MAP[trimmed]) {
        return SERVICE_NAME_MAP[trimmed].toLowerCase();
    }
    // Already a DB code? normalize it
    return trimmed.toLowerCase();
}

async function main() {
    console.log('='.repeat(80));
    console.log('RISK INTELLIGENCE SPREADSHEET vs CURRENT ACCOUNTS DATABASE COMPARISON');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Using service name mapping to match spreadsheet → DB codes');
    console.log('');

    // Step 1: Load spreadsheet data
    console.log('📥 Loading Risk Intelligence spreadsheet (Production tab)...');
    const wb = xlsx.readFile(path.join(__dirname, '..', 'Risk Intelligence Onboarded Tenants.xlsx'));
    const ws = wb.Sheets['Production'];
    const spreadsheetData = xlsx.utils.sheet_to_json(ws);
    console.log(`   Loaded ${spreadsheetData.length} rows from spreadsheet`);

    // Step 2: Load database data
    console.log('📥 Loading Current Accounts from database...');
    let dbData = [];
    try {
        const result = await db.query(`
            SELECT 
                client, services, account_type, csm_owner, provisioning_status,
                completion_date, size, region, tenant_name, tenant_url,
                tenant_id, salesforce_account_id, initial_tenant_admin, 
                comments, record_status, ps_record_name
            FROM current_accounts
            WHERE record_status = 'active'
            ORDER BY client, services
        `);
        dbData = result.rows;
        console.log(`   Loaded ${dbData.length} active rows from database`);
    } catch (error) {
        console.error('❌ Database error:', error.message);
        console.log('');
        console.log('Continuing with spreadsheet-only analysis...');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('RECORD COUNT COMPARISON');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Spreadsheet rows: ${spreadsheetData.length}`);
    console.log(`Database rows:    ${dbData.length}`);
    console.log(`Difference:       ${spreadsheetData.length - dbData.length} (spreadsheet ${spreadsheetData.length > dbData.length ? 'has more' : 'has fewer'})`);
    console.log('');

    // Step 3: Normalize data for comparison
    // Create lookup keys: tenant_name + normalized_service (using service mapping)
    
    // Normalize spreadsheet data
    const spreadsheetByKey = new Map();
    const spreadsheetByTenant = new Map();
    const spreadsheetByClient = new Map();
    
    spreadsheetData.forEach(row => {
        const tenantName = (row['Tenant Name'] || '').toLowerCase().trim();
        const serviceRaw = (row['Services'] || '').trim();
        const serviceNormalized = normalizeService(serviceRaw);
        const client = (row['Client'] || '').trim();
        const status = (row['Provisioning status'] || '').trim();
        const region = (row['Region'] || '').trim();
        const type = (row['Type'] || '').trim();
        
        // Use normalized service for matching
        const key = `${tenantName}|${serviceNormalized}`;
        spreadsheetByKey.set(key, { ...row, normalizedTenant: tenantName, normalizedService: serviceNormalized, rawService: serviceRaw });
        
        // Track by tenant
        if (!spreadsheetByTenant.has(tenantName)) {
            spreadsheetByTenant.set(tenantName, []);
        }
        spreadsheetByTenant.get(tenantName).push(row);
        
        // Track by client
        if (!spreadsheetByClient.has(client)) {
            spreadsheetByClient.set(client, []);
        }
        spreadsheetByClient.get(client).push(row);
    });

    // Normalize database data
    const dbByKey = new Map();
    const dbByTenant = new Map();
    const dbByClient = new Map();
    
    dbData.forEach(row => {
        const tenantName = (row.tenant_name || '').toLowerCase().trim();
        const serviceRaw = (row.services || '').trim();
        const serviceNormalized = serviceRaw.toLowerCase(); // DB codes are already normalized
        const client = (row.client || '').trim();
        
        // Use normalized service for matching
        const key = `${tenantName}|${serviceNormalized}`;
        dbByKey.set(key, { ...row, normalizedTenant: tenantName, normalizedService: serviceNormalized, rawService: serviceRaw });
        
        // Track by tenant
        if (!dbByTenant.has(tenantName)) {
            dbByTenant.set(tenantName, []);
        }
        dbByTenant.get(tenantName).push(row);
        
        // Track by client
        if (!dbByClient.has(client)) {
            dbByClient.set(client, []);
        }
        dbByClient.get(client).push(row);
    });

    console.log('='.repeat(80));
    console.log('UNIQUE ENTITY COUNTS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`                    Spreadsheet    Database    Difference`);
    console.log(`Unique tenants:     ${String(spreadsheetByTenant.size).padEnd(14)} ${String(dbByTenant.size).padEnd(11)} ${spreadsheetByTenant.size - dbByTenant.size}`);
    console.log(`Unique clients:     ${String(spreadsheetByClient.size).padEnd(14)} ${String(dbByClient.size).padEnd(11)} ${spreadsheetByClient.size - dbByClient.size}`);
    console.log(`Unique keys:        ${String(spreadsheetByKey.size).padEnd(14)} ${String(dbByKey.size).padEnd(11)} ${spreadsheetByKey.size - dbByKey.size}`);
    console.log('');

    // Step 4: Find discrepancies
    console.log('='.repeat(80));
    console.log('DISCREPANCY ANALYSIS');
    console.log('='.repeat(80));
    console.log('');

    // Records in spreadsheet but NOT in database
    const inSpreadsheetNotDb = [];
    spreadsheetByKey.forEach((row, key) => {
        if (!dbByKey.has(key)) {
            inSpreadsheetNotDb.push({ key, ...row });
        }
    });

    // Records in database but NOT in spreadsheet
    const inDbNotSpreadsheet = [];
    dbByKey.forEach((row, key) => {
        if (!spreadsheetByKey.has(key)) {
            inDbNotSpreadsheet.push({ key, ...row });
        }
    });

    console.log(`Records in SPREADSHEET but NOT in DATABASE: ${inSpreadsheetNotDb.length}`);
    console.log(`Records in DATABASE but NOT in SPREADSHEET: ${inDbNotSpreadsheet.length}`);
    console.log('');

    // Step 5: Analyze common factors in discrepancies
    console.log('='.repeat(80));
    console.log('ANALYSIS: Records in SPREADSHEET but NOT in DATABASE');
    console.log('='.repeat(80));
    console.log('');

    if (inSpreadsheetNotDb.length > 0) {
        // Analyze by provisioning status
        const byStatus = {};
        inSpreadsheetNotDb.forEach(row => {
            const status = row['Provisioning status'] || 'Unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;
        });
        console.log('By Provisioning Status:');
        Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
            const pct = ((count / inSpreadsheetNotDb.length) * 100).toFixed(1);
            console.log(`  ${status}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by service/app
        const byService = {};
        inSpreadsheetNotDb.forEach(row => {
            const service = row['Services'] || 'Unknown';
            byService[service] = (byService[service] || 0) + 1;
        });
        console.log('By Service/App:');
        Object.entries(byService).sort((a, b) => b[1] - a[1]).forEach(([service, count]) => {
            const pct = ((count / inSpreadsheetNotDb.length) * 100).toFixed(1);
            console.log(`  ${service}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by type
        const byType = {};
        inSpreadsheetNotDb.forEach(row => {
            const type = row['Type'] || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        });
        console.log('By Type:');
        Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            const pct = ((count / inSpreadsheetNotDb.length) * 100).toFixed(1);
            console.log(`  ${type}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by region
        const byRegion = {};
        inSpreadsheetNotDb.forEach(row => {
            const region = row['Region'] || 'Unknown';
            byRegion[region] = (byRegion[region] || 0) + 1;
        });
        console.log('By Region:');
        Object.entries(byRegion).sort((a, b) => b[1] - a[1]).forEach(([region, count]) => {
            const pct = ((count / inSpreadsheetNotDb.length) * 100).toFixed(1);
            console.log(`  ${region}: ${count} (${pct}%)`);
        });
        console.log('');

        // Check if tenants exist in DB at all (maybe just missing some services)
        let tenantsExistWithOtherServices = 0;
        let tenantsNotInDbAtAll = 0;
        const missingTenantNames = new Set();
        
        inSpreadsheetNotDb.forEach(row => {
            const tenantName = row.normalizedTenant;
            if (dbByTenant.has(tenantName)) {
                tenantsExistWithOtherServices++;
            } else {
                tenantsNotInDbAtAll++;
                missingTenantNames.add(tenantName);
            }
        });
        
        console.log('Tenant Analysis:');
        console.log(`  Records where tenant EXISTS in DB (but service missing): ${tenantsExistWithOtherServices}`);
        console.log(`  Records where tenant DOES NOT EXIST in DB at all: ${tenantsNotInDbAtAll}`);
        console.log(`  Unique tenants not in DB: ${missingTenantNames.size}`);
        console.log('');

        // List specific tenants not in DB
        if (missingTenantNames.size > 0 && missingTenantNames.size <= 50) {
            console.log('Tenants in spreadsheet but NOT in database:');
            [...missingTenantNames].sort().forEach(tenant => {
                const rows = spreadsheetByTenant.get(tenant);
                const statuses = [...new Set(rows.map(r => r['Provisioning status']))].join(', ');
                const clients = [...new Set(rows.map(r => r['Client']))].join(', ');
                console.log(`  - ${tenant} (Client: ${clients}, Status: ${statuses})`);
            });
            console.log('');
        }

        // Show sample of missing records
        console.log('Sample records in spreadsheet but NOT in database (first 20):');
        console.log('-'.repeat(80));
        inSpreadsheetNotDb.slice(0, 20).forEach((row, i) => {
            console.log(`${i + 1}. ${row['Client']} | ${row['Services']} | Tenant: ${row['Tenant Name']} | Status: ${row['Provisioning status']}`);
        });
        console.log('');
    }

    // Step 6: Analyze records in DB but not spreadsheet
    console.log('='.repeat(80));
    console.log('ANALYSIS: Records in DATABASE but NOT in SPREADSHEET');
    console.log('='.repeat(80));
    console.log('');

    if (inDbNotSpreadsheet.length > 0) {
        // Analyze by provisioning status
        const byStatus = {};
        inDbNotSpreadsheet.forEach(row => {
            const status = row.provisioning_status || 'Unknown';
            byStatus[status] = (byStatus[status] || 0) + 1;
        });
        console.log('By Provisioning Status:');
        Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
            const pct = ((count / inDbNotSpreadsheet.length) * 100).toFixed(1);
            console.log(`  ${status}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by service/app
        const byService = {};
        inDbNotSpreadsheet.forEach(row => {
            const service = row.services || 'Unknown';
            byService[service] = (byService[service] || 0) + 1;
        });
        console.log('By Service/App:');
        Object.entries(byService).sort((a, b) => b[1] - a[1]).forEach(([service, count]) => {
            const pct = ((count / inDbNotSpreadsheet.length) * 100).toFixed(1);
            console.log(`  ${service}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by type
        const byType = {};
        inDbNotSpreadsheet.forEach(row => {
            const type = row.account_type || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        });
        console.log('By Type:');
        Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            const pct = ((count / inDbNotSpreadsheet.length) * 100).toFixed(1);
            console.log(`  ${type}: ${count} (${pct}%)`);
        });
        console.log('');

        // Analyze by region
        const byRegion = {};
        inDbNotSpreadsheet.forEach(row => {
            const region = row.region || 'Unknown';
            byRegion[region] = (byRegion[region] || 0) + 1;
        });
        console.log('By Region:');
        Object.entries(byRegion).sort((a, b) => b[1] - a[1]).forEach(([region, count]) => {
            const pct = ((count / inDbNotSpreadsheet.length) * 100).toFixed(1);
            console.log(`  ${region}: ${count} (${pct}%)`);
        });
        console.log('');

        // Check if tenants exist in spreadsheet at all
        let tenantsExistWithOtherServices = 0;
        let tenantsNotInSpreadsheetAtAll = 0;
        const newTenantNames = new Set();
        
        inDbNotSpreadsheet.forEach(row => {
            const tenantName = row.normalizedTenant;
            if (spreadsheetByTenant.has(tenantName)) {
                tenantsExistWithOtherServices++;
            } else {
                tenantsNotInSpreadsheetAtAll++;
                newTenantNames.add(tenantName);
            }
        });
        
        console.log('Tenant Analysis:');
        console.log(`  Records where tenant EXISTS in spreadsheet (but service missing): ${tenantsExistWithOtherServices}`);
        console.log(`  Records where tenant DOES NOT EXIST in spreadsheet at all: ${tenantsNotInSpreadsheetAtAll}`);
        console.log(`  Unique tenants not in spreadsheet: ${newTenantNames.size}`);
        console.log('');

        // List specific tenants not in spreadsheet
        if (newTenantNames.size > 0 && newTenantNames.size <= 50) {
            console.log('Tenants in database but NOT in spreadsheet:');
            [...newTenantNames].sort().forEach(tenant => {
                const rows = dbByTenant.get(tenant);
                const services = [...new Set(rows.map(r => r.services))].join(', ');
                const clients = [...new Set(rows.map(r => r.client))].join(', ');
                console.log(`  - ${tenant} (Client: ${clients}, Services: ${services})`);
            });
            console.log('');
        }

        // Show sample of records only in DB
        console.log('Sample records in database but NOT in spreadsheet (first 20):');
        console.log('-'.repeat(80));
        inDbNotSpreadsheet.slice(0, 20).forEach((row, i) => {
            console.log(`${i + 1}. ${row.client} | ${row.services} | Tenant: ${row.tenant_name} | Status: ${row.provisioning_status || 'N/A'}`);
        });
        console.log('');
    }

    // Step 7: Service name matching analysis
    console.log('='.repeat(80));
    console.log('SERVICE NAME COMPARISON');
    console.log('='.repeat(80));
    console.log('');

    const spreadsheetServices = new Set(spreadsheetData.map(r => (r['Services'] || '').trim()));
    const dbServices = new Set(dbData.map(r => (r.services || '').trim()));

    console.log('Services in SPREADSHEET:');
    [...spreadsheetServices].sort().forEach(s => {
        const inDb = dbServices.has(s) ? '✅' : '❌';
        console.log(`  ${inDb} ${s}`);
    });
    console.log('');

    console.log('Services in DATABASE only (not in spreadsheet):');
    [...dbServices].filter(s => !spreadsheetServices.has(s)).sort().forEach(s => {
        console.log(`  ➕ ${s}`);
    });
    console.log('');

    // Step 8: Summary findings
    console.log('='.repeat(80));
    console.log('SUMMARY OF KEY FINDINGS');
    console.log('='.repeat(80));
    console.log('');

    if (inSpreadsheetNotDb.length > 0) {
        // Find the most common status for missing records
        const statusCounts = {};
        inSpreadsheetNotDb.forEach(row => {
            const status = row['Provisioning status'] || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        const topStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0];
        
        console.log('📌 SPREADSHEET records missing from DATABASE:');
        console.log(`   - Total missing: ${inSpreadsheetNotDb.length}`);
        console.log(`   - Most common status: "${topStatus[0]}" (${topStatus[1]} records, ${((topStatus[1]/inSpreadsheetNotDb.length)*100).toFixed(1)}%)`);
        
        // Check if offboarded is a major factor
        const offboardedCount = statusCounts['Offboarded'] || 0;
        if (offboardedCount > 0) {
            console.log(`   - Offboarded records: ${offboardedCount} (${((offboardedCount/inSpreadsheetNotDb.length)*100).toFixed(1)}%)`);
        }
        console.log('');
    }

    if (inDbNotSpreadsheet.length > 0) {
        console.log('📌 DATABASE records missing from SPREADSHEET:');
        console.log(`   - Total missing: ${inDbNotSpreadsheet.length}`);
        console.log('   - These are likely NEW entries from SML that haven\'t been added to the spreadsheet');
        console.log('');
    }

    // Step 9: FOCUSED DISCREPANCY ANALYSIS - Tenants that don't exist
    console.log('='.repeat(80));
    console.log('FOCUSED ANALYSIS: TENANTS COMPLETELY MISSING');
    console.log('(DB is source of truth from SML)');
    console.log('='.repeat(80));
    console.log('');

    // Tenants in spreadsheet but NOT in DB at all
    const tenantsOnlyInSpreadsheet = new Set();
    spreadsheetByTenant.forEach((rows, tenant) => {
        if (!dbByTenant.has(tenant)) {
            tenantsOnlyInSpreadsheet.add(tenant);
        }
    });

    // Tenants in DB but NOT in spreadsheet at all
    const tenantsOnlyInDb = new Set();
    dbByTenant.forEach((rows, tenant) => {
        if (!spreadsheetByTenant.has(tenant)) {
            tenantsOnlyInDb.add(tenant);
        }
    });

    console.log(`🔴 Tenants in SPREADSHEET but NOT in DATABASE: ${tenantsOnlyInSpreadsheet.size}`);
    console.log('   (These tenants may have been deprovisioned or renamed in SML)');
    console.log('');
    
    if (tenantsOnlyInSpreadsheet.size > 0) {
        // Analyze why they're missing from DB
        const missingTenantAnalysis = {
            byStatus: {},
            byType: {},
            byRegion: {}
        };
        
        [...tenantsOnlyInSpreadsheet].forEach(tenant => {
            const rows = spreadsheetByTenant.get(tenant);
            rows.forEach(row => {
                const status = row['Provisioning status'] || 'Unknown';
                const type = row['Type'] || 'Unknown';
                const region = row['Region'] || 'Unknown';
                
                missingTenantAnalysis.byStatus[status] = (missingTenantAnalysis.byStatus[status] || 0) + 1;
                missingTenantAnalysis.byType[type] = (missingTenantAnalysis.byType[type] || 0) + 1;
                missingTenantAnalysis.byRegion[region] = (missingTenantAnalysis.byRegion[region] || 0) + 1;
            });
        });
        
        console.log('   Breakdown of records from tenants NOT in DB:');
        console.log('   By Status:');
        Object.entries(missingTenantAnalysis.byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
            console.log(`     - ${status}: ${count}`);
        });
        console.log('   By Type:');
        Object.entries(missingTenantAnalysis.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            console.log(`     - ${type}: ${count}`);
        });
        console.log('');
        
        // List the tenants
        console.log('   List of tenants in spreadsheet but NOT in database:');
        [...tenantsOnlyInSpreadsheet].sort().forEach(tenant => {
            const rows = spreadsheetByTenant.get(tenant);
            const clients = [...new Set(rows.map(r => r['Client']))].join(', ');
            const statuses = [...new Set(rows.map(r => r['Provisioning status']))].join(', ');
            const services = [...new Set(rows.map(r => r['Services']))].join(', ');
            console.log(`     - ${tenant} (Client: ${clients}) - Status: ${statuses}`);
            console.log(`       Services: ${services}`);
        });
        console.log('');
    }

    console.log(`🟢 Tenants in DATABASE but NOT in SPREADSHEET: ${tenantsOnlyInDb.size}`);
    console.log('   (These are NEW tenants from SML not tracked in spreadsheet)');
    console.log('');
    
    if (tenantsOnlyInDb.size > 0 && tenantsOnlyInDb.size <= 100) {
        // Analyze characteristics
        const newTenantAnalysis = {
            byStatus: {},
            byType: {},
            byRegion: {}
        };
        
        [...tenantsOnlyInDb].forEach(tenant => {
            const rows = dbByTenant.get(tenant);
            rows.forEach(row => {
                const status = row.provisioning_status || 'Unknown';
                const type = row.account_type || 'Unknown';
                const region = row.region || 'Unknown';
                
                newTenantAnalysis.byStatus[status] = (newTenantAnalysis.byStatus[status] || 0) + 1;
                newTenantAnalysis.byType[type] = (newTenantAnalysis.byType[type] || 0) + 1;
                newTenantAnalysis.byRegion[region] = (newTenantAnalysis.byRegion[region] || 0) + 1;
            });
        });
        
        console.log('   Breakdown of records from tenants NOT in spreadsheet:');
        console.log('   By Status:');
        Object.entries(newTenantAnalysis.byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
            console.log(`     - ${status}: ${count}`);
        });
        console.log('   By Type:');
        Object.entries(newTenantAnalysis.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
            console.log(`     - ${type}: ${count}`);
        });
        console.log('   By Region:');
        Object.entries(newTenantAnalysis.byRegion).sort((a, b) => b[1] - a[1]).forEach(([region, count]) => {
            console.log(`     - ${region}: ${count}`);
        });
        console.log('');
        
        // List the new tenants
        console.log('   List of tenants in database but NOT in spreadsheet:');
        [...tenantsOnlyInDb].sort().slice(0, 50).forEach(tenant => {
            const rows = dbByTenant.get(tenant);
            const clients = [...new Set(rows.map(r => r.client))].join(', ');
            const services = [...new Set(rows.map(r => r.services))].join(', ');
            console.log(`     - ${tenant} (Client: ${clients})`);
            console.log(`       Services: ${services}`);
        });
        if (tenantsOnlyInDb.size > 50) {
            console.log(`     ... and ${tenantsOnlyInDb.size - 50} more`);
        }
        console.log('');
    }

    // Step 10: Identify common factor - WHY records are missing
    console.log('='.repeat(80));
    console.log('ROOT CAUSE ANALYSIS');
    console.log('='.repeat(80));
    console.log('');

    // Analyze spreadsheet records not in DB by their status
    const spreadsheetNotInDbByStatus = {};
    inSpreadsheetNotDb.forEach(row => {
        const status = row['Provisioning status'] || 'Unknown';
        if (!spreadsheetNotInDbByStatus[status]) {
            spreadsheetNotInDbByStatus[status] = [];
        }
        spreadsheetNotInDbByStatus[status].push(row);
    });

    console.log('📊 Records in Spreadsheet NOT in DB - Grouped by Status:');
    console.log('');
    
    Object.entries(spreadsheetNotInDbByStatus).sort((a, b) => b[1].length - a[1].length).forEach(([status, rows]) => {
        const pct = ((rows.length / inSpreadsheetNotDb.length) * 100).toFixed(1);
        console.log(`Status: "${status}" - ${rows.length} records (${pct}%)`);
        
        // Count how many are from tenants not in DB vs tenants with mismatched services
        let tenantsNotInDb = 0;
        let servicesMismatch = 0;
        
        rows.forEach(row => {
            const tenant = row.normalizedTenant;
            if (!dbByTenant.has(tenant)) {
                tenantsNotInDb++;
            } else {
                servicesMismatch++;
            }
        });
        
        console.log(`  - From tenants NOT in DB: ${tenantsNotInDb}`);
        console.log(`  - From tenants IN DB (service mismatch): ${servicesMismatch}`);
        console.log('');
    });

    // Key insight: Are offboarded records the main discrepancy?
    const offboardedRecords = spreadsheetNotInDbByStatus['Offboarded'] || [];
    if (offboardedRecords.length > 0) {
        console.log('💡 KEY INSIGHT - OFFBOARDED RECORDS:');
        console.log(`   ${offboardedRecords.length} records have status "Offboarded" in spreadsheet`);
        console.log('   These likely explain why they are NOT in the current_accounts DB');
        console.log('   (SML removes offboarded tenants from the active list)');
        console.log('');
    }

    // Close database connection
    await db.closePool();
    console.log('');
    console.log('Analysis complete.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

