/**
 * Product Catalogue Service
 * Business logic for product catalogue management
 */

const XLSX = require('xlsx');
const { spawn } = require('child_process');
const productRepository = require('../repositories/product.repository');
const packageRepository = require('../repositories/package.repository');
const db = require('../database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../middleware/error-handler');

class ProductCatalogueService {
    /**
     * Get product catalogue from local database with filters
     * @param {Object} filters - Query filters
     * @returns {Promise<Object>} Product catalogue data
     */
    async getProductCatalogue(filters = {}) {
        const { isActive = 'true', limit = 100, offset = 0 } = filters;
        
        logger.info(`Fetching product catalogue from local DB (search: ${filters.search || 'none'}, family: ${filters.family || 'all'}, productGroup: ${filters.productGroup || 'all'})`);
        
        // Normalize isActive filter
        const normalizedFilters = {
            ...filters,
            isActive: isActive === 'true',
            isArchived: false,
            limit: Math.min(parseInt(limit) || 100, 2000),
            offset: parseInt(offset) || 0
        };
        
        // Get products from repository
        const products = await productRepository.findWithFilters(normalizedFilters);
        
        // Get total count
        const totalSize = await productRepository.countWithFilters(normalizedFilters);
        
        // Get filter options
        const filterOptions = await productRepository.getFilterOptions();
        
        return {
            products,
            count: products.length,
            totalSize,
            done: (normalizedFilters.offset + products.length) >= totalSize,
            filterOptions,
            source: 'local_database'
        };
    }

    /**
     * Export product catalogue to Excel
     * @returns {Promise<Object>} Excel buffer and metadata
     */
    async exportProductCatalogue() {
        logger.info('Exporting product catalogue to Excel');
        
        // Get all active products with related packages from repository
        const products = await productRepository.findAllForExport();

        logger.info(`Found ${products.length} products to export`);

        if (products.length === 0) {
            throw new NotFoundError('No products found to export');
        }

        // Transform products into Excel format - streamlined fields only
        const excelData = products.map(product => {
            return {
                'Product Name': product.name || '',
                'Product Code': product.product_code || '',
                'Salesforce ID': product.salesforce_id || '',
                'Description': product.description || '',
                'Product Family': product.family || '',
                'Product Group': product.product_group || '',
                'Product Selection Grouping': product.product_selection_grouping || '',
                'Country': product.country || '',
                'Continent': product.continent || '',
                'RI Region': product.ri_platform_region || '',
                'RI Subregion': product.ri_platform_sub_region || '',
                'Model Type': product.model_type || '',
                'Model Subtype': product.model_subtype || '',
                'Bundle Region': product.irp_bundle_region || '',
                'Bundle Subregion': product.irp_bundle_subregion || '',
                'Data API Name': product.data_api_name || '',
                'Peril': product.peril || '',
                'Data Type': product.data_type || '',
                'Related Packages': product.related_packages || ''
            };
        });

        // Create workbook and worksheet for Products
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 50 },  // Product Name
            { wch: 20 },  // Product Code
            { wch: 20 },  // Salesforce ID
            { wch: 60 },  // Description
            { wch: 25 },  // Product Family
            { wch: 25 },  // Product Group
            { wch: 30 },  // Product Selection Grouping
            { wch: 15 },  // Country
            { wch: 20 },  // Continent
            { wch: 20 },  // RI Region
            { wch: 20 },  // RI Subregion
            { wch: 20 },  // Model Type
            { wch: 20 },  // Model Subtype
            { wch: 20 },  // Bundle Region
            { wch: 20 },  // Bundle Subregion
            { wch: 40 },  // Data API Name
            { wch: 20 },  // Peril
            { wch: 20 },  // Data Type
            { wch: 40 }   // Related Packages
        ];

        // Add Products worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        // ===== Add Packages Tab =====
        logger.info('Adding Packages tab to export');
        
        // Get all packages with related products from repository
        const packages = await packageRepository.findAllForExport();
        
        logger.info(`Found ${packages.length} packages to add to export`);
        
        if (packages.length > 0) {
            // Transform packages into Excel format (matching product style)
            const packagesExcelData = packages.map(pkg => {
                // Build specifications object with key details
                const specs = {};
                
                if (pkg.locations) specs['Locations'] = pkg.locations;
                if (pkg.max_concurrent_model) specs['Max Concurrent Model'] = pkg.max_concurrent_model;
                if (pkg.max_concurrent_non_model) specs['Max Concurrent Non-Model'] = pkg.max_concurrent_non_model;
                if (pkg.max_jobs_day) specs['Max Jobs/Day'] = pkg.max_jobs_day;
                if (pkg.max_users) specs['Max Users'] = pkg.max_users;
                if (pkg.number_edms) specs['Number of EDMs'] = pkg.number_edms;
                if (pkg.max_exposure_storage_tb) specs['Max Exposure Storage (TB)'] = pkg.max_exposure_storage_tb;
                if (pkg.max_other_storage_tb) specs['Max Other Storage (TB)'] = pkg.max_other_storage_tb;
                if (pkg.api_rps) specs['API RPS'] = pkg.api_rps;
                if (pkg.sf_package_id) specs['Salesforce ID'] = pkg.sf_package_id;

                // Convert specs object to formatted string
                const specsString = Object.entries(specs)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n');

                return {
                    'Package Name': pkg.package_name || '',
                    'RI Package Name': pkg.ri_package_name || '',
                    'Type': pkg.package_type || '',
                    'Description': pkg.description || '',
                    'Related Products': pkg.related_products || '',
                    'Specifications': specsString
                };
            });

            // Create Packages worksheet
            const packagesWorksheet = XLSX.utils.json_to_sheet(packagesExcelData);

            // Set column widths to match Products tab style
            packagesWorksheet['!cols'] = [
                { wch: 30 },  // Package Name
                { wch: 20 },  // RI Package Name
                { wch: 15 },  // Type
                { wch: 60 },  // Description
                { wch: 35 },  // Related Products
                { wch: 80 }   // Specifications
            ];

            // Add Packages worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, packagesWorksheet, 'Packages');
        }

        // ===== Add Regional Bundles Tab =====
        logger.info('Adding Regional Bundles tab to export');
        
        // Get all regional bundle products from repository
        // Wrapped in try-catch in case bundle columns don't exist yet
        let bundles = [];
        try {
            const bundlesQuery = `
            SELECT 
                p.name,
                p.product_code,
                p.salesforce_id,
                p.description,
                p.family,
                p.product_group,
                p.product_selection_grouping,
                p.country,
                p.continent,
                p.ri_platform_region,
                p.ri_platform_sub_region,
                p.model_type,
                p.model_subtype,
                p.irp_bundle_region,
                p.irp_bundle_subregion,
                p.data_api_name,
                p.peril,
                p.data_type,
                p.constituents,
                COALESCE(
                    string_agg(DISTINCT m.package_name, ', ' ORDER BY m.package_name),
                    ''
                ) as related_packages
            FROM products p
            LEFT JOIN package_product_mapping m ON p.product_code = m.product_code
            WHERE p.is_active = true 
            AND p.is_archived = false
            AND p.is_bundle = true
            GROUP BY p.id, p.name, p.product_code, p.salesforce_id, p.description, p.family, 
                     p.product_group, p.product_selection_grouping,
                     p.country, p.continent, p.ri_platform_region, p.ri_platform_sub_region,
                     p.model_type, p.model_subtype, p.irp_bundle_region, p.irp_bundle_subregion,
                     p.data_api_name, p.peril, p.data_type, p.constituents
            ORDER BY p.name ASC
        `;
        
            const bundlesResult = await db.query(bundlesQuery);
            bundles = bundlesResult.rows;
            
            logger.info(`Found ${bundles.length} regional bundles to add to export`);
        } catch (error) {
            logger.warn(`Could not load regional bundles for export: ${error.message}`);
            logger.warn('Skipping Regional Bundles tab. Run bundle migration to enable.');
            bundles = [];
        }
        
        if (bundles.length > 0) {
            // Transform bundles into Excel format
            const bundlesExcelData = bundles.map(bundle => {
                return {
                    'Product Name': bundle.name || '',
                    'Product Code': bundle.product_code || '',
                    'Salesforce ID': bundle.salesforce_id || '',
                    'Description': bundle.description || '',
                    'Product Family': bundle.family || '',
                    'Product Group': bundle.product_group || '',
                    'Product Selection Grouping': bundle.product_selection_grouping || '',
                    'Country': bundle.country || '',
                    'Continent': bundle.continent || '',
                    'RI Region': bundle.ri_platform_region || '',
                    'RI Subregions (Bundle)': bundle.ri_platform_sub_region || '',
                    'Constituents': bundle.constituents || '',
                    'Model Type': bundle.model_type || '',
                    'Model Subtype': bundle.model_subtype || '',
                    'Bundle Region': bundle.irp_bundle_region || '',
                    'Bundle Subregion': bundle.irp_bundle_subregion || '',
                    'Data API Name': bundle.data_api_name || '',
                    'Peril': bundle.peril || '',
                    'Data Type': bundle.data_type || '',
                    'Related Packages': bundle.related_packages || ''
                };
            });

            // Create Regional Bundles worksheet
            const bundlesWorksheet = XLSX.utils.json_to_sheet(bundlesExcelData);

            // Set column widths for better readability
            bundlesWorksheet['!cols'] = [
                { wch: 50 },  // Product Name
                { wch: 20 },  // Product Code
                { wch: 20 },  // Salesforce ID
                { wch: 60 },  // Description
                { wch: 25 },  // Product Family
                { wch: 25 },  // Product Group
                { wch: 30 },  // Product Selection Grouping
                { wch: 15 },  // Country
                { wch: 20 },  // Continent
                { wch: 20 },  // RI Region
                { wch: 50 },  // RI Subregions (Bundle) - wider for multiple values
                { wch: 60 },  // Constituents - wider for multiple product codes
                { wch: 20 },  // Model Type
                { wch: 20 },  // Model Subtype
                { wch: 20 },  // Bundle Region
                { wch: 20 },  // Bundle Subregion
                { wch: 40 },  // Data API Name
                { wch: 20 },  // Peril
                { wch: 20 },  // Data Type
                { wch: 40 }   // Related Packages
            ];

            // Add Regional Bundles worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, bundlesWorksheet, 'Regional Bundles');
        }

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Product_Catalogue_${timestamp}.xlsx`;

        const bundleCount = bundles ? bundles.length : 0;
        logger.info(`Excel file generated: ${filename} (${products.length} products, ${packages.length} packages, ${bundleCount} bundles)`);
        
        return {
            buffer: excelBuffer,
            filename: filename,
            productCount: products.length,
            packageCount: packages.length,
            bundleCount: bundleCount
        };
    }

    /**
     * Trigger product catalogue refresh from Salesforce
     * @returns {Promise<Object>} Refresh status
     */
    async refreshProductCatalogue() {
        logger.info('Triggering product catalogue refresh from Salesforce');
        
        // Spawn the sync process in background
        const syncProcess = spawn('node', ['sync-products-from-salesforce.js'], {
            detached: true,
            stdio: 'ignore'
        });
        syncProcess.unref();
        
        return {
            message: 'Product refresh started in background',
            note: 'Check product_sync_log table for progress'
        };
    }

    /**
     * Get product sync status and history
     * @returns {Promise<Object>} Sync status
     */
    async getSyncStatus() {
        logger.info('Fetching product sync status');
        
        // Get latest sync log
        const latestSync = await db.query(`
            SELECT * FROM product_sync_log
            ORDER BY sync_started_at DESC
            LIMIT 1
        `);
        
        // Get product stats from repository
        const productStats = await productRepository.getStats();
        
        return {
            syncStatus: latestSync.rows[0] || null,
            productStats
        };
    }

    /**
     * Get a specific product by ID from local database
     * @param {String} productId - Salesforce product ID
     * @returns {Promise<Object>} Product details
     */
    async getProductById(productId) {
        logger.info(`Fetching product details from local DB: ${productId}`);
        
        const product = await productRepository.findBySalesforceId(productId);
        
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        
        // Format product for response
        return {
            product: {
                Id: product.salesforce_id,
                Name: product.name,
                ProductCode: product.product_code,
                Description: product.description,
                Family: product.family,
                Product_Group__c: product.product_group,
                Product_Selection_Grouping__c: product.product_selection_grouping,
                RelatedPackages: product.RelatedPackages || '',
                Continent__c: product.continent,
                Country__c: product.country,
                RI_Platform_Region__c: product.ri_platform_region,
                RI_Platform_Sub_Region__c: product.ri_platform_sub_region,
                Model_Type__c: product.model_type,
                Model_Subtype__c: product.model_subtype,
                IRP_Bundle_Region__c: product.irp_bundle_region,
                IRP_Bundle_Subregion__c: product.irp_bundle_subregion,
                Data_API_Name__c: product.data_api_name,
                Peril__c: product.peril,
                Data_Type__c: product.data_type,
                IsActive: product.is_active,
                IsArchived: product.is_archived,
                CreatedDate: product.sf_created_date,
                LastModifiedDate: product.sf_last_modified_date,
                Constituents: product.constituents
            },
            source: 'local_database'
        };
    }

    /**
     * Get regional bundle products from local database with filters
     * @param {Object} filters - Query filters
     * @returns {Promise<Object>} Regional bundles data
     */
    async getRegionalBundles(filters = {}) {
        const { isActive = 'true', limit = 100, offset = 0 } = filters;
        
        logger.info(`Fetching regional bundles from local DB (search: ${filters.search || 'none'}, family: ${filters.family || 'all'})`);
        
        // Normalize filters
        const normalizedFilters = {
            ...filters,
            isActive: isActive === 'true',
            isArchived: false,
            limit: Math.min(parseInt(limit) || 100, 2000),
            offset: parseInt(offset) || 0
        };
        
        // Get bundles from repository
        const bundles = await productRepository.findBundlesWithFilters(normalizedFilters);
        
        // Get total count
        const totalSize = await productRepository.countBundlesWithFilters(normalizedFilters);
        
        // Get filter options (same as regular products)
        const filterOptions = await productRepository.getFilterOptions();
        
        return {
            bundles,
            count: bundles.length,
            totalSize,
            done: (normalizedFilters.offset + bundles.length) >= totalSize,
            filterOptions,
            source: 'local_database'
        };
    }
}

module.exports = new ProductCatalogueService();

