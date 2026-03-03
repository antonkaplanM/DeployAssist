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

## Salesforce Connected App Configuration

A single Connected App supports both the service account (Client Credentials) and per-user (Authorization Code) flows. Both "Enable OAuth Settings" **and** "Enable Client Credentials Flow" must be enabled.

### Required Settings (Setup > App Manager > Edit)

| Setting | Value |
|---|---|
| **Enable OAuth Settings** | Checked |
| **Callback URL** | Value of `SF_REDIRECT_URI` in `.env` (e.g., `http://localhost:5000/auth/salesforce/callback`) |
| **Selected OAuth Scopes** | `Access the identity URL service (id)`, `Perform requests at any time (refresh_token, offline_access)`, `Manage user data via APIs (api)` |
| **Permitted Users** | All users may self-authorize |
| **Refresh Token Policy** | Refresh token is valid until revoked |
| **Enable Client Credentials Flow** | Checked (for service account) |
| **Run As** | The designated service account user (for Client Credentials flow) |

> **Troubleshooting:** If you get `invalid_client_id` when clicking "Connect to Salesforce", the Connected App likely only has "Enable Client Credentials Flow" enabled without "Enable OAuth Settings". Both must be active. Changes may take up to 10 minutes to propagate in Salesforce.

The `SF_CLIENT_ID` and `SF_CLIENT_SECRET` environment variables are shared by all users (they identify the Connected App, not individual users).

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
