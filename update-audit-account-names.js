/**
 * Update Audit Trail Account Names Script
 * 
 * This script updates existing PS audit trail records that have NULL account_name values.
 * It fetches the account names from Salesforce and updates the database records.
 * 
 * Use this script to:
 * - Fix existing audit trail records with NULL account_name
 * - Update records before running the full backfill
 * 
 * Usage: node update-audit-account-names.js
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const database = require('./database');

async function updateAuditAccountNames() {
    console.log('🔄 Starting Account Name Update for PS Audit Trail...');
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    try {
        // Check Salesforce authentication
        const hasAuth = await salesforce.hasValidAuthentication();
        
        if (!hasAuth) {
            console.log('⚠️  No valid Salesforce authentication found.');
            console.log('   Please authenticate first by logging into the application.');
            process.exit(1);
        }
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Query all audit trail records with NULL account_name but non-NULL account_id
        console.log('📊 Querying database for records with NULL account_name...');
        
        const query = `
            SELECT DISTINCT ps_record_id, account_id
            FROM ps_audit_trail
            WHERE account_name IS NULL
            AND account_id IS NOT NULL
        `;
        
        const result = await database.query(query);
        const recordsToUpdate = result.rows;
        
        console.log(`✅ Found ${recordsToUpdate.length} records with NULL account_name`);
        console.log('');
        
        if (recordsToUpdate.length === 0) {
            console.log('ℹ️  All records already have account names populated!');
            process.exit(0);
        }
        
        // Fetch PS records from Salesforce to get account names
        console.log('🔍 Fetching PS records from Salesforce to get account names...');
        
        const psRecordIds = recordsToUpdate.map(r => r.ps_record_id);
        
        // Salesforce SOQL has a limit of 200 IDs in WHERE IN clause, so batch if needed
        const batchSize = 200;
        const accountMap = new Map();
        
        for (let i = 0; i < psRecordIds.length; i += batchSize) {
            const batch = psRecordIds.slice(i, i + batchSize);
            const idList = batch.map(id => `'${id}'`).join(',');
            
            const soql = `
                SELECT Id, Account__c
                FROM Prof_Services_Request__c 
                WHERE Id IN (${idList})
            `;
            
            console.log(`   Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(psRecordIds.length / batchSize)}...`);
            
            const sfResult = await conn.query(soql);
            
            sfResult.records.forEach(record => {
                if (record.Account__c) {
                    accountMap.set(record.Id, record.Account__c);
                }
            });
        }
        
        console.log(`✅ Retrieved account names for ${accountMap.size} records`);
        console.log('');
        
        // Update database records
        console.log('📝 Updating database records...');
        
        let updateCount = 0;
        let errorCount = 0;
        
        for (const [psRecordId, accountName] of accountMap) {
            try {
                const updateQuery = `
                    UPDATE ps_audit_trail
                    SET account_name = $1
                    WHERE ps_record_id = $2
                    AND account_name IS NULL
                `;
                
                const updateResult = await database.query(updateQuery, [accountName, psRecordId]);
                updateCount += updateResult.rowCount;
                
                if (updateResult.rowCount > 0) {
                    console.log(`   ✓ Updated ${updateResult.rowCount} record(s) for PS ID: ${psRecordId} → ${accountName}`);
                }
            } catch (error) {
                console.error(`   ✗ Error updating ${psRecordId}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ UPDATE COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   Total records found with NULL account_name: ${recordsToUpdate.length}`);
        console.log(`   Account names fetched from Salesforce: ${accountMap.size}`);
        console.log(`   Database records updated: ${updateCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Verify updates: SELECT COUNT(*) FROM ps_audit_trail WHERE account_name IS NULL;');
        console.log('   2. Test customer products page with accounts that were previously failing');
        console.log('   3. Consider running full backfill: npm run audit:backfill');
        console.log('');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during account name update:', error.message);
        console.error(error);
        
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   - Check Salesforce authentication');
        console.log('   - Verify database connection');
        console.log('   - Check error logs above for details');
        console.log('');
        
        process.exit(1);
    }
}

// Run the update
updateAuditAccountNames();

