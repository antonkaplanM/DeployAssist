"use strict";
/**
 * Main Application Entry Point (TypeScript)
 *
 * This is the new TypeScript version that runs alongside app.js
 * Demonstrates proper architecture with separation of concerns
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const errors_1 = require("./middleware/errors");
// Import routes
const salesforce_routes_1 = __importDefault(require("./routes/salesforce.routes"));
/**
 * Initialize and configure the Express application
 */
async function createApp() {
    const app = (0, express_1.default)();
    // Configure SSL before any connections
    (0, config_1.configureSSL)();
    // Validate configuration
    (0, config_1.validateConfig)();
    (0, config_1.printConfig)();
    // Body parsing middleware
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // Request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger_1.Logger.http(`${req.method} ${req.path}`, {
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('user-agent')
            });
        });
        next();
    });
    // Serve static files
    app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
    // ===== API Routes =====
    // Health check
    app.get('/health', (_req, res) => {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            version: '2.0.0-typescript',
            uptime: process.uptime()
        });
    });
    // Salesforce routes
    app.use('/api/salesforce', salesforce_routes_1.default);
    // ===== Error Handling =====
    // 404 handler (must be after all routes)
    app.use(errors_1.notFoundHandler);
    // Global error handler (must be last)
    app.use(errors_1.errorHandler);
    return app;
}
/**
 * Start the server
 */
async function startServer() {
    try {
        const app = await createApp();
        const port = config_1.config.port;
        app.listen(port, () => {
            logger_1.Logger.info(`🚀 Server started successfully`, {
                port,
                environment: config_1.config.nodeEnv,
                nodeVersion: process.version
            });
            logger_1.Logger.info(`📁 Serving static files from ./public`);
            logger_1.Logger.info(`🔗 TypeScript version running with improved architecture`);
            logger_1.Logger.info(`💡 Access the app at http://localhost:${port}`);
        });
        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger_1.Logger.info('SIGTERM received, shutting down gracefully');
            process.exit(0);
        });
        process.on('SIGINT', () => {
            logger_1.Logger.info('SIGINT received, shutting down gracefully');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.Logger.error('Failed to start server', error);
        process.exit(1);
    }
}
// Start the server if this file is run directly
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=app.js.map