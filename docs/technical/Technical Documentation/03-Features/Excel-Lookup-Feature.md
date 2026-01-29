# Excel Lookup Feature

## Overview

The Excel Lookup feature allows users to enter a tenant name/ID and optionally a PS record in an Excel spreadsheet, then trigger a lookup that:

1. **Fetches SML Entitlements** - Current entitlements for the tenant from SML
2. **Compares with PS Record** - If a PS record is provided, compares PS record entitlements vs SML

Results are written back to the Excel spreadsheet with color-coded comparison status.

## Implementation Status

| Component | Status |
|-----------|--------|
| Backend API Endpoints | ✅ Complete |
| Excel Lookup Service | ✅ Complete |
| VBA Test Script | ✅ Tested and working |
| Full SML Lookup | ✅ Complete |
| Full Comparison Logic | ✅ Complete |
| Production VBA Code | ✅ Complete |
| Excel File Structure | ✅ Documented |

## Architecture

### Option 1: VBA Macro + API (Primary)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Excel Workbook                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input Area                                              │   │
│  │  A2: [Tenant Name/ID]   B2: [PS Record]                 │   │
│  │                                                         │   │
│  │  [🔍 Lookup Button] ← VBA macro calls API               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ HTTP POST                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Deploy Assist API                                        │   │
│  │  POST /api/excel-lookup/compare                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ JSON Response                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ VBA writes results to Excel sheets                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Option 2: Polling (Fallback)

If VBA HTTP requests are blocked, the app polls the Excel file via Microsoft Graph API.

## API Endpoints

### Test Endpoint

```
GET /api/excel-lookup/test
POST /api/excel-lookup/test
```

Simple test endpoints to verify VBA connectivity.

### Tenant Lookup

```
POST /api/excel-lookup/tenant
Body: { "tenantNameOrId": "acme-corp" }
```

Returns SML entitlements for the specified tenant.

### Compare with PS Record

```
POST /api/excel-lookup/compare
Body: { 
  "tenantNameOrId": "acme-corp", 
  "psRecordName": "PS-12345",
  "forceFresh": true  // Optional: bypass database cache, fetch live SML data
}
```

Returns SML entitlements and comparison with PS record.

### Excel-Formatted Compare

```
POST /api/excel-lookup/compare-excel
Body: { 
  "tenantNameOrId": "acme-corp", 
  "psRecordName": "PS-12345",
  "forceFresh": true  // Optional: bypass database cache, fetch live SML data
}
```

Returns data formatted specifically for VBA with flat arrays for easy Excel output.

## Comparison Color Coding

| Status | Color | Meaning |
|--------|-------|---------|
| **In SF Only** | 🟢 Green | Adding an entitlement (PS has it, SML doesn't yet) |
| **In SML Only** | 🔴 Red | Removing an entitlement (SML has it, PS doesn't) |
| **Different** | 🟡 Yellow | Entitlement exists in both but attributes differ |
| **Match** | 🔵 Blue | Entitlement matches in both systems |

## Testing

### Step 1: Verify VBA Connectivity

1. Open the test Excel file
2. Press Alt+F11 to open VBA editor
3. Insert → Module
4. Paste the VBA test code
5. Run `RunAllTests` macro
6. Note which tests pass/fail

### Step 2: Verify Graph API Access (Optional)

```bash
node scripts/test-excel-lookup-file.js "https://moodys-my.sharepoint.com/..."
```

## Files

### Backend
- `services/excel-lookup.service.js` - Business logic for tenant lookup and comparison
- `routes/excel-lookup.routes.js` - API endpoints
- `scripts/test-excel-lookup-file.js` - Graph API test script

### Documentation
- `docs/technical/Technical Documentation/03-Features/Excel-Lookup-VBA-Code.md` - Complete VBA code

### Configuration
- `config/onedrive-excel-config.json` - Saved Excel file configuration

## Excel Workbook Structure

### Sheet: Lookup (Input)

| Cell | Purpose |
|------|---------|
| B2 | Tenant Name/ID input |
| B3 | PS Record input (optional) |
| B4 | Force Fresh ("YES" to bypass database cache and fetch live SML data) |
| D2 | Status (auto-filled) |
| D3 | Error message (auto-filled) |
| D4 | Timestamp (auto-filled) |
| F2-G6 | Summary statistics |

### Sheet: SML Entitlements (Output)

| Column | Content |
|--------|---------|
| A | Product Code |
| B | Type (Model/Data/App) |
| C | Package Name |
| D | Start Date |
| E | End Date |
| F | Quantity |
| G | Modifier |

### Sheet: Comparison (Output)

| Column | Content |
|--------|---------|
| A | Product Code |
| B | Type |
| C | Status (color-coded) |
| D-F | SML values |
| G-I | PS values |
| J | Notes |

## Related Documentation

- [Excel-Lookup-VBA-Code.md](Excel-Lookup-VBA-Code.md) - Complete VBA code and setup instructions
- [Current-Accounts.md](Current-Accounts.md) - Related Current Accounts feature
- [SML-Ghost-Accounts-Implementation.md](SML-Ghost-Accounts-Implementation.md) - SML service details

## Implementation Date

- January 28, 2026 - Initial setup and VBA testing
- January 28, 2026 - Full implementation complete
