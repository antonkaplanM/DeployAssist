/**
 * Custom Report Service
 * Business logic for creating, managing, and validating custom reports
 */

const customReportRepository = require('../repositories/custom-report.repository');
const { validateReportConfig } = require('../config/report-config-schema');
const { getDataCatalog, getDataCatalogByCategory, getCatalogForPrompt } = require('../config/report-data-catalog');
const logger = require('../utils/logger');

class CustomReportService {

    /**
     * Generate a URL-safe slug from a report name.
     * Appends a numeric suffix if the slug already exists.
     * @param {string} name
     * @returns {Promise<string>}
     */
    async generateSlug(name) {
        const base = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 80)
            .replace(/^-|-$/g, '');

        let slug = base || 'report';
        let suffix = 0;

        while (await customReportRepository.slugExists(slug)) {
            suffix++;
            slug = `${base}-${suffix}`;
        }

        return slug;
    }

    /**
     * Create a new custom report
     * @param {Object} params
     * @param {string} params.name - Report display name
     * @param {string} [params.description]
     * @param {Object} params.reportConfig - Report JSON config
     * @param {Object} [params.conversationHistory] - Chat that produced this report
     * @param {number} params.userId - Creator user ID
     * @returns {Promise<{ success: boolean, report?: Object, errors?: Array }>}
     */
    async createReport({ name, description, reportConfig, conversationHistory, userId }) {
        const validation = validateReportConfig(reportConfig);
        if (!validation.success) {
            logger.warn('Report config validation failed', { errors: validation.errors });
            return { success: false, errors: validation.errors };
        }

        const slug = await this.generateSlug(name);

        const dataSources = this._extractDataSources(validation.data);

        const report = await customReportRepository.createReport({
            name,
            slug,
            description,
            report_config: validation.data,
            data_sources: dataSources,
            conversation_history: conversationHistory || null,
            created_by: userId
        });

        logger.info('Custom report created', { id: report.id, slug: report.slug, userId });

        return { success: true, report };
    }

    /**
     * List active reports
     * @param {Object} options
     * @param {number} [options.userId] - Filter by creator
     * @param {number} [options.limit]
     * @param {number} [options.offset]
     * @returns {Promise<{ reports: Array, total: number }>}
     */
    async listReports(options = {}) {
        return await customReportRepository.listActive({
            createdBy: options.userId,
            limit: options.limit,
            offset: options.offset
        });
    }

    /**
     * Get a report by slug (used for rendering)
     * @param {string} slug
     * @returns {Promise<Object|null>}
     */
    async getReportBySlug(slug) {
        return await customReportRepository.findBySlug(slug);
    }

    /**
     * Get a report by ID (used for management)
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getReportById(id) {
        return await customReportRepository.getFullReport(id);
    }

    /**
     * Update a report
     * @param {number} id
     * @param {Object} updates
     * @param {number} userId - Must be the report owner
     * @returns {Promise<{ success: boolean, report?: Object, errors?: Array }>}
     */
    async updateReport(id, updates, userId) {
        if (updates.reportConfig) {
            const validation = validateReportConfig(updates.reportConfig);
            if (!validation.success) {
                return { success: false, errors: validation.errors };
            }
            updates.report_config = validation.data;
            updates.data_sources = this._extractDataSources(validation.data);
            delete updates.reportConfig;
        }

        const report = await customReportRepository.updateReport(id, updates, userId);

        if (!report) {
            return { success: false, errors: [{ message: 'Report not found or access denied' }] };
        }

        logger.info('Custom report updated', { id, userId, version: report.version });

        return { success: true, report };
    }

    /**
     * Soft-delete a report
     * @param {number} id
     * @param {number} userId
     * @returns {Promise<{ success: boolean, message?: string }>}
     */
    async deleteReport(id, userId) {
        const report = await customReportRepository.softDelete(id, userId);

        if (!report) {
            return { success: false, message: 'Report not found or access denied' };
        }

        logger.info('Custom report deleted', { id, slug: report.slug, userId });

        return { success: true, message: 'Report deleted' };
    }

    /**
     * Get the data catalog for the AI agent or for display
     * @param {Object} [options]
     * @param {boolean} [options.grouped] - Group by category
     * @param {boolean} [options.forPrompt] - Compact format for LLM context
     * @returns {Object|Array}
     */
    getDataCatalog(options = {}) {
        if (options.forPrompt) {
            return getCatalogForPrompt();
        }
        if (options.grouped) {
            return getDataCatalogByCategory();
        }
        return getDataCatalog();
    }

    /**
     * Extract unique data source endpoints referenced in a config
     * @param {Object} config - Validated report config
     * @returns {Object} Data sources metadata
     * @private
     */
    _extractDataSources(config) {
        const endpoints = new Set();
        for (const component of config.components) {
            if (component.dataSource?.endpoint) {
                endpoints.add(component.dataSource.endpoint);
            }
        }
        return {
            endpoints: Array.from(endpoints),
            count: endpoints.size
        };
    }
}

module.exports = new CustomReportService();
