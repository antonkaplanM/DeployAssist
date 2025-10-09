/**
 * Error Handling Middleware
 * Custom error classes and Express error handling middleware
 */
import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../types/common.types';
/**
 * Base Application Error Class
 * All custom errors extend this class
 */
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly details?: any;
    constructor(code: ErrorCode, message: string, statusCode?: number, isOperational?: boolean, details?: any);
}
/**
 * Authentication Errors
 */
export declare class AuthenticationError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string, details?: any);
}
/**
 * Validation Errors
 */
export declare class ValidationError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class InvalidInputError extends AppError {
    constructor(message?: string, details?: any);
}
/**
 * Database Errors
 */
export declare class DatabaseError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class DatabaseConnectionError extends AppError {
    constructor(message?: string, details?: any);
}
/**
 * External Service Errors
 */
export declare class SalesforceError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class SalesforceConnectionError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class ExternalServiceError extends AppError {
    constructor(message: string | undefined, code: ErrorCode, details?: any);
}
/**
 * Resource Errors
 */
export declare class NotFoundError extends AppError {
    constructor(resource?: string, details?: any);
}
/**
 * System Errors
 */
export declare class TimeoutError extends AppError {
    constructor(message?: string, details?: any);
}
export declare class ConfigurationError extends AppError {
    constructor(message?: string, details?: any);
}
/**
 * Error Handling Middleware
 * Catches all errors and sends appropriate responses
 */
export declare const errorHandler: (err: Error, req: Request, res: Response, _next: NextFunction) => void;
/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch promise rejections
 */
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * 404 Not Found Handler
 * Should be placed after all routes
 */
export declare const notFoundHandler: (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=errors.d.ts.map