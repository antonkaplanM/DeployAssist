/**
 * Packages Service
 * Business logic for package management
 */

const packageRepository = require('../repositories/package.repository');
const logger = require('../utils/logger');
const { NotFoundError, InternalServerError } = require('../middleware/error-handler');
const excelBuilder = require('../utils/excel-builder');

class PackagesService {
    /**
     * Get all packages with optional filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Packages list
     */
    async getAllPackages(options = {}) {
        const { type, includeDeleted = false } = options;
        
        logger.info(`Fetching packages (type: ${type || 'all'}, includeDeleted: ${includeDeleted})`);
        
        let result;
        
        if (type === 'Base') {
            result = await packageRepository.findBasePackages();
        } else if (type === 'Expansion') {
            result = await packageRepository.findExpansionPackages();
        } else {
            result = await packageRepository.findAllPackages({
                includeDeleted: includeDeleted === true || includeDeleted === 'true'
            });
        }
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch packages');
        }
        
        return {
            packages: result.packages,
            count: result.count
        };
    }

    /**
     * Get a specific package by identifier
     * @param {String} identifier - Package name, RI name, or Salesforce ID
     * @returns {Promise<Object>} Package details
     */
    async getPackageByIdentifier(identifier) {
        logger.info(`Fetching package: ${identifier}`);
        
        // Try to find by name first (most common), then by SF ID
        let result = await packageRepository.findByPackageName(identifier);
        
        if (!result.success || !result.package) {
            // Try by Salesforce ID
            result = await packageRepository.findBySalesforceId(identifier);
        }
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch package');
        }
        
        if (!result.package) {
            throw new NotFoundError(`Package not found: ${identifier}`);
        }
        
        return result.package;
    }

    /**
     * Get packages summary statistics
     * @returns {Promise<Object>} Summary statistics
     */
    async getPackagesSummary() {
        logger.info('Fetching packages summary');
        
        const result = await packageRepository.getSummaryStats();
        
        if (!result.success) {
            throw new InternalServerError(result.error || 'Failed to fetch packages summary');
        }
        
        return result.summary;
    }

    /**
     * Export packages to Excel
     * @returns {Promise<Buffer>} Excel file buffer
     */
    async exportPackagesToExcel() {
        logger.info('Exporting packages to Excel');
        
        // Get all packages with related products from repository
        const packages = await packageRepository.findAllForExport();
        
        logger.info(`Found ${packages.length} packages to export`);

        if (packages.length === 0) {
            throw new NotFoundError('No packages found to export');
        }

        // Transform packages into Excel format
        const excelData = packages.map(pkg => ({
            'Package Name': pkg.package_name || '',
            'RI Package Name': pkg.ri_package_name || '',
            'Package Type': pkg.package_type || '',
            'Related Products': pkg.related_products || '',
            'Locations': pkg.locations || '',
            'Max Concurrent Model': pkg.max_concurrent_model || '',
            'Max Concurrent Non-Model': pkg.max_concurrent_non_model || '',
            'Max Concurrent Accumulation Jobs': pkg.max_concurrent_accumulation_jobs || '',
            'Max Concurrent Non-Accumulation Jobs': pkg.max_concurrent_non_accumulation_jobs || '',
            'Max Jobs per Day': pkg.max_jobs_day || '',
            'Max Users': pkg.max_users || '',
            'Number of EDMs': pkg.number_edms || '',
            'Max Exposure Storage (TB)': pkg.max_exposure_storage_tb || '',
            'Max Other Storage (TB)': pkg.max_other_storage_tb || '',
            'Max Risks Accumulated per Day': pkg.max_risks_accumulated_day || '',
            'Max Risks Single Accumulation': pkg.max_risks_single_accumulation || '',
            'API RPS': pkg.api_rps || '',
            'Description': pkg.description || '',
            'Salesforce ID': pkg.sf_package_id || '',
            'Parent Package ID': pkg.parent_package_id || '',
            'First Synced': pkg.first_synced || '',
            'Last Synced': pkg.last_synced || ''
        }));

        // Create workbook using utility
        const workbook = excelBuilder.createWorkbook();
        const XLSX = require('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
            { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 35 }, { wch: 18 },
            { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 30 },
            { wch: 30 }, { wch: 12 }, { wch: 60 }, { wch: 20 }, { wch: 20 },
            { wch: 20 }, { wch: 20 }
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Packages');

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        logger.info(`Excel file generated (${packages.length} packages)`);
        
        return excelBuffer;
    }

    /**
     * Get filename for Excel export
     * @returns {String} Filename with timestamp
     */
    getExportFilename() {
        const timestamp = new Date().toISOString().split('T')[0];
        return `Packages_Catalogue_${timestamp}.xlsx`;
    }
}

module.exports = new PackagesService();

