/**
 * Mixpanel Routes
 * API endpoints for Mixpanel analytics data.
 * Credentials are resolved per-user from user_settings (encrypted),
 * falling back to MIXPANEL_* environment variables.
 */

const express = require('express');
const router = express.Router();
const mixpanelService = require('../services/mixpanel.service');
const db = require('../database');
const { asyncHandler, BadRequestError } = require('../middleware/error-handler');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * Resolve Mixpanel credentials for the current user.
 * Priority: user_settings (encrypted) → environment variables.
 */
async function resolveCredentials(userId) {
    const result = await db.query(
        `SELECT setting_key, setting_value, is_encrypted
         FROM user_settings
         WHERE user_id = $1 AND setting_key IN ('mixpanel_username', 'mixpanel_secret', 'mixpanel_project_id')`,
        [userId]
    );

    const creds = {};
    for (const row of result.rows) {
        creds[row.setting_key] = row.is_encrypted ? decrypt(row.setting_value) : row.setting_value;
    }

    return {
        username: creds.mixpanel_username || process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME || '',
        secret: creds.mixpanel_secret || process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET || '',
        projectId: creds.mixpanel_project_id || process.env.MIXPANEL_PROJECT_ID || '',
    };
}

/**
 * GET /api/mixpanel/events
 * Export raw events from Mixpanel.
 * Query params: fromDate, toDate, event, limit
 */
router.get('/events', asyncHandler(async (req, res) => {
    const { fromDate, toDate, event, limit } = req.query;
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured. Add them in Settings → Data Sources → Mixpanel.' });
    }

    const result = await mixpanelService.exportEvents({
        ...creds,
        fromDate,
        toDate,
        event,
        limit: limit ? parseInt(limit, 10) : undefined,
    });

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * GET /api/mixpanel/insights
 * Query Mixpanel Insights report.
 * Query params: bookmarkId
 */
router.get('/insights', asyncHandler(async (req, res) => {
    const { bookmarkId } = req.query;
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const result = await mixpanelService.queryInsights({
        ...creds,
        bookmarkId,
    });

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * GET /api/mixpanel/funnels
 * Query Mixpanel Funnels report.
 * Query params: funnelId
 */
router.get('/funnels', asyncHandler(async (req, res) => {
    const { funnelId } = req.query;
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const result = await mixpanelService.queryFunnels({
        ...creds,
        funnelId,
    });

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * GET /api/mixpanel/retention
 * Query Mixpanel Retention report.
 * Query params: bookmarkId
 */
router.get('/retention', asyncHandler(async (req, res) => {
    const { bookmarkId } = req.query;
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const result = await mixpanelService.queryRetention({
        ...creds,
        bookmarkId,
    });

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * GET /api/mixpanel/profiles
 * Query Mixpanel user profiles.
 * Query params: where, outputProperties
 */
router.get('/profiles', asyncHandler(async (req, res) => {
    const { where, outputProperties } = req.query;
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const result = await mixpanelService.queryProfiles({
        ...creds,
        where,
        outputProperties,
    });

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * GET /api/mixpanel/event-names
 * List distinct event names tracked in the project.
 */
router.get('/event-names', asyncHandler(async (req, res) => {
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const result = await mixpanelService.getEventNames(creds);

    res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
    });
}));

/**
 * POST /api/mixpanel/test-connection
 * Test Mixpanel connectivity using stored or provided credentials.
 * Body (optional): { username, secret, projectId } — if omitted, uses stored creds.
 */
router.post('/test-connection', asyncHandler(async (req, res) => {
    let creds;

    if (req.body.username && req.body.secret) {
        creds = {
            username: req.body.username,
            secret: req.body.secret,
            projectId: req.body.projectId || '',
        };
    } else {
        creds = await resolveCredentials(req.user.id);
    }

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'No credentials provided or stored.' });
    }

    const result = await mixpanelService.testConnection(creds);
    res.json(result);
}));

module.exports = router;
