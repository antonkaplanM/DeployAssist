
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
const cookieParser = require('cookie-parser');
const salesforce = require('./salesforce');
const db = require('./database');
const smlRoutes = require('./sml-routes');

// Authentication modules
const AuthService = require('./auth-service');
const { createAuthMiddleware, requireAdmin } = require('./auth-middleware');
const createAuthRoutes = require('./auth-routes');
const createUserRoutes = require('./user-routes');

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
const PORT = process.env.PORT || 5000;

// Remove MCP-related configuration as we're now using direct API

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies for authentication

// Enable CORS for development (Vite dev server on 8080)
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5000'],
  credentials: true
}));

// ===== AUTHENTICATION SETUP =====
// Check if JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET not set in environment variables');
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    console.error('   Add it to your .env file');
    process.exit(1);
}

// Initialize authentication service
const authService = new AuthService(db.pool, process.env.JWT_SECRET);
const authenticate = createAuthMiddleware(authService, db.pool);

// Periodic cleanup of expired sessions and tokens (every hour)
setInterval(() => {
    authService.cleanupExpired().catch(err => {
        console.error('❌ Session cleanup error:', err);
    });
}, 60 * 60 * 1000);

console.log('✅ Authentication system initialized');

// ===== AUTHENTICATION ROUTES (PUBLIC) =====
// These routes don't require authentication
app.use('/api/auth', createAuthRoutes(authService, authenticate));

// User management routes (admin only)
app.use('/api/users', createUserRoutes(db.pool, authService, authenticate, requireAdmin));

// ===== PUBLIC API ENDPOINTS =====

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

// SML Integration Routes (Protected - requires authentication)
app.use('/api/sml', authenticate, smlRoutes);

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

// Validation failure trend API - Update requests over configurable time period
app.get('/api/analytics/validation-trend', async (req, res) => {
    try {
        const validationEngine = require('./validation-engine');
        
        // Get time frame from query parameter or default to 3 months
        const months = parseInt(req.query.months) || 3;
        
        // Calculate time period based on months parameter
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - months);
        
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

// Analytics API - Technical Team Request counts by type (configurable time period)
app.get('/api/analytics/request-types-week', async (req, res) => {
    try {
        const validationEngine = require('./validation-engine');
        
        // Get time frame from query parameter or default to 12 months (1 year)
        const months = parseInt(req.query.months) || 12;
        
        // Calculate date range based on months parameter
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - months);
        
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

// Analytics API - Weekly provisioning completion times
app.get('/api/analytics/completion-times', async (req, res) => {
    try {
        const database = require('./database');
        
        // Starting point: Monday Oct 13, 2025
        const startDate = new Date('2025-10-13');
        
        // Calculate weeks until now
        const now = new Date();
        
        const query = `
            WITH first_appearance AS (
                -- Get first appearance of each record with its status
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    captured_at as first_seen_at,
                    status as first_status
                FROM ps_audit_trail
                WHERE captured_at >= $1
                ORDER BY ps_record_id, captured_at ASC
            ),
            completed_records AS (
                -- Get records that reached "Tenant Request Completed" status
                SELECT DISTINCT 
                    ps_record_id,
                    ps_record_name,
                    MIN(captured_at) FILTER (WHERE status = 'Tenant Request Completed') as completed_at
                FROM ps_audit_trail
                WHERE captured_at >= $1
                    AND status = 'Tenant Request Completed'
                GROUP BY ps_record_id, ps_record_name
            ),
            completion_times AS (
                -- Calculate completion time for each record
                -- ONLY include records where first capture was NOT already completed
                SELECT 
                    cr.ps_record_id,
                    cr.ps_record_name,
                    cr.completed_at,
                    fa.first_seen_at,
                    EXTRACT(EPOCH FROM (cr.completed_at - fa.first_seen_at)) / 3600 as hours_to_complete,
                    -- Calculate week start (Monday) for the completion date
                    DATE_TRUNC('week', cr.completed_at::date)::date as week_start
                FROM completed_records cr
                INNER JOIN first_appearance fa ON cr.ps_record_id = fa.ps_record_id
                WHERE cr.completed_at IS NOT NULL
                    AND fa.first_seen_at IS NOT NULL
                    AND cr.completed_at >= $1
                    AND fa.first_status != 'Tenant Request Completed'  -- Exclude pre-completed records
                    AND cr.completed_at > fa.first_seen_at  -- Ensure we tracked the progression
            )
            SELECT 
                week_start,
                COUNT(*) as completed_count,
                AVG(hours_to_complete) as avg_hours,
                MIN(hours_to_complete) as min_hours,
                MAX(hours_to_complete) as max_hours,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_to_complete) as median_hours,
                STRING_AGG(ps_record_name, ', ' ORDER BY ps_record_name) as ps_records
            FROM completion_times
            WHERE week_start >= $1::date
            GROUP BY week_start
            ORDER BY week_start ASC;
        `;
        
        const result = await database.query(query, [startDate]);
        
        console.log(`📊 Completion times query returned ${result.rows.length} weeks`);
        result.rows.forEach(row => {
            console.log(`  Week ${row.week_start}: ${row.completed_count} records (${row.ps_records})`);
        });
        
        // Format data for chart
        const chartData = result.rows.map(row => ({
            weekStart: row.week_start,
            weekLabel: formatWeekLabel(new Date(row.week_start)),
            avgHours: parseFloat(row.avg_hours || 0),
            avgDays: parseFloat((row.avg_hours || 0) / 24).toFixed(2),
            completedCount: parseInt(row.completed_count),
            minHours: parseFloat(row.min_hours || 0),
            maxHours: parseFloat(row.max_hours || 0),
            medianHours: parseFloat(row.median_hours || 0),
            psRecords: row.ps_records // Include for debugging
        }));
        
        res.json({
            success: true,
            data: chartData,
            period: {
                startDate: startDate.toISOString(),
                endDate: now.toISOString()
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error fetching completion times:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch completion times',
            data: []
        });
    }
});

// Helper function to format week labels
function formatWeekLabel(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const formatDate = (date) => {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
    };
    
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
}

// Publish Analytics to Confluence
app.post('/api/analytics/publish-to-confluence', async (req, res) => {
    try {
        console.log('📤 Publishing analytics to Confluence...');
        
        // Check for required Atlassian credentials
        const missing = getMissingAtlassianEnvVars();
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing Atlassian credentials: ${missing.join(', ')}`
            });
        }
        
        const { spaceName, pageTitle } = req.body;
        
        if (!spaceName || !pageTitle) {
            return res.status(400).json({
                success: false,
                error: 'Space name and page title are required'
            });
        }
        
        // Fetch analytics data
        const validationEngine = require('./validation-engine');
        const enabledRuleIds = validationEngine.getEnabledValidationRules().map(r => r.id);
        
        // Get request types data
        const requestTypesResult = await salesforce.getWeeklyRequestTypeAnalytics(
            new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
            new Date(),
            enabledRuleIds
        );
        
        // Get completion times data
        const database = require('./database');
        const startDate = new Date('2025-10-13');
        const completionQuery = `
            WITH first_appearance AS (
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    captured_at as first_seen_at,
                    status as first_status
                FROM ps_audit_trail
                WHERE captured_at >= $1
                ORDER BY ps_record_id, captured_at ASC
            ),
            completed_records AS (
                SELECT DISTINCT 
                    ps_record_id,
                    ps_record_name,
                    MIN(captured_at) FILTER (WHERE status = 'Tenant Request Completed') as completed_at
                FROM ps_audit_trail
                WHERE captured_at >= $1
                    AND status = 'Tenant Request Completed'
                GROUP BY ps_record_id, ps_record_name
            ),
            completion_times AS (
                SELECT 
                    cr.ps_record_name,
                    cr.completed_at,
                    fa.first_seen_at,
                    EXTRACT(EPOCH FROM (cr.completed_at - fa.first_seen_at)) / 3600 as hours_to_complete,
                    DATE_TRUNC('week', cr.completed_at::date)::date as week_start
                FROM completed_records cr
                INNER JOIN first_appearance fa ON cr.ps_record_id = fa.ps_record_id
                WHERE cr.completed_at IS NOT NULL
                    AND fa.first_seen_at IS NOT NULL
                    AND cr.completed_at >= $1
                    AND fa.first_status != 'Tenant Request Completed'
                    AND cr.completed_at > fa.first_seen_at
            )
            SELECT 
                week_start,
                COUNT(*) as completed_count,
                AVG(hours_to_complete) as avg_hours,
                MIN(hours_to_complete) as min_hours,
                MAX(hours_to_complete) as max_hours
            FROM completion_times
            WHERE week_start >= $1::date
            GROUP BY week_start
            ORDER BY week_start ASC;
        `;
        
        const completionResult = await database.query(completionQuery, [startDate]);
        
        // Format data for Confluence
        const confluenceContent = generateConfluenceHTML(requestTypesResult.data, completionResult.rows);
        
        // Find and update Confluence page
        const updateResult = await updateConfluencePage(spaceName, pageTitle, confluenceContent);
        
        if (updateResult.success) {
            res.json({
                success: true,
                message: 'Analytics published to Confluence successfully',
                pageUrl: updateResult.pageUrl
            });
        } else {
            res.status(500).json({
                success: false,
                error: updateResult.error
            });
        }
        
    } catch (err) {
        console.error('❌ Error publishing to Confluence:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to publish to Confluence: ' + err.message
        });
    }
});

// Helper function to generate Confluence HTML content
function generateConfluenceHTML(requestTypesData, completionData) {
    const now = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let html = `<h2>Provisioning Analytics Dashboard</h2>`;
    html += `<p><em>Last Updated: ${now}</em></p>`;
    html += `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>This page is automatically generated from the DeployAssist analytics system.</p></ac:rich-text-body></ac:structured-macro>`;
    
    // Request Types Summary with Visual Cards and Pie Chart
    html += `<h3>Technical Team Requests Summary</h3>`;
    
    // Add visual cards for each request type
    if (requestTypesData && requestTypesData.length > 0) {
        // Calculate total for percentage visualization
        const totalRequests = requestTypesData.reduce((sum, item) => sum + item.count, 0);
        
        // Add pie chart using Chart from Table macro
        html += `<div style="text-align: center;">`;
        html += `<ac:structured-macro ac:name="chart from table" ac:schema-version="1">`;
        html += `<ac:parameter ac:name="type">pie</ac:parameter>`;
        html += `<ac:parameter ac:name="width">500</ac:parameter>`;
        html += `<ac:parameter ac:name="height">350</ac:parameter>`;
        html += `<ac:parameter ac:name="3D">true</ac:parameter>`;
        html += `<ac:parameter ac:name="labels">0</ac:parameter>`;
        html += `<ac:parameter ac:name="values">1</ac:parameter>`;
        html += `<ac:parameter ac:name="title">Request Types Distribution</ac:parameter>`;
        html += `<ac:rich-text-body>`;
        html += `<table><tbody>`;
        html += `<tr><th>Request Type</th><th>Count</th></tr>`;
        requestTypesData.forEach(item => {
            html += `<tr><td>${item.requestType}</td><td>${item.count}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `</ac:rich-text-body>`;
        html += `</ac:structured-macro>`;
        html += `</div>`;
        html += `<p></p>`; // spacing
        
        html += `<ac:layout><ac:layout-section ac:type="two_equal">`;
        
        requestTypesData.forEach((item, index) => {
            // Determine color based on request type
            let statusColor = 'blue';
            if (item.requestType.includes('New')) statusColor = 'green';
            else if (item.requestType.includes('Update')) statusColor = 'blue';
            else if (item.requestType.includes('Deprovision')) statusColor = 'red';
            
            // Create a cell for each request type
            html += `<ac:layout-cell>`;
            html += `<ac:structured-macro ac:name="panel" ac:schema-version="1">`;
            html += `<ac:parameter ac:name="borderStyle">solid</ac:parameter>`;
            html += `<ac:parameter ac:name="borderColor">#ccc</ac:parameter>`;
            html += `<ac:rich-text-body>`;
            html += `<p><strong style="font-size: 16px;">${item.requestType}</strong></p>`;
            html += `<p style="font-size: 32px; font-weight: bold; color: #0052CC; margin: 10px 0;">${item.count}</p>`;
            html += `<p style="font-size: 14px; color: #6B778C;">${item.percentage}% of total requests</p>`;
            
            // Add validation failure info if present
            if (item.validationFailures > 0) {
                html += `<p style="font-size: 12px; color: #DE350B; margin-top: 10px;">`;
                html += `⚠️ ${item.validationFailures} validation failures (${item.validationFailureRate}%)`;
                html += `</p>`;
            }
            
            html += `</ac:rich-text-body>`;
            html += `</ac:structured-macro>`;
            html += `</ac:layout-cell>`;
            
            // Start new row after every 2 items
            if ((index + 1) % 2 === 0 && index < requestTypesData.length - 1) {
                html += `</ac:layout-section><ac:layout-section ac:type="two_equal">`;
            }
        });
        
        html += `</ac:layout-section></ac:layout>`;
        html += `<p></p>`; // spacing
    }
    
    // Add detailed table
    html += `<table><thead><tr><th>Request Type</th><th>Count</th><th>Percentage</th><th>Validation Failures</th><th>Failure Rate</th></tr></thead><tbody>`;
    
    if (requestTypesData && requestTypesData.length > 0) {
        requestTypesData.forEach(item => {
            html += `<tr>`;
            html += `<td><strong>${item.requestType}</strong></td>`;
            html += `<td>${item.count}</td>`;
            html += `<td>${item.percentage}%</td>`;
            html += `<td>${item.validationFailures}</td>`;
            html += `<td>${item.validationFailureRate}%</td>`;
            html += `</tr>`;
        });
    } else {
        html += `<tr><td colspan="5"><em>No data available</em></td></tr>`;
    }
    
    html += `</tbody></table>`;
    
    // Completion Times with Visual Summary
    html += `<h3>Weekly Provisioning Completion Times</h3>`;
    html += `<p>Average time to complete provisioning requests per week (from first appearance to completion).</p>`;
    
    // Add summary statistics if we have data
    if (completionData && completionData.length > 0) {
        // Calculate overall statistics
        const totalCompleted = completionData.reduce((sum, row) => sum + parseInt(row.completed_count), 0);
        const avgCompletionTime = completionData.reduce((sum, row) => sum + parseFloat(row.avg_hours), 0) / completionData.length;
        const minTime = Math.min(...completionData.map(row => parseFloat(row.min_hours)));
        const maxTime = Math.max(...completionData.map(row => parseFloat(row.max_hours)));
        
        // Add summary panels
        html += `<ac:layout><ac:layout-section ac:type="three_equal">`;
        
        // Total completed
        html += `<ac:layout-cell>`;
        html += `<ac:structured-macro ac:name="panel" ac:schema-version="1">`;
        html += `<ac:parameter ac:name="bgColor">#E3FCEF</ac:parameter>`;
        html += `<ac:rich-text-body>`;
        html += `<p style="text-align: center;"><strong>Total Completed</strong></p>`;
        html += `<p style="text-align: center; font-size: 28px; font-weight: bold; color: #00875A; margin: 5px 0;">${totalCompleted}</p>`;
        html += `<p style="text-align: center; font-size: 12px; color: #6B778C;">requests</p>`;
        html += `</ac:rich-text-body>`;
        html += `</ac:structured-macro>`;
        html += `</ac:layout-cell>`;
        
        // Average time
        html += `<ac:layout-cell>`;
        html += `<ac:structured-macro ac:name="panel" ac:schema-version="1">`;
        html += `<ac:parameter ac:name="bgColor">#DEEBFF</ac:parameter>`;
        html += `<ac:rich-text-body>`;
        html += `<p style="text-align: center;"><strong>Average Time</strong></p>`;
        html += `<p style="text-align: center; font-size: 28px; font-weight: bold; color: #0052CC; margin: 5px 0;">${avgCompletionTime.toFixed(1)}</p>`;
        html += `<p style="text-align: center; font-size: 12px; color: #6B778C;">hours</p>`;
        html += `</ac:rich-text-body>`;
        html += `</ac:structured-macro>`;
        html += `</ac:layout-cell>`;
        
        // Time range
        html += `<ac:layout-cell>`;
        html += `<ac:structured-macro ac:name="panel" ac:schema-version="1">`;
        html += `<ac:parameter ac:name="bgColor">#FFF0B3</ac:parameter>`;
        html += `<ac:rich-text-body>`;
        html += `<p style="text-align: center;"><strong>Time Range</strong></p>`;
        html += `<p style="text-align: center; font-size: 20px; font-weight: bold; color: #FF8B00; margin: 5px 0;">${minTime.toFixed(1)} - ${maxTime.toFixed(1)}</p>`;
        html += `<p style="text-align: center; font-size: 12px; color: #6B778C;">hours (min - max)</p>`;
        html += `</ac:rich-text-body>`;
        html += `</ac:structured-macro>`;
        html += `</ac:layout-cell>`;
        
        html += `</ac:layout-section></ac:layout>`;
        html += `<p></p>`; // spacing
    }
    
    // Add bar chart for completion times using Chart from Table macro
    if (completionData && completionData.length > 0) {
        html += `<div style="text-align: center;">`;
        html += `<ac:structured-macro ac:name="chart from table" ac:schema-version="1">`;
        html += `<ac:parameter ac:name="type">bar</ac:parameter>`;
        html += `<ac:parameter ac:name="width">800</ac:parameter>`;
        html += `<ac:parameter ac:name="height">400</ac:parameter>`;
        html += `<ac:parameter ac:name="labels">0</ac:parameter>`;
        html += `<ac:parameter ac:name="values">1</ac:parameter>`;
        html += `<ac:parameter ac:name="title">Average Completion Time by Week (Hours)</ac:parameter>`;
        html += `<ac:parameter ac:name="orientation">vertical</ac:parameter>`;
        html += `<ac:rich-text-body>`;
        html += `<table><tbody>`;
        html += `<tr><th>Week</th><th>Avg Hours</th></tr>`;
        completionData.forEach(row => {
            const weekLabel = formatWeekLabel(new Date(row.week_start));
            html += `<tr><td>${weekLabel}</td><td>${parseFloat(row.avg_hours).toFixed(2)}</td></tr>`;
        });
        html += `</tbody></table>`;
        html += `</ac:rich-text-body>`;
        html += `</ac:structured-macro>`;
        html += `</div>`;
        html += `<p></p>`; // spacing
    }
    
    // Add detailed table with visual indicators
    html += `<h4>Weekly Breakdown</h4>`;
    html += `<table><thead><tr><th>Week</th><th>Completed Requests</th><th>Avg Hours</th><th>Min Hours</th><th>Max Hours</th><th>Performance</th></tr></thead><tbody>`;
    
    if (completionData && completionData.length > 0) {
        completionData.forEach(row => {
            const weekLabel = formatWeekLabel(new Date(row.week_start));
            const avgHours = parseFloat(row.avg_hours);
            
            // Determine performance indicator based on average hours
            let performanceIcon = '🟢';
            let performanceText = 'Excellent';
            if (avgHours > 24) {
                performanceIcon = '🔴';
                performanceText = 'Needs Attention';
            } else if (avgHours > 12) {
                performanceIcon = '🟡';
                performanceText = 'Good';
            }
            
            html += `<tr>`;
            html += `<td><strong>${weekLabel}</strong></td>`;
            html += `<td style="text-align: center;">${row.completed_count}</td>`;
            html += `<td style="text-align: center;"><strong>${avgHours.toFixed(2)}</strong></td>`;
            html += `<td style="text-align: center;">${parseFloat(row.min_hours).toFixed(2)}</td>`;
            html += `<td style="text-align: center;">${parseFloat(row.max_hours).toFixed(2)}</td>`;
            html += `<td style="text-align: center;">${performanceIcon} ${performanceText}</td>`;
            html += `</tr>`;
        });
    } else {
        html += `<tr><td colspan="6"><em>No completion data available</em></td></tr>`;
    }
    
    html += `</tbody></table>`;
    
    return html;
}

// Helper function to update Confluence page
async function updateConfluencePage(spaceName, pageTitle, content) {
    try {
        const baseUrl = ATLASSIAN_CONFIG.siteUrl;
        const authString = `${ATLASSIAN_CONFIG.email}:${ATLASSIAN_CONFIG.apiToken}`;
        const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
        
        // Step 1: Find the page by title and space
        console.log(`🔍 Searching for Confluence page "${pageTitle}" in space "${spaceName}"...`);
        
        const searchUrl = `${baseUrl}/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceName)}&title=${encodeURIComponent(pageTitle)}&expand=version`;
        const searchResult = await makeHttpsRequest(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
            }
        });
        
        if (!searchResult.success) {
            console.error('❌ Search API failed:', searchResult.error);
            return {
                success: false,
                error: `Failed to search for page: ${searchResult.error}`
            };
        }
        
        const searchData = searchResult.data;
        
        if (!searchData.results || searchData.results.length === 0) {
            return {
                success: false,
                error: `Page "${pageTitle}" not found in space "${spaceName}"`
            };
        }
        
        const page = searchData.results[0];
        const pageId = page.id;
        const currentVersion = page.version.number;
        
        console.log(`✓ Found page: ${pageTitle} (ID: ${pageId}, Version: ${currentVersion})`);
        
        // Step 2: Update the page
        console.log(`📝 Updating page content...`);
        
        const updateUrl = `${baseUrl}/wiki/rest/api/content/${pageId}`;
        const updateBody = JSON.stringify({
            version: {
                number: currentVersion + 1
            },
            title: pageTitle,
            type: 'page',
            body: {
                storage: {
                    value: content,
                    representation: 'storage'
                }
            }
        });
        
        const updateResult = await makeHttpsRequest(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: updateBody
        });
        
        if (!updateResult.success) {
            console.error('❌ Update API failed:', updateResult.error);
            return {
                success: false,
                error: `Failed to update page: ${updateResult.error}`
            };
        }
        
        const updateData = updateResult.data;
        const pageUrl = `${baseUrl}/wiki${updateData._links.webui}`;
        
        console.log(`✅ Successfully updated Confluence page: ${pageUrl}`);
        
        return {
            success: true,
            pageUrl: pageUrl
        };
        
    } catch (err) {
        console.error('❌ Confluence API error:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

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

// Check for new PS requests since last check (for notifications)
app.get('/api/provisioning/new-records', async (req, res) => {
    try {
        const sinceTimestamp = req.query.since;
        
        if (!sinceTimestamp) {
            return res.status(400).json({
                success: false,
                error: 'Missing "since" timestamp parameter'
            });
        }
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return res.json({
                success: true,
                newRecords: [],
                totalNew: 0,
                checkTimestamp: new Date().toISOString(),
                note: 'No Salesforce authentication'
            });
        }
        
        console.log(`🔔 Checking for new PS records since ${sinceTimestamp}...`);
        
        // Query for new records created after the provided timestamp
        const conn = await salesforce.getConnection();
        
        // Convert ISO timestamp to Salesforce datetime format
        const sinceDate = new Date(sinceTimestamp);
        const soqlTimestamp = sinceDate.toISOString().replace('.000Z', 'Z');
        
        const soqlQuery = `
            SELECT Id, Name, TenantRequestAction__c, Account__c, Account_Site__c, 
                   Status__c, CreatedDate, LastModifiedDate
            FROM Prof_Services_Request__c
            WHERE CreatedDate > ${soqlTimestamp}
            ORDER BY CreatedDate DESC
            LIMIT 10
        `;
        
        const result = await conn.query(soqlQuery);
        const records = result.records || [];
        
        console.log(`✅ Found ${records.length} new PS record(s) since ${sinceTimestamp}`);
        
        // Format records for notification display
        const newRecords = records.map(record => ({
            id: record.Id,
            name: record.Name,
            requestType: record.TenantRequestAction__c || 'Unknown',
            account: record.Account__c,
            accountSite: record.Account_Site__c,
            status: record.Status__c,
            createdDate: record.CreatedDate
        }));
        
        res.json({
            success: true,
            newRecords: newRecords,
            totalNew: newRecords.length,
            checkTimestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error checking for new PS records:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check for new records',
            newRecords: [],
            totalNew: 0
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
            SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c, 
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
                        requestType: record.TenantRequestAction__c,
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

// ===== ASYNC VALIDATION RESULTS API =====

// Get async validation results for PS records
app.get('/api/validation/async-results', async (req, res) => {
    try {
        console.log('📊 Fetching async validation results...', req.query);
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        const { recordIds } = req.query; // Comma-separated list of record IDs
        
        if (!recordIds) {
            return res.json({
                success: true,
                results: [],
                count: 0,
                timestamp: new Date().toISOString()
            });
        }
        
        const recordIdArray = recordIds.split(',');
        
        // Query async validation results for the given record IDs
        const query = `
            SELECT 
                ps_record_id,
                ps_record_name,
                rule_id,
                rule_name,
                status,
                message,
                details,
                sml_entitlements,
                active_entitlements_count,
                processing_completed_at,
                created_at,
                updated_at
            FROM async_validation_results
            WHERE ps_record_id = ANY($1)
            ORDER BY updated_at DESC
        `;
        
        const result = await pool.query(query, [recordIdArray]);
        await pool.end();
        
        res.json({
            success: true,
            results: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching async validation results:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get async validation processing status
app.get('/api/validation/async-status', async (req, res) => {
    try {
        console.log('📊 Fetching async validation processing status...');
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        // Get latest processing log entry
        const logQuery = `
            SELECT *
            FROM async_validation_processing_log
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        // Get summary statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_results,
                COUNT(CASE WHEN status = 'WARNING' THEN 1 END) as warning_count,
                COUNT(CASE WHEN status = 'PASS' THEN 1 END) as pass_count,
                COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_count,
                MAX(updated_at) as last_updated
            FROM async_validation_results
            WHERE rule_id = 'deprovision-active-entitlements-check'
        `;
        
        const [logResult, statsResult] = await Promise.all([
            pool.query(logQuery),
            pool.query(statsQuery)
        ]);
        
        await pool.end();
        
        res.json({
            success: true,
            lastProcessing: logResult.rows[0] || null,
            statistics: statsResult.rows[0] || null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error fetching async validation status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Trigger SML data refresh for Deprovision records
app.post('/api/validation/refresh-sml-data', async (req, res) => {
    try {
        console.log('🔄 Manual SML data refresh triggered...');
        
        const { spawn } = require('child_process');
        const path = require('path');
        
        // Run the background script
        const scriptPath = path.join(__dirname, 'process-sml-validation.js');
        const childProcess = spawn('node', [scriptPath], {
            detached: false,
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log('✅ SML data refresh completed successfully');
            } else {
                console.error('❌ SML data refresh failed with code:', code);
            }
        });
        
        // Respond immediately with job started status
        res.json({
            success: true,
            message: 'SML data refresh started in background',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error starting SML data refresh:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

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
        const showExtended = req.query.showExtended === 'true' || req.query.showExtended === true;
        
        console.log(`📊 Fetching expiration data (window: ${expirationWindow} days, showExtended: ${showExtended})`);
        
        // Get summary from database
        const summaryResult = await db.getExpirationSummary(expirationWindow);
        
        // Get expiring entitlements grouped by account/PS record
        const result = await salesforce.getExpiringEntitlements(expirationWindow, showExtended);
        
        // Get last analysis status
        const analysisStatus = await db.getLatestAnalysisStatus();
        
        if (result.success) {
            // Calculate summary based on status categories
            const atRiskCount = result.expirations.filter(e => e.status === 'at-risk').length;
            const upcomingCount = result.expirations.filter(e => e.status === 'upcoming').length;
            const currentCount = result.expirations.filter(e => e.status === 'current').length;
            
            // Get unique accounts
            const uniqueAccounts = new Set(result.expirations.map(e => e.account.id));
            
            res.json({
                success: true,
                summary: {
                    totalExpiring: result.expirations.length,
                    atRisk: atRiskCount,
                    upcoming: upcomingCount,
                    current: currentCount,
                    accountsAffected: uniqueAccounts.size
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
                    upcoming: 0,
                    current: 0,
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
                upcoming: 0,
                current: 0,
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

// Query expired products with filtering
app.get('/api/expiration/expired-products', async (req, res) => {
    try {
        console.log('🔍 Querying expired products...', req.query);
        
        const {
            category,
            accountName,
            productName,
            excludeProduct,
            region,
            includeGhostAccountsOnly,
            limit = 100,
            groupByAccount = true
        } = req.query;
        
        // Build the query
        let query = `
            SELECT 
                em.account_name,
                em.product_name,
                em.product_type,
                em.end_date,
                em.account_id as ma_sf_account_id,
                ga.id as ghost_account_id
            FROM expiration_monitor em
            LEFT JOIN ghost_accounts ga ON em.account_name = ga.account_name
            WHERE em.end_date < CURRENT_DATE
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Add filters
        if (category) {
            query += ` AND em.product_type = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        
        if (accountName) {
            query += ` AND em.account_name ILIKE $${paramIndex}`;
            params.push(`%${accountName}%`);
            paramIndex++;
        }
        
        if (productName) {
            query += ` AND em.product_name ILIKE $${paramIndex}`;
            params.push(`%${productName}%`);
            paramIndex++;
        }
        
        if (excludeProduct) {
            query += ` AND em.product_name NOT ILIKE $${paramIndex}`;
            params.push(`%${excludeProduct}%`);
            paramIndex++;
        }
        
        if (includeGhostAccountsOnly === 'true' || includeGhostAccountsOnly === true) {
            query += ` AND ga.id IS NOT NULL`;
        }
        
        query += ` ORDER BY em.account_name, em.product_name`;
        query += ` LIMIT $${paramIndex}`;
        params.push(parseInt(limit));
        
        const result = await db.query(query, params);
        
        // Process results
        if (groupByAccount === 'true' || groupByAccount === true) {
            // Group by account
            const accountMap = new Map();
            
            result.rows.forEach(row => {
                if (!accountMap.has(row.account_name)) {
                    accountMap.set(row.account_name, {
                        account_name: row.account_name,
                        ma_sf_account_id: row.ma_sf_account_id,
                        ma_sf_link: row.ma_sf_account_id ? 
                            `https://moodysanalytics.my.salesforce.com/${row.ma_sf_account_id}` : null,
                        is_ghost_account: row.ghost_account_id !== null,
                        expired_products: []
                    });
                }
                
                accountMap.get(row.account_name).expired_products.push({
                    product_name: row.product_name,
                    product_type: row.product_type,
                    expiration_date: row.end_date
                });
            });
            
            const accounts = Array.from(accountMap.values());
            
            res.json({
                success: true,
                accounts: accounts,
                summary: {
                    total_accounts: accounts.length,
                    total_expired_products: result.rows.length,
                    ghost_accounts: accounts.filter(a => a.is_ghost_account).length,
                    regular_accounts: accounts.filter(a => !a.is_ghost_account).length
                },
                filters: {
                    category,
                    accountName,
                    productName,
                    excludeProduct,
                    region,
                    includeGhostAccountsOnly
                },
                timestamp: new Date().toISOString()
            });
        } else {
            // Flat list of products
            const products = result.rows.map(row => ({
                account_name: row.account_name,
                product_name: row.product_name,
                product_type: row.product_type,
                expiration_date: row.end_date,
                ma_sf_account_id: row.ma_sf_account_id,
                ma_sf_link: row.ma_sf_account_id ? 
                    `https://moodysanalytics.my.salesforce.com/${row.ma_sf_account_id}` : null,
                is_ghost_account: row.ghost_account_id !== null
            }));
            
            res.json({
                success: true,
                products: products,
                summary: {
                    total_products: products.length
                },
                filters: {
                    category,
                    accountName,
                    productName,
                    excludeProduct,
                    region,
                    includeGhostAccountsOnly
                },
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('❌ Error querying expired products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to query expired products',
            details: err.message
        });
    }
});

// ===== PACKAGE CHANGE ANALYSIS API ENDPOINTS =====

// Get package change summary statistics
app.get('/api/analytics/package-changes/summary', async (req, res) => {
    try {
        console.log('📦 Package change summary API called...', req.query);
        
        const timeFrame = req.query.timeFrame || '1y';
        
        const result = await db.getPackageChangeSummary(timeFrame);
        
        if (result.success) {
            res.json({
                success: true,
                summary: result.summary,
                timeFrame: result.timeFrame,
                startDate: result.startDate,
                endDate: result.endDate,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                summary: {
                    total_changes: 0,
                    total_upgrades: 0,
                    total_downgrades: 0,
                    ps_records_with_changes: 0,
                    accounts_affected: 0
                }
            });
        }
    } catch (err) {
        console.error('❌ Error fetching package change summary:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch package change summary'
        });
    }
});

// Get package changes grouped by product
app.get('/api/analytics/package-changes/by-product', async (req, res) => {
    try {
        console.log('📦 Package changes by product API called...', req.query);
        
        const timeFrame = req.query.timeFrame || '1y';
        
        const result = await db.getPackageChangesByProduct(timeFrame);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                count: result.count,
                timeFrame: result.timeFrame,
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
        console.error('❌ Error fetching package changes by product:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch package changes by product',
            data: []
        });
    }
});

// Get package changes grouped by account
app.get('/api/analytics/package-changes/by-account', async (req, res) => {
    try {
        console.log('📦 Package changes by account API called...', req.query);
        
        const timeFrame = req.query.timeFrame || '1y';
        // No limit - return all accounts with changes
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        
        const result = await db.getPackageChangesByAccount(timeFrame, limit);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                count: result.count,
                timeFrame: result.timeFrame,
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
        console.error('❌ Error fetching package changes by account:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch package changes by account',
            data: []
        });
    }
});

// Get recent package changes
app.get('/api/analytics/package-changes/recent', async (req, res) => {
    try {
        console.log('📦 Recent package changes API called...', req.query);
        
        const limit = parseInt(req.query.limit) || 20;
        
        const result = await db.getRecentPackageChanges(limit);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                count: result.count,
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
        console.error('❌ Error fetching recent package changes:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch recent package changes',
            data: []
        });
    }
});

// Trigger package change analysis refresh
app.post('/api/analytics/package-changes/refresh', async (req, res) => {
    try {
        console.log('🔄 Package change analysis refresh requested...');
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return res.status(401).json({
                success: false,
                error: 'No Salesforce authentication available'
            });
        }
        
        const lookbackYears = parseInt(req.body.lookbackYears) || 2;
        
        const analysisStarted = new Date();
        
        console.log(`📦 Starting package change analysis: ${lookbackYears} year lookback`);
        
        const result = await salesforce.analyzePackageChanges(lookbackYears);
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            // Clear existing cache
            await db.clearPackageChangeCache();
            
            // Insert new package change data into database
            if (result.packageChanges && result.packageChanges.length > 0) {
                await db.insertPackageChangeData(result.packageChanges);
            }
            
            // Log the analysis
            await db.logPackageChangeAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: analysisCompleted,
                recordsAnalyzed: result.recordsAnalyzed,
                deploymentsProcessed: result.deploymentsProcessed,
                changesFound: result.changesFound,
                upgradesFound: result.upgradesFound,
                downgradesFound: result.downgradesFound,
                psRecordsWithChanges: result.psRecordsWithChanges,
                accountsAffected: result.accountsAffected,
                lookbackYears: lookbackYears,
                startDate: result.startDate,
                endDate: result.endDate,
                status: 'completed'
            });
            
            console.log(`✅ Package change analysis complete: ${result.changesFound} changes found (${result.upgradesFound} upgrades, ${result.downgradesFound} downgrades)`);
            
            res.json({
                success: true,
                message: 'Package change analysis completed successfully',
                summary: {
                    recordsAnalyzed: result.recordsAnalyzed,
                    deploymentsProcessed: result.deploymentsProcessed,
                    changesFound: result.changesFound,
                    upgradesFound: result.upgradesFound,
                    downgradesFound: result.downgradesFound,
                    psRecordsWithChanges: result.psRecordsWithChanges,
                    accountsAffected: result.accountsAffected,
                    lookbackYears: lookbackYears,
                    duration: durationSeconds
                },
                timestamp: new Date().toISOString()
            });
        } else {
            // Log the failed analysis
            await db.logPackageChangeAnalysis({
                analysisStarted: analysisStarted,
                analysisCompleted: new Date(),
                recordsAnalyzed: 0,
                deploymentsProcessed: 0,
                changesFound: 0,
                upgradesFound: 0,
                downgradesFound: 0,
                psRecordsWithChanges: 0,
                accountsAffected: 0,
                lookbackYears: lookbackYears,
                status: 'failed',
                errorMessage: result.error
            });
            
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'Package change analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error refreshing package change analysis:', err.message);
        
        // Log the error
        await db.logPackageChangeAnalysis({
            analysisStarted: new Date(),
            analysisCompleted: new Date(),
            recordsAnalyzed: 0,
            deploymentsProcessed: 0,
            changesFound: 0,
            upgradesFound: 0,
            downgradesFound: 0,
            psRecordsWithChanges: 0,
            accountsAffected: 0,
            lookbackYears: req.body.lookbackYears || 2,
            status: 'failed',
            errorMessage: err.message
        });
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh package change analysis',
            details: err.message
        });
    }
});

// Get package change analysis status
app.get('/api/analytics/package-changes/status', async (req, res) => {
    try {
        const analysisStatus = await db.getLatestPackageChangeAnalysisStatus();
        
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
                message: 'No analysis has been run yet. Click "Refresh" to analyze package changes.'
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
                deploymentsProcessed: analysis.deployments_processed,
                changesFound: analysis.changes_found,
                upgradesFound: analysis.upgrades_found,
                downgradesFound: analysis.downgrades_found,
                psRecordsWithChanges: analysis.ps_records_with_changes,
                accountsAffected: analysis.accounts_affected,
                lookbackYears: analysis.lookback_years,
                errorMessage: analysis.error_message
            }
        });
    } catch (err) {
        console.error('❌ Error getting package change analysis status:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get package change analysis status'
        });
    }
});

// Export package changes to Excel
app.get('/api/analytics/package-changes/export', async (req, res) => {
    try {
        console.log('📊 Package changes Excel export requested...', req.query);
        
        const timeFrame = req.query.timeFrame || '1y';
        const ExcelJS = require('exceljs');
        
        // Fetch all data
        const [summaryResult, byProductResult, byAccountResult, recentResult] = await Promise.all([
            db.getPackageChangeSummary(timeFrame),
            db.getPackageChangesByProduct(timeFrame),
            db.getPackageChangesByAccount(timeFrame),
            db.getRecentPackageChanges(timeFrame, 100)
        ]);
        
        // Check all results for success
        if (!summaryResult || !summaryResult.success || !summaryResult.summary) {
            console.error('❌ Summary data failed:', summaryResult);
            throw new Error('Failed to fetch summary data: ' + (summaryResult?.error || 'No data returned'));
        }
        
        if (!byProductResult || !byProductResult.success || !byProductResult.data) {
            console.error('❌ Product data failed:', byProductResult);
            throw new Error('Failed to fetch product data: ' + (byProductResult?.error || 'No data returned'));
        }
        
        if (!byAccountResult || !byAccountResult.success || !byAccountResult.data) {
            console.error('❌ Account data failed:', byAccountResult);
            throw new Error('Failed to fetch account data: ' + (byAccountResult?.error || 'No data returned'));
        }
        
        if (!recentResult || !recentResult.success || !recentResult.data) {
            console.error('❌ Recent changes data failed:', recentResult);
            throw new Error('Failed to fetch recent changes: ' + (recentResult?.error || 'No data returned'));
        }
        
        console.log('✅ All data fetched successfully for Excel export');
        
        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Risk Management System';
        workbook.created = new Date();
        
        // Define common styles
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        const subHeaderStyle = {
            font: { bold: true, size: 10 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
        });
        
        summarySheet.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        summarySheet.mergeCells('A1:D1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = 'Package Changes Analysis - Summary';
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };
        
        // Add metadata
        summarySheet.getCell('A2').value = `Time Frame: ${timeFrame}`;
        summarySheet.getCell('C2').value = `Generated: ${new Date().toLocaleString()}`;
        
        // Add headers
        summarySheet.getRow(4).values = ['Metric', 'Total', 'Upgrades', 'Downgrades'];
        summarySheet.getRow(4).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add summary data
        const summary = summaryResult.summary;
        const summaryData = [
            ['Total Changes', summary.total_changes, summary.total_upgrades, summary.total_downgrades],
            ['PS Records with Changes', summary.ps_records_with_changes, '-', '-'],
            ['Accounts Affected', summary.accounts_affected, '-', '-'],
            ['Deployments', summary.deployments_affected, '-', '-'],
            ['Products Changed', summary.products_changed, '-', '-']
        ];
        
        summaryData.forEach((row, idx) => {
            const rowNum = idx + 5;
            summarySheet.getRow(rowNum).values = row;
            summarySheet.getRow(rowNum).eachCell((cell, colNum) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (colNum > 1 && cell.value !== '-') {
                    cell.numFmt = '#,##0';
                }
            });
        });
        
        // Sheet 2: By Account (with hierarchy)
        const accountSheet = workbook.addWorksheet('By Account', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        accountSheet.columns = [
            { width: 50 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        accountSheet.mergeCells('A1:F1');
        const accountTitleCell = accountSheet.getCell('A1');
        accountTitleCell.value = 'Package Changes by Account';
        accountTitleCell.font = { bold: true, size: 14 };
        accountTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        accountSheet.getRow(2).values = ['Account / Deployment / Product', 'Total Changes', 'Upgrades', 'Downgrades', 'PS Records', 'Products'];
        accountSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add account data with hierarchy
        let currentRow = 3;
        if (byAccountResult.success && byAccountResult.data) {
            byAccountResult.data.forEach(account => {
                // Account row
                const accountRow = accountSheet.getRow(currentRow++);
                accountRow.values = [
                    account.account_name,
                    account.total_changes,
                    account.upgrades,
                    account.downgrades,
                    account.ps_records,
                    account.products_changed
                ];
                accountRow.font = { bold: true };
                accountRow.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum > 1) {
                        cell.numFmt = '#,##0';
                    }
                });
                
                // Deployment rows
                if (account.deployments && account.deployments.length > 0) {
                    account.deployments.forEach(deployment => {
                        const deployRow = accountSheet.getRow(currentRow++);
                        const deploymentLabel = deployment.tenant_name 
                            ? `  ${deployment.deployment_number} (${deployment.tenant_name})`
                            : `  ${deployment.deployment_number}`;
                        deployRow.values = [
                            deploymentLabel,
                            deployment.total_changes,
                            deployment.upgrades,
                            deployment.downgrades,
                            deployment.ps_records,
                            deployment.products_changed
                        ];
                        deployRow.font = { italic: true };
                        deployRow.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF5F5F5' }
                        };
                        deployRow.eachCell((cell, colNum) => {
                            cell.border = {
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' }
                            };
                            if (colNum > 1) {
                                cell.numFmt = '#,##0';
                            }
                        });
                        
                        // Product rows
                        if (deployment.products && deployment.products.length > 0) {
                            deployment.products.forEach(product => {
                                const productRow = accountSheet.getRow(currentRow++);
                                productRow.values = [
                                    `    ${product.product_code}`,
                                    product.total_changes,
                                    product.upgrades,
                                    product.downgrades,
                                    product.ps_records,
                                    '-'
                                ];
                                productRow.font = { size: 9 };
                                productRow.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'FFECECEC' }
                                };
                                productRow.eachCell((cell, colNum) => {
                                    cell.border = {
                                        top: { style: 'thin' },
                                        left: { style: 'thin' },
                                        bottom: { style: 'thin' },
                                        right: { style: 'thin' }
                                    };
                                    if (colNum > 1 && cell.value !== '-') {
                                        cell.numFmt = '#,##0';
                                    }
                                });
                            });
                        }
                    });
                }
            });
        }
        
        // Sheet 3: By Product
        const productSheet = workbook.addWorksheet('By Product', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        productSheet.columns = [
            { width: 40 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        productSheet.mergeCells('A1:F1');
        const productTitleCell = productSheet.getCell('A1');
        productTitleCell.value = 'Package Changes by Product';
        productTitleCell.font = { bold: true, size: 14 };
        productTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        productSheet.getRow(2).values = ['Product', 'Total Changes', 'Upgrades', 'Downgrades', 'PS Records', 'Accounts'];
        productSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add product data
        if (byProductResult.success && byProductResult.data) {
            byProductResult.data.forEach((product, idx) => {
                const row = productSheet.getRow(idx + 3);
                row.values = [
                    product.product_name || product.product_code,
                    product.total_changes,
                    product.upgrades,
                    product.downgrades,
                    product.ps_records,
                    product.accounts
                ];
                row.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum > 1) {
                        cell.numFmt = '#,##0';
                    }
                });
            });
        }
        
        // Sheet 4: Recent Changes
        const recentSheet = workbook.addWorksheet('Recent Changes', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
        });
        
        recentSheet.columns = [
            { width: 15 },
            { width: 30 },
            { width: 20 },
            { width: 20 },
            { width: 30 },
            { width: 20 },
            { width: 15 },
            { width: 15 }
        ];
        
        // Add title
        recentSheet.mergeCells('A1:H1');
        const recentTitleCell = recentSheet.getCell('A1');
        recentTitleCell.value = 'Recent Package Changes';
        recentTitleCell.font = { bold: true, size: 14 };
        recentTitleCell.alignment = { horizontal: 'center' };
        
        // Add headers
        recentSheet.getRow(2).values = ['PS Record', 'Account', 'Deployment', 'Tenant Name', 'Product', 'Package Change', 'Change Type', 'Date'];
        recentSheet.getRow(2).eachCell((cell) => {
            cell.style = headerStyle;
        });
        
        // Add recent changes data
        if (recentResult.success && recentResult.data) {
            recentResult.data.forEach((change, idx) => {
                const row = recentSheet.getRow(idx + 3);
                row.values = [
                    change.ps_record_name,
                    change.account_name,
                    change.deployment_number,
                    change.tenant_name || '-',
                    change.product_code,
                    `${change.previous_package} → ${change.new_package}`,
                    change.change_type === 'upgrade' ? '↑ Upgrade' : '↓ Downgrade',
                    new Date(change.ps_created_date)
                ];
                row.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNum === 8) { // Date column
                        cell.numFmt = 'mm/dd/yyyy';
                    }
                    if (colNum === 7) { // Change Type column
                        if (change.change_type === 'upgrade') {
                            cell.font = { color: { argb: 'FF15803D' } };
                        } else {
                            cell.font = { color: { argb: 'FFC2410C' } };
                        }
                    }
                });
            });
        }
        
        // Generate Excel file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Package_Changes_${timeFrame}_${Date.now()}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
        console.log('✅ Excel export completed successfully');
        
    } catch (err) {
        console.error('❌ Error exporting to Excel:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export to Excel'
        });
    }
});

// ===== GHOST ACCOUNTS API ENDPOINTS =====

// Get all ghost accounts with filters
app.get('/api/ghost-accounts', async (req, res) => {
    try {
        console.log('👻 Ghost accounts API called...', req.query);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning empty data');
            return res.json({
                success: true,
                ghostAccounts: [],
                summary: {
                    totalGhostAccounts: 0,
                    unreviewed: 0,
                    reviewed: 0
                },
                note: 'No Salesforce authentication - please configure in Settings',
                timestamp: new Date().toISOString()
            });
        }
        
        const filters = {
            isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
            accountSearch: req.query.accountSearch,
            expiryBefore: req.query.expiryBefore,
            expiryAfter: req.query.expiryAfter
        };
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });
        
        console.log(`📊 Fetching ghost accounts with filters:`, filters);
        
        const result = await db.getGhostAccounts(filters);
        const summaryResult = await db.getGhostAccountsSummary();
        
        if (result.success) {
            // Fetch MA Account IDs for all ghost accounts
            const accountNames = result.ghostAccounts.map(acc => acc.account_name);
            const externalIdsResult = await salesforce.getAccountExternalIds(accountNames);
            
            // Enrich ghost accounts with MA SF Links
            // accountIds contains MA Account IDs from Account.MA_AccountID__c field
            const enrichedGhostAccounts = result.ghostAccounts.map(account => ({
                ...account,
                ma_sf_account_id: externalIdsResult.accountIds[account.account_name] || null,
                ma_sf_link: externalIdsResult.accountIds[account.account_name] 
                    ? `https://moodysanalytics.my.salesforce.com/${externalIdsResult.accountIds[account.account_name]}`
                    : null
            }));
            
            res.json({
                success: true,
                ghostAccounts: enrichedGhostAccounts,
                summary: summaryResult.success ? summaryResult.summary : {
                    totalGhostAccounts: 0,
                    unreviewed: 0,
                    reviewed: 0
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                ghostAccounts: [],
                summary: {
                    totalGhostAccounts: 0,
                    unreviewed: 0,
                    reviewed: 0
                }
            });
        }
    } catch (err) {
        console.error('❌ Error fetching ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch ghost accounts',
            ghostAccounts: []
        });
    }
});

// Refresh ghost accounts analysis
app.post('/api/ghost-accounts/refresh', async (req, res) => {
    try {
        console.log('🔄 Ghost accounts refresh requested...');
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return res.status(401).json({
                success: false,
                error: 'No Salesforce authentication available'
            });
        }
        
        const analysisStarted = new Date();
        
        console.log('👻 Starting ghost accounts identification...');
        
        const result = await salesforce.identifyGhostAccounts();
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            console.log(`✅ Ghost accounts analysis complete: ${result.ghostCount} ghost accounts found`);
            
            res.json({
                success: true,
                message: 'Ghost accounts analysis completed successfully',
                summary: {
                    totalAnalyzed: result.totalAnalyzed,
                    ghostAccountsFound: result.ghostCount,
                    duration: durationSeconds
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'Ghost accounts analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error refreshing ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh ghost accounts analysis',
            details: err.message
        });
    }
});

// Mark ghost account as reviewed
app.post('/api/ghost-accounts/:accountId/review', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { reviewedBy, notes } = req.body;
        
        if (!reviewedBy) {
            return res.status(400).json({
                success: false,
                error: 'reviewedBy is required'
            });
        }
        
        console.log(`✅ Marking ghost account as reviewed: ${accountId}`);
        
        const result = await db.markGhostAccountReviewed(accountId, reviewedBy, notes);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Ghost account marked as reviewed',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error marking ghost account as reviewed:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark ghost account as reviewed'
        });
    }
});

// Get expired products/entitlements for a specific ghost account
app.get('/api/ghost-accounts/:accountId/products', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { category, excludeProduct } = req.query;
        
        console.log(`📦 Fetching products for ghost account: ${accountId}`);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            return res.status(401).json({
                success: false,
                error: 'No Salesforce authentication available'
            });
        }
        
        // Get the account from database to get the account name
        const accountResult = await db.getAccount(accountId);
        if (!accountResult.success || !accountResult.account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found'
            });
        }
        
        const accountName = accountResult.account.account_name;
        
        // Fetch and parse entitlements from Salesforce
        const productsResult = await salesforce.getAccountExpiredProducts(
            accountId, 
            accountName,
            { category, excludeProduct }
        );
        
        if (productsResult.success) {
            res.json({
                success: true,
                accountId: accountId,
                accountName: accountName,
                products: productsResult.products,
                summary: productsResult.summary,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: productsResult.error
            });
        }
    } catch (err) {
        console.error('❌ Error fetching ghost account products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch ghost account products',
            details: err.message
        });
    }
});

// Remove ghost account from tracking
app.delete('/api/ghost-accounts/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        
        console.log(`🗑️ Removing ghost account: ${accountId}`);
        
        const result = await db.removeGhostAccount(accountId);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Ghost account removed from tracking',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error removing ghost account:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove ghost account'
        });
    }
});

// Get recently deprovisioned accounts
app.get('/api/deprovisioned-accounts', async (req, res) => {
    try {
        console.log('📋 Recently deprovisioned accounts API called...', req.query);
        
        // Check if we have a valid Salesforce connection
        const hasValidAuth = await salesforce.hasValidAuthentication();
        if (!hasValidAuth) {
            console.log('⚠️ No valid Salesforce authentication - returning empty data');
            return res.json({
                success: true,
                deprovisionedAccounts: [],
                daysBack: parseInt(req.query.daysBack) || 30,
                count: 0,
                note: 'No Salesforce authentication - please configure in Settings',
                timestamp: new Date().toISOString()
            });
        }
        
        const daysBack = parseInt(req.query.daysBack) || 30;
        
        console.log(`📊 Fetching accounts deprovisioned in last ${daysBack} days...`);
        
        const result = await salesforce.getRecentlyDeprovisionedAccounts(daysBack);
        
        if (result.success) {
            res.json({
                success: true,
                deprovisionedAccounts: result.deprovisionedAccounts,
                totalAnalyzed: result.totalAnalyzed,
                daysBack: result.daysBack,
                count: result.count,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                deprovisionedAccounts: [],
                count: 0
            });
        }
    } catch (err) {
        console.error('❌ Error fetching deprovisioned accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch deprovisioned accounts',
            deprovisionedAccounts: [],
            count: 0
        });
    }
});

// ===== CUSTOMER PRODUCTS API ENDPOINTS =====

// Get aggregated customer products for an account
// Uses the latest PS record with status "Tenant Request Completed" from the audit trail
app.get('/api/customer-products', async (req, res) => {
    try {
        console.log('📦 Customer products API called...', req.query);
        
        const accountName = req.query.account;
        const includeExpired = req.query.includeExpired === 'true';
        
        if (!accountName) {
            return res.status(400).json({
                success: false,
                error: 'Account name is required'
            });
        }
        
        console.log(`🔍 Fetching customer products from audit trail for: ${accountName} (includeExpired: ${includeExpired})`);
        
        const result = await salesforce.getCustomerProducts(accountName, includeExpired);
        
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

// ===== PRODUCT UPDATE WORKFLOW ENDPOINTS =====

const productUpdateService = require('./product-update-service');

/**
 * Get product update options for dropdown menus
 * GET /api/product-update/options
 * Optional query params: type (package/product/modifier/region), category (models/data/apps)
 */
app.get('/api/product-update/options', async (req, res) => {
    try {
        const { type, category } = req.query;
        
        if (!type) {
            // Get all options
            const result = await productUpdateService.getAllProductOptions();
            return res.json(result);
        }
        
        const result = await productUpdateService.getProductOptions(type, category);
        res.json(result);
    } catch (err) {
        console.error('❌ Error fetching product options:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product options'
        });
    }
});

/**
 * Create a new product update request
 * POST /api/product-update/requests
 */
app.post('/api/product-update/requests', async (req, res) => {
    try {
        const requestData = req.body;
        
        // Validate required fields
        if (!requestData.accountName || !requestData.requestedBy || !requestData.changes) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accountName, requestedBy, changes'
            });
        }
        
        const result = await productUpdateService.createProductUpdateRequest(requestData);
        
        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (err) {
        console.error('❌ Error creating product update request:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create product update request'
        });
    }
});

/**
 * Get pending product update requests
 * GET /api/product-update/requests
 * Optional query params: accountName, status, requestedBy
 */
app.get('/api/product-update/requests', async (req, res) => {
    try {
        const filters = {
            accountName: req.query.accountName,
            status: req.query.status,
            requestedBy: req.query.requestedBy
        };
        
        const result = await productUpdateService.getPendingProductUpdateRequests(filters);
        res.json(result);
    } catch (err) {
        console.error('❌ Error fetching product update requests:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product update requests',
            requests: []
        });
    }
});

/**
 * Get a specific product update request
 * GET /api/product-update/requests/:identifier
 */
app.get('/api/product-update/requests/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const result = await productUpdateService.getProductUpdateRequest(identifier);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (err) {
        console.error('❌ Error fetching product update request:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product update request'
        });
    }
});

/**
 * Update product update request status
 * PATCH /api/product-update/requests/:identifier/status
 */
app.patch('/api/product-update/requests/:identifier/status', async (req, res) => {
    try {
        const { identifier } = req.params;
        const { status, approvalNotes, errorMessage, psRecordId, psRecordName } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }
        
        const result = await productUpdateService.updateProductUpdateRequestStatus(
            identifier,
            status,
            { approvalNotes, errorMessage, psRecordId, psRecordName }
        );
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (err) {
        console.error('❌ Error updating request status:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update request status'
        });
    }
});

/**
 * Delete a product update request
 * DELETE /api/product-update/requests/:identifier
 */
app.delete('/api/product-update/requests/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const result = await productUpdateService.deleteProductUpdateRequest(identifier);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (err) {
        console.error('❌ Error deleting product update request:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to delete product update request'
        });
    }
});

/**
 * Get product update request history
 * GET /api/product-update/requests/:identifier/history
 */
app.get('/api/product-update/requests/:identifier/history', async (req, res) => {
    try {
        const { identifier } = req.params;
        const result = await productUpdateService.getProductUpdateRequestHistory(identifier);
        res.json(result);
    } catch (err) {
        console.error('❌ Error fetching request history:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch request history',
            history: []
        });
    }
});

/**
 * Refresh product options from PS audit trail
 * POST /api/product-update/options/refresh
 */
app.post('/api/product-update/options/refresh', async (req, res) => {
    try {
        const result = await productUpdateService.refreshProductOptions();
        res.json(result);
    } catch (err) {
        console.error('❌ Error refreshing product options:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh product options'
        });
    }
});

// ===== PACKAGE ENDPOINTS =====

/**
 * Get all packages
 * GET /api/packages
 * Optional query params: type (Base/Expansion), includeDeleted (boolean)
 */
app.get('/api/packages', async (req, res) => {
    try {
        const { type, includeDeleted } = req.query;
        
        console.log(`📦 Fetching packages (type: ${type || 'all'}, includeDeleted: ${includeDeleted || 'false'})`);
        
        let result;
        
        if (type === 'Base') {
            result = await db.getBasePackages();
        } else if (type === 'Expansion') {
            result = await db.getExpansionPackages();
        } else {
            result = await db.getAllPackages({
                includeDeleted: includeDeleted === 'true'
            });
        }
        
        if (result.success) {
            res.json({
                success: true,
                packages: result.packages,
                count: result.count,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                packages: []
            });
        }
    } catch (err) {
        console.error('❌ Error fetching packages:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch packages',
            packages: []
        });
    }
});

/**
 * Get a specific package by name or ID
 * GET /api/packages/:identifier
 * Identifier can be: package name, RI package name, or Salesforce ID
 */
app.get('/api/packages/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        console.log(`🔍 Fetching package: ${identifier}`);
        
        // Try to find by name first (most common), then by SF ID
        let result = await db.getPackageByName(identifier);
        
        if (!result.success || !result.package) {
            // Try by Salesforce ID
            result = await db.getPackageBySfId(identifier);
        }
        
        if (result.success && result.package) {
            res.json({
                success: true,
                package: result.package,
                timestamp: new Date().toISOString()
            });
        } else if (result.success && !result.package) {
            res.status(404).json({
                success: false,
                error: `Package not found: ${identifier}`,
                package: null
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                package: null
            });
        }
    } catch (err) {
        console.error('❌ Error fetching package:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch package',
            package: null
        });
    }
});

/**
 * Get packages summary statistics
 * GET /api/packages/summary/stats
 */
app.get('/api/packages/summary/stats', async (req, res) => {
    try {
        console.log('📊 Fetching packages summary...');
        
        const result = await db.getPackagesSummary();
        
        if (result.success) {
            res.json({
                success: true,
                summary: result.summary,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                summary: null
            });
        }
    } catch (err) {
        console.error('❌ Error fetching packages summary:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch packages summary',
            summary: null
        });
    }
});

// ===== PRODUCT CATALOGUE API ENDPOINTS =====

/**
 * Get product catalogue from local database
 * GET /api/product-catalogue
 * Query params: 
 *   - search: search term for product name/code/description
 *   - family: filter by product family
 *   - isActive: filter by active status (default: true)
 *   - limit: max results (default: 100, max: 500)
 *   - offset: pagination offset (default: 0)
 */
app.get('/api/product-catalogue', authenticate, async (req, res) => {
    try {
        const { search, family, productGroup, productSelectionGrouping, isActive = 'true', limit = 100, offset = 0 } = req.query;
        
        console.log(`📦 Fetching product catalogue from local DB (search: ${search || 'none'}, family: ${family || 'all'}, productGroup: ${productGroup || 'all'}, productSelectionGrouping: ${productSelectionGrouping || 'all'})`);
        
        // Build SQL query
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        
        // Add active filter
        if (isActive === 'true') {
            whereConditions.push(`is_active = $${paramIndex++}`);
            queryParams.push(true);
            whereConditions.push(`is_archived = $${paramIndex++}`);
            queryParams.push(false);
        }
        
        // Add family filter
        if (family && family !== 'all') {
            whereConditions.push(`family = $${paramIndex++}`);
            queryParams.push(family);
        }
        
        // Add product group filter
        if (productGroup && productGroup !== 'all') {
            whereConditions.push(`product_group = $${paramIndex++}`);
            queryParams.push(productGroup);
        }
        
        // Add product selection grouping filter
        if (productSelectionGrouping && productSelectionGrouping !== 'all') {
            whereConditions.push(`product_selection_grouping = $${paramIndex++}`);
            queryParams.push(productSelectionGrouping);
        }
        
        // Add search filter (using full-text search or ILIKE)
        if (search) {
            whereConditions.push(`(
                name ILIKE $${paramIndex} OR 
                product_code ILIKE $${paramIndex} OR 
                description ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
        const countResult = await db.query(countQuery, queryParams);
        const totalSize = parseInt(countResult.rows[0].total);
        
        // Get products with pagination
        const limitValue = Math.min(parseInt(limit) || 100, 2000);  // Increased cap to 2000 to load all products
        const offsetValue = parseInt(offset) || 0;
        
        const productsQuery = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                is_active as "IsActive",
                is_archived as "IsArchived",
                display_url as "DisplayUrl",
                product_group as "Product_Group__c",
                product_family_l2 as "Product_Family_L2__c",
                product_reporting_group as "ProductReportingGroup__c",
                product_variant as "Product_Variant__c",
                product_versions as "ProductVersions__c",
                type_of_configuration as "TypeOfConfiguration__c",
                is_expansion_pack as "IsExpansionPack__c",
                product_selection_grouping as "Product_Selection_Grouping__c"
            FROM products
            ${whereClause}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        queryParams.push(limitValue, offsetValue);
        const productsResult = await db.query(productsQuery, queryParams);
        
        // Get distinct families for filter options
        const familiesQuery = `
            SELECT DISTINCT family 
            FROM products 
            WHERE is_active = true AND is_archived = false AND family IS NOT NULL
            ORDER BY family
        `;
        const familiesResult = await db.query(familiesQuery);
        const families = familiesResult.rows.map(r => r.family);
        
        // Get distinct product groups for filter options
        const productGroupsQuery = `
            SELECT DISTINCT product_group 
            FROM products 
            WHERE is_active = true AND is_archived = false AND product_group IS NOT NULL
            ORDER BY product_group
        `;
        const productGroupsResult = await db.query(productGroupsQuery);
        const productGroups = productGroupsResult.rows.map(r => r.product_group);
        
        // Get distinct product selection groupings for filter options
        const productSelectionGroupingsQuery = `
            SELECT DISTINCT product_selection_grouping 
            FROM products 
            WHERE is_active = true AND is_archived = false AND product_selection_grouping IS NOT NULL
            ORDER BY product_selection_grouping
        `;
        const productSelectionGroupingsResult = await db.query(productSelectionGroupingsQuery);
        const productSelectionGroupings = productSelectionGroupingsResult.rows.map(r => r.product_selection_grouping);
        
        res.json({
            success: true,
            products: productsResult.rows,
            count: productsResult.rows.length,
            totalSize: totalSize,
            done: (offsetValue + productsResult.rows.length) >= totalSize,
            filterOptions: {
                families: families,
                productGroups: productGroups,
                productSelectionGroupings: productSelectionGroupings
            },
            timestamp: new Date().toISOString(),
            source: 'local_database'
        });
        
    } catch (err) {
        console.error('❌ Error fetching product catalogue:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product catalogue',
            products: [],
            message: err.message
        });
    }
});

/**
 * Get a specific product by ID from local database
 * GET /api/product-catalogue/:productId
 */
app.get('/api/product-catalogue/:productId', authenticate, async (req, res) => {
    try {
        const { productId } = req.params;
        
        console.log(`🔍 Fetching product details from local DB: ${productId}`);
        
        // Query product with all fields
        const query = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                is_active as "IsActive",
                is_archived as "IsArchived",
                display_url as "DisplayUrl",
                product_group as "Product_Group__c",
                product_family_l2 as "Product_Family_L2__c",
                product_reporting_group as "ProductReportingGroup__c",
                product_variant as "Product_Variant__c",
                product_versions as "ProductVersions__c",
                type_of_configuration as "TypeOfConfiguration__c",
                is_expansion_pack as "IsExpansionPack__c",
                product_selection_grouping as "Product_Selection_Grouping__c",
                product_selection_restriction as "Product_Selection_Restriction__c",
                sf_created_date as "CreatedDate",
                sf_last_modified_date as "LastModifiedDate",
                sf_created_by_id as "CreatedById",
                sf_last_modified_by_id as "LastModifiedById",
                synced_at
            FROM products
            WHERE salesforce_id = $1
            LIMIT 1
        `;
        
        const result = await db.query(query, [productId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found',
                product: null
            });
        }
        
        res.json({
            success: true,
            product: result.rows[0],
            timestamp: new Date().toISOString(),
            source: 'local_database'
        });
        
    } catch (err) {
        console.error('❌ Error fetching product:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch product',
            product: null,
            message: err.message
        });
    }
});

/**
 * Refresh product catalogue from Salesforce
 * POST /api/product-catalogue/refresh
 * Triggers a sync of all products from Salesforce to local database
 */
app.post('/api/product-catalogue/refresh', authenticate, requireAdmin, async (req, res) => {
    try {
        console.log('🔄 Triggering product catalogue refresh from Salesforce...');
        
        // Spawn the sync process in background
        const { spawn } = require('child_process');
        const syncProcess = spawn('node', ['sync-products-from-salesforce.js'], {
            detached: true,
            stdio: 'ignore'
        });
        syncProcess.unref();
        
        res.json({
            success: true,
            message: 'Product refresh started in background',
            note: 'Check product_sync_log table for progress',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error triggering product refresh:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger product refresh',
            message: err.message
        });
    }
});

/**
 * Get product sync status and history
 * GET /api/product-catalogue/sync-status
 */
app.get('/api/product-catalogue/sync-status', authenticate, async (req, res) => {
    try {
        console.log('📊 Fetching product sync status...');
        
        // Get latest sync log
        const latestSync = await db.query(`
            SELECT * FROM product_sync_log
            ORDER BY sync_started_at DESC
            LIMIT 1
        `);
        
        // Get product count
        const productCount = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_active = true) as active,
                COUNT(*) FILTER (WHERE is_archived = true) as archived
            FROM products
        `);
        
        // Get last sync time
        const lastSyncTime = await db.query(`
            SELECT MAX(synced_at) as last_sync FROM products
        `);
        
        res.json({
            success: true,
            syncStatus: latestSync.rows[0] || null,
            productStats: {
                total: parseInt(productCount.rows[0].total),
                active: parseInt(productCount.rows[0].active),
                archived: parseInt(productCount.rows[0].archived),
                lastSync: lastSyncTime.rows[0].last_sync
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error fetching sync status:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sync status',
            message: err.message
        });
    }
});

// ===== PRODUCT BUNDLES API ENDPOINTS =====

/**
 * Get all product bundles
 * GET /api/bundles
 * Query params:
 *   - search: search term for bundle name/description
 *   - sortBy: 'name', 'created_at' (default: 'created_at')
 *   - sortOrder: 'asc', 'desc' (default: 'desc')
 */
app.get('/api/bundles', authenticate, async (req, res) => {
    try {
        const { search, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
        
        console.log(`📦 Fetching bundles (search: ${search || 'none'}, sortBy: ${sortBy}, sortOrder: ${sortOrder})`);
        
        let whereCondition = '';
        let queryParams = [];
        
        if (search) {
            whereCondition = 'WHERE name ILIKE $1 OR description ILIKE $1';
            queryParams.push(`%${search}%`);
        }
        
        // Validate sort parameters
        const validSortFields = ['name', 'created_at'];
        const validSortOrders = ['asc', 'desc'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';
        
        const query = `
            SELECT 
                pb.id,
                pb.bundle_id,
                pb.name,
                pb.description,
                pb.created_by,
                pb.created_at,
                pb.updated_at,
                u.username as created_by_username,
                COUNT(bp.id) as product_count
            FROM product_bundles pb
            LEFT JOIN users u ON pb.created_by = u.id
            LEFT JOIN bundle_products bp ON pb.id = bp.bundle_id
            ${whereCondition}
            GROUP BY pb.id, pb.bundle_id, pb.name, pb.description, pb.created_by, pb.created_at, pb.updated_at, u.username
            ORDER BY pb.${sortField} ${sortDirection}
        `;
        
        const result = await db.query(query, queryParams);
        
        res.json({
            success: true,
            bundles: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error fetching bundles:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bundles',
            message: err.message
        });
    }
});

/**
 * Get a specific bundle with its products
 * GET /api/bundles/:bundleId
 */
app.get('/api/bundles/:bundleId', authenticate, async (req, res) => {
    try {
        const { bundleId } = req.params;
        
        console.log(`🔍 Fetching bundle details: ${bundleId}`);
        
        // Get bundle info
        const bundleQuery = `
            SELECT 
                pb.id,
                pb.bundle_id,
                pb.name,
                pb.description,
                pb.created_by,
                pb.created_at,
                pb.updated_at,
                u.username as created_by_username
            FROM product_bundles pb
            LEFT JOIN users u ON pb.created_by = u.id
            WHERE pb.bundle_id = $1 OR pb.id::text = $1
        `;
        
        const bundleResult = await db.query(bundleQuery, [bundleId]);
        
        if (bundleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        const bundle = bundleResult.rows[0];
        
        // Get products in bundle
        const productsQuery = `
            SELECT 
                bp.id as bundle_product_id,
                bp.quantity,
                bp.sort_order,
                bp.added_at,
                p.salesforce_id as "Id",
                p.name as "Name",
                p.product_code as "ProductCode",
                p.description as "Description",
                p.family as "Family",
                p.is_active as "IsActive",
                p.product_group as "Product_Group__c",
                p.product_selection_grouping as "Product_Selection_Grouping__c"
            FROM bundle_products bp
            LEFT JOIN products p ON bp.product_salesforce_id = p.salesforce_id
            WHERE bp.bundle_id = $1
            ORDER BY bp.sort_order, bp.added_at
        `;
        
        const productsResult = await db.query(productsQuery, [bundle.id]);
        
        res.json({
            success: true,
            bundle: {
                ...bundle,
                products: productsResult.rows
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error fetching bundle:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bundle',
            message: err.message
        });
    }
});

/**
 * Create a new bundle
 * POST /api/bundles
 * Body: { name, description }
 */
app.post('/api/bundles', authenticate, async (req, res) => {
    try {
        const { name, description = '' } = req.body;
        const userId = req.user.id;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bundle name is required'
            });
        }
        
        console.log(`📦 Creating new bundle: ${name}`);
        
        // Generate sequential bundle ID
        const sequenceResult = await db.query("SELECT nextval('bundle_id_seq') as seq");
        const sequenceNum = sequenceResult.rows[0].seq;
        const bundleId = `BUNDLE-${String(sequenceNum).padStart(3, '0')}`;
        
        // Insert bundle
        const query = `
            INSERT INTO product_bundles (bundle_id, name, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING 
                id,
                bundle_id,
                name,
                description,
                created_by,
                created_at,
                updated_at
        `;
        
        const result = await db.query(query, [bundleId, name.trim(), description.trim(), userId]);
        
        res.status(201).json({
            success: true,
            bundle: result.rows[0],
            message: 'Bundle created successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error creating bundle:', err.message);
        
        if (err.constraint === 'unique_bundle_name') {
            return res.status(409).json({
                success: false,
                error: 'A bundle with this name already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to create bundle',
            message: err.message
        });
    }
});

/**
 * Update a bundle
 * PUT /api/bundles/:bundleId
 * Body: { name, description }
 */
app.put('/api/bundles/:bundleId', authenticate, async (req, res) => {
    try {
        const { bundleId } = req.params;
        const { name, description } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Bundle name is required'
            });
        }
        
        console.log(`📝 Updating bundle: ${bundleId}`);
        
        const query = `
            UPDATE product_bundles
            SET 
                name = $1,
                description = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE bundle_id = $3 OR id::text = $3
            RETURNING 
                id,
                bundle_id,
                name,
                description,
                created_by,
                created_at,
                updated_at
        `;
        
        const result = await db.query(query, [name.trim(), description?.trim() || '', bundleId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        res.json({
            success: true,
            bundle: result.rows[0],
            message: 'Bundle updated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error updating bundle:', err.message);
        
        if (err.constraint === 'unique_bundle_name') {
            return res.status(409).json({
                success: false,
                error: 'A bundle with this name already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to update bundle',
            message: err.message
        });
    }
});

/**
 * Delete a bundle
 * DELETE /api/bundles/:bundleId
 */
app.delete('/api/bundles/:bundleId', authenticate, async (req, res) => {
    try {
        const { bundleId } = req.params;
        
        console.log(`🗑️ Deleting bundle: ${bundleId}`);
        
        const query = `
            DELETE FROM product_bundles
            WHERE bundle_id = $1 OR id::text = $1
            RETURNING bundle_id, name
        `;
        
        const result = await db.query(query, [bundleId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        res.json({
            success: true,
            message: `Bundle "${result.rows[0].name}" deleted successfully`,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error deleting bundle:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to delete bundle',
            message: err.message
        });
    }
});

/**
 * Duplicate a bundle
 * POST /api/bundles/:bundleId/duplicate
 * Body: { name }
 */
app.post('/api/bundles/:bundleId/duplicate', authenticate, async (req, res) => {
    try {
        const { bundleId } = req.params;
        const { name } = req.body;
        const userId = req.user.id;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'New bundle name is required'
            });
        }
        
        console.log(`📋 Duplicating bundle: ${bundleId} as "${name}"`);
        
        // Get original bundle
        const originalBundle = await db.query(
            'SELECT * FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (originalBundle.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        // Generate new bundle ID
        const sequenceResult = await db.query("SELECT nextval('bundle_id_seq') as seq");
        const sequenceNum = sequenceResult.rows[0].seq;
        const newBundleId = `BUNDLE-${String(sequenceNum).padStart(3, '0')}`;
        
        // Create new bundle
        const insertBundleQuery = `
            INSERT INTO product_bundles (bundle_id, name, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id, bundle_id, name, description, created_by, created_at, updated_at
        `;
        
        const newBundle = await db.query(insertBundleQuery, [
            newBundleId,
            name.trim(),
            originalBundle.rows[0].description,
            userId
        ]);
        
        // Copy products from original bundle
        const copyProductsQuery = `
            INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
            SELECT $1, product_salesforce_id, quantity, sort_order
            FROM bundle_products
            WHERE bundle_id = $2
        `;
        
        await db.query(copyProductsQuery, [newBundle.rows[0].id, originalBundle.rows[0].id]);
        
        res.status(201).json({
            success: true,
            bundle: newBundle.rows[0],
            message: 'Bundle duplicated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error duplicating bundle:', err.message);
        
        if (err.constraint === 'unique_bundle_name') {
            return res.status(409).json({
                success: false,
                error: 'A bundle with this name already exists'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to duplicate bundle',
            message: err.message
        });
    }
});

/**
 * Add products to a bundle
 * POST /api/bundles/:bundleId/products
 * Body: { products: [{ productId, quantity }] }
 */
app.post('/api/bundles/:bundleId/products', authenticate, async (req, res) => {
    try {
        const { bundleId } = req.params;
        const { products } = req.body;
        
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Products array is required'
            });
        }
        
        console.log(`➕ Adding ${products.length} product(s) to bundle: ${bundleId}`);
        
        // Get bundle internal ID
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        const bundleInternalId = bundleResult.rows[0].id;
        
        // Get current max sort_order
        const maxSortResult = await db.query(
            'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM bundle_products WHERE bundle_id = $1',
            [bundleInternalId]
        );
        let sortOrder = maxSortResult.rows[0].max_sort + 1;
        
        // Insert products
        const insertedProducts = [];
        for (const product of products) {
            const { productId, quantity = 1 } = product;
            
            try {
                const insertQuery = `
                    INSERT INTO bundle_products (bundle_id, product_salesforce_id, quantity, sort_order)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (bundle_id, product_salesforce_id) DO UPDATE
                    SET quantity = bundle_products.quantity + EXCLUDED.quantity
                    RETURNING id, product_salesforce_id, quantity, sort_order
                `;
                
                const result = await db.query(insertQuery, [bundleInternalId, productId, quantity, sortOrder]);
                insertedProducts.push(result.rows[0]);
                sortOrder++;
            } catch (err) {
                console.error(`Failed to add product ${productId}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            addedProducts: insertedProducts,
            count: insertedProducts.length,
            message: `${insertedProducts.length} product(s) added to bundle`,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error adding products to bundle:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to add products to bundle',
            message: err.message
        });
    }
});

/**
 * Update product quantity in bundle
 * PUT /api/bundles/:bundleId/products/:productId
 * Body: { quantity }
 */
app.put('/api/bundles/:bundleId/products/:productId', authenticate, async (req, res) => {
    try {
        const { bundleId, productId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                error: 'Valid quantity is required (minimum 1)'
            });
        }
        
        console.log(`📝 Updating product quantity in bundle ${bundleId}: ${productId} = ${quantity}`);
        
        // Get bundle internal ID
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        const query = `
            UPDATE bundle_products
            SET quantity = $1
            WHERE bundle_id = $2 AND product_salesforce_id = $3
            RETURNING id, product_salesforce_id, quantity
        `;
        
        const result = await db.query(query, [quantity, bundleResult.rows[0].id, productId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in bundle'
            });
        }
        
        res.json({
            success: true,
            product: result.rows[0],
            message: 'Product quantity updated',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error updating product quantity:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update product quantity',
            message: err.message
        });
    }
});

/**
 * Remove a product from bundle
 * DELETE /api/bundles/:bundleId/products/:productId
 */
app.delete('/api/bundles/:bundleId/products/:productId', authenticate, async (req, res) => {
    try {
        const { bundleId, productId } = req.params;
        
        console.log(`➖ Removing product from bundle ${bundleId}: ${productId}`);
        
        // Get bundle internal ID
        const bundleResult = await db.query(
            'SELECT id FROM product_bundles WHERE bundle_id = $1 OR id::text = $1',
            [bundleId]
        );
        
        if (bundleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Bundle not found'
            });
        }
        
        const query = `
            DELETE FROM bundle_products
            WHERE bundle_id = $1 AND product_salesforce_id = $2
            RETURNING product_salesforce_id
        `;
        
        const result = await db.query(query, [bundleResult.rows[0].id, productId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in bundle'
            });
        }
        
        res.json({
            success: true,
            message: 'Product removed from bundle',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error removing product from bundle:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to remove product from bundle',
            message: err.message
        });
    }
});

// ===== PS AUDIT TRAIL API ENDPOINTS =====
const psAuditService = require('./ps-audit-service');

// Get audit trail for a specific PS record
app.get('/api/audit-trail/ps-record/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        console.log(`🔍 Fetching audit trail for PS record: ${identifier}`);
        
        const result = await psAuditService.getPSAuditTrail(identifier);
        
        if (result.success) {
            res.json({
                success: true,
                identifier: result.identifier,
                recordCount: result.recordCount,
                records: result.records,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                identifier: result.identifier,
                records: []
            });
        }
    } catch (err) {
        console.error('❌ Error fetching PS audit trail:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit trail',
            records: []
        });
    }
});

// Get status change history for a PS record
app.get('/api/audit-trail/status-changes/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        console.log(`📊 Fetching status changes for PS record: ${identifier}`);
        
        const result = await psAuditService.getPSStatusChanges(identifier);
        
        if (result.success) {
            res.json({
                success: true,
                identifier: result.identifier,
                changeCount: result.changeCount,
                changes: result.changes,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                identifier: result.identifier,
                changes: []
            });
        }
    } catch (err) {
        console.error('❌ Error fetching status changes:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch status changes',
            changes: []
        });
    }
});

// Get audit trail statistics
app.get('/api/audit-trail/stats', async (req, res) => {
    try {
        console.log('📊 Fetching audit trail statistics...');
        
        const result = await psAuditService.getAuditStats();
        
        if (result.success) {
            res.json({
                success: true,
                stats: result.stats,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                stats: null
            });
        }
    } catch (err) {
        console.error('❌ Error fetching audit stats:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit statistics',
            stats: null
        });
    }
});

// Search for PS records in audit trail
app.get('/api/audit-trail/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || req.query.search || '';
        console.log(`🔍 Searching audit trail for: ${searchTerm}`);
        
        if (!searchTerm || searchTerm.length < 2) {
            return res.json({
                success: true,
                results: [],
                searchTerm: searchTerm
            });
        }
        
        // Search in the ps_audit_latest view for matching PS records
        const query = `
            SELECT DISTINCT 
                ps_record_id,
                ps_record_name,
                account_name,
                status,
                captured_at
            FROM ps_audit_latest
            WHERE ps_record_name ILIKE $1
               OR account_name ILIKE $1
               OR ps_record_id ILIKE $1
            ORDER BY captured_at DESC
            LIMIT 20
        `;
        
        const result = await db.query(query, [`%${searchTerm}%`]);
        
        res.json({
            success: true,
            results: result.rows,
            searchTerm: searchTerm,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error searching audit trail:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to search audit trail',
            results: []
        });
    }
});

// Trigger manual capture of current PS records (admin/testing function)
// Note: Automatic capture runs every 5 minutes via scheduled task (setup-audit-capture-task.ps1)
app.post('/api/audit-trail/capture', async (req, res) => {
    try {
        console.log('🔄 Manual capture triggered...');
        
        // This is a lightweight endpoint for testing
        // The actual capture happens via the scheduled task (capture-ps-changes.js)
        // To truly trigger a capture, run: node capture-ps-changes.js
        
        res.json({
            success: true,
            message: 'Manual capture noted. For full capture, the scheduled task runs every 5 minutes automatically.',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error triggering capture:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger capture'
        });
    }
});

// Get PS request volume statistics
app.get('/api/audit-trail/ps-volume', async (req, res) => {
    try {
        console.log('📊 Fetching PS request volume statistics...');
        
        // Get time period from query params (default: 6 months)
        const months = parseInt(req.query.months) || 6;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - months);
        
        console.log(`   Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Query to get unique PS records created in the time period, grouped by week
        const weeklyQuery = `
            WITH unique_ps_records AS (
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    ps_record_name,
                    created_date,
                    account_name,
                    status,
                    request_type
                FROM ps_audit_trail
                WHERE created_date >= $1 
                  AND created_date <= $2
                  AND created_date IS NOT NULL
                ORDER BY ps_record_id, captured_at ASC
            ),
            weekly_aggregation AS (
                SELECT 
                    DATE_TRUNC('week', created_date) as week_start,
                    COUNT(*) as requests_created,
                    COUNT(DISTINCT account_name) as unique_accounts,
                    ARRAY_AGG(DISTINCT request_type) FILTER (WHERE request_type IS NOT NULL) as request_types
                FROM unique_ps_records
                GROUP BY DATE_TRUNC('week', created_date)
                ORDER BY week_start ASC
            )
            SELECT 
                week_start,
                TO_CHAR(week_start, 'Mon DD, YYYY') as week_label,
                requests_created,
                unique_accounts,
                request_types
            FROM weekly_aggregation
            ORDER BY week_start ASC
        `;
        
        const weeklyResult = await database.query(weeklyQuery, [startDate, endDate]);
        
        // Get overall statistics
        const statsQuery = `
            WITH unique_ps_records AS (
                SELECT DISTINCT ON (ps_record_id)
                    ps_record_id,
                    ps_record_name,
                    created_date,
                    account_name,
                    request_type
                FROM ps_audit_trail
                WHERE created_date >= $1 
                  AND created_date <= $2
                  AND created_date IS NOT NULL
                ORDER BY ps_record_id, captured_at ASC
            )
            SELECT 
                COUNT(*) as total_requests,
                COUNT(DISTINCT account_name) as unique_accounts,
                MIN(created_date) as earliest_request,
                MAX(created_date) as latest_request,
                COUNT(*) FILTER (WHERE request_type = 'New') as new_requests,
                COUNT(*) FILTER (WHERE request_type = 'Update') as update_requests,
                COUNT(*) FILTER (WHERE request_type = 'Deprovision') as deprovision_requests
            FROM unique_ps_records
        `;
        
        const statsResult = await database.query(statsQuery, [startDate, endDate]);
        const stats = statsResult.rows[0];
        
        // Calculate averages
        const daysInPeriod = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        const weeksInPeriod = daysInPeriod / 7;
        const totalWeeks = weeklyResult.rows.length;
        const totalRequests = parseInt(stats.total_requests || 0);
        const averagePerWeek = totalWeeks > 0 ? (totalRequests / totalWeeks) : 0;
        const averagePerDay = daysInPeriod > 0 ? (totalRequests / daysInPeriod) : 0;
        
        console.log(`✅ Found ${totalRequests} PS requests over ${totalWeeks} weeks`);
        console.log(`   Average: ${averagePerWeek.toFixed(2)} requests/week`);
        
        res.json({
            success: true,
            period: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                months: months,
                daysInPeriod: daysInPeriod,
                weeksInPeriod: parseFloat(weeksInPeriod.toFixed(1))
            },
            totals: {
                totalRequests: totalRequests,
                uniqueAccounts: parseInt(stats.unique_accounts || 0),
                weeksWithActivity: totalWeeks
            },
            averages: {
                requestsPerWeek: parseFloat(averagePerWeek.toFixed(2)),
                requestsPerDay: parseFloat(averagePerDay.toFixed(2))
            },
            requestTypes: {
                new: parseInt(stats.new_requests || 0),
                update: parseInt(stats.update_requests || 0),
                deprovision: parseInt(stats.deprovision_requests || 0)
            },
            weeklyData: weeklyResult.rows.map(row => ({
                weekStart: row.week_start,
                weekLabel: row.week_label,
                requestsCreated: parseInt(row.requests_created),
                uniqueAccounts: parseInt(row.unique_accounts),
                requestTypes: row.request_types || []
            })),
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error fetching PS volume stats:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch PS request volume statistics',
            details: err.message
        });
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Backend server is running on http://0.0.0.0:${PORT}`);
        console.log(`📁 Serving static files from ./public`);
        console.log(`🌐 API URL: http://localhost:${PORT}`);
        console.log(`🔗 Direct Atlassian API Integration: No MCP configuration required`);
        console.log('');
        console.log('💡 For development with hot reload:');
        console.log('   1. This backend is running on port 5000');
        console.log('   2. Run "npm run dev:frontend" in another terminal');
        console.log('   3. Access frontend at http://localhost:8080');
    });
}

module.exports = app;
