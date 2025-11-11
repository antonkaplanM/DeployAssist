/**
 * Centralized Logger Utility
 * Uses Winston for structured logging
 */

const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = ' ' + JSON.stringify(meta);
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'deploy-assist' },
    transports: [
        // Write all logs to combined.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // Write error logs to error.log
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Add helper methods for common logging patterns
logger.logApiRequest = (req) => {
    logger.info('API Request', {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userId: req.user?.id
    });
};

logger.logApiResponse = (req, res, duration) => {
    logger.info('API Response', {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id
    });
};

logger.logError = (error, context = {}) => {
    logger.error('Error occurred', {
        message: error.message,
        stack: error.stack,
        ...context
    });
};

logger.logDatabaseQuery = (query, params = []) => {
    if (process.env.LOG_QUERIES === 'true') {
        logger.debug('Database Query', {
            query: query.substring(0, 200), // Truncate long queries
            params: params.length > 0 ? params : undefined
        });
    }
};

module.exports = logger;

