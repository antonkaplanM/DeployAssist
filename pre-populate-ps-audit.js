/**
 * Pre-populate PS Audit Trail Script
 * 
 * This script fetches all existing PS records from Salesforce and creates initial snapshots
 * in the audit trail database. Run this once to establish the baseline.
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const psAuditService = require('./ps-audit-service');

async function prePopulatePSAudit() {
    console.log('🚀 Starting PS Audit Trail pre-population...');
    console.log('');
    
    try {
        // Check Salesforce authentication
        console.log('🔐 Checking Salesforce authentication...');
        const hasAuth = await salesforce.hasValidAuthentication();
        
        if (!hasAuth) {
            throw new Error('No valid Salesforce authentication found. Please authenticate first.');
        }
        
        console.log('✅ Salesforce authentication valid');
        console.log('');
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Query for all PS records
        // We'll do this in batches to avoid timeouts
        console.log('📊 Fetching PS records from Salesforce...');
        console.log('   This may take a few minutes for large datasets...');
        console.log('');
        
        // Build SOQL query for all PS records
        // Fetch records from the last 2 years to start with
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const startDateStr = twoYearsAgo.toISOString().split('T')[0];
        
        const soql = `
            SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   SMLErrorMessage__c,
                   CreatedDate, LastModifiedDate, CreatedBy.Name
            FROM Prof_Services_Request__c 
            WHERE CreatedDate >= ${startDateStr}T00:00:00Z AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
        `;
        
        console.log(`📅 Fetching records created since ${startDateStr}...`);
        
        // Execute query
        const result = await conn.query(soql);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} PS records from Salesforce`);
        console.log('');
        
        if (records.length === 0) {
            console.log('⚠️  No PS records found. Nothing to populate.');
            process.exit(0);
        }
        
        // Log the start of the audit run
        const startTime = new Date();
        
        // Capture all records as initial snapshots
        console.log('📸 Capturing initial snapshots...');
        const captureResult = await psAuditService.capturePSRecordsBulk(records, 'initial');
        
        const endTime = new Date();
        
        // Log the audit run
        await psAuditService.logAuditRun({
            startTime,
            endTime,
            recordsProcessed: captureResult.totalRecords,
            newSnapshots: captureResult.successCount,
            changesDetected: 0,
            status: captureResult.success ? 'completed' : 'failed',
            error: captureResult.errors.length > 0 ? JSON.stringify(captureResult.errors) : null
        });
        
        console.log('');
        console.log('📊 Pre-population Summary:');
        console.log(`   Total Records: ${captureResult.totalRecords}`);
        console.log(`   Successfully Captured: ${captureResult.successCount}`);
        console.log(`   Errors: ${captureResult.errorCount}`);
        console.log(`   Duration: ${captureResult.duration}s`);
        console.log('');
        
        // Get and display final statistics
        const statsResult = await psAuditService.getAuditStats();
        if (statsResult.success) {
            const stats = statsResult.stats;
            console.log('✅ Final Statistics:');
            console.log(`   Total PS Records: ${stats.total_ps_records}`);
            console.log(`   Total Snapshots: ${stats.total_snapshots}`);
            console.log(`   Status Changes: ${stats.total_status_changes}`);
            if (stats.earliest_snapshot) {
                console.log(`   Earliest Snapshot: ${new Date(stats.earliest_snapshot).toLocaleString()}`);
            }
            if (stats.latest_snapshot) {
                console.log(`   Latest Snapshot: ${new Date(stats.latest_snapshot).toLocaleString()}`);
            }
        }
        
        console.log('');
        console.log('✅ Pre-population complete!');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Set up periodic capture (e.g., every 15 minutes) to track changes');
        console.log('   2. Access the Audit Trail page to search for PS record history');
        console.log('   3. View status changes and timeline for any PS record');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during pre-population:', error.message);
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
        
        process.exit(1);
    }
}

// Run the pre-population
prePopulatePSAudit();

