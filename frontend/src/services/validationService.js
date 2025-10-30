import api from './api';

// Default validation rules configuration
const DEFAULT_VALIDATION_RULES = [
  {
    id: 'app-quantity-validation',
    name: 'App Quantity Validation',
    description: 'For Apps section: quantity must be 1, except IC-DATABRIDGE and RI-RISKMODELER-EXPANSION products are always valid',
    longDescription: 'Validates each app entitlement in the payload data. Rule passes if quantity equals 1 OR productCode equals "IC-DATABRIDGE" OR productCode equals "RI-RISKMODELER-EXPANSION". All app entitlements must pass for the record to pass.',
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
  },
  {
    id: 'entitlement-date-gap-validation',
    name: 'Entitlement Date Gap Validation',
    description: 'Fails if a product code has multiple date ranges with gaps between them',
    longDescription: 'Validates that for any product code with multiple date ranges, there are no gaps between consecutive entitlement periods. The start date of each subsequent entitlement should immediately follow or equal the end date of the previous entitlement.',
    enabled: true,
    category: 'date-validation',
    version: '1.0',
    createdDate: '2025-10-13'
  },
  {
    id: 'app-package-name-validation',
    name: 'App Package Name Validation',
    description: 'Fails if an app entitlement is missing a package name, except DATAAPI-LOCINTEL, IC-RISKDATALAKE, RI-COMETA, and DATAAPI-BULK-GEOCODE',
    longDescription: 'Validates that each app entitlement in the payload has a package name field with a non-empty value. This ensures that all app deployments have the required package information. Exception: DATAAPI-LOCINTEL, IC-RISKDATALAKE, RI-COMETA, and DATAAPI-BULK-GEOCODE products do not require a package name.',
    enabled: true,
    category: 'product-validation',
    version: '1.0',
    createdDate: '2025-10-15'
  },
  {
    id: 'deprovision-active-entitlements-check',
    name: 'Deprovision Active Entitlements Check',
    description: 'Warns if a deprovision request includes entitlements that are still active (not yet expired)',
    longDescription: 'For PS records with Request Type "Deprovision", this rule checks if any entitlements in SML are still active (end date is after current date). Returns WARNING if active entitlements are found, indicating the request would deprovision resources that haven\'t expired yet. This rule requires SML integration and runs asynchronously in the background.',
    enabled: true,
    category: 'deprovision-validation',
    version: '1.0',
    createdDate: '2025-10-30',
    async: true,
    requiresSML: true,
    isBackgroundRule: true
  }
];

const validationService = {
  // Get validation rules from localStorage or defaults
  getValidationRules: () => {
    try {
      const stored = localStorage.getItem('validationRules');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading validation rules:', error);
    }
    return DEFAULT_VALIDATION_RULES;
  },

  // Save validation rules to localStorage
  saveValidationRules: (rules) => {
    localStorage.setItem('validationRules', JSON.stringify(rules));
    localStorage.setItem('validationRulesLastUpdated', new Date().toISOString());
    return rules;
  },

  // Toggle a specific rule
  toggleRule: (ruleId) => {
    const rules = validationService.getValidationRules();
    const updatedRules = rules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    return validationService.saveValidationRules(updatedRules);
  },

  // Get last updated timestamp
  getLastUpdated: () => {
    return localStorage.getItem('validationRulesLastUpdated') || null;
  },

  // Test validation rules against current data
  testValidationRules: async () => {
    try {
      const response = await api.post('/api/salesforce/validate-all', {
        rules: validationService.getValidationRules().filter(r => r.enabled),
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Debug JSON structure
  debugJSONStructure: async () => {
    try {
      const response = await api.get('/api/salesforce/debug-json');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default validationService;

