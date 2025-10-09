"use strict";
/**
 * Salesforce Routes
 * HTTP routes for Salesforce-related operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SalesforceService_1 = require("../services/SalesforceService");
const errors_1 = require("../middleware/errors");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const salesforceService = new SalesforceService_1.SalesforceService();
/**
 * GET /api/salesforce/test
 * Test Salesforce connectivity
 */
router.get('/test', (0, errors_1.asyncHandler)(async (_req, res) => {
    logger_1.Logger.api('GET', '/api/salesforce/test', {});
    const result = await salesforceService.testConnection();
    res.json({
        success: result.success,
        ...(result.success ? { details: result.details } : { error: result.error }),
        timestamp: new Date().toISOString()
    });
}));
/**
 * GET /api/salesforce/provisioning/requests
 * Query Professional Services Requests with filters and pagination
 */
router.get('/provisioning/requests', (0, errors_1.asyncHandler)(async (req, res) => {
    logger_1.Logger.api('GET', '/api/salesforce/provisioning/requests', { query: req.query });
    const filters = {
        requestType: req.query.requestType,
        accountId: req.query.accountId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : 25,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    // Remove undefined values
    Object.keys(filters).forEach(key => {
        if (filters[key] === undefined || filters[key] === '') {
            delete filters[key];
        }
    });
    const result = await salesforceService.queryProfServicesRequests(filters);
    res.json({
        ...result,
        timestamp: new Date().toISOString()
    });
}));
/**
 * GET /api/salesforce/provisioning/filter-options
 * Get filter options for dropdowns
 */
router.get('/provisioning/filter-options', (0, errors_1.asyncHandler)(async (_req, res) => {
    logger_1.Logger.api('GET', '/api/salesforce/provisioning/filter-options', {});
    const result = await salesforceService.getFilterOptions();
    res.json({
        ...result,
        timestamp: new Date().toISOString()
    });
}));
exports.default = router;
//# sourceMappingURL=salesforce.routes.js.map