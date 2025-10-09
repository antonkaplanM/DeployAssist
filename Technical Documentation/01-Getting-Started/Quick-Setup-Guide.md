# Quick Setup Guide

## Environment Setup

### 1. Copy Environment Template
```bash
cp env.example.txt .env
```

### 2. Configure Atlassian Integration
```bash
# Edit .env file
ATLASSIAN_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-api-token-from-atlassian
ATLASSIAN_SITE_URL=https://yourcompany.atlassian.net
```

**How to get API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Copy the token value

### 3. Configure Salesforce Integration
```bash
# Edit .env file
SF_LOGIN_URL=https://yourorg--sandbox.sandbox.my.salesforce.com
SF_CLIENT_ID=your-connected-app-client-id
SF_CLIENT_SECRET=your-connected-app-client-secret
SF_REDIRECT_URI=http://localhost:8080/auth/salesforce/callback
SF_TOKEN_FILE=.salesforce_auth.json
```

**Salesforce Connected App Setup:**
1. Setup → App Manager → New Connected App
2. **OAuth Settings:**
   - Enable OAuth Settings: ✓
   - Callback URL: `http://localhost:8080/auth/salesforce/callback`
   - OAuth Scopes: "Access the Identity URL service" + "Perform requests at any time"
3. **Client Credentials Flow:**
   - Edit → Client Credentials Flow: Enable Client Credentials Flow ✓
   - Note: Only check "Enable Client Credentials Flow", not Authorization Code

### 4. SSL Configuration (Corporate Networks)
```bash
# Add to .env file
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Testing

### Start Application
```bash
npm start
```

### Test Integrations
1. **Browser**: Open http://localhost:8080
2. **Settings Page**: Click Settings → Test Salesforce
3. **Check Logs**: Monitor terminal for authentication success

### Verification Commands
```bash
# Test Salesforce
curl http://localhost:8080/api/test-salesforce

# Test Provisioning Data
curl http://localhost:8080/api/provisioning/requests

# Test Atlassian (via UI)
# Navigate to Roadmap page and search for an assignee
```

## Common Issues

### Atlassian
❌ **SSL Certificate Error**
```
✅ Solution: Add NODE_TLS_REJECT_UNAUTHORIZED=0 to .env
```

❌ **401 Unauthorized**
```
✅ Solution: Check API token and email address
```

### Salesforce
❌ **invalid_request OAuth Error**
```
✅ Solution: Ensure Connected App uses Client Credentials Flow only
```

❌ **Authentication Failed**
```
✅ Solution: Verify Client ID and Client Secret
```

## Architecture Overview

```
┌─────────────────┐    HTTPS/REST     ┌──────────────────┐
│   Frontend      │◄─────────────────►│   Backend        │
│   (Browser)     │                   │   (Node.js)      │
└─────────────────┘                   └──────────────────┘
                                               │
                               ┌───────────────┼───────────────┐
                               │               │               │
                          HTTPS/REST      HTTPS/OAuth2    HTTPS/REST
                               │               │               │
                               ▼               ▼               ▼
                    ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐
                    │   Atlassian     │ │ Salesforce  │ │  Other APIs │
                    │   (Jira Cloud)  │ │  (Sandbox)  │ │             │
                    └─────────────────┘ └─────────────┘ └─────────────┘
```

## File Structure
```
├── app.js                          # Main application & Atlassian integration
├── salesforce.js                   # Salesforce Client Credentials Flow
├── .env                           # Environment configuration
├── .salesforce_auth.json          # Auto-generated token storage
└── Technical Documentation/
    ├── Integration-Architecture.md # Complete technical docs
    └── Quick-Setup-Guide.md       # This file
```

*For detailed technical information, see [Integration-Architecture.md](./Integration-Architecture.md)*
