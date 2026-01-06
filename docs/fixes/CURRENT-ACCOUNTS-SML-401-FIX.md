# Fix: Current Accounts Page SML 401 Error

## Issue
When clicking "Sync Data" on the Current Accounts page, users received a 401 Unauthorized error from the SML integration, even though the SML token was valid and working correctly for other features (like SML Compare on the Provisioning Monitor page).

## Root Cause
The `SMLGhostAccountsService` was using **different HTTP headers** than the working `SMLService` used by SML Compare.

Specifically, the Ghost Accounts service was including `Origin` and `Referer` headers in its Playwright requests:

```javascript
// INCORRECT - These headers were causing 401 errors
extraHTTPHeaders: {
    'Authorization': `Bearer ${config.authCookie}`,
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': origin,           // <-- CAUSES 401
    'Referer': `${origin}/`,    // <-- CAUSES 401
    'User-Agent': '...'
}
```

The SML API rejects requests that include these Origin/Referer headers. The working SML Compare feature uses minimal headers without Origin/Referer.

## Fix Applied

### Modified Header Configuration (`services/sml-ghost-accounts.service.js`)

Updated both `_fetchAllTenantsWithPlaywright()` and `_fetchTenantProductsWithPlaywright()` to use the same minimal headers as the working SML Compare feature:

```javascript
// CORRECT - Matches working SML Compare implementation
const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
        'Authorization': `Bearer ${config.authCookie}`,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});
```

Key changes:
- Removed `Origin` header
- Removed `Referer` header
- Removed `Accept-Language` header
- Now matches the working `sml.service.js` implementation exactly

### Additional Improvements

Also added:
- Token validation before API calls (prevents unnecessary requests if token is expired)
- Clearer error messages for 401/403 errors
- New `/api/current-accounts/sml-status` endpoint to check token status
- Enhanced error handling in the sync route

## Why Origin/Referer Headers Cause 401

The SML API appears to perform CORS validation on requests that include Origin headers. When the Origin header is:
- Missing: Request is allowed (server-to-server)
- Present with correct value: Request is allowed
- Present with incorrect value: Request is rejected with 401

The Ghost Accounts service was using `https://tenant-zero.rms.com` as the Origin, which may not be in the API's allowed origins list.

## Comparison of Working vs Failing Implementation

| Feature | SML Compare (Working) | Ghost Accounts (Was Failing) |
|---------|----------------------|------------------------------|
| Location | `sml.service.js` | `sml-ghost-accounts.service.js` |
| Origin Header | **Not included** | Was including (incorrect value) |
| Referer Header | **Not included** | Was including |
| Result | ✅ 200 OK | ❌ 401 Unauthorized |

## Testing

After applying the fix:
1. Navigate to **Current Accounts** page
2. Click **Sync Data** button
3. The sync should complete successfully without 401 errors

## Files Modified

1. `services/sml-ghost-accounts.service.js`
   - Fixed `_fetchAllTenantsWithPlaywright()` - removed Origin/Referer headers
   - Fixed `_fetchTenantProductsWithPlaywright()` - removed Origin/Referer headers
   - Added token validation methods (bonus improvement)
   - Added clearer error messages for 401/403 errors

2. `services/current-accounts.service.js`
   - Added `tokenExpired` flag propagation (bonus improvement)

3. `routes/current-accounts.routes.js`
   - Added `/api/current-accounts/sml-status` endpoint (bonus improvement)
   - Enhanced error handling for token-related errors

## Lesson Learned

When implementing new SML integrations, use the **same minimal header configuration** as the working SML Compare feature. Do not add Origin, Referer, or other browser-specific headers unless specifically required.

## Date
January 5, 2026

