const jsforce = require('jsforce');
const fs = require('fs').promises;
const path = require('path');

// Configure SSL settings for corporate environments (same as app.js)
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
    console.log('⚠️  SSL certificate validation disabled for Salesforce (corporate environment)');
}

// Configuration from environment variables
const SALESFORCE_LOGIN_URL = process.env.SF_LOGIN_URL;
const SALESFORCE_CLIENT_ID = process.env.SF_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
const SALESFORCE_REDIRECT_URI = process.env.SF_REDIRECT_URI;
const SALESFORCE_TOKEN_FILE = process.env.SF_TOKEN_FILE || '.salesforce_auth.json';

let connectionInstance = null;

// Check if all required Salesforce environment variables are set
function checkSalesforceEnvVars() {
    const required = [
        'SF_LOGIN_URL',
        'SF_CLIENT_ID', 
        'SF_CLIENT_SECRET',
        'SF_REDIRECT_URI'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required Salesforce environment variables: ${missing.join(', ')}`);
    }
}

// Load auth token from disk
async function loadAuthFromDisk() {
    try {
        const tokenData = await fs.readFile(SALESFORCE_TOKEN_FILE, 'utf8');
        return JSON.parse(tokenData);
    } catch (err) {
        console.log('No existing auth token found or failed to read');
        return null;
    }
}

// Save auth token to disk
async function saveAuthToDisk(authInfo) {
    try {
        await fs.writeFile(SALESFORCE_TOKEN_FILE, JSON.stringify(authInfo, null, 2));
        console.log('✅ Auth token saved to disk');
    } catch (err) {
        console.error('❌ Failed to save auth token:', err.message);
    }
}

// Clear auth token from disk
async function clearAuthFromDisk() {
    try {
        await fs.unlink(SALESFORCE_TOKEN_FILE);
        console.log('✅ Auth token cleared from disk');
    } catch (err) {
        // File might not exist, which is fine
        console.log('Auth token file not found or already cleared');
    }
}

// Get or create a Salesforce connection using Client Credentials Flow
async function getConnection() {
    if (connectionInstance) {
        return connectionInstance;
    }

    // Check environment variables
    checkSalesforceEnvVars();

    // Create new connection for Client Credentials Flow
    const conn = new jsforce.Connection({
        loginUrl: SALESFORCE_LOGIN_URL
    });

    // Try to load existing access token
    const authInfo = await loadAuthFromDisk();
    if (authInfo && authInfo.accessToken) {
        try {
            // Set the existing access token
            conn.accessToken = authInfo.accessToken;
            conn.instanceUrl = authInfo.instanceUrl;
            
            // Test if the token is still valid
            await conn.identity();
            console.log('✅ Using existing Salesforce access token');
            connectionInstance = conn;
            return conn;
        } catch (err) {
            console.log('🔄 Existing access token invalid, getting new token...');
            await clearAuthFromDisk();
        }
    }

    try {
        // Use Client Credentials Flow (server-to-server authentication)
        console.log('🔐 Authenticating with Salesforce using Client Credentials Flow...');
        
        // Manual Client Credentials authentication since jsforce doesn't have direct support
        const https = require('https');
        const querystring = require('querystring');
        
        const postData = querystring.stringify({
            grant_type: 'client_credentials',
            client_id: SALESFORCE_CLIENT_ID,
            client_secret: SALESFORCE_CLIENT_SECRET
        });

        const authResult = await new Promise((resolve, reject) => {
            const url = new URL('/services/oauth2/token', SALESFORCE_LOGIN_URL);
            
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                },
                // Handle SSL issues like we did for Atlassian
                rejectUnauthorized: false
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (res.statusCode === 200) {
                            resolve(result);
                        } else {
                            reject(new Error(`OAuth error: ${result.error || 'Unknown error'} - ${result.error_description || data}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse OAuth response: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        // Set the connection properties
        conn.accessToken = authResult.access_token;
        conn.instanceUrl = authResult.instance_url;

        // Save the authentication data
        const auth = {
            accessToken: authResult.access_token,
            instanceUrl: authResult.instance_url,
            tokenType: authResult.token_type,
            scope: authResult.scope,
            authenticatedAt: new Date().toISOString()
        };

        await saveAuthToDisk(auth);
        console.log('✅ Successfully authenticated with Salesforce using Client Credentials');
        
        connectionInstance = conn;
        return conn;
        
    } catch (authError) {
        console.error('❌ Salesforce Client Credentials authentication failed:', authError.message);
        throw new Error(`Salesforce authentication failed: ${authError.message}`);
    }
}

// Get OAuth authorization URL
function getAuthUrl() {
    checkSalesforceEnvVars();
    
    const conn = new jsforce.Connection({
        loginUrl: SALESFORCE_LOGIN_URL,
        clientId: SALESFORCE_CLIENT_ID,
        clientSecret: SALESFORCE_CLIENT_SECRET,
        redirectUri: SALESFORCE_REDIRECT_URI
    });

    const authUrl = conn.oauth2.getAuthorizationUrl({
        scope: 'api refresh_token',
        state: 'salesforce-auth'
    });

    return authUrl;
}

// Handle OAuth callback
async function handleOAuthCallback(code) {
    checkSalesforceEnvVars();

    const conn = new jsforce.Connection({
        loginUrl: SALESFORCE_LOGIN_URL,
        clientId: SALESFORCE_CLIENT_ID,
        clientSecret: SALESFORCE_CLIENT_SECRET,
        redirectUri: SALESFORCE_REDIRECT_URI
    });

    try {
        const result = await conn.authorize(code);
        
        // Save auth info to disk
        const authInfo = {
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            instanceUrl: conn.instanceUrl,
            id: result.id,
            organizationId: result.organizationId,
            url: result.url
        };
        
        await saveAuthToDisk(authInfo);
        
        // Store the connection
        connectionInstance = conn;
        
        console.log('✅ Salesforce authentication successful');
        console.log('Organization ID:', result.organizationId);
        console.log('Instance URL:', conn.instanceUrl);
        
        return {
            success: true,
            userInfo: result,
            instanceUrl: conn.instanceUrl,
            organizationId: result.organizationId
        };
        
    } catch (err) {
        console.error('❌ Salesforce OAuth error:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

// Helper function to compute effective status based on SMLErrorMessage__c
function getEffectiveStatus(record) {
    // If SMLErrorMessage__c has a value, the effective status is "Provisioning Failed"
    if (record.SMLErrorMessage__c && record.SMLErrorMessage__c.trim() !== '') {
        return 'Provisioning Failed';
    }
    // Otherwise, use the actual Status__c field
    return record.Status__c;
}

// Helper function to filter records by effective status
function filterByEffectiveStatus(records, statusFilter) {
    if (!statusFilter) {
        return records; // No filter
    }
    
    return records.filter(record => {
        const effectiveStatus = getEffectiveStatus(record);
        return effectiveStatus === statusFilter;
    });
}

// Query Professional Services Requests with pagination and filtering
async function queryProfServicesRequests(filters = {}) {
    try {
        const conn = await getConnection();
        
        // Test if the object exists by describing it
        try {
            const desc = await conn.sobject('Prof_Services_Request__c').describe();
            console.log('✅ Prof_Services_Request__c object found with', desc.fields.length, 'fields');
        } catch (descError) {
            console.error('❌ Prof_Services_Request__c object not found or not accessible:', descError.message);
            return {
                success: false,
                error: `Prof_Services_Request__c object not found or not accessible: ${descError.message}`,
                records: []
            };
        }
        
        // Extract pagination parameters
        const pageSize = filters.pageSize || 25;
        const offset = filters.offset || 0;
        
        // For status filtering, we need to fetch more records and filter server-side
        // because SMLErrorMessage__c cannot be filtered in SOQL WHERE clause
        const shouldFetchMore = !!filters.status;
        const fetchPageSize = shouldFetchMore ? 1000 : pageSize; // Fetch more records when status filter is active
        const fetchOffset = shouldFetchMore ? 0 : offset; // Always start from 0 when we need to filter server-side
        
        // Build WHERE clause for filters
        let whereClause = `WHERE Name LIKE 'PS-%'`;
        
        // Add filters (but NOT status - we'll filter that server-side)
        if (filters.startDate) {
            whereClause += ` AND CreatedDate >= ${filters.startDate}`;
        }
        if (filters.endDate) {
            whereClause += ` AND CreatedDate <= ${filters.endDate}`;
        }
        if (filters.requestType) {
            whereClause += ` AND TenantRequestAction__c = '${filters.requestType.replace(/'/g, "\\'")}'`;
        }
        if (filters.search) {
            whereClause += ` AND (Name LIKE '%${filters.search.replace(/'/g, "\\'")}%' OR Account__c LIKE '%${filters.search.replace(/'/g, "\\'")}%')`;
        }
        
        // First, get total count (only when not filtering by status)
        let totalRecordsCount = 0;
        if (!shouldFetchMore) {
            const countSoql = `SELECT COUNT() FROM Prof_Services_Request__c ${whereClause}`;
            console.log('📊 Executing COUNT query:', countSoql);
            const countResult = await conn.query(countSoql);
            totalRecordsCount = countResult.totalSize;
            console.log(`✅ Total records matching filters: ${totalRecordsCount}`);
        }
        
        // Build main query
        let soql = `
            SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   SMLErrorMessage__c,
                   CreatedDate, LastModifiedDate, CreatedBy.Name
            FROM Prof_Services_Request__c 
            ${whereClause}
            ORDER BY CreatedDate DESC LIMIT ${fetchPageSize} OFFSET ${fetchOffset}
        `;
        
        console.log('📊 Executing SOQL for Prof Services Requests:', soql);
        const result = await conn.query(soql);
        console.log('✅ SOQL executed successfully, found records:', result.records.length);
        
        // Process the results to parse JSON payload
        let processedRecords = result.records.map(record => {
            const parsedPayload = parsePayloadData(record.Payload_Data__c);
            // Override tenantName with the Salesforce field value if available
            if (record.Tenant_Name__c) {
                parsedPayload.tenantName = record.Tenant_Name__c;
            }
            return {
                ...record,
                parsedPayload: parsedPayload
            };
        });
        
        // Apply status filter server-side
        if (filters.status) {
            processedRecords = filterByEffectiveStatus(processedRecords, filters.status);
            console.log(`🔍 Applied server-side status filter: ${filters.status}, remaining records: ${processedRecords.length}`);
        }
        
        // Calculate pagination for filtered results
        // Use the count query result when not filtering by status, otherwise use the filtered records length
        const totalCount = shouldFetchMore ? processedRecords.length : totalRecordsCount;
        const paginatedRecords = shouldFetchMore ? processedRecords.slice(offset, offset + pageSize) : processedRecords;
        const hasMore = (offset + pageSize) < totalCount;
        const currentPage = Math.floor(offset / pageSize) + 1;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        console.log(`✅ Found ${paginatedRecords.length} records (page ${currentPage} of ${totalPages}, ${offset + 1}-${offset + paginatedRecords.length} of ${totalCount})`);
        
        return {
            success: true,
            records: paginatedRecords,
            totalCount: totalCount,
            pageSize: pageSize,
            offset: offset,
            hasMore: hasMore,
            currentPage: currentPage,
            totalPages: totalPages
        };
        
    } catch (err) {
        console.error('❌ Error querying Professional Services Requests:', err.message);
        return {
            success: false,
            error: err.message,
            records: []
        };
    }
}

// Search for Technical Team Requests with type-ahead functionality
async function searchTechnicalTeamRequests(searchTerm, limit = 10) {
    try {
        const conn = await getConnection();
        
        if (!searchTerm || searchTerm.length < 2) {
            return {
                success: true,
                records: []
            };
        }
        
        const soql = `
            SELECT Id, Name, Account__c, Status__c, TenantRequestAction__c, CreatedDate
            FROM Prof_Services_Request__c 
            WHERE Name LIKE 'PS-%' 
            AND Name LIKE '%${searchTerm.replace(/'/g, "\\'")}%'
            ORDER BY CreatedDate DESC 
            LIMIT ${limit}
        `;
        
        console.log('🔍 Searching Technical Team Requests:', soql);
        const result = await conn.query(soql);
        
        return {
            success: true,
            records: result.records.map(record => ({
                id: record.Id,
                name: record.Name,
                account: record.Account__c,
                status: record.Status__c,
                requestType: record.TenantRequestAction__c,
                type: 'technical_request'
            }))
        };
        
    } catch (err) {
        console.error('❌ Error searching Technical Team Requests:', err.message);
        return {
            success: false,
            error: err.message,
            records: []
        };
    }
}

// Search for Accounts with type-ahead functionality
async function searchAccounts(searchTerm, limit = 10) {
    try {
        const conn = await getConnection();
        
        if (!searchTerm || searchTerm.length < 2) {
            return {
                success: true,
                records: []
            };
        }
        
        // First, let's check if we can query Account object directly
        let soql;
        try {
            // Try to query Account object first
            soql = `
                SELECT Id, Name, Type, Industry, CreatedDate
                FROM Account 
                WHERE Name LIKE '%${searchTerm.replace(/'/g, "\\'")}%'
                ORDER BY Name ASC 
                LIMIT ${limit}
            `;
            
            console.log('🔍 Searching Accounts:', soql);
            const result = await conn.query(soql);
            
            return {
                success: true,
                records: result.records.map(record => ({
                    id: record.Id,
                    name: record.Name,
                    type: record.Type,
                    industry: record.Industry,
                    type: 'account'
                }))
            };
            
        } catch (accountError) {
            console.log('❌ Cannot query Account object directly, trying via Prof_Services_Request__c');
            
            // Fallback: search account names from Prof_Services_Request__c and deduplicate
            soql = `
                SELECT Account__c, Id
                FROM Prof_Services_Request__c 
                WHERE Account__c LIKE '%${searchTerm.replace(/'/g, "\\'")}%'
                AND Account__c != null
                ORDER BY Account__c ASC 
                LIMIT ${limit * 5}
            `;
            
            console.log('🔍 Searching Accounts via Prof_Services_Request__c:', soql);
            const result = await conn.query(soql);
            
            // Deduplicate account names
            const uniqueAccounts = new Map();
            result.records.forEach(record => {
                if (!uniqueAccounts.has(record.Account__c)) {
                    uniqueAccounts.set(record.Account__c, {
                        id: record.Account__c,
                        name: record.Account__c,
                        type: 'account'
                    });
                }
            });
            
            // Return only up to the limit
            const accountsArray = Array.from(uniqueAccounts.values()).slice(0, limit);
            
            return {
                success: true,
                records: accountsArray
            };
        }
        
    } catch (err) {
        console.error('❌ Error searching Accounts:', err.message);
        return {
            success: false,
            error: err.message,
            records: []
        };
    }
}

// Combined search function for both Technical Team Requests and Accounts
async function searchProvisioningData(searchTerm, limit = 20) {
    try {
        if (!searchTerm || searchTerm.length < 2) {
            return {
                success: true,
                results: {
                    technicalRequests: [],
                    accounts: []
                }
            };
        }
        
        // Search both in parallel
        const [techResults, accountResults] = await Promise.all([
            searchTechnicalTeamRequests(searchTerm, Math.ceil(limit / 2)),
            searchAccounts(searchTerm, Math.ceil(limit / 2))
        ]);
        
        return {
            success: true,
            results: {
                technicalRequests: techResults.success ? techResults.records : [],
                accounts: accountResults.success ? accountResults.records : [],
                totalCount: (techResults.records?.length || 0) + (accountResults.records?.length || 0)
            }
        };
        
    } catch (err) {
        console.error('❌ Error in combined search:', err.message);
        return {
            success: false,
            error: err.message,
            results: {
                technicalRequests: [],
                accounts: []
            }
        };
    }
}

// Get a specific Professional Services Request by ID
async function getProfServicesRequestById(id) {
    try {
        const conn = await getConnection();
        
        const soql = `
            SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   CreatedDate, LastModifiedDate, CreatedBy.Name
            FROM Prof_Services_Request__c 
            WHERE Id = '${id}'
        `;
        
        const result = await conn.query(soql);
        
        if (result.records.length === 0) {
            return {
                success: false,
                error: 'Record not found'
            };
        }
        
        const record = result.records[0];
        const parsedPayload = parsePayloadData(record.Payload_Data__c);
        
        // Override tenantName with the Salesforce field value if available
        if (record.Tenant_Name__c) {
            parsedPayload.tenantName = record.Tenant_Name__c;
        }
        
        return {
            success: true,
            record: {
                ...record,
                parsedPayload: parsedPayload
            }
        };
        
    } catch (err) {
        console.error('❌ Error getting Professional Services Request by ID:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

// Parse JSON payload data from Payload_Data__c field
function parsePayloadData(jsonString) {
    if (!jsonString) {
        return {
            productEntitlements: [],
            dataEntitlements: [],
            appEntitlements: [],
            modelEntitlements: [],
            totalCount: 0,
            summary: 'No entitlements data',
            hasDetails: false
        };
    }
    
    try {
        const payload = JSON.parse(jsonString);
        
        // Extract entitlements from the nested structure
        // Based on PS-4330: properties.provisioningDetail.entitlements
        const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
        
        const modelEntitlements = entitlements.modelEntitlements || [];
        const dataEntitlements = entitlements.dataEntitlements || [];
        const appEntitlements = entitlements.appEntitlements || [];
        
        // Also check for top-level entitlements (fallback)
        const fallbackProductEntitlements = payload.productEntitlements || [];
        const fallbackDataEntitlements = payload.dataEntitlements || [];
        const fallbackAppEntitlements = payload.appEntitlements || [];
        
        // Combine all entitlements
        const allModelEntitlements = [...modelEntitlements, ...fallbackProductEntitlements];
        const allDataEntitlements = [...dataEntitlements, ...fallbackDataEntitlements];
        const allAppEntitlements = [...appEntitlements, ...fallbackAppEntitlements];
        
        const totalCount = allModelEntitlements.length + allDataEntitlements.length + allAppEntitlements.length;
        
        // Create a readable summary
        const summaryParts = [];
        if (allModelEntitlements.length > 0) {
            // Show product codes from model entitlements
            const productCodes = allModelEntitlements.map(e => e.productCode).filter(Boolean);
            if (productCodes.length > 0) {
                summaryParts.push(`Models: ${productCodes.join(', ')}`);
            } else {
                summaryParts.push(`${allModelEntitlements.length} Model${allModelEntitlements.length !== 1 ? 's' : ''}`);
            }
        }
        if (allDataEntitlements.length > 0) {
            summaryParts.push(`${allDataEntitlements.length} Data`);
        }
        if (allAppEntitlements.length > 0) {
            summaryParts.push(`${allAppEntitlements.length} App${allAppEntitlements.length !== 1 ? 's' : ''}`);
        }
        
        const summary = summaryParts.length > 0 
            ? summaryParts.join(', ')
            : 'No entitlements';
        
        // Extract tenant name from multiple possible locations
        // Check: 1) properties.provisioningDetail.tenantName (newer structure)
        //        2) properties.tenantName (older/alternative structure)
        //        3) preferredSubdomain1 (found in PS-4652)
        //        4) preferredSubdomain2 (alternative subdomain field)
        //        5) properties.preferredSubdomain1 (nested variant)
        //        6) tenantName at root level (fallback)
        const tenantName = payload.properties?.provisioningDetail?.tenantName 
            || payload.properties?.tenantName 
            || payload.preferredSubdomain1
            || payload.preferredSubdomain2
            || payload.properties?.preferredSubdomain1
            || payload.properties?.preferredSubdomain2
            || payload.tenantName 
            || null;
        
        // Extract region from multiple possible locations
        const region = payload.properties?.provisioningDetail?.region 
            || payload.properties?.region 
            || payload.region 
            || null;
        
        return {
            productEntitlements: allModelEntitlements, // Keep for backward compatibility
            modelEntitlements: allModelEntitlements,
            dataEntitlements: allDataEntitlements,
            appEntitlements: allAppEntitlements,
            totalCount,
            summary,
            hasDetails: totalCount > 0,
            rawPayload: payload,
            tenantName: tenantName,
            region: region
        };
        
    } catch (err) {
        console.warn('❌ Error parsing payload JSON:', err.message);
        return {
            productEntitlements: [],
            dataEntitlements: [],
            appEntitlements: [],
            modelEntitlements: [],
            totalCount: 0,
            summary: 'Invalid JSON data',
            hasDetails: false,
            error: err.message
        };
    }
}

// Get filter options for dropdowns
async function getProfServicesFilterOptions() {
    try {
        const conn = await getConnection();
        
        // Get unique request types
        const requestTypeQuery = `
            SELECT TenantRequestAction__c 
            FROM Prof_Services_Request__c 
            WHERE TenantRequestAction__c != null 
            GROUP BY TenantRequestAction__c 
            ORDER BY TenantRequestAction__c 
            LIMIT 50
        `;
        
        // Get unique statuses
        const statusQuery = `
            SELECT Status__c 
            FROM Prof_Services_Request__c 
            WHERE Status__c != null 
            GROUP BY Status__c 
            ORDER BY Status__c 
            LIMIT 50
        `;
        
        const [requestTypeResult, statusResult] = await Promise.all([
            conn.query(requestTypeQuery),
            conn.query(statusQuery)
        ]);
        
        // Add "Provisioning Failed" as a custom status option (for records with SMLErrorMessage__c)
        const statuses = statusResult.records.map(r => r.Status__c).filter(Boolean);
        statuses.push('Provisioning Failed');
        
        return {
            success: true,
            requestTypes: requestTypeResult.records.map(r => r.TenantRequestAction__c).filter(Boolean),
            statuses: statuses,
            accounts: [] // Will be populated by search as needed
        };
        
    } catch (err) {
        console.error('❌ Error getting filter options:', err.message);
        return {
            success: false,
            error: err.message,
            requestTypes: [],
            statuses: [],
            accounts: []
        };
    }
}

// Additional functions for testing and diagnostics
async function hasValidAuthentication() {
    try {
        const tokenFile = process.env.SF_TOKEN_FILE || '.salesforce_auth.json';
        const authData = await fs.readFile(tokenFile, 'utf8');
        const auth = JSON.parse(authData);
        
        // For Client Credentials Flow, we only need access token
        return !!(auth.accessToken);
    } catch (error) {
        console.log('No existing auth token found or failed to read');
        return false;
    }
}

async function getIdentity() {
    const conn = await getConnection();
    if (!conn) {
        throw new Error('No valid Salesforce connection available');
    }
    
    return await conn.identity();
}

async function testConnection() {
    const conn = await getConnection();
    if (!conn) {
        throw new Error('No valid Salesforce connection available');
    }
    
    // Test basic API connectivity
    const result = await conn.query("SELECT Id, Name FROM Organization LIMIT 1");
    return {
        recordCount: result.totalSize,
        organizationName: result.records[0]?.Name,
        connectionId: conn.accessToken ? conn.accessToken.substring(0, 10) + '...' : 'Unknown'
    };
}

// Get 1-year analytics data for Technical Team Requests by request type with validation failures
async function getWeeklyRequestTypeAnalytics(startDate, endDate, enabledRuleIds = null) {
    try {
        const conn = await getConnection();
        if (!conn) {
            throw new Error('No Salesforce connection available');
        }

        const validationEngine = require('./validation-engine');

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // First, get all possible request types
        const allTypesQuery = `
            SELECT TenantRequestAction__c 
            FROM Prof_Services_Request__c 
            WHERE TenantRequestAction__c != null 
            GROUP BY TenantRequestAction__c 
            ORDER BY TenantRequestAction__c
        `;

        // Then, get all records for the specific time period (need full records for validation)
        // Match the same query pattern as /api/validation/errors endpoint
        const analyticsQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c, 
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c 
            WHERE CreatedDate >= ${startDateStr}T00:00:00.000Z 
            AND CreatedDate <= ${endDateStr}T23:59:59.999Z
            AND Name LIKE 'PS-%'
            AND TenantRequestAction__c != null 
            ORDER BY TenantRequestAction__c, CreatedDate DESC
        `;

        console.log('📊 Fetching all request types:', allTypesQuery);
        const allTypesResult = await conn.query(allTypesQuery);
        
        console.log('📊 Fetching 1-year analytics data with validation:', analyticsQuery);
        const analyticsResult = await conn.query(analyticsQuery);

        // Get enabled validation rules - use provided ones or defaults
        let enabledRules;
        if (enabledRuleIds && enabledRuleIds.length > 0) {
            enabledRules = validationEngine.DEFAULT_VALIDATION_RULES.filter(rule => 
                enabledRuleIds.includes(rule.id)
            );
            console.log(`🔧 Using ${enabledRules.length} client-specified enabled validation rules: ${enabledRuleIds.join(', ')}`);
        } else {
            enabledRules = validationEngine.getEnabledValidationRules();
            console.log(`🔧 Using ${enabledRules.length} default enabled validation rules`);
        }

        // Process records by request type and validate them (same as validation errors endpoint)
        const typeStatsMap = new Map();
        
        analyticsResult.records.forEach(record => {
            const requestType = record.TenantRequestAction__c;
            
            if (!typeStatsMap.has(requestType)) {
                typeStatsMap.set(requestType, {
                    count: 0,
                    validationFailures: 0
                });
            }
            
            const stats = typeStatsMap.get(requestType);
            stats.count++;
            
            // Validate the record using the same logic as /api/validation/errors
            try {
                const validationResult = validationEngine.ValidationEngine.validateRecord(record, enabledRules);
                if (validationResult.overallStatus === 'FAIL') {
                    stats.validationFailures++;
                    console.log(`[ANALYTICS] Record ${record.Name} (${requestType}) FAILED validation`);
                }
            } catch (error) {
                console.warn(`⚠️ Error validating record ${record.Id}:`, error.message);
                // Don't count as failure if validation itself errors
            }
        });

        // Build data array with all request types, filling in 0 for missing ones
        const data = allTypesResult.records.map(record => {
            const requestType = record.TenantRequestAction__c;
            const stats = typeStatsMap.get(requestType) || { count: 0, validationFailures: 0 };
            
            return {
                requestType: requestType,
                count: stats.count,
                validationFailures: stats.validationFailures,
                validationFailureRate: stats.count > 0 ? 
                    ((stats.validationFailures / stats.count) * 100).toFixed(1) : '0.0',
                percentage: 0 // Will calculate after getting total
            };
        });

        // Calculate total and percentages
        const totalRequests = data.reduce((sum, item) => sum + item.count, 0);
        const totalValidationFailures = data.reduce((sum, item) => sum + item.validationFailures, 0);
        
        data.forEach(item => {
            item.percentage = totalRequests > 0 ? ((item.count / totalRequests) * 100).toFixed(1) : '0.0';
        });

        // Sort by count descending, then by name for consistent ordering
        data.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.requestType.localeCompare(b.requestType);
        });

        console.log(`✅ Analytics data fetched: ${data.length} request types (${allTypesResult.records.length} total), ${totalRequests} total requests, ${totalValidationFailures} validation failures`);

        return {
            success: true,
            data: data,
            totalRequests: totalRequests,
            totalValidationFailures: totalValidationFailures,
            enabledRulesCount: enabledRules.length,
            period: {
                startDate: startDateStr,
                endDate: endDateStr
            }
        };

    } catch (err) {
        console.error('❌ Error fetching weekly analytics:', err.message);
        return {
            success: false,
            error: err.message,
            data: [],
            totalRequests: 0,
            totalValidationFailures: 0
        };
    }
}

// Get validation failure trend for Update, New, and Deprovision requests over time
// Each data point shows the rolling annual validation failure percentage
async function getValidationFailureTrend(startDate, endDate, enabledRuleIds = null) {
    try {
        const conn = await getConnection();
        if (!conn) {
            throw new Error('No Salesforce connection available');
        }

        const validationEngine = require('./validation-engine');
        
        // We need data from 1 year + 3 months to calculate rolling annual for the 3-month period
        const dataStartDate = new Date(startDate);
        dataStartDate.setFullYear(dataStartDate.getFullYear() - 1);
        
        const startDateStr = dataStartDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log(`📈 Fetching validation failure trend from ${startDateStr} to ${endDateStr} (15 months of data)`);
        
        // Get all Update, New, and Deprovision requests for the extended period
        const query = `
            SELECT Id, Name, TenantRequestAction__c, Payload_Data__c, CreatedDate
            FROM Prof_Services_Request__c 
            WHERE CreatedDate >= ${startDateStr}T00:00:00.000Z 
            AND CreatedDate <= ${endDateStr}T23:59:59.999Z
            AND Name LIKE 'PS-%'
            AND (TenantRequestAction__c = 'Update' OR TenantRequestAction__c = 'New' OR TenantRequestAction__c = 'Deprovision')
            ORDER BY CreatedDate ASC
        `;
        
        const result = await conn.query(query);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} requests for rolling annual trend analysis`);
        
        // Get enabled validation rules
        let enabledRules;
        if (enabledRuleIds && enabledRuleIds.length > 0) {
            enabledRules = validationEngine.DEFAULT_VALIDATION_RULES.filter(rule => 
                enabledRuleIds.includes(rule.id)
            );
        } else {
            enabledRules = validationEngine.getEnabledValidationRules();
        }
        
        // Validate all records once and store results by request type
        const validatedRecordsByType = {
            'Update': [],
            'New': [],
            'Deprovision': []
        };
        
        records.forEach(record => {
            let failed = false;
            try {
                const validationResult = validationEngine.ValidationEngine.validateRecord(record, enabledRules);
                failed = validationResult.overallStatus === 'FAIL';
            } catch (error) {
                console.warn(`⚠️ Error validating record ${record.Id}:`, error.message);
            }
            
            const requestType = record.TenantRequestAction__c;
            if (validatedRecordsByType[requestType]) {
                validatedRecordsByType[requestType].push({
                    createdDate: new Date(record.CreatedDate),
                    failed: failed
                });
            }
        });
        
        console.log(`✅ Validated ${records.length} records: Update=${validatedRecordsByType['Update'].length}, New=${validatedRecordsByType['New'].length}, Deprovision=${validatedRecordsByType['Deprovision'].length}`);
        
        // Calculate rolling annual failure percentage for each day in the 3-month period
        const trendData = [];
        const currentDate = new Date(startDate); // This is 3 months ago
        const finalDate = new Date(endDate);
        
        while (currentDate <= finalDate) {
            // Calculate the 1-year period ending on this date
            const yearStart = new Date(currentDate);
            yearStart.setFullYear(yearStart.getFullYear() - 1);
            
            const dataPoint = {
                date: currentDate.toISOString().split('T')[0],
                displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
            
            // Calculate for each request type
            ['Update', 'New', 'Deprovision'].forEach(requestType => {
                const recordsInWindow = validatedRecordsByType[requestType].filter(r => 
                    r.createdDate >= yearStart && r.createdDate <= currentDate
                );
                
                const total = recordsInWindow.length;
                const failures = recordsInWindow.filter(r => r.failed).length;
                const failurePercentage = total > 0 ? ((failures / total) * 100).toFixed(1) : '0.0';
                
                const fieldPrefix = requestType.toLowerCase();
                dataPoint[`${fieldPrefix}Total`] = total;
                dataPoint[`${fieldPrefix}Failures`] = failures;
                dataPoint[`${fieldPrefix}FailurePercentage`] = failurePercentage;
            });
            
            // Legacy fields for backwards compatibility (Update data)
            dataPoint.total = dataPoint.updateTotal;
            dataPoint.failures = dataPoint.updateFailures;
            dataPoint.failurePercentage = dataPoint.updateFailurePercentage;
            
            trendData.push(dataPoint);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log(`✅ Trend data calculated: ${trendData.length} daily data points with rolling annual percentages for Update, New, and Deprovision`);
        
        // Debug: Log first data point to verify structure
        if (trendData.length > 0) {
            console.log('📊 First data point sample:', JSON.stringify(trendData[0], null, 2));
        }
        
        return {
            success: true,
            trendData: trendData,
            period: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        };
        
    } catch (err) {
        console.error('❌ Error fetching validation failure trend:', err.message);
        return {
            success: false,
            error: err.message,
            trendData: []
        };
    }
}

// Get PS requests with product removals compared to previous request
async function getPSRequestsWithRemovals(timeFrame = '1w') {
    try {
        const conn = await getConnection();
        if (!conn) {
            throw new Error('No Salesforce connection available');
        }

        // Calculate date range based on time frame
        const now = new Date();
        let startDate;
        
        switch (timeFrame) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '1w':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '1m':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        
        const startDateStr = startDate.toISOString().split('T')[0];
        
        console.log(`🔍 Fetching PS requests with removals since ${startDateStr} (${timeFrame})`);
        
        // Get all PS requests in the time period
        const currentPeriodQuery = `
            SELECT Id, Name, Account__c, Status__c, TenantRequestAction__c,
                   CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${startDateStr}T00:00:00Z 
            AND Name LIKE 'PS-%'
            ORDER BY Account__c, CreatedDate DESC
            LIMIT 1000
        `;
        
        const currentResult = await conn.query(currentPeriodQuery);
        const currentRequests = currentResult.records || [];
        
        console.log(`✅ Found ${currentRequests.length} PS requests in time period`);
        
        // Group requests by account
        const requestsByAccount = new Map();
        currentRequests.forEach(request => {
            const account = request.Account__c;
            if (!requestsByAccount.has(account)) {
                requestsByAccount.set(account, []);
            }
            requestsByAccount.get(account).push(request);
        });
        
        console.log(`📊 Found ${requestsByAccount.size} unique accounts`);
        
        // For each request, find removals by comparing with previous request
        const requestsWithRemovals = [];
        
        for (const [account, accountRequests] of requestsByAccount) {
            // Sort by creation date descending (newest first)
            accountRequests.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
            
            for (let i = 0; i < accountRequests.length; i++) {
                const currentRequest = accountRequests[i];
                
                // Find the previous request for this account (chronologically before current)
                const previousRequestQuery = `
                    SELECT Id, Name, Account__c, Payload_Data__c, CreatedDate
                    FROM Prof_Services_Request__c
                    WHERE Account__c = '${account.replace(/'/g, "\\'")}'
                    AND CreatedDate < ${currentRequest.CreatedDate}
                    AND Name LIKE 'PS-%'
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                `;
                
                try {
                    const previousResult = await conn.query(previousRequestQuery);
                    
                    if (previousResult.records && previousResult.records.length > 0) {
                        const previousRequest = previousResult.records[0];
                        
                        // Parse payloads
                        const currentPayload = parsePayloadData(currentRequest.Payload_Data__c);
                        const previousPayload = parsePayloadData(previousRequest.Payload_Data__c);
                        
                        // Find removed products
                        const removals = findRemovedProducts(previousPayload, currentPayload);
                        
                        if (removals.hasRemovals) {
                            requestsWithRemovals.push({
                                currentRequest: {
                                    id: currentRequest.Id,
                                    name: currentRequest.Name,
                                    account: currentRequest.Account__c,
                                    status: currentRequest.Status__c,
                                    requestType: currentRequest.TenantRequestAction__c,
                                    createdDate: currentRequest.CreatedDate
                                },
                                previousRequest: {
                                    id: previousRequest.Id,
                                    name: previousRequest.Name,
                                    createdDate: previousRequest.CreatedDate
                                },
                                removals: removals
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Error finding previous request for ${currentRequest.Name}:`, err.message);
                }
            }
        }
        
        console.log(`✅ Found ${requestsWithRemovals.length} PS requests with product removals`);
        
        return {
            success: true,
            requests: requestsWithRemovals,
            totalCount: requestsWithRemovals.length,
            timeFrame: timeFrame,
            startDate: startDateStr
        };
        
    } catch (err) {
        console.error('❌ Error fetching PS requests with removals:', err.message);
        return {
            success: false,
            error: err.message,
            requests: [],
            totalCount: 0
        };
    }
}

// Helper function to find removed products between two payloads
function findRemovedProducts(previousPayload, currentPayload) {
    const removedModels = [];
    const removedData = [];
    const removedApps = [];
    
    // Compare model entitlements
    if (previousPayload.modelEntitlements && previousPayload.modelEntitlements.length > 0) {
        const currentModelCodes = new Set(
            (currentPayload.modelEntitlements || []).map(e => e.productCode).filter(Boolean)
        );
        
        previousPayload.modelEntitlements.forEach(prevModel => {
            if (prevModel.productCode && !currentModelCodes.has(prevModel.productCode)) {
                removedModels.push({
                    productCode: prevModel.productCode,
                    name: prevModel.name || prevModel.productCode,
                    type: 'Model'
                });
            }
        });
    }
    
    // Compare data entitlements
    if (previousPayload.dataEntitlements && previousPayload.dataEntitlements.length > 0) {
        const currentDataCodes = new Set(
            (currentPayload.dataEntitlements || []).map(e => e.productCode || e.name).filter(Boolean)
        );
        
        previousPayload.dataEntitlements.forEach(prevData => {
            const identifier = prevData.productCode || prevData.name;
            if (identifier && !currentDataCodes.has(identifier)) {
                removedData.push({
                    productCode: identifier,
                    name: prevData.name || identifier,
                    type: 'Data'
                });
            }
        });
    }
    
    // Compare app entitlements
    if (previousPayload.appEntitlements && previousPayload.appEntitlements.length > 0) {
        const currentAppCodes = new Set(
            (currentPayload.appEntitlements || []).map(e => e.productCode || e.name).filter(Boolean)
        );
        
        previousPayload.appEntitlements.forEach(prevApp => {
            const identifier = prevApp.productCode || prevApp.name;
            if (identifier && !currentAppCodes.has(identifier)) {
                removedApps.push({
                    productCode: identifier,
                    name: prevApp.name || identifier,
                    type: 'App'
                });
            }
        });
    }
    
    const totalRemovals = removedModels.length + removedData.length + removedApps.length;
    
    return {
        hasRemovals: totalRemovals > 0,
        removedModels,
        removedData,
        removedApps,
        totalCount: totalRemovals,
        summary: totalRemovals > 0 
            ? `${removedModels.length} Model(s), ${removedData.length} Data, ${removedApps.length} App(s)` 
            : 'No removals'
    };
}

// ===== EXPIRATION MONITOR FUNCTIONS =====

/**
 * Analyze product entitlement expirations across PS records
 * @param {number} lookbackYears - Years to look back for PS records (default: 5)
 * @param {number} expirationWindow - Days in the future to check for expirations
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeExpirations(lookbackYears = 5, expirationWindow = 30) {
    try {
        const conn = await getConnection();
        if (!conn) {
            throw new Error('No Salesforce connection available');
        }

        console.log(`⏰ Starting expiration analysis: ${lookbackYears} year lookback, ${expirationWindow} day window`);
        
        // Calculate lookback date
        const lookbackDate = new Date();
        lookbackDate.setFullYear(lookbackDate.getFullYear() - lookbackYears);
        const lookbackDateStr = lookbackDate.toISOString().split('T')[0];
        
        // Query all PS records from lookback period
        // Account__c contains the actual account name (not Account_Site__c which is the site location)
        const query = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c,
                   Status__c, CreatedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${lookbackDateStr}T00:00:00Z
            AND Name LIKE 'PS-%'
            ORDER BY Account__c, CreatedDate ASC
            LIMIT 10000
        `;
        
        console.log(`🔍 Querying PS records from ${lookbackDateStr}...`);
        const result = await conn.query(query);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} PS records for analysis`);
        
        // Extract all entitlements from all records
        const allEntitlements = [];
        let entitlementsProcessed = 0;
        
        for (const record of records) {
            const parsedPayload = parsePayloadData(record.Payload_Data__c);
            
            if (parsedPayload.hasDetails) {
                // Process model entitlements
                if (parsedPayload.modelEntitlements) {
                    parsedPayload.modelEntitlements.forEach(ent => {
                        const endDate = ent.endDate || ent.end_date || ent.EndDate;
                        if (endDate) {
                            allEntitlements.push({
                                accountId: record.Account__c,
                                accountName: record.Account__c || 'Unknown',
                                psRecordId: record.Id,
                                psRecordName: record.Name,
                                productCode: ent.productCode || ent.code || ent.id,
                                productName: ent.name || ent.productName || ent.productCode,
                                productType: 'Model',
                                endDate: endDate,
                                createdDate: record.CreatedDate
                            });
                            entitlementsProcessed++;
                        }
                    });
                }
                
                // Process data entitlements
                if (parsedPayload.dataEntitlements) {
                    parsedPayload.dataEntitlements.forEach(ent => {
                        const endDate = ent.endDate || ent.end_date || ent.EndDate;
                        if (endDate) {
                            allEntitlements.push({
                                accountId: record.Account__c,
                                accountName: record.Account__c || 'Unknown',
                                psRecordId: record.Id,
                                psRecordName: record.Name,
                                productCode: ent.productCode || ent.code || ent.id || ent.name,
                                productName: ent.name || ent.productName,
                                productType: 'Data',
                                endDate: endDate,
                                createdDate: record.CreatedDate
                            });
                            entitlementsProcessed++;
                        }
                    });
                }
                
                // Process app entitlements
                if (parsedPayload.appEntitlements) {
                    parsedPayload.appEntitlements.forEach(ent => {
                        const endDate = ent.endDate || ent.end_date || ent.EndDate;
                        if (endDate) {
                            allEntitlements.push({
                                accountId: record.Account__c,
                                accountName: record.Account__c || 'Unknown',
                                psRecordId: record.Id,
                                psRecordName: record.Name,
                                productCode: ent.productCode || ent.code || ent.id || ent.name,
                                productName: ent.name || ent.productName,
                                productType: 'App',
                                endDate: endDate,
                                createdDate: record.CreatedDate
                            });
                            entitlementsProcessed++;
                        }
                    });
                }
            }
        }
        
        console.log(`📦 Extracted ${entitlementsProcessed} entitlements with end dates`);
        
        // Build a map of PS records by account to track product presence
        const psRecordsByAccount = new Map();
        records.forEach(record => {
            if (!psRecordsByAccount.has(record.Account__c)) {
                psRecordsByAccount.set(record.Account__c, []);
            }
            
            // Extract all product codes from this PS record
            const parsedPayload = parsePayloadData(record.Payload_Data__c);
            const productCodesInRecord = new Set();
            
            if (parsedPayload.hasDetails) {
                if (parsedPayload.modelEntitlements) {
                    parsedPayload.modelEntitlements.forEach(ent => {
                        const code = ent.productCode || ent.code || ent.id;
                        if (code) productCodesInRecord.add(code);
                    });
                }
                if (parsedPayload.dataEntitlements) {
                    parsedPayload.dataEntitlements.forEach(ent => {
                        const code = ent.productCode || ent.code || ent.id || ent.name;
                        if (code) productCodesInRecord.add(code);
                    });
                }
                if (parsedPayload.appEntitlements) {
                    parsedPayload.appEntitlements.forEach(ent => {
                        const code = ent.productCode || ent.code || ent.id || ent.name;
                        if (code) productCodesInRecord.add(code);
                    });
                }
            }
            
            psRecordsByAccount.get(record.Account__c).push({
                id: record.Id,
                name: record.Name,
                createdDate: new Date(record.CreatedDate),
                productCodes: productCodesInRecord
            });
        });
        
        // Sort PS records by creation date for each account
        psRecordsByAccount.forEach(records => {
            records.sort((a, b) => a.createdDate - b.createdDate);
        });
        
        console.log(`📋 Built PS record map for ${psRecordsByAccount.size} accounts`);
        
        // Group entitlements by account for extension detection
        const byAccount = new Map();
        allEntitlements.forEach(ent => {
            if (!byAccount.has(ent.accountId)) {
                byAccount.set(ent.accountId, []);
            }
            byAccount.get(ent.accountId).push(ent);
        });
        
        console.log(`🏢 Processing ${byAccount.size} unique accounts for extension detection`);
        
        // Detect expirations and extensions
        const expiringItems = [];
        let extensionsFound = 0;
        let removedInSubsequentRecord = 0;
        const today = new Date();
        const expirationThreshold = new Date();
        expirationThreshold.setDate(expirationThreshold.getDate() + expirationWindow);
        
        for (const [accountId, accountEntitlements] of byAccount) {
            // Get PS records for this account
            const accountPsRecords = psRecordsByAccount.get(accountId) || [];
            
            // Group entitlements by PS record first
            const byPsRecord = new Map();
            accountEntitlements.forEach(ent => {
                if (!byPsRecord.has(ent.psRecordId)) {
                    byPsRecord.set(ent.psRecordId, []);
                }
                byPsRecord.get(ent.psRecordId).push(ent);
            });
            
            // Process each PS record
            for (const [psRecordId, psEntitlements] of byPsRecord) {
                // Within this PS record, group by product code and find max end date
                // This ensures that if a product code has multiple line items with different dates,
                // we use the LATEST end date for expiration detection (e.g., PS-4178 RI-EXPOSUREIQ)
                const productCodeMaxDates = new Map();
                
                psEntitlements.forEach(ent => {
                    const productCode = ent.productCode;
                    const endDate = new Date(ent.endDate);
                    
                    if (!productCodeMaxDates.has(productCode)) {
                        productCodeMaxDates.set(productCode, {
                            maxEndDate: endDate,
                            maxEndDateStr: ent.endDate,
                            entitlement: ent
                        });
                    } else {
                        const existing = productCodeMaxDates.get(productCode);
                        if (endDate > existing.maxEndDate) {
                            productCodeMaxDates.set(productCode, {
                                maxEndDate: endDate,
                                maxEndDateStr: ent.endDate,
                                entitlement: ent
                            });
                        }
                    }
                });
                
                // Now check each product code's max end date for expiration
                for (const [productCode, productData] of productCodeMaxDates) {
                    const maxEndDate = productData.maxEndDate;
                    const maxEndDateStr = productData.maxEndDateStr;
                    const entitlement = productData.entitlement;
                    
                    // Check if this product code's max end date is expiring within the window
                    if (maxEndDate >= today && maxEndDate <= expirationThreshold) {
                        // Calculate days until expiry based on MAX end date
                        const daysUntilExpiry = Math.ceil((maxEndDate - today) / (1000 * 60 * 60 * 24));
                        
                        // Look for extensions in OTHER PS records (same product code, later end date)
                        // Need to find the max end date for this product code in other PS records
                        let extension = null;
                        for (const [otherPsRecordId, otherPsEntitlements] of byPsRecord) {
                            if (otherPsRecordId !== psRecordId) {
                                // Find all entitlements for this product code in the other PS record
                                const matchingEntitlements = otherPsEntitlements.filter(e => 
                                    e.productCode === productCode
                                );
                                
                                // Find the max end date for this product code in the other PS record
                                for (const otherEnt of matchingEntitlements) {
                                    const otherEndDate = new Date(otherEnt.endDate);
                                    if (otherEndDate > maxEndDate) {
                                        if (!extension || otherEndDate > new Date(extension.endDate)) {
                                            extension = otherEnt;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (extension) {
                            extensionsFound++;
                        }
                        
                        // Check if this product was removed in a subsequent PS record
                        const currentPsRecord = accountPsRecords.find(pr => pr.id === psRecordId);
                        let wasRemovedInLaterRecord = false;
                        
                        if (currentPsRecord) {
                            // Find any PS record created after this one
                            const laterRecords = accountPsRecords.filter(pr => 
                                pr.createdDate > currentPsRecord.createdDate &&
                                !pr.productCodes.has(productCode)
                            );
                            
                            // If there's a later record without this product, it was removed
                            if (laterRecords.length > 0) {
                                wasRemovedInLaterRecord = true;
                                removedInSubsequentRecord++;
                            }
                        }
                        
                        // Only include if not removed in a subsequent record
                        if (!wasRemovedInLaterRecord) {
                            expiringItems.push({
                                accountId: entitlement.accountId,
                                accountName: entitlement.accountName,
                                psRecordId: entitlement.psRecordId,
                                psRecordName: entitlement.psRecordName,
                                productCode: entitlement.productCode,
                                productName: entitlement.productName,
                                productType: entitlement.productType,
                                endDate: maxEndDateStr, // Use the MAX end date
                                daysUntilExpiry: daysUntilExpiry,
                                isExtended: !!extension,
                                extendingPsRecordId: extension?.psRecordId || null,
                                extendingPsRecordName: extension?.psRecordName || null,
                                extendingEndDate: extension?.endDate || null
                            });
                        }
                    }
                }
            }
        }
        
        console.log(`✅ Analysis complete: ${expiringItems.length} expirations found, ${extensionsFound} extensions detected, ${removedInSubsequentRecord} filtered (removed in subsequent records)`);
        
        return {
            success: true,
            recordsAnalyzed: records.length,
            entitlementsProcessed: entitlementsProcessed,
            expirationsFound: expiringItems.length,
            extensionsFound: extensionsFound,
            removedInSubsequentRecord: removedInSubsequentRecord,
            expirationData: expiringItems,
            lookbackYears: lookbackYears,
            expirationWindow: expirationWindow
        };
        
    } catch (err) {
        console.error('❌ Error analyzing expirations:', err.message);
        return {
            success: false,
            error: err.message,
            expirationData: []
        };
    }
}

/**
 * Get expiring entitlements grouped by account and PS record
 * @param {number} expirationWindow - Days in the future to check
 * @param {boolean} showExtended - Whether to include extended items (deprecated, always false)
 * @returns {Promise<Object>} Grouped expiration data
 */
async function getExpiringEntitlements(expirationWindow = 30, showExtended = false) {
    try {
        const db = require('./database');
        
        // Get expiration data from cache (non-extended only)
        const result = await db.getExpirationData({
            expirationWindow: expirationWindow,
            showExtended: false  // Always filter to non-extended items
        });
        
        if (!result.success || !result.data) {
            return {
                success: false,
                error: result.error || 'Failed to get expiration data',
                expirations: []
            };
        }
        
        // Group by account and PS record
        const grouped = new Map();
        
        result.data.forEach(item => {
            const key = `${item.account_id}|${item.ps_record_id}`;
            
            if (!grouped.has(key)) {
                grouped.set(key, {
                    account: {
                        id: item.account_id,
                        name: item.account_name
                    },
                    psRecord: {
                        id: item.ps_record_id,
                        name: item.ps_record_name
                    },
                    expiringProducts: {
                        models: [],
                        data: [],
                        apps: []
                    },
                    earliestExpiry: item.end_date,
                    earliestDaysUntilExpiry: item.days_until_expiry,
                    status: 'current' // Will be updated based on earliest expiry
                });
            }
            
            const group = grouped.get(key);
            
            // Add product to appropriate category
            const product = {
                productCode: item.product_code,
                productName: item.product_name,
                endDate: item.end_date,
                daysUntilExpiry: item.days_until_expiry,
                isExtended: item.is_extended,
                extendingPsRecordId: item.extending_ps_record_id,
                extendingPsRecordName: item.extending_ps_record_name,
                extendingEndDate: item.extending_end_date
            };
            
            if (item.product_type === 'Model') {
                group.expiringProducts.models.push(product);
            } else if (item.product_type === 'Data') {
                group.expiringProducts.data.push(product);
            } else if (item.product_type === 'App') {
                group.expiringProducts.apps.push(product);
            }
            
            // Update earliest expiry and its days until expiry
            if (new Date(item.end_date) < new Date(group.earliestExpiry)) {
                group.earliestExpiry = item.end_date;
                group.earliestDaysUntilExpiry = item.days_until_expiry;
            }
        });
        
        // Calculate status based on earliest expiry for each group
        grouped.forEach(group => {
            const daysUntilExpiry = group.earliestDaysUntilExpiry;
            
            if (daysUntilExpiry <= 7) {
                group.status = 'at-risk';
            } else if (daysUntilExpiry <= 30) {
                group.status = 'upcoming';
            } else {
                group.status = 'current';
            }
        });
        
        return {
            success: true,
            expirations: Array.from(grouped.values()),
            totalCount: grouped.size
        };
        
    } catch (err) {
        console.error('❌ Error getting expiring entitlements:', err.message);
        return {
            success: false,
            error: err.message,
            expirations: []
        };
    }
}

/**
 * Get aggregated customer products for a specific account
 * Shows only active products (endDate >= today), grouped by region and category
 */
async function getCustomerProducts(accountName) {
    try {
        console.log(`📦 Fetching customer products for account: ${accountName}`);
        
        const conn = await getConnection();
        
        // Query all PS requests for this account
        const soqlQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c,
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE Account__c = '${accountName.replace(/'/g, "\\'")}'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        console.log(`✅ Found ${records.length} PS records for ${accountName}`);
        
        if (records.length === 0) {
            return {
                success: true,
                account: accountName,
                summary: {
                    totalActive: 0,
                    byCategory: { models: 0, data: 0, apps: 0 }
                },
                productsByRegion: {},
                lastUpdated: null,
                psRecordsAnalyzed: 0
            };
        }
        
        // Today's date for active product filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Aggregate products by region
        const productsByRegion = {};
        let lastUpdatedRecord = records[0]; // Most recent (already sorted DESC)
        
        // Track all unique products across regions for merging
        // Key: region|category|productCode
        const productMap = new Map();
        
        for (const record of records) {
            const payload = parsePayloadData(record.Payload_Data__c);
            
            if (!payload || !payload.hasDetails) {
                continue;
            }
            
            const region = payload.region || 'Unknown Region';
            
            // Process each category
            const categories = [
                { type: 'models', data: payload.modelEntitlements || [] },
                { type: 'data', data: payload.dataEntitlements || [] },
                { type: 'apps', data: payload.appEntitlements || [] }
            ];
            
            for (const category of categories) {
                for (const entitlement of category.data) {
                    // Check if product has required fields
                    if (!entitlement.productCode) continue;
                    
                    const startDate = entitlement.startDate ? new Date(entitlement.startDate) : null;
                    const endDate = entitlement.endDate ? new Date(entitlement.endDate) : null;
                    
                    // Skip if no end date or product is expired
                    if (!endDate || endDate < today) {
                        continue;
                    }
                    
                    // Create unique key for merging (region + category + productCode)
                    // Exception: databridge can have multiple instances in same region
                    const isDataBridge = entitlement.productCode?.toLowerCase().includes('databridge');
                    const uniqueKey = isDataBridge 
                        ? `${region}|${category.type}|${entitlement.productCode}|${record.Name}` // Include PS record for databridge
                        : `${region}|${category.type}|${entitlement.productCode}`;
                    
                    if (productMap.has(uniqueKey)) {
                        // Merge with existing product
                        const existing = productMap.get(uniqueKey);
                        
                        // Update date range (earliest start, latest end)
                        if (startDate && (!existing.startDate || startDate < existing.startDate)) {
                            existing.startDate = startDate;
                        }
                        if (endDate && (!existing.endDate || endDate > existing.endDate)) {
                            existing.endDate = endDate;
                        }
                        
                        // Add PS record to sources
                        if (!existing.sourcePSRecords.includes(record.Name)) {
                            existing.sourcePSRecords.push(record.Name);
                        }
                        
                        // Update package name if more recent
                        if (entitlement.packageName && !existing.packageName) {
                            existing.packageName = entitlement.packageName;
                        }
                    } else {
                        // Create new product entry
                        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                        
                        let status;
                        if (daysRemaining > 90) {
                            status = 'active';
                        } else if (daysRemaining > 30) {
                            status = 'expiring-soon';
                        } else {
                            status = 'expiring';
                        }
                        
                        productMap.set(uniqueKey, {
                            productCode: entitlement.productCode,
                            productName: entitlement.name || entitlement.productCode,
                            packageName: entitlement.packageName || null,
                            category: category.type,
                            region: region,
                            startDate: startDate,
                            endDate: endDate,
                            status: status,
                            daysRemaining: daysRemaining,
                            sourcePSRecords: [record.Name],
                            isDataBridge: isDataBridge
                        });
                    }
                }
            }
        }
        
        // Organize products by region
        for (const [key, product] of productMap) {
            const region = product.region;
            
            if (!productsByRegion[region]) {
                productsByRegion[region] = {
                    models: [],
                    data: [],
                    apps: []
                };
            }
            
            // Format dates for display
            const formattedProduct = {
                ...product,
                startDate: product.startDate ? product.startDate.toISOString().split('T')[0] : null,
                endDate: product.endDate ? product.endDate.toISOString().split('T')[0] : null
            };
            
            productsByRegion[region][product.category].push(formattedProduct);
        }
        
        // Sort products within each region/category by product code
        for (const region in productsByRegion) {
            for (const category of ['models', 'data', 'apps']) {
                productsByRegion[region][category].sort((a, b) => 
                    a.productCode.localeCompare(b.productCode)
                );
            }
        }
        
        // Calculate summary statistics
        let totalActive = 0;
        const byCategory = { models: 0, data: 0, apps: 0 };
        
        for (const region in productsByRegion) {
            for (const category of ['models', 'data', 'apps']) {
                const count = productsByRegion[region][category].length;
                byCategory[category] += count;
                totalActive += count;
            }
        }
        
        return {
            success: true,
            account: accountName,
            summary: {
                totalActive: totalActive,
                byCategory: byCategory
            },
            productsByRegion: productsByRegion,
            lastUpdated: {
                psRecordId: lastUpdatedRecord.Name,
                date: lastUpdatedRecord.LastModifiedDate || lastUpdatedRecord.CreatedDate
            },
            psRecordsAnalyzed: records.length
        };
        
    } catch (err) {
        console.error('❌ Error getting customer products:', err.message);
        return {
            success: false,
            error: err.message,
            account: accountName,
            productsByRegion: {}
        };
    }
}

/**
 * Sync all unique accounts from Salesforce to the database
 * This pulls ALL accounts incrementally without full repopulation
 */
async function syncAllAccountsFromSalesforce() {
    try {
        console.log('🔄 Syncing all accounts from Salesforce...');
        
        const conn = await getConnection();
        const db = require('./database');
        
        // Query ALL PS records (Salesforce doesn't allow GROUP BY on Account__c)
        // We'll process them in Node.js to extract unique accounts
        const soqlQuery = `
            SELECT Account__c, CreatedDate
            FROM Prof_Services_Request__c
            WHERE Account__c != null
            AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
        `;
        
        console.log('📊 Querying Salesforce for all PS records to extract accounts...');
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        console.log(`📊 Processing ${records.length} PS records...`);
        
        // Extract unique accounts and aggregate data in Node.js
        const accountMap = new Map();
        
        for (const record of records) {
            const accountId = record.Account__c;
            if (!accountId) continue;
            
            if (!accountMap.has(accountId)) {
                accountMap.set(accountId, {
                    accountId: accountId,
                    accountName: accountId, // Account__c IS the name in this setup
                    totalPsRecords: 0,
                    latestPsDate: null
                });
            }
            
            const accountData = accountMap.get(accountId);
            accountData.totalPsRecords++;
            
            const recordDate = new Date(record.CreatedDate);
            if (!accountData.latestPsDate || recordDate > accountData.latestPsDate) {
                accountData.latestPsDate = recordDate;
            }
        }
        
        console.log(`✅ Found ${accountMap.size} unique accounts`);
        
        // Upsert each account to the database
        let newAccounts = 0;
        let updatedAccounts = 0;
        
        for (const accountData of accountMap.values()) {
            const result = await db.upsertAllAccount(accountData);
            
            if (result.success) {
                // Check if it was an insert or update
                const timeDiff = new Date(result.account.updated_at) - new Date(result.account.first_seen);
                if (timeDiff < 1000) { // Less than 1 second = new
                    newAccounts++;
                } else {
                    updatedAccounts++;
                }
            }
        }
        
        console.log(`✅ Sync complete: ${newAccounts} new, ${updatedAccounts} updated`);
        
        return {
            success: true,
            totalAccounts: accountMap.size,
            newAccounts: newAccounts,
            updatedAccounts: updatedAccounts
        };
        
    } catch (err) {
        console.error('❌ Error syncing accounts from Salesforce:', err.message);
        return {
            success: false,
            error: err.message,
            totalAccounts: 0
        };
    }
}

/**
 * Analyze a specific account to determine if it's a ghost account
 * Ghost account = all products expired + no deprovisioning PS record after latest expiry
 */
async function analyzeAccountForGhostStatus(accountId, accountName) {
    try {
        console.log(`👻 Analyzing account for ghost status: ${accountName} (ID: ${accountId})`);
        
        const conn = await getConnection();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Query all PS requests for this account
        // Account__c is the Account ID, not name
        const soqlQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c,
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE Account__c = '${accountId}'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        if (records.length === 0) {
            return {
                success: true,
                isGhost: false,
                reason: 'No PS records found'
            };
        }
        
        // Parse all entitlements across all PS records
        let allExpired = true;
        let hasAnyEntitlement = false;
        let latestExpiryDate = null;
        let totalExpiredProducts = 0;
        
        for (const record of records) {
            const payload = parsePayloadData(record.Payload_Data__c);
            
            if (!payload || !payload.hasDetails) {
                continue;
            }
            
            // Check all entitlement types
            const allEntitlements = [
                ...(payload.modelEntitlements || []),
                ...(payload.dataEntitlements || []),
                ...(payload.appEntitlements || [])
            ];
            
            for (const entitlement of allEntitlements) {
                if (!entitlement.endDate) {
                    continue; // Skip entitlements without end dates
                }
                
                hasAnyEntitlement = true;
                const endDate = new Date(entitlement.endDate);
                
                // Track the latest expiry date
                if (!latestExpiryDate || endDate > latestExpiryDate) {
                    latestExpiryDate = endDate;
                }
                
                // If any entitlement is still active, not a ghost account
                if (endDate >= today) {
                    allExpired = false;
                } else {
                    totalExpiredProducts++;
                }
            }
        }
        
        // If no entitlements found or not all expired, not a ghost account
        if (!hasAnyEntitlement) {
            return {
                success: true,
                isGhost: false,
                reason: 'No entitlements found'
            };
        }
        
        if (!allExpired) {
            return {
                success: true,
                isGhost: false,
                reason: 'Has active entitlements'
            };
        }
        
        // All products are expired - now check for deprovisioning PS record
        // after the latest expiry date
        const deprovisioningRecords = records.filter(record => {
            const requestType = record.TenantRequestAction__c?.toLowerCase() || '';
            const isDeprovisioning = requestType.includes('deprovision');
            const recordDate = new Date(record.CreatedDate);
            return isDeprovisioning && recordDate > latestExpiryDate;
        });
        
        if (deprovisioningRecords.length > 0) {
            return {
                success: true,
                isGhost: false,
                reason: 'Has deprovisioning record after latest expiry',
                deprovisioningRecord: deprovisioningRecords[0].Name
            };
        }
        
        // This is a ghost account!
        return {
            success: true,
            isGhost: true,
            accountId: accountId,
            accountName: accountName,
            totalExpiredProducts: totalExpiredProducts,
            latestExpiryDate: latestExpiryDate.toISOString().split('T')[0],
            psRecordsAnalyzed: records.length
        };
        
    } catch (err) {
        console.error(`❌ Error analyzing account for ghost status: ${err.message}`);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Identify all ghost accounts from the expiration monitor data
 */
async function identifyGhostAccounts() {
    try {
        console.log('👻 Starting ghost accounts identification...');
        
        const db = require('./database');
        
        // STEP 1: Sync all accounts from Salesforce to database (incremental)
        console.log('📥 Step 1: Syncing accounts from Salesforce...');
        const syncResult = await syncAllAccountsFromSalesforce();
        
        if (!syncResult.success) {
            console.error('❌ Failed to sync accounts from Salesforce');
            return {
                success: false,
                error: 'Failed to sync accounts from Salesforce',
                ghostAccounts: [],
                totalAnalyzed: 0
            };
        }
        
        console.log(`✅ Synced ${syncResult.totalAccounts} accounts (${syncResult.newAccounts} new, ${syncResult.updatedAccounts} updated)`);
        
        // STEP 2: Get all accounts from database
        console.log('📊 Step 2: Loading all accounts from database...');
        const accountsResult = await db.getAllAccounts();
        
        if (!accountsResult.success || accountsResult.accounts.length === 0) {
            return {
                success: true,
                ghostAccounts: [],
                totalAnalyzed: 0,
                message: 'No accounts found in database'
            };
        }
        
        console.log(`📊 Analyzing ${accountsResult.accounts.length} accounts...`);
        
        const ghostAccounts = [];
        let analyzed = 0;
        
        // Clear existing ghost accounts
        await db.clearGhostAccounts();
        
        // STEP 3: Analyze each account for ghost status
        for (const account of accountsResult.accounts) {
            analyzed++;
            console.log(`[${analyzed}/${accountsResult.accounts.length}] Checking: ${account.account_name}`);
            
            const analysis = await analyzeAccountForGhostStatus(
                account.account_id,
                account.account_name
            );
            
            if (analysis.success && analysis.isGhost) {
                ghostAccounts.push(analysis);
                
                // Save to database
                await db.upsertGhostAccount({
                    accountId: analysis.accountId,
                    accountName: analysis.accountName,
                    totalExpiredProducts: analysis.totalExpiredProducts,
                    latestExpiryDate: analysis.latestExpiryDate
                });
            }
        }
        
        console.log(`✅ Ghost accounts identification complete: ${ghostAccounts.length} found out of ${analyzed} analyzed`);
        
        return {
            success: true,
            ghostAccounts: ghostAccounts,
            totalAnalyzed: analyzed,
            ghostCount: ghostAccounts.length
        };
        
    } catch (err) {
        console.error('❌ Error identifying ghost accounts:', err.message);
        return {
            success: false,
            error: err.message,
            ghostAccounts: []
        };
    }
}

/**
 * Get recently deprovisioned accounts
 * Accounts where all products expired AND deprovisioning happened within timeframe
 * 
 * NEW APPROACH: Query Salesforce directly for recent deprovisioning records,
 * then check if those accounts have all expired products
 */
async function getRecentlyDeprovisionedAccounts(daysBack = 30) {
    try {
        console.log(`📋 Finding accounts deprovisioned in last ${daysBack} days...`);
        
        const conn = await getConnection();
        const today = new Date();
        const cutoffDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        
        // Query all deprovisioning PS records within the timeframe
        const deprovQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c, Status__c, CreatedDate
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${cutoffDateStr}T00:00:00Z
            AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        console.log(`🔍 Querying ALL PS records since ${cutoffDateStr} to find deprovisioning...`);
        const allRecordsResult = await conn.query(deprovQuery);
        const allRecords = allRecordsResult.records || [];
        
        console.log(`📊 Found ${allRecords.length} total PS records in last ${daysBack} days`);
        
        // Show unique request types found
        const uniqueTypes = [...new Set(allRecords.map(r => r.TenantRequestAction__c).filter(t => t))];
        console.log(`   Available Request Types: ${uniqueTypes.join(', ')}`);
        
        // Filter for deprovisioning records (case-insensitive)
        const deprovRecords = allRecords.filter(record => {
            const requestType = (record.TenantRequestAction__c || '').toLowerCase();
            return requestType.includes('deprovision');
        });
        
        console.log(`📊 Found ${deprovRecords.length} deprovisioning records (filtered from ${allRecords.length} total)`);
        if (deprovRecords.length > 0) {
            console.log('   Sample deprovisioning records:');
            deprovRecords.slice(0, 5).forEach(r => {
                console.log(`     - ${r.Name}: ${r.TenantRequestAction__c} (${r.Account_Site__c})`);
            });
        }
        
        // Special debug: Look for PS-4853 specifically
        const ps4853 = allRecords.find(r => r.Name === 'PS-4853');
        if (ps4853) {
            console.log('   🔍 FOUND PS-4853:');
            console.log(`      Account_Site__c: ${ps4853.Account_Site__c}`);
            console.log(`      TenantRequestAction__c: "${ps4853.TenantRequestAction__c}"`);
            console.log(`      CreatedDate: ${ps4853.CreatedDate}`);
            console.log(`      Is it deprovisioning? ${(ps4853.TenantRequestAction__c || '').toLowerCase().includes('deprovision')}`);
        } else {
            console.log('   ⚠️  PS-4853 NOT FOUND in query results');
            console.log(`      Query date range: ${cutoffDateStr} to now`);
            console.log(`      Total records found: ${allRecords.length}`);
        }
        
        if (deprovRecords.length === 0) {
            return {
                success: true,
                deprovisionedAccounts: [],
                totalAnalyzed: 0,
                daysBack: daysBack,
                count: 0,
                message: 'No deprovisioning records found in timeframe'
            };
        }
        
        const deprovisionedAccounts = [];
        const processedAccounts = new Set(); // Avoid duplicates
        
        // For each deprovisioning record, check if the account has all expired products
        for (const deprovRecord of deprovRecords) {
            const accountId = deprovRecord.Account__c;
            
            // Skip if we already processed this account
            if (processedAccounts.has(accountId)) {
                continue;
            }
            processedAccounts.add(accountId);
            
            // Get all PS records for this account
            const accountQuery = `
                SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c,
                       Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
                FROM Prof_Services_Request__c
                WHERE Account__c = '${accountId}'
                ORDER BY CreatedDate DESC
                LIMIT 1000
            `;
            
            const accountResult = await conn.query(accountQuery);
            const accountRecords = accountResult.records || [];
            
            if (accountRecords.length === 0) continue;
            
            // Account__c already contains the account name (like "Citigroup Inc.")
            // NOT an Account ID - it's the actual account name stored in the field
            const accountName = accountId;
            
            console.log(`    ✅ Using Account__c as account name: "${accountName}"`);
            
            // Special focus on Intesa Sanpaolo
            const isIntesa = accountName.toLowerCase().includes('intesa');
            
            if (isIntesa) {
                console.log(`\n  🎯 ========== INTESA SANPAOLO FOUND (${deprovRecord.Name}) ==========`);
            } else {
                console.log(`\n  📌 Analyzing ${accountName} (deprovisioned by ${deprovRecord.Name})...`);
            }
            
            // Parse all entitlements to check if all expired
            let allExpired = true;
            let hasAnyEntitlement = false;
            let latestExpiryDate = null;
            let totalExpiredProducts = 0;
            
            for (const record of accountRecords) {
                const payload = parsePayloadData(record.Payload_Data__c);
                
                if (!payload || !payload.hasDetails) {
                    if (isIntesa) console.log(`    Record ${record.Name}: No payload data`);
                    continue;
                }
                
                const allEntitlements = [
                    ...(payload.modelEntitlements || []),
                    ...(payload.dataEntitlements || []),
                    ...(payload.appEntitlements || [])
                ];
                
                if (isIntesa && allEntitlements.length > 0) {
                    console.log(`    Record ${record.Name}: ${allEntitlements.length} entitlements found`);
                }
                
                for (const entitlement of allEntitlements) {
                    if (!entitlement.endDate) {
                        if (isIntesa) console.log(`      - ${entitlement.productCode || entitlement.name}: NO END DATE`);
                        continue;
                    }
                    
                    hasAnyEntitlement = true;
                    const endDate = new Date(entitlement.endDate);
                    
                    if (!latestExpiryDate || endDate > latestExpiryDate) {
                        latestExpiryDate = endDate;
                    }
                    
                    if (endDate >= today) {
                        allExpired = false;
                        console.log(`    ⚠️  Active product found: ${entitlement.productCode || entitlement.name} expires ${endDate.toISOString().split('T')[0]}`);
                    } else {
                        totalExpiredProducts++;
                        if (isIntesa) {
                            console.log(`      ✓ ${entitlement.productCode || entitlement.name}: expired ${endDate.toISOString().split('T')[0]}`);
                        }
                    }
                }
            }
            
            // Skip if no entitlements found
            if (!hasAnyEntitlement) {
                console.log(`    ⏭️  Skipping: No entitlements found`);
                continue;
            }
            
            // Skip if not all products are expired
            if (!allExpired) {
                console.log(`    ⏭️  Skipping: Has active entitlements (not a ghost)`);
                continue;
            }
            
            // Check if deprovisioning happened AFTER the latest expiry
            const deprovDate = new Date(deprovRecord.CreatedDate);
            const isAfterExpiry = deprovDate > latestExpiryDate;
            
            if (isIntesa) {
                console.log(`    📅 All ${totalExpiredProducts} products expired. Latest expiry: ${latestExpiryDate.toISOString()}`);
                console.log(`    📅 Deprovisioning date: ${deprovRecord.CreatedDate} (${deprovDate.toISOString()})`);
                console.log(`    📅 Comparison: deprovDate (${deprovDate.getTime()}) > latestExpiryDate (${latestExpiryDate.getTime()}) = ${isAfterExpiry}`);
            } else {
                console.log(`    📅 All ${totalExpiredProducts} products expired. Latest expiry: ${latestExpiryDate.toISOString().split('T')[0]}`);
                console.log(`    📅 Deprovisioned: ${deprovRecord.CreatedDate} (after expiry: ${isAfterExpiry})`);
            }
            
            if (!isAfterExpiry) {
                console.log(`    ⚠️  Skipping: Deprovisioning happened BEFORE products expired`);
                continue;
            }
            
            // This is a valid deprovisioned account!
            if (isIntesa) {
                console.log(`    ✅✅✅ INTESA SANPAOLO IS VALID - ADDING TO RESULTS ✅✅✅`);
            } else {
                console.log(`    ✅ VALID: Deprovisioned after all products expired`);
            }
            
            deprovisionedAccounts.push({
                accountId: accountId,
                accountName: accountName,
                totalExpiredProducts: totalExpiredProducts,
                latestExpiryDate: latestExpiryDate.toISOString().split('T')[0],
                deprovisioningRecord: {
                    id: deprovRecord.Id,
                    name: deprovRecord.Name,
                    createdDate: deprovRecord.CreatedDate,
                    status: deprovRecord.Status__c
                },
                daysSinceDeprovisioning: Math.floor((today - deprovDate) / (1000 * 60 * 60 * 24))
            });
        }
        
        console.log(`\n✅ Found ${deprovisionedAccounts.length} recently deprovisioned accounts (analyzed ${processedAccounts.size} unique accounts)`);
        
        return {
            success: true,
            deprovisionedAccounts: deprovisionedAccounts,
            totalAnalyzed: processedAccounts.size,
            daysBack: daysBack,
            count: deprovisionedAccounts.length
        };
        
    } catch (err) {
        console.error('❌ Error finding deprovisioned accounts:', err.message);
        return {
            success: false,
            error: err.message,
            deprovisionedAccounts: []
        };
    }
}

/**
 * Get MA Account IDs from Account object (now that we have access)
 * This is used to generate links to the MA Salesforce instance
 * @param {Array<string>} accountNames - Array of account names to look up
 * @returns {Object} - Map of account names to their MA Account IDs
 */
async function getAccountExternalIds(accountNames) {
    try {
        if (!accountNames || accountNames.length === 0) {
            return { success: true, accountIds: {} };
        }

        console.log(`🔍 Looking up MA Account IDs for ${accountNames.length} account(s)...`);
        
        const conn = await getConnection();
        
        // Step 1: Get PS records with Account_Salesforce_ID__c for each account
        // Account_Salesforce_ID__c is the Account object's Id
        const escapedNames = accountNames.map(name => 
            `'${name.replace(/'/g, "\\'")}'`
        ).join(', ');
        
        const psQuery = `
            SELECT Account__c, Account_Salesforce_ID__c, CreatedDate
            FROM Prof_Services_Request__c
            WHERE Account__c IN (${escapedNames})
            AND Account_Salesforce_ID__c != null
            AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        console.log(`📊 Step 1: Fetching PS records with Account_Salesforce_ID__c...`);
        const psResult = await conn.query(psQuery);
        const psRecords = psResult.records || [];
        
        console.log(`✅ Found ${psRecords.length} PS record(s) with Account IDs`);
        
        // Build map of account name to Account Id (use most recent)
        const accountToIdMap = {};
        psRecords.forEach(record => {
            const accountName = record.Account__c;
            if (!accountToIdMap[accountName] && record.Account_Salesforce_ID__c) {
                accountToIdMap[accountName] = record.Account_Salesforce_ID__c;
            }
        });
        
        // Step 2: Query Account object to get MA_AccountID__c
        const accountIds = Object.values(accountToIdMap);
        
        if (accountIds.length === 0) {
            console.log('⚠️  No Account IDs found for any accounts');
            return { success: true, accountIds: {} };
        }
        
        const escapedAccountIds = accountIds.map(id => `'${id}'`).join(', ');
        
        const accountQuery = `
            SELECT Id, Name, MA_AccountID__c
            FROM Account
            WHERE Id IN (${escapedAccountIds})
            AND MA_AccountID__c != null
        `;
        
        console.log(`📊 Step 2: Querying Account object for MA_AccountID__c...`);
        const accountResult = await conn.query(accountQuery);
        const accounts = accountResult.records || [];
        
        console.log(`✅ Found ${accounts.length} Account record(s) with MA_AccountID__c`);
        
        // Build map of Account Id to MA_AccountID__c
        const accountIdToMAIdMap = {};
        accounts.forEach(account => {
            if (account.MA_AccountID__c) {
                accountIdToMAIdMap[account.Id] = account.MA_AccountID__c;
                console.log(`   📌 ${account.Name} -> ${account.MA_AccountID__c}`);
            }
        });
        
        // Step 3: Map account names to MA Account IDs
        const accountIdsMap = {};
        Object.entries(accountToIdMap).forEach(([accountName, accountId]) => {
            if (accountIdToMAIdMap[accountId]) {
                accountIdsMap[accountName] = accountIdToMAIdMap[accountId];
                console.log(`   🔗 ${accountName} -> ${accountIdToMAIdMap[accountId]}`);
            } else {
                console.log(`   ⚠️  ${accountName} has no MA_AccountID__c`);
            }
        });
        
        // Log accounts that weren't found
        accountNames.forEach(name => {
            if (!accountIdsMap[name]) {
                console.log(`   ⚠️  ${name} has no MA Account ID`);
            }
        });
        
        return {
            success: true,
            accountIds: accountIdsMap
        };
        
    } catch (error) {
        console.error('❌ Error fetching MA Account IDs:', error.message);
        return {
            success: false,
            error: error.message,
            accountIds: {}
        };
    }
}

// ===== PACKAGE CHANGE ANALYSIS =====

/**
 * Helper function to extract PS record number from PS record name (e.g., "PS-4640" -> 4640)
 * @param {string} psRecordName - PS record name (e.g., "PS-4640")
 * @returns {number} PS record number
 */
function extractPsRecordNumber(psRecordName) {
    if (!psRecordName) return 0;
    const match = psRecordName.match(/PS-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Helper function to check if date ranges overlap for same product
 * @param {Array} apps - Array of app entitlements
 * @returns {boolean} True if overlapping dates found
 */
function hasOverlappingDates(apps) {
    // Group by product code
    const productGroups = {};
    
    apps.forEach(app => {
        const productCode = app.productCode || app.product_code || app.ProductCode;
        if (!productCode) return;
        
        if (!productGroups[productCode]) {
            productGroups[productCode] = [];
        }
        
        const startDate = app.startDate || app.start_date || app.StartDate;
        const endDate = app.endDate || app.end_date || app.EndDate;
        
        if (startDate && endDate) {
            productGroups[productCode].push({
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                packageName: app.packageName || app.package_name || app.PackageName
            });
        }
    });
    
    // Check each product group for overlaps
    for (const productCode in productGroups) {
        const entries = productGroups[productCode];
        
        // Only check if there are multiple entries for same product
        if (entries.length > 1) {
            for (let i = 0; i < entries.length; i++) {
                for (let j = i + 1; j < entries.length; j++) {
                    const entry1 = entries[i];
                    const entry2 = entries[j];
                    
                    // Check if ranges overlap
                    const overlap = (entry1.startDate <= entry2.endDate && entry1.endDate >= entry2.startDate);
                    
                    if (overlap) {
                        console.log(`⚠️ Overlapping dates found for ${productCode}: ${entry1.startDate} to ${entry1.endDate} overlaps with ${entry2.startDate} to ${entry2.endDate}`);
                        return true;
                    }
                }
            }
        }
    }
    
    return false;
}

/**
 * Compare two PS records for package changes
 * @param {Object} previousRecord - Previous PS record
 * @param {Object} currentRecord - Current PS record
 * @returns {Array} Array of package changes found
 */
function compareRecordsForPackageChanges(previousRecord, currentRecord) {
    const changes = [];
    const isDebugRecord = currentRecord.Name === 'PS-4741' || previousRecord.Name === 'PS-4741';
    
    try {
        // Parse payload data
        const previousPayload = parsePayloadData(previousRecord.Payload_Data__c);
        const currentPayload = parsePayloadData(currentRecord.Payload_Data__c);
        
        if (!previousPayload.hasDetails || !currentPayload.hasDetails) {
            if (isDebugRecord) {
                console.log(`🔍 DEBUG PS-4741: No payload details - Previous hasDetails=${previousPayload.hasDetails}, Current hasDetails=${currentPayload.hasDetails}`);
            } else {
                console.log(`⚠️ No payload details for comparison: Previous=${previousRecord.Name}, Current=${currentRecord.Name}`);
            }
            return changes;
        }
        
        // Get app entitlements
        const previousApps = previousPayload.appEntitlements || [];
        const currentApps = currentPayload.appEntitlements || [];
        
        if (isDebugRecord) {
            console.log(`🔍 DEBUG PS-4741: Previous apps count=${previousApps.length}, Current apps count=${currentApps.length}`);
        }
        
        // Note: Overlapping date validation is now done in the main loop before calling this function
        
        // Group apps by product code and find unique package names per product
        // This ensures we only count one change per product, not per app entitlement
        const previousAppsByProduct = {};
        previousApps.forEach(app => {
            const productCode = app.productCode || app.product_code || app.ProductCode;
            const packageName = app.packageName || app.package_name || app.PackageName;
            
            if (productCode && packageName) {
                if (!previousAppsByProduct[productCode]) {
                    previousAppsByProduct[productCode] = {
                        packages: new Set(),
                        sampleApp: app // Keep one sample for dates
                    };
                }
                previousAppsByProduct[productCode].packages.add(packageName);
            }
        });
        
        const currentAppsByProduct = {};
        currentApps.forEach(app => {
            const productCode = app.productCode || app.product_code || app.ProductCode;
            const packageName = app.packageName || app.package_name || app.PackageName;
            
            if (productCode && packageName) {
                if (!currentAppsByProduct[productCode]) {
                    currentAppsByProduct[productCode] = {
                        packages: new Set(),
                        sampleApp: app // Keep one sample for dates
                    };
                }
                currentAppsByProduct[productCode].packages.add(packageName);
            }
        });
        
        // Track which products have already been recorded to avoid duplicates
        const recordedProducts = new Set();
        
        // Compare products: only record ONE change per product code
        Object.keys(currentAppsByProduct).forEach(productCode => {
            // Skip if already recorded
            if (recordedProducts.has(productCode)) {
                return;
            }
            
            // Check if this product existed in previous record
            if (previousAppsByProduct[productCode]) {
                const previousPackages = previousAppsByProduct[productCode].packages;
                const currentPackages = currentAppsByProduct[productCode].packages;
                
                // Check if package names differ
                // If there's any difference in package sets, record it as a change
                const previousPackageList = Array.from(previousPackages);
                const currentPackageList = Array.from(currentPackages);
                
                // Find packages that are only in current (new packages)
                const newPackages = currentPackageList.filter(pkg => !previousPackages.has(pkg));
                // Find packages that are only in previous (removed packages)
                const removedPackages = previousPackageList.filter(pkg => !currentPackages.has(pkg));
                
                // If there are package changes, record the transition
                // Use the latest/highest package from each set for comparison
                let previousPackage, currentPackage;
                
                if (removedPackages.length > 0 && newPackages.length > 0) {
                    // Package changed: take the highest/latest from each
                    previousPackage = removedPackages.sort().reverse()[0]; // Reverse sort to get highest
                    currentPackage = newPackages.sort().reverse()[0];
                } else if (newPackages.length > 0) {
                    // Only new packages added (upgrade)
                    previousPackage = previousPackageList.sort().reverse()[0];
                    currentPackage = newPackages.sort().reverse()[0];
                } else if (removedPackages.length > 0) {
                    // Only packages removed (downgrade)
                    previousPackage = removedPackages.sort().reverse()[0];
                    currentPackage = currentPackageList.sort().reverse()[0];
                } else {
                    // No changes
                    previousPackage = null;
                    currentPackage = null;
                }
                
                if (previousPackage && currentPackage && previousPackage !== currentPackage) {
                    // Determine if upgrade or downgrade
                    const changeType = determineChangeType(previousPackage, currentPackage);
                    
                    const previousApp = previousAppsByProduct[productCode].sampleApp;
                    const currentApp = currentAppsByProduct[productCode].sampleApp;
                    const productName = currentApp.name || currentApp.productName || productCode;
                    
                    changes.push({
                        psRecordId: currentRecord.Id,
                        psRecordName: currentRecord.Name,
                        previousPsRecordId: previousRecord.Id,
                        previousPsRecordName: previousRecord.Name,
                        deploymentNumber: currentRecord.Deployment__r?.Name || currentRecord.Tenant_Name__c || 'Unknown',
                        accountId: currentRecord.Account__c,
                        accountName: currentRecord.Account__c || 'Unknown',
                        accountSite: currentRecord.Account_Site__c,
                        productCode: productCode,
                        productName: productName,
                        previousPackage: previousPackage,
                        newPackage: currentPackage,
                        changeType: changeType,
                        previousStartDate: previousApp.startDate || previousApp.start_date || previousApp.StartDate,
                        previousEndDate: previousApp.endDate || previousApp.end_date || previousApp.EndDate,
                        newStartDate: currentApp.startDate || currentApp.start_date || currentApp.StartDate,
                        newEndDate: currentApp.endDate || currentApp.end_date || currentApp.EndDate,
                        psCreatedDate: currentRecord.CreatedDate
                    });
                    
                    recordedProducts.add(productCode);
                    
                    console.log(`📦 Package change found: ${productCode} changed from ${previousPackage} → ${currentPackage} (${changeType}) in ${currentRecord.Name}`);
                }
            }
            // If product not in previous record, it's an addition, not a package change - skip
        });
        
    } catch (error) {
        console.error(`❌ Error comparing records ${previousRecord.Name} and ${currentRecord.Name}:`, error.message);
    }
    
    return changes;
}

/**
 * Determine if a package change is an upgrade or downgrade
 * @param {string} previousPackage - Previous package name
 * @param {string} newPackage - New package name
 * @returns {string} 'upgrade' or 'downgrade'
 */
function determineChangeType(previousPackage, newPackage) {
    // Extract numeric version if present
    const prevMatch = previousPackage.match(/\d+/);
    const newMatch = newPackage.match(/\d+/);
    
    if (prevMatch && newMatch) {
        const prevNum = parseInt(prevMatch[0], 10);
        const newNum = parseInt(newMatch[0], 10);
        
        if (newNum > prevNum) {
            return 'upgrade';
        } else if (newNum < prevNum) {
            return 'downgrade';
        }
    }
    
    // If we can't determine from numbers, check for common upgrade indicators
    const upgradeIndicators = ['premium', 'professional', 'enterprise', 'advanced', 'plus'];
    const downgradeIndicators = ['basic', 'starter', 'lite', 'standard'];
    
    const newLower = newPackage.toLowerCase();
    const prevLower = previousPackage.toLowerCase();
    
    for (const indicator of upgradeIndicators) {
        if (newLower.includes(indicator) && !prevLower.includes(indicator)) {
            return 'upgrade';
        }
    }
    
    for (const indicator of downgradeIndicators) {
        if (newLower.includes(indicator) && !prevLower.includes(indicator)) {
            return 'downgrade';
        }
    }
    
    // Default to upgrade if can't determine (most changes are upgrades)
    return 'upgrade';
}

/**
 * Analyze package changes across PS records
 * @param {number} lookbackYears - Number of years to look back (default: 2)
 * @param {Date} startDate - Optional start date override
 * @param {Date} endDate - Optional end date override
 * @returns {Promise<Object>} Analysis results
 */
async function analyzePackageChanges(lookbackYears = 2, startDate = null, endDate = null) {
    try {
        const conn = await getConnection();
        if (!conn) {
            throw new Error('No Salesforce connection available');
        }

        console.log(`📦 Starting package change analysis: ${lookbackYears} year lookback`);
        
        // Calculate date range
        let queryStartDate, queryEndDate;
        
        if (startDate && endDate) {
            queryStartDate = startDate;
            queryEndDate = endDate;
        } else {
            queryEndDate = new Date();
            queryStartDate = new Date();
            queryStartDate.setFullYear(queryEndDate.getFullYear() - lookbackYears);
        }
        
        const startDateStr = queryStartDate.toISOString().split('T')[0];
        const endDateStr = queryEndDate.toISOString().split('T')[0];
        
        // Query PS records with Status = "Tenant Request Completed"
        // We need both "Update" and "New" types (New can be previous, Update must be current)
        const query = `
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c,
                   Status__c, Deployment__c, Deployment__r.Name, Tenant_Name__c, 
                   CreatedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${startDateStr}T00:00:00Z
            AND CreatedDate <= ${endDateStr}T23:59:59Z
            AND Name LIKE 'PS-%'
            AND Status__c = 'Tenant Request Completed'
            ORDER BY Deployment__r.Name, Name ASC
            LIMIT 10000
        `;
        
        console.log(`🔍 Querying completed PS records from ${startDateStr} to ${endDateStr}...`);
        const result = await conn.query(query);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} completed PS records for analysis`);
        
        // Group records by deployment number (Deployment__r.Name)
        const recordsByDeployment = {};
        
        records.forEach(record => {
            // Try Deployment__r.Name first, fallback to Tenant_Name__c
            const deploymentNumber = record.Deployment__r?.Name || record.Tenant_Name__c;
            
            if (!deploymentNumber) {
                console.log(`⚠️ Skipping ${record.Name}: No deployment number`);
                return;
            }
            
            if (!recordsByDeployment[deploymentNumber]) {
                recordsByDeployment[deploymentNumber] = [];
            }
            
            recordsByDeployment[deploymentNumber].push(record);
        });
        
        console.log(`📊 Found ${Object.keys(recordsByDeployment).length} unique deployments`);
        
        // Analyze each deployment for package changes
        const allPackageChanges = [];
        let deploymentsProcessed = 0;
        let psRecordsWithChanges = new Set();
        let accountsAffected = new Set();
        
        for (const deploymentNumber in recordsByDeployment) {
            const deploymentRecords = recordsByDeployment[deploymentNumber];
            
            // Sort by PS record number (extract number from PS-####)
            deploymentRecords.sort((a, b) => {
                const numA = extractPsRecordNumber(a.Name);
                const numB = extractPsRecordNumber(b.Name);
                return numA - numB;
            });
            
            console.log(`🔍 Analyzing deployment ${deploymentNumber}: ${deploymentRecords.length} records (${deploymentRecords[0].Name} to ${deploymentRecords[deploymentRecords.length - 1].Name})`);
            
            // Track recent transitions for this deployment to avoid counting consecutive upgrades to the same package
            // Key: productCode, Value: {targetPackage, changeType, psRecordName}
            const recentTransitions = new Map();
            
            // Compare records, skipping invalid ones
            // Track last valid record to compare against
            let lastValidRecordIndex = 0;
            
            for (let i = 1; i < deploymentRecords.length; i++) {
                const currentRecord = deploymentRecords[i];
                
                // Debug logging for specific PS records
                const isDebugRecord = currentRecord.Name === 'PS-4741';
                
                // Current record must be Type "Update" (from TenantRequestAction__c)
                if (currentRecord.TenantRequestAction__c !== 'Update') {
                    if (isDebugRecord) {
                        console.log(`🔍 DEBUG PS-4741: Skipping ${currentRecord.Name}: Type is "${currentRecord.TenantRequestAction__c}", not "Update"`);
                    } else {
                        console.log(`⚠️ Skipping ${currentRecord.Name}: Type is "${currentRecord.TenantRequestAction__c}", not "Update"`);
                    }
                    continue;
                }
                
                // Check if current record is valid (no overlapping dates)
                const currentPayload = parsePayloadData(currentRecord.Payload_Data__c);
                const currentApps = currentPayload.appEntitlements || [];
                if (hasOverlappingDates(currentApps)) {
                    if (isDebugRecord) {
                        console.log(`🔍 DEBUG PS-4741: ⚠️ Skipping ${currentRecord.Name}: Has overlapping date ranges (invalid data)`);
                    } else {
                        console.log(`⚠️ Skipping ${currentRecord.Name}: Has overlapping date ranges (invalid data)`);
                    }
                    continue; // Skip invalid record entirely
                }
                
                // Find the last valid record to compare against
                // Start from current position and work backwards
                let previousRecord = null;
                for (let j = i - 1; j >= 0; j--) {
                    const candidateRecord = deploymentRecords[j];
                    const candidatePayload = parsePayloadData(candidateRecord.Payload_Data__c);
                    const candidateApps = candidatePayload.appEntitlements || [];
                    
                    // Check if candidate is valid (no overlapping dates)
                    if (!hasOverlappingDates(candidateApps)) {
                        previousRecord = candidateRecord;
                        lastValidRecordIndex = j;
                        break;
                    }
                }
                
                if (!previousRecord) {
                    if (isDebugRecord) {
                        console.log(`🔍 DEBUG PS-4741: No valid previous record found for comparison`);
                    } else {
                        console.log(`⚠️ ${currentRecord.Name}: No valid previous record found for comparison`);
                    }
                    continue;
                }
                
                // Previous record can be any type (New or Update)
                if (isDebugRecord) {
                    console.log(`🔍 DEBUG PS-4741: Comparing ${previousRecord.Name} (${previousRecord.TenantRequestAction__c}) → ${currentRecord.Name} (Update)`);
                } else {
                    console.log(`🔄 Comparing ${previousRecord.Name} (${previousRecord.TenantRequestAction__c}) → ${currentRecord.Name} (Update)`);
                }
                
                // Compare for package changes
                const changes = compareRecordsForPackageChanges(previousRecord, currentRecord);
                
                // Debug logging for specific PS records
                if (isDebugRecord) {
                    console.log(`🔍 DEBUG PS-4741: Found ${changes.length} package change(s)`);
                    if (changes.length === 0) {
                        console.log(`🔍 DEBUG PS-4741: No changes detected. Possible reasons:`);
                        console.log(`   - No matching products between records`);
                        console.log(`   - Package names are the same`);
                        console.log(`   - Package names are null`);
                        console.log(`   - Overlapping date ranges (invalid data)`);
                        console.log(`   - No payload data`);
                    } else {
                        changes.forEach((change, idx) => {
                            console.log(`🔍 DEBUG PS-4741: Change ${idx + 1}: ${change.productCode} ${change.previousPackage} → ${change.newPackage} (${change.changeType})`);
                        });
                    }
                }
                
                if (changes.length > 0) {
                    // Extract tenant name from payload (using multiple fallback locations like account history)
                    const currentPayloadParsed = parsePayloadData(currentRecord.Payload_Data__c);
                    const tenantName = currentPayloadParsed.properties?.provisioningDetail?.tenantName 
                        || currentPayloadParsed.properties?.tenantName 
                        || currentPayloadParsed.preferredSubdomain1
                        || currentPayloadParsed.preferredSubdomain2
                        || currentPayloadParsed.properties?.preferredSubdomain1
                        || currentPayloadParsed.properties?.preferredSubdomain2
                        || currentPayloadParsed.tenantName 
                        || currentRecord.Tenant_Name__c
                        || null;
                    
                    // Filter out consecutive upgrades to the same target package
                    // This prevents counting intermediate/partial upgrade states as separate changes
                    const filteredChanges = changes.filter(change => {
                        const productCode = change.productCode;
                        const recentTransition = recentTransitions.get(productCode);
                        
                        // If this is a consecutive transition to the same target package, skip it
                        if (recentTransition && 
                            recentTransition.targetPackage === change.newPackage && 
                            recentTransition.changeType === change.changeType) {
                            console.log(`⏭️  Skipping consecutive ${change.changeType}: ${productCode} ${change.previousPackage} → ${change.newPackage} in ${currentRecord.Name} (already transitioned to ${change.newPackage} in ${recentTransition.psRecordName})`);
                            return false; // Skip this change
                        }
                        
                        // Update recent transitions map
                        recentTransitions.set(productCode, {
                            targetPackage: change.newPackage,
                            changeType: change.changeType,
                            psRecordName: currentRecord.Name
                        });
                        
                        return true; // Keep this change
                    });
                    
                    // Only process if there are filtered changes
                    if (filteredChanges.length > 0) {
                        // Add tenant name to each change
                        const changesWithTenant = filteredChanges.map(change => ({
                            ...change,
                            tenantName: tenantName
                        }));
                        
                        psRecordsWithChanges.add(currentRecord.Name);
                        accountsAffected.add(currentRecord.Account__c);
                        allPackageChanges.push(...changesWithTenant);
                    }
                }
            }
            
            deploymentsProcessed++;
        }
        
        // Count upgrades and downgrades
        const upgradesFound = allPackageChanges.filter(c => c.changeType === 'upgrade').length;
        const downgradesFound = allPackageChanges.filter(c => c.changeType === 'downgrade').length;
        
        console.log(`✅ Package change analysis complete:`);
        console.log(`   - ${deploymentsProcessed} deployments processed`);
        console.log(`   - ${allPackageChanges.length} total package changes found`);
        console.log(`   - ${upgradesFound} upgrades, ${downgradesFound} downgrades`);
        console.log(`   - ${psRecordsWithChanges.size} PS records with changes`);
        console.log(`   - ${accountsAffected.size} accounts affected`);
        
        return {
            success: true,
            packageChanges: allPackageChanges,
            recordsAnalyzed: records.length,
            deploymentsProcessed: deploymentsProcessed,
            changesFound: allPackageChanges.length,
            upgradesFound: upgradesFound,
            downgradesFound: downgradesFound,
            psRecordsWithChanges: psRecordsWithChanges.size,
            accountsAffected: accountsAffected.size,
            startDate: startDateStr,
            endDate: endDateStr
        };
        
    } catch (err) {
        console.error('❌ Package change analysis error:', err.message);
        return {
            success: false,
            error: err.message,
            packageChanges: [],
            recordsAnalyzed: 0,
            changesFound: 0
        };
    }
}

module.exports = {
    getAuthUrl,
    handleOAuthCallback,
    getConnection,
    loadAuthFromDisk,
    saveAuthToDisk,
    clearAuthFromDisk,
    queryProfServicesRequests,
    getProfServicesRequestById,
    parsePayloadData,
    getProfServicesFilterOptions,
    searchTechnicalTeamRequests,
    searchAccounts,
    searchProvisioningData,
    hasValidAuthentication,
    getIdentity,
    testConnection,
    getWeeklyRequestTypeAnalytics,
    getPSRequestsWithRemovals,
    getValidationFailureTrend,
    // Expiration monitor functions
    analyzeExpirations,
    getExpiringEntitlements,
    // Package change analysis functions
    analyzePackageChanges,
    // Customer products
    getCustomerProducts,
    // Ghost accounts
    syncAllAccountsFromSalesforce,
    analyzeAccountForGhostStatus,
    identifyGhostAccounts,
    getRecentlyDeprovisionedAccounts,
    getAccountExternalIds
};
