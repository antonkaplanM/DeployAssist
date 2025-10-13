const path = require('path');
const { ValidationEngine, DEFAULT_VALIDATION_RULES } = require(path.join('..','..','public','validation-rules.js'));

describe('ValidationEngine', () => {
  const enabledRules = DEFAULT_VALIDATION_RULES;

  it('passes when no payload is present', () => {
    const record = { Id: '001', Name: 'NoPayload' };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    expect(result.overallStatus).toBe('PASS');
  });

  it('app-quantity-validation: quantity 1 passes, others fail unless IC-DATABRIDGE or RI-RISKMODELER-EXPANSION', () => {
    const payload = {
      entitlements: {
        appEntitlements: [
          { name: 'App A', quantity: 1, productCode: 'X' },
          { name: 'App B', quantity: 2, productCode: 'X' },
          { name: 'DB', quantity: 5, productCode: 'IC-DATABRIDGE' },
          { name: 'RM', quantity: 10, productCode: 'RI-RISKMODELER-EXPANSION' }
        ]
      }
    };
    const record = { Id: '002', Name: 'Apps', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'app-quantity-validation');
    expect(rule.status).toBe('FAIL');
    expect(rule.details.failCount).toBe(1); // Only App B should fail
    expect(rule.details.passCount).toBe(3); // App A, DB, and RM should pass
  });

  it('app-quantity-validation: RI-RISKMODELER-EXPANSION with any quantity passes', () => {
    const payload = {
      entitlements: {
        appEntitlements: [
          { name: 'RM1', quantity: 1, productCode: 'RI-RISKMODELER-EXPANSION' },
          { name: 'RM2', quantity: 5, productCode: 'RI-RISKMODELER-EXPANSION' },
          { name: 'RM3', quantity: 100, productCode: 'RI-RISKMODELER-EXPANSION' }
        ]
      }
    };
    const record = { Id: '007', Name: 'RiskModeler', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'app-quantity-validation');
    expect(rule.status).toBe('PASS');
    expect(rule.details.passCount).toBe(3);
    expect(rule.details.failCount).toBe(0);
  });

  it('model-count-validation: more than 100 fails', () => {
    const models = Array.from({ length: 101 }, (_, i) => ({ productCode: `M${i+1}` }));
    const payload = { entitlements: { modelEntitlements: models } };
    const record = { Id: '003', Name: 'Models', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'model-count-validation');
    expect(rule.status).toBe('FAIL');
  });

  it('entitlement-date-overlap-validation: overlapping dates fail', () => {
    const payload = {
      entitlements: {
        appEntitlements: [
          { productCode: 'X', startDate: '2025-01-01', endDate: '2025-02-01' },
          { productCode: 'X', startDate: '2025-01-15', endDate: '2025-03-01' }
        ]
      }
    };
    const record = { Id: '004', Name: 'Overlap', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'entitlement-date-overlap-validation');
    expect(rule.status).toBe('FAIL');
  });

  it('entitlement-date-overlap-validation: identical dates fail (PS-4859 bug)', () => {
    const payload = {
      entitlements: {
        appEntitlements: [
          { productCode: 'RI-RISKMODELER-EXPANSION', startDate: '2025-01-01', endDate: '2025-12-31' },
          { productCode: 'RI-RISKMODELER-EXPANSION', startDate: '2025-01-01', endDate: '2025-12-31' }
        ]
      }
    };
    const record = { Id: '005', Name: 'PS-4859', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'entitlement-date-overlap-validation');
    expect(rule.status).toBe('FAIL');
    expect(rule.details.overlapsFound).toBe(1);
    expect(rule.details.overlaps[0].description).toContain('identical date ranges');
  });

  it('entitlement-date-overlap-validation: non-overlapping dates pass', () => {
    const payload = {
      entitlements: {
        appEntitlements: [
          { productCode: 'X', startDate: '2025-01-01', endDate: '2025-02-01' },
          { productCode: 'X', startDate: '2025-02-01', endDate: '2025-03-01' }
        ]
      }
    };
    const record = { Id: '006', Name: 'NoOverlap', Payload_Data__c: JSON.stringify(payload) };
    const result = ValidationEngine.validateRecord(record, enabledRules);
    const rule = result.ruleResults.find(r => r.ruleId === 'entitlement-date-overlap-validation');
    expect(rule.status).toBe('PASS');
  });
});

