/**
 * SML Validation Helper
 * Helper functions for validating deprovision requests against SML active entitlements
 */

const SMLService = require('../services/sml.service');
const SMLRepository = require('../repositories/sml.repository');

class SMLValidationHelper {
    constructor() {
        this.smlService = new SMLService();
    }

    /**
     * Check if a deprovision request has active (non-expired) entitlements in SML
     * @param {Object} psRecord - The PS record to validate
     * @param {string} tenantName - The tenant name to check in SML
     * @returns {Promise<Object>} Validation result with status, message, and details
     */
    async checkDeprovisionActiveEntitlements(psRecord, tenantName) {
        const result = {
            ruleId: 'deprovision-active-entitlements-check',
            status: 'PASS',
            message: 'No active entitlements found',
            details: {
                tenantName,
                activeEntitlements: [],
                totalEntitlements: 0,
                checkedAt: new Date().toISOString()
            }
        };

        try {
            // Check if this is a deprovision request
            const requestType = psRecord.TenantRequestAction__c || '';
            if (!requestType.toLowerCase().includes('deprovision')) {
                result.message = 'Not a deprovision request, skipping SML check';
                return result;
            }

            console.log(`[SML-VALIDATION] Checking deprovision request for tenant: ${tenantName}`);

            // Get SML config
            const config = this.smlService.getConfig();
            if (!config) {
                result.status = 'ERROR';
                result.message = 'SML configuration not found';
                result.details.error = 'SML not configured';
                return result;
            }

            // Fetch tenant details using Playwright (same as SML Compare feature)
            const smlResult = await this.smlService.fetchTenantDetailsWithPlaywright(tenantName, config);

            if (!smlResult.success) {
                result.status = 'ERROR';
                result.message = `Failed to fetch SML data: ${smlResult.error}`;
                result.details.error = smlResult.error;
                return result;
            }

            // Extract entitlements from tenant details (including nested expansion packs)
            const tenantDetails = smlResult.tenantDetails;
            const extensionData = tenantDetails?.extensionData || {};
            
            const apps = this._flattenExpansionPacks(extensionData.appEntitlements || []);
            const models = this._flattenExpansionPacks(extensionData.modelEntitlements || []);
            const data = this._flattenExpansionPacks(extensionData.dataEntitlements || []);
            
            const allProducts = [...apps, ...models, ...data];
            result.details.totalEntitlements = allProducts.length;

            // Determine category for each entitlement
            const categorizeEntitlement = (ent) => {
                if (apps.includes(ent)) return 'apps';
                if (models.includes(ent)) return 'models';
                if (data.includes(ent)) return 'data';
                return 'unknown';
            };

            // Store ALL entitlements (for display in Products column)
            const allEntitlementsList = allProducts.map(ent => ({
                productCode: ent.productCode,
                productName: ent.productName || ent.name,
                category: categorizeEntitlement(ent),
                startDate: ent.startDate,
                endDate: ent.endDate,
                daysRemaining: this.calculateDaysRemaining(ent.endDate),
                status: this.calculateDaysRemaining(ent.endDate) < 0 ? 'expired' : 'active'
            }));

            result.details.allEntitlements = allEntitlementsList;

            // Check for active entitlements (end date is after current date) - for WARNING status only
            const currentDate = new Date();
            const activeEntitlements = allEntitlementsList.filter(ent => ent.status === 'active');

            // If there are active entitlements, return WARNING
            if (activeEntitlements.length > 0) {
                result.status = 'WARNING';
                result.message = `Found ${activeEntitlements.length} active entitlement(s) that have not yet expired (${allEntitlementsList.length} total)`;
                
                // Add detailed breakdown by category
                const byCategory = {
                    apps: activeEntitlements.filter(e => e.category === 'apps').length,
                    models: activeEntitlements.filter(e => e.category === 'models').length,
                    data: activeEntitlements.filter(e => e.category === 'data').length
                };
                
                result.details.activeByCategory = byCategory;
                result.details.warningDetails = `Deprovisioning this tenant will remove ${activeEntitlements.length} active entitlement(s): ` +
                    `${byCategory.apps} app(s), ${byCategory.models} model(s), ${byCategory.data} data(s).`;

                console.log(`[SML-VALIDATION] WARNING: ${result.message}`);
            } else if (allEntitlementsList.length > 0) {
                result.message = `All ${allEntitlementsList.length} entitlement(s) have expired - safe to deprovision`;
                console.log(`[SML-VALIDATION] PASS: ${result.message}`);
            } else {
                result.message = 'No entitlements found in SML';
                console.log(`[SML-VALIDATION] PASS: ${result.message}`);
            }

            return result;

        } catch (error) {
            console.error('[SML-VALIDATION] Error checking active entitlements:', error);
            result.status = 'ERROR';
            result.message = `Error during SML validation: ${error.message}`;
            result.details.error = error.message;
            result.details.stack = error.stack;
            return result;
        }
    }

    /**
     * Flatten nested expansionPacks into the top-level entitlement array.
     * SML may nest expansion packs inside parent entitlements, e.g.:
     *   { productCode: "RI-RISKMODELER", expansionPacks: [{ productCode: "RI-RISKMODELER-EXPANSION", ... }] }
     * This extracts those nested items so they appear alongside their parent.
     * @param {Array} entitlements - Array of entitlement objects
     * @returns {Array} Flattened array including expansion pack entries
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
     * Extract tenant name from PS record
     * @param {Object} psRecord - The PS record
     * @returns {string|null} The tenant name or null if not found
     */
    extractTenantName(psRecord) {
        try {
            // First, check the Tenant_Name__c field directly on the record
            if (psRecord.Tenant_Name__c) {
                return psRecord.Tenant_Name__c;
            }

            // Fallback: try to parse from payload
            if (!psRecord.Payload_Data__c) {
                return null;
            }

            const payload = JSON.parse(psRecord.Payload_Data__c);
            
            // Try multiple possible paths for tenant name
            const tenantName = payload?.tenantName ||
                              payload?.properties?.tenantName ||
                              payload?.properties?.provisioningDetail?.tenantName ||
                              null;

            return tenantName;
        } catch (error) {
            console.error('[SML-VALIDATION] Error extracting tenant name:', error);
            return null;
        }
    }

    /**
     * Validate multiple PS records against SML
     * @param {Array} psRecords - Array of PS records to validate
     * @returns {Promise<Array>} Array of validation results
     */
    async validateMultipleRecords(psRecords) {
        const results = [];

        for (const record of psRecords) {
            const tenantName = this.extractTenantName(record);
            
            if (!tenantName) {
                results.push({
                    recordId: record.Id,
                    recordName: record.Name,
                    status: 'PASS',
                    message: 'No tenant name found, skipping SML check',
                    details: {}
                });
                continue;
            }

            const validationResult = await this.checkDeprovisionActiveEntitlements(record, tenantName);
            results.push({
                recordId: record.Id,
                recordName: record.Name,
                accountName: record.Account__c,
                tenantName,
                requestType: record.TenantRequestAction__c,
                ...validationResult
            });
        }

        return results;
    }

    /**
     * Calculate days remaining until end date
     * @param {string} endDate - End date ISO string
     * @returns {number} Days remaining (negative if expired)
     */
    calculateDaysRemaining(endDate) {
        if (!endDate) return null;
        const end = new Date(endDate);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if SML is configured
     * @returns {Promise<boolean>} True if SML is configured
     */
    async isSMLConfigured() {
        try {
            const config = await this.smlService.repository.loadConfig();
            console.log('[SML-VALIDATION] Config check:', {
                hasConfig: !!config,
                hasEnvironment: !!config?.environment,
                hasAuthCookie: !!config?.authCookie,
                environment: config?.environment
            });
            return config && config.environment && config.authCookie;
        } catch (error) {
            console.error('[SML-VALIDATION] Error checking SML config:', error.message);
            return false;
        }
    }
}

module.exports = { SMLValidationHelper };

