# Fix: Refresh SML Data Button Error (Code 1)

## Issue
When clicking the "Refresh SML Data" button on the Provisioning Monitor page, users received an error with exit code 1.

## Root Cause
The issue was caused by incorrect file paths in three locations:

### 1. Route Configuration (`routes/validation.routes.js`)
The route was looking for the script at the wrong location:
```javascript
// INCORRECT - Looking in root directory
const scriptPath = path.join(__dirname, '../process-sml-validation.js');
```

The script is actually located at `scripts/audit/process-sml-validation.js`.

### 2. Script Dependencies (`scripts/audit/process-sml-validation.js`)
The script had incorrect relative import paths:
```javascript
// INCORRECT - These files don't exist in scripts/audit/
const salesforce = require('./salesforce');
const { SMLValidationHelper } = require('./sml-validation-helper');
```

The actual locations are:
- `salesforce.js` → root directory
- `sml-validation-helper.js` → `utils/` directory

### 3. SML Validation Helper Dependencies (`utils/sml-validation-helper.js`)
The helper file had incorrect relative import paths:
```javascript
// INCORRECT - These files don't exist in utils/
const SMLService = require('./sml-service');
const SMLRepository = require('./sml-repository');
```

The actual locations are:
- `sml.service.js` → `services/` directory
- `sml.repository.js` → `repositories/` directory

## Fix Applied

### File 1: `routes/validation.routes.js`
Updated the script path to point to the correct location:
```javascript
const scriptPath = path.join(__dirname, '../scripts/audit/process-sml-validation.js');
```

### File 2: `scripts/audit/process-sml-validation.js`
Updated the require statements with correct relative paths:
```javascript
const salesforce = require('../../salesforce');
const { SMLValidationHelper } = require('../../utils/sml-validation-helper');
```

### File 3: `utils/sml-validation-helper.js`
Updated the require statements with correct relative paths:
```javascript
const SMLService = require('../services/sml.service');
const SMLRepository = require('../repositories/sml.repository');
```

## Testing
After applying the fix:
1. Navigate to Provisioning → Monitor
2. Click the "Refresh SML Data" button
3. The process should start successfully without error code 1

Verified working on December 12, 2025 - processed 16 deprovision records successfully.

## Date
December 12, 2025

