/**
 * Validation Service
 * Business logic for PS request validation
 */

const salesforce = require('../salesforce');
const validationEngine = require('./validation-engine.service');
const logger = require('../utils/logger');

class ValidationService {
    /**
     * Get validation errors for dashboard monitoring
     * @param {String} timeFrame - Time frame (1d, 1w, 1m, 1y)
     * @param {Array} enabledRuleIds - Optional array of enabled rule IDs
     * @returns {Promise<Object>} Validation results
     */
    async getValidationErrors(timeFrame = '1w', enabledRuleIds = null) {
        logger.info(`Fetching validation errors for timeFrame: ${timeFrame}`);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            logger.warn('No valid Salesforce authentication - returning mock data');
            return {
                errors: [],
                summary: {
                    totalRecords: 0,
                    validRecords: 0,
                    invalidRecords: 0,
                    timeFrame: timeFrame,
                    timeFrameStart: new Date().toISOString().split('T')[0],
                    enabledRulesCount: 3,
                    note: 'No Salesforce authentication - showing mock data'
                }
            };
        }
        
        // Calculate date range based on time frame
        const now = new Date();
        let startDate;
        
        switch (timeFrame) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '1w':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Build SOQL query for Professional Services Requests within time frame
        const soqlQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c, 
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${startDateStr}T00:00:00Z AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        logger.info(`Fetching PS requests created since ${startDateStr} (${timeFrame})`);
        
        // Execute query
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        logger.info(`Retrieved ${records.length} PS requests for validation analysis`);
        
        // Get enabled validation rules
        let enabledRules;
        if (enabledRuleIds && Array.isArray(enabledRuleIds)) {
            enabledRules = validationEngine.DEFAULT_VALIDATION_RULES.filter(rule => 
                enabledRuleIds.includes(rule.id)
            );
            logger.info(`Using ${enabledRules.length} client-specified enabled validation rules: ${enabledRuleIds.join(', ')}`);
        } else {
            enabledRules = validationEngine.getEnabledValidationRules();
            logger.info(`Using ${enabledRules.length} default enabled validation rules`);
        }
        
        // Validate each record
        const validationResults = [];
        let validCount = 0;
        let invalidCount = 0;
        
        for (const record of records) {
            try {
                const validationResult = validationEngine.ValidationEngine.validateRecord(record, enabledRules);
                
                if (validationResult.overallStatus === 'FAIL') {
                    invalidCount++;
                    validationResults.push({
                        recordId: record.Id,
                        recordName: record.Name,
                        account: record.Account__c,
                        requestType: record.TenantRequestAction__c,
                        createdDate: record.CreatedDate,
                        failedRules: validationResult.ruleResults
                            .filter(r => r.status === 'FAIL')
                            .map(r => ({
                                ruleId: r.ruleId,
                                ruleName: enabledRules.find(rule => rule.id === r.ruleId)?.name || r.ruleId,
                                message: r.message,
                                details: r.details
                            }))
                    });
                } else {
                    validCount++;
                }
            } catch (error) {
                logger.warn(`Error validating record ${record.Id}:`, error);
                validCount++; // Default to valid on error
            }
        }
        
        logger.info(`Validation complete: ${validCount} valid, ${invalidCount} invalid out of ${records.length} total`);
        
        return {
            errors: validationResults,
            summary: {
                totalRecords: records.length,
                validRecords: validCount,
                invalidRecords: invalidCount,
                timeFrame: timeFrame,
                timeFrameStart: startDateStr,
                enabledRulesCount: enabledRules.length
            }
        };
    }
}

module.exports = new ValidationService();

