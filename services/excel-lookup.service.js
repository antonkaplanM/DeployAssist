/**
 * Excel Lookup Service
 * 
 * Provides tenant lookup and comparison functionality for the Excel integration.
 * Fetches SML entitlements and compares with PS record entitlements.
 */

const database = require('../database');
const SMLGhostAccountsService = require('./sml-ghost-accounts.service');
const salesforce = require('../salesforce');

class ExcelLookupService {
    constructor() {
        this.smlService = new SMLGhostAccountsService();
    }

    /**
     * Look up a tenant by name or ID and return SML entitlements
     * 
     * @param {string} tenantNameOrId - Tenant name (e.g., "acme-prod") or tenant ID
     * @param {boolean} forceFresh - If true, skip database cache and fetch from SML directly
     * @returns {Promise<Object>} Tenant info and entitlements
     */
    async lookupTenant(tenantNameOrId, forceFresh = false) {
        try {
            console.log(`🔍 Looking up tenant: ${tenantNameOrId}${forceFresh ? ' (forcing fresh SML data)' : ''}`);

            let tenant = null;
            
            // Step 1: Try to find tenant in database first (faster) - unless forceFresh
            if (!forceFresh) {
                tenant = await this._findTenantInDatabase(tenantNameOrId);
            }
            
            // Step 2: If not found in DB, no entitlements, or forceFresh, fetch from SML directly
            if (!tenant || !tenant.product_entitlements || forceFresh) {
                console.log(forceFresh ? '   Fetching fresh data from SML...' : '   Not found in DB cache, fetching from SML...');
                tenant = await this._fetchTenantFromSML(tenantNameOrId);
            }

            if (!tenant) {
                return {
                    success: false,
                    error: `Tenant '${tenantNameOrId}' not found in SML or database`,
                    tenantNameOrId
                };
            }

            // Step 3: Parse entitlements
            // The data could be in different formats depending on source:
            // - From DB: tenant.product_entitlements (JSONB column)
            // - From SML direct: tenant.extensionData (nested in response)
            // - From SML direct: tenant itself may BE the extensionData
            let entitlementData = tenant.product_entitlements || tenant.extensionData || tenant;
            
            // Debug logging to help troubleshoot
            console.log('   Entitlement data source:', {
                hasProductEntitlements: !!tenant.product_entitlements,
                hasExtensionData: !!tenant.extensionData,
                topLevelKeys: Object.keys(tenant || {}).slice(0, 10),
                entitlementDataKeys: Object.keys(entitlementData || {}).slice(0, 10)
            });
            
            const entitlements = this._parseEntitlements(entitlementData);
            
            console.log('   Parsed entitlements:', {
                models: entitlements.models.length,
                data: entitlements.data.length,
                apps: entitlements.apps.length
            });

            return {
                success: true,
                tenant: {
                    tenantId: tenant.tenant_id || tenant.tenantId,
                    tenantName: tenant.tenant_name || tenant.tenantName,
                    accountName: tenant.account_name || tenant.accountName || null,
                    displayName: tenant.tenant_display_name || tenant.displayName || null
                },
                entitlements: entitlements,
                summary: {
                    totalCount: entitlements.models.length + entitlements.data.length + entitlements.apps.length,
                    modelsCount: entitlements.models.length,
                    dataCount: entitlements.data.length,
                    appsCount: entitlements.apps.length
                },
                source: tenant.fromSML ? 'SML (live)' : 'Database (cached)',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error looking up tenant:', error.message);
            return {
                success: false,
                error: error.message,
                tenantNameOrId
            };
        }
    }

    /**
     * Look up a tenant and compare with PS record entitlements
     * 
     * @param {string} tenantNameOrId - Tenant name or ID
     * @param {string} psRecordName - PS record name (e.g., "PS-12345")
     * @param {boolean} forceFresh - If true, fetch fresh data from SML instead of using cache
     * @returns {Promise<Object>} Comparison results
     */
    async compareWithPSRecord(tenantNameOrId, psRecordName, forceFresh = false) {
        try {
            console.log(`🔍 Comparing tenant '${tenantNameOrId}' with PS record '${psRecordName}'${forceFresh ? ' (fresh SML data)' : ''}`);

            // Step 1: Look up tenant SML data
            const tenantResult = await this.lookupTenant(tenantNameOrId, forceFresh);
            
            if (!tenantResult.success) {
                return tenantResult; // Return error from tenant lookup
            }

            // Step 2: Look up PS record
            const psRecord = await this._findPSRecord(psRecordName);
            
            if (!psRecord) {
                return {
                    success: false,
                    error: `PS Record '${psRecordName}' not found`,
                    tenant: tenantResult.tenant,
                    smlEntitlements: tenantResult.entitlements
                };
            }

            // Step 2.5: Validate that the PS record matches the tenant
            const validationResult = this._validateTenantPSRecordMatch(
                tenantResult.tenant, 
                psRecord, 
                tenantNameOrId
            );
            
            if (!validationResult.matches) {
                return {
                    success: false,
                    error: validationResult.error,
                    tenant: tenantResult.tenant,
                    psRecord: {
                        id: psRecord.ps_record_id,
                        name: psRecord.ps_record_name,
                        tenantName: psRecord.tenant_name,
                        accountName: psRecord.account_name
                    },
                    smlEntitlements: tenantResult.entitlements,
                    validationError: true
                };
            }

            // Step 3: Parse PS record entitlements
            const psEntitlements = this._parsePSRecordEntitlements(psRecord);

            // Step 4: Compare entitlements
            console.log('   Comparing entitlements:');
            console.log('     SML:', {
                models: tenantResult.entitlements.models.length,
                data: tenantResult.entitlements.data.length,
                apps: tenantResult.entitlements.apps.length
            });
            console.log('     PS:', {
                models: psEntitlements.models.length,
                data: psEntitlements.data.length,
                apps: psEntitlements.apps.length
            });
            
            const comparison = this._compareEntitlements(tenantResult.entitlements, psEntitlements);
            
            console.log('   Comparison results:', {
                models: {
                    inSFOnly: comparison.models.inSFOnly.length,
                    inSMLOnly: comparison.models.inSMLOnly.length,
                    different: comparison.models.different.length,
                    matching: comparison.models.matching.length
                },
                data: {
                    inSFOnly: comparison.data.inSFOnly.length,
                    inSMLOnly: comparison.data.inSMLOnly.length,
                    different: comparison.data.different.length,
                    matching: comparison.data.matching.length
                },
                apps: {
                    inSFOnly: comparison.apps.inSFOnly.length,
                    inSMLOnly: comparison.apps.inSMLOnly.length,
                    different: comparison.apps.different.length,
                    matching: comparison.apps.matching.length
                }
            });

            // Step 5: Generate summary with correct color logic
            // In SF Only = GREEN (adding) - PS has it, SML doesn't
            // In SML Only = RED (removing) - SML has it, PS doesn't
            const summary = {
                hasDiscrepancies: comparison.models.inSFOnly.length > 0 || 
                                  comparison.models.inSMLOnly.length > 0 ||
                                  comparison.models.different.length > 0 ||
                                  comparison.data.inSFOnly.length > 0 ||
                                  comparison.data.inSMLOnly.length > 0 ||
                                  comparison.data.different.length > 0 ||
                                  comparison.apps.inSFOnly.length > 0 ||
                                  comparison.apps.inSMLOnly.length > 0 ||
                                  comparison.apps.different.length > 0,
                inSFOnly: comparison.models.inSFOnly.length + 
                          comparison.data.inSFOnly.length + 
                          comparison.apps.inSFOnly.length,
                inSMLOnly: comparison.models.inSMLOnly.length + 
                           comparison.data.inSMLOnly.length + 
                           comparison.apps.inSMLOnly.length,
                different: comparison.models.different.length + 
                           comparison.data.different.length + 
                           comparison.apps.different.length,
                matching: comparison.models.matching.length + 
                          comparison.data.matching.length + 
                          comparison.apps.matching.length
            };

            return {
                success: true,
                tenant: tenantResult.tenant,
                psRecord: {
                    id: psRecord.ps_record_id,
                    name: psRecord.ps_record_name,
                    status: psRecord.status,
                    accountName: psRecord.account_name,
                    tenantName: psRecord.tenant_name
                },
                smlEntitlements: tenantResult.entitlements,
                psEntitlements: psEntitlements,
                comparison: comparison,
                summary: summary,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error comparing with PS record:', error.message);
            return {
                success: false,
                error: error.message,
                tenantNameOrId,
                psRecordName
            };
        }
    }

    /**
     * Find tenant in database by name or ID
     */
    async _findTenantInDatabase(tenantNameOrId) {
        try {
            const query = `
                SELECT tenant_id, tenant_name, account_name, tenant_display_name, 
                       product_entitlements, raw_data, last_synced
                FROM sml_tenant_data
                WHERE tenant_name ILIKE $1 
                   OR tenant_id = $1
                   OR tenant_name ILIKE $2
                LIMIT 1
            `;
            
            const result = await database.query(query, [
                tenantNameOrId,
                `%${tenantNameOrId}%`
            ]);

            if (result.rows.length > 0) {
                console.log(`   Found in database: ${result.rows[0].tenant_name}`);
                return result.rows[0];
            }

            return null;
        } catch (error) {
            console.error('   Database lookup error:', error.message);
            return null;
        }
    }

    /**
     * Fetch tenant directly from SML API
     */
    async _fetchTenantFromSML(tenantNameOrId) {
        try {
            // Validate SML authentication
            const authValidation = await this.smlService.validateAuthentication();
            if (!authValidation.valid) {
                throw new Error(`SML authentication issue: ${authValidation.error}`);
            }

            const config = this.smlService.getConfig();
            const environment = config?.environment || 'use1';
            const BASE_URL = environment === 'euw1' 
                ? 'https://api-euw1.rms.com' 
                : 'https://api-use1.rms.com';

            // First, try to get tenant ID if we have a name
            let tenantId = tenantNameOrId;
            
            // If it doesn't look like a UUID, try to find the tenant ID
            if (!tenantNameOrId.match(/^[0-9a-f-]{36}$/i) && !tenantNameOrId.match(/^\d+$/)) {
                // Search for tenant by name
                const tenantList = await this.smlService.fetchTenantListOnly();
                if (tenantList.success && tenantList.tenants) {
                    const found = tenantList.tenants.find(t => 
                        t.tenantName?.toLowerCase() === tenantNameOrId.toLowerCase() ||
                        t.tenantName?.toLowerCase().includes(tenantNameOrId.toLowerCase())
                    );
                    if (found) {
                        tenantId = found.tenantId;
                        console.log(`   Resolved tenant name '${tenantNameOrId}' to ID '${tenantId}'`);
                    }
                }
            }

            // Fetch tenant details with entitlements
            const tenantDetails = await this.smlService._fetchTenantProductsWithPlaywright(
                tenantId, 
                config, 
                BASE_URL
            );

            if (tenantDetails) {
                tenantDetails.fromSML = true;
                return tenantDetails;
            }

            return null;
        } catch (error) {
            console.error('   SML fetch error:', error.message);
            throw error;
        }
    }

    /**
     * Find PS record - first tries database, then Salesforce API
     */
    async _findPSRecord(psRecordName) {
        try {
            console.log(`   Looking for PS record: ${psRecordName}`);
            
            // Step 1: Try database first (cached data)
            const query = `
                SELECT ps_record_id, ps_record_name, account_name, account_site,
                       status, request_type, tenant_name, payload_data,
                       created_date, last_modified_date
                FROM ps_audit_trail
                WHERE ps_record_name = $1
                   OR ps_record_name ILIKE $2
                   OR ps_record_id = $1
                ORDER BY captured_at DESC
                LIMIT 1
            `;

            const result = await database.query(query, [
                psRecordName,
                `%${psRecordName}%`
            ]);
            
            console.log(`   PS record database query returned ${result.rows.length} rows`);

            if (result.rows.length > 0) {
                console.log(`   Found PS record in database: ${result.rows[0].ps_record_name}`);
                return result.rows[0];
            }

            // Step 2: Not in database, try Salesforce API directly
            console.log(`   PS record not in database, querying Salesforce API...`);
            
            const sfResult = await this._fetchPSRecordFromSalesforce(psRecordName);
            if (sfResult) {
                console.log(`   Found PS record in Salesforce: ${sfResult.ps_record_name}`);
                return sfResult;
            }

            console.log(`   PS record not found in database or Salesforce`);
            return null;
        } catch (error) {
            console.error('   PS record lookup error:', error.message);
            return null;
        }
    }

    /**
     * Fetch PS record directly from Salesforce API
     */
    async _fetchPSRecordFromSalesforce(psRecordName) {
        try {
            // Check Salesforce authentication
            const hasValidAuth = await salesforce.hasValidAuthentication();
            if (!hasValidAuth) {
                console.log('   Salesforce not authenticated, cannot fetch PS record');
                return null;
            }

            const conn = await salesforce.getConnection();
            
            // Query Salesforce for the PS record
            // Handle both exact match and partial match (PS-5168 or just 5168)
            let whereClause = '';
            if (psRecordName.toUpperCase().startsWith('PS-')) {
                whereClause = `Name = '${psRecordName.replace(/'/g, "\\'")}'`;
            } else {
                whereClause = `Name = 'PS-${psRecordName.replace(/'/g, "\\'")}' OR Name LIKE '%${psRecordName.replace(/'/g, "\\'")}%'`;
            }
            
            const soql = `
                SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
                       Account_Site__c, Billing_Status__c, RecordTypeId,
                       TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                       Requested_Install_Date__c, RequestedGoLiveDate__c,
                       SMLErrorMessage__c,
                       CreatedDate, LastModifiedDate, CreatedBy.Name
                FROM Prof_Services_Request__c 
                WHERE ${whereClause}
                ORDER BY CreatedDate DESC
                LIMIT 1
            `;
            
            console.log(`   Salesforce SOQL: ${soql.substring(0, 100)}...`);
            
            const sfResult = await conn.query(soql);
            
            if (sfResult.records && sfResult.records.length > 0) {
                const record = sfResult.records[0];
                
                // Transform to the same format as database records
                return {
                    ps_record_id: record.Id,
                    ps_record_name: record.Name,
                    account_name: record.Account__c,
                    account_site: record.Account_Site__c,
                    status: record.Status__c,
                    request_type: record.TenantRequestAction__c,
                    tenant_name: record.Tenant_Name__c,
                    payload_data: record.Payload_Data__c,
                    created_date: record.CreatedDate,
                    last_modified_date: record.LastModifiedDate,
                    // Mark as from Salesforce for reference
                    source: 'salesforce'
                };
            }
            
            return null;
        } catch (error) {
            console.error('   Salesforce PS record fetch error:', error.message);
            return null;
        }
    }

    /**
     * Parse SML entitlements from raw data
     * Handles multiple data formats:
     * - Direct extensionData object with modelEntitlements, dataEntitlements, appEntitlements
     * - Wrapper object with extensionData property
     * - Database JSONB format
     */
    _parseEntitlements(data) {
        if (!data) {
            console.log('   _parseEntitlements: No data provided');
            return { models: [], data: [], apps: [] };
        }

        // If data is a string (from DB JSONB), parse it
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error('   _parseEntitlements: Failed to parse JSON string:', e.message);
                return { models: [], data: [], apps: [] };
            }
        }

        // Handle nested extensionData structure
        let extensionData = data;
        
        // Check if extensionData is nested
        if (data.extensionData) {
            extensionData = data.extensionData;
        }
        
        // Debug logging
        console.log('   _parseEntitlements extensionData keys:', Object.keys(extensionData || {}).slice(0, 15));
        console.log('   _parseEntitlements raw counts:', {
            modelEntitlements: Array.isArray(extensionData.modelEntitlements) ? extensionData.modelEntitlements.length : 'not array',
            dataEntitlements: Array.isArray(extensionData.dataEntitlements) ? extensionData.dataEntitlements.length : 'not array',
            appEntitlements: Array.isArray(extensionData.appEntitlements) ? extensionData.appEntitlements.length : 'not array'
        });

        const result = {
            models: this._normalizeEntitlements(extensionData.modelEntitlements || []),
            data: this._normalizeEntitlements(extensionData.dataEntitlements || []),
            apps: this._normalizeEntitlements(extensionData.appEntitlements || [])
        };
        
        return result;
    }

    /**
     * Validate that the PS record matches the tenant
     * Checks if tenant name in PS record matches the user's input
     */
    _validateTenantPSRecordMatch(tenant, psRecord, userInputTenant) {
        console.log('   Validating tenant/PS record match...');
        
        const smlTenantName = (tenant.tenantName || '').toLowerCase().trim();
        const psTenantName = (psRecord.tenant_name || '').toLowerCase().trim();
        const userInput = (userInputTenant || '').toLowerCase().trim();
        
        console.log('   Validation data:', {
            smlTenantName,
            psTenantName,
            userInput
        });
        
        // If PS record has no tenant name, we can't validate - allow it but warn
        if (!psTenantName) {
            console.log('   PS record has no tenant name, skipping validation');
            return { matches: true, warning: 'PS record has no tenant name for validation' };
        }
        
        // Check if the PS record tenant matches either:
        // 1. The SML tenant name exactly
        // 2. The SML tenant name contains the PS tenant name (or vice versa)
        // 3. The user input matches the PS tenant name
        
        const exactMatch = smlTenantName === psTenantName;
        const smlContainsPs = smlTenantName.includes(psTenantName) || psTenantName.includes(smlTenantName);
        const userMatchesPs = userInput === psTenantName || 
                              userInput.includes(psTenantName) || 
                              psTenantName.includes(userInput);
        
        if (exactMatch || smlContainsPs || userMatchesPs) {
            console.log('   Tenant/PS record match validated');
            return { matches: true };
        }
        
        // Mismatch - return detailed error
        const errorMsg = `Tenant mismatch: The PS record '${psRecord.ps_record_name}' is for tenant '${psRecord.tenant_name}', but you entered tenant '${userInputTenant}' (SML tenant: '${tenant.tenantName}'). Please verify you're using the correct PS record for this tenant.`;
        
        console.log('   Tenant/PS record mismatch detected:', errorMsg);
        
        return {
            matches: false,
            error: errorMsg
        };
    }

    /**
     * Parse PS record payload entitlements
     */
    _parsePSRecordEntitlements(psRecord) {
        try {
            console.log('   Parsing PS record entitlements...');
            console.log('   PS record has payload_data:', !!psRecord.payload_data);
            
            if (!psRecord.payload_data) {
                console.log('   No payload_data found in PS record');
                return { models: [], data: [], apps: [] };
            }

            const payload = typeof psRecord.payload_data === 'string' 
                ? JSON.parse(psRecord.payload_data) 
                : psRecord.payload_data;

            console.log('   Payload parsed, looking for entitlements at: properties.provisioningDetail.entitlements');
            
            const entitlements = payload?.properties?.provisioningDetail?.entitlements || {};
            
            console.log('   PS entitlements found:', {
                modelEntitlements: Array.isArray(entitlements.modelEntitlements) ? entitlements.modelEntitlements.length : 'not array',
                dataEntitlements: Array.isArray(entitlements.dataEntitlements) ? entitlements.dataEntitlements.length : 'not array',
                appEntitlements: Array.isArray(entitlements.appEntitlements) ? entitlements.appEntitlements.length : 'not array'
            });

            return {
                models: this._normalizeEntitlements(entitlements.modelEntitlements || []),
                data: this._normalizeEntitlements(entitlements.dataEntitlements || []),
                apps: this._normalizeEntitlements(entitlements.appEntitlements || [])
            };
        } catch (error) {
            console.error('   Error parsing PS record payload:', error.message);
            return { models: [], data: [], apps: [] };
        }
    }

    /**
     * Normalize entitlement array for comparison
     */
    _normalizeEntitlements(entitlements) {
        if (!Array.isArray(entitlements)) return [];

        return entitlements.map(e => ({
            productCode: e.productCode || e.name || '',
            productModifier: e.productModifier || '',
            packageName: e.packageName || '',
            quantity: e.quantity || null,
            startDate: this._normalizeDate(e.startDate),
            endDate: this._normalizeDate(e.endDate)
        }));
    }

    /**
     * Normalize date to YYYY-MM-DD format
     */
    _normalizeDate(dateStr) {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }

    /**
     * Compare SML entitlements with PS record entitlements
     * 
     * Color coding:
     * - In SF Only (GREEN): PS record has it, SML doesn't → ADDING
     * - In SML Only (RED): SML has it, PS record doesn't → REMOVING
     * - Different (YELLOW): Both have it but attributes differ
     * - Match (BLUE): Identical in both
     */
    _compareEntitlements(smlEntitlements, psEntitlements) {
        return {
            models: this._compareProductType(smlEntitlements.models, psEntitlements.models, 'model'),
            data: this._compareProductType(smlEntitlements.data, psEntitlements.data, 'data'),
            apps: this._compareProductType(smlEntitlements.apps, psEntitlements.apps, 'app')
        };
    }

    /**
     * Compare a specific product type (models, data, or apps)
     */
    _compareProductType(smlProducts, psProducts, type) {
        const result = {
            inSFOnly: [],    // GREEN - Adding (in PS, not in SML)
            inSMLOnly: [],   // RED - Removing (in SML, not in PS)
            different: [],   // YELLOW - Both have it, but different
            matching: []     // BLUE - Perfect match
        };

        // Create maps by product code
        const smlMap = new Map();
        const psMap = new Map();

        const getKey = (p) => {
            if (type === 'app') {
                return `${p.productCode}|${p.packageName || ''}|${p.productModifier || ''}`;
            }
            return `${p.productCode}|${p.productModifier || ''}`;
        };

        smlProducts.forEach(p => smlMap.set(getKey(p), p));
        psProducts.forEach(p => psMap.set(getKey(p), p));

        // Check PS products against SML
        psMap.forEach((psProduct, key) => {
            if (smlMap.has(key)) {
                const smlProduct = smlMap.get(key);
                const differences = this._findDifferences(smlProduct, psProduct, type);
                
                if (differences.length > 0) {
                    result.different.push({
                        productCode: psProduct.productCode,
                        sml: smlProduct,
                        ps: psProduct,
                        differences: differences
                    });
                } else {
                    result.matching.push({
                        productCode: psProduct.productCode,
                        sml: smlProduct,
                        ps: psProduct
                    });
                }
            } else {
                // In PS only = GREEN (adding)
                result.inSFOnly.push({
                    productCode: psProduct.productCode,
                    ps: psProduct
                });
            }
        });

        // Check SML products not in PS
        smlMap.forEach((smlProduct, key) => {
            if (!psMap.has(key)) {
                // In SML only = RED (removing)
                result.inSMLOnly.push({
                    productCode: smlProduct.productCode,
                    sml: smlProduct
                });
            }
        });

        return result;
    }

    /**
     * Find differences between SML and PS versions of a product
     */
    _findDifferences(smlProduct, psProduct, type) {
        const differences = [];
        
        const fieldsToCompare = ['startDate', 'endDate', 'productModifier'];
        if (type === 'app') {
            fieldsToCompare.push('packageName', 'quantity');
        }

        fieldsToCompare.forEach(field => {
            const smlValue = smlProduct[field];
            const psValue = psProduct[field];
            
            if (smlValue !== psValue) {
                differences.push({
                    field: field,
                    smlValue: smlValue,
                    psValue: psValue
                });
            }
        });

        return differences;
    }

    /**
     * Format comparison results for Excel output
     * Returns a flat array suitable for writing to Excel rows
     */
    formatForExcel(comparisonResult) {
        // Even if comparison failed (e.g., PS record not found), 
        // still return SML entitlements if we have them
        if (!comparisonResult.success) {
            // Check if we have SML entitlements despite the error
            const entitlementSource = comparisonResult.smlEntitlements || comparisonResult.entitlements;
            
            if (entitlementSource) {
                console.log('   formatForExcel: Comparison failed but have SML entitlements, returning them');
                const smlRows = [];
                const addEntitlements = (entitlements, type) => {
                    if (!entitlements || !Array.isArray(entitlements)) return;
                    entitlements.forEach(e => {
                        smlRows.push({
                            productCode: e.productCode,
                            type: type,
                            packageName: e.packageName || '',
                            startDate: e.startDate || '',
                            endDate: e.endDate || '',
                            quantity: e.quantity || '',
                            productModifier: e.productModifier || ''
                        });
                    });
                };
                
                addEntitlements(entitlementSource.models, 'Model');
                addEntitlements(entitlementSource.data, 'Data');
                addEntitlements(entitlementSource.apps, 'App');
                
                console.log('   formatForExcel: Generated', smlRows.length, 'SML rows despite error');
                
                return {
                    success: false,
                    error: comparisonResult.error,
                    tenant: comparisonResult.tenant,
                    smlEntitlements: smlRows,
                    comparison: []
                };
            }
            
            return {
                success: false,
                error: comparisonResult.error,
                smlEntitlements: [],
                comparison: []
            };
        }

        // Format SML entitlements
        // Note: When called from lookupTenant (no PS record), the field is 'entitlements'
        // When called from compareWithPSRecord, the field is 'smlEntitlements'
        const smlRows = [];
        const addEntitlements = (entitlements, type) => {
            if (!entitlements || !Array.isArray(entitlements)) return;
            entitlements.forEach(e => {
                smlRows.push({
                    productCode: e.productCode,
                    type: type,
                    packageName: e.packageName || '',
                    startDate: e.startDate || '',
                    endDate: e.endDate || '',
                    quantity: e.quantity || '',
                    productModifier: e.productModifier || ''
                });
            });
        };

        // Handle both field names: 'entitlements' (from lookupTenant) and 'smlEntitlements' (from compareWithPSRecord)
        const entitlementSource = comparisonResult.smlEntitlements || comparisonResult.entitlements;
        
        if (entitlementSource) {
            addEntitlements(entitlementSource.models, 'Model');
            addEntitlements(entitlementSource.data, 'Data');
            addEntitlements(entitlementSource.apps, 'App');
        }
        
        console.log('   formatForExcel: Generated', smlRows.length, 'SML rows');

        // Format comparison results
        const comparisonRows = [];
        
        if (comparisonResult.comparison) {
            const addComparisonRows = (comparison, type) => {
                // In SF Only (GREEN - Adding)
                comparison.inSFOnly.forEach(item => {
                    comparisonRows.push({
                        productCode: item.productCode,
                        type: type,
                        status: 'In SF Only',
                        statusColor: 'GREEN',
                        statusMeaning: 'Adding',
                        smlStartDate: '',
                        smlEndDate: '',
                        smlPackage: '',
                        psStartDate: item.ps.startDate || '',
                        psEndDate: item.ps.endDate || '',
                        psPackage: item.ps.packageName || '',
                        notes: 'Will be added to SML'
                    });
                });

                // In SML Only (RED - Removing)
                comparison.inSMLOnly.forEach(item => {
                    comparisonRows.push({
                        productCode: item.productCode,
                        type: type,
                        status: 'In SML Only',
                        statusColor: 'RED',
                        statusMeaning: 'Removing',
                        smlStartDate: item.sml.startDate || '',
                        smlEndDate: item.sml.endDate || '',
                        smlPackage: item.sml.packageName || '',
                        psStartDate: '',
                        psEndDate: '',
                        psPackage: '',
                        notes: 'Will be removed from SML'
                    });
                });

                // Different (YELLOW)
                comparison.different.forEach(item => {
                    const diffFields = item.differences.map(d => d.field).join(', ');
                    comparisonRows.push({
                        productCode: item.productCode,
                        type: type,
                        status: 'Different',
                        statusColor: 'YELLOW',
                        statusMeaning: 'Updating',
                        smlStartDate: item.sml.startDate || '',
                        smlEndDate: item.sml.endDate || '',
                        smlPackage: item.sml.packageName || '',
                        psStartDate: item.ps.startDate || '',
                        psEndDate: item.ps.endDate || '',
                        psPackage: item.ps.packageName || '',
                        notes: `Differs: ${diffFields}`
                    });
                });

                // Matching (BLUE)
                comparison.matching.forEach(item => {
                    comparisonRows.push({
                        productCode: item.productCode,
                        type: type,
                        status: 'Match',
                        statusColor: 'BLUE',
                        statusMeaning: 'No change',
                        smlStartDate: item.sml.startDate || '',
                        smlEndDate: item.sml.endDate || '',
                        smlPackage: item.sml.packageName || '',
                        psStartDate: item.ps.startDate || '',
                        psEndDate: item.ps.endDate || '',
                        psPackage: item.ps.packageName || '',
                        notes: ''
                    });
                });
            };

            addComparisonRows(comparisonResult.comparison.models, 'Model');
            addComparisonRows(comparisonResult.comparison.data, 'Data');
            addComparisonRows(comparisonResult.comparison.apps, 'App');
        }

        // Sort comparison rows: non-matching first (In SF Only, In SML Only, Different), then matching
        const statusOrder = { 'In SF Only': 1, 'In SML Only': 2, 'Different': 3, 'Match': 4 };
        comparisonRows.sort((a, b) => {
            const orderA = statusOrder[a.status] || 5;
            const orderB = statusOrder[b.status] || 5;
            if (orderA !== orderB) return orderA - orderB;
            return a.productCode.localeCompare(b.productCode);
        });

        return {
            success: true,
            tenant: comparisonResult.tenant,
            psRecord: comparisonResult.psRecord,
            summary: comparisonResult.summary,
            smlEntitlements: smlRows,
            comparison: comparisonRows
        };
    }
}

module.exports = new ExcelLookupService();
