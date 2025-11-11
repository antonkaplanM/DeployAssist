/**
 * Product Updates Routes
 * API endpoints for product update workflow
 */

const express = require('express');
const router = express.Router();
const productUpdateService = require('../services/product-update.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success, created, badRequest, notFound } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get product update options for dropdown menus
 * GET /api/product-update/options
 * Optional query params: type (package/product/modifier/region), category (models/data/apps)
 */
router.get('/options', asyncHandler(async (req, res) => {
    const { type, category } = req.query;
    
    if (!type) {
        // Get all options
        const result = await productUpdateService.getAllProductOptions();
        return res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    }
    
    const result = await productUpdateService.getProductOptions(type, category);
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Refresh product options from PS audit trail
 * POST /api/product-update/options/refresh
 */
router.post('/options/refresh', asyncHandler(async (req, res) => {
    const result = await productUpdateService.refreshProductOptions();
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get pending product update requests
 * GET /api/product-update/requests
 * Optional query params: accountName, status, requestedBy
 */
router.get('/requests', asyncHandler(async (req, res) => {
    const filters = {
        accountName: req.query.accountName,
        status: req.query.status,
        requestedBy: req.query.requestedBy
    };
    
    const result = await productUpdateService.getPendingProductUpdateRequests(filters);
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Create a new product update request
 * POST /api/product-update/requests
 */
router.post('/requests', asyncHandler(async (req, res) => {
    const requestData = req.body;
    
    // Validate required fields
    if (!requestData.accountName || !requestData.requestedBy || !requestData.changes) {
        return badRequest(res, 'Missing required fields: accountName, requestedBy, changes');
    }
    
    const result = await productUpdateService.createProductUpdateRequest(requestData);
    
    if (result.success) {
        res.status(201).json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            ...result,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get a specific product update request
 * GET /api/product-update/requests/:identifier
 */
router.get('/requests/:identifier', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const result = await productUpdateService.getProductUpdateRequest(identifier);
    
    if (result.success) {
        res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Product update request not found',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Update product update request status
 * PATCH /api/product-update/requests/:identifier/status
 */
router.patch('/requests/:identifier/status', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const { status, approvalNotes, errorMessage, psRecordId, psRecordName } = req.body;
    
    if (!status) {
        return badRequest(res, 'Status is required');
    }
    
    const result = await productUpdateService.updateProductUpdateRequestStatus(
        identifier,
        status,
        { approvalNotes, errorMessage, psRecordId, psRecordName }
    );
    
    if (result.success) {
        res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Product update request not found',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Delete a product update request
 * DELETE /api/product-update/requests/:identifier
 */
router.delete('/requests/:identifier', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const result = await productUpdateService.deleteProductUpdateRequest(identifier);
    
    if (result.success) {
        res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Product update request not found',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get product update request history
 * GET /api/product-update/requests/:identifier/history
 */
router.get('/requests/:identifier/history', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const result = await productUpdateService.getProductUpdateRequestHistory(identifier);
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

