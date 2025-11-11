/**
 * Packages Routes
 * API endpoints for package management
 */

const express = require('express');
const router = express.Router();
const packagesService = require('../services/packages.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');

/**
 * Get packages summary statistics
 * GET /api/packages/summary/stats
 * NOTE: This route MUST come before /:identifier to avoid route conflicts
 */
router.get('/summary/stats', asyncHandler(async (req, res) => {
    const summary = await packagesService.getPackagesSummary();
    res.json({
        success: true,
        summary,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Export packages to Excel
 * GET /api/packages/export
 * Returns an Excel file with all packages
 * NOTE: This route MUST come before /:identifier to avoid route conflicts
 */
router.get('/export', asyncHandler(async (req, res) => {
    const excelBuffer = await packagesService.exportPackagesToExcel();
    const filename = packagesService.getExportFilename();
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    // Send the file
    res.send(excelBuffer);
}));

/**
 * Get all packages
 * GET /api/packages
 * Optional query params: type (Base/Expansion), includeDeleted (boolean)
 */
router.get('/', asyncHandler(async (req, res) => {
    const { type, includeDeleted } = req.query;
    
    const result = await packagesService.getAllPackages({ type, includeDeleted });
    
    res.json({
        success: true,
        packages: result.packages,
        count: result.count,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get a specific package by name or ID
 * GET /api/packages/:identifier
 * Identifier can be: package name, RI package name, or Salesforce ID
 * NOTE: This route with :identifier param MUST come AFTER specific routes like /export
 */
router.get('/:identifier', asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    
    const package = await packagesService.getPackageByIdentifier(identifier);
    
    res.json({
        success: true,
        package,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

