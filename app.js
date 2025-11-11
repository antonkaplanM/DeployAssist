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
const smlRoutes = require('./routes/sml.routes');

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
const smlGhostAccountsRoutes = require('./routes/sml-ghost-accounts.routes');
const jiraRoutes = require('./routes/jira.routes');
const testingRoutes = require('./routes/testing.routes');

// Authentication modules
const AuthService = require('./services/auth.service');
const { createAuthMiddleware, requireAdmin } = require('./middleware/auth.middleware');
const createAuthRoutes = require('./routes/auth.routes');
const createUserRoutes = require('./routes/user.routes');

const app = express();
const PORT = process.env.PORT || 5000;

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

// [JIRA INTEGRATION EXTRACTED - See routes/jira.routes.js, services/jira.service.js, utils/https-client.js]

// [TESTING ENDPOINTS EXTRACTED - See routes/testing.routes.js for Salesforce & web connectivity tests]

// SML Integration Routes (Protected - requires authentication)
app.use('/api/sml', authenticate, smlRoutes);

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

// SML Ghost Accounts endpoints
app.use('/api/sml-ghost-accounts', smlGhostAccountsRoutes);

// Jira Integration endpoints
app.use('/api/jira', jiraRoutes);

// Testing endpoints (Salesforce, web connectivity)
app.use('/api/test', testingRoutes);

console.log('✅ All extracted route modules mounted successfully');

// [SALESFORCE API ENDPOINTS EXTRACTED TO routes/salesforce-api.routes.js]

// [VALIDATION ERRORS EXTRACTED - See routes/validation.routes.js]

// [ASYNC VALIDATION ENDPOINTS EXTRACTED - See routes/validation.routes.js]

// [EXPIRATION MONITOR EXTRACTED - See routes/]

// [PACKAGE CHANGE ANALYSIS EXTRACTED - See routes/]

// [GHOST ACCOUNTS EXTRACTED - See routes/]

// [SML GHOST ACCOUNTS EXTRACTED - See routes/sml-ghost-accounts.routes.js]

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
