/**
 * Product Catalogue Service
 * Business logic for product catalogue management
 */

const XLSX = require('xlsx');
const { spawn } = require('child_process');
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
        const { search, family, productGroup, productSelectionGrouping, isActive = 'true', limit = 100, offset = 0 } = filters;
        
        logger.info(`Fetching product catalogue from local DB (search: ${search || 'none'}, family: ${family || 'all'}, productGroup: ${productGroup || 'all'}, productSelectionGrouping: ${productSelectionGrouping || 'all'})`);
        
        // Build SQL query
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;
        
        // Add active filter
        if (isActive === 'true') {
            whereConditions.push(`is_active = $${paramIndex++}`);
            queryParams.push(true);
            whereConditions.push(`is_archived = $${paramIndex++}`);
            queryParams.push(false);
        }
        
        // Add family filter
        if (family && family !== 'all') {
            whereConditions.push(`family = $${paramIndex++}`);
            queryParams.push(family);
        }
        
        // Add product group filter
        if (productGroup && productGroup !== 'all') {
            whereConditions.push(`product_group = $${paramIndex++}`);
            queryParams.push(productGroup);
        }
        
        // Add product selection grouping filter
        if (productSelectionGrouping && productSelectionGrouping !== 'all') {
            whereConditions.push(`product_selection_grouping = $${paramIndex++}`);
            queryParams.push(productSelectionGrouping);
        }
        
        // Add search filter (using full-text search or ILIKE)
        if (search) {
            whereConditions.push(`(
                name ILIKE $${paramIndex} OR 
                product_code ILIKE $${paramIndex} OR 
                description ILIKE $${paramIndex}
            )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
        const countResult = await db.query(countQuery, queryParams);
        const totalSize = parseInt(countResult.rows[0].total);
        
        // Get products with pagination
        const limitValue = Math.min(parseInt(limit) || 100, 2000);  // Increased cap to 2000 to load all products
        const offsetValue = parseInt(offset) || 0;
        
        const productsQuery = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                is_active as "IsActive",
                is_archived as "IsArchived",
                display_url as "DisplayUrl",
                product_group as "Product_Group__c",
                product_selection_grouping as "Product_Selection_Grouping__c",
                continent as "Continent__c",
                country as "Country__c",
                ri_platform_region as "RI_Platform_Region__c",
                ri_platform_sub_region as "RI_Platform_Sub_Region__c",
                model_type as "Model_Type__c",
                model_subtype as "Model_Subtype__c",
                irp_bundle_region as "IRP_Bundle_Region__c",
                irp_bundle_subregion as "IRP_Bundle_Subregion__c",
                data_api_name as "Data_API_Name__c",
                peril as "Peril__c",
                data_type as "Data_Type__c"
            FROM products
            ${whereClause}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        queryParams.push(limitValue, offsetValue);
        const productsResult = await db.query(productsQuery, queryParams);
        
        // Get distinct families for filter options
        const familiesQuery = `
            SELECT DISTINCT family 
            FROM products 
            WHERE is_active = true AND is_archived = false AND family IS NOT NULL
            ORDER BY family
        `;
        const familiesResult = await db.query(familiesQuery);
        const families = familiesResult.rows.map(r => r.family);
        
        // Get distinct product groups for filter options
        const productGroupsQuery = `
            SELECT DISTINCT product_group 
            FROM products 
            WHERE is_active = true AND is_archived = false AND product_group IS NOT NULL
            ORDER BY product_group
        `;
        const productGroupsResult = await db.query(productGroupsQuery);
        const productGroups = productGroupsResult.rows.map(r => r.product_group);
        
        // Get distinct product selection groupings for filter options
        const productSelectionGroupingsQuery = `
            SELECT DISTINCT product_selection_grouping 
            FROM products 
            WHERE is_active = true AND is_archived = false AND product_selection_grouping IS NOT NULL
            ORDER BY product_selection_grouping
        `;
        const productSelectionGroupingsResult = await db.query(productSelectionGroupingsQuery);
        const productSelectionGroupings = productSelectionGroupingsResult.rows.map(r => r.product_selection_grouping);
        
        return {
            products: productsResult.rows,
            count: productsResult.rows.length,
            totalSize: totalSize,
            done: (offsetValue + productsResult.rows.length) >= totalSize,
            filterOptions: {
                families: families,
                productGroups: productGroups,
                productSelectionGroupings: productSelectionGroupings
            },
            source: 'local_database'
        };
    }

    /**
     * Export product catalogue to Excel
     * @returns {Promise<Object>} Excel buffer and metadata
     */
    async exportProductCatalogue() {
        logger.info('Exporting product catalogue to Excel');
        
        // Query all active products with related packages from the database
        const query = `
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
                COALESCE(
                    string_agg(DISTINCT m.package_name, ', ' ORDER BY m.package_name),
                    ''
                ) as related_packages
            FROM products p
            LEFT JOIN package_product_mapping m ON p.product_code = m.product_code
            WHERE p.is_active = true AND p.is_archived = false
            GROUP BY p.id, p.name, p.product_code, p.salesforce_id, p.description, p.family, 
                     p.product_group, p.product_selection_grouping,
                     p.country, p.continent, p.ri_platform_region, p.ri_platform_sub_region,
                     p.model_type, p.model_subtype, p.irp_bundle_region, p.irp_bundle_subregion,
                     p.data_api_name, p.peril, p.data_type
            ORDER BY p.name ASC
        `;

        const result = await db.query(query);
        const products = result.rows;

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
        
        let packages = []; // Initialize outside to access later
        
        // Query all packages with related products
        const packagesQuery = `
            SELECT 
                pkg.package_name,
                pkg.ri_package_name,
                pkg.package_type,
                pkg.description,
                pkg.locations,
                pkg.max_concurrent_model,
                pkg.max_concurrent_non_model,
                pkg.max_jobs_day,
                pkg.max_users,
                pkg.number_edms,
                pkg.max_exposure_storage_tb,
                pkg.max_other_storage_tb,
                pkg.api_rps,
                pkg.sf_package_id,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM packages pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.description, pkg.locations, pkg.max_concurrent_model, 
                     pkg.max_concurrent_non_model, pkg.max_jobs_day, pkg.max_users, 
                     pkg.number_edms, pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.api_rps, pkg.sf_package_id
            ORDER BY pkg.package_name ASC
        `;
        
        const packagesResult = await db.query(packagesQuery);
        packages = packagesResult.rows; // Assign to outer scope variable
        
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

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Product_Catalogue_${timestamp}.xlsx`;

        logger.info(`Excel file generated: ${filename} (${products.length} products, ${packages.length} packages)`);
        
        return {
            buffer: excelBuffer,
            filename: filename,
            productCount: products.length,
            packageCount: packages.length
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
        
        // Get product count
        const productCount = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_active = true) as active,
                COUNT(*) FILTER (WHERE is_archived = true) as archived
            FROM products
        `);
        
        // Get last sync time
        const lastSyncTime = await db.query(`
            SELECT MAX(synced_at) as last_sync FROM products
        `);
        
        return {
            syncStatus: latestSync.rows[0] || null,
            productStats: {
                total: parseInt(productCount.rows[0].total),
                active: parseInt(productCount.rows[0].active),
                archived: parseInt(productCount.rows[0].archived),
                lastSync: lastSyncTime.rows[0].last_sync
            }
        };
    }

    /**
     * Get a specific product by ID from local database
     * @param {String} productId - Salesforce product ID
     * @returns {Promise<Object>} Product details
     */
    async getProductById(productId) {
        logger.info(`Fetching product details from local DB: ${productId}`);
        
        // Query product with all fields
        const query = `
            SELECT 
                salesforce_id as "Id",
                name as "Name",
                product_code as "ProductCode",
                description as "Description",
                family as "Family",
                product_group as "Product_Group__c",
                product_selection_grouping as "Product_Selection_Grouping__c",
                continent as "Continent__c",
                country as "Country__c",
                ri_platform_region as "RI_Platform_Region__c",
                ri_platform_sub_region as "RI_Platform_Sub_Region__c",
                model_type as "Model_Type__c",
                model_subtype as "Model_Subtype__c",
                irp_bundle_region as "IRP_Bundle_Region__c",
                irp_bundle_subregion as "IRP_Bundle_Subregion__c",
                data_api_name as "Data_API_Name__c",
                peril as "Peril__c",
                data_type as "Data_Type__c",
                is_active as "IsActive",
                is_archived as "IsArchived",
                sf_created_date as "CreatedDate",
                sf_last_modified_date as "LastModifiedDate"
            FROM products
            WHERE salesforce_id = $1
            LIMIT 1
        `;
        
        const result = await db.query(query, [productId]);
        
        if (result.rows.length === 0) {
            throw new NotFoundError('Product not found');
        }
        
        return {
            product: result.rows[0],
            source: 'local_database'
        };
    }
}

module.exports = new ProductCatalogueService();

