"use strict";
/**
 * Winston Logger Configuration
 * Centralized logging with different log levels and formats
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.stream = void 0;
const winston_1 = __importDefault(require("winston"));
const common_types_1 = require("../types/common.types");
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});
// Create logger instance
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || common_types_1.LogLevel.INFO,
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        // Console transport
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
        }),
        // File transport for errors
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: common_types_1.LogLevel.ERROR,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // File transport for all logs
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],
    // Don't exit on handled exceptions
    exitOnError: false
});
// Create a stream object for Morgan HTTP logging
exports.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};
// Helper methods for structured logging
class Logger {
    static error(message, error, metadata) {
        logger.error(message, {
            ...metadata,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        });
    }
    static warn(message, metadata) {
        logger.warn(message, metadata);
    }
    static info(message, metadata) {
        logger.info(message, metadata);
    }
    static debug(message, metadata) {
        logger.debug(message, metadata);
    }
    static http(message, metadata) {
        logger.http(message, metadata);
    }
    // Salesforce-specific logging
    static salesforce(action, details) {
        logger.info(`[Salesforce] ${action}`, { service: 'salesforce', ...details });
    }
    // Database-specific logging
    static database(action, details) {
        logger.info(`[Database] ${action}`, { service: 'database', ...details });
    }
    // API-specific logging
    static api(method, path, details) {
        logger.info(`[API] ${method} ${path}`, { service: 'api', ...details });
    }
}
exports.Logger = Logger;
exports.default = logger;
//# sourceMappingURL=logger.js.map