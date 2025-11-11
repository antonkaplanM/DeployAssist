
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

// ===== EXTRACTED ROUTE MODULES =====
const bundlesRoutes = require('./routes/bundles.routes');
const customerProductsRoutes = require('./routes/customer-products.routes');
const packageMappingsRoutes = require('./routes/package-mappings.routes');
const validationRoutes = require('./routes/validation.routes');
const productUpdatesRoutes = require('./routes/product-updates.routes');
const packagesRoutes = require('./routes/packages.routes');
const psAuditRoutes = require('./routes/ps-audit.routes');
const ghostAccountsRoutes = require('./routes/ghost-accounts.routes');
const expirationRoutes = require('./routes/expiration.routes');
const productCatalogueRoutes = require('./routes/product-catalogue.routes');
const packageChangesRoutes = require('./routes/package-changes.routes');
const salesforceApiRoutes = require('./routes/salesforce-api.routes');

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

// ===== EXTRACTED ROUTE MODULES - MOUNTED HERE =====

// Salesforce OAuth, Analytics, Provisioning (handles /auth/*, /api/analytics/*, /api/provisioning/*)
app.use('/', salesforceApiRoutes);

// Validation endpoints
app.use('/api/validation', validationRoutes);

// Expiration Monitor endpoints
app.use('/api/expiration', expirationRoutes);

// Package Change Analytics endpoints
app.use('/api/analytics/package-changes', packageChangesRoutes);

// Ghost Accounts endpoints
app.use('/api/ghost-accounts', ghostAccountsRoutes);

// Customer Products endpoints
app.use('/api/customer-products', customerProductsRoutes);

// Product Update Workflow endpoints
app.use('/api/product-update', productUpdatesRoutes);

// Package Management endpoints
app.use('/api/packages', packagesRoutes);

// Package-Product Mapping endpoints
app.use('/api/package-mappings', packageMappingsRoutes);

// Product Catalogue endpoints (requires authentication)
app.use('/api/product-catalogue', authenticate, productCatalogueRoutes);

// Product Bundles endpoints
app.use('/api/bundles', bundlesRoutes);

// PS Audit Trail endpoints
app.use('/api/audit-trail', psAuditRoutes);

console.log('✅ All extracted route modules mounted successfully');

// [SALESFORCE API ENDPOINTS EXTRACTED TO routes/salesforce-api.routes.js]

// [VALIDATION ERRORS EXTRACTED - See routes/]



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

// [EXPIRATION MONITOR EXTRACTED - See routes/]

// [PACKAGE CHANGE ANALYSIS EXTRACTED - See routes/]

// [GHOST ACCOUNTS EXTRACTED - See routes/]

// ===== SML GHOST ACCOUNTS API ENDPOINTS =====

const SMLGhostAccountsService = require('./sml-ghost-accounts-service');
const SMLService = require('./sml-service');
const smlGhostService = new SMLGhostAccountsService();
const smlServiceInstance = new SMLService(); // Single instance for auth checking

// Get SML ghost accounts with filters
app.get('/api/sml-ghost-accounts', async (req, res) => {
    try {
        console.log('👻 SML ghost accounts API called...', req.query);
        
        const filters = {
            isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
            accountSearch: req.query.accountSearch,
            expiryBefore: req.query.expiryBefore,
            expiryAfter: req.query.expiryAfter,
        };
        
        // Handle product codes (can be comma-separated string or array)
        if (req.query.productCodes) {
            filters.productCodes = typeof req.query.productCodes === 'string'
                ? req.query.productCodes.split(',').map(code => code.trim()).filter(code => code)
                : req.query.productCodes;
        }
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });
        
        console.log(`📊 Fetching SML ghost accounts with filters:`, filters);
        
        // Use the product-aware function if productCodes is provided
        const result = filters.productCodes && filters.productCodes.length > 0
            ? await db.getSMLGhostAccountsByProduct(filters)
            : await db.getSMLGhostAccounts(filters);
        const summaryResult = await db.getSMLGhostAccountsSummary();
        
        if (result.success) {
            res.json({
                success: true,
                ghostAccounts: result.ghostAccounts,
                summary: summaryResult.summary,
                dataSource: 'sml',
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
        console.error('❌ Error fetching SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch SML ghost accounts',
            ghostAccounts: []
        });
    }
});

// Get unique expired products from SML ghost accounts (for filtering)
app.get('/api/sml-ghost-accounts/unique-products', async (req, res) => {
    try {
        console.log('🔍 Fetching unique expired products from SML ghost accounts...');
        
        const result = await db.getSMLUniqueExpiredProducts();
        
        if (result.success) {
            res.json({
                success: true,
                productsByCategory: result.productsByCategory,
                count: result.count,
                dataSource: 'sml',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                productsByCategory: { apps: [], models: [], data: [] },
                count: 0
            });
        }
    } catch (err) {
        console.error('❌ Error fetching unique expired products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch unique expired products',
            products: [],
            count: 0
        });
    }
});

// Export SML ghost accounts to Excel with expired products
app.get('/api/sml-ghost-accounts/export', async (req, res) => {
    try {
        console.log('📥 Exporting SML ghost accounts to Excel...');
        
        const ExcelJS = require('exceljs');
        
        // Get filters from query params (same as regular ghost accounts endpoint)
        const filters = {
            isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
            accountSearch: req.query.accountSearch,
            expiryBefore: req.query.expiryBefore,
            expiryAfter: req.query.expiryAfter,
        };
        
        // Handle product codes
        if (req.query.productCodes) {
            filters.productCodes = typeof req.query.productCodes === 'string'
                ? req.query.productCodes.split(',').map(code => code.trim()).filter(code => code)
                : req.query.productCodes;
        }
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });
        
        // Fetch ghost accounts with filters
        const result = filters.productCodes && filters.productCodes.length > 0
            ? await db.getSMLGhostAccountsByProduct(filters)
            : await db.getSMLGhostAccounts(filters);
        
        if (!result.success || !result.ghostAccounts || result.ghostAccounts.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No ghost accounts found to export'
            });
        }
        
        const ghostAccounts = result.ghostAccounts;
        
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ghost Accounts');
        
        // Define columns
        worksheet.columns = [
            { header: 'Tenant ID', key: 'tenantId', width: 15 },
            { header: 'Tenant Name', key: 'tenantName', width: 25 },
            { header: 'Account Name', key: 'accountName', width: 25 },
            { header: 'Total Expired Products', key: 'totalExpiredProducts', width: 20 },
            { header: 'Latest Expiry Date', key: 'latestExpiryDate', width: 18 },
            { header: 'Days Since Expiry', key: 'daysSinceExpiry', width: 18 },
            { header: 'Review Status', key: 'reviewStatus', width: 15 },
            { header: 'Reviewed At', key: 'reviewedAt', width: 18 },
            { header: 'Reviewed By', key: 'reviewedBy', width: 20 },
            { header: 'Expired Products', key: 'expiredProducts', width: 50 },
            { header: 'Product Categories', key: 'productCategories', width: 30 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Fetch products for each ghost account and add rows
        for (const account of ghostAccounts) {
            // Fetch products for this tenant
            const tenantResult = await db.getSMLTenantById(account.tenant_id);
            
            let expiredProductsList = [];
            let productCategories = new Set();
            
            if (tenantResult.success && tenantResult.tenant) {
                const tenant = tenantResult.tenant;
                const productEntitlements = typeof tenant.product_entitlements === 'string' 
                    ? JSON.parse(tenant.product_entitlements)
                    : tenant.product_entitlements;
                
                if (productEntitlements) {
                    // Normalize products using SML service
                    const appsRaw = productEntitlements.appEntitlements || [];
                    const modelsRaw = productEntitlements.modelEntitlements || [];
                    const dataRaw = productEntitlements.dataEntitlements || [];
                    
                    const apps = smlServiceInstance.normalizeApps({ apps: appsRaw });
                    const models = smlServiceInstance.normalizeModels({ models: modelsRaw });
                    const data = smlServiceInstance.normalizeData({ data: dataRaw });
                    
                    const allProducts = [...apps, ...models, ...data];
                    const expiredProducts = allProducts.filter(p => p.status === 'expired');
                    
                    // Collect product names and categories
                    expiredProducts.forEach(product => {
                        expiredProductsList.push(product.productName || product.productCode);
                        if (product.category) {
                            productCategories.add(product.category);
                        }
                    });
                }
            }
            
            // Calculate days since expiry
            const latestExpiryDate = new Date(account.latest_expiry_date);
            const today = new Date();
            const daysSinceExpiry = Math.floor((today - latestExpiryDate) / (1000 * 60 * 60 * 24));
            
            // Add row
            worksheet.addRow({
                tenantId: account.tenant_id,
                tenantName: account.tenant_name,
                accountName: account.account_name || 'N/A',
                totalExpiredProducts: account.total_expired_products,
                latestExpiryDate: latestExpiryDate.toLocaleDateString(),
                daysSinceExpiry: daysSinceExpiry,
                reviewStatus: account.is_reviewed ? 'Reviewed' : 'Needs Review',
                reviewedAt: account.reviewed_at ? new Date(account.reviewed_at).toLocaleDateString() : '',
                reviewedBy: account.reviewed_by || '',
                expiredProducts: expiredProductsList.join(', '),
                productCategories: Array.from(productCategories).join(', ')
            });
        }
        
        // Auto-fit columns (approximate)
        worksheet.columns.forEach(column => {
            if (column.width < 15) {
                column.width = 15;
            }
        });
        
        // Add filters to header row
        worksheet.autoFilter = {
            from: 'A1',
            to: 'K1'
        };
        
        // Freeze header row
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1 }
        ];
        
        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Set response headers for download
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SML_Ghost_Accounts_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
        console.log(`✅ Exported ${ghostAccounts.length} ghost accounts to Excel`);
        
    } catch (err) {
        console.error('❌ Error exporting ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export ghost accounts to Excel',
            details: err.message
        });
    }
});

// Run full SML ghost accounts analysis (fetches from SML API)
app.post('/api/sml-ghost-accounts/analyze', async (req, res) => {
    try {
        console.log('🔄 SML ghost accounts full analysis requested (will fetch from SML)...');
        
        // Check if SML is configured (use module-level instance)
        const config = smlServiceInstance.getConfig();
        if (!config || !config.authCookie) {
            return res.status(401).json({
                success: false,
                error: 'No SML authentication configured. Please configure SML in Settings.'
            });
        }
        
        const analysisStarted = new Date();
        
        console.log('👻 Starting SML ghost accounts identification (fetching from SML)...');
        
        const result = await smlGhostService.refreshGhostAccountsFromSML();
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            console.log(`✅ SML ghost accounts analysis complete: ${result.summary.ghostAccountsFound} ghost accounts found`);
            
            res.json({
                success: true,
                message: 'SML ghost accounts analysis completed successfully',
                summary: {
                    totalTenants: result.summary.totalTenants,
                    mappedTenants: result.summary.mappedTenants,
                    totalAnalyzed: result.summary.totalAnalyzed,
                    ghostAccountsFound: result.summary.ghostAccountsFound,
                    duration: durationSeconds
                },
                dataSource: 'sml',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'SML ghost accounts analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error refreshing SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh SML ghost accounts analysis',
            details: err.message
        });
    }
});

// Re-analyze SML ghost accounts from cached data (fast, no API calls)
app.post('/api/sml-ghost-accounts/refresh', async (req, res) => {
    try {
        console.log('🔄 SML ghost accounts refresh requested (using cached data)...');
        
        const analysisStarted = new Date();
        
        console.log('👻 Re-analyzing ghost accounts from cached data...');
        
        const result = await smlGhostService.reanalyzeFromCache();
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            console.log(`✅ SML ghost accounts re-analysis complete: ${result.summary.ghostAccountsFound} ghost accounts found`);
            
            res.json({
                success: true,
                message: 'SML ghost accounts re-analyzed from cached data',
                summary: {
                    totalAnalyzed: result.summary.totalAnalyzed,
                    ghostAccountsFound: result.summary.ghostAccountsFound,
                    duration: durationSeconds
                },
                dataSource: 'sml',
                fromCache: true,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'SML ghost accounts re-analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error re-analyzing SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to re-analyze SML ghost accounts',
            details: err.message
        });
    }
});

// Mark SML ghost account as reviewed
app.post('/api/sml-ghost-accounts/:tenantId/review', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { reviewedBy, notes } = req.body;
        
        if (!reviewedBy) {
            return res.status(400).json({
                success: false,
                error: 'reviewedBy is required'
            });
        }
        
        console.log(`✅ Marking SML ghost account as reviewed: ${tenantId}`);
        
        const result = await db.markSMLGhostAccountReviewed(tenantId, reviewedBy, notes);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'SML ghost account marked as reviewed',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error marking SML ghost account as reviewed:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark SML ghost account as reviewed'
        });
    }
});

// Get expired products for a specific SML ghost account (from cached data)
app.get('/api/sml-ghost-accounts/:tenantId/products', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { category, excludeProduct, includeExpired } = req.query;
        
        console.log(`📦 Fetching cached products for SML ghost account: ${tenantId}`);
        
        // Get the tenant from database with cached product entitlements
        const tenantResult = await db.getSMLTenantById(tenantId);
        if (!tenantResult.success || !tenantResult.tenant) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }
        
        const tenant = tenantResult.tenant;
        
        // Parse product entitlements from cache
        const productEntitlements = typeof tenant.product_entitlements === 'string' 
            ? JSON.parse(tenant.product_entitlements)
            : tenant.product_entitlements;
        
        if (!productEntitlements) {
            return res.status(404).json({
                success: false,
                error: 'No cached product entitlements found for this tenant. Try running "Run Analysis" first.'
            });
        }
        
        // Normalize products using SML service (same as analysis logic)
        const appsRaw = productEntitlements.appEntitlements || [];
        const modelsRaw = productEntitlements.modelEntitlements || [];
        const dataRaw = productEntitlements.dataEntitlements || [];
        
        const apps = smlServiceInstance.normalizeApps({ apps: appsRaw });
        const models = smlServiceInstance.normalizeModels({ models: modelsRaw });
        const data = smlServiceInstance.normalizeData({ data: dataRaw });
        
        // Always return all products (includeExpired just means include expired in the list, not filter to only expired)
        let allProducts = [...apps, ...models, ...data];
        
        // Apply category filter if provided
        if (category) {
            allProducts = allProducts.filter(p => p.category === category);
        }
        
        // Apply product name exclusion if provided
        if (excludeProduct) {
            const excludeLower = excludeProduct.toLowerCase();
            allProducts = allProducts.filter(p => 
                !p.productCode?.toLowerCase().includes(excludeLower) &&
                !p.productName?.toLowerCase().includes(excludeLower)
            );
        }
        
        // Categorize products for the frontend
        const categorizedProducts = allProducts.map(product => ({
            ...product,
            // Ensure category field is set properly for frontend
            category: product.category || 
                (apps.includes(product) ? 'apps' : models.includes(product) ? 'models' : 'data')
        }));
        
        const summary = {
            total: allProducts.length,
            byCategory: {
                apps: allProducts.filter(p => p.category === 'apps').length,
                models: allProducts.filter(p => p.category === 'models').length,
                data: allProducts.filter(p => p.category === 'data').length
            },
            byStatus: {
                active: allProducts.filter(p => p.status === 'active').length,
                expired: allProducts.filter(p => p.status === 'expired').length
            }
        };
        
        res.json({
            success: true,
            tenantId: tenantId,
            tenantName: tenant.tenant_name,
            accountName: tenant.account_name,
            products: categorizedProducts,
            summary: summary,
            dataSource: 'sml',
            fromCache: true,
            lastSynced: tenant.last_synced,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Error fetching SML ghost account products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch SML ghost account products',
            details: err.message
        });
    }
});

// Remove SML ghost account from tracking
app.delete('/api/sml-ghost-accounts/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        
        console.log(`🗑️ Removing SML ghost account: ${tenantId}`);
        
        const result = await db.removeSMLGhostAccount(tenantId);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'SML ghost account removed from tracking',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error removing SML ghost account:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove SML ghost account'
        });
    }
});

// [CUSTOMER PRODUCTS EXTRACTED - See routes/]

// [PRODUCT UPDATE WORKFLOW EXTRACTED - See routes/]

// [PACKAGE ENDPOINTS EXTRACTED - See routes/]

// [PACKAGE-PRODUCT MAPPING EXTRACTED - See routes/]

// [PRODUCT CATALOGUE EXTRACTED - See routes/]

// [PRODUCT BUNDLES EXTRACTED - See routes/]

// [PS AUDIT TRAIL EXTRACTED - See routes/]


// ===== GLOBAL ERROR HANDLER =====
const { errorHandler } = require('./middleware/error-handler');

// Global error handler (must be last middleware)
app.use(errorHandler);

console.log('✅ Global error handler configured');

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
