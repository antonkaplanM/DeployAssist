/**
 * Current Accounts Service
 * Handles sync and data operations for the Current Accounts analytics page
 * 
 * Data Sources:
 * - SML: Tenants, entitlements (apps, models, data), tenant details
 * - Salesforce PS Records (PRIMARY): CSM/Owner, Status, Completion Date, Region, Admin Username
 */

const db = require('../database');
const salesforce = require('../salesforce');
const SMLGhostAccountsService = require('./sml-ghost-accounts.service');

class CurrentAccountsService {
    constructor() {
        this.smlGhostService = new SMLGhostAccountsService();
    }
    /**
     * Get all current accounts with optional filters and sorting
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Accounts and pagination info
     */
    async getAccounts(options = {}) {
        const {
            page = 1,
            pageSize = 50,
            sortBy = 'completion_date',
            sortOrder = 'DESC',
            includeRemoved = false,
            search = null
        } = options;

        const offset = (page - 1) * pageSize;

        try {
            // Build query
            let whereConditions = [];
            let params = [];
            let paramIndex = 1;

            // By default, exclude removed records unless requested
            if (!includeRemoved) {
                whereConditions.push(`record_status = 'active'`);
            }

            // Search filter
            if (search) {
                whereConditions.push(`(
                    client ILIKE $${paramIndex} OR 
                    services ILIKE $${paramIndex} OR 
                    tenant_name ILIKE $${paramIndex} OR
                    csm_owner ILIKE $${paramIndex}
                )`);
                params.push(`%${search}%`);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}` 
                : '';

            // Validate sort column to prevent SQL injection
            const validSortColumns = [
                'client', 'services', 'account_type', 'csm_owner', 
                'provisioning_status', 'completion_date', 'size', 
                'region', 'tenant_name', 'initial_tenant_admin', 
                'record_status', 'created_at'
            ];
            const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'completion_date';
            const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // Get total count
            const countQuery = `SELECT COUNT(*) as count FROM current_accounts ${whereClause}`;
            const countResult = await db.query(countQuery, params);
            const totalCount = parseInt(countResult.rows[0].count);

            // Get paginated data
            params.push(pageSize, offset);
            const dataQuery = `
                SELECT * FROM current_accounts
                ${whereClause}
                ORDER BY ${safeSortBy} ${safeSortOrder} NULLS LAST
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            const dataResult = await db.query(dataQuery, params);

            return {
                success: true,
                accounts: dataResult.rows,
                pagination: {
                    page,
                    pageSize,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize)
                }
            };
        } catch (error) {
            console.error('❌ Error fetching current accounts:', error);
            return {
                success: false,
                error: error.message,
                accounts: [],
                pagination: { page: 1, pageSize, totalCount: 0, totalPages: 0 }
            };
        }
    }

    /**
     * Update comments for a specific account row
     * @param {number} id - Row ID
     * @param {string} comments - New comments value
     * @returns {Promise<Object>} Update result
     */
    async updateComments(id, comments) {
        try {
            const query = `
                UPDATE current_accounts
                SET comments = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, comments, updated_at
            `;
            const result = await db.query(query, [comments, id]);

            if (result.rowCount === 0) {
                return { success: false, error: 'Record not found' };
            }

            return { success: true, record: result.rows[0] };
        } catch (error) {
            console.error('❌ Error updating comments:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync current accounts data from SML (directly) and Salesforce
     * Now includes both active AND deprovisioned tenants from SML
     * @param {string} initiatedBy - Username who initiated the sync
     * @returns {Promise<Object>} Sync result
     */
    async syncAccounts(initiatedBy = 'system') {
        const syncStarted = new Date();
        let syncLogId = null;

        try {
            // Create sync log entry
            const logResult = await db.query(`
                INSERT INTO current_accounts_sync_log 
                (sync_started, status, initiated_by)
                VALUES ($1, 'in_progress', $2)
                RETURNING id
            `, [syncStarted, initiatedBy]);
            syncLogId = logResult.rows[0].id;

            console.log('🔄 Starting Current Accounts sync (including deprovisioned tenants)...');

            // Step 1: Refresh SML tenant data directly from SML API (active tenants)
            // This fetches all active tenants and their entitlements fresh from SML
            console.log('📥 Step 1a: Fetching fresh ACTIVE tenant data from SML...');
            const smlSyncResult = await this.smlGhostService.syncAllTenantsFromSML();
            
            if (!smlSyncResult.success) {
                // Propagate tokenExpired flag for proper error handling
                const error = new Error(`Failed to sync SML data: ${smlSyncResult.error}`);
                error.tokenExpired = smlSyncResult.tokenExpired || false;
                throw error;
            }
            
            console.log(`✅ Active SML sync complete: ${smlSyncResult.totalTenants} tenants, ${smlSyncResult.mappedTenants} mapped`);

            // Step 1b: Fetch deprovisioned tenants from SML
            console.log('📥 Step 1b: Fetching DEPROVISIONED tenant data from SML...');
            const deprovisionedResult = await this.smlGhostService.fetchDeprovisionedTenantsFromSML();
            
            let deprovisionedTenants = [];
            if (deprovisionedResult.success) {
                deprovisionedTenants = deprovisionedResult.tenants;
                console.log(`✅ Fetched ${deprovisionedTenants.length} deprovisioned tenants from SML`);
            } else {
                console.warn(`⚠️ Could not fetch deprovisioned tenants: ${deprovisionedResult.error}`);
                // Continue with active tenants only
            }

            // Step 2: Get all active tenants from refreshed SML data
            console.log('📊 Step 2: Processing refreshed SML tenant data...');
            const tenantsResult = await db.query(`
                SELECT tenant_id, tenant_name, account_name, raw_data, product_entitlements
                FROM sml_tenant_data
                ORDER BY tenant_name
            `);
            const activeTenants = tenantsResult.rows;
            console.log(`📊 Found ${activeTenants.length} active tenants in SML data`);

            let recordsCreated = 0;
            let recordsUpdated = 0;
            let recordsMarkedRemoved = 0;
            let deprovisionedRecordsCreated = 0;
            const processedKeys = new Set();

            // Step 3a: Process active tenants (tenant_status = 'Active')
            console.log('📊 Step 3a: Processing active tenants...');
            for (const tenant of activeTenants) {
                try {
                    await this._processTenant(tenant, processedKeys, 'Active', (created, updated) => {
                        recordsCreated += created;
                        recordsUpdated += updated;
                    });
                } catch (tenantError) {
                    console.error(`⚠️ Error processing active tenant ${tenant.tenant_name}:`, tenantError.message);
                    // Continue with other tenants
                }
            }

            // Step 3b: Process deprovisioned tenants (tenant_status = 'Deprovisioned')
            // Priority for account name: Salesforce (in _fetchEnrichmentData) → SML → ps_audit_trail → tenant name
            if (deprovisionedTenants.length > 0) {
                console.log(`📊 Step 3b: Processing ${deprovisionedTenants.length} deprovisioned tenants...`);
                for (const tenant of deprovisionedTenants) {
                    try {
                        // Look up account name from ps_audit_trail as a FALLBACK after SML
                        // Salesforce enrichment (in _processTenant) will be checked first
                        const accountNameResult = await db.findAccountNameForTenant(tenant.tenantName);
                        const auditTrailAccountName = accountNameResult?.accountName || null;

                        // Convert SML tenant format to our format
                        // Priority: SML accountName first, then ps_audit_trail as fallback
                        // Salesforce enrichment is checked first in _processTenant via enrichmentData.accountName
                        const tenantData = {
                            tenant_id: tenant.tenantId,
                            tenant_name: tenant.tenantName,
                            account_name: tenant.accountName || auditTrailAccountName || null,
                            raw_data: tenant,
                            product_entitlements: null // Deprovisioned tenants may not have entitlements
                        };
                        await this._processTenant(tenantData, processedKeys, 'Deprovisioned', (created, updated) => {
                            deprovisionedRecordsCreated += created;
                            recordsUpdated += updated;
                        });
                    } catch (tenantError) {
                        console.error(`⚠️ Error processing deprovisioned tenant ${tenant.tenantName}:`, tenantError.message);
                        // Continue with other tenants
                    }
                }
            }

            // Step 4: Mark records as removed if they weren't processed
            const removeResult = await db.query(`
                UPDATE current_accounts
                SET record_status = 'removed', updated_at = CURRENT_TIMESTAMP
                WHERE record_status = 'active'
                AND last_synced < $1
                RETURNING id
            `, [syncStarted]);
            recordsMarkedRemoved = removeResult.rowCount;

            const totalTenantsProcessed = activeTenants.length + deprovisionedTenants.length;

            // Update sync log
            await db.query(`
                UPDATE current_accounts_sync_log
                SET sync_completed = CURRENT_TIMESTAMP,
                    tenants_processed = $1,
                    records_created = $2,
                    records_updated = $3,
                    records_marked_removed = $4,
                    status = 'completed'
                WHERE id = $5
            `, [totalTenantsProcessed, recordsCreated + deprovisionedRecordsCreated, recordsUpdated, recordsMarkedRemoved, syncLogId]);

            console.log('✅ Current Accounts sync completed:', {
                smlActiveTenantsRefreshed: smlSyncResult.totalTenants,
                smlDeprovisionedTenants: deprovisionedTenants.length,
                tenantsProcessed: totalTenantsProcessed,
                recordsCreated: recordsCreated + deprovisionedRecordsCreated,
                deprovisionedRecordsCreated,
                recordsUpdated,
                recordsMarkedRemoved
            });

            return {
                success: true,
                stats: {
                    smlActiveTenantsRefreshed: smlSyncResult.totalTenants,
                    smlTenantsMapped: smlSyncResult.mappedTenants,
                    smlDeprovisionedTenants: deprovisionedTenants.length,
                    tenantsProcessed: totalTenantsProcessed,
                    recordsCreated: recordsCreated + deprovisionedRecordsCreated,
                    deprovisionedRecordsCreated,
                    recordsUpdated,
                    recordsMarkedRemoved,
                    syncDuration: Date.now() - syncStarted.getTime()
                }
            };

        } catch (error) {
            console.error('❌ Current Accounts sync failed:', error);

            // Update sync log with error
            if (syncLogId) {
                await db.query(`
                    UPDATE current_accounts_sync_log
                    SET sync_completed = CURRENT_TIMESTAMP,
                        status = 'failed',
                        error_message = $1
                    WHERE id = $2
                `, [error.message, syncLogId]);
            }

            return {
                success: false,
                error: error.message,
                tokenExpired: error.tokenExpired || false
            };
        }
    }

    /**
     * Process a single tenant and upsert account records
     * 
     * SIMPLIFIED LOGIC:
     * 1. Every tenant in SML → at least one record in the database
     * 2. Every app per tenant → separate line
     * 3. Each line is enriched with data from PS records, Salesforce, etc.
     * 
     * @param {Object} tenant - Tenant data from SML
     * @param {Set} processedKeys - Set of already processed keys to avoid duplicates
     * @param {string} tenantStatus - 'Active' or 'Deprovisioned'
     * @param {Function} onProgress - Callback for progress updates
     * @private
     */
    async _processTenant(tenant, processedKeys, tenantStatus, onProgress) {
        let created = 0;
        let updated = 0;
        const now = new Date();

        // Step 1: Parse tenant's app entitlements from SML
        const apps = this._getAppsFromTenant(tenant);

        // Step 2: Fetch enrichment data (PS records, etc.) for this tenant
        const enrichmentData = await this._fetchEnrichmentData(tenant);

        // Step 3: Build tenant URL
        const tenantUrl = tenant.tenant_name 
            ? `https://${tenant.tenant_name}.rms.com`
            : null;

        // Step 4: Calculate account type based on LONGEST entitlement across ALL products
        // POC if longest term < 90 days, Subscription if >= 90 days
        const accountType = this._calculateAccountType(tenant);

        // Step 5: Create records - one per app, or one placeholder if no apps
        // Priority for client/account name: Salesforce → SML → tenant name
        if (apps.length === 0) {
            // No apps - create one placeholder record so tenant still appears
            const record = {
                client: enrichmentData.accountName || tenant.account_name || tenant.tenant_name || 'Unknown',
                services: 'No apps',
                account_type: accountType,
                csm_owner: enrichmentData.csmOwner,
                provisioning_status: enrichmentData.status || (tenantStatus === 'Deprovisioned' ? 'Deprovisioned' : 'Provisioned'),
                completion_date: enrichmentData.completionDate,
                size: null,
                region: enrichmentData.region,
                tenant_name: tenant.tenant_name,
                tenant_url: tenantUrl,
                tenant_id: tenant.tenant_id,
                salesforce_account_id: enrichmentData.salesforceAccountId,
                initial_tenant_admin: enrichmentData.adminUsername,
                ps_record_id: enrichmentData.psRecordId,
                ps_record_name: enrichmentData.psRecordName,
                app_start_date: null,
                app_end_date: null,
                tenant_status: tenantStatus,
                record_status: 'active',
                last_synced: now
            };

            const result = await this._upsertRecord(record, processedKeys);
            if (result.created) created++;
            if (result.updated) updated++;
        } else {
            // Create one record per app
            for (const app of apps) {
                const record = this._buildRecordForApp(tenant, app, enrichmentData, tenantUrl, now, accountType, tenantStatus);
                const result = await this._upsertRecord(record, processedKeys);
                if (result.created) created++;
                if (result.updated) updated++;
            }
        }

        onProgress(created, updated);
    }

    /**
     * Flatten nested expansionPacks into the top-level entitlement array.
     * SML may nest expansion packs inside parent entitlements, e.g.:
     *   { productCode: "RI-RISKMODELER", expansionPacks: [{ productCode: "RI-RISKMODELER-EXPANSION", ... }] }
     * This extracts those nested items so they appear alongside their parent.
     * @private
     */
    _flattenExpansionPacks(entitlements) {
        if (!Array.isArray(entitlements)) return [];
        const result = [];
        for (const entitlement of entitlements) {
            result.push(entitlement);
            if (Array.isArray(entitlement.expansionPacks) && entitlement.expansionPacks.length > 0) {
                for (const expansion of entitlement.expansionPacks) {
                    result.push(expansion);
                }
            }
        }
        return result;
    }

    /**
     * Extract apps from tenant's product entitlements
     * @private
     */
    _getAppsFromTenant(tenant) {
        let entitlements = null;
        
        if (tenant.product_entitlements) {
            entitlements = typeof tenant.product_entitlements === 'string'
                ? JSON.parse(tenant.product_entitlements)
                : tenant.product_entitlements;
        }

        return this._flattenExpansionPacks(entitlements?.appEntitlements || []);
    }

    /**
     * Calculate account type based on the LONGEST entitlement across ALL products
     * POC if longest term < 90 days, Subscription if >= 90 days
     * @private
     */
    _calculateAccountType(tenant) {
        let entitlements = null;
        
        if (tenant.product_entitlements) {
            entitlements = typeof tenant.product_entitlements === 'string'
                ? JSON.parse(tenant.product_entitlements)
                : tenant.product_entitlements;
        }

        if (!entitlements) {
            return 'Unknown';
        }

        // Collect ALL products from all categories (including nested expansion packs)
        const allProducts = [
            ...this._flattenExpansionPacks(entitlements.appEntitlements || []),
            ...this._flattenExpansionPacks(entitlements.modelEntitlements || []),
            ...this._flattenExpansionPacks(entitlements.dataEntitlements || [])
        ];

        if (allProducts.length === 0) {
            return 'Unknown';
        }

        // Find the longest term across all products
        let longestTermDays = 0;

        for (const product of allProducts) {
            const startDate = product.startDate ? new Date(product.startDate) : null;
            const endDate = product.endDate ? new Date(product.endDate) : null;

            if (startDate && endDate) {
                const termInDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
                if (termInDays > longestTermDays) {
                    longestTermDays = termInDays;
                }
            }
        }

        // POC if longest term < 90 days, Subscription if >= 90 days
        if (longestTermDays === 0) {
            return 'Unknown';
        }

        return longestTermDays >= 90 ? 'Subscription' : 'POC';
    }

    /**
     * Fetch enrichment data from Salesforce (PRIMARY SOURCE)
     * 
     * Fields sourced from Salesforce (same as Provisioning Monitor):
     * - Client (accountName) → Account_Site__c
     * - CSM/Owner (csmOwner) → CreatedBy.Name  
     * - Provisioning Status (status) → Status__c
     * - Completion Date → CreatedDate (from "New" completed record)
     * 
     * @private
     */
    async _fetchEnrichmentData(tenant) {
        const enrichment = {
            accountName: null,
            csmOwner: null,
            status: null,
            completionDate: null,
            region: null,
            adminUsername: null,
            salesforceAccountId: null,
            psRecordId: null,
            psRecordName: null
        };

        try {
            const conn = await salesforce.getConnection();
            
            // Escape single quotes in tenant name for SOQL
            const escapedTenantName = tenant.tenant_name.replace(/'/g, "\\'");
            
            // Step 1: Try to find the "New" completed PS record (for completion date)
            const newRecordSoql = `
                SELECT Id, Name, Account__c, Account_Site__c, Status__c, 
                       TenantRequestAction__c, CreatedDate, CreatedBy.Name,
                       Payload_Data__c
                FROM Prof_Services_Request__c 
                WHERE Tenant_Name__c = '${escapedTenantName}'
                  AND TenantRequestAction__c = 'New'
                  AND (Status__c = 'Completed' OR Status__c = 'Tenant Request Completed')
                ORDER BY CreatedDate ASC
                LIMIT 1
            `;
            
            let result = await conn.query(newRecordSoql);
            
            if (result.records.length > 0) {
                // Found the "New" completed record - use it for all fields including completion date
                const psRecord = result.records[0];
                // Client = Account__c (same as "Account" column in Provisioning Monitor)
                enrichment.accountName = psRecord.Account__c || null;
                enrichment.csmOwner = psRecord.CreatedBy?.Name || null;
                enrichment.status = psRecord.Status__c;
                enrichment.completionDate = new Date(psRecord.CreatedDate);
                enrichment.psRecordId = psRecord.Id;
                enrichment.psRecordName = psRecord.Name;

                // Parse payload for additional data (region, admin username)
                this._parsePayloadData(psRecord.Payload_Data__c, enrichment);
            } else {
                // Step 2: No "New" completed record - get Client/CSM/Status from any PS record
                // (but don't set completion date since we don't have the original provisioning record)
                const anyRecordSoql = `
                    SELECT Id, Name, Account__c, Account_Site__c, Status__c, 
                           TenantRequestAction__c, CreatedDate, CreatedBy.Name,
                           Payload_Data__c
                    FROM Prof_Services_Request__c 
                    WHERE Tenant_Name__c = '${escapedTenantName}'
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                `;
                
                result = await conn.query(anyRecordSoql);
                
                if (result.records.length > 0) {
                    const psRecord = result.records[0];
                    // Client = Account__c (same as "Account" column in Provisioning Monitor)
                    enrichment.accountName = psRecord.Account__c || null;
                    enrichment.csmOwner = psRecord.CreatedBy?.Name || null;
                    enrichment.status = psRecord.Status__c;
                    // Note: Don't set completionDate - only set from "New" completed records
                    enrichment.psRecordId = psRecord.Id;
                    enrichment.psRecordName = psRecord.Name;

                    // Parse payload for additional data (region, admin username)
                    this._parsePayloadData(psRecord.Payload_Data__c, enrichment);
                }
            }
            
            // Step 3: Get Salesforce Account ID by querying the Account object directly
            // This is more reliable than parsing the PS record payload
            if (enrichment.accountName) {
                const escapedAccountName = enrichment.accountName.replace(/'/g, "\\'");
                const accountSoql = `
                    SELECT Id 
                    FROM Account 
                    WHERE Name = '${escapedAccountName}'
                    LIMIT 1
                `;
                
                try {
                    const accountResult = await conn.query(accountSoql);
                    if (accountResult.records.length > 0) {
                        enrichment.salesforceAccountId = accountResult.records[0].Id;
                    }
                } catch (e) {
                    console.warn(`⚠️ Could not fetch Account ID for ${enrichment.accountName}: ${e.message}`);
                }
            }
            
        } catch (error) {
            // Log error but don't fail - enrichment data is optional
            console.warn(`⚠️ Could not fetch enrichment from Salesforce for ${tenant.tenant_name}: ${error.message}`);
        }

        return enrichment;
    }

    /**
     * Parse payload data and extract region and admin username
     * Note: Salesforce Account ID is now fetched directly from the Account object
     * @private
     */
    _parsePayloadData(payloadData, enrichment) {
        if (!payloadData) return;

        try {
            const payload = typeof payloadData === 'string'
                ? JSON.parse(payloadData)
                : payloadData;
            
            const provisioningDetail = payload.properties?.provisioningDetail;
            
            enrichment.region = payload.region || 
                               payload.properties?.region ||
                               provisioningDetail?.region || null;
            
            enrichment.adminUsername = payload.adminUsername ||
                                      payload.properties?.adminUsername ||
                                      provisioningDetail?.adminUsername || null;
        } catch (e) {
            console.warn('Failed to parse PS payload:', e.message);
        }
    }

    /**
     * Build a record for a single app
     * @param {Object} tenant - Tenant data from SML
     * @param {Object} app - App entitlement data
     * @param {Object} enrichmentData - Data from Salesforce PS records
     * @param {string} tenantUrl - Constructed tenant URL
     * @param {Date} now - Current timestamp
     * @param {string} accountType - Pre-calculated account type based on longest entitlement
     * @param {string} tenantStatus - 'Active' or 'Deprovisioned'
     * @private
     */
    _buildRecordForApp(tenant, app, enrichmentData, tenantUrl, now, accountType, tenantStatus = 'Active') {
        // Parse dates - don't skip if missing
        let startDate = app.startDate ? new Date(app.startDate) : null;
        let endDate = app.endDate ? new Date(app.endDate) : null;

        // Priority for client/account name: Salesforce → SML → tenant name
        return {
            client: enrichmentData.accountName || tenant.account_name || tenant.tenant_name || 'Unknown',
            services: app.productCode || app.productName || 'Unknown',
            account_type: accountType,
            csm_owner: enrichmentData.csmOwner,
            provisioning_status: enrichmentData.status || (tenantStatus === 'Deprovisioned' ? 'Deprovisioned' : 'Unknown'),
            completion_date: enrichmentData.completionDate,
            size: app.packageName || null,
            region: enrichmentData.region,
            tenant_name: tenant.tenant_name,
            tenant_url: tenantUrl,
            tenant_id: tenant.tenant_id,
            salesforce_account_id: enrichmentData.salesforceAccountId,
            initial_tenant_admin: enrichmentData.adminUsername,
            ps_record_id: enrichmentData.psRecordId,
            ps_record_name: enrichmentData.psRecordName,
            app_start_date: startDate,
            app_end_date: endDate,
            tenant_status: tenantStatus,
            record_status: 'active',
            last_synced: now
        };
    }

    /**
     * Upsert a single record into the current_accounts table
     * Unique key: (tenant_name, services) - one row per app per tenant
     * @private
     */
    async _upsertRecord(record, processedKeys) {
        // Unique key is now tenant_name + services (one row per app per tenant)
        const key = `${record.tenant_name}|${record.services}`;
        
        // Skip if we've already processed this combination
        if (processedKeys.has(key)) {
            return { created: false, updated: false };
        }
        processedKeys.add(key);

        try {
            const query = `
                INSERT INTO current_accounts (
                    client, services, account_type, csm_owner, provisioning_status,
                    completion_date, size, region, tenant_name, tenant_url,
                    tenant_id, salesforce_account_id, initial_tenant_admin,
                    ps_record_id, ps_record_name, app_start_date, app_end_date,
                    tenant_status, record_status, last_synced, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP
                )
                ON CONFLICT (tenant_name, services) 
                DO UPDATE SET
                    account_type = EXCLUDED.account_type,
                    csm_owner = EXCLUDED.csm_owner,
                    provisioning_status = EXCLUDED.provisioning_status,
                    completion_date = EXCLUDED.completion_date,
                    size = EXCLUDED.size,
                    region = EXCLUDED.region,
                    tenant_name = EXCLUDED.tenant_name,
                    tenant_url = EXCLUDED.tenant_url,
                    salesforce_account_id = EXCLUDED.salesforce_account_id,
                    initial_tenant_admin = EXCLUDED.initial_tenant_admin,
                    ps_record_name = EXCLUDED.ps_record_name,
                    app_start_date = EXCLUDED.app_start_date,
                    app_end_date = EXCLUDED.app_end_date,
                    tenant_status = EXCLUDED.tenant_status,
                    record_status = EXCLUDED.record_status,
                    last_synced = EXCLUDED.last_synced,
                    updated_at = CURRENT_TIMESTAMP
                    -- Note: comments is NOT updated - preserved from previous value
                RETURNING id, (xmax = 0) as is_insert
            `;

            const result = await db.query(query, [
                record.client,
                record.services,
                record.account_type,
                record.csm_owner,
                record.provisioning_status,
                record.completion_date,
                record.size,
                record.region,
                record.tenant_name,
                record.tenant_url,
                record.tenant_id,
                record.salesforce_account_id,
                record.initial_tenant_admin,
                record.ps_record_id,
                record.ps_record_name,
                record.app_start_date,
                record.app_end_date,
                record.tenant_status || 'Active',
                record.record_status,
                record.last_synced
            ]);

            const isInsert = result.rows[0]?.is_insert;
            return { created: isInsert, updated: !isInsert };

        } catch (error) {
            console.error('Error upserting record:', error.message);
            return { created: false, updated: false };
        }
    }

    /**
     * Quick sync - only add NEW tenants that don't exist in current_accounts
     * This is faster than full sync because it:
     * 1. First checks which tenants already exist in the DB
     * 2. Only fetches details/entitlements from SML for NEW tenants
     * @param {string} initiatedBy - Username who initiated the sync
     * @returns {Promise<Object>} Sync result
     */
    async quickSyncNewAccounts(initiatedBy = 'system') {
        const syncStarted = new Date();
        let syncLogId = null;

        try {
            // Create sync log entry
            const logResult = await db.query(`
                INSERT INTO current_accounts_sync_log 
                (sync_started, status, initiated_by)
                VALUES ($1, 'in_progress', $2)
                RETURNING id
            `, [syncStarted, initiatedBy]);
            syncLogId = logResult.rows[0].id;

            console.log('🚀 Starting Quick Sync (new tenants only)...');

            // Step 1: Get list of tenant_names that already exist in current_accounts FIRST
            console.log('🔍 Step 1: Finding tenants that already exist in database...');
            const existingTenantsResult = await db.query(`
                SELECT DISTINCT tenant_name FROM current_accounts WHERE tenant_name IS NOT NULL
            `);
            const existingTenantNames = new Set(
                existingTenantsResult.rows.map(r => r.tenant_name?.toLowerCase())
            );
            console.log(`📊 Found ${existingTenantNames.size} existing tenants in current_accounts`);

            // Step 2: Fetch ONLY the tenant list from SML (fast - no entitlements)
            console.log('📥 Step 2: Fetching tenant list from SML (list only, no details)...');
            const tenantListResult = await this.smlGhostService.fetchTenantListOnly();
            
            if (!tenantListResult.success) {
                const error = new Error(`Failed to fetch tenant list: ${tenantListResult.error}`);
                error.tokenExpired = tenantListResult.tokenExpired || false;
                throw error;
            }
            
            const allTenants = tenantListResult.tenants;
            console.log(`✅ Fetched ${allTenants.length} tenant names from SML`);

            // Step 3: Filter to only NEW tenants (not in current_accounts)
            const newTenants = allTenants.filter(t => 
                t.tenantName && !existingTenantNames.has(t.tenantName.toLowerCase())
            );
            console.log(`🆕 Found ${newTenants.length} NEW tenants to add`);

            if (newTenants.length === 0) {
                // No new tenants to add
                await db.query(`
                    UPDATE current_accounts_sync_log
                    SET sync_completed = CURRENT_TIMESTAMP,
                        tenants_processed = 0,
                        records_created = 0,
                        records_updated = 0,
                        records_marked_removed = 0,
                        status = 'completed'
                    WHERE id = $1
                `, [syncLogId]);

                console.log('✅ Quick Sync complete: No new tenants to add');
                return {
                    success: true,
                    stats: {
                        smlTenantsScanned: allTenants.length,
                        existingTenants: existingTenantNames.size,
                        newTenantsFound: 0,
                        recordsCreated: 0,
                        syncDuration: Date.now() - syncStarted.getTime()
                    }
                };
            }

            // Step 4: Only now fetch details for NEW tenants and sync them
            console.log(`📦 Step 3: Fetching details and syncing ${newTenants.length} NEW tenants...`);
            const syncResult = await this.smlGhostService.syncSpecificTenants(newTenants);
            
            if (!syncResult.success) {
                const error = new Error(`Failed to sync new tenants: ${syncResult.error}`);
                error.tokenExpired = syncResult.tokenExpired || false;
                throw error;
            }

            // Step 5: Process only the new tenants from sml_tenant_data
            let recordsCreated = 0;
            const processedKeys = new Set();

            // Get the newly synced tenant data
            const newTenantNames = newTenants.map(t => t.tenantName);
            const placeholders = newTenantNames.map((_, i) => `$${i + 1}`).join(', ');
            const newTenantsData = await db.query(`
                SELECT tenant_id, tenant_name, account_name, raw_data, product_entitlements
                FROM sml_tenant_data
                WHERE tenant_name IN (${placeholders})
            `, newTenantNames);

            console.log(`📦 Step 4: Processing ${newTenantsData.rows.length} new tenants into current_accounts...`);
            for (const tenant of newTenantsData.rows) {
                try {
                    // Quick sync only processes active tenants (new ones from SML with isDeleted=false)
                    await this._processTenant(tenant, processedKeys, 'Active', (created, updated) => {
                        recordsCreated += created;
                    });
                } catch (tenantError) {
                    console.error(`⚠️ Error processing new tenant ${tenant.tenant_name}:`, tenantError.message);
                }
            }

            // Update sync log
            await db.query(`
                UPDATE current_accounts_sync_log
                SET sync_completed = CURRENT_TIMESTAMP,
                    tenants_processed = $1,
                    records_created = $2,
                    records_updated = 0,
                    records_marked_removed = 0,
                    status = 'completed'
                WHERE id = $3
            `, [newTenants.length, recordsCreated, syncLogId]);

            console.log('✅ Quick Sync completed:', {
                smlTenantsScanned: allTenants.length,
                existingTenants: existingTenantNames.size,
                newTenantsProcessed: newTenants.length,
                recordsCreated
            });

            return {
                success: true,
                stats: {
                    smlTenantsScanned: allTenants.length,
                    existingTenants: existingTenantNames.size,
                    newTenantsFound: newTenants.length,
                    recordsCreated,
                    syncDuration: Date.now() - syncStarted.getTime()
                }
            };

        } catch (error) {
            console.error('❌ Quick Sync failed:', error);

            if (syncLogId) {
                await db.query(`
                    UPDATE current_accounts_sync_log
                    SET sync_completed = CURRENT_TIMESTAMP,
                        status = 'failed',
                        error_message = $1
                    WHERE id = $2
                `, [error.message, syncLogId]);
            }

            return {
                success: false,
                error: error.message,
                tokenExpired: error.tokenExpired || false
            };
        }
    }

    /**
     * Get sync status and history
     * @returns {Promise<Object>} Sync status info
     */
    async getSyncStatus() {
        try {
            // Get latest sync
            const latestQuery = `
                SELECT * FROM current_accounts_sync_log
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const latestResult = await db.query(latestQuery);

            // Get account stats
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(*) FILTER (WHERE record_status = 'active') as active_records,
                    COUNT(*) FILTER (WHERE record_status = 'removed') as removed_records,
                    COUNT(DISTINCT client) as unique_clients,
                    COUNT(DISTINCT tenant_name) as unique_tenants
                FROM current_accounts
            `;
            const statsResult = await db.query(statsQuery);

            return {
                success: true,
                latestSync: latestResult.rows[0] || null,
                stats: statsResult.rows[0]
            };
        } catch (error) {
            console.error('❌ Error getting sync status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new CurrentAccountsService();

