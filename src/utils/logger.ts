/**
 * Winston Logger Configuration
 * Centralized logging with different log levels and formats
 */

import winston from 'winston';
import { LogLevel, LogMetadata } from '../types/common.types';

const { combine, timestamp, printf, colorize, errors } = winston.format;

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
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: LogLevel.ERROR,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper methods for structured logging
export class Logger {
  static error(message: string, error?: Error, metadata?: LogMetadata): void {
    logger.error(message, {
      ...metadata,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }

  static warn(message: string, metadata?: LogMetadata): void {
    logger.warn(message, metadata);
  }

  static info(message: string, metadata?: LogMetadata): void {
    logger.info(message, metadata);
  }

  static debug(message: string, metadata?: LogMetadata): void {
    logger.debug(message, metadata);
  }

  static http(message: string, metadata?: LogMetadata): void {
    logger.http(message, metadata);
  }

  // Salesforce-specific logging
  static salesforce(action: string, details: any): void {
    logger.info(`[Salesforce] ${action}`, { service: 'salesforce', ...details });
  }

  // Database-specific logging
  static database(action: string, details: any): void {
    logger.info(`[Database] ${action}`, { service: 'database', ...details });
  }

  // API-specific logging
  static api(method: string, path: string, details: any): void {
    logger.info(`[API] ${method} ${path}`, { service: 'api', ...details });
  }
}

export default logger;

