/**
 * Process SML Validation Script
 * 
 * This script processes deprovision PS records and validates them against
 * SML active entitlements. It runs asynchronously in the background and
 * stores results in the async_validation_results table.
 * 
 * Run this script periodically (e.g., every 10 minutes via Task Scheduler)
 * to keep validation results up-to-date.
 */

require('dotenv').config();
const salesforce = require('../../salesforce');
const { SMLValidationHelper } = require('../../utils/sml-validation-helper');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

/**
 * Log processing run to database
 */
async function logProcessingRun(data) {
    const query = `
        INSERT INTO async_validation_processing_log 
        (process_started, process_completed, records_queued, records_processed, 
         records_succeeded, records_failed, records_skipped, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
    `;
    
    const values = [
        data.startTime,
        data.endTime,
        data.recordsQueued || 0,
        data.recordsProcessed || 0,
        data.recordsSucceeded || 0,
        data.recordsFailed || 0,
        data.recordsSkipped || 0,
        data.status,
        data.error
    ];
    
    try {
        const result = await pool.query(query, values);
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Failed to log processing run:', error);
        return null;
    }
}

/**
 * Save or update validation result in database
 */
async function saveValidationResult(recordId, recordName, accountName, tenantName, requestType, validationResult) {
    // Check if result already exists
    const checkQuery = `
        SELECT id FROM async_validation_results
        WHERE ps_record_id = $1 AND rule_id = $2
    `;
    
    const existing = await pool.query(checkQuery, [recordId, validationResult.ruleId]);
    
    if (existing.rows.length > 0) {
        // Update existing result
        const updateQuery = `
            UPDATE async_validation_results
            SET status = $1, message = $2, details = $3, 
                sml_entitlements = $4, active_entitlements_count = $5,
                processing_completed_at = NOW(),
                updated_at = NOW()
            WHERE ps_record_id = $6 AND rule_id = $7
            RETURNING id
        `;
        
        // Structure ALL entitlements by category for frontend display (including expired)
        const allEntitlements = validationResult.details?.allEntitlements || [];
        const smlEntitlements = {
            models: allEntitlements.filter(e => e.category === 'models'),
            data: allEntitlements.filter(e => e.category === 'data'),
            apps: allEntitlements.filter(e => e.category === 'apps')
        };

        // Count only active entitlements for the warning indicator
        const activeCount = allEntitlements.filter(e => e.status === 'active').length;

        const values = [
            validationResult.status,
            validationResult.message,
            JSON.stringify(validationResult.details || {}),
            JSON.stringify(smlEntitlements),
            activeCount,
            recordId,
            validationResult.ruleId
        ];
        
        await pool.query(updateQuery, values);
    } else {
        // Insert new result
        const insertQuery = `
            INSERT INTO async_validation_results
            (ps_record_id, ps_record_name, account_name, tenant_name, request_type,
             rule_id, rule_name, status, message, details, sml_entitlements, 
             active_entitlements_count, processing_started_at, processing_completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            RETURNING id
        `;
        
        // Structure ALL entitlements by category for frontend display (including expired)
        const allEntitlements = validationResult.details?.allEntitlements || [];
        const smlEntitlements = {
            models: allEntitlements.filter(e => e.category === 'models'),
            data: allEntitlements.filter(e => e.category === 'data'),
            apps: allEntitlements.filter(e => e.category === 'apps')
        };

        // Count only active entitlements for the warning indicator
        const activeCount = allEntitlements.filter(e => e.status === 'active').length;

        const values = [
            recordId,
            recordName,
            accountName,
            tenantName,
            requestType,
            validationResult.ruleId,
            'Deprovision Active Entitlements Check',
            validationResult.status,
            validationResult.message,
            JSON.stringify(validationResult.details || {}),
            JSON.stringify(smlEntitlements),
            activeCount
        ];
        
        await pool.query(insertQuery, values);
    }
}

/**
 * Main processing function
 */
async function processSMLValidation() {
    console.log('🔍 Starting SML validation processing...');
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    const startTime = new Date();
    let recordsQueued = 0;
    let recordsProcessed = 0;
    let recordsSucceeded = 0;
    let recordsFailed = 0;
    let recordsSkipped = 0;
    
    try {
        // Check Salesforce authentication
        const hasAuth = await salesforce.hasValidAuthentication();
        
        if (!hasAuth) {
            console.log('⚠️  No valid Salesforce authentication. Skipping this run.');
            await logProcessingRun({
                startTime,
                endTime: new Date(),
                recordsQueued: 0,
                recordsProcessed: 0,
                recordsSucceeded: 0,
                recordsFailed: 0,
                recordsSkipped: 0,
                status: 'skipped',
                error: 'No valid Salesforce authentication'
            });
            process.exit(0);
        }
        
        // Initialize SML validation helper
        const smlHelper = new SMLValidationHelper();
        
        // Check if SML is configured
        const smlConfigured = await smlHelper.isSMLConfigured();
        if (!smlConfigured) {
            console.log('⚠️  SML is not configured. Skipping this run.');
            await logProcessingRun({
                startTime,
                endTime: new Date(),
                recordsQueued: 0,
                recordsProcessed: 0,
                recordsSucceeded: 0,
                recordsFailed: 0,
                recordsSkipped: 0,
                status: 'skipped',
                error: 'SML not configured'
            });
            process.exit(0);
        }
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Query for deprovision PS records created or modified in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = thirtyDaysAgo.toISOString();
        
        const soql = `
            SELECT Id, Name, Account__c, Status__c,
                   TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                   CreatedDate, LastModifiedDate
            FROM Prof_Services_Request__c 
            WHERE Name LIKE 'PS-%'
              AND TenantRequestAction__c LIKE '%Deprovision%'
              AND (CreatedDate >= ${dateFilter} OR LastModifiedDate >= ${dateFilter})
            ORDER BY LastModifiedDate DESC
            LIMIT 100
        `;
        
        console.log(`📊 Fetching deprovision PS records from Salesforce...`);
        
        // Execute query
        const result = await conn.query(soql);
        const records = result.records || [];
        
        recordsQueued = records.length;
        
        console.log(`✅ Retrieved ${records.length} deprovision records to validate`);
        console.log('');
        
        if (records.length === 0) {
            console.log('ℹ️  No records to process. Exiting.');
            await logProcessingRun({
                startTime,
                endTime: new Date(),
                recordsQueued: 0,
                recordsProcessed: 0,
                recordsSucceeded: 0,
                recordsFailed: 0,
                recordsSkipped: 0,
                status: 'completed',
                error: null
            });
            process.exit(0);
        }
        
        // Process each record
        for (const record of records) {
            try {
                console.log(`🔎 Processing ${record.Name}...`);
                
                // Extract tenant name
                const tenantName = smlHelper.extractTenantName(record);
                
                if (!tenantName) {
                    console.log(`   ⚠️  No tenant name found, skipping`);
                    recordsSkipped++;
                    continue;
                }
                
                console.log(`   Tenant: ${tenantName}`);
                
                // Validate against SML
                const validationResult = await smlHelper.checkDeprovisionActiveEntitlements(record, tenantName);
                
                // Save result to database
                await saveValidationResult(
                    record.Id,
                    record.Name,
                    record.Account__c,
                    tenantName,
                    record.TenantRequestAction__c,
                    validationResult
                );
                
                recordsProcessed++;
                
                if (validationResult.status === 'WARNING') {
                    console.log(`   ⚠️  WARNING: ${validationResult.message}`);
                    recordsSucceeded++;
                } else if (validationResult.status === 'PASS') {
                    console.log(`   ✅ PASS: ${validationResult.message}`);
                    recordsSucceeded++;
                } else if (validationResult.status === 'ERROR') {
                    console.log(`   ❌ ERROR: ${validationResult.message}`);
                    recordsFailed++;
                } else {
                    console.log(`   ✓ ${validationResult.status}: ${validationResult.message}`);
                    recordsSucceeded++;
                }
                
                // Small delay between records to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`   ❌ Error processing ${record.Name}:`, error.message);
                recordsFailed++;
            }
        }
        
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        
        console.log('');
        console.log('📊 Processing Summary:');
        console.log(`   Records Queued: ${recordsQueued}`);
        console.log(`   Records Processed: ${recordsProcessed}`);
        console.log(`   Succeeded: ${recordsSucceeded}`);
        console.log(`   Failed: ${recordsFailed}`);
        console.log(`   Skipped: ${recordsSkipped}`);
        console.log(`   Duration: ${duration.toFixed(2)}s`);
        console.log('');
        
        // Log the processing run
        await logProcessingRun({
            startTime,
            endTime,
            recordsQueued,
            recordsProcessed,
            recordsSucceeded,
            recordsFailed,
            recordsSkipped,
            status: recordsFailed > 0 ? 'completed_with_errors' : 'completed',
            error: null
        });
        
        console.log('✅ SML validation processing completed successfully');
        process.exit(0);
        
    } catch (error) {
        console.error('');
        console.error('❌ Critical error during SML validation processing:');
        console.error(error);
        console.error('');
        
        // Log failed processing run
        await logProcessingRun({
            startTime,
            endTime: new Date(),
            recordsQueued,
            recordsProcessed,
            recordsSucceeded,
            recordsFailed,
            recordsSkipped,
            status: 'failed',
            error: error.message
        });
        
        process.exit(1);
    } finally {
        // Close database connection
        await pool.end();
    }
}

// Run the processing
processSMLValidation();

