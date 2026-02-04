/**
 * Debug Configuration Routes
 * API endpoints for controlling debug output categories
 */

const express = require('express');
const router = express.Router();
const debugConfigService = require('../services/debug-config.service');

/**
 * GET /api/debug-config/status
 * Get current debug configuration status
 */
router.get('/status', (req, res) => {
    try {
        const status = debugConfigService.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/toggle/:categoryId
 * Toggle a specific debug category
 */
router.post('/toggle/:categoryId', (req, res) => {
    try {
        const { categoryId } = req.params;
        const result = debugConfigService.toggle(categoryId);
        
        if (result === null) {
            return res.status(404).json({ error: `Category '${categoryId}' not found` });
        }
        
        res.json({
            success: true,
            categoryId,
            enabled: result,
            message: `Category '${categoryId}' is now ${result ? 'enabled' : 'muted'}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/enable/:categoryId
 * Enable a specific debug category
 */
router.post('/enable/:categoryId', (req, res) => {
    try {
        const { categoryId } = req.params;
        const success = debugConfigService.enable(categoryId);
        
        if (!success) {
            return res.status(404).json({ error: `Category '${categoryId}' not found` });
        }
        
        res.json({
            success: true,
            categoryId,
            enabled: true,
            message: `Category '${categoryId}' is now enabled`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/disable/:categoryId
 * Disable (mute) a specific debug category
 */
router.post('/disable/:categoryId', (req, res) => {
    try {
        const { categoryId } = req.params;
        const success = debugConfigService.disable(categoryId);
        
        if (!success) {
            return res.status(404).json({ error: `Category '${categoryId}' not found` });
        }
        
        res.json({
            success: true,
            categoryId,
            enabled: false,
            message: `Category '${categoryId}' is now muted`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/set
 * Set multiple categories at once
 * Body: { categories: { "excel-polling": true, "sml": false, ... } }
 */
router.post('/set', (req, res) => {
    try {
        const { categories } = req.body;
        
        if (!categories || typeof categories !== 'object') {
            return res.status(400).json({ error: 'Categories object is required' });
        }
        
        const result = debugConfigService.setCategories(categories);
        res.json({
            success: true,
            categories: result,
            message: 'Debug categories updated'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/enable-all
 * Enable all debug categories
 */
router.post('/enable-all', (req, res) => {
    try {
        const categories = debugConfigService.enableAll();
        res.json({
            success: true,
            categories,
            message: 'All debug categories enabled'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/debug-config/disable-all
 * Disable (mute) all debug categories
 */
router.post('/disable-all', (req, res) => {
    try {
        const categories = debugConfigService.disableAll();
        res.json({
            success: true,
            categories,
            message: 'All debug categories muted'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
