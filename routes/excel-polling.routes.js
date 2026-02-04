/**
 * Excel Polling Routes
 * 
 * API endpoints to control the Excel polling service that monitors
 * a shared Excel file for lookup requests from remote users.
 */

const express = require('express');
const router = express.Router();
const excelPollingService = require('../services/excel-polling.service');

/**
 * GET /api/excel-polling/status
 * Get current polling status
 */
router.get('/status', (req, res) => {
    try {
        const status = excelPollingService.getStatus();
        res.json({
            success: true,
            ...status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting polling status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/excel-polling/configure
 * Configure the Excel file to poll
 * Body: { shareUrl: "https://..." }
 */
router.post('/configure', async (req, res) => {
    try {
        const { shareUrl } = req.body;
        
        if (!shareUrl) {
            return res.status(400).json({
                success: false,
                error: 'shareUrl is required'
            });
        }

        const result = await excelPollingService.configure(shareUrl);
        res.json(result);
    } catch (error) {
        console.error('Error configuring polling:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/excel-polling/start
 * Start polling the configured Excel file
 */
router.post('/start', async (req, res) => {
    try {
        const result = await excelPollingService.start();
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error starting polling:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/excel-polling/stop
 * Stop polling
 */
router.post('/stop', (req, res) => {
    try {
        const result = excelPollingService.stop();
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error stopping polling:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/excel-polling/interval
 * Set polling interval
 * Body: { intervalMs: 5000 }
 */
router.post('/interval', (req, res) => {
    try {
        const { intervalMs } = req.body;
        
        if (!intervalMs || typeof intervalMs !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'intervalMs (number) is required'
            });
        }

        const result = excelPollingService.setInterval(intervalMs);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error setting interval:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/excel-polling/test
 * Test a single poll (for debugging)
 */
router.post('/test', async (req, res) => {
    try {
        console.log('📡 Testing single poll...');
        
        // Temporarily enable polling for one cycle
        const wasPolling = excelPollingService.isPolling;
        excelPollingService.isPolling = true;
        
        await excelPollingService.poll();
        
        // Restore state
        if (!wasPolling) {
            excelPollingService.isPolling = false;
        }
        
        res.json({
            success: true,
            message: 'Test poll completed',
            stats: excelPollingService.stats
        });
    } catch (error) {
        console.error('Error in test poll:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
