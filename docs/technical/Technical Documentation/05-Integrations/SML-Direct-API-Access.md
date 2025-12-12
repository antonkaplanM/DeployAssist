# SML Direct API Access - Authentication Guide

## Overview

This document describes the authentication flow for direct API access to the SML (Service Management Layer) entitlements endpoints.

## Authentication Architecture

```
Browser → AWS Cognito → Okta SSO → Cognito Token → RMS Auth Service → RMS JWT
```

### Components

| Component | URL | Purpose |
|-----------|-----|---------|
| **AWS Cognito** | `rms-tenant-zero-eu.auth.eu-west-1.amazoncognito.com` | OAuth2 authorization server |
| **Okta SSO** | `rms.okta.com` | Identity provider for SSO |
| **RMS API** | `api-euw1.rms.com` | SML entitlements API |

## Authentication Flow

1. **User initiates login** via Cognito authorization URL
2. **Cognito redirects** to Okta for SSO authentication
3. **User authenticates** with Okta (corporate SSO)
4. **Okta returns** authorization code to Cognito
5. **Cognito issues** tokens (access, ID, refresh)
6. **RMS exchanges** Cognito token for RMS-specific JWT
7. **RMS JWT** is used for API calls

## RMS JWT Token Structure

The RMS JWT is issued by `RMS` (not Okta/Cognito directly) with the following structure:

```json
{
  "username": "SSO_Anton.Kaplan@rms.com",
  "tenant_id": "6000200",
  "token_use": "access",
  "roles": ["Admin Portal User", "Fulfillment Reviewer"],
  "apps": "RMS-TENANT-ADMIN",
  "groups": "AdminPortalUsersPE",
  "iss": "RMS",
  "exp": 1765491951
}
```

## API Endpoints

### Base URL
- **EUW1 (Europe)**: `https://api-euw1.rms.com`
- **USE1 (US East)**: `https://api-use1.rms.com`

### Entitlements Endpoints

All entitlement endpoints require the `/sml/entitlements/v1/` prefix:

| Endpoint | Description |
|----------|-------------|
| `GET /sml/entitlements/v1/skus/data` | List all data SKUs |
| `GET /sml/entitlements/v1/tenants/{tenantId}/apps/current` | Get apps for tenant |
| `GET /sml/entitlements/v1/tenants/{tenantId}/models/current` | Get models for tenant |
| `GET /sml/entitlements/v1/tenants/{tenantId}/data/current` | Get data for tenant |

### Tenant Provisioning Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /sml/tenant-provisioning/v1/tenants/` | List all tenants |
| `GET /sml/tenant-provisioning/v1/tenants/{tenantId}` | Get tenant details |

## Authentication Header

All API requests require the Bearer token:

```
Authorization: Bearer <RMS_JWT_TOKEN>
```

## Token Management

### Current Approach
- Token is obtained via browser SSO flow
- Token is stored in `.sml_config.json` as `authCookie`
- Token expires after ~1 hour (3600 seconds)
- **Automatic token validation** before each API request
- **Playwright-based automatic refresh** when token expires

### Automatic Token Refresh with Playwright

The system now includes a Playwright-based token refresh script that:
1. Opens a browser window
2. Navigates to the SML login page
3. Handles Okta SSO authentication
4. Captures the RMS JWT token from network requests
5. Saves it to `.sml_config.json`

#### NPM Scripts

```bash
# Refresh token (default environment: euw1)
npm run sml:refresh

# Refresh token for specific environment
npm run sml:refresh:euw1
npm run sml:refresh:use1

# Check token status
npm run sml:check
```

#### Programmatic Usage

```typescript
import { refreshToken, checkAndRefresh, isTokenExpired } from './scripts/sml-token-refresh';

// Check and refresh if needed
const valid = await checkAndRefresh('euw1');

// Force refresh
const token = await refreshToken('euw1');
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sml/token/status` | GET | Get current token status |
| `/api/sml/token/refresh` | POST | Trigger token refresh |

#### UI Integration

The Settings page includes an SML Configuration section with:
- **Token Status Card**: Shows whether the token is valid, expired, or missing
- **Remaining Time**: Displays how much time is left before expiration
- **Refresh Token Button**: Triggers Playwright-based SSO authentication

Navigate to: **Settings → SML Configuration**

### Manual Token Refresh
Alternatively, tokens can be manually refreshed by:
  1. Logging into SML portal in browser
  2. Extracting Bearer token from Network tab
  3. Updating `.sml_config.json`

### Cognito Configuration

```json
{
  "domain": "rms-tenant-zero-eu.auth.eu-west-1.amazoncognito.com",
  "clientId": "1f5t5qmd1agtb4ttvsm4e0vjb8",
  "redirectUri": "https://tenant-zero-eu.rms.com/home/login",
  "identityProvider": "SSO"
}
```

## Tested Endpoints (Verified Working)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/sml/entitlements/v1/skus/data` | ✅ | 125 items returned |
| `/sml/tenant-provisioning/v1/tenants/` | ✅ | Found Chubb (ID: 6000251) |
| `/sml/entitlements/v1/tenants/6000251/apps/current` | ✅ | Works |
| `/sml/entitlements/v1/tenants/6000251/models/current` | ✅ | Works |
| `/sml/entitlements/v1/tenants/6000251/data/current` | ✅ | Works |

## Common Issues

### 401 Unauthorized
- Token has expired
- Token is malformed
- Solution: Get fresh token from browser

### 403 Forbidden
- Incorrect endpoint path (use `/sml/entitlements/v1/` prefix)
- Insufficient permissions for the tenant
- Solution: Check endpoint path, verify tenant access

### Invalid Grant (Cognito)
- Authorization code has been used or expired
- Codes expire in ~60 seconds
- Solution: Get fresh code and use immediately

## Future Improvements

1. **Automated Token Refresh**: Implement OAuth2 refresh token flow
2. **Service Account**: Request service account credentials for automation
3. **API Key**: Request long-lived API key for non-interactive access

## Related Files

- `src/repositories/SMLRepository.ts` - API client implementation with token validation
- `src/services/SMLService.ts` - Business logic layer with token status methods
- `src/utils/sml-auth.ts` - Token utilities (validation, expiration check)
- `src/routes/sml.routes.ts` - API routes including token status/refresh
- `scripts/sml-token-refresh.ts` - **Playwright-based token refresh script**
- `.sml_config.json` - Token storage
- `.sml_auth_state.json` - Saved SSO session for faster re-authentication
- `scripts/test-cognito-auth.js` - Authentication testing script

## Date Tested
December 11, 2025
