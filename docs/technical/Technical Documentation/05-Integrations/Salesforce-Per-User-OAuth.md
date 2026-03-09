# Salesforce Per-User OAuth Integration

## Overview

The Salesforce integration supports two authentication modes:

1. **Per-User OAuth (default)** -- Each user connects their own Salesforce account. API calls are scoped to the user's Salesforce profile, permissions, and sharing rules.
2. **Service Account (permission-gated)** -- Users with the `salesforce.service_account` permission can opt to use the shared Client Credentials service account for broader access.

All users default to per-user credentials and must connect before using Salesforce-powered features.

## Architecture

```
User -> Settings > Data Sources > Salesforce -> "Connect to Salesforce"
     -> Redirects to Salesforce login page
     -> User logs in with their SF credentials
     -> Salesforce redirects back with authorization code
     -> App exchanges code for access_token + refresh_token
     -> Tokens are encrypted and stored in user_settings table
     -> All subsequent SF API calls use the user's tokens
```

### Connection Resolution Flow

When a Salesforce API request is made:

1. The `withSalesforceConnection` middleware checks the user's `sf_preference` setting
2. If preference is `service_account`, it verifies the `salesforce.service_account` permission
3. The resolved connection is bound into an `AsyncLocalStorage` context
4. All downstream `salesforce.js` functions automatically use the correct connection

### Token Storage

Per-user tokens are stored in the `user_settings` PostgreSQL table:

| Setting Key | Encrypted | Description |
|---|---|---|
| `sf_access_token` | Yes | OAuth access token |
| `sf_refresh_token` | Yes | OAuth refresh token |
| `sf_instance_url` | Yes | Salesforce instance URL |
| `sf_user_id` | No | Salesforce username (display) |
| `sf_connected_at` | No | Connection timestamp |
| `sf_preference` | No | `personal` or `service_account` |

Tokens are encrypted using AES-256-GCM via the application's `JWT_SECRET`, matching the pattern used for LLM API keys.

## Salesforce External Client App Configuration

Salesforce has replaced Connected Apps with **External Client Apps** (ECAs). A single ECA supports both the service account (Client Credentials) and per-user (Authorization Code) flows.

### Required Settings

#### Step 1: Create/Edit the External Client App (Developer Settings)

Navigate to **Setup > External Client App Manager**, then click **Edit Settings** on your app:

| Setting | Value |
|---|---|
| **Flow Enablement** | Enable Authorization Code and Credentials Flow |
| **Callback URL** | Value of `SF_REDIRECT_URI` in `.env` (e.g., `http://localhost:5000/auth/salesforce/callback`) |
| **OAuth Scopes** | `Manage user data via APIs (api)`, `Perform requests at any time (refresh_token, offline_access)`, `Access the identity URL service (id)` |
| **Require Secret for Web Server Flow** | Checked |
| **Require PKCE** | Unchecked (unless PKCE support is added to the app) |
| **Enable Client Credentials Flow** | Checked (for service account) |
| **Run As** | The designated service account user (for Client Credentials flow) |

To retrieve the Consumer Key and Secret: expand **OAuth Settings**, click **Consumer Key and Secret**, and verify your identity.

#### Step 2: Configure Policies (Admin Settings)

From the External Client App Manager, click **Edit Policies** on your app:

| Setting | Value |
|---|---|
| **Permitted Users** | All users may self-authorize |
| **IP Relaxation** | Relax IP restrictions (for development) or configure appropriately |
| **Refresh Token Policy** | Refresh token is valid until revoked |

> **Note:** External Client Apps use a "closed by default" security model. The app must be explicitly allowed via policies before users can authorize.

> **Troubleshooting:** If you get `invalid_client_id` when clicking "Connect to Salesforce", ensure the Authorization Code flow is enabled and that policies have been configured. Changes may take up to 10-15 minutes to propagate in Salesforce.

The `SF_CLIENT_ID` and `SF_CLIENT_SECRET` environment variables are shared by all users (they identify the External Client App, not individual users).

### jsforce Compatibility

This application uses jsforce v3, which requires OAuth2 parameters (`clientId`, `clientSecret`, `redirectUri`) to be passed via an explicit `jsforce.OAuth2` instance rather than top-level `Connection` options. The shared `createOAuth2()` factory in `salesforce.js` handles this.

## Permission Model

| Permission | Resource | Action | Description |
|---|---|---|---|
| `salesforce.access` | salesforce | access | Allows access to Salesforce features |
| `salesforce.service_account` | salesforce | service_account | Allows using the shared service account |

- The `admin` role gets `salesforce.service_account` by default.
- The standard `user` role does **not** get this permission.
- Admins can assign it to any custom role via the User Management page by editing the role and toggling it under **Resource Permissions**.

## API Endpoints

### Per-User Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/salesforce` | Initiate OAuth flow (requires app login) |
| `GET` | `/auth/salesforce/callback` | OAuth callback (stores per-user tokens) |
| `GET` | `/api/user-settings/salesforce` | Get connection status |
| `PUT` | `/api/user-settings/salesforce/preference` | Set preference (personal/service_account) |
| `DELETE` | `/api/user-settings/salesforce` | Disconnect personal credentials |
| `POST` | `/api/user-settings/salesforce/test` | Test active connection |

### Response: GET /api/user-settings/salesforce

```json
{
  "success": true,
  "connected": true,
  "sfUsername": "john.doe@company.com",
  "connectedAt": "2026-03-02T10:30:00.000Z",
  "preference": "personal",
  "serviceAccountPermitted": false
}
```

## Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `SF_NOT_CONNECTED` | 403 | User has no personal Salesforce tokens stored |
| `SF_SERVICE_ACCOUNT_FORBIDDEN` | 403 | User selected service account but lacks permission |
| `SF_TEST_FAILED` | 200 | Connection test failed (token expired, revoked, etc.) |

## Migration Notes

When upgrading from the previous single-service-account model:

1. The `salesforce.service_account` permission is automatically seeded and assigned to the `admin` role on server startup (no manual migration required).
2. The service account (Client Credentials) continues to work for users with the `salesforce.service_account` permission.
3. All other users must connect their personal Salesforce accounts via Settings > Data Sources > Salesforce.
4. The `.salesforce_auth.json` file is retained for service account token caching only.
5. Admins can assign the permission to additional roles via **User Management > Edit Role > Resource Permissions**.

## Frontend: Settings Page

The Salesforce configuration lives under **Settings > Data Sources > Salesforce**:

- **Connection status card** -- Shows connected username or "Not Connected" with Connect button
- **Test/Disconnect buttons** -- Verify the connection or remove stored credentials
- **Connection Mode toggle** (only visible with `salesforce.service_account` permission) -- Choose between "My Credentials" and "Service Account"
