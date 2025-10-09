/**
 * Error Handling Middleware
 * Custom error classes and Express error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../types/common.types';
import { Logger } from '../utils/logger';

/**
 * Base Application Error Class
 * All custom errors extend this class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Authentication Errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(ErrorCode.AUTH_INVALID, message, 401, true, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(ErrorCode.AUTH_INVALID, message, 403, true, details);
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, true, details);
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string = 'Invalid input provided', details?: any) {
    super(ErrorCode.INVALID_INPUT, message, 400, true, details);
  }
}

/**
 * Database Errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(ErrorCode.DATABASE_QUERY_FAILED, message, 500, true, details);
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message: string = 'Database connection failed', details?: any) {
    super(ErrorCode.DATABASE_CONNECTION_FAILED, message, 503, true, details);
  }
}

/**
 * External Service Errors
 */
export class SalesforceError extends AppError {
  constructor(message: string = 'Salesforce operation failed', details?: any) {
    super(ErrorCode.SALESFORCE_QUERY_FAILED, message, 502, true, details);
  }
}

export class SalesforceConnectionError extends AppError {
  constructor(message: string = 'Salesforce connection failed', details?: any) {
    super(ErrorCode.SALESFORCE_CONNECTION_FAILED, message, 503, true, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', code: ErrorCode, details?: any) {
    super(code, message, 502, true, details);
  }
}

/**
 * Resource Errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`,
      404,
      true,
      details
    );
  }
}

/**
 * System Errors
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', details?: any) {
    super(ErrorCode.TIMEOUT_ERROR, message, 504, true, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error', details?: any) {
    super(ErrorCode.CONFIGURATION_ERROR, message, 500, false, details);
  }
}

/**
 * Error Handling Middleware
 * Catches all errors and sends appropriate responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default error properties
  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let isOperational = false;
  let details: any = undefined;

  // Handle AppError and its subclasses
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    isOperational = err.isOperational;
    details = err.details;
  } 
  // Handle other known error types
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_FAILED;
    message = err.message;
    isOperational = true;
  } 
  else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = ErrorCode.AUTH_INVALID;
    message = 'Invalid or missing authentication';
    isOperational = true;
  }
  // Unhandled errors
  else {
    message = process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message;
  }

  // Log the error
  if (isOperational) {
    Logger.warn(`Operational error: ${message}`, {
      path: req.path,
      method: req.method,
      statusCode,
      errorCode,
      details
    });
  } else {
    Logger.error(`Unexpected error: ${message}`, err, {
      path: req.path,
      method: req.method,
      statusCode,
      errorCode,
      details
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: err.stack,
        details 
      })
    },
    timestamp: new Date().toISOString()
  });
};

/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch promise rejections
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found Handler
 * Should be placed after all routes
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError('Route', {
    path: req.path,
    method: req.method
  });
  next(error);
};

