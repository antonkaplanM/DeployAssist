# Integration Architecture Documentation

## Overview

This document provides technical details for the Atlassian and Salesforce integrations in the DeployAssist application.

---

## Table of Contents

1. [Atlassian Integration](#atlassian-integration)
2. [Salesforce Integration](#salesforce-integration)
3. [Security Considerations](#security-considerations)
4. [Troubleshooting](#troubleshooting)
5. [Environment Configuration](#environment-configuration)

---

## Atlassian Integration

### Architecture Type
**Direct REST API Integration** - Server-to-server communication with Jira Cloud

### Authentication Method
- **Basic Authentication** using API tokens
- No OAuth flow required
- Stateless authentication per request

### Configuration
```bash
# Required Environment Variables
ATLASSIAN_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-api-token
ATLASSIAN_SITE_URL=https://yoursite.atlassian.net
```

### Implementation Details

#### File: `app.js`
- **Endpoint**: `/api/jira/initiatives`
- **Method**: POST
- **Function**: `makeHttpsRequest()` for SSL-aware HTTPS calls

#### SSL Certificate Handling
The integration includes SSL certificate bypass for corporate environments:
```javascript
const requestOptions = {
    // ... other options
    rejectUnauthorized: false  // Handles self-signed certificates
};
```

#### JQL Query Structure
```javascript
const jql = `assignee in ("${assigneeName}") AND (issuetype = "Initiative" OR issuetype = "Epic" OR issuetype = "Story" OR issuetype = "Task")`;
```

#### API Endpoint
```
POST https://{site}.atlassian.net/rest/api/3/search/jql
Body: { "jql": "{query}", "maxResults": 100 }
```

### Features
- Fetches initiatives, epics, stories, and tasks
- Supports assignee-based filtering
- Returns up to 100 issues per request
- Fallback data mechanism for offline scenarios
- Real-time status logging

### Error Handling
- SSL certificate validation bypass
- Automatic fallback to mock data
- Detailed error logging
- Request timeout handling (30 seconds)

---

## Salesforce Integration

### Architecture Type
**OAuth 2.0 Client Credentials Flow** - Server-to-server authentication

### Authentication Method
- **Client Credentials Flow** (RFC 6749 Section 4.4)
- No user interaction required
- Automatic token refresh and management

### Configuration
```bash
# Required Environment Variables
SF_LOGIN_URL=https://riskms--rmsqa.sandbox.my.salesforce.com
SF_CLIENT_ID=your-connected-app-client-id
SF_CLIENT_SECRET=your-connected-app-client-secret
SF_REDIRECT_URI=http://localhost:8080/auth/salesforce/callback
SF_TOKEN_FILE=.salesforce_auth.json
```

### Connected App Configuration
The Salesforce Connected App must be configured as:
- **App Type**: External client app
- **Flow Enablement**: "Enable Client Credentials Flow" checked
- **OAuth Scopes**: API access, refresh token

### Implementation Details

#### File: `salesforce.js`
- **Primary Function**: `getConnection()`
- **Authentication**: Client Credentials Flow implementation
- **Token Storage**: Local JSON file (`.salesforce_auth.json`)

#### Authentication Flow
```javascript
// Client Credentials request
const postData = querystring.stringify({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET
});

// Direct HTTPS request to Salesforce OAuth endpoint
const authResult = await makeOAuthRequest('/services/oauth2/token', postData);
```

#### Token Management
```javascript
// Stored token structure
{
    "accessToken": "access_token_value",
    "instanceUrl": "https://instance.salesforce.com",
    "tokenType": "Bearer",
    "scope": "api",
    "authenticatedAt": "2024-09-24T..."
}
```

### API Endpoints

#### Professional Services Requests
```javascript
// Endpoint: /api/provisioning/requests
// SOQL Query:
SELECT Id, Name, Account__c, Status__c, Deployment__c,
       Account_Site__c, Billing_Status__c, RecordTypeId,
       TenantRequestAction__c, Payload_Data__c,
       Requested_Install_Date__c, RequestedGoLiveDate__c,
       CreatedDate, LastModifiedDate
FROM Prof_Services_Request__c 
WHERE Name LIKE 'PS-%'
ORDER BY CreatedDate DESC
```

#### Filter Options
```javascript
// Endpoint: /api/provisioning/filter-options
// Returns: Request types, statuses, deployments
```

### Features
- Automatic authentication and token refresh
- Professional Services Request querying
- Pagination support (25 records per page)
- Filter options for UI components
- Account and provisioning data search

### Error Handling
- Token expiration detection and renewal
- SSL certificate validation bypass
- Detailed error logging with context
- Graceful degradation for authentication failures

---

## Security Considerations

### SSL/TLS Configuration
Both integrations handle corporate SSL certificate issues:
```javascript
// Environment variable control
NODE_TLS_REJECT_UNAUTHORIZED=0

// Code implementation
rejectUnauthorized: false
```

### Credential Management
- Environment variables for sensitive data
- No hardcoded credentials in source code
- Token file excluded from version control
- API tokens with minimal required permissions

### Network Security
- HTTPS-only communication
- Request timeout limitations
- Input validation and sanitization

---

## Troubleshooting

### Atlassian Integration Issues

#### SSL Certificate Errors
```
Error: self-signed certificate in certificate chain
```
**Solution**: Environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0` is set

#### Authentication Failures
```
Error: 401 Unauthorized
```
**Solution**: Verify API token and email in environment variables

#### JQL Query Issues
```
Error: 400 Bad Request
```
**Solution**: Check assignee name format and JQL syntax

### Salesforce Integration Issues

#### OAuth Flow Mismatch
```
Error: invalid_request
```
**Solution**: Ensure Connected App uses Client Credentials Flow

#### Token Refresh Failures
```
Error: authentication failed
```
**Solution**: Check client ID/secret and Connected App configuration

#### SOQL Query Errors
```
Error: INVALID_FIELD
```
**Solution**: Verify field names against Salesforce schema

---

## Environment Configuration

### Production Setup
```bash
# Atlassian
ATLASSIAN_EMAIL=production-email@company.com
ATLASSIAN_API_TOKEN=prod-api-token
ATLASSIAN_SITE_URL=https://company.atlassian.net

# Salesforce
SF_LOGIN_URL=https://company.my.salesforce.com
SF_CLIENT_ID=production-client-id
SF_CLIENT_SECRET=production-client-secret
SF_TOKEN_FILE=.salesforce_auth.json

# SSL Configuration
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Development Setup
```bash
# Atlassian
ATLASSIAN_EMAIL=dev-email@company.com
ATLASSIAN_API_TOKEN=dev-api-token
ATLASSIAN_SITE_URL=https://company-dev.atlassian.net

# Salesforce
SF_LOGIN_URL=https://company--sandbox.sandbox.my.salesforce.com
SF_CLIENT_ID=sandbox-client-id
SF_CLIENT_SECRET=sandbox-client-secret
SF_TOKEN_FILE=.salesforce_auth.json

# SSL Configuration
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Diagnostic Tools
The application includes built-in diagnostic endpoints:

#### Atlassian Diagnostics
- Manual testing via application logs
- Real-time API call monitoring
- Fallback data verification

#### Salesforce Diagnostics
- **Endpoint**: `/api/test-salesforce`
- **Web UI**: Settings page → "Test Salesforce" button
- **Tests**: Environment variables, Client Credentials configuration, stored authentication, API connectivity

---

## Dependencies

### Node.js Packages
```json
{
    "jsforce": "^2.x.x",        // Salesforce API client
    "dotenv": "^16.x.x",        // Environment variable management
    "express": "^4.x.x",        // Web framework
    "https": "built-in",        // HTTPS requests
    "querystring": "built-in"   // URL encoding
}
```

### External Services
- **Jira Cloud REST API v3**
- **Salesforce REST API v59.0+**
- **OAuth 2.0 endpoints**

---

## Maintenance

### Regular Tasks
1. **API Token Rotation**: Update Atlassian API tokens as per security policy
2. **Certificate Monitoring**: Monitor SSL certificate changes in corporate environment
3. **Connected App Review**: Verify Salesforce Connected App permissions
4. **Log Monitoring**: Review application logs for authentication issues

### Version Updates
- Monitor jsforce library updates for Salesforce API changes
- Test SSL configuration changes with new Node.js versions
- Validate JQL queries with new Jira Cloud features

---

## Performance Metrics

### Atlassian Integration
- **Request Timeout**: 30 seconds
- **Max Results**: 100 issues per request
- **Response Time**: ~2-5 seconds (depending on query complexity)

### Salesforce Integration
- **Token Lifetime**: Configurable in Connected App (typically 2 hours)
- **Query Limit**: 25 records per page (configurable)
- **Response Time**: ~1-3 seconds for standard queries
- **Rate Limits**: Governed by Salesforce API limits per org

---

*Last Updated: September 24, 2025*
*Version: 1.0*
