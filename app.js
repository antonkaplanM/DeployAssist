const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

// Atlassian API configuration
const ATLASSIAN_CONFIG = {
    email: process.env.ATLASSIAN_EMAIL || 'anton.kaplan@moodys.com', // Set ATLASSIAN_EMAIL environment variable or update this
    apiToken: 'REDACTED',
    cloudId: 'a0376734-67ec-48a1-8aae-e02d48c422ae',
    baseUrl: 'https://api.atlassian.com/ex/jira'
};

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
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
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
        
        // Build JQL query for assignee name
        let jqlQuery;
        if (assigneeName) {
            // Search by assignee display name with initiative and epic types
            jqlQuery = `assignee in ("${assigneeName}") AND (issuetype = "Initiative" OR issuetype = "Epic" OR issuetype = "Story" OR issuetype = "Task")`;
        } else {
            // Fallback query
            jqlQuery = 'issuetype = "Initiative" OR issuetype = "Epic"';
        }
        
        console.log(`🔍 Using JQL query: ${jqlQuery}`);
        
        // Prepare the API request
        const searchUrl = `${ATLASSIAN_CONFIG.baseUrl}/${ATLASSIAN_CONFIG.cloudId}/rest/api/3/search`;
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
            timeout: 30000 // 30 second timeout
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

// Test endpoint for health checks
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Serving static files from ./public`);
    console.log(`🔗 Direct Atlassian API Integration: No MCP configuration required`);
});