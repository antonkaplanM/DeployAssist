# Current Accounts - Excel Export Feature

## Overview
Replaced the CSV export functionality with a direct Excel file update feature. Users can now update an existing Excel file via **Microsoft Graph API** (OneDrive with co-authoring support) or use direct file system access. This enables collaborative workflows where multiple users share a common Excel file.

## Implementation Date
January 14-15, 2026 (Initial)
January 26, 2026 (UI Redesign with tabs)
January 27, 2026 (Add by Link feature)

## Features

### 1. OneDrive Mode (Recommended)
Uses Microsoft Graph API for true co-authoring support:
- **Works while file is open** by other users
- **Four organized tabs**: Recent, My Files, Shared, Create New
- Search OneDrive and shared files
- **Add by Link**: Paste a OneDrive sharing link to access files shared via link
- Select worksheet from dropdown (with option to create new worksheet)
- Updates sync to all collaborators in real-time
- No file locking issues

### 2. Local File Mode (Fallback)
Direct file system access for when OneDrive is not available:
- Requires file to be closed by all users
- Works with local or network drives
- Option to create new file or update existing

### 3. Data Columns (Matching Confluence)
| Column | Data Field |
|--------|------------|
| Client | `client` |
| Services | `services` |
| Type | `account_type` |
| CSM/Owner | `csm_owner` |
| PS Record | `ps_record_name` |
| Completed | `completion_date` |
| Size | `size` |
| Region | `region` |
| Tenant | `tenant_name` |
| Tenant ID | `tenant_id` |
| SF Account ID | `salesforce_account_id` |
| Tenant URL | `tenant_url` |
| Admin | `initial_tenant_admin` |
| Comments | `comments` |

### 4. Excel Formatting
- **Bold header row** with blue background and white text
- **Auto-filters** enabled on all columns
- **Table format** for easy sorting/filtering

## Azure AD Configuration

### Prerequisites
The following environment variables must be set in `.env`:

```env
AZURE_CLIENT_ID=your-client-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback
```

### Azure App Registration Settings
| Setting | Value |
|---------|-------|
| Name | DeployAssist |
| Supported account types | Single tenant |
| Redirect URI | `http://localhost:5000/api/auth/microsoft/callback` |
| API Permissions | See below |

### Required API Permissions (Microsoft Graph - Delegated)

| Permission | Purpose | Admin Consent |
|------------|---------|---------------|
| `Sites.Selected` | Access specific sites granted by admin | Yes |
| `Files.ReadWrite` | Read/write user's files | No |
| `User.Read` | Read user profile | No |

> **Note**: `Sites.Selected` requires admin consent AND explicit permission grants to specific sites/files via the Graph API. This provides more granular control than `Files.ReadWrite.All`.

### Alternative Permissions (Broader Access)
If you prefer automatic access to all shared files without per-site configuration:

| Permission | Purpose | Admin Consent |
|------------|---------|---------------|
| `Files.ReadWrite.All` | Read/write all files user can access | Yes |
| `Sites.Read.All` | Access SharePoint sites | Yes |
| `User.Read` | Read user profile | No |

## Technical Implementation

### Backend Components

#### `services/microsoft-auth.service.js`
Handles OAuth 2.0 authentication with Azure AD:
- Token acquisition and refresh
- Token cache persistence
- Connection status checks

#### `services/microsoft-graph-excel.service.js`
Handles Excel operations via Microsoft Graph API:
- Search OneDrive files (personal and shared)
- Get worksheets from workbook
- Update worksheet content with co-authoring support
- Create new workbooks
- Test access to shared files via share URL

**Key Methods:**
- `listAllSharedExcelFiles()` - List shared files from multiple sources:
  - `/me/drive/sharedWithMe` - Files explicitly shared
  - Microsoft Search API - Files in SharePoint & other OneDrives
  - Saved linked files - Files added via share link
- `searchExcelFiles(query)` - Search personal, shared, and SharePoint files
- `getWorksheets(driveId, itemId)` - List worksheets in a workbook
- `updateWorksheet(driveId, itemId, worksheetName, accounts)` - Update worksheet content
- `createWorksheet(driveId, itemId, worksheetName, accounts)` - Create new worksheet
- `createExcelFile(fileName, worksheetName, accounts, folderId)` - Create new file
- `resolveShareLink(shareLink)` - Convert a sharing link to file info
- `testSharedFileAccess(shareUrl)` - Test access to a shared file

#### `services/excel.service.js` (Local Mode)
Core service for local Excel operations using ExcelJS library.

#### Configuration Storage

**Last used file:** `config/onedrive-excel-config.json`
```json
{
  "driveId": "b!wjRBKz...",
  "itemId": "01RNED4NYI3...",
  "fileName": "Risk Intelligence Onboarded Tenants.xlsx",
  "worksheetName": "Current Accounts",
  "lastUpdated": "2026-01-26T22:30:00.000Z"
}
```

**Files added via link:** `config/onedrive-linked-files.json`
```json
{
  "files": [
    {
      "id": "01RNED4NYI3...",
      "driveId": "b!wjRBKz...",
      "name": "Shared Workbook.xlsx",
      "webUrl": "https://...",
      "addedAt": "2026-01-27T10:00:00.000Z"
    }
  ]
}
```

### API Endpoints

#### Microsoft Graph Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/microsoft/status` | GET | Check OneDrive connection status + saved file |
| `/api/auth/microsoft/login` | GET | Get OAuth login URL |
| `/api/auth/microsoft/callback` | GET | OAuth callback (automatic) |
| `/api/auth/microsoft/logout` | POST | Disconnect from OneDrive |
| `/api/auth/microsoft/search` | GET | Search OneDrive for Excel files |
| `/api/auth/microsoft/list-personal` | GET | List all personal Excel files |
| `/api/auth/microsoft/list-shared` | GET | List all shared Excel files |
| `/api/auth/microsoft/resolve-share-link` | POST | Resolve sharing link to file info |
| `/api/auth/microsoft/worksheets` | GET | Get worksheets from a file |
| `/api/auth/microsoft/update-excel` | POST | Update worksheet via Graph API |
| `/api/auth/microsoft/create-excel` | POST | Create new file in OneDrive |
| `/api/auth/microsoft/create-worksheet` | POST | Create new worksheet in file |
| `/api/auth/microsoft/quick-update` | POST | Update using saved config |
| `/api/auth/microsoft/config` | GET | Get saved file configuration |

### Frontend Components

#### `ExcelConfigModal.jsx`
Modal component for Excel export configuration with tabbed interface.

**Tabs (OneDrive Mode):**
1. **Recent** - Shows last updated file for quick re-update
2. **My Files** - Browse your personal OneDrive Excel files
3. **Shared** - Browse files from multiple sources:
   - Files explicitly shared with you via OneDrive
   - Files in SharePoint sites you have access to
   - Files from other users' OneDrive you can access
   - Files added via sharing link
4. **Create New** - Create a new Excel file in your OneDrive

**Features:**
- Mode toggle: OneDrive vs Local File
- Search with source badges (OneDrive, Shared, SharePoint)
- Worksheet selection dropdown
- Pre-selected recently used file and worksheet
- Loading states and error handling
- Success confirmation with record count

**Location:** `frontend/src/components/features/ExcelConfigModal.jsx`

## Usage

### OneDrive Mode (Recommended)

#### First-Time Setup
1. Navigate to **Current Accounts** page
2. Click **Update Excel** button
3. Ensure **OneDrive** tab is selected
4. Click **Connect to OneDrive** button
5. Microsoft login page opens in new window
6. Log in with your Microsoft account
7. Grant permissions when prompted
8. Popup closes automatically

#### Quick Update (Recent File)
1. Click **Update Excel** button
2. **Recent** tab shows your last updated file
3. Verify the worksheet is correct
4. Click **Update Now**

#### Selecting from Files
1. Click **Update Excel** button
2. Select **My Files** or **Shared** tab
3. Browse or filter the list of Excel files
4. Click on the desired file from results
5. Select the worksheet to update (or create new)
6. Click **Update Selected**

#### Adding a File by Sharing Link
Some files shared via link don't appear in the "Shared" tab automatically. Use "Add by Link":

1. Click **Update Excel** button
2. Select **Shared** tab
3. Click **Add file by sharing link**
4. Paste the OneDrive/SharePoint sharing URL
5. Click **Add File**
6. The file appears in your Shared list and is auto-selected
7. Select the worksheet and click **Update Selected**

> **Note**: This is useful for files shared via "Copy Link" in OneDrive rather than explicit sharing through "Share with specific people".

#### Creating a New File
1. Click **Update Excel** button
2. Select **Create New** tab
3. Enter a file name
4. Enter a sheet name (default: "Current Accounts")
5. Click **Create File**
6. New file is created in your OneDrive root

### Local File Mode (Fallback)

#### When to Use
- OneDrive is not configured
- File is on a local or network drive
- Offline access needed

#### Important Limitation
⚠️ **All users must close the file** before updating in local mode

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Access denied" | Insufficient permissions | Check Sites.Selected grants or use Files.ReadWrite.All |
| "No authenticated user" | Token expired | Click Connect to OneDrive again |
| "File does not exist" | Invalid path (local mode) | Check file path spelling |
| "Cannot access file" | File locked (local mode) | Close file in Excel |

## Test Script

A test script is available to verify access to shared files:

```bash
node scripts/test-shared-file-access.js "https://company-my.sharepoint.com/:x:/r/personal/..."
```

This tests:
1. URL encoding and share token generation
2. Access to file metadata
3. Access to worksheets
4. Read/write capability

## Dependencies

- **@azure/msal-node** (`^2.6.0`) - Microsoft Authentication Library
- **@microsoft/microsoft-graph-client** (`^3.0.7`) - Graph API client
- **ExcelJS** (`exceljs` v4.4.0) - Backend Excel manipulation (local mode)

## Files Modified/Created

### New Files
- `services/microsoft-auth.service.js` - OAuth authentication service
- `services/microsoft-graph-excel.service.js` - Graph API Excel operations
- `routes/microsoft-auth.routes.js` - Microsoft auth API routes
- `services/excel.service.js` - Local Excel operations service
- `frontend/src/components/features/ExcelConfigModal.jsx` - Config modal
- `scripts/test-shared-file-access.js` - Test script for shared files
- `scripts/create-current-accounts-sheet.js` - Script to create worksheet
- `config/microsoft-token-cache.json` - OAuth token cache (auto-created)
- `config/onedrive-excel-config.json` - OneDrive file config (auto-created)

### Modified Files
- `package.json` - Added MSAL and Graph dependencies
- `app.js` - Registered Microsoft auth routes
- `routes/current-accounts.routes.js` - Added local Excel endpoints
- `frontend/src/pages/CurrentAccounts.jsx` - Replaced export button

## Comparison: Old vs New

| Feature | Old (CSV Export) | New (OneDrive Mode) | New (Local Mode) |
|---------|------------------|---------------------|------------------|
| Output Format | CSV download | .xlsx via Graph API | Direct .xlsx |
| Co-authoring | ❌ N/A | ✅ Works while open | ❌ File must be closed |
| Formatting | Plain text | Headers, colors, table | Headers, colors, table |
| Multiple Sheets | N/A | Preserves other sheets | Preserves other sheets |
| Persistence | Separate file each time | Updates same file | Updates same file |
| Authentication | None | Microsoft OAuth | None |
| Shared Files | N/A | ✅ With Sites.Selected | ❌ N/A |
