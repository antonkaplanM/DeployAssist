/**
 * Main Application Entry Point (TypeScript)
 * 
 * This is the new TypeScript version that runs alongside app.js
 * Demonstrates proper architecture with separation of concerns
 */

import express, { Express } from 'express';
import path from 'path';
import { config, validateConfig, printConfig, configureSSL } from './config';
import { Logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errors';

// Import routes
import salesforceRoutes from './routes/salesforce.routes';
import smlRoutes from './routes/sml.routes';

/**
 * Initialize and configure the Express application
 */
async function createApp(): Promise<Express> {
  const app = express();

  // Configure SSL before any connections
  configureSSL();

  // Validate configuration
  validateConfig();
  printConfig();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      Logger.http(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('user-agent')
      });
    });
    next();
  });

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));

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
  app.use('/api/salesforce', salesforceRoutes);

  // SML routes
  app.use('/api/sml', smlRoutes);

  // ===== Error Handling =====

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    const app = await createApp();
    const port = config.port;

    app.listen(port, () => {
      Logger.info(`🚀 Server started successfully`, {
        port,
        environment: config.nodeEnv,
        nodeVersion: process.version
      });
      Logger.info(`📁 Serving static files from ./public`);
      Logger.info(`🔗 TypeScript version running with improved architecture`);
      Logger.info(`💡 Access the app at http://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      Logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      Logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });

  } catch (error) {
    Logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { createApp, startServer };

