/**
 * Main Application Entry Point (TypeScript)
 *
 * This is the new TypeScript version that runs alongside app.js
 * Demonstrates proper architecture with separation of concerns
 */
import { Express } from 'express';
/**
 * Initialize and configure the Express application
 */
declare function createApp(): Promise<Express>;
/**
 * Start the server
 */
declare function startServer(): Promise<void>;
export { createApp, startServer };
//# sourceMappingURL=app.d.ts.map