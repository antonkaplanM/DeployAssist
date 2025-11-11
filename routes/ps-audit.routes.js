/**
 * PS Audit Trail Routes
 * API endpoints for Professional Services audit trail
 */

const express = require('express');
const router = express.Router();
const psAuditService = require('../services/ps-audit.service');
const db = require('../database');
const { asyncHandler } = require('../middleware/error-handler');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get audit trail statistics
 * GET /api/audit-trail/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
    logger.info('Fetching audit trail statistics');
    
    const result = await psAuditService.getAuditStats();
    
    if (result.success) {
        res.json({
            success: true,
            stats: result.stats,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            stats: null,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Search for PS records in audit trail
 * GET /api/audit-trail/search
 * Query params: q or search (search term, min 2 characters)
 */
router.get('/search', asyncHandler(async (req, res) => {
    const searchTerm = req.query.q || req.query.search || '';
    logger.info(`Searching audit trail for: ${searchTerm}`);
    
    if (!searchTerm || searchTerm.length < 2) {
        return res.json({
            success: true,
            results: [],
            searchTerm,
            timestamp: new Date().toISOString()
        });
    }
    
    // Search in the ps_audit_latest view for matching PS records
    const query = `
        SELECT DISTINCT 
            ps_record_id,
            ps_record_name,
            account_name,
            status,
            captured_at
        FROM ps_audit_latest
        WHERE ps_record_name ILIKE $1
           OR account_name ILIKE $1
           OR ps_record_id ILIKE $1
        ORDER BY captured_at DESC
        LIMIT 20
    `;
    
    const result = await db.query(query, [`%${searchTerm}%`]);
    
    res.json({
        success: true,
        results: result.rows,
        searchTerm,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get PS request volume statistics
 * GET /api/audit-trail/ps-volume
 * Query params: months (default: 6)
 */
router.get('/ps-volume', asyncHandler(async (req, res) => {
    logger.info('Fetching PS request volume statistics');
    
    // Get time period from query params (default: 6 months)
    const months = parseInt(req.query.months) || 6;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);
    
    logger.info(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Query to get unique PS records created in the time period, grouped by week
    const weeklyQuery = `
        WITH unique_ps_records AS (
            SELECT DISTINCT ON (ps_record_id)
                ps_record_id,
                ps_record_name,
                created_date,
                account_name,
                status,
                request_type
            FROM ps_audit_trail
            WHERE created_date >= $1 
              AND created_date <= $2
              AND created_date IS NOT NULL
            ORDER BY ps_record_id, captured_at ASC
        ),
        weekly_aggregation AS (
            SELECT 
                DATE_TRUNC('week', created_date) as week_start,
                COUNT(*) as requests_created,
                COUNT(DISTINCT account_name) as unique_accounts,
                ARRAY_AGG(DISTINCT request_type) FILTER (WHERE request_type IS NOT NULL) as request_types
            FROM unique_ps_records
            GROUP BY DATE_TRUNC('week', created_date)
            ORDER BY week_start ASC
        )
        SELECT 
            week_start,
            TO_CHAR(week_start, 'Mon DD, YYYY') as week_label,
            requests_created,
            unique_accounts,
            request_types
        FROM weekly_aggregation
        ORDER BY week_start ASC
    `;
    
    const weeklyResult = await db.query(weeklyQuery, [startDate, endDate]);
    
    // Get overall statistics
    const statsQuery = `
        WITH unique_ps_records AS (
            SELECT DISTINCT ON (ps_record_id)
                ps_record_id,
                ps_record_name,
                created_date,
                account_name,
                request_type
            FROM ps_audit_trail
            WHERE created_date >= $1 
              AND created_date <= $2
              AND created_date IS NOT NULL
            ORDER BY ps_record_id, captured_at ASC
        )
        SELECT 
            COUNT(*) as total_requests,
            COUNT(DISTINCT account_name) as unique_accounts,
            MIN(created_date) as earliest_request,
            MAX(created_date) as latest_request,
            COUNT(*) FILTER (WHERE request_type = 'New') as new_requests,
            COUNT(*) FILTER (WHERE request_type = 'Update') as update_requests,
            COUNT(*) FILTER (WHERE request_type = 'Deprovision') as deprovision_requests
        FROM unique_ps_records
    `;
    
    const statsResult = await db.query(statsQuery, [startDate, endDate]);
    const stats = statsResult.rows[0];
    
    // Calculate averages
    const daysInPeriod = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    const weeksInPeriod = daysInPeriod / 7;
    const totalWeeks = weeklyResult.rows.length;
    const totalRequests = parseInt(stats.total_requests || 0);
    const averagePerWeek = totalWeeks > 0 ? (totalRequests / totalWeeks) : 0;
    const averagePerDay = daysInPeriod > 0 ? (totalRequests / daysInPeriod) : 0;
    
    logger.info(`Found ${totalRequests} PS requests over ${totalWeeks} weeks`);
    logger.info(`Average: ${averagePerWeek.toFixed(2)} requests/week`);
    
    const result = {
        period: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            months: months,
            daysInPeriod: daysInPeriod,
            weeksInPeriod: parseFloat(weeksInPeriod.toFixed(1))
        },
        totals: {
            totalRequests: totalRequests,
            uniqueAccounts: parseInt(stats.unique_accounts || 0),
            weeksWithActivity: totalWeeks
        },
        averages: {
            requestsPerWeek: parseFloat(averagePerWeek.toFixed(2)),
            requestsPerDay: parseFloat(averagePerDay.toFixed(2))
        },
        requestTypes: {
            new: parseInt(stats.new_requests || 0),
            update: parseInt(stats.update_requests || 0),
            deprovision: parseInt(stats.deprovision_requests || 0)
        },
        weeklyData: weeklyResult.rows.map(row => ({
            weekStart: row.week_start,
            weekLabel: row.week_label,
            requestsCreated: parseInt(row.requests_created),
            uniqueAccounts: parseInt(row.unique_accounts),
            requestTypes: row.request_types || []
        }))
    };
    
    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * Get audit trail for a specific PS record
 * GET /api/audit-trail/ps-record/:identifier
 */
router.get('/ps-record/:identifier', asyncHandler(async (req, res) => {
    const identifier = req.params.identifier;
    logger.info(`Fetching audit trail for PS record: ${identifier}`);
    
    const result = await psAuditService.getPSAuditTrail(identifier);
    
    if (result.success) {
        res.json({
            success: true,
            identifier: result.identifier,
            recordCount: result.recordCount,
            records: result.records,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            identifier: result.identifier,
            records: [],
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get status change history for a PS record
 * GET /api/audit-trail/status-changes/:identifier
 */
router.get('/status-changes/:identifier', asyncHandler(async (req, res) => {
    const identifier = req.params.identifier;
    logger.info(`Fetching status changes for PS record: ${identifier}`);
    
    const result = await psAuditService.getPSStatusChanges(identifier);
    
    if (result.success) {
        res.json({
            success: true,
            identifier: result.identifier,
            changeCount: result.changeCount,
            changes: result.changes,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error,
            identifier: result.identifier,
            changes: [],
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Trigger manual capture of current PS records (admin/testing function)
 * POST /api/audit-trail/capture
 * Note: Automatic capture runs every 5 minutes via scheduled task
 */
router.post('/capture', asyncHandler(async (req, res) => {
    logger.info('Manual capture triggered');
    
    // This is a lightweight endpoint for testing
    // The actual capture happens via the scheduled task (capture-ps-changes.js)
    // To truly trigger a capture, run: node capture-ps-changes.js
    
    res.json({
        success: true,
        message: 'Manual capture noted. For full capture, the scheduled task runs every 5 minutes automatically.',
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;

