/**
 * Unit Tests for ResponseFormatter
 * Tests standardized response formatting
 */

const { ResponseFormatter, generateRequestId } = require('../../utils/response');

describe('ResponseFormatter', () => {
    describe('success()', () => {
        it('should format success response with data', () => {
            const data = { id: 1, name: 'Test' };
            const result = ResponseFormatter.success(data);

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('data', data);
            expect(result).toHaveProperty('meta');
            expect(result.meta).toHaveProperty('timestamp');
            expect(result.meta).toHaveProperty('requestId');
        });

        it('should include custom meta fields', () => {
            const data = { id: 1 };
            const meta = { customField: 'customValue', userId: 123 };
            const result = ResponseFormatter.success(data, meta);

            expect(result.meta).toHaveProperty('customField', 'customValue');
            expect(result.meta).toHaveProperty('userId', 123);
            expect(result.meta).toHaveProperty('timestamp');
            expect(result.meta).toHaveProperty('requestId');
        });

        it('should generate valid timestamp', () => {
            const result = ResponseFormatter.success({ test: true });
            const timestamp = new Date(result.meta.timestamp);
            
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });

        it('should use provided requestId if given', () => {
            const customRequestId = 'custom-123';
            const result = ResponseFormatter.success({}, { requestId: customRequestId });

            expect(result.meta.requestId).toBe(customRequestId);
        });

        it('should generate requestId if not provided', () => {
            const result = ResponseFormatter.success({});

            expect(result.meta.requestId).toBeDefined();
            expect(typeof result.meta.requestId).toBe('string');
            expect(result.meta.requestId.length).toBeGreaterThan(0);
        });
    });

    describe('error()', () => {
        it('should format error response with message and code', () => {
            const message = 'Test error';
            const code = 'TEST_ERROR';
            const result = ResponseFormatter.error(message, code);

            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error');
            expect(result.error).toHaveProperty('message', message);
            expect(result.error).toHaveProperty('code', code);
            expect(result).toHaveProperty('meta');
            expect(result.meta).toHaveProperty('timestamp');
            expect(result.meta).toHaveProperty('requestId');
        });

        it('should use default error code if not provided', () => {
            const result = ResponseFormatter.error('Error message');

            expect(result.error.code).toBe('INTERNAL_ERROR');
        });

        it('should include error details if provided', () => {
            const message = 'Validation failed';
            const code = 'VALIDATION_ERROR';
            const details = { field: 'email', reason: 'Invalid format' };
            const result = ResponseFormatter.error(message, code, details);

            expect(result.error).toHaveProperty('details', details);
        });

        it('should not include details property if details is null', () => {
            const result = ResponseFormatter.error('Error', 'CODE', null);

            expect(result.error).not.toHaveProperty('details');
        });

        it('should generate valid timestamp', () => {
            const result = ResponseFormatter.error('Error', 'CODE');
            const timestamp = new Date(result.meta.timestamp);
            
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('paginated()', () => {
        it('should format paginated response', () => {
            const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const pagination = {
                page: 2,
                pageSize: 10,
                totalPages: 5,
                totalRecords: 50
            };
            const result = ResponseFormatter.paginated(data, pagination);

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('data', data);
            expect(result.meta).toHaveProperty('page', 2);
            expect(result.meta).toHaveProperty('pageSize', 10);
            expect(result.meta).toHaveProperty('totalPages', 5);
            expect(result.meta).toHaveProperty('totalRecords', 50);
        });

        it('should convert string pagination values to integers', () => {
            const result = ResponseFormatter.paginated([], {
                page: '3',
                pageSize: '20',
                totalPages: '10',
                totalRecords: '200'
            });

            expect(result.meta.page).toBe(3);
            expect(result.meta.pageSize).toBe(20);
            expect(result.meta.totalPages).toBe(10);
            expect(result.meta.totalRecords).toBe(200);
        });

        it('should handle limit as alias for pageSize', () => {
            const result = ResponseFormatter.paginated([], {
                page: 1,
                limit: 25,
                totalPages: 4,
                totalRecords: 100
            });

            expect(result.meta.pageSize).toBe(25);
        });

        it('should handle total as alias for totalRecords', () => {
            const result = ResponseFormatter.paginated([], {
                page: 1,
                pageSize: 10,
                totalPages: 3,
                total: 30
            });

            expect(result.meta.totalRecords).toBe(30);
        });
    });

    describe('list()', () => {
        it('should format list response with default key', () => {
            const items = [{ id: 1 }, { id: 2 }];
            const result = ResponseFormatter.list(items);

            expect(result).toHaveProperty('success', true);
            expect(result.data).toHaveProperty('items', items);
            expect(result.data).toHaveProperty('count', 2);
        });

        it('should format list response with custom key', () => {
            const products = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const result = ResponseFormatter.list(products, 'products');

            expect(result.data).toHaveProperty('products', products);
            expect(result.data).toHaveProperty('count', 3);
        });

        it('should handle empty arrays', () => {
            const result = ResponseFormatter.list([]);

            expect(result.data.items).toEqual([]);
            expect(result.data.count).toBe(0);
        });
    });

    describe('generateRequestId()', () => {
        it('should generate a unique request ID', () => {
            const id1 = generateRequestId();
            const id2 = generateRequestId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
        });

        it('should generate hex string', () => {
            const id = generateRequestId();

            expect(id).toMatch(/^[0-9a-f]+$/);
            expect(id.length).toBe(32); // 16 bytes * 2 hex chars
        });

        it('should generate different IDs on each call', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateRequestId());
            }

            expect(ids.size).toBe(100);
        });
    });
});

describe('Legacy Response Helpers (Backward Compatibility)', () => {
    const mockRes = () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    describe('success()', () => {
        it('should call res.json with formatted response', () => {
            const { success } = require('../../utils/response');
            const res = mockRes();
            const data = { test: true };

            success(res, data);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.data).toEqual(data);
        });

        it('should use custom status code', () => {
            const { success } = require('../../utils/response');
            const res = mockRes();

            success(res, {}, 201);

            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('error()', () => {
        it('should call res.json with formatted error response', () => {
            const { error } = require('../../utils/response');
            const res = mockRes();

            error(res, 'Test error', 400);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(false);
            expect(response.error.message).toBe('Test error');
            expect(response.error.code).toBe('BAD_REQUEST');
        });

        it('should map status codes to error codes', () => {
            const { error } = require('../../utils/response');
            const testCases = [
                { status: 400, code: 'BAD_REQUEST' },
                { status: 401, code: 'UNAUTHORIZED' },
                { status: 403, code: 'FORBIDDEN' },
                { status: 404, code: 'NOT_FOUND' },
                { status: 409, code: 'CONFLICT' },
                { status: 422, code: 'VALIDATION_ERROR' },
                { status: 500, code: 'INTERNAL_ERROR' }
            ];

            testCases.forEach(({ status, code }) => {
                const res = mockRes();
                error(res, 'Test', status);
                const response = res.json.mock.calls[0][0];
                expect(response.error.code).toBe(code);
            });
        });
    });

    describe('paginated()', () => {
        it('should call res.json with formatted paginated response', () => {
            const { paginated } = require('../../utils/response');
            const res = mockRes();
            const data = [1, 2, 3];

            paginated(res, data, 1, 10, 50);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalled();
            const response = res.json.mock.calls[0][0];
            expect(response.success).toBe(true);
            expect(response.data).toEqual(data);
            expect(response.meta.page).toBe(1);
            expect(response.meta.totalRecords).toBe(50);
        });
    });
});


