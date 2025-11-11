# Troubleshooting Checklist

## Before You Start
- [ ] Check application logs in terminal
- [ ] Verify environment variables are loaded
- [ ] Confirm network connectivity

## Atlassian Integration Issues

### 🔴 SSL Certificate Errors
**Symptoms:** `self-signed certificate in certificate chain`
```
⚠️ API request failed: Request failed: self-signed certificate in certificate chain
```

**Checklist:**
- [ ] Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to `.env` file
- [ ] Restart the application after adding the environment variable
- [ ] Check corporate firewall/proxy settings
- [ ] Verify SSL bypass is applied in `makeHttpsRequest()` function

### 🔴 Authentication Failures
**Symptoms:** `401 Unauthorized` or `403 Forbidden`
```
❌ Atlassian API call failed with status: 401
```

**Checklist:**
- [ ] Verify `ATLASSIAN_EMAIL` matches your Atlassian account
- [ ] Check `ATLASSIAN_API_TOKEN` is correct and not expired
- [ ] Ensure API token has appropriate permissions
- [ ] Test API token manually: `curl -u email:token https://site.atlassian.net/rest/api/3/myself`

### 🔴 JQL Query Issues
**Symptoms:** `400 Bad Request` or no results returned
```
⚠️ Atlassian API call failed or returned no data, using fallback data
```

**Checklist:**
- [ ] Verify assignee name exists in Jira
- [ ] Check assignee name spelling and case sensitivity
- [ ] Test JQL in Jira web interface: `assignee = "Name"`
- [ ] Ensure user has permission to view the issues

---

## Salesforce Integration Issues

### 🔴 OAuth Flow Mismatch
**Symptoms:** `invalid_request` OAuth error
```
❌ Salesforce OAuth error: invalid_request
```

**Checklist:**
- [ ] Connected App has **only** "Enable Client Credentials Flow" checked
- [ ] Authorization Code Flow is **disabled** in Connected App
- [ ] Client ID and Client Secret match Connected App values
- [ ] Connected App is deployed and active

### 🔴 Connected App Configuration
**Symptoms:** Authentication fails or scope errors

**Connected App Requirements:**
- [ ] **App Type**: External client app
- [ ] **OAuth Settings**: Enabled
- [ ] **Client Credentials Flow**: ✅ Enabled
- [ ] **Authorization Code Flow**: ❌ Disabled
- [ ] **Refresh Token Flow**: ❌ Disabled
- [ ] **OAuth Scopes**: "Perform requests at any time (refresh_token, offline_access)" + "Access the Identity URL service (id, profile, email, address, phone)"

### 🔴 Environment Variable Issues
**Symptoms:** Missing configuration errors

**Required Variables:**
- [ ] `SF_LOGIN_URL` - Correct Salesforce instance URL
- [ ] `SF_CLIENT_ID` - Connected App Consumer Key
- [ ] `SF_CLIENT_SECRET` - Connected App Consumer Secret  
- [ ] `SF_REDIRECT_URI` - Callback URL (not used in Client Credentials but required)
- [ ] `SF_TOKEN_FILE` - Token storage file path

### 🔴 SOQL Query Errors
**Symptoms:** `INVALID_FIELD` or query syntax errors
```
❌ SOQL query failed: INVALID_FIELD: Prof_Services_Request__c.FieldName__c
```

**Checklist:**
- [ ] Verify custom object `Prof_Services_Request__c` exists
- [ ] Check field names match Salesforce schema
- [ ] Ensure user has read permissions on object and fields
- [ ] Test SOQL in Salesforce Developer Console

---

## Application-Level Issues

### 🔴 Port Already in Use
**Symptoms:** `EADDRINUSE` error on startup
```
Error: listen EADDRINUSE: address already in use :::8080
```

**Solution:**
```bash
# Find and kill process using port 8080
Get-Process -Name node | Stop-Process -Force
# Or use different port
PORT=3000 npm start
```

### 🔴 Environment Variables Not Loaded
**Symptoms:** `undefined` values in configuration

**Checklist:**
- [ ] `.env` file exists in project root
- [ ] No spaces around `=` in `.env` file
- [ ] No quotes around values unless needed
- [ ] Restart application after `.env` changes
- [ ] Check `require('dotenv').config()` is called first

### 🔴 Module Import Errors
**Symptoms:** `Cannot find module` errors

**Solution:**
```bash
# Reinstall dependencies
npm install

# Clear cache if needed
npm cache clean --force
npm install
```

---

## Diagnostic Tools

### Built-in Diagnostics
1. **Salesforce Test**: 
   - Navigate to Settings page
   - Click "Test Salesforce" button
   - Review detailed test results

2. **Application Logs**:
   - Monitor terminal output for real-time status
   - Look for authentication success/failure messages

### Manual Testing Commands

**Test Salesforce API Endpoint:**
```bash
curl http://localhost:8080/api/test-salesforce
```

**Test Provisioning Data:**
```bash
curl http://localhost:8080/api/provisioning/requests
```

**Check Environment Variables:**
```bash
node -e "require('dotenv').config(); console.log('SF_CLIENT_ID:', process.env.SF_CLIENT_ID ? 'Set' : 'Missing');"
```

### External Validation

**Atlassian API Token Test:**
```bash
curl -u "your-email@company.com:your-api-token" \
     https://yoursite.atlassian.net/rest/api/3/myself
```

**Salesforce Connected App Test:**
```bash
curl -X POST \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET" \
     https://yourorg.my.salesforce.com/services/oauth2/token
```

---

## Performance Issues

### 🔴 Slow API Responses
**Symptoms:** Long load times, timeouts

**Checklist:**
- [ ] Check network latency to Salesforce/Atlassian
- [ ] Review SOQL query complexity (add indexes if needed)
- [ ] Monitor API rate limits
- [ ] Consider pagination for large datasets

### 🔴 Memory Issues
**Symptoms:** Application crashes, high memory usage

**Solutions:**
- [ ] Implement connection pooling
- [ ] Add request size limits
- [ ] Monitor for memory leaks in long-running processes

---

## Recovery Procedures

### Reset Salesforce Authentication
```bash
# Remove stored token file
rm .salesforce_auth.json

# Restart application to force re-authentication
npm start
```

### Reset Application State
```bash
# Stop application
Ctrl+C

# Clear any cached tokens
rm .salesforce_auth.json

# Restart with clean state
npm start
```

### Emergency Fallback
If both integrations fail:
- [ ] Application continues to function with fallback data
- [ ] UI shows "using fallback data" messages
- [ ] Users can still access basic functionality

---

## Contact Information

**For Technical Issues:**
- Check application logs first
- Use built-in diagnostic tools
- Review this troubleshooting guide

**For Configuration Issues:**
- Verify environment setup
- Check Connected App configuration
- Validate API credentials

*Last Updated: September 24, 2025*
