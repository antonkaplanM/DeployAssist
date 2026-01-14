# ✅ Moody's Analytics Salesforce Integration Test

## Summary

Successfully tested connecting to the **Moody's Analytics Salesforce instance** using Playwright to extract a browser session token.

---

## Connection Details

| Property | Value |
|----------|-------|
| **Instance URL** | https://moodysanalytics.my.salesforce.com |
| **Lightning URL** | https://moodysanalytics.lightning.force.com |
| **Organization ID** | 00D400000008nKe |
| **Authentication** | Browser Session Token (SID Cookie) |
| **SSO Provider** | Okta |
| **API Version** | v59.0 |

---

## Test Results

### ✅ Connection Test - PASSED

```
✅ API Connection successful!
   User: Anton Kaplan
   Email: anton.kaplan@moodys.com
```

### ✅ Product2 Object Access - PASSED

```
✅ Found 183 fields on Product2
✅ Query successful! Retrieved 2,000 products
```

---

## Data Retrieved

| File | Description | Location |
|------|-------------|----------|
| `MA_Product2_Data.json` | Full JSON with 2,000 products | `docs/data/` |
| `MA_Product2_Data.csv` | CSV export | `docs/data/` |
| `MA_Product2_Fields.json` | All 183 Product2 fields | `docs/data/` |

---

## How the Authentication Works

### Method: Playwright Browser Session Extraction

1. **Launch Browser** - Opens Chromium browser to the MA Salesforce Lightning URL
2. **User Login** - User completes Okta SSO authentication (including MFA if required)
3. **Extract Session** - Script extracts the `sid` cookie from the browser session
4. **API Calls** - Session ID is used as Bearer token for REST API calls
5. **Query Data** - SOQL queries executed against the Product2 object

### Script Location

```
scripts/test-ma-salesforce-session.js
```

### Usage

```bash
node scripts/test-ma-salesforce-session.js
```

---

## Key Differences from RMS Salesforce

| Aspect | RMS Salesforce | MA Salesforce |
|--------|---------------|---------------|
| **Instance** | riskms.my.salesforce.com | moodysanalytics.my.salesforce.com |
| **Org ID** | 00D300000001JBYEA2 | 00D400000008nKe |
| **Auth Method** | Client Credentials (OAuth) | Browser Session Token |
| **Server-to-Server** | ✅ Yes | ❌ No (requires user login) |
| **Automated** | ✅ Fully automated | ⚠️ Requires manual login |

---

## Limitations of Browser Session Approach

| Limitation | Impact |
|------------|--------|
| **Session Expiry** | Tokens expire (typically 2-12 hours) |
| **Manual Login Required** | Cannot be fully automated |
| **MFA Handling** | User must complete MFA prompts |
| **Not Production-Ready** | Only suitable for testing/exploration |
| **Security Policies** | May violate corporate security policies |

---

## For Production Use

To use this integration in production, you would need:

1. **Connected App** created in the MA Salesforce org
2. **OAuth Client Credentials** (Client ID & Secret)
3. **API User** with appropriate permissions
4. **Client Credentials Flow** enabled on the Connected App

Contact the MA Salesforce Administrator to request a Connected App.

---

## Sample Query Results

### Product2 Records (Sample)

| Name | ProductCode | Family | IsActive |
|------|-------------|--------|----------|
| 314a Processing | 69895 | N/A | true |
| 4 distributed processors and high volumes | SII High Perform_B | 4 distributed processors... | false |

### Fields Available on Product2

The Product2 object has **183 fields** including:
- Standard fields: Id, Name, ProductCode, Family, Description, IsActive
- Custom fields: (see `MA_Product2_Fields.json` for full list)

---

---

## RMS Products Query

### Query Details

```sql
SELECT Id, Name, ProductCode, L1Hierarchy__c, L2Hierarchy__c, L3Hierarchy__c, L4Hierarchy__c, Legacy_Product_ID__c 
FROM Product2 
WHERE L2Hierarchy__c = 'Risk Management Solutions' 
ORDER BY Name ASC
```

### Results

| Metric | Value |
|--------|-------|
| **Total RMS Products** | 2,063 |
| **Products with Legacy Code** | 2 |

### Products by L3 Hierarchy

| L3 Hierarchy | Count |
|--------------|-------|
| Model & Data | 1,446 |
| RMS Model & Data | 263 |
| CAPE | 181 |
| Platform & Software | 68 |
| Moody's Climate | 60 |
| Services | 22 |
| Risk Mgmt Sol | 18 |
| Casualty | 5 |

### Output Files

| File | Description |
|------|-------------|
| `MA_RMS_Products.json` | Full JSON with all 2,063 RMS products |
| `MA_RMS_Products.csv` | CSV export for Excel |

### Script

```bash
node scripts/query-ma-rms-products.js
```

---

---

## RMS Products with Legacy Codes (SKU Mapping)

### Query Details

The legacy product codes are stored in the `SKU_Mapping__c` object, linked to products via `New_Product_ID__c`.

```sql
-- Step 1: Get RMS Products
SELECT Id, Name, ProductCode, L1Hierarchy__c, L2Hierarchy__c, L3Hierarchy__c, L4Hierarchy__c 
FROM Product2 
WHERE L2Hierarchy__c = 'Risk Management Solutions'

-- Step 2: Get Legacy Codes from SKU Mapping
SELECT New_Product_ID__c, New_Product_Code__c, Old_Product_Code_Interim__c 
FROM SKU_Mapping__c 
WHERE Old_Product_Code_Interim__c != null
```

### Key Field: `Old_Product_Code_Interim__c`

| Field | Label | Object |
|-------|-------|--------|
| `Old_Product_Code_Interim__c` | "Old / Legacy Product Code" | SKU_Mapping__c |

### Results

| Metric | Value |
|--------|-------|
| **Total RMS Products** | 2,063 |
| **Products with Legacy Codes** | 1,535 (74.4%) |
| **SKU Mappings Retrieved** | 4,944 |

### Output Files

| File | Description |
|------|-------------|
| `MA_RMS_Products_With_Legacy.xlsx` | Excel with 3 tabs (RMS Products, Summary, Products with Legacy) |
| `MA_RMS_Products_With_Legacy.json` | Full JSON with merged data |

### Script

```bash
node scripts/query-rms-products-with-legacy.js
```

---

**Status**: ✅ **TEST SUCCESSFUL**  
**Date**: January 12, 2026  
**Method**: Browser Session Token via Playwright
