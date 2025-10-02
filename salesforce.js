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
        
        let soql = `
            SELECT Id, Name, Account__c, Status__c, Deployment__c,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   Request_Type_RI__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   CreatedDate, LastModifiedDate
            FROM Prof_Services_Request__c 
            WHERE Name LIKE 'PS-%'
        `;
        
        // Add filters
        if (filters.startDate) {
            soql += ` AND CreatedDate >= ${filters.startDate}`;
        }
        if (filters.endDate) {
            soql += ` AND CreatedDate <= ${filters.endDate}`;
        }
        if (filters.requestType) {
            soql += ` AND Request_Type_RI__c = '${filters.requestType.replace(/'/g, "\\'")}'`;
        }
        if (filters.status) {
            soql += ` AND Status__c = '${filters.status.replace(/'/g, "\\'")}'`;
        }
        if (filters.search) {
            soql += ` AND (Name LIKE '%${filters.search.replace(/'/g, "\\'")}%' OR Account__c LIKE '%${filters.search.replace(/'/g, "\\'")}%')`;
        }
        
        soql += ` ORDER BY CreatedDate DESC LIMIT ${pageSize} OFFSET ${offset}`;
        
        console.log('📊 Executing SOQL for Prof Services Requests:', soql);
        const result = await conn.query(soql);
        console.log('✅ SOQL executed successfully, found records:', result.records.length);
        
        // Get total count for pagination (separate query without LIMIT/OFFSET)
        let countSoql = `
            SELECT COUNT() 
            FROM Prof_Services_Request__c 
            WHERE Name LIKE 'PS-%'
        `;
        
        // Add same filters to count query
        if (filters.startDate) {
            countSoql += ` AND CreatedDate >= ${filters.startDate}`;
        }
        if (filters.endDate) {
            countSoql += ` AND CreatedDate <= ${filters.endDate}`;
        }
        if (filters.requestType) {
            countSoql += ` AND Request_Type_RI__c = '${filters.requestType.replace(/'/g, "\\'")}'`;
        }
        if (filters.status) {
            countSoql += ` AND Status__c = '${filters.status.replace(/'/g, "\\'")}'`;
        }
        if (filters.search) {
            countSoql += ` AND (Name LIKE '%${filters.search.replace(/'/g, "\\'")}%' OR Account__c LIKE '%${filters.search.replace(/'/g, "\\'")}%')`;
        }
        
        const countResult = await conn.query(countSoql);
        const totalCount = countResult.totalSize;
        
        // Process the results to parse JSON payload
        const processedRecords = result.records.map(record => ({
            ...record,
            parsedPayload: parsePayloadData(record.Payload_Data__c)
        }));
        
        const hasMore = (offset + pageSize) < totalCount;
        const currentPage = Math.floor(offset / pageSize) + 1;
        const totalPages = Math.ceil(totalCount / pageSize);
        
        console.log(`✅ Found ${processedRecords.length} records (page ${currentPage} of ${totalPages}, ${offset + 1}-${offset + processedRecords.length} of ${totalCount})`);
        
        return {
            success: true,
            records: processedRecords,
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
            SELECT Id, Name, Account__c, Status__c, Request_Type_RI__c, CreatedDate
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
                requestType: record.Request_Type_RI__c,
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
            SELECT Id, Name, Account__c, Status__c, Deployment__c,
                   Account_Site__c, Billing_Status__c, RecordTypeId,
                   Request_Type_RI__c, Payload_Data__c,
                   Requested_Install_Date__c, RequestedGoLiveDate__c,
                   CreatedDate, LastModifiedDate
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
        return {
            success: true,
            record: {
                ...record,
                parsedPayload: parsePayloadData(record.Payload_Data__c)
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
        
        return {
            productEntitlements: allModelEntitlements, // Keep for backward compatibility
            modelEntitlements: allModelEntitlements,
            dataEntitlements: allDataEntitlements,
            appEntitlements: allAppEntitlements,
            totalCount,
            summary,
            hasDetails: totalCount > 0,
            rawPayload: payload,
            tenantName: payload.properties?.provisioningDetail?.tenantName,
            region: payload.properties?.provisioningDetail?.region
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
            SELECT Request_Type_RI__c 
            FROM Prof_Services_Request__c 
            WHERE Request_Type_RI__c != null 
            GROUP BY Request_Type_RI__c 
            ORDER BY Request_Type_RI__c 
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
        
        return {
            success: true,
            requestTypes: requestTypeResult.records.map(r => r.Request_Type_RI__c).filter(Boolean),
            statuses: statusResult.records.map(r => r.Status__c).filter(Boolean),
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
            SELECT Request_Type_RI__c 
            FROM Prof_Services_Request__c 
            WHERE Request_Type_RI__c != null 
            GROUP BY Request_Type_RI__c 
            ORDER BY Request_Type_RI__c
        `;

        // Then, get all records for the specific time period (need full records for validation)
        // Match the same query pattern as /api/validation/errors endpoint
        const analyticsQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, Request_Type_RI__c, 
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c 
            WHERE CreatedDate >= ${startDateStr}T00:00:00.000Z 
            AND CreatedDate <= ${endDateStr}T23:59:59.999Z
            AND Name LIKE 'PS-%'
            AND Request_Type_RI__c != null 
            ORDER BY Request_Type_RI__c, CreatedDate DESC
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
            const requestType = record.Request_Type_RI__c;
            
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
            const requestType = record.Request_Type_RI__c;
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

// Get validation failure trend for Update, Onboarding, and Deprovision requests over time
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
        
        // Get all Update, Onboarding, and Deprovision requests for the extended period
        const query = `
            SELECT Id, Name, Request_Type_RI__c, Payload_Data__c, CreatedDate
            FROM Prof_Services_Request__c 
            WHERE CreatedDate >= ${startDateStr}T00:00:00.000Z 
            AND CreatedDate <= ${endDateStr}T23:59:59.999Z
            AND Name LIKE 'PS-%'
            AND (Request_Type_RI__c = 'Update' OR Request_Type_RI__c = 'Onboarding' OR Request_Type_RI__c = 'Deprovision')
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
            'Onboarding': [],
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
            
            const requestType = record.Request_Type_RI__c;
            if (validatedRecordsByType[requestType]) {
                validatedRecordsByType[requestType].push({
                    createdDate: new Date(record.CreatedDate),
                    failed: failed
                });
            }
        });
        
        console.log(`✅ Validated ${records.length} records: Update=${validatedRecordsByType['Update'].length}, Onboarding=${validatedRecordsByType['Onboarding'].length}, Deprovision=${validatedRecordsByType['Deprovision'].length}`);
        
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
            ['Update', 'Onboarding', 'Deprovision'].forEach(requestType => {
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
        
        console.log(`✅ Trend data calculated: ${trendData.length} daily data points with rolling annual percentages for Update, Onboarding, and Deprovision`);
        
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
            SELECT Id, Name, Account__c, Status__c, Request_Type_RI__c,
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
                                    requestType: currentRequest.Request_Type_RI__c,
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
        const query = `
            SELECT Id, Name, Account__c, Account_Site__c, Request_Type_RI__c,
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
                                accountName: record.Account_Site__c || record.Account__c,
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
                                accountName: record.Account_Site__c || record.Account__c,
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
                                accountName: record.Account_Site__c || record.Account__c,
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
        const today = new Date();
        const expirationThreshold = new Date();
        expirationThreshold.setDate(expirationThreshold.getDate() + expirationWindow);
        
        for (const [accountId, accountEntitlements] of byAccount) {
            // Group by product code within account
            const byProductCode = new Map();
            accountEntitlements.forEach(ent => {
                if (!byProductCode.has(ent.productCode)) {
                    byProductCode.set(ent.productCode, []);
                }
                byProductCode.get(ent.productCode).push(ent);
            });
            
            // For each product code, check for expirations and extensions
            for (const [productCode, entitlements] of byProductCode) {
                // Sort by end date
                entitlements.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
                
                for (let i = 0; i < entitlements.length; i++) {
                    const current = entitlements[i];
                    const currentEndDate = new Date(current.endDate);
                    
                    // Check if this entitlement is expiring within the window
                    if (currentEndDate >= today && currentEndDate <= expirationThreshold) {
                        // Calculate days until expiry
                        const daysUntilExpiry = Math.ceil((currentEndDate - today) / (1000 * 60 * 60 * 24));
                        
                        // Look for extensions (same product code, later end date, different PS record)
                        const extension = entitlements.find(e => 
                            e.psRecordId !== current.psRecordId &&
                            new Date(e.endDate) > currentEndDate
                        );
                        
                        if (extension) {
                            extensionsFound++;
                        }
                        
                        expiringItems.push({
                            accountId: current.accountId,
                            accountName: current.accountName,
                            psRecordId: current.psRecordId,
                            psRecordName: current.psRecordName,
                            productCode: current.productCode,
                            productName: current.productName,
                            productType: current.productType,
                            endDate: current.endDate,
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
        
        console.log(`✅ Analysis complete: ${expiringItems.length} expirations found, ${extensionsFound} extensions detected`);
        
        return {
            success: true,
            recordsAnalyzed: records.length,
            entitlementsProcessed: entitlementsProcessed,
            expirationsFound: expiringItems.length,
            extensionsFound: extensionsFound,
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
 * @param {boolean} showExtended - Whether to include extended items
 * @returns {Promise<Object>} Grouped expiration data
 */
async function getExpiringEntitlements(expirationWindow = 30, showExtended = true) {
    try {
        const db = require('./database');
        
        // Get expiration data from cache
        const result = await db.getExpirationData({
            expirationWindow: expirationWindow,
            showExtended: showExtended
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
                    status: 'extended' // Default to extended, will be updated if any at-risk found
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
            
            // Update earliest expiry
            if (new Date(item.end_date) < new Date(group.earliestExpiry)) {
                group.earliestExpiry = item.end_date;
            }
            
            // Update status - if ANY product is not extended, mark entire group as at-risk
            if (!item.is_extended) {
                group.status = 'at-risk';
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
            SELECT Id, Name, Account__c, Account_Site__c, Request_Type_RI__c,
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
    // Customer products
    getCustomerProducts
};
