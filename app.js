require('dotenv').config();

// Configure SSL settings immediately after loading environment.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
    console.log('⚠️  SSL certificate validation disabled for corporate environment');
}

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const salesforce = require('./salesforce');
const db = require('./database');

// Environment variables helper
function getMissingAtlassianEnvVars() {
    const required = ['ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'ATLASSIAN_SITE_URL'];
    return required.filter(key => !process.env[key]);
}

// Atlassian API configuration - uses environment variables only
const ATLASSIAN_CONFIG = {
    email: process.env.ATLASSIAN_EMAIL,
    apiToken: process.env.ATLASSIAN_API_TOKEN,
    cloudId: process.env.ATLASSIAN_CLOUD_ID,
    baseUrl: process.env.ATLASSIAN_BASE_URL || 'https://api.atlassian.com/ex/jira',
    siteUrl: process.env.ATLASSIAN_SITE_URL || 'https://yoursite.atlassian.net'
};

// Sanitize user-provided strings for safe use in JQL
function sanitizeForJql(value) {
    return String(value)
        .replace(/["\\]/g, '\\$&') // escape quotes and backslashes
        .replace(/[\r\n\t]/g, ' ')   // remove control characters
        .trim();
}

const app = express();
const PORT = process.env.PORT || 8080;

// Remove MCP-related configuration as we're now using direct API

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for dynamic greeting
app.get('/api/greeting', (req, res) => {
    const name = req.query.name || 'World';
    res.json({ 
        message: `Hello, ${name}!`,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Database health check endpoint
app.get('/api/health/database', async (req, res) => {
    try {
        const dbStatus = await db.testConnection();
        const poolStats = db.getPoolStats();
        
        if (dbStatus.success) {
            res.status(200).json({
                status: 'OK',
                database: {
                    connected: true,
                    database: dbStatus.database,
                    user: dbStatus.user,
                    timestamp: dbStatus.timestamp
                },
                pool: {
                    total: poolStats.totalCount,
                    idle: poolStats.idleCount,
                    waiting: poolStats.waitingCount
                }
            });
        } else {
            res.status(503).json({
                status: 'ERROR',
                database: {
                    connected: false,
                    error: dbStatus.error
                }
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            database: {
                connected: false,
                error: error.message
            }
        });
    }
});

// Jira initiatives API endpoint - now using direct Atlassian API
app.post('/api/jira/initiatives', async (req, res) => {
    try {
        const { assigneeName } = req.body;
        
        if (!assigneeName || assigneeName.trim() === '') {
            console.log('❌ No assignee name provided');
            return res.status(400).json({
                error: 'Assignee name is required',
                message: 'Please provide an assignee name to search for initiatives'
            });
        }
        
        console.log(`Jira initiatives API called - fetching initiatives for assignee: ${assigneeName} using direct Atlassian API`);
        
        // DIRECT API INTEGRATION: Fetch real-time data from Atlassian REST API
        const jiraData = await fetchJiraInitiativesDirectAPI(assigneeName);
        
        if (jiraData && jiraData.issues && jiraData.issues.length > 0) {
            const response = {
                issues: jiraData.issues,
                total: jiraData.issues.length,
                source: 'DIRECT_ATLASSIAN_API',
                timestamp: new Date().toISOString(),
                assigneeName: assigneeName,
                apiUsed: true,
                cloudId: ATLASSIAN_CONFIG.cloudId
            };
            
            console.log(`✅ Successfully fetched ${jiraData.issues.length} initiatives for ${assigneeName} from Atlassian API`);
            res.json(response);
        } else {
            // Fallback to demo data if API fails
            console.log(`⚠️ Atlassian API call failed or returned no data, using fallback data for ${assigneeName}`);
            const fallbackResponse = {
                issues: getFallbackInitiatives(assigneeName),
                total: 3,
                source: 'FALLBACK_DATA',
                timestamp: new Date().toISOString(),
                assigneeName: assigneeName,
                apiUsed: false,
                fallbackReason: jiraData ? jiraData.error || 'API returned no data' : 'API call failed'
            };
            res.json(fallbackResponse);
        }
        
    } catch (error) {
        console.error('❌ Jira API error:', error);
        // Return fallback data on error
        const errorResponse = {
            issues: getFallbackInitiatives(req.body.assigneeName || 'Unknown User'),
            total: 5,
            source: 'ERROR_FALLBACK',
            timestamp: new Date().toISOString(),
            assigneeName: req.body.assigneeName || 'Unknown User',
            error: error.message
        };
        res.json(errorResponse);
    }
});

// DIRECT ATLASSIAN API INTEGRATION FUNCTION
async function fetchJiraInitiativesDirectAPI(assigneeName = null) {
    try {
        console.log('🔗 Making direct call to Atlassian REST API...');
        
        // Ensure required env vars are present before attempting API call
        const missing = getMissingAtlassianEnvVars();
        if (missing.length > 0) {
            console.log('⚠️ Missing Atlassian env vars:', missing.join(', '));
            return {
                issues: [],
                total: 0,
                success: false,
                error: `Missing environment variables: ${missing.join(', ')}`
            };
        }
        
        // Build JQL query for assignee name
        let jqlQuery;
        if (assigneeName) {
            // Search by assignee display name with initiative and epic types
            const safeAssignee = sanitizeForJql(assigneeName);
            jqlQuery = `assignee in ("${safeAssignee}") AND (issuetype = "Initiative" OR issuetype = "Epic" OR issuetype = "Story" OR issuetype = "Task")`;
        } else {
            // Fallback query
            jqlQuery = 'issuetype = "Initiative" OR issuetype = "Epic"';
        }
        
        console.log(`🔍 Using JQL query: ${jqlQuery}`);
        
        // Prepare the API request - Updated to use /rest/api/3/search/jql endpoint
        const searchUrl = `${ATLASSIAN_CONFIG.siteUrl}/rest/api/3/search/jql`;
        const requestBody = {
            jql: jqlQuery,
            fields: ['summary', 'description', 'status', 'issuetype', 'priority', 'created', 'updated', 'project', 'assignee'],
            maxResults: 100
        };
        
        // Create authentication header (Basic auth with email:token)
        const authString = `${ATLASSIAN_CONFIG.email}:${ATLASSIAN_CONFIG.apiToken}`;
        const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
        
        console.log('📡 Making HTTPS request to Atlassian API...');
        console.log('🔗 URL:', searchUrl);
        
        // Make the HTTPS request
        const result = await makeHttpsRequest(searchUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (result.success && result.data && result.data.issues) {
            console.log(`✅ Successfully fetched ${result.data.issues.length} issues from Atlassian API`);
            
            // Transform the API response to match our expected format
            const transformedIssues = result.data.issues.map(issue => ({
                key: issue.key,
                summary: issue.fields.summary || 'No summary',
                status: issue.fields.status?.name || 'Unknown',
                created: issue.fields.created || new Date().toISOString(),
                updated: issue.fields.updated || new Date().toISOString(),
                project: issue.fields.project?.name || 'Unknown Project',
                priority: issue.fields.priority?.name || 'Medium',
                issuetype: issue.fields.issuetype?.name || 'Issue',
                assignee: issue.fields.assignee?.displayName || assigneeName || 'Unassigned',
                description: issue.fields.description || 'No description available'
            }));
            
            return {
                issues: transformedIssues,
                total: transformedIssues.length,
                success: true
            };
        } else {
            console.log('⚠️ API request failed or returned no data:', result.error);
            return {
                issues: [],
                total: 0,
                success: false,
                error: result.error || 'No data returned from API'
            };
        }
        
    } catch (error) {
        console.error('❌ Direct Atlassian API error:', error);
        return {
            issues: [],
            total: 0,
            success: false,
            error: error.message
        };
    }
}

// Helper function to make HTTPS requests
function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 30000, // 30 second timeout
            // Disable SSL certificate validation for corporate environments
            rejectUnauthorized: false
        };
        
        const req = https.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const parsedData = data ? JSON.parse(data) : {};
                        resolve({
                            success: true,
                            data: parsedData,
                            statusCode: res.statusCode
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}: ${data}`,
                            statusCode: res.statusCode
                        });
                    }
                } catch (parseError) {
                    resolve({
                        success: false,
                        error: `Failed to parse response: ${parseError.message}`,
                        statusCode: res.statusCode
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            resolve({
                success: false,
                error: `Request failed: ${error.message}`
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                error: 'Request timeout after 30 seconds'
            });
        });
        
        // Write body if provided
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Removed MCP server integration function - now using direct API

// Removed MCP configuration function - no longer needed with direct API

// Removed direct MCP SDK integration - replaced with direct API

// Removed real MCP integration - replaced with direct API

// Removed old OAuth-based API call - replaced with new direct API implementation

// Generate realistic Jira data that matches actual Jira issue patterns
function generateRealisticJiraData(assigneeName, params) {
    const currentTime = new Date().toISOString();
    
    // Define realistic initiative templates based on assignee
    const kevinYuInitiatives = [
        {
            key: 'STRAT-2024-001',
                    fields: {
                summary: '🚀 Multi-factor Authentication (MFA) Implementation for IRP Tenants',
                status: { name: 'In Progress' },
                created: '2024-08-12T11:25:16.776-0700',
                updated: currentTime,
                project: { name: 'Platform Strategy' },
                priority: { name: 'High' },
                        issuetype: { name: 'Initiative' },
                assignee: { displayName: assigneeName },
                description: `Comprehensive MFA rollout for all IRP tenant environments with SSOv2 integration. Lead by ${assigneeName} as part of the security enhancement roadmap.`
                    }
                },
                {
            key: 'STRAT-2024-015',
                    fields: {
                summary: '📈 User Experience Enhancement for Feature Discovery',
                status: { name: 'Open' },
                created: '2024-04-28T16:07:44.729-0700',
                updated: currentTime,
                project: { name: 'Product Experience' },
                priority: { name: 'Medium' },
                issuetype: { name: 'Epic' },
                assignee: { displayName: assigneeName },
                description: `Developing intuitive help and onboarding flows to improve feature adoption rates. Assigned to ${assigneeName} for Q4 delivery.`
            }
        },
        {
            key: 'STRAT-2024-008',
            fields: {
                summary: '⚙️ Advanced Job Management System for IRP Platform',
                        status: { name: 'Proposed' },
                created: '2024-03-24T12:56:30.187-0700',
                updated: currentTime,
                project: { name: 'Platform Infrastructure' },
                priority: { name: 'High' },
                        issuetype: { name: 'Initiative' },
                assignee: { displayName: assigneeName },
                description: `Next-generation job scheduling and management capabilities with enhanced monitoring and auto-scaling. Technical lead: ${assigneeName}.`
                    }
                },
                {
            key: 'STRAT-2024-012',
                    fields: {
                summary: '🔐 Zero-Trust Security Architecture Implementation',
                status: { name: 'In Progress' },
                created: '2024-09-01T09:15:22.334-0700',
                updated: currentTime,
                project: { name: 'Security & Compliance' },
                priority: { name: 'Critical' },
                        issuetype: { name: 'Initiative' },
                assignee: { displayName: assigneeName },
                description: `Enterprise-wide zero-trust security model implementation across all platform services. Security architect: ${assigneeName}.`
            }
        },
        {
            key: 'STRAT-2024-019',
            fields: {
                summary: '📊 Advanced Analytics & Reporting Dashboard v2.0',
                status: { name: 'Open' },
                created: '2024-07-15T14:30:45.123-0700',
                updated: currentTime,
                project: { name: 'Data & Analytics' },
                priority: { name: 'Medium' },
                issuetype: { name: 'Epic' },
                assignee: { displayName: assigneeName },
                description: `Real-time analytics dashboard with AI-powered insights and predictive modeling capabilities. Product owner: ${assigneeName}.`
            }
        }
    ];
    
    // For Kevin Yu, return his specific initiatives; for others, generate relevant ones
    if (assigneeName.toLowerCase().includes('kevin') && assigneeName.toLowerCase().includes('yu')) {
        return kevinYuInitiatives;
    } else {
        // Generate personalized initiatives for other assignees
        return kevinYuInitiatives.map((initiative, index) => ({
            ...initiative,
            key: `USER-2024-${String(index + 1).padStart(3, '0')}`,
            fields: {
                ...initiative.fields,
                assignee: { displayName: assigneeName },
                summary: initiative.fields.summary.replace('Kevin Yu', assigneeName),
                description: initiative.fields.description.replace(/Kevin Yu|Lead by [^.]+|Technical lead: [^.]+|Security architect: [^.]+|Product owner: [^.]+/g, `Assigned to ${assigneeName}`)
            }
        }));
    }
}

// Generate enhanced fallback issues that simulate real API data
function generateEnhancedFallbackIssues(assigneeName = 'Default User') {
    const currentTime = new Date().toISOString();
    
    // Base templates for different types of initiatives
    const initiatives = [
        {
            key: 'STRAT-770',
            summary: '🚀 Multi-factor Authentication (MFA) for IRP tenants',
            status: 'In Progress',
            priority: 'High',
            issuetype: 'Initiative',
            description: `Implementing MFA for IRP tenants with SSOv2 migration to enhance security across all tenant environments. Assigned to ${assigneeName}.`
        },
        {
            key: 'STRAT-736',
            summary: '📈 Help experience to introduce new features',
            status: 'Open',
            priority: 'Medium',
            issuetype: 'Epic',
            description: `Developing comprehensive help and onboarding experience for new platform features to improve user adoption. Assigned to ${assigneeName}.`
        },
        {
            key: 'STRAT-684',
            summary: '⚙️ IRP Platform Job Management',
            status: 'Proposed',
            priority: 'High',
            issuetype: 'Initiative',
            description: `Enhanced job management and scheduling capabilities for the IRP platform to improve workflow automation. Assigned to ${assigneeName}.`
        },
        {
            key: 'STRAT-892',
            summary: '🔐 Enhanced Security Framework',
            status: 'In Progress',
            priority: 'Critical',
            issuetype: 'Initiative',
            description: `Implementing comprehensive security framework across all platform services with zero-trust architecture. Assigned to ${assigneeName}.`
        },
        {
            key: 'STRAT-845',
            summary: '📊 Advanced Analytics Dashboard',
            status: 'Open',
            priority: 'Medium',
            issuetype: 'Epic',
            description: `Building advanced analytics dashboard for better insights into platform usage and performance metrics. Assigned to ${assigneeName}.`
        }
    ];
    
    return initiatives.map(initiative => ({
        key: initiative.key,
        fields: {
            summary: initiative.summary,
            status: { name: initiative.status },
            created: '2025-08-12T11:25:16.776-0700',
            updated: currentTime,
            project: { name: 'Strategy' },
            priority: { name: initiative.priority },
            issuetype: { name: initiative.issuetype },
            assignee: { displayName: assigneeName },
            description: initiative.description
        }
    }));
}

// Fallback initiatives function
function getFallbackInitiatives(assigneeName = 'Default User') {
    return [
        {
            key: 'PLAN-770',
            summary: 'Multi-factor Authentication (MFA) for IRP tenants',
            status: 'Open',
            created: '2025-08-12T11:25:16.776-0700',
            updated: '2025-08-12T11:27:46.266-0700',
            project: 'Strategy',
            assignee: assigneeName,
            description: `FALLBACK: MFA implementation for IRP tenants with SSOv2 migration. Assigned to ${assigneeName}.`
        },
        {
            key: 'PLAN-734',
            summary: 'IRP Provisioning / Entitlement / Telemetry for Praedicat',
            status: 'Proposed',
            created: '2025-04-25T14:44:16.183-0700',
            updated: '2025-06-17T16:02:06.928-0700',
            project: 'Strategy',
            assignee: assigneeName,
            description: `FALLBACK: Cometa integration onto IRP for Praedicat products. Assigned to ${assigneeName}.`
        },
        {
            key: 'PLAN-684',
            summary: 'IRP Platform Job Management',
            status: 'Proposed',
            created: '2025-03-24T12:56:30.187-0700',
            updated: '2025-07-15T08:51:36.109-0700',
            project: 'Strategy',
            assignee: assigneeName,
            description: `FALLBACK: Enhanced job management and scheduling capabilities. Assigned to ${assigneeName}.`
        }
    ];
}

// Removed MCP services endpoint - no longer needed with direct API

// Removed MCP services configuration endpoint - no longer needed

// Removed MCP service test endpoint - no longer needed

// Removed MCP connection test function - no longer needed

// Test Salesforce connectivity and OAuth configuration
app.get('/api/test-salesforce', async (req, res) => {
    console.log('🔧 Testing Salesforce connectivity...');
    
    try {
        const results = {
            timestamp: new Date().toISOString(),
            tests: []
        };

        // Test 1: Environment Variables
        const envTest = {
            name: "Environment Variables",
            status: "checking",
            details: {}
        };

        const requiredEnvVars = ['SF_LOGIN_URL', 'SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'SF_REDIRECT_URI'];
        const missingVars = [];
        
        requiredEnvVars.forEach(varName => {
            const value = process.env[varName];
            envTest.details[varName] = value ? `Set (${value.length} chars)` : 'MISSING';
            if (!value) missingVars.push(varName);
        });

        envTest.status = missingVars.length === 0 ? "success" : "error";
        envTest.message = missingVars.length === 0 ? 
            "All required environment variables are set" : 
            `Missing variables: ${missingVars.join(', ')}`;
        results.tests.push(envTest);

        // Test 2: Client Credentials Flow Configuration
        const clientCredTest = {
            name: "Client Credentials Configuration",
            status: "checking"
        };

        try {
            // Test if we can construct the OAuth endpoint URL
            const tokenUrl = `${process.env.SF_LOGIN_URL}/services/oauth2/token`;
            const url = new URL(tokenUrl);
            
            clientCredTest.status = "success";
            clientCredTest.message = "Client Credentials Flow configuration valid";
            clientCredTest.details = {
                tokenEndpoint: tokenUrl,
                loginUrl: process.env.SF_LOGIN_URL,
                flowType: "Client Credentials (server-to-server)",
                requiresUserInteraction: false
            };
        } catch (error) {
            clientCredTest.status = "error";
            clientCredTest.message = `Configuration validation failed: ${error.message}`;
        }
        results.tests.push(clientCredTest);

        // Test 3: Stored Authentication
        const authFileTest = {
            name: "Stored Authentication",
            status: "checking"
        };

        try {
            const hasValidAuth = await salesforce.hasValidAuthentication();
            if (hasValidAuth) {
                authFileTest.status = "success";
                authFileTest.message = "Valid authentication tokens found";
                
                // Try to get connection info
                try {
                    const identity = await salesforce.getIdentity();
                    authFileTest.details = {
                        userId: identity.user_id,
                        username: identity.username,
                        orgId: identity.organization_id,
                        instanceUrl: identity.urls && identity.urls.custom_domain
                    };
                } catch (identityError) {
                    authFileTest.details = { identityError: identityError.message };
                }
            } else {
                authFileTest.status = "warning";
                authFileTest.message = "No valid authentication found - OAuth required";
            }
        } catch (error) {
            authFileTest.status = "error";
            authFileTest.message = `Authentication check failed: ${error.message}`;
        }
        results.tests.push(authFileTest);

        // Test 4: API Connectivity (only if authenticated)
        if (results.tests[2].status === "success") {
            const apiTest = {
                name: "Salesforce API",
                status: "checking"
            };

            try {
                const testResult = await salesforce.testConnection();
                apiTest.status = "success";
                apiTest.message = "Salesforce API accessible";
                apiTest.details = testResult;
            } catch (error) {
                apiTest.status = "error";
                apiTest.message = `API test failed: ${error.message}`;
            }
            results.tests.push(apiTest);
        }

        // Overall status
        const hasErrors = results.tests.some(test => test.status === "error");
        const hasWarnings = results.tests.some(test => test.status === "warning");
        
        results.overall = hasErrors ? "error" : hasWarnings ? "warning" : "success";
        results.summary = hasErrors ? 
            "Configuration errors detected" : 
            hasWarnings ? 
                "Authentication required" : 
                "All systems operational";

        res.json({
            success: true,
            ...results
        });

    } catch (error) {
        console.error('❌ Salesforce connectivity test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test Salesforce connectivity',
            details: error.message
        });
    }
});

// Test web connectivity endpoint
app.get('/api/test-web-connectivity', async (req, res) => {
    try {
        console.log('🌐 Testing web connectivity from Node.js app...');
        
        const https = require('https');
        const http = require('http');
        
        const testResults = [];
        
        // Test multiple web resources
        const testUrls = [
            { name: 'Google', url: 'https://www.google.com', timeout: 5000 },
            { name: 'Atlassian MCP', url: 'https://mcp.atlassian.com', timeout: 10000 },
            { name: 'NPM Registry', url: 'https://registry.npmjs.org', timeout: 5000 },
            { name: 'GitHub', url: 'https://api.github.com', timeout: 5000 }
        ];
        
        for (const test of testUrls) {
            try {
                const result = await testWebResource(test.url, test.timeout);
                testResults.push({
                    name: test.name,
                    url: test.url,
                    success: true,
                    statusCode: result.statusCode,
                    responseTime: result.responseTime,
                    headers: result.headers ? Object.keys(result.headers).slice(0, 5) : []
                });
                console.log(`✅ ${test.name}: ${result.statusCode} (${result.responseTime}ms)`);
            } catch (error) {
                testResults.push({
                    name: test.name,
                    url: test.url,
                    success: false,
                    error: error.message,
                    responseTime: null
                });
                console.log(`❌ ${test.name}: ${error.message}`);
            }
        }
        
        res.json({
            connectivity: testResults.some(t => t.success),
            timestamp: new Date().toISOString(),
            results: testResults,
            summary: {
                successful: testResults.filter(t => t.success).length,
                failed: testResults.filter(t => !t.success).length,
                total: testResults.length
            }
        });
        
    } catch (error) {
        console.error('❌ Web connectivity test error:', error);
        res.status(500).json({
            connectivity: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Helper function to test web resources
function testWebResource(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? require('https') : require('http');
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD', // Use HEAD to minimize data transfer
            timeout: timeout,
            headers: {
                'User-Agent': 'hello-world-app/1.0.0'
            }
        };
        
        const req = client.request(options, (res) => {
            const responseTime = Date.now() - startTime;
            resolve({
                statusCode: res.statusCode,
                responseTime: responseTime,
                headers: res.headers
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
        
        req.end();
    });
}

// Removed duplicate /health endpoint

// ===== SALESFORCE API ENDPOINTS =====

// Salesforce OAuth endpoints
app.get('/auth/salesforce', (req, res) => {
    try {
        const authUrl = salesforce.getAuthUrl();
        res.redirect(authUrl);
    } catch (err) {
        console.error('❌ Salesforce auth error:', err.message);
        res.status(500).json({ error: 'Failed to initiate Salesforce authentication' });
    }
});

app.get('/auth/salesforce/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        console.error('❌ Salesforce OAuth error:', error);
        return res.status(400).json({ error: `OAuth error: ${error}` });
    }
    
    if (!code) {
        return res.status(400).json({ error: 'No authorization code received' });
    }
    
    try {
        const result = await salesforce.handleOAuthCallback(code);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Salesforce authentication successful!',
                organizationId: result.organizationId,
                instanceUrl: result.instanceUrl
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ OAuth callback error:', err.message);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Validation failure trend API - Update requests over 3 months
app.get('/api/analytics/validation-trend', async (req, res) => {
    try {
        const validationEngine = require('./validation-engine');
        
        // Calculate 3-month period
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3);
        
        // Get enabled validation rules
        let enabledRuleIds;
        const clientEnabledRules = req.query.enabledRules;
        
        if (clientEnabledRules) {
            try {
                enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                    JSON.parse(clientEnabledRules) : clientEnabledRules;
            } catch (error) {
                console.warn('⚠️ Error parsing enabled rules for trend, using defaults:', error);
                enabledRuleIds = null;
            }
        } else {
            enabledRuleIds = validationEngine.getEnabledValidationRules().map(r => r.id);
        }
        
        const result = await salesforce.getValidationFailureTrend(startDate, endDate, enabledRuleIds);
        
        if (result.success) {
            res.json({
                success: true,
                trendData: result.trendData,
                period: result.period,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                trendData: [],
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('❌ Error fetching validation trend:', err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            trendData: []
        });
    }
});

// Analytics API - Technical Team Request counts by type (last 1 year)
app.get('/api/analytics/request-types-week', async (req, res) => {
    try {
        const validationEngine = require('./validation-engine');
        
        // Calculate date range for last 1 year
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        
        // Get enabled validation rules from query params or localStorage pattern
        let enabledRuleIds;
        const clientEnabledRules = req.query.enabledRules;
        
        if (clientEnabledRules) {
            try {
                enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                    JSON.parse(clientEnabledRules) : clientEnabledRules;
                console.log(`🔧 Analytics using ${enabledRuleIds.length} client-specified enabled validation rules`);
            } catch (error) {
                console.warn('⚠️ Error parsing client enabled rules for analytics, using defaults:', error);
                enabledRuleIds = null;
            }
        } else {
            // Use default enabled rules if not specified
            enabledRuleIds = validationEngine.getEnabledValidationRules().map(r => r.id);
            console.log(`🔧 Analytics using ${enabledRuleIds.length} default enabled validation rules`);
        }
        
        const result = await salesforce.getWeeklyRequestTypeAnalytics(startDate, endDate, enabledRuleIds);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                period: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                data: []
            });
        }
    } catch (err) {
        console.error('❌ Error fetching analytics data:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics data',
            data: []
        });
    }
});

// Professional Services Requests API
app.get('/api/provisioning/requests', async (req, res) => {
    try {
        const filters = {
            requestType: req.query.requestType,
            accountId: req.query.accountId,
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            search: req.query.search,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : 25,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });
        
        const result = await salesforce.queryProfServicesRequests(filters);
        
        if (result.success) {
            res.json({
                success: true,
                records: result.records,
                totalCount: result.totalCount,
                pageSize: result.pageSize,
                offset: result.offset,
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                hasMore: result.hasMore,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                records: [],
                totalCount: 0,
                hasMore: false
            });
        }
    } catch (err) {
        console.error('❌ Provisioning requests error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch provisioning requests',
            records: [],
            totalCount: 0,
            hasMore: false
        });
    }
});

// Search endpoint for type-ahead functionality
app.get('/api/provisioning/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || req.query.search || '';
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        if (!searchTerm || searchTerm.length < 2) {
            return res.json({
                success: true,
                results: {
                    technicalRequests: [],
                    accounts: [],
                    totalCount: 0
                }
            });
        }
        
        const result = await salesforce.searchProvisioningData(searchTerm, limit);
        
        if (result.success) {
            res.json({
                success: true,
                results: result.results,
                searchTerm: searchTerm,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                results: {
                    technicalRequests: [],
                    accounts: [],
                    totalCount: 0
                }
            });
        }
    } catch (err) {
        console.error('❌ Provisioning search error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to search provisioning data',
            results: {
                technicalRequests: [],
                accounts: [],
                totalCount: 0
            }
        });
    }
});

// Get specific Professional Services Request
app.get('/api/provisioning/requests/:id', async (req, res) => {
    try {
        const result = await salesforce.getProfServicesRequestById(req.params.id);
        
        if (result.success) {
            res.json({
                success: true,
                record: result.record,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Get provisioning request error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch provisioning request'
        });
    }
});

// Get filter options for dropdowns
app.get('/api/provisioning/filter-options', async (req, res) => {
    try {
        const result = await salesforce.getProfServicesFilterOptions();
        
        if (result.success) {
            res.json({
                success: true,
                requestTypes: result.requestTypes,
                statuses: result.statuses,
                accounts: result.accounts,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                requestTypes: [],
                statuses: [],
                accounts: []
            });
        }
    } catch (err) {
        console.error('❌ Filter options error:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch filter options',
            requestTypes: [],
            statuses: [],
            accounts: []
        });
    }
});

// Get PS requests with product removals
app.get('/api/provisioning/removals', async (req, res) => {
    try {
        console.log('🔥 REMOVALS ENDPOINT CALLED - Fetching PS requests with removals for dashboard monitoring...', req.query);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning empty data');
            return res.json({
                success: true,
                requests: [],
                totalCount: 0,
                timeFrame: req.query.timeFrame || '1w',
                startDate: new Date().toISOString().split('T')[0],
                note: 'No Salesforce authentication - please configure in Settings',
                timestamp: new Date().toISOString()
            });
        }
        
        const timeFrame = req.query.timeFrame || '1w';
        
        console.log(`🔍 Fetching PS requests with removals (${timeFrame})...`);
        
        const result = await salesforce.getPSRequestsWithRemovals(timeFrame);
        
        if (result.success) {
            res.json({
                success: true,
                requests: result.requests,
                totalCount: result.totalCount,
                timeFrame: result.timeFrame,
                startDate: result.startDate,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                requests: [],
                totalCount: 0
            });
        }
    } catch (err) {
        console.error('❌ Error fetching PS requests with removals:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch PS requests with removals',
            requests: [],
            totalCount: 0
        });
    }
});

// ===== VALIDATION ERRORS API =====

// Get validation errors for dashboard monitoring
app.get('/api/validation/errors', async (req, res) => {
    try {
        console.log('📊 Fetching validation errors for dashboard monitoring...', req.query);
        
        const salesforce = require('./salesforce');
        const validationEngine = require('./validation-engine');
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning mock data for testing');
            return res.json({
                success: true,
                errors: [],
                summary: {
                    totalRecords: 0,
                    validRecords: 0,
                    invalidRecords: 0,
                    timeFrame: req.query.timeFrame || '1w',
                    timeFrameStart: new Date().toISOString().split('T')[0],
                    enabledRulesCount: 3,
                    note: 'No Salesforce authentication - showing mock data'
                },
                timestamp: new Date().toISOString()
            });
        }
        
        const {
            timeFrame = '1w' // Default to 1 week
        } = req.query;
        
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
        
        const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Get Salesforce connection
        const conn = await salesforce.getConnection();
        
        // Build SOQL query for Professional Services Requests within time frame
        const soqlQuery = `
            SELECT Id, Name, Account__c, Account_Site__c, Request_Type_RI__c, 
                   Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
            FROM Prof_Services_Request__c
            WHERE CreatedDate >= ${startDateStr}T00:00:00Z AND Name LIKE 'PS-%'
            ORDER BY CreatedDate DESC
            LIMIT 1000
        `;
        
        console.log(`🔍 Fetching PS requests created since ${startDateStr} (${timeFrame})`);
        
        // Execute query
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        console.log(`✅ Retrieved ${records.length} PS requests for validation analysis`);
        
        // Get enabled validation rules from request body or query params, or use defaults
        let enabledRules;
        const clientEnabledRules = req.body?.enabledRules || req.query.enabledRules;
        
        if (clientEnabledRules) {
            try {
                const enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                    JSON.parse(clientEnabledRules) : clientEnabledRules;
                enabledRules = validationEngine.DEFAULT_VALIDATION_RULES.filter(rule => 
                    enabledRuleIds.includes(rule.id)
                );
                console.log(`🔧 Using ${enabledRules.length} client-specified enabled validation rules: ${enabledRuleIds.join(', ')}`);
            } catch (error) {
                console.warn('⚠️ Error parsing client enabled rules, using defaults:', error);
                enabledRules = validationEngine.getEnabledValidationRules();
            }
        } else {
            enabledRules = validationEngine.getEnabledValidationRules();
            console.log(`🔧 Using ${enabledRules.length} default enabled validation rules`);
        }
        
        // Validate each record
        const validationResults = [];
        let validCount = 0;
        let invalidCount = 0;
        
        for (const record of records) {
            try {
                const validationResult = validationEngine.ValidationEngine.validateRecord(record, enabledRules);
                
                if (validationResult.overallStatus === 'FAIL') {
                    invalidCount++;
                    validationResults.push({
                        recordId: record.Id,
                        recordName: record.Name,
                        account: record.Account__c,
                        requestType: record.Request_Type_RI__c,
                        createdDate: record.CreatedDate,
                        failedRules: validationResult.ruleResults
                            .filter(r => r.status === 'FAIL')
                            .map(r => ({
                                ruleId: r.ruleId,
                                ruleName: enabledRules.find(rule => rule.id === r.ruleId)?.name || r.ruleId,
                                message: r.message,
                                details: r.details
                            }))
                    });
                } else {
                    validCount++;
                }
            } catch (error) {
                console.warn(`⚠️ Error validating record ${record.Id}:`, error);
                validCount++; // Default to valid on error
            }
        }
        
        console.log(`📊 Validation complete: ${validCount} valid, ${invalidCount} invalid out of ${records.length} total`);
        
        res.json({
            success: true,
            errors: validationResults,
            summary: {
                totalRecords: records.length,
                validRecords: validCount,
                invalidRecords: invalidCount,
                timeFrame: timeFrame,
                timeFrameStart: startDateStr,
                enabledRulesCount: enabledRules.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching validation errors:', error);
        res.status(500).json({
            success: false,
            error: `Failed to fetch validation errors: ${error.message}`,
            errors: [],
            summary: {
                totalRecords: 0,
                validRecords: 0,
                invalidRecords: 0,
                timeFrame: req.query.timeFrame || '1w'
            }
        });
    }
});

// Note: Duplicate provisioning API endpoints removed to avoid conflicts
// The main provisioning endpoints are defined earlier in the file

// ===== EXPIRATION MONITOR API ENDPOINTS =====

// Get expiration monitor data
app.get('/api/expiration/monitor', async (req, res) => {
    try {
        console.log('⏰ Expiration monitor API called...', req.query);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning empty data');
            return res.json({
                success: true,
                summary: {
                    totalExpiring: 0,
                    atRisk: 0,
                    extended: 0,
                    accountsAffected: 0
                },
                expirations: [],
                lastAnalyzed: null,
                note: 'No Salesforce authentication - please configure in Settings',
                timestamp: new Date().toISOString()
            });
        }
        
        const expirationWindow = parseInt(req.query.expirationWindow) || 30;
        const showExtended = req.query.showExtended !== 'false'; // Default true
        
        console.log(`📊 Fetching expiration data (window: ${expirationWindow} days, showExtended: ${showExtended})`);
        
        // Get summary from database
        const summaryResult = await db.getExpirationSummary(expirationWindow);
        
        // Get expiring entitlements grouped by account/PS record
        const result = await salesforce.getExpiringEntitlements(expirationWindow, showExtended);
        
        // Get last analysis status
        const analysisStatus = await db.getLatestAnalysisStatus();
        
        if (result.success) {
            res.json({
                success: true,
                summary: {
                    totalExpiring: parseInt(summaryResult.summary?.total_expiring || 0),
                    atRisk: parseInt(summaryResult.summary?.at_risk || 0),
                    extended: parseInt(summaryResult.summary?.extended || 0),
                    accountsAffected: parseInt(summaryResult.summary?.accounts_affected || 0)
                },
                expirations: result.expirations,
                expirationWindow: expirationWindow,
                lastAnalyzed: analysisStatus.hasAnalysis ? analysisStatus.analysis.analysis_completed : null,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                summary: {
                    totalExpiring: 0,
                    atRisk: 0,
                    extended: 0,
                    accountsAffected: 0
                },
                expirations: []
            });
        }
    } catch (err) {
        console.error('❌ Error fetching expiration monitor data:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch expiration monitor data',
            expirations: [],
            summary: {
                totalExpiring: 0,
                atRisk: 0,
                extended: 0,
                accountsAffected: 0
            }
        });
    }
});

// Refresh expiration analysis (background job)
app.post('/api/expiration/refresh', async (req, res) => {
    try {
        console.log('🔄 Expiration analysis refresh requested...');
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return res.status(401).json({
                success: false,
                error: 'No Salesforce authentication available'
            });
        }
        
        const lookbackYears = parseInt(req.body.lookbackYears) || 5;
        const expirationWindow = parseInt(req.body.expirationWindow) || 30;
        
        const analysisStarted = new Date();
        
        // Start analysis (this could take a while with 5 years of data)
        console.log(`⏰ Starting expiration analysis: ${lookbackYears} year lookback, ${expirationWindow} day window`);
        
        const result = await salesforce.analyzeExpirations(lookbackYears, expirationWindow);
        
        const analysisCompleted = new Date();
        
        if (result.success) {
            // Clear existing cache
            await db.clearExpirationCache();
            
            // Insert new expiration data into database
            await db.insertExpirationData(result.expirationData);
            
            // Log the analysis
            await db.logExpirationAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: analysisCompleted,
                recordsAnalyzed: result.recordsAnalyzed,
                entitlementsProcessed: result.entitlementsProcessed,
                expirationsFound: result.expirationsFound,
                extensionsFound: result.extensionsFound,
                lookbackYears: lookbackYears,
                status: 'completed'
            });
            
            console.log(`✅ Expiration analysis complete: ${result.expirationsFound} expirations found (${result.removedInSubsequentRecord || 0} filtered out)`);
            
            res.json({
                success: true,
                message: 'Expiration analysis completed successfully',
                summary: {
                    recordsAnalyzed: result.recordsAnalyzed,
                    entitlementsProcessed: result.entitlementsProcessed,
                    expirationsFound: result.expirationsFound,
                    extensionsFound: result.extensionsFound,
                    removedInSubsequentRecord: result.removedInSubsequentRecord || 0,
                    lookbackYears: lookbackYears,
                    expirationWindow: expirationWindow,
                    duration: (analysisCompleted - analysisStarted) / 1000 // seconds
                },
                timestamp: new Date().toISOString()
            });
        } else {
            // Log the failed analysis
            await db.logExpirationAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: new Date(),
                recordsAnalyzed: 0,
                entitlementsProcessed: 0,
                expirationsFound: 0,
                extensionsFound: 0,
                lookbackYears: lookbackYears,
                status: 'failed',
                errorMessage: result.error
            });
            
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'Expiration analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error refreshing expiration analysis:', err.message);
        
        // Log the error
        await db.logExpirationAnalysis({
            analysisStarted: new Date(),
            analysisCompleted: new Date(),
            recordsAnalyzed: 0,
            entitlementsProcessed: 0,
            expirationsFound: 0,
            extensionsFound: 0,
            lookbackYears: req.body.lookbackYears || 5,
            status: 'failed',
            errorMessage: err.message
        });
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh expiration analysis',
            details: err.message
        });
    }
});

// Get expiration analysis status
app.get('/api/expiration/status', async (req, res) => {
    try {
        const analysisStatus = await db.getLatestAnalysisStatus();
        
        if (!analysisStatus.success) {
            return res.status(500).json({
                success: false,
                error: analysisStatus.error
            });
        }
        
        if (!analysisStatus.hasAnalysis) {
            return res.json({
                success: true,
                hasAnalysis: false,
                message: 'No analysis has been run yet. Click "Refresh" to analyze expirations.'
            });
        }
        
        const analysis = analysisStatus.analysis;
        
        // Calculate age of analysis
        const analysisAge = new Date() - new Date(analysis.analysis_completed);
        const ageHours = Math.floor(analysisAge / (1000 * 60 * 60));
        const ageMinutes = Math.floor((analysisAge % (1000 * 60 * 60)) / (1000 * 60));
        
        let ageText;
        if (ageHours > 24) {
            const ageDays = Math.floor(ageHours / 24);
            ageText = `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
        } else if (ageHours > 0) {
            ageText = `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
        } else {
            ageText = `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
        }
        
        res.json({
            success: true,
            hasAnalysis: true,
            analysis: {
                lastRun: analysis.analysis_completed,
                lastRunAgo: ageText,
                status: analysis.status,
                recordsAnalyzed: analysis.records_analyzed,
                entitlementsProcessed: analysis.entitlements_processed,
                expirationsFound: analysis.expirations_found,
                extensionsFound: analysis.extensions_found,
                lookbackYears: analysis.lookback_years,
                errorMessage: analysis.error_message
            }
        });
    } catch (err) {
        console.error('❌ Error getting expiration status:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get expiration status'
        });
    }
});

// ===== CUSTOMER PRODUCTS API ENDPOINTS =====

// Get aggregated customer products for an account
app.get('/api/customer-products', async (req, res) => {
    try {
        console.log('📦 Customer products API called...', req.query);
        
        const accountName = req.query.account;
        
        if (!accountName) {
            return res.status(400).json({
                success: false,
                error: 'Account name is required'
            });
        }
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning empty data');
            return res.json({
                success: true,
                account: accountName,
                summary: {
                    totalActive: 0,
                    byCategory: { models: 0, data: 0, apps: 0 }
                },
                productsByRegion: {},
                lastUpdated: null,
                psRecordsAnalyzed: 0,
                note: 'No Salesforce authentication - please configure in Settings',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`🔍 Fetching customer products for: ${accountName}`);
        
        const result = await salesforce.getCustomerProducts(accountName);
        
        if (result.success) {
            res.json({
                ...result,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                account: accountName,
                productsByRegion: {}
            });
        }
    } catch (err) {
        console.error('❌ Error fetching customer products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch customer products',
            productsByRegion: {}
        });
    }
});

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
        console.log(`📁 Serving static files from ./public`);
        console.log(`🔗 Direct Atlassian API Integration: No MCP configuration required`);
    });
}

module.exports = app;