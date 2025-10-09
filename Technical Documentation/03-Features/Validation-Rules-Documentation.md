# Validation Rules Documentation

## Overview

The Validation Rules system provides automated data validation for Technical Team Request records in the Provisioning Monitor. This system validates product data to ensure compliance with business rules and data quality standards.

## Architecture

### Components
- **ValidationEngine**: Core validation processing engine
- **Validation Rules Configuration**: Rule definitions and state management
- **UI Integration**: Validation Rules sub-page and table column integration
- **Local Storage**: Persistent rule configuration storage

### Data Flow
1. User loads Provisioning Monitor page
2. Salesforce API returns Technical Team Request records with `Payload_Data__c`
3. Validation Engine processes each record against enabled rules
4. Results displayed in "Data Validations" table column
5. Detailed results available via tooltips

## Implemented Validation Rules

### 1. App Quantity Validation

**Rule ID**: `app-quantity-validation`

**Purpose**: Ensures app entitlements have valid quantity settings according to business rules.

**Logic**: 
For each app entitlement in the `appEntitlements` array:
- **PASS Conditions**:
  - Quantity equals 1, OR
  - Product Code equals "IC-DATABRIDGE"
- **FAIL Condition**: 
  - Quantity is not 1 AND Product Code is not "IC-DATABRIDGE"

**Overall Result**: 
- **PASS**: All app entitlements meet the pass conditions
- **FAIL**: At least one app entitlement fails the conditions

**Data Structure**:
```json
{
  "properties": {
    "provisioningDetail": {
      "entitlements": {
        "appEntitlements": [
          {
            "name": "Application Name",
            "productCode": "PRODUCT-CODE",
            "quantity": 1
          }
        ]
      }
    }
  }
}
```

**Implementation Details**:
- Searches multiple possible JSON paths for app entitlements
- Handles missing or malformed data gracefully (defaults to PASS)
- Provides detailed failure information including specific apps that failed
- Logs validation process for debugging

**Error Handling**:
- Missing `Payload_Data__c` field → PASS
- Malformed JSON → PASS  
- Missing `appEntitlements` array → PASS
- Validation logic errors → PASS
- Only explicit rule failures result in FAIL status

## Configuration Management

### Storage Location
Validation rules configuration is stored in browser localStorage with key: `deploymentAssistant_validationRules`

### Configuration Schema
```json
{
  "version": "1.0",
  "rules": [
    {
      "id": "rule-identifier",
      "name": "Human Readable Name",
      "description": "Brief description",
      "longDescription": "Detailed explanation",
      "enabled": true,
      "category": "validation-category",
      "version": "1.0",
      "createdDate": "2025-01-24"
    }
  ],
  "enabledRules": {
    "rule-identifier": true
  },
  "lastUpdated": "2025-01-24T...",
  "settings": {
    "showDetailedTooltips": true,
    "validateOnLoad": true
  }
}
```

### Default Settings
- All rules enabled by default
- Validation runs automatically on page load
- Detailed tooltips enabled
- Configuration persists between browser sessions

## User Interface

### Validation Rules Section
**Location**: Settings Page → Data Validation Rules (collapsible section)

**Features**:
- List of all available validation rules
- Enable/disable toggles for each rule
- Rule descriptions and logic explanations
- Test button to validate current page data
- JSON structure debug tool
- Integrated with application settings for centralized configuration

### Provisioning Monitor Integration
**Column**: "Data Validations" (between "Products" and "Status")

**Display**:
- **PASS**: Green badge with checkmark
- **FAIL**: Red badge with X mark
- **Tooltip**: Detailed validation results on hover

## Technical Implementation

### Performance Considerations
- Validation runs only on displayed records (25 per page)
- JSON parsing and validation cached per record
- Lightweight processing suitable for real-time execution
- Validation results stored in memory for current page session

### API Integration
- Added `Payload_Data__c` to Salesforce SOQL query
- No additional API calls required for validation
- Validation processing happens client-side

### Browser Compatibility
- Uses modern JavaScript features (ES6+)
- LocalStorage for configuration persistence
- Compatible with all modern browsers

## Debugging and Troubleshooting

### Debug Tools
1. **JSON Structure Analyzer**: Available on Validation Rules page
   - Explores actual payload data structure
   - Identifies correct path to app entitlements
   - Shows sample data for rule development

2. **Console Logging**: Detailed validation logs
   - Rule execution traces
   - JSON parsing results
   - Validation decisions and reasoning

3. **Test Validation**: Manual validation trigger
   - Tests rules against current page data
   - Shows detailed results for each record
   - Helpful for rule development and debugging

### Common Issues

**Issue**: Validation showing incorrect results
- **Check**: JSON structure matches expected format
- **Solution**: Use debug tool to verify data paths

**Issue**: Rules not persisting between sessions  
- **Check**: Browser localStorage permissions
- **Solution**: Verify localStorage is enabled

**Issue**: Validation not running automatically
- **Check**: `validateOnLoad` setting in configuration
- **Solution**: Enable automatic validation in settings

### Validation Logs
All validation activity is logged to browser console with `[VALIDATION]` prefix:
- Rule execution start/completion
- JSON parsing results
- Individual app entitlement checks
- Final validation decisions
- Configuration changes

## Future Enhancements

### Planned Features
1. Additional validation rules for other product types
2. Cross-record validation capabilities  
3. Validation history and reporting
4. Custom rule creation interface
5. Bulk validation operations

### Extensibility
The ValidationEngine is designed for easy extension:
- Add new rules by updating `DEFAULT_VALIDATION_RULES`
- Implement rule logic in `executeRule` method
- Follow existing error handling patterns
- Use consistent logging and result formats

## API Reference

### ValidationEngine Methods

#### `validateRecord(record, enabledRules)`
Validates a single record against enabled rules.

**Parameters**:
- `record`: Technical Team Request record object
- `enabledRules`: Array of enabled rule objects

**Returns**: Validation results object with overall status and rule details

#### `executeRule(rule, payload, record)`  
Executes a specific validation rule.

**Parameters**:
- `rule`: Rule definition object
- `payload`: Parsed JSON payload data
- `record`: Full record object for context

**Returns**: Rule execution result object

#### `validateAppQuantities(payload, record)`
Implements the app quantity validation rule.

**Parameters**:
- `payload`: Parsed JSON payload data  
- `record`: Full record object for context

**Returns**: App quantity validation result

#### `getValidationTooltip(validationResult)`
Generates human-readable tooltip text.

**Parameters**:
- `validationResult`: Result from validateRecord

**Returns**: Formatted tooltip string

#### `analyzePayloadStructure(payload)`
Debug utility to analyze JSON payload structure.

**Parameters**:
- `payload`: Parsed JSON payload data

**Returns**: Structure analysis object

### Configuration Functions

#### `loadValidationConfig()`
Loads configuration from localStorage with defaults.

**Returns**: Complete validation configuration object

#### `saveValidationConfig(config)`
Saves configuration to localStorage.

**Parameters**:
- `config`: Configuration object to save

#### `getEnabledValidationRules()`
Gets array of currently enabled rules.

**Returns**: Array of enabled rule objects

#### `updateRuleEnabledState(ruleId, enabled)`
Updates enabled state of a specific rule.

**Parameters**:
- `ruleId`: ID of rule to update
- `enabled`: New enabled state (boolean)

## Version History

### Version 1.0 (2025-01-24)
- Initial implementation
- App Quantity Validation rule
- LocalStorage configuration management
- Provisioning Monitor table integration
- Debug and testing tools
- Comprehensive error handling

---

*This documentation is maintained as part of the Deployment Assistant Technical Documentation.*
