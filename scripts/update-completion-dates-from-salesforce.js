/**
 * Update Current Accounts from Salesforce (Primary Source)
 * 
 * This script queries Salesforce directly (not the audit trail table) to find
 * the PS record for each tenant and updates multiple fields.
 * 
 * Fields updated (same sources as Provisioning Monitor):
 * - client: Account__c (same as "Account" column in Provisioning Monitor)
 * - csm_owner: CreatedBy.Name
 * - provisioning_status: Status__c
 * - completion_date: CreatedDate (from "New" completed PS record only)
 * - region: From Payload_Data__c JSON (attribute: "region")
 * - initial_tenant_admin: From Payload_Data__c JSON (attribute: "adminUsername")
 * 
 * Logic:
 * 1. Get all unique tenants from current_accounts table
 * 2. For each tenant, query Salesforce for PS records:
 *    - First try "New" completed records (for completion date)
 *    - Fallback to any PS record (for client/csm/status)
 * 3. Update fields from the PS record data
 * 
 * Usage: node scripts/update-completion-dates-from-salesforce.js
 */

require('dotenv').config();
const db = require('../database');
const salesforce = require('../salesforce');

// Batch size for processing tenants
const BATCH_SIZE = 50;

/**
 * Parse Payload_Data__c JSON to extract region and adminUsername
 * Note: Salesforce Account ID is now fetched directly from the Account object
 */
function parsePayloadData(payloadData) {
    if (!payloadData) return { region: null, adminUsername: null };
    
    try {
        const payload = typeof payloadData === 'string' 
            ? JSON.parse(payloadData) 
            : payloadData;
        
        const provisioningDetail = payload.properties?.provisioningDetail;
        
        // Look for region in multiple possible locations
        const region = payload.region || 
                      payload.properties?.region ||
                      provisioningDetail?.region || null;
        
        // Look for adminUsername in multiple possible locations
        const adminUsername = payload.adminUsername ||
                             payload.properties?.adminUsername ||
                             provisioningDetail?.adminUsername || null;
        
        return { region, adminUsername };
    } catch (e) {
        console.warn(`   ⚠️ Failed to parse payload: ${e.message}`);
        return { region: null, adminUsername: null };
    }
}

// Cache for Account ID lookups to avoid duplicate queries
const accountIdCache = new Map();

/**
 * Get Salesforce Account ID by querying Account object directly
 */
async function getAccountId(conn, accountName) {
    if (!accountName) return null;
    
    // Check cache first
    if (accountIdCache.has(accountName)) {
        return accountIdCache.get(accountName);
    }
    
    try {
        const escapedName = accountName.replace(/'/g, "\\'");
        const soql = `SELECT Id FROM Account WHERE Name = '${escapedName}' LIMIT 1`;
        const result = await conn.query(soql);
        
        const accountId = result.records.length > 0 ? result.records[0].Id : null;
        accountIdCache.set(accountName, accountId);
        return accountId;
    } catch (e) {
        console.warn(`   ⚠️ Could not fetch Account ID for ${accountName}: ${e.message}`);
        return null;
    }
}

async function updateFromSalesforce() {
    console.log('🔄 Starting Current Accounts Update from Salesforce...\n');
    
    const startTime = Date.now();
    let updated = 0;
    let alreadySet = 0;
    let noMatch = 0;
    let errors = 0;

    try {
        // Step 1: Get Salesforce connection
        console.log('🔌 Connecting to Salesforce...');
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');

        // Step 2: Get all unique tenant names from current_accounts
        console.log('📊 Fetching unique tenants from current_accounts...');
        const tenantsResult = await db.query(`
            SELECT DISTINCT tenant_name
            FROM current_accounts
            WHERE tenant_name IS NOT NULL
            ORDER BY tenant_name
        `);
        
        const tenants = tenantsResult.rows.map(r => r.tenant_name);
        console.log(`   Found ${tenants.length} unique tenants to process\n`);

        // Step 3: Process tenants in batches
        for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
            const batch = tenants.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(tenants.length / BATCH_SIZE);
            
            console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tenants)...`);

            // Build SOQL query for this batch - get ALL PS records for these tenants
            const tenantConditions = batch.map(t => `'${t.replace(/'/g, "\\'")}'`).join(',');
            
            const soql = `
                SELECT Id, Name, Tenant_Name__c, TenantRequestAction__c, Status__c, 
                       CreatedDate, Account__c, Account_Site__c, CreatedBy.Name,
                       Payload_Data__c
                FROM Prof_Services_Request__c 
                WHERE Tenant_Name__c IN (${tenantConditions})
                ORDER BY Tenant_Name__c, CreatedDate ASC
            `;

            try {
                console.log(`   Querying Salesforce for ${batch.length} tenants...`);
                const result = await conn.query(soql);
                console.log(`   Found ${result.records.length} PS records`);

                // Group records by tenant_name
                // For each tenant, find: 1) the "New" completed record, 2) any record as fallback
                const tenantDataMap = new Map();
                
                for (const record of result.records) {
                    const tenantName = record.Tenant_Name__c?.toLowerCase();
                    if (!tenantName) continue;
                    
                    if (!tenantDataMap.has(tenantName)) {
                        tenantDataMap.set(tenantName, { newCompleted: null, anyRecord: null });
                    }
                    
                    const data = tenantDataMap.get(tenantName);
                    
                    // Check if this is a "New" completed record
                    const isNew = record.TenantRequestAction__c === 'New';
                    const isCompleted = record.Status__c === 'Completed' || record.Status__c === 'Tenant Request Completed';
                    
                    if (isNew && isCompleted && !data.newCompleted) {
                        data.newCompleted = record;
                    }
                    
                    // Keep track of any record (use oldest)
                    if (!data.anyRecord) {
                        data.anyRecord = record;
                    }
                }

                // Update each tenant in this batch
                for (const tenantName of batch) {
                    const data = tenantDataMap.get(tenantName.toLowerCase());
                    
                    if (data) {
                        // Use "New" completed record if available, otherwise use any record
                        const psRecord = data.newCompleted || data.anyRecord;
                        const hasCompletionDate = !!data.newCompleted;
                        
                        // Extract fields (same as Provisioning Monitor)
                        // Client = Account__c (the "Account" column in Provisioning Monitor)
                        const client = psRecord.Account__c || null;
                        const csmOwner = psRecord.CreatedBy?.Name || null;
                        const provisioningStatus = psRecord.Status__c || null;
                        const completionDate = hasCompletionDate ? new Date(data.newCompleted.CreatedDate) : null;
                        
                        // Extract region and adminUsername from Payload_Data__c
                        const { region, adminUsername } = parsePayloadData(psRecord.Payload_Data__c);
                        
                        // Get Salesforce Account ID directly from the Account object
                        const salesforceAccountId = await getAccountId(conn, client);
                        
                        // Extract PS record info
                        const psRecordId = psRecord.Id;
                        const psRecordName = psRecord.Name;
                        
                        // Update all records for this tenant
                        const updateResult = await db.query(`
                            UPDATE current_accounts
                            SET 
                                client = COALESCE($1, client),
                                csm_owner = COALESCE($2, csm_owner),
                                provisioning_status = COALESCE($3, provisioning_status),
                                completion_date = CASE 
                                    WHEN $4::timestamp IS NOT NULL THEN $4::timestamp 
                                    ELSE completion_date 
                                END,
                                region = COALESCE($6, region),
                                initial_tenant_admin = COALESCE($7, initial_tenant_admin),
                                ps_record_id = COALESCE($8, ps_record_id),
                                ps_record_name = COALESCE($9, ps_record_name),
                                salesforce_account_id = COALESCE($10, salesforce_account_id),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE tenant_name = $5
                              AND (
                                  client IS DISTINCT FROM COALESCE($1, client) OR
                                  csm_owner IS DISTINCT FROM COALESCE($2, csm_owner) OR
                                  provisioning_status IS DISTINCT FROM COALESCE($3, provisioning_status) OR
                                  ($4::timestamp IS NOT NULL AND completion_date IS DISTINCT FROM $4::timestamp) OR
                                  region IS DISTINCT FROM COALESCE($6, region) OR
                                  initial_tenant_admin IS DISTINCT FROM COALESCE($7, initial_tenant_admin) OR
                                  ps_record_id IS DISTINCT FROM COALESCE($8, ps_record_id) OR
                                  ps_record_name IS DISTINCT FROM COALESCE($9, ps_record_name) OR
                                  salesforce_account_id IS DISTINCT FROM COALESCE($10, salesforce_account_id)
                              )
                            RETURNING id
                        `, [client, csmOwner, provisioningStatus, completionDate, tenantName, region, adminUsername, psRecordId, psRecordName, salesforceAccountId]);

                        if (updateResult.rowCount > 0) {
                            const fields = [];
                            if (client) fields.push('client');
                            if (csmOwner) fields.push('csm');
                            if (provisioningStatus) fields.push('status');
                            if (completionDate) fields.push('date');
                            if (region) fields.push('region');
                            if (adminUsername) fields.push('admin');
                            if (psRecordId) fields.push('ps_record');
                            if (salesforceAccountId) fields.push('sf_account');
                            console.log(`   ✅ ${tenantName}: Updated ${updateResult.rowCount} records [${fields.join(',')}] from ${psRecord.Name}`);
                            updated += updateResult.rowCount;
                        } else {
                            alreadySet++;
                        }
                    } else {
                        noMatch++;
                    }
                }

            } catch (batchError) {
                console.error(`   ❌ Error processing batch: ${batchError.message}`);
                errors++;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Current Accounts Update Complete!');
        console.log('='.repeat(60));
        console.log(`   Total tenants processed: ${tenants.length}`);
        console.log(`   Records updated:         ${updated}`);
        console.log(`   Already up to date:      ${alreadySet}`);
        console.log(`   No PS record found:      ${noMatch}`);
        console.log(`   Errors:                  ${errors}`);
        console.log(`   Duration:                ${duration}s`);
        console.log('='.repeat(60));
        console.log('\n   Fields updated from Salesforce (same as Provisioning Monitor):');
        console.log('   - client (Account__c from PS record)');
        console.log('   - csm_owner (CreatedBy.Name from PS record)');
        console.log('   - provisioning_status (Status__c from PS record)');
        console.log('   - completion_date (CreatedDate from "New" completed PS records)');
        console.log('   - region (from Payload_Data__c JSON "region" attribute)');
        console.log('   - initial_tenant_admin (from Payload_Data__c JSON "adminUsername" attribute)');
        console.log('   - ps_record_id (Salesforce PS record ID)');
        console.log('   - ps_record_name (PS record name e.g. PS-5081)');
        console.log('   - salesforce_account_id (queried directly from Account object by name)');

    } catch (error) {
        console.error('\n❌ Error updating from Salesforce:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
updateFromSalesforce()
    .then(() => {
        console.log('\n👋 Script finished successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
