/**
 * Validation Rules Engine for Deployment Assistant
 * 
 * This file contains all validation rules and the validation engine
 * for processing Technical Team Request records.
 */

// Default validation rules configuration
const DEFAULT_VALIDATION_RULES = [
    {
        id: 'app-quantity-validation',
        name: 'App Quantity Validation',
        description: 'For Apps section: quantity must be 1, except IC-DATABRIDGE products are always valid',
        longDescription: 'Validates each app entitlement in the payload data. Rule passes if quantity equals 1 OR productCode equals "IC-DATABRIDGE". All app entitlements must pass for the record to pass.',
        enabled: true,
        category: 'product-validation',
        version: '1.0',
        createdDate: '2025-01-24'
    },
    {
        id: 'model-count-validation',
        name: 'Model Count Validation',
        description: 'Fails if number of Models is more than 100, otherwise passes',
        longDescription: 'Validates the total count of model entitlements in the payload data. Rule fails if the number of models exceeds 100, otherwise passes.',
        enabled: true,
        category: 'product-validation',
        version: '1.0',
        createdDate: '2025-01-24'
    },
    {
        id: 'entitlement-date-overlap-validation',
        name: 'Entitlement Date Overlap Validation',
        description: 'Fails if entitlements with the same productCode have overlapping date ranges',
        longDescription: 'Validates that for any entitlement with the same productCode, the end date of one entitlement does not fall between the start date and end date of any other entitlement with the same productCode. This prevents overlapping entitlement periods.',
        enabled: true,
        category: 'date-validation',
        version: '1.0',
        createdDate: '2025-01-24'
    }
];

// Validation Engine Class
class ValidationEngine {
    /**
     * Validates a single record against enabled validation rules
     * @param {Object} record - The Technical Team Request record
     * @param {Array} enabledRules - Array of enabled validation rules
     * @returns {Object} Validation results object
     */
    static validateRecord(record, enabledRules) {
        const results = {
            recordId: record.Id,
            recordName: record.Name || 'Unknown',
            overallStatus: 'PASS', // Default to pass per requirements
            ruleResults: [],
            hasErrors: false,
            validatedAt: new Date().toISOString()
        };

        // Check if we have payload data
        if (!record.Payload_Data__c) {
            console.log(`[VALIDATION] No payload data for record ${record.Id}, defaulting to PASS`);
            return results;
        }

        // Safe JSON parsing
        let payload = null;
        try {
            payload = JSON.parse(record.Payload_Data__c);
            console.log(`[VALIDATION] Parsed payload for record ${record.Id}:`, payload);
        } catch (error) {
            console.warn(`[VALIDATION] Malformed JSON in record ${record.Id}, defaulting to PASS:`, error);
            // Malformed JSON = Pass (per requirement)
            return results;
        }

        // Run each enabled rule
        enabledRules.forEach(rule => {
            if (rule.enabled) {
                console.log(`[VALIDATION] Running rule ${rule.id} for record ${record.Id}`);
                const ruleResult = this.executeRule(rule, payload, record);
                results.ruleResults.push(ruleResult);
                
                if (ruleResult.status === 'FAIL') {
                    results.overallStatus = 'FAIL';
                    console.log(`[VALIDATION] Rule ${rule.id} failed for record ${record.Id}: ${ruleResult.message}`);
                }
            }
        });

        console.log(`[VALIDATION] Final result for record ${record.Id}: ${results.overallStatus}`);
        return results;
    }

    /**
     * Executes a specific validation rule
     * @param {Object} rule - The validation rule to execute
     * @param {Object} payload - Parsed payload data
     * @param {Object} record - Full record object for context
     * @returns {Object} Rule execution result
     */
    static executeRule(rule, payload, record) {
        try {
            switch (rule.id) {
                case 'app-quantity-validation':
                    return this.validateAppQuantities(payload, record);
                case 'model-count-validation':
                    return this.validateModelCount(payload, record);
                case 'entitlement-date-overlap-validation':
                    return this.validateEntitlementDateOverlap(payload, record);
                default:
                    console.warn(`[VALIDATION] Unknown rule: ${rule.id}`);
                    return { 
                        ruleId: rule.id, 
                        status: 'PASS', 
                        message: 'Unknown rule, defaulting to pass',
                        details: null
                    };
            }
        } catch (error) {
            console.error(`[VALIDATION] Error executing rule ${rule.id}:`, error);
            // Rule execution error = Pass (per requirement)
            return { 
                ruleId: rule.id, 
                status: 'PASS', 
                message: 'Validation error, defaulting to pass',
                details: { error: error.message }
            };
        }
    }

    /**
     * Validates app quantities according to the app quantity rule
     * Rule: quantity must be 1, except IC-DATABRIDGE products are always valid
     * @param {Object} payload - Parsed payload data
     * @param {Object} record - Full record object for context
     * @returns {Object} Validation result
     */
    static validateAppQuantities(payload, record) {
        // Navigate to appEntitlements - this path may need adjustment based on actual data structure
        const appEntitlements = payload?.properties?.provisioningDetail?.entitlements?.appEntitlements ||
                               payload?.entitlements?.appEntitlements ||
                               payload?.appEntitlements ||
                               [];

        if (!Array.isArray(appEntitlements)) {
            console.log(`[VALIDATION] No app entitlements array found for record ${record.Id}, defaulting to PASS`);
            return {
                ruleId: 'app-quantity-validation',
                status: 'PASS',
                message: 'No app entitlements found',
                details: {
                    totalCount: 0,
                    passCount: 0,
                    failCount: 0,
                    failures: []
                }
            };
        }

        const failures = [];
        const details = {
            totalCount: appEntitlements.length,
            passCount: 0,
            failCount: 0,
            failures: []
        };

        for (let i = 0; i < appEntitlements.length; i++) {
            const app = appEntitlements[i];
            const quantity = app.quantity;
            const productCode = app.productCode || app.product_code || app.ProductCode;
            const appName = app.name || app.productName || productCode || `App-${i + 1}`;

            console.log(`[VALIDATION] Checking app: ${appName}, quantity: ${quantity}, productCode: ${productCode}`);

            // Rule logic: Pass if quantity === 1 OR productCode === "IC-DATABRIDGE"
            if (quantity === 1 || productCode === "IC-DATABRIDGE") {
                details.passCount++;
                console.log(`[VALIDATION] App ${appName} passed: quantity=${quantity}, productCode=${productCode}`);
            } else {
                details.failCount++;
                const failureMessage = `${appName}: quantity ${quantity}, expected 1 or IC-DATABRIDGE`;
                failures.push(failureMessage);
                details.failures.push({
                    appName,
                    quantity,
                    productCode,
                    reason: quantity !== 1 ? 'Invalid quantity' : 'Not IC-DATABRIDGE exception'
                });
                console.log(`[VALIDATION] App ${appName} failed: ${failureMessage}`);
            }
        }

        const status = failures.length === 0 ? 'PASS' : 'FAIL';
        const message = status === 'PASS' 
            ? `All ${details.totalCount} app entitlements valid`
            : `${details.failCount} of ${details.totalCount} app entitlements failed: ${failures.join('; ')}`;

        return {
            ruleId: 'app-quantity-validation',
            status,
            message,
            details
        };
    }

    /**
     * Validates model count according to the model count rule
     * Rule: Fail if number of Models is more than 100, otherwise pass
     * @param {Object} payload - Parsed payload data
     * @param {Object} record - Full record object for context
     * @returns {Object} Validation result
     */
    static validateModelCount(payload, record) {
        // Navigate to modelEntitlements - this path may need adjustment based on actual data structure
        const modelEntitlements = payload?.properties?.provisioningDetail?.entitlements?.modelEntitlements ||
                                 payload?.entitlements?.modelEntitlements ||
                                 payload?.modelEntitlements ||
                                 [];

        if (!Array.isArray(modelEntitlements)) {
            console.log(`[VALIDATION] No model entitlements array found for record ${record.Id}, defaulting to PASS`);
            return {
                ruleId: 'model-count-validation',
                status: 'PASS',
                message: 'No model entitlements found',
                details: {
                    totalCount: 0,
                    limit: 100,
                    withinLimit: true
                }
            };
        }

        const modelCount = modelEntitlements.length;
        const limit = 100;
        const withinLimit = modelCount <= limit;

        console.log(`[VALIDATION] Checking model count: ${modelCount} models, limit: ${limit}`);

        const status = withinLimit ? 'PASS' : 'FAIL';
        const message = withinLimit 
            ? `Model count ${modelCount} is within limit (≤${limit})`
            : `Model count ${modelCount} exceeds limit of ${limit}`;

        console.log(`[VALIDATION] Model count validation ${status}: ${message}`);

        return {
            ruleId: 'model-count-validation',
            status,
            message,
            details: {
                totalCount: modelCount,
                limit: limit,
                withinLimit: withinLimit,
                modelsFound: modelEntitlements.map((model, index) => ({
                    name: model.productCode || model.name || `Model-${index + 1}`,
                    productCode: model.productCode || 'Unknown',
                    quantity: model.quantity || 1
                }))
            }
        };
    }

    /**
     * Validates entitlement date overlap according to the date overlap rule
     * Rule: Fail if entitlements with the same productCode have overlapping date ranges
     * @param {Object} payload - Parsed payload data
     * @param {Object} record - Full record object for context
     * @returns {Object} Validation result
     */
    static validateEntitlementDateOverlap(payload, record) {
        // Collect all entitlements from different entitlement types
        const allEntitlements = [];
        
        // Get entitlements from all possible locations
        const entitlementsObj = payload?.properties?.provisioningDetail?.entitlements ||
                              payload?.entitlements ||
                              {};
        
        // Collect model entitlements
        const modelEntitlements = entitlementsObj.modelEntitlements || [];
        if (Array.isArray(modelEntitlements)) {
            modelEntitlements.forEach((ent, index) => {
                allEntitlements.push({
                    ...ent,
                    type: 'model',
                    index: index,
                    productCode: ent.productCode || ent.product_code || ent.ProductCode,
                    startDate: ent.startDate || ent.start_date || ent.StartDate,
                    endDate: ent.endDate || ent.end_date || ent.EndDate
                });
            });
        }
        
        // Collect app entitlements
        const appEntitlements = entitlementsObj.appEntitlements || [];
        if (Array.isArray(appEntitlements)) {
            appEntitlements.forEach((ent, index) => {
                allEntitlements.push({
                    ...ent,
                    type: 'app',
                    index: index,
                    productCode: ent.productCode || ent.product_code || ent.ProductCode,
                    startDate: ent.startDate || ent.start_date || ent.StartDate,
                    endDate: ent.endDate || ent.end_date || ent.EndDate
                });
            });
        }
        
        // Collect data entitlements
        const dataEntitlements = entitlementsObj.dataEntitlements || [];
        if (Array.isArray(dataEntitlements)) {
            dataEntitlements.forEach((ent, index) => {
                allEntitlements.push({
                    ...ent,
                    type: 'data',
                    index: index,
                    productCode: ent.productCode || ent.product_code || ent.ProductCode,
                    startDate: ent.startDate || ent.start_date || ent.StartDate,
                    endDate: ent.endDate || ent.end_date || ent.EndDate
                });
            });
        }

        if (allEntitlements.length === 0) {
            console.log(`[VALIDATION] No entitlements found for record ${record.Id}, defaulting to PASS`);
            return {
                ruleId: 'entitlement-date-overlap-validation',
                status: 'PASS',
                message: 'No entitlements found',
                details: {
                    totalCount: 0,
                    overlapsFound: 0,
                    overlaps: []
                }
            };
        }

        const overlaps = [];
        const details = {
            totalCount: allEntitlements.length,
            overlapsFound: 0,
            overlaps: []
        };

        // Group entitlements by productCode
        const entitlementsByProduct = {};
        for (const ent of allEntitlements) {
            if (!ent.productCode) continue; // Skip entitlements without productCode
            
            if (!entitlementsByProduct[ent.productCode]) {
                entitlementsByProduct[ent.productCode] = [];
            }
            entitlementsByProduct[ent.productCode].push(ent);
        }

        // Check for date overlaps within each productCode group
        for (const [productCode, entitlements] of Object.entries(entitlementsByProduct)) {
            if (entitlements.length < 2) continue; // Need at least 2 entitlements to have overlap
            
            for (let i = 0; i < entitlements.length; i++) {
                for (let j = i + 1; j < entitlements.length; j++) {
                    const ent1 = entitlements[i];
                    const ent2 = entitlements[j];
                    
                    // Skip if either entitlement is missing date information
                    if (!ent1.startDate || !ent1.endDate || !ent2.startDate || !ent2.endDate) {
                        continue;
                    }
                    
                    // Parse dates
                    const start1 = new Date(ent1.startDate);
                    const end1 = new Date(ent1.endDate);
                    const start2 = new Date(ent2.startDate);
                    const end2 = new Date(ent2.endDate);
                    
                    // Check if dates are valid
                    if (isNaN(start1.getTime()) || isNaN(end1.getTime()) || 
                        isNaN(start2.getTime()) || isNaN(end2.getTime())) {
                        continue;
                    }
                    
                    // Check for overlap using proper date range overlap logic
                    // Two ranges overlap if: start1 < end2 AND start2 < end1
                    // This catches all overlaps including identical dates
                    let overlapFound = false;
                    let overlapDescription = '';
                    
                    const hasOverlap = start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime();
                    
                    if (hasOverlap) {
                        overlapFound = true;
                        // Check for identical dates
                        if (start1.getTime() === start2.getTime() && end1.getTime() === end2.getTime()) {
                            overlapDescription = `${ent1.type}-${ent1.index + 1} and ${ent2.type}-${ent2.index + 1} have identical date ranges (${ent1.startDate} to ${ent1.endDate})`;
                        } else if (start1.getTime() <= start2.getTime() && end1.getTime() >= end2.getTime()) {
                            overlapDescription = `${ent1.type}-${ent1.index + 1} (${ent1.startDate} to ${ent1.endDate}) completely contains ${ent2.type}-${ent2.index + 1} (${ent2.startDate} to ${ent2.endDate})`;
                        } else if (start2.getTime() <= start1.getTime() && end2.getTime() >= end1.getTime()) {
                            overlapDescription = `${ent2.type}-${ent2.index + 1} (${ent2.startDate} to ${ent2.endDate}) completely contains ${ent1.type}-${ent1.index + 1} (${ent1.startDate} to ${ent1.endDate})`;
                        } else {
                            overlapDescription = `${ent1.type}-${ent1.index + 1} (${ent1.startDate} to ${ent1.endDate}) overlaps with ${ent2.type}-${ent2.index + 1} (${ent2.startDate} to ${ent2.endDate})`;
                        }
                    }
                    
                    if (overlapFound) {
                        const overlap = {
                            productCode: productCode,
                            entitlement1: {
                                type: ent1.type,
                                index: ent1.index + 1,
                                startDate: ent1.startDate,
                                endDate: ent1.endDate
                            },
                            entitlement2: {
                                type: ent2.type,
                                index: ent2.index + 1,
                                startDate: ent2.startDate,
                                endDate: ent2.endDate
                            },
                            description: overlapDescription
                        };
                        
                        overlaps.push(overlap);
                        details.overlaps.push(overlap);
                        
                        console.log(`[VALIDATION] Date overlap found for productCode ${productCode}: ${overlapDescription}`);
                    }
                }
            }
        }

        details.overlapsFound = overlaps.length;
        const status = overlaps.length === 0 ? 'PASS' : 'FAIL';
        const message = status === 'PASS' 
            ? `No date overlaps found across ${details.totalCount} entitlements`
            : `${details.overlapsFound} date overlap${details.overlapsFound > 1 ? 's' : ''} found`;

        return {
            ruleId: 'entitlement-date-overlap-validation',
            status,
            message,
            details
        };
    }

    /**
     * Gets a human-readable summary of validation results for tooltips
     * @param {Object} validationResult - Result from validateRecord
     * @returns {string} Formatted tooltip text
     */
    static getValidationTooltip(validationResult) {
        if (validationResult.overallStatus === 'PASS') {
            return 'All validation rules passed';
        }

        const failedRules = validationResult.ruleResults.filter(r => r.status === 'FAIL');
        return failedRules.map(rule => {
            const ruleName = DEFAULT_VALIDATION_RULES.find(r => r.id === rule.ruleId)?.name || rule.ruleId;
            return `${ruleName}: ${rule.message}`;
        }).join('\n');
    }

    /**
     * Debug function to explore JSON structure of payload data
     * @param {Object} payload - Parsed payload data
     * @returns {Object} Structure analysis
     */
    static analyzePayloadStructure(payload) {
        const analysis = {
            hasProperties: !!payload.properties,
            hasProvisioningDetail: !!payload.properties?.provisioningDetail,
            hasEntitlements: !!payload.properties?.provisioningDetail?.entitlements,
            appEntitlementsPath: null,
            appEntitlementsCount: 0,
            sampleAppEntitlement: null,
            allPaths: []
        };

        // Try different possible paths to app entitlements
        const possiblePaths = [
            'properties.provisioningDetail.entitlements.appEntitlements',
            'entitlements.appEntitlements',
            'appEntitlements',
            'apps',
            'applications'
        ];

        for (const path of possiblePaths) {
            const value = this.getNestedValue(payload, path);
            if (Array.isArray(value) && value.length > 0) {
                analysis.appEntitlementsPath = path;
                analysis.appEntitlementsCount = value.length;
                analysis.sampleAppEntitlement = value[0];
                break;
            }
        }

        // Get all possible paths in the object
        analysis.allPaths = this.getAllPaths(payload);

        return analysis;
    }

    /**
     * Helper function to get nested object value by string path
     */
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Helper function to get all paths in an object (for debugging)
     */
    static getAllPaths(obj, prefix = '') {
        const paths = [];
        
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            for (const key in obj) {
                const currentPath = prefix ? `${prefix}.${key}` : key;
                paths.push(currentPath);
                
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    paths.push(...this.getAllPaths(obj[key], currentPath));
                }
            }
        }
        
        return paths;
    }
}

// Configuration Management Functions
const VALIDATION_CONFIG_KEY = 'deploymentAssistant_validationRules';

/**
 * Loads validation configuration from localStorage
 * @returns {Object} Validation configuration
 */
function loadValidationConfig() {
    try {
        const stored = localStorage.getItem(VALIDATION_CONFIG_KEY);
        if (stored) {
            const config = JSON.parse(stored);
            // Merge with defaults to ensure we have all latest rules
            return {
                version: config.version || '1.0',
                rules: DEFAULT_VALIDATION_RULES, // Always use latest rules
                enabledRules: config.enabledRules || {},
                lastUpdated: config.lastUpdated || new Date().toISOString(),
                settings: {
                    showDetailedTooltips: true,
                    validateOnLoad: true,
                    ...config.settings
                }
            };
        }
    } catch (error) {
        console.error('[VALIDATION] Error loading config from localStorage:', error);
    }

    // Return default configuration
    const defaultConfig = {
        version: '1.0',
        rules: DEFAULT_VALIDATION_RULES,
        enabledRules: {},
        lastUpdated: new Date().toISOString(),
        settings: {
            showDetailedTooltips: true,
            validateOnLoad: true
        }
    };

    // Set default enabled state for all rules
    DEFAULT_VALIDATION_RULES.forEach(rule => {
        defaultConfig.enabledRules[rule.id] = rule.enabled;
    });

    return defaultConfig;
}

/**
 * Saves validation configuration to localStorage
 * @param {Object} config - Configuration to save
 */
function saveValidationConfig(config) {
    try {
        config.lastUpdated = new Date().toISOString();
        localStorage.setItem(VALIDATION_CONFIG_KEY, JSON.stringify(config));
        console.log('[VALIDATION] Configuration saved to localStorage');
    } catch (error) {
        console.error('[VALIDATION] Error saving config to localStorage:', error);
    }
}

/**
 * Gets list of enabled validation rules
 * @returns {Array} Array of enabled rule objects
 */
function getEnabledValidationRules() {
    const config = loadValidationConfig();
    return config.rules.filter(rule => config.enabledRules[rule.id] === true);
}

/**
 * Updates the enabled state of a validation rule
 * @param {string} ruleId - ID of the rule to update
 * @param {boolean} enabled - New enabled state
 */
function updateRuleEnabledState(ruleId, enabled) {
    const config = loadValidationConfig();
    config.enabledRules[ruleId] = enabled;
    saveValidationConfig(config);
    console.log(`[VALIDATION] Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ValidationEngine,
        DEFAULT_VALIDATION_RULES,
        loadValidationConfig,
        saveValidationConfig,
        getEnabledValidationRules,
        updateRuleEnabledState
    };
}
