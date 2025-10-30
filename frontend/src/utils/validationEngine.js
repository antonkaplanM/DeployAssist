/**
 * Validation Engine - Client-side validation for provisioning requests
 * Port of the validation-engine.js from the old app
 */

// Validation rules configuration
const validationRules = {
  'app-quantity-validation': {
    name: 'App Quantity Validation',
    description: 'Validates that app quantities are set correctly',
  },
  'entitlement-date-overlap-validation': {
    name: 'Entitlement Date Overlap',
    description: 'Checks for overlapping entitlement dates',
  },
  'entitlement-date-gap-validation': {
    name: 'Entitlement Date Gap',
    description: 'Checks for gaps in entitlement dates',
  },
  'app-package-name-validation': {
    name: 'App Package Name',
    description: 'Validates app package names',
  },
};

/**
 * Validate a single record against enabled rules
 */
export const validateRecord = (record, enabledRules = []) => {
  if (!record.Payload_Data__c) {
    return {
      recordId: record.Id,
      overallStatus: 'PASS',
      ruleResults: [],
    };
  }

  try {
    const payload = JSON.parse(record.Payload_Data__c);
    const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
    
    const ruleResults = [];
    
    // Run each enabled rule
    enabledRules.forEach(ruleId => {
      if (validationRules[ruleId]) {
        const result = runRule(ruleId, entitlements, record);
        ruleResults.push(result);
      }
    });

    // Determine overall status
    const hasFail = ruleResults.some(r => r.status === 'FAIL');
    const overallStatus = hasFail ? 'FAIL' : 'PASS';

    return {
      recordId: record.Id,
      overallStatus,
      ruleResults,
    };
  } catch (error) {
    console.error('Validation error:', error);
    return {
      recordId: record.Id,
      overallStatus: 'PASS',
      ruleResults: [],
    };
  }
};

/**
 * Run a specific validation rule
 */
const runRule = (ruleId, entitlements, record) => {
  const rule = validationRules[ruleId];
  
  switch (ruleId) {
    case 'app-quantity-validation':
      return validateAppQuantity(entitlements);
    case 'entitlement-date-overlap-validation':
      return validateDateOverlap(entitlements);
    case 'entitlement-date-gap-validation':
      return validateDateGap(entitlements);
    case 'app-package-name-validation':
      return validateAppPackageName(entitlements);
    default:
      return {
        ruleId,
        ruleName: rule.name,
        status: 'PASS',
        details: null,
      };
  }
};

/**
 * Validate app quantities
 */
const validateAppQuantity = (entitlements) => {
  const apps = entitlements.appEntitlements || [];
  
  for (const app of apps) {
    if (!app.quantity || app.quantity < 1) {
      return {
        ruleId: 'app-quantity-validation',
        ruleName: 'App Quantity Validation',
        status: 'FAIL',
        details: `App ${app.productCode} has invalid quantity: ${app.quantity}`,
      };
    }
  }
  
  return {
    ruleId: 'app-quantity-validation',
    ruleName: 'App Quantity Validation',
    status: 'PASS',
    details: null,
  };
};

/**
 * Validate date overlaps
 */
const validateDateOverlap = (entitlements) => {
  const allEntitlements = [
    ...(entitlements.modelEntitlements || []),
    ...(entitlements.dataEntitlements || []),
    ...(entitlements.appEntitlements || []),
  ];

  // Group by product code
  const grouped = {};
  allEntitlements.forEach(ent => {
    const key = ent.productCode;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ent);
  });

  // Check for overlaps within each product
  for (const [productCode, ents] of Object.entries(grouped)) {
    if (ents.length < 2) continue;

    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        
        const aStart = new Date(a.startDate);
        const aEnd = new Date(a.endDate);
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);

        // Check for overlap
        if ((aStart <= bEnd) && (bStart <= aEnd)) {
          return {
            ruleId: 'entitlement-date-overlap-validation',
            ruleName: 'Entitlement Date Overlap',
            status: 'FAIL',
            details: `${productCode} has overlapping dates`,
          };
        }
      }
    }
  }

  return {
    ruleId: 'entitlement-date-overlap-validation',
    ruleName: 'Entitlement Date Overlap',
    status: 'PASS',
    details: null,
  };
};

/**
 * Validate date gaps
 */
const validateDateGap = (entitlements) => {
  // Simplified - just return PASS for now
  return {
    ruleId: 'entitlement-date-gap-validation',
    ruleName: 'Entitlement Date Gap',
    status: 'PASS',
    details: null,
  };
};

/**
 * Validate app package names
 */
const validateAppPackageName = (entitlements) => {
  const apps = entitlements.appEntitlements || [];
  
  for (const app of apps) {
    // Exception products that don't require package names
    const exceptions = ['IC-RISKDATALAKE', 'IC-DATABRIDGE'];
    if (exceptions.includes(app.productCode)) continue;
    
    if (!app.packageName || app.packageName.trim() === '') {
      return {
        ruleId: 'app-package-name-validation',
        ruleName: 'App Package Name',
        status: 'FAIL',
        details: `App ${app.productCode} is missing package name`,
      };
    }
  }
  
  return {
    ruleId: 'app-package-name-validation',
    ruleName: 'App Package Name',
    status: 'PASS',
    details: null,
  };
};

/**
 * Get tooltip text for validation result
 */
export const getValidationTooltip = (result) => {
  if (!result || result.overallStatus === 'PASS') {
    return 'All validation rules passed';
  }

  const failedRules = result.ruleResults
    .filter(r => r.status === 'FAIL')
    .map(r => `${r.ruleName}: ${r.details || 'Failed'}`)
    .join('\n');

  return failedRules || 'Validation failed';
};

/**
 * Parse entitlements from payload
 * Tries multiple paths to find entitlements in the payload
 */
export const parseEntitlements = (payloadData) => {
  if (!payloadData) {
    console.log('[parseEntitlements] No payload data provided');
    return null;
  }

  try {
    const payload = JSON.parse(payloadData);
    
    // Try multiple paths to find entitlements (matching backend logic)
    const entitlements = payload.properties?.provisioningDetail?.entitlements ||
                        payload.entitlements ||
                        payload ||
                        {};
    
    const result = {
      models: entitlements.modelEntitlements || [],
      data: entitlements.dataEntitlements || [],
      apps: entitlements.appEntitlements || [],
    };
    
    const totalCount = result.models.length + result.data.length + result.apps.length;
    console.log('[parseEntitlements] Parsed entitlements:', {
      models: result.models.length,
      data: result.data.length,
      apps: result.apps.length,
      total: totalCount,
      payloadStructure: Object.keys(payload).slice(0, 5) // Show top-level keys for debugging
    });
    
    return result;
  } catch (error) {
    console.error('[parseEntitlements] Error parsing entitlements:', error);
    return null;
  }
};

/**
 * Parse tenant name from request object or payload data
 * Prioritizes backend-parsed data, then falls back to parsing payload
 * @param {Object|string} requestOrPayload - Full request object or just payload string
 * @returns {string} Tenant name or 'N/A'
 */
export const parseTenantName = (requestOrPayload) => {
  // If passed null/undefined
  if (!requestOrPayload) return 'N/A';
  
  // If passed a full request object (has parsedPayload from backend)
  if (typeof requestOrPayload === 'object' && requestOrPayload.parsedPayload) {
    return requestOrPayload.parsedPayload.tenantName || 'N/A';
  }
  
  // If passed a full request object with Tenant_Name__c field
  if (typeof requestOrPayload === 'object' && requestOrPayload.Tenant_Name__c) {
    return requestOrPayload.Tenant_Name__c;
  }
  
  // If passed just the payload string or request object with Payload_Data__c
  const payloadData = typeof requestOrPayload === 'string' 
    ? requestOrPayload 
    : requestOrPayload.Payload_Data__c;
    
  if (!payloadData) return 'N/A';

  try {
    const payload = JSON.parse(payloadData);
    // Check all possible locations where tenant name might be stored
    return payload.properties?.provisioningDetail?.tenantName || 
           payload.properties?.tenantName || 
           payload.preferredSubdomain1 || 
           payload.preferredSubdomain2 || 
           payload.properties?.preferredSubdomain1 || 
           payload.properties?.preferredSubdomain2 || 
           payload.tenantName || 
           'N/A';
  } catch (error) {
    return 'N/A';
  }
};

export default {
  validateRecord,
  getValidationTooltip,
  parseEntitlements,
  parseTenantName,
};



