/**
 * SML Routes (JavaScript version)
 * API endpoints for SML integration
 */

const express = require('express');
const SMLService = require('./sml-service');

const router = express.Router();
const smlService = new SMLService();

/**
 * GET /api/sml/config
 * Get current SML configuration
 */
router.get('/config', async (req, res) => {
    try {
        console.log('📡 GET /api/sml/config');
        
        const config = smlService.getConfig();
        
        res.json({
            success: true,
            configured: !!config,
            environment: config?.environment || null,
            hasAuthCookie: !!(config?.authCookie),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting SML config:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/sml/config
 * Set SML authentication configuration
 */
router.post('/config', async (req, res) => {
    try {
        console.log('📡 POST /api/sml/config', { environment: req.body.environment });
        
        const { environment, authCookie } = req.body;
        
        if (!environment || !['euw1', 'use1'].includes(environment)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid environment. Must be "euw1" or "use1"',
                timestamp: new Date().toISOString()
            });
        }
        
        if (!authCookie || typeof authCookie !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Bearer token is required',
                timestamp: new Date().toISOString()
            });
        }
        
        await smlService.setAuthConfig(environment, authCookie);
        
        res.json({
            success: true,
            message: 'SML configuration saved successfully',
            environment,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving SML config:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/sml/test
 * Test SML connectivity with provided token (doesn't save it)
 */
router.post('/test', async (req, res) => {
    try {
        console.log('📡 POST /api/sml/test');
        
        const { environment, authCookie } = req.body;
        
        if (!environment || !authCookie) {
            return res.json({
                success: false,
                error: 'Environment and token required for test',
                timestamp: new Date().toISOString()
            });
        }
        
        // Create a temporary repository with the test credentials
        const SMLRepository = require('./sml-repository');
        const tempRepo = new SMLRepository();
        
        // Set temporary config (don't save to disk)
        tempRepo.config = { environment, authCookie };
        
        const result = await tempRepo.testConnection();
        
        if (result.success) {
            res.json({
                success: true,
                environment,
                baseUrl: environment === 'euw1' 
                    ? 'https://api-euw1.rms.com' 
                    : 'https://api-use1.rms.com',
                authenticated: true,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                environment,
                error: result.error,
                details: result.details,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error testing SML connection:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/sml/tenant/:tenantId/products
 * Get all products for a specific tenant (proxied through our server)
 */
router.get('/tenant/:tenantId/products', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const tenantName = req.query.tenantName;
        
        console.log('📡 GET /api/sml/tenant/:tenantId/products', { tenantId, tenantName });
        
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'Tenant ID is required',
                timestamp: new Date().toISOString()
            });
        }
        
        const result = await smlService.fetchTenantProducts(tenantId, tenantName);
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching tenant products:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/sml/proxy
 * Proxy endpoint for client-side SML requests (bypasses CORS)
 */
router.post('/proxy', async (req, res) => {
    try {
        const { endpoint, tenantId, environment, authCookie } = req.body;
        
        console.log('📡 POST /api/sml/proxy', { endpoint, tenantId });
        
        if (!endpoint || !tenantId || !environment || !authCookie) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                timestamp: new Date().toISOString()
            });
        }
        
        // Create temporary repository with provided credentials
        const SMLRepository = require('./sml-repository');
        const tempRepo = new SMLRepository();
        tempRepo.config = { environment, authCookie };
        
        // Call the appropriate endpoint
        let result;
        switch(endpoint) {
            case 'apps':
                result = await tempRepo.fetchApps(tenantId);
                break;
            case 'models':
                result = await tempRepo.fetchModels(tenantId);
                break;
            case 'data':
                result = await tempRepo.fetchData(tenantId);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid endpoint',
                    timestamp: new Date().toISOString()
                });
        }
        
        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in SML proxy:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Proxy request failed',
            details: error.details || {},
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

