/**
 * Main Application Entry Point (TypeScript)
 * 
 * This is the new TypeScript version that runs alongside app.js
 * Demonstrates proper architecture with separation of concerns
 */

import express, { Express } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { config, validateConfig, printConfig, configureSSL } from './config';
import { Logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errors';

// Import services
import { AuthService } from './services/AuthService';
import { UserService } from './services/UserService';

// Import routes
import salesforceRoutes from './routes/salesforce.routes';
import smlRoutes from './routes/sml.routes';
import { createAuthRoutes } from './routes/auth.routes';
import { createUserRoutes } from './routes/user.routes';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth';
import { UserRepository } from './repositories/UserRepository';

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
  
  // Cookie parser middleware
  app.use(cookieParser());

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

  // Initialize database connection pool
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    max: config.database.maxConnections,
  });

  // Test database connection
  try {
    await pool.query('SELECT NOW()');
    Logger.info('Database connection established');
  } catch (error) {
    Logger.error('Database connection failed', error as Error);
    throw error;
  }

  // Initialize authentication services
  const authService = new AuthService(pool, config.auth.jwtSecret);
  const userService = new UserService(pool, authService);
  const userRepo = new UserRepository(pool);

  // Initialize middleware
  const authenticate = createAuthMiddleware(authService, userRepo);
  const optionalAuthenticate = createOptionalAuthMiddleware(authService, userRepo);

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

  // Authentication routes (public)
  app.use('/api/auth', createAuthRoutes(pool, authService));

  // User management routes (requires authentication)
  app.use('/api/users', createUserRoutes(pool, authService, userService));

  // Salesforce routes (requires authentication)
  app.use('/api/salesforce', authenticate, salesforceRoutes);

  // SML routes (requires authentication)
  app.use('/api/sml', authenticate, smlRoutes);

  // ===== Error Handling =====

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  // Schedule periodic cleanup of expired sessions and tokens (every hour)
  setInterval(() => {
    authService.cleanupExpired().catch(err => {
      Logger.error('Cleanup task failed', err);
    });
  }, 60 * 60 * 1000); // 1 hour

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

