/**
 * Validation Routes
 * API endpoints for PS request validation
 */

const express = require('express');
const router = express.Router();
const validationService = require('../services/validation.service');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get validation errors for dashboard monitoring
 * GET /api/validation/errors
 * Query params:
 *   - timeFrame: 1d, 1w, 1m, 1y (default: 1w)
 *   - enabledRules: Optional JSON array or comma-separated list of rule IDs
 */
router.get('/errors', asyncHandler(async (req, res) => {
    logger.info('Fetching validation errors for dashboard monitoring', req.query);
    
    const { timeFrame = '1w' } = req.query;
    
    // Parse enabled rules if provided
    let enabledRuleIds = null;
    const clientEnabledRules = req.body?.enabledRules || req.query.enabledRules;
    
    if (clientEnabledRules) {
        try {
            enabledRuleIds = typeof clientEnabledRules === 'string' ? 
                JSON.parse(clientEnabledRules) : clientEnabledRules;
        } catch (error) {
            logger.warn('Error parsing client enabled rules, using defaults:', error);
        }
    }
    
    const result = await validationService.getValidationErrors(timeFrame, enabledRuleIds);
    
    // Return flat structure for backwards compatibility
    res.json({
        success: true,
        errors: result.errors,
        summary: result.summary,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get async validation results for PS records
 * GET /api/validation/async-results
 * Query params:
 *   - recordIds: Comma-separated list of PS record IDs
 */
router.get('/async-results', async (req, res) => {
    try {
        logger.info('Fetching async validation results', req.query);
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        const { recordIds } = req.query; // Comma-separated list of record IDs
        
        if (!recordIds) {
            return res.json({
                success: true,
                results: [],
                count: 0,
                timestamp: new Date().toISOString()
            });
        }
        
        const recordIdArray = recordIds.split(',');
        
        // Query async validation results for the given record IDs
        const query = `
            SELECT 
                ps_record_id,
                ps_record_name,
                rule_id,
                rule_name,
                status,
                message,
                details,
                sml_entitlements,
                active_entitlements_count,
                processing_completed_at,
                created_at,
                updated_at
            FROM async_validation_results
            WHERE ps_record_id = ANY($1)
            ORDER BY updated_at DESC
        `;
        
        const result = await pool.query(query, [recordIdArray]);
        await pool.end();
        
        res.json({
            success: true,
            results: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error fetching async validation results', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get async validation processing status
 * GET /api/validation/async-status
 */
router.get('/async-status', async (req, res) => {
    try {
        logger.info('Fetching async validation processing status');
        
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        // Get latest processing log entry
        const logQuery = `
            SELECT *
            FROM async_validation_processing_log
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        // Get summary statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_results,
                COUNT(CASE WHEN status = 'WARNING' THEN 1 END) as warning_count,
                COUNT(CASE WHEN status = 'PASS' THEN 1 END) as pass_count,
                COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_count,
                MAX(updated_at) as last_updated
            FROM async_validation_results
            WHERE rule_id = 'deprovision-active-entitlements-check'
        `;
        
        const [logResult, statsResult] = await Promise.all([
            pool.query(logQuery),
            pool.query(statsQuery)
        ]);
        
        await pool.end();
        
        res.json({
            success: true,
            lastProcessing: logResult.rows[0] || null,
            statistics: statsResult.rows[0] || null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error fetching async validation status', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Trigger SML data refresh for Deprovision records
 * POST /api/validation/refresh-sml-data
 */
router.post('/refresh-sml-data', async (req, res) => {
    try {
        logger.info('Manual SML data refresh triggered');
        
        const { spawn } = require('child_process');
        const path = require('path');
        
        // Run the background script
        const scriptPath = path.join(__dirname, '../scripts/audit/process-sml-validation.js');
        const childProcess = spawn('node', [scriptPath], {
            detached: false,
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        childProcess.on('close', (code) => {
            if (code === 0) {
                logger.info('SML data refresh completed successfully');
            } else {
                logger.error('SML data refresh failed', { code });
            }
        });
        
        // Respond immediately with job started status
        res.json({
            success: true,
            message: 'SML data refresh started in background',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error starting SML data refresh', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

