/**
 * PS Audit Trail Service
 * 
 * This service handles capturing and storing PS record snapshots in the database.
 * It tracks changes over time, especially status changes.
 */

const database = require('../database');

/**
 * Capture a snapshot of a PS record
 * @param {Object} psRecord - The PS record from Salesforce
 * @param {string} changeType - Type of change: 'initial', 'status_change', 'update', 'snapshot'
 * @param {string} previousStatus - Previous status if this is a status change
 * @returns {Promise<Object>} Result of the capture operation
 */
async function capturePSRecordSnapshot(psRecord, changeType = 'snapshot', previousStatus = null) {
    try {
        // Parse payload data if it exists
        const payloadData = typeof psRecord.Payload_Data__c === 'string' 
            ? psRecord.Payload_Data__c 
            : JSON.stringify(psRecord.Payload_Data__c || {});
        
        // Get tenant name from Tenant_Name__c field or parsedPayload
        const tenantName = psRecord.Tenant_Name__c || psRecord.parsedPayload?.tenantName || null;
        
        const query = `
            INSERT INTO ps_audit_trail (
                ps_record_id,
                ps_record_name,
                account_id,
                account_name,
                account_site,
                status,
                request_type,
                deployment_id,
                deployment_name,
                tenant_name,
                billing_status,
                sml_error_message,
                payload_data,
                created_date,
                created_by,
                last_modified_date,
                captured_at,
                change_type,
                previous_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17, $18)
            RETURNING id
        `;
        
        const values = [
            psRecord.Id,
            psRecord.Name,
            psRecord.Account__c || null,
            psRecord.Account__c || null,  // account_name (Account__c contains the name)
            psRecord.Account_Site__c || null,
            psRecord.Status__c || null,
            psRecord.TenantRequestAction__c || null,
            psRecord.Deployment__c || null,
            psRecord.Deployment__r?.Name || null,
            tenantName,
            psRecord.Billing_Status__c || null,
            psRecord.SMLErrorMessage__c || null,
            payloadData,
            psRecord.CreatedDate ? new Date(psRecord.CreatedDate) : null,
            psRecord.CreatedBy?.Name || null,
            psRecord.LastModifiedDate ? new Date(psRecord.LastModifiedDate) : null,
            changeType,
            previousStatus
        ];
        
        const result = await database.query(query, values);
        
        return {
            success: true,
            snapshotId: result.rows[0].id,
            psRecordId: psRecord.Id,
            psRecordName: psRecord.Name,
            status: psRecord.Status__c,
            changeType: changeType
        };
        
    } catch (error) {
        console.error(`❌ Error capturing PS record snapshot for ${psRecord.Name}:`, error.message);
        return {
            success: false,
            error: error.message,
            psRecordId: psRecord.Id,
            psRecordName: psRecord.Name
        };
    }
}

/**
 * Capture multiple PS records in bulk
 * @param {Array} psRecords - Array of PS records from Salesforce
 * @param {string} changeType - Type of change for all records
 * @returns {Promise<Object>} Result summary
 */
async function capturePSRecordsBulk(psRecords, changeType = 'snapshot') {
    console.log(`📸 Capturing ${psRecords.length} PS record snapshots...`);
    
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const record of psRecords) {
        const result = await capturePSRecordSnapshot(record, changeType);
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
            errors.push(result);
        }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Bulk capture complete: ${successCount} success, ${errorCount} errors in ${duration}s`);
    
    return {
        success: errorCount === 0,
        totalRecords: psRecords.length,
        successCount,
        errorCount,
        errors,
        duration
    };
}

/**
 * Check for changes in PS records and capture new snapshots if changes detected
 * @param {Array} currentRecords - Current PS records from Salesforce
 * @returns {Promise<Object>} Result summary with changes detected
 */
async function detectAndCaptureChanges(currentRecords) {
    console.log(`🔍 Checking ${currentRecords.length} PS records for changes...`);
    
    const startTime = Date.now();
    let newSnapshots = 0;
    let statusChanges = 0;
    let otherChanges = 0;
    let noChanges = 0;
    
    for (const record of currentRecords) {
        try {
            // Get the latest snapshot for this record
            const latestQuery = `
                SELECT status, account_name, account_site, request_type, 
                       deployment_id, deployment_name, tenant_name, billing_status,
                       sml_error_message, payload_data, last_modified_date, captured_at
                FROM ps_audit_trail
                WHERE ps_record_id = $1
                ORDER BY captured_at DESC
                LIMIT 1
            `;
            
            const latestResult = await database.query(latestQuery, [record.Id]);
            
            if (latestResult.rows.length === 0) {
                // No previous snapshot - this is a new record
                await capturePSRecordSnapshot(record, 'initial');
                newSnapshots++;
            } else {
                const latestSnapshot = latestResult.rows[0];
                const currentStatus = record.Status__c || null;
                const previousStatus = latestSnapshot.status;
                
                // Check if status has changed
                if (currentStatus !== previousStatus) {
                    console.log(`📝 Status change detected for ${record.Name}: "${previousStatus}" → "${currentStatus}"`);
                    await capturePSRecordSnapshot(record, 'status_change', previousStatus);
                    statusChanges++;
                } else {
                    // Check for other attribute changes
                    const currentLastModified = record.LastModifiedDate ? new Date(record.LastModifiedDate) : null;
                    const previousLastModified = latestSnapshot.last_modified_date ? new Date(latestSnapshot.last_modified_date) : null;
                    
                    const hasChanges = 
                        (latestSnapshot.account_name !== (record.Account__c || null)) ||
                        (latestSnapshot.account_site !== (record.Account_Site__c || null)) ||
                        (latestSnapshot.request_type !== (record.TenantRequestAction__c || null)) ||
                        (latestSnapshot.deployment_id !== (record.Deployment__c || null)) ||
                        (latestSnapshot.deployment_name !== (record.Deployment__r?.Name || null)) ||
                        (latestSnapshot.tenant_name !== (record.Tenant_Name__c || record.parsedPayload?.tenantName || null)) ||
                        (latestSnapshot.billing_status !== (record.Billing_Status__c || null)) ||
                        (latestSnapshot.sml_error_message !== (record.SMLErrorMessage__c || null)) ||
                        (latestSnapshot.payload_data !== (typeof record.Payload_Data__c === 'string' ? record.Payload_Data__c : JSON.stringify(record.Payload_Data__c || {}))) ||
                        (currentLastModified && previousLastModified && currentLastModified.getTime() !== previousLastModified.getTime());
                    
                    if (hasChanges) {
                        console.log(`📝 Attribute change detected for ${record.Name}`);
                        await capturePSRecordSnapshot(record, 'update', null);
                        otherChanges++;
                    } else {
                        // No changes detected
                        noChanges++;
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error checking record ${record.Name}:`, error.message);
        }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Change detection complete in ${duration}s:`);
    console.log(`   - New records: ${newSnapshots}`);
    console.log(`   - Status changes: ${statusChanges}`);
    console.log(`   - Other changes: ${otherChanges}`);
    console.log(`   - No changes: ${noChanges}`);
    
    return {
        success: true,
        totalRecords: currentRecords.length,
        newSnapshots,
        statusChanges,
        otherChanges,
        noChanges,
        duration
    };
}

/**
 * Get audit trail for a specific PS record
 * @param {string} identifier - PS record ID or Name (e.g., "PS-12345")
 * @returns {Promise<Object>} Audit trail records
 */
async function getPSAuditTrail(identifier) {
    try {
        const query = `SELECT * FROM get_ps_audit_trail($1)`;
        const result = await database.query(query, [identifier]);
        
        return {
            success: true,
            identifier,
            recordCount: result.rows.length,
            records: result.rows
        };
    } catch (error) {
        console.error(`❌ Error fetching audit trail for ${identifier}:`, error.message);
        return {
            success: false,
            error: error.message,
            identifier,
            records: []
        };
    }
}

/**
 * Get status change history for a specific PS record
 * @param {string} identifier - PS record ID or Name
 * @returns {Promise<Object>} Status change history
 */
async function getPSStatusChanges(identifier) {
    try {
        const query = `SELECT * FROM get_ps_status_changes($1)`;
        const result = await database.query(query, [identifier]);
        
        return {
            success: true,
            identifier,
            changeCount: result.rows.length,
            changes: result.rows
        };
    } catch (error) {
        console.error(`❌ Error fetching status changes for ${identifier}:`, error.message);
        return {
            success: false,
            error: error.message,
            identifier,
            changes: []
        };
    }
}

/**
 * Get audit trail statistics
 * @returns {Promise<Object>} Statistics about the audit trail
 */
async function getAuditStats() {
    try {
        const query = `SELECT * FROM get_ps_audit_stats()`;
        const result = await database.query(query);
        
        if (result.rows.length > 0) {
            return {
                success: true,
                stats: result.rows[0]
            };
        }
        
        return {
            success: true,
            stats: {
                total_ps_records: 0,
                total_snapshots: 0,
                total_status_changes: 0,
                earliest_snapshot: null,
                latest_snapshot: null
            }
        };
    } catch (error) {
        console.error('❌ Error fetching audit stats:', error.message);
        return {
            success: false,
            error: error.message,
            stats: null
        };
    }
}

/**
 * Log an audit trail analysis run
 * @param {Object} runData - Data about the analysis run
 * @returns {Promise<Object>} Result of logging
 */
async function logAuditRun(runData) {
    try {
        const query = `
            INSERT INTO ps_audit_log (
                analysis_started,
                analysis_completed,
                records_processed,
                new_snapshots_created,
                changes_detected,
                status,
                error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        
        const values = [
            runData.startTime || new Date(),
            runData.endTime || new Date(),
            runData.recordsProcessed || 0,
            runData.newSnapshots || 0,
            runData.changesDetected || 0,
            runData.status || 'completed',
            runData.error || null
        ];
        
        const result = await database.query(query, values);
        
        return {
            success: true,
            logId: result.rows[0].id
        };
    } catch (error) {
        console.error('❌ Error logging audit run:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    capturePSRecordSnapshot,
    capturePSRecordsBulk,
    detectAndCaptureChanges,
    getPSAuditTrail,
    getPSStatusChanges,
    getAuditStats,
    logAuditRun
};

