# Risk Intelligence Spreadsheet vs Current Accounts Database - Discrepancy Analysis

**Date:** January 7, 2026  
**Source:** Analysis of RI Onboarded Tenants spreadsheet (Production tab) vs `current_accounts` database table  
**DB Source:** SML (considered more accurate)

## Executive Summary

| Metric | Spreadsheet | Database | Difference |
|--------|-------------|----------|------------|
| Total Records | 543 | 645 | -102 |
| Unique Tenants | 290 | 429 | -139 |
| Unique Clients | 251 | 370 | -119 |

After applying service name mapping:
- **135 records** in Spreadsheet NOT in Database
- **245 records** in Database NOT in Spreadsheet

---

## Root Cause Analysis

### 1. Spreadsheet Records Missing from Database (135 records)

#### Primary Cause: **OFFBOARDED STATUS** (78.5% - 106 records)

The database (SML) only maintains **active** tenants. When a tenant is offboarded, SML removes them from the active list. However, the spreadsheet retains historical offboarded records.

| Status | Count | % of Missing |
|--------|-------|--------------|
| Offboarded | 106 | 78.5% |
| Completed | 27 | 20.0% |
| Deprovisioned | 2 | 1.5% |

**Key Insight:** 91 of 106 offboarded records are from tenants that **no longer exist** in the database at all.

#### Tenant-Level Analysis:
- **67 unique tenants** in spreadsheet are NOT in DB
- 96 of the records from these tenants are "Offboarded"
- Only 12 records from these tenants are "Completed" (potential data issues)

#### Examples of Offboarded Tenants Not in DB:
| Tenant | Client | Services |
|--------|--------|----------|
| ajg | Arthur J. Gallagher & Co | LI API, Exposure Add-on, Data Bridge, Risk Modeler, UnderwriteIQ |
| axaxl | AxaXL | Risk Modeler, Exposure Add-on, Data Bridge |
| qbe | QBE | Exposure Add-on, Data Bridge, Risk Modeler |
| scorpoc | SCOR | Risk Modeler, Data Bridge |

---

### 2. Database Records Missing from Spreadsheet (245 records)

#### Primary Cause: **RI-COD-STN Product Not Tracked** (81.2% - 199 records)

The RI spreadsheet does **not track COD-STN (Climate on Demand - Standard)** customers. These are primarily:
- Banks and financial institutions
- Real estate companies
- Non-traditional insurance customers

| Service Code | Count | % of Missing |
|--------------|-------|--------------|
| RI-COD-STN | 199 | 81.2% |
| DATAAPI-LOCINTEL | 14 | 5.7% |
| RI-EXPOSUREIQ | 5 | 2.0% |
| RI-RISKMODELER | 5 | 2.0% |
| DATAAPI-BULK-GEOCODE | 5 | 2.0% |
| Other services | 17 | 6.9% |

**Key Insight:** If we exclude COD-STN records, only 46 records are truly "missing" from the spreadsheet.

#### Examples of COD-STN Customers Not in Spreadsheet:
- ABN AMRO Bank N.V.
- American Express Company
- Alliance Bank Malaysia Berhad
- AmeriCold Realty Trust
- Al Rajhi Banking & Investment Corporation

---

### 3. Service Name Mapping

The spreadsheet uses friendly names while the database uses product codes:

| Spreadsheet Name | Database Code |
|------------------|---------------|
| Risk Modeler | RI-RISKMODELER |
| Data Bridge | IC-DATABRIDGE |
| LI API | DATAAPI-LOCINTEL |
| ExposureIQ | RI-EXPOSUREIQ |
| UnderwriteIQ | RI-UNDERWRITEIQ |
| Exposure Add-on | RI-RISKMODELER-EXPOSURE_ADDON |
| TreatyIQ | RI-TREATYIQ |
| ESG | RI-EXPOSUREIQ-ESG |
| Data Vault | RI-DATAVAULT |
| Cometa | RI-COMETA |
| PCAF | RI-EXPOSUREIQ-PCAF |
| VPN | IC-VPN |
| SiteIQ | RI-COD-STN (?) |

**Note:** SiteIQ may or may not map to RI-COD-STN - this requires verification.

---

## Key Findings & Recommendations

### Finding 1: Offboarded Records Explain Most Spreadsheet Discrepancies
- **78.5%** of spreadsheet records not in DB are "Offboarded"
- The DB is correctly not tracking these inactive accounts
- **Recommendation:** The spreadsheet could be cleaned up to remove offboarded records, or a separate "Offboarded" tab could be created

### Finding 2: COD-STN is a Separate Product Category
- **81.2%** of DB records not in spreadsheet are COD-STN
- COD-STN targets different customer segments (banks, real estate)
- **Recommendation:** Determine if COD-STN should be tracked in the RI spreadsheet or maintained separately

### Finding 3: Small Number of True Discrepancies
After excluding:
- Offboarded records (spreadsheet → DB)
- COD-STN records (DB → spreadsheet)

**True discrepancies are minimal:**
- ~27 "Completed" records in spreadsheet not in DB
- ~46 non-COD-STN records in DB not in spreadsheet

### Finding 4: Provisioning Status Terminology Differs
| Spreadsheet Status | Database Status |
|--------------------|-----------------|
| Completed | Tenant Request Completed |
| Offboarded | (not present) |
| In progress | Submitted for Onboarding |

---

## Data Quality Issues to Address

1. **11 "Completed" records** from tenants that don't exist in DB
   - These may be data entry errors or renamed tenants
   
2. **206 new tenants** in DB not tracked in spreadsheet
   - Mostly COD-STN (different product line)
   - 40 records have "Unknown" region

3. **SiteIQ mapping** needs verification
   - Is SiteIQ the same as COD-STN, or are they different products?

---

## Script Used for Analysis

The comparison was performed using `/scripts/compare-ri-vs-db.js` with service name normalization.

To run the analysis:
```bash
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres" 
$env:DB_NAME = "deployment_assistant"
node scripts/compare-ri-vs-db.js
```

