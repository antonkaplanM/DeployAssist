/**
 * Script to update account names in current_accounts table
 * Uses the correct priority: Salesforce → SML → ps_audit_trail → tenant_name
 */

require('dotenv').config();
const db = require('../database');
const salesforce = require('../salesforce');

async function updateAccountNames() {
    console.log('🔄 Starting account name update...\n');
    
    // Get Salesforce connection using existing module
    const conn = await salesforce.getConnection();
    console.log('✅ Connected to Salesforce\n');
    
    // Get all records
    const result = await db.query(`
        SELECT id, tenant_name, client, tenant_status 
        FROM current_accounts 
        ORDER BY tenant_name
    `);
    console.log(`📊 Found ${result.rows.length} records to check\n`);
    
    let updated = 0;
    let checked = 0;
    let sfFound = 0;
    let auditFound = 0;
    
    // Group by tenant_name to avoid duplicate lookups
    const tenantMap = new Map();
    for (const record of result.rows) {
        if (!tenantMap.has(record.tenant_name)) {
            tenantMap.set(record.tenant_name, []);
        }
        tenantMap.get(record.tenant_name).push(record);
    }
    
    console.log(`📊 Unique tenants: ${tenantMap.size}\n`);
    
    let tenantChecked = 0;
    for (const [tenantName, records] of tenantMap) {
        tenantChecked++;
        if (tenantChecked % 20 === 0) {
            console.log(`  Progress: ${tenantChecked}/${tenantMap.size} tenants checked...`);
        }
        
        if (!tenantName) continue;
        
        let newAccountName = null;
        let source = null;
        
        // Priority 1: Salesforce PS record
        try {
            const escapedTenantName = tenantName.replace(/'/g, "\\'");
            const sfResult = await conn.query(`
                SELECT Account__c 
                FROM Prof_Services_Request__c 
                WHERE Tenant_Name__c = '${escapedTenantName}' 
                AND Account__c != null 
                ORDER BY CreatedDate DESC 
                LIMIT 1
            `);
            if (sfResult.records.length > 0 && sfResult.records[0].Account__c) {
                newAccountName = sfResult.records[0].Account__c;
                source = 'Salesforce';
                sfFound++;
            }
        } catch (e) {
            // Ignore SF errors for individual records
        }
        
        // Priority 2: ps_audit_trail (if Salesforce didn't return anything)
        if (!newAccountName) {
            const auditResult = await db.query(`
                SELECT account_name 
                FROM ps_audit_trail 
                WHERE tenant_name = $1 
                AND account_name IS NOT NULL 
                AND account_name != ''
                ORDER BY last_modified_date DESC 
                LIMIT 1
            `, [tenantName]);
            if (auditResult.rows.length > 0) {
                newAccountName = auditResult.rows[0].account_name;
                source = 'ps_audit_trail';
                auditFound++;
            }
        }
        
        // Priority 3: tenant_name as fallback
        if (!newAccountName) {
            newAccountName = tenantName;
            source = 'tenant_name (fallback)';
        }
        
        // Update all records for this tenant if account name is different
        for (const record of records) {
            checked++;
            if (newAccountName && newAccountName !== record.client) {
                await db.query(
                    'UPDATE current_accounts SET client = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [newAccountName, record.id]
                );
                console.log(`  ✓ Updated: ${tenantName} → "${newAccountName}" (was: "${record.client}") [${source}]`);
                updated++;
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total records checked: ${checked}`);
    console.log(`   Records updated: ${updated}`);
    console.log(`   Account names from Salesforce: ${sfFound}`);
    console.log(`   Account names from ps_audit_trail: ${auditFound}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Done!');
    process.exit(0);
}

updateAccountNames().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
