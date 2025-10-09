/**
 * Winston Logger Configuration
 * Centralized logging with different log levels and formats
 */
import winston from 'winston';
import { LogMetadata } from '../types/common.types';
declare const logger: winston.Logger;
export declare const stream: {
    write: (message: string) => void;
};
export declare class Logger {
    static error(message: string, error?: Error, metadata?: LogMetadata): void;
    static warn(message: string, metadata?: LogMetadata): void;
    static info(message: string, metadata?: LogMetadata): void;
    static debug(message: string, metadata?: LogMetadata): void;
    static http(message: string, metadata?: LogMetadata): void;
    static salesforce(action: string, details: any): void;
    static database(action: string, details: any): void;
    static api(method: string, path: string, details: any): void;
}
export default logger;
//# sourceMappingURL=logger.d.ts.map