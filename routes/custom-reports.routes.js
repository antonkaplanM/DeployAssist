/**
 * Custom Reports Routes
 * CRUD API endpoints for managing custom report definitions
 */

const express = require('express');
const router = express.Router();
const customReportService = require('../services/custom-report.service');
const { asyncHandler } = require('../middleware/error-handler');
const logger = require('../utils/logger');

/**
 * List all active custom reports
 * GET /api/custom-reports
 * Query params: limit, offset
 */
router.get('/', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { reports, total } = await customReportService.listReports({
        userId: req.user?.id,
        limit,
        offset
    });

    res.json({
        success: true,
        reports,
        meta: {
            total,
            limit,
            offset,
            timestamp: new Date().toISOString()
        }
    });
}));

/**
 * Get the data catalog (available data sources for reports)
 * GET /api/custom-reports/data-catalog
 * Query params: grouped (boolean), forPrompt (boolean)
 */
router.get('/data-catalog', asyncHandler(async (req, res) => {
    const grouped = req.query.grouped === 'true';
    const forPrompt = req.query.forPrompt === 'true';

    const catalog = customReportService.getDataCatalog({ grouped, forPrompt });

    res.json({
        success: true,
        catalog,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get a specific report by slug
 * GET /api/custom-reports/:slug
 */
router.get('/:slug', asyncHandler(async (req, res) => {
    const report = await customReportService.getReportBySlug(req.params.slug);

    if (!report) {
        return res.status(404).json({
            success: false,
            error: 'Report not found',
            timestamp: new Date().toISOString()
        });
    }

    res.json({
        success: true,
        report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Create a new custom report
 * POST /api/custom-reports
 * Body: { name, description?, reportConfig, conversationHistory? }
 */
router.post('/', asyncHandler(async (req, res) => {
    const { name, description, reportConfig, conversationHistory } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Report name is required',
            timestamp: new Date().toISOString()
        });
    }

    if (!reportConfig || typeof reportConfig !== 'object') {
        return res.status(400).json({
            success: false,
            error: 'Report configuration is required',
            timestamp: new Date().toISOString()
        });
    }

    const result = await customReportService.createReport({
        name: name.trim(),
        description: description?.trim(),
        reportConfig,
        conversationHistory,
        userId: req.user.id
    });

    if (!result.success) {
        return res.status(400).json({
            success: false,
            error: 'Invalid report configuration',
            validationErrors: result.errors,
            timestamp: new Date().toISOString()
        });
    }

    logger.info('Custom report created via API', {
        reportId: result.report.id,
        slug: result.report.slug,
        userId: req.user.id
    });

    res.status(201).json({
        success: true,
        report: result.report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Update an existing report
 * PUT /api/custom-reports/:id
 * Body: { name?, description?, reportConfig?, conversationHistory? }
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid report ID',
            timestamp: new Date().toISOString()
        });
    }

    const { name, description, reportConfig, conversationHistory } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (reportConfig !== undefined) updates.reportConfig = reportConfig;
    if (conversationHistory !== undefined) updates.conversation_history = conversationHistory;

    const result = await customReportService.updateReport(id, updates, req.user.id);

    if (!result.success) {
        const status = result.errors?.[0]?.message === 'Report not found or access denied' ? 404 : 400;
        return res.status(status).json({
            success: false,
            error: result.errors?.[0]?.message || 'Update failed',
            validationErrors: result.errors,
            timestamp: new Date().toISOString()
        });
    }

    res.json({
        success: true,
        report: result.report,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Delete a report (soft-delete)
 * DELETE /api/custom-reports/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid report ID',
            timestamp: new Date().toISOString()
        });
    }

    const result = await customReportService.deleteReport(id, req.user.id);

    if (!result.success) {
        return res.status(404).json({
            success: false,
            error: result.message,
            timestamp: new Date().toISOString()
        });
    }

    res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
