/**
 * Unit Tests for Bundle Repository
 * Tests bundle data access layer
 */

const bundleRepository = require('../../../repositories/bundle.repository');

// Mock database module
jest.mock('../../../database', () => ({
    query: jest.fn(),
    pool: {}
}));

const db = require('../../../database');

describe('Bundle Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findAllWithCounts()', () => {
        it('should fetch all bundles with product counts', async () => {
            const mockBundles = [
                { bundle_id: 1, bundle_name: 'Test Bundle 1', product_count: 5 },
                { bundle_id: 2, bundle_name: 'Test Bundle 2', product_count: 3 }
            ];

            db.query.mockResolvedValue({ rows: mockBundles });

            const result = await bundleRepository.findAllWithCounts();

            expect(db.query).toHaveBeenCalled();
            expect(result).toEqual(mockBundles);
        });

        it('should filter bundles by search term', async () => {
            const mockBundles = [
                { bundle_id: 1, bundle_name: 'Premium Bundle', product_count: 5 }
            ];

            db.query.mockResolvedValue({ rows: mockBundles });

            const result = await bundleRepository.findAllWithCounts({ search: 'Premium' });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE'),
                expect.arrayContaining(['%Premium%'])
            );
            expect(result).toEqual(mockBundles);
        });
    });

    describe('findByIdWithProducts()', () => {
        it('should fetch bundle with its products', async () => {
            const mockBundle = {
                bundle_id: 1,
                bundle_name: 'Test Bundle',
                products: [
                    { product_code: 'PROD1', quantity: 2 },
                    { product_code: 'PROD2', quantity: 1 }
                ]
            };

            db.query.mockResolvedValueOnce({ rows: [mockBundle] });
            db.query.mockResolvedValueOnce({ rows: mockBundle.products });

            const result = await bundleRepository.findByIdWithProducts(1);

            expect(db.query).toHaveBeenCalledTimes(2);
            expect(result).toHaveProperty('bundle_id', 1);
            expect(result).toHaveProperty('products');
            expect(result.products).toHaveLength(2);
        });

        it('should return null for non-existent bundle', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await bundleRepository.findByIdWithProducts(999);

            expect(result).toBeNull();
        });
    });

    describe('create()', () => {
        it('should create a new bundle', async () => {
            const newBundle = {
                bundle_name: 'New Bundle',
                description: 'Test description',
                category: 'Premium',
                is_active: true
            };

            const mockCreated = {
                bundle_id: 1,
                ...newBundle,
                created_at: new Date()
            };

            db.query.mockResolvedValue({ rows: [mockCreated] });

            const result = await bundleRepository.create(newBundle);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO product_bundles'),
                expect.arrayContaining([
                    newBundle.bundle_name,
                    newBundle.description,
                    newBundle.category,
                    newBundle.is_active
                ])
            );
            expect(result).toEqual(mockCreated);
        });
    });

    describe('updateByBundleId()', () => {
        it('should update bundle by ID', async () => {
            const updates = {
                bundle_name: 'Updated Bundle',
                description: 'Updated description'
            };

            const mockUpdated = {
                bundle_id: 1,
                ...updates,
                updated_at: new Date()
            };

            db.query.mockResolvedValue({ rows: [mockUpdated] });

            const result = await bundleRepository.updateByBundleId(1, updates);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE product_bundles'),
                expect.arrayContaining([updates.bundle_name, updates.description, 1])
            );
            expect(result).toEqual(mockUpdated);
        });

        it('should return null for non-existent bundle', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await bundleRepository.updateByBundleId(999, {});

            expect(result).toBeNull();
        });
    });

    describe('deleteByBundleId()', () => {
        it('should delete bundle and its products', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 5 }); // Delete products
            db.query.mockResolvedValueOnce({ rowCount: 1 }); // Delete bundle

            const result = await bundleRepository.deleteByBundleId(1);

            expect(db.query).toHaveBeenCalledTimes(2);
            expect(result).toBe(true);
        });

        it('should return false if bundle does not exist', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 0 });
            db.query.mockResolvedValueOnce({ rowCount: 0 });

            const result = await bundleRepository.deleteByBundleId(999);

            expect(result).toBe(false);
        });
    });

    describe('addProductToBundle()', () => {
        it('should add product to bundle', async () => {
            const mockProduct = {
                bundle_product_id: 1,
                bundle_id: 1,
                product_code: 'PROD1',
                quantity: 2
            };

            db.query.mockResolvedValue({ rows: [mockProduct] });

            const result = await bundleRepository.addProductToBundle(1, 'PROD1', 2);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO bundle_products'),
                expect.arrayContaining([1, 'PROD1', 2])
            );
            expect(result).toEqual(mockProduct);
        });
    });

    describe('updateProductQuantity()', () => {
        it('should update product quantity in bundle', async () => {
            const mockUpdated = {
                bundle_product_id: 1,
                bundle_id: 1,
                product_code: 'PROD1',
                quantity: 5
            };

            db.query.mockResolvedValue({ rows: [mockUpdated] });

            const result = await bundleRepository.updateProductQuantity(1, 'PROD1', 5);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE bundle_products'),
                expect.arrayContaining([5, 1, 'PROD1'])
            );
            expect(result).toEqual(mockUpdated);
        });
    });

    describe('removeProductFromBundle()', () => {
        it('should remove product from bundle', async () => {
            db.query.mockResolvedValue({ rowCount: 1 });

            const result = await bundleRepository.removeProductFromBundle(1, 'PROD1');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM bundle_products'),
                [1, 'PROD1']
            );
            expect(result).toBe(true);
        });

        it('should return false if product not in bundle', async () => {
            db.query.mockResolvedValue({ rowCount: 0 });

            const result = await bundleRepository.removeProductFromBundle(1, 'NONEXISTENT');

            expect(result).toBe(false);
        });
    });

    describe('getNextBundleId()', () => {
        it('should get next available bundle ID', async () => {
            db.query.mockResolvedValue({ rows: [{ max_id: 5 }] });

            const result = await bundleRepository.getNextBundleId();

            expect(result).toBe(6);
        });

        it('should return 1 if no bundles exist', async () => {
            db.query.mockResolvedValue({ rows: [{ max_id: null }] });

            const result = await bundleRepository.getNextBundleId();

            expect(result).toBe(1);
        });
    });
});








