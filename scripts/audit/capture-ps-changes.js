/**
 * Capture PS Record Changes Script
 * 
 * This script fetches current PS records from Salesforce and compares them with
 * the latest snapshots to detect and capture any changes, especially status changes.
 * 
 * Run this script periodically (e.g., every 15 minutes via cron) to maintain
 * the audit trail.
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const psAuditService = require('./ps-audit-service');

async function capturePSChanges() {
    console.log('🔍 Starting PS record change detection...');
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    try {
        // Check Salesforce authentication
        const hasAuth = await salesforce.hasValidAuthentication();
        
        if (!hasAuth) {
            console.log('⚠️  No valid Salesforce authentication. Skipping this run.');
            process.exit(0);
        }
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Query for ALL PS records (no date limit - we want complete audit trail)
        // The audit service will detect which ones have actually changed
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
            ORDER BY LastModifiedDate DESC
        `;
        
        console.log(`📊 Fetching all PS records from Salesforce...`);
        
        // Execute query
        const result = await conn.query(soql);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} PS records from Salesforce`);
        console.log('');
        
        if (records.length === 0) {
            console.log('ℹ️  No records to check. Exiting.');
            process.exit(0);
        }
        
        // Log the start of the audit run
        const startTime = new Date();
        
        // Detect and capture changes
        const changeResult = await psAuditService.detectAndCaptureChanges(records);
        
        const endTime = new Date();
        
        // Log the audit run
        await psAuditService.logAuditRun({
            startTime,
            endTime,
            recordsProcessed: changeResult.totalRecords,
            newSnapshots: changeResult.newSnapshots,
            changesDetected: changeResult.statusChanges + (changeResult.otherChanges || 0),
            status: changeResult.success ? 'completed' : 'failed',
            error: null
        });
        
        console.log('');
        console.log('✅ Change detection complete!');
        
        // If there were changes, show a summary
        const totalChanges = changeResult.statusChanges + (changeResult.otherChanges || 0);
        if (totalChanges > 0) {
            console.log('');
            console.log(`📝 ${totalChanges} change(s) detected and captured!`);
            console.log(`   - Status changes: ${changeResult.statusChanges}`);
            console.log(`   - Other changes: ${changeResult.otherChanges || 0}`);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during change detection:', error.message);
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

// Run the change detection
capturePSChanges();

