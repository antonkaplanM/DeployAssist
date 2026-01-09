/**
 * Export Discrepancy Report - Creates Excel file with two tabs:
 * 1. Tenants in spreadsheet but NOT in DB (excluding Offboarded)
 * 2. Tenants in DB but NOT in spreadsheet (excluding COD-related)
 */

const xlsx = require('xlsx');
const path = require('path');
const db = require('../database');

// SERVICE NAME MAPPING: Spreadsheet friendly name -> DB product code
const SERVICE_NAME_MAP = {
    'Risk Modeler': 'RI-RISKMODELER',
    'Risk Modeler ': 'RI-RISKMODELER',
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
    'SiteIQ': 'RI-COD-STN',
    'RiskBrowser': 'RMS-INFORMATION-CENTRAL',
    'UIQ': 'RI-UNDERWRITEIQ'
};

function normalizeService(serviceName) {
    const trimmed = (serviceName || '').trim();
    if (SERVICE_NAME_MAP[trimmed]) {
        return SERVICE_NAME_MAP[trimmed].toLowerCase();
    }
    return trimmed.toLowerCase();
}

async function main() {
    console.log('='.repeat(60));
    console.log('GENERATING DISCREPANCY REPORT');
    console.log('='.repeat(60));
    console.log('');

    // Load spreadsheet data
    console.log('📥 Loading Risk Intelligence spreadsheet...');
    const wb = xlsx.readFile(path.join(__dirname, '..', 'Risk Intelligence Onboarded Tenants.xlsx'));
    const ws = wb.Sheets['Production'];
    const spreadsheetData = xlsx.utils.sheet_to_json(ws);
    console.log(`   Loaded ${spreadsheetData.length} rows from spreadsheet`);

    // Load database data
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
        await db.closePool();
        process.exit(1);
    }

    // Build lookup maps
    const spreadsheetByKey = new Map();
    const spreadsheetByTenant = new Map();
    
    spreadsheetData.forEach(row => {
        const tenantName = (row['Tenant Name'] || '').toLowerCase().trim();
        const serviceRaw = (row['Services'] || '').trim();
        const serviceNormalized = normalizeService(serviceRaw);
        
        const key = `${tenantName}|${serviceNormalized}`;
        spreadsheetByKey.set(key, { ...row, normalizedTenant: tenantName, normalizedService: serviceNormalized });
        
        if (!spreadsheetByTenant.has(tenantName)) {
            spreadsheetByTenant.set(tenantName, []);
        }
        spreadsheetByTenant.get(tenantName).push(row);
    });

    const dbByKey = new Map();
    const dbByTenant = new Map();
    
    dbData.forEach(row => {
        const tenantName = (row.tenant_name || '').toLowerCase().trim();
        const serviceRaw = (row.services || '').trim();
        const serviceNormalized = serviceRaw.toLowerCase();
        
        const key = `${tenantName}|${serviceNormalized}`;
        dbByKey.set(key, { ...row, normalizedTenant: tenantName, normalizedService: serviceNormalized });
        
        if (!dbByTenant.has(tenantName)) {
            dbByTenant.set(tenantName, []);
        }
        dbByTenant.get(tenantName).push(row);
    });

    // ========================================
    // TAB 1: Spreadsheet tenants NOT in DB (excluding Offboarded)
    // ========================================
    console.log('');
    console.log('📊 Processing Tab 1: Spreadsheet records not in DB (non-Offboarded)...');
    
    const tab1Data = [];
    
    spreadsheetByKey.forEach((row, key) => {
        // Check if record exists in DB
        if (!dbByKey.has(key)) {
            const status = (row['Provisioning status'] || '').trim();
            // Exclude Offboarded records
            if (status.toLowerCase() !== 'offboarded') {
                tab1Data.push({
                    'Tenant Name': row['Tenant Name'] || '',
                    'Client': row['Client'] || '',
                    'Services': row['Services'] || '',
                    'Provisioning Status': status,
                    'Type': row['Type'] || '',
                    'Region': row['Region'] || '',
                    'CSM/Owner': row['CSM/Owner'] || '',
                    'Completion Date': row['Completion Date'] || '',
                    'Tenant URL': row['Tenant URL'] || '',
                    'Salesforce Account ID': row['Salesforce Account ID'] || '',
                    'Notes': row['Notes'] || ''
                });
            }
        }
    });

    // Sort by client name
    tab1Data.sort((a, b) => (a['Client'] || '').localeCompare(b['Client'] || ''));
    
    console.log(`   Found ${tab1Data.length} non-Offboarded records in spreadsheet but NOT in DB`);

    // ========================================
    // TAB 2: DB tenants NOT in Spreadsheet (excluding COD)
    // ========================================
    console.log('📊 Processing Tab 2: DB records not in Spreadsheet (non-COD)...');
    
    const tab2Data = [];
    
    dbByKey.forEach((row, key) => {
        // Check if record exists in spreadsheet
        if (!spreadsheetByKey.has(key)) {
            const service = (row.services || '').toUpperCase();
            // Exclude COD-related records
            if (!service.includes('COD')) {
                tab2Data.push({
                    'Tenant Name': row.tenant_name || '',
                    'Client': row.client || '',
                    'Services': row.services || '',
                    'Provisioning Status': row.provisioning_status || '',
                    'Type': row.account_type || '',
                    'Region': row.region || '',
                    'CSM/Owner': row.csm_owner || '',
                    'Completion Date': row.completion_date || '',
                    'Tenant URL': row.tenant_url || '',
                    'Salesforce Account ID': row.salesforce_account_id || '',
                    'PS Record Name': row.ps_record_name || '',
                    'Comments': row.comments || ''
                });
            }
        }
    });

    // Sort by client name
    tab2Data.sort((a, b) => (a['Client'] || '').localeCompare(b['Client'] || ''));
    
    console.log(`   Found ${tab2Data.length} non-COD records in DB but NOT in spreadsheet`);

    // ========================================
    // Create Excel file with two sheets
    // ========================================
    console.log('');
    console.log('📝 Creating Excel file...');
    
    const newWorkbook = xlsx.utils.book_new();
    
    // Add Tab 1
    const sheet1 = xlsx.utils.json_to_sheet(tab1Data);
    xlsx.utils.book_append_sheet(newWorkbook, sheet1, 'Spreadsheet Only (Active)');
    
    // Add Tab 2
    const sheet2 = xlsx.utils.json_to_sheet(tab2Data);
    xlsx.utils.book_append_sheet(newWorkbook, sheet2, 'DB Only (Non-COD)');
    
    // Write file
    const outputPath = path.join(__dirname, '..', 'docs', 'data', 'RI-DB-Discrepancy-Report.xlsx');
    xlsx.writeFile(newWorkbook, outputPath);
    
    console.log(`✅ Report saved to: ${outputPath}`);
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Tab 1 - Spreadsheet Only (Active): ${tab1Data.length} records`);
    console.log(`Tab 2 - DB Only (Non-COD): ${tab2Data.length} records`);
    console.log('');

    await db.closePool();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

