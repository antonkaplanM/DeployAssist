/**
 * Testing Routes
 * API endpoints for testing system connectivity and integration
 */

const express = require('express');
const router = express.Router();
const salesforce = require('../salesforce');
const { testWebResource } = require('../utils/https-client');
const logger = require('../utils/logger');

/**
 * GET /api/test-salesforce
 * Test Salesforce connectivity and OAuth configuration
 */
router.get('/salesforce', async (req, res) => {
    logger.info('Testing Salesforce connectivity');
    
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
        logger.error('Salesforce connectivity test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to test Salesforce connectivity',
            details: error.message
        });
    }
});

/**
 * GET /api/test-web-connectivity
 * Test web connectivity to various external services
 */
router.get('/web-connectivity', async (req, res) => {
    try {
        logger.info('Testing web connectivity');
        
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
                logger.debug(`Web connectivity test: ${test.name} - ${result.statusCode} (${result.responseTime}ms)`);
            } catch (error) {
                testResults.push({
                    name: test.name,
                    url: test.url,
                    success: false,
                    error: error.message,
                    responseTime: null
                });
                logger.debug(`Web connectivity test failed: ${test.name} - ${error.message}`);
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
        logger.error('Web connectivity test error', { error: error.message });
        res.status(500).json({
            connectivity: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;








