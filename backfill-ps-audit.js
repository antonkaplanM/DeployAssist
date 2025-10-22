/**
 * Backfill PS Audit Trail Script
 * 
 * This script performs a one-time comprehensive backfill of ALL PS records from Salesforce
 * into the audit trail database. It captures the current state of all PS records,
 * including their account names and all attributes.
 * 
 * Use this script to:
 * - Initially populate the audit trail with all existing PS records
 * - Recover from database issues that caused missing records
 * - Update NULL account_name values with actual account names
 * 
 * Usage: node backfill-ps-audit.js
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const psAuditService = require('./ps-audit-service');

async function backfillPSAudit() {
    console.log('🔄 Starting PS Audit Trail Backfill...');
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
        
        // Query for ALL PS records (no filters)
        console.log('📊 Querying Salesforce for ALL PS records...');
        console.log('   This may take a few minutes for large datasets...');
        console.log('');
        
        const soql = `
            SELECT Id, Name, Account__c, Status__c, 
                   Deployment__c, Deployment__r.Name,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   SMLErrorMessage__c,
                   CreatedDate, LastModifiedDate, CreatedBy.Name
            FROM Prof_Services_Request__c 
            WHERE Name LIKE 'PS-%'
            ORDER BY CreatedDate ASC
        `;
        
        // Execute query with automatic batching for large result sets
        let allRecords = [];
        let result = await conn.query(soql);
        allRecords = allRecords.concat(result.records);
        
        // Handle paginated results
        while (!result.done) {
            console.log(`   Retrieved ${allRecords.length} records so far...`);
            result = await conn.queryMore(result.nextRecordsUrl);
            allRecords = allRecords.concat(result.records);
        }
        
        console.log(`✅ Retrieved ${allRecords.length} PS records from Salesforce`);
        console.log('');
        
        if (allRecords.length === 0) {
            console.log('ℹ️  No PS records found in Salesforce. Nothing to backfill.');
            process.exit(0);
        }
        
        // Start backfill process
        console.log('🔍 Starting intelligent backfill process...');
        console.log('   The system will:');
        console.log('   1. Check each record against existing audit trail entries');
        console.log('   2. Add new records as "initial" snapshots');
        console.log('   3. Update records that have changed since last capture');
        console.log('   4. Skip records that are already up-to-date');
        console.log('');
        
        const startTime = new Date();
        
        // Use the smart change detection which will:
        // - Add new records with 'initial' change type
        // - Capture status changes
        // - Capture other attribute changes
        // - Skip unchanged records
        const result_data = await psAuditService.detectAndCaptureChanges(allRecords);
        
        const endTime = new Date();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        
        // Log the backfill run
        await psAuditService.logAuditRun({
            startTime,
            endTime,
            recordsProcessed: result_data.totalRecords,
            newSnapshots: result_data.newSnapshots,
            changesDetected: result_data.statusChanges + (result_data.otherChanges || 0),
            status: result_data.success ? 'completed' : 'failed',
            error: null
        });
        
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ BACKFILL COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   Total records processed: ${result_data.totalRecords}`);
        console.log(`   New records added: ${result_data.newSnapshots}`);
        console.log(`   Status changes captured: ${result_data.statusChanges}`);
        console.log(`   Other changes captured: ${result_data.otherChanges || 0}`);
        console.log(`   No changes: ${result_data.noChanges || 0}`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log('');
        console.log('🎯 Next Steps:');
        console.log('   1. Verify data in database: SELECT COUNT(*) FROM ps_audit_trail;');
        console.log('   2. Check specific record: SELECT * FROM ps_audit_trail WHERE ps_record_name = \'PS-4215\';');
        console.log('   3. Test customer products page with: AFIAA Real Estate Investment AG');
        console.log('');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during backfill:', error.message);
        console.error(error);
        
        // Log the failed run
        await psAuditService.logAuditRun({
            startTime: new Date(),
            endTime: new Date(),
            recordsProcessed: 0,
            newSnapshots: 0,
            changesDetected: 0,
            status: 'failed',
            error: error.message
        });
        
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   - Check Salesforce authentication');
        console.log('   - Verify database connection');
        console.log('   - Check error logs above for details');
        console.log('');
        
        process.exit(1);
    }
}

// Run the backfill
backfillPSAudit();

