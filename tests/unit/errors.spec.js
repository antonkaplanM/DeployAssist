/**
 * Unit Tests for Custom Error Classes
 * Tests error handling standardization
 */

const {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    BadRequestError,
    InternalServerError,
    ServiceUnavailableError,
    DatabaseError,
    ExternalAPIError,
    RateLimitError,
    TimeoutError,
    isOperationalError,
    formatErrorResponse
} = require('../../utils/errors');

describe('Custom Error Classes', () => {
    describe('AppError (Base Class)', () => {
        it('should create error with default values', () => {
            const error = new AppError('Test error');

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.isOperational).toBe(true);
            expect(error.name).toBe('AppError');
            expect(error.timestamp).toBeDefined();
        });

        it('should create error with custom values', () => {
            const error = new AppError('Custom error', 404, 'CUSTOM_CODE', false);

            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('CUSTOM_CODE');
            expect(error.isOperational).toBe(false);
        });

        it('should capture stack trace', () => {
            const error = new AppError('Test');

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('AppError');
        });

        it('should convert to JSON', () => {
            const error = new AppError('Test error', 400, 'TEST_CODE');
            const json = error.toJSON();

            expect(json).toHaveProperty('name', 'AppError');
            expect(json).toHaveProperty('message', 'Test error');
            expect(json).toHaveProperty('code', 'TEST_CODE');
            expect(json).toHaveProperty('statusCode', 400);
            expect(json).toHaveProperty('timestamp');
        });

        it('should include stack in JSON in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new AppError('Test');
            const json = error.toJSON();

            expect(json).toHaveProperty('stack');
            process.env.NODE_ENV = originalEnv;
        });

        it('should not include stack in JSON in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new AppError('Test');
            const json = error.toJSON();

            expect(json).not.toHaveProperty('stack');
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('ValidationError (400)', () => {
        it('should create validation error', () => {
            const error = new ValidationError('Invalid input');

            expect(error).toBeInstanceOf(AppError);
            expect(error.message).toBe('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.name).toBe('ValidationError');
        });

        it('should include validation details', () => {
            const details = { field: 'email', reason: 'Invalid format' };
            const error = new ValidationError('Validation failed', details);

            expect(error.details).toEqual(details);
        });
    });

    describe('UnauthorizedError (401)', () => {
        it('should create unauthorized error', () => {
            const error = new UnauthorizedError();

            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
            expect(error.message).toBe('Authentication required');
        });

        it('should accept custom message', () => {
            const error = new UnauthorizedError('Invalid token');

            expect(error.message).toBe('Invalid token');
        });
    });

    describe('ForbiddenError (403)', () => {
        it('should create forbidden error', () => {
            const error = new ForbiddenError();

            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('FORBIDDEN');
            expect(error.message).toBe('Insufficient permissions');
        });

        it('should accept custom message', () => {
            const error = new ForbiddenError('Admin access required');

            expect(error.message).toBe('Admin access required');
        });
    });

    describe('NotFoundError (404)', () => {
        it('should create not found error with default message', () => {
            const error = new NotFoundError();

            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
            expect(error.message).toBe('Resource not found');
            expect(error.resource).toBe('Resource');
        });

        it('should accept resource name', () => {
            const error = new NotFoundError('User');

            expect(error.message).toBe('User not found');
            expect(error.resource).toBe('User');
        });
    });

    describe('ConflictError (409)', () => {
        it('should create conflict error', () => {
            const error = new ConflictError();

            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT');
            expect(error.message).toBe('Resource already exists');
        });

        it('should accept custom message', () => {
            const error = new ConflictError('Email already registered');

            expect(error.message).toBe('Email already registered');
        });
    });

    describe('BadRequestError (400)', () => {
        it('should create bad request error', () => {
            const error = new BadRequestError();

            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('BAD_REQUEST');
            expect(error.message).toBe('Bad request');
        });
    });

    describe('InternalServerError (500)', () => {
        it('should create internal server error', () => {
            const error = new InternalServerError();

            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.message).toBe('Internal server error');
        });

        it('should include error details', () => {
            const details = { originalError: 'Database connection failed' };
            const error = new InternalServerError('Server error', details);

            expect(error.details).toEqual(details);
        });
    });

    describe('ServiceUnavailableError (503)', () => {
        it('should create service unavailable error', () => {
            const error = new ServiceUnavailableError('Salesforce');

            expect(error.statusCode).toBe(503);
            expect(error.code).toBe('SERVICE_UNAVAILABLE');
            expect(error.message).toBe('Salesforce is currently unavailable');
            expect(error.service).toBe('Salesforce');
        });

        it('should accept custom message', () => {
            const error = new ServiceUnavailableError('Database', 'Undergoing maintenance');

            expect(error.message).toBe('Undergoing maintenance');
            expect(error.service).toBe('Database');
        });
    });

    describe('DatabaseError (500)', () => {
        it('should create database error', () => {
            const error = new DatabaseError();

            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('DATABASE_ERROR');
            expect(error.message).toBe('Database operation failed');
        });

        it('should include original error', () => {
            const originalError = new Error('Connection timeout');
            const error = new DatabaseError('Query failed', originalError);

            expect(error.originalError).toBe(originalError);
        });
    });

    describe('ExternalAPIError (500)', () => {
        it('should create external API error', () => {
            const error = new ExternalAPIError('Jira');

            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('EXTERNAL_API_ERROR');
            expect(error.message).toBe('External API call failed');
            expect(error.service).toBe('Jira');
        });

        it('should accept custom status code', () => {
            const error = new ExternalAPIError('SML', 'API returned 404', 404);

            expect(error.statusCode).toBe(404);
            expect(error.service).toBe('SML');
        });
    });

    describe('RateLimitError (429)', () => {
        it('should create rate limit error', () => {
            const error = new RateLimitError();

            expect(error.statusCode).toBe(429);
            expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(error.message).toBe('Too many requests');
        });
    });

    describe('TimeoutError (408)', () => {
        it('should create timeout error', () => {
            const error = new TimeoutError('Database query');

            expect(error.statusCode).toBe(408);
            expect(error.code).toBe('TIMEOUT');
            expect(error.message).toBe('Database query timed out');
            expect(error.operation).toBe('Database query');
        });

        it('should include timeout duration', () => {
            const error = new TimeoutError('API call', 5000);

            expect(error.message).toBe('API call timed out after 5000ms');
            expect(error.timeout).toBe(5000);
        });
    });
});

describe('Error Utilities', () => {
    describe('isOperationalError()', () => {
        it('should return true for operational errors', () => {
            const error = new ValidationError('Test');

            expect(isOperationalError(error)).toBe(true);
        });

        it('should return false for non-operational errors', () => {
            const error = new AppError('Test', 500, 'CODE', false);

            expect(isOperationalError(error)).toBe(false);
        });

        it('should return false for generic errors', () => {
            const error = new Error('Generic error');

            expect(isOperationalError(error)).toBe(false);
        });
    });

    describe('formatErrorResponse()', () => {
        it('should format AppError', () => {
            const error = new ValidationError('Invalid input', { field: 'email' });
            const formatted = formatErrorResponse(error);

            expect(formatted).toHaveProperty('success', false);
            expect(formatted).toHaveProperty('error');
            expect(formatted.error).toHaveProperty('message', 'Invalid input');
            expect(formatted.error).toHaveProperty('code', 'VALIDATION_ERROR');
            expect(formatted.error).toHaveProperty('details');
            expect(formatted).toHaveProperty('meta');
            expect(formatted.meta).toHaveProperty('timestamp');
            expect(formatted.meta).toHaveProperty('requestId');
        });

        it('should format generic error in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new Error('Generic error');
            const formatted = formatErrorResponse(error);

            expect(formatted.error.message).toBe('Generic error');
            expect(formatted.error.code).toBe('INTERNAL_ERROR');
            process.env.NODE_ENV = originalEnv;
        });

        it('should mask generic error in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const error = new Error('Internal details');
            const formatted = formatErrorResponse(error);

            expect(formatted.error.message).toBe('An unexpected error occurred');
            expect(formatted.error.code).toBe('INTERNAL_ERROR');
            process.env.NODE_ENV = originalEnv;
        });
    });
});

