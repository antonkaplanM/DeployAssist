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

### Option 2: Polling (For Remote Users)

For remote users who cannot directly access the Deploy Assist API (e.g., network restrictions, VPN issues):

```
┌─────────────────────────────────────────────────────────────────┐
│  Remote User's Computer                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Enter inputs in Excel                                 │    │
│  │ 2. Click "Submit" → sets FLAG = "PENDING"                │    │
│  │ 3. Wait for results...                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ OneDrive Sync
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Shared Excel File (OneDrive)                                    │
│  B8 cell: "Pull Data" → "Processing..." → "Completed"             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Microsoft Graph API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Host Machine (Deploy Assist)                                    │
│  Polls Excel → Processes request → Writes results                │
└─────────────────────────────────────────────────────────────────┘
```

See [Excel-Polling-VBA-Code.md](Excel-Polling-VBA-Code.md) for setup instructions.

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

## Polling API Endpoints

For controlling the polling service (remote user support):

```
GET  /api/excel-polling/status     - Get polling status
POST /api/excel-polling/configure  - Configure Excel file to poll
POST /api/excel-polling/start      - Start polling
POST /api/excel-polling/stop       - Stop polling
POST /api/excel-polling/interval   - Set polling interval
POST /api/excel-polling/test       - Test single poll
```

## Files

### Backend
- `services/excel-lookup.service.js` - Business logic for tenant lookup and comparison
- `services/excel-polling.service.js` - Polling service for remote user support
- `services/debug-config.service.js` - Debug output configuration (mute/unmute categories)
- `routes/excel-lookup.routes.js` - Direct API endpoints
- `routes/excel-polling.routes.js` - Polling control endpoints
- `routes/debug-config.routes.js` - Debug configuration endpoints
- `scripts/test-excel-lookup-file.js` - Graph API test script

### Documentation
- `docs/technical/Technical Documentation/03-Features/Excel-Lookup-VBA-Code.md` - VBA code for direct API access
- `docs/technical/Technical Documentation/03-Features/Excel-Polling-VBA-Code.md` - VBA code for remote users (polling)

### Configuration
- `config/onedrive-excel-config.json` - Saved Excel file configuration

## Excel Workbook Structure

### Sheet: Lookup (Input/Output)

| Cell/Range | Purpose |
|------------|---------|
| B2 | Tenant Name/ID input |
| B3 | PS Record input (optional) |
| B4 | Force Fresh ("YES" to bypass database cache and fetch live SML data) |
| B8 | Action flag - "Pull Data" to trigger, "Completed" when done |
| D2 | Status (auto-filled) |
| D3 | Error message (auto-filled) |
| D4 | Timestamp (auto-filled) |
| F2-G6 | Summary statistics |
| A16:G16 | SML Entitlements header (auto-filled) |
| A17+ | SML Entitlements data (auto-filled) |

#### SML Entitlements Output (Row 16+)

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

## Configuration

### Session Timeout
The app is configured with extended session timeouts (1 year) to allow leaving the app running for remote user polling:
- Access token lifetime: 1 year
- Refresh token lifetime: 1 year
- Inactivity timeout: 1 year (effectively disabled)

### Debug Configuration
Debug output can be controlled via Settings > Debug Configuration:
- Toggle individual categories to mute/unmute console output
- Categories: excel-polling, excel-lookup, sml, salesforce, database, auth, graph-api
- API: `/api/debug-config/status`, `/api/debug-config/toggle/:categoryId`, etc.

## Implementation Date

- January 28, 2026 - Initial setup and VBA testing
- January 28, 2026 - Full implementation complete
- January 28, 2026 - Added debug configuration, session timeout removal, SML output moved to Lookup sheet
