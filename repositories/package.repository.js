/**
 * Package Repository
 * Handles database operations for packages table
 */

const BaseRepository = require('./base.repository');
const logger = require('../utils/logger');

class PackageRepository extends BaseRepository {
    constructor() {
        super('packages');
    }

    /**
     * Get all packages with optional filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Packages and count
     */
    async findAllPackages(options = {}) {
        // Note: packages table doesn't have deleted_at column, ignoring includeDeleted option
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            ORDER BY pkg.package_name ASC
        `;
        const result = await this.query(query);

        return {
            packages: result.rows,
            count: result.rows.length,
            success: true
        };
    }

    /**
     * Get base packages
     * @returns {Promise<Object>} Base packages
     */
    async findBasePackages() {
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            WHERE pkg.package_type = 'Base'
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            ORDER BY pkg.package_name ASC
        `;

        const result = await this.query(query);

        return {
            packages: result.rows,
            count: result.rows.length,
            success: true
        };
    }

    /**
     * Get expansion packages
     * @returns {Promise<Object>} Expansion packages
     */
    async findExpansionPackages() {
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            WHERE pkg.package_type = 'Expansion'
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            ORDER BY pkg.package_name ASC
        `;

        const result = await this.query(query);

        return {
            packages: result.rows,
            count: result.rows.length,
            success: true
        };
    }

    /**
     * Find package by name
     * @param {String} packageName - Package name
     * @returns {Promise<Object>} Package
     */
    async findByPackageName(packageName) {
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            WHERE pkg.package_name = $1
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            LIMIT 1
        `;

        const result = await this.query(query, [packageName]);

        return {
            package: result.rows[0] || null,
            success: true
        };
    }

    /**
     * Find package by Salesforce ID
     * @param {String} sfPackageId - Salesforce package ID
     * @returns {Promise<Object>} Package
     */
    async findBySalesforceId(sfPackageId) {
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            WHERE pkg.sf_package_id = $1
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            LIMIT 1
        `;

        const result = await this.query(query, [sfPackageId]);

        return {
            package: result.rows[0] || null,
            success: true
        };
    }

    /**
     * Find package by RI package name (e.g., P1, P2, P5, X1)
     * @param {String} riPackageName - RI package name/code
     * @returns {Promise<Object>} Package
     */
    async findByRIPackageName(riPackageName) {
        const query = `
            SELECT 
                pkg.*,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            WHERE pkg.ri_package_name = $1
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            LIMIT 1
        `;

        const result = await this.query(query, [riPackageName]);

        return {
            package: result.rows[0] || null,
            success: true
        };
    }

    /**
     * Get packages summary statistics
     * @returns {Promise<Object>} Summary stats
     */
    async getSummaryStats() {
        const query = `
            SELECT 
                COUNT(*) as total_packages,
                COUNT(*) FILTER (WHERE package_type = 'Base') as base_packages,
                COUNT(*) FILTER (WHERE package_type = 'Expansion') as expansion_packages,
                COUNT(DISTINCT locations) as unique_locations,
                MAX(last_synced) as last_sync_time
            FROM ${this.tableName}
        `;

        const result = await this.query(query);
        const stats = result.rows[0];

        return {
            summary: {
                totalPackages: parseInt(stats.total_packages),
                basePackages: parseInt(stats.base_packages),
                expansionPackages: parseInt(stats.expansion_packages),
                uniqueLocations: parseInt(stats.unique_locations),
                lastSyncTime: stats.last_sync_time
            },
            success: true
        };
    }

    /**
     * Get packages with related products for export
     * @returns {Promise<Array>} Packages with products
     */
    async findAllForExport() {
        const query = `
            SELECT 
                pkg.package_name,
                pkg.ri_package_name,
                pkg.package_type,
                pkg.locations,
                pkg.max_concurrent_model,
                pkg.max_concurrent_non_model,
                pkg.max_concurrent_accumulation_jobs,
                pkg.max_concurrent_non_accumulation_jobs,
                pkg.max_jobs_day,
                pkg.max_users,
                pkg.number_edms,
                pkg.max_exposure_storage_tb,
                pkg.max_other_storage_tb,
                pkg.max_risks_accumulated_day,
                pkg.max_risks_single_accumulation,
                pkg.api_rps,
                pkg.description,
                pkg.sf_package_id,
                pkg.parent_package_id,
                pkg.first_synced,
                pkg.last_synced,
                COALESCE(
                    string_agg(DISTINCT m.product_code, ', ' ORDER BY m.product_code),
                    ''
                ) as related_products
            FROM ${this.tableName} pkg
            LEFT JOIN package_product_mapping m ON pkg.package_name = m.package_name
            GROUP BY pkg.id, pkg.package_name, pkg.ri_package_name, pkg.package_type,
                     pkg.locations, pkg.max_concurrent_model, pkg.max_concurrent_non_model,
                     pkg.max_concurrent_accumulation_jobs, pkg.max_concurrent_non_accumulation_jobs,
                     pkg.max_jobs_day, pkg.max_users, pkg.number_edms,
                     pkg.max_exposure_storage_tb, pkg.max_other_storage_tb,
                     pkg.max_risks_accumulated_day, pkg.max_risks_single_accumulation,
                     pkg.api_rps, pkg.description, pkg.sf_package_id, pkg.parent_package_id,
                     pkg.first_synced, pkg.last_synced
            ORDER BY pkg.package_name ASC
        `;

        return await this.executeQuery(query);
    }
}

module.exports = new PackageRepository();


