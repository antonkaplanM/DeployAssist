/**
 * Application Configuration
 * Centralized configuration management with validation
 */
import { AppConfig } from '../types/common.types';
import * as https from 'https';
/**
 * Configure SSL/TLS settings properly
 * Instead of disabling SSL validation globally, configure it per-connection
 */
export declare function configureSSL(): void;
/**
 * Application Configuration Object
 */
export declare const config: AppConfig;
/**
 * Validate configuration on startup
 */
export declare function validateConfig(): void;
/**
 * Print configuration (sanitized)
 */
export declare function printConfig(): void;
export declare function getHttpsAgent(): https.Agent;
export default config;
//# sourceMappingURL=index.d.ts.map