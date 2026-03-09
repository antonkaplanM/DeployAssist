/**
 * User Settings Routes
 * Per-user preferences and secrets (e.g. LLM API keys).
 * All routes require authentication; users can only access their own settings.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../database');
const { asyncHandler } = require('../middleware/error-handler');
const { encrypt, decrypt, mask } = require('../utils/encryption');
const logger = require('../utils/logger');

const llmTestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many test requests – please wait a minute.' },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * GET /api/user-settings/llm
 * Returns the current LLM configuration for the authenticated user.
 * API key is masked for security.
 */
router.get('/llm', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await db.query(
        `SELECT setting_key, setting_value, is_encrypted
         FROM user_settings
         WHERE user_id = $1 AND setting_key IN ('llm_api_key', 'llm_model')`,
        [userId]
    );

    const settings = {};
    for (const row of result.rows) {
        if (row.is_encrypted && row.setting_value) {
            try {
                const decrypted = decrypt(row.setting_value);
                settings[row.setting_key] = {
                    value: mask(decrypted),
                    isSet: true
                };
            } catch {
                settings[row.setting_key] = { value: '', isSet: false };
            }
        } else {
            settings[row.setting_key] = {
                value: row.setting_value || '',
                isSet: !!row.setting_value
            };
        }
    }

    res.json({
        success: true,
        settings: {
            apiKey: settings.llm_api_key || { value: '', isSet: false },
            model: settings.llm_model?.value || 'gpt-4o'
        }
    });
}));

/**
 * PUT /api/user-settings/llm
 * Save or update LLM configuration for the authenticated user.
 * Body: { apiKey?: string, model?: string }
 */
router.put('/llm', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { apiKey, model } = req.body;

    if (apiKey !== undefined) {
        if (apiKey === '') {
            await db.query(
                `DELETE FROM user_settings WHERE user_id = $1 AND setting_key = 'llm_api_key'`,
                [userId]
            );
            logger.info('User cleared LLM API key', { userId });
        } else {
            const encrypted = encrypt(apiKey);
            await db.query(
                `INSERT INTO user_settings (user_id, setting_key, setting_value, is_encrypted, updated_at)
                 VALUES ($1, 'llm_api_key', $2, TRUE, NOW())
                 ON CONFLICT (user_id, setting_key)
                 DO UPDATE SET setting_value = $2, is_encrypted = TRUE, updated_at = NOW()`,
                [userId, encrypted]
            );
            logger.info('User saved LLM API key', { userId });
        }
    }

    if (model !== undefined) {
        await db.query(
            `INSERT INTO user_settings (user_id, setting_key, setting_value, is_encrypted, updated_at)
             VALUES ($1, 'llm_model', $2, FALSE, NOW())
             ON CONFLICT (user_id, setting_key)
             DO UPDATE SET setting_value = $2, is_encrypted = FALSE, updated_at = NOW()`,
            [userId, model]
        );
    }

    res.json({
        success: true,
        message: 'LLM settings saved successfully'
    });
}));

/**
 * DELETE /api/user-settings/llm
 * Remove all LLM settings for the authenticated user.
 */
router.delete('/llm', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await db.query(
        `DELETE FROM user_settings WHERE user_id = $1 AND setting_key IN ('llm_api_key', 'llm_model')`,
        [userId]
    );

    logger.info('User removed LLM settings', { userId: req.user.id });

    res.json({
        success: true,
        message: 'LLM settings removed'
    });
}));

/**
 * POST /api/user-settings/llm/test
 * Test the user's LLM API key by making a minimal completions call.
 */
router.post('/llm/test', llmTestLimiter, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await db.query(
        `SELECT setting_value FROM user_settings
         WHERE user_id = $1 AND setting_key = 'llm_api_key' AND is_encrypted = TRUE`,
        [userId]
    );

    if (!result.rows.length || !result.rows[0].setting_value) {
        return res.json({
            success: false,
            message: 'No API key configured. Save a key first.'
        });
    }

    let apiKey;
    try {
        apiKey = decrypt(result.rows[0].setting_value);
    } catch {
        return res.json({
            success: false,
            message: 'Failed to decrypt stored key. Please save the key again.'
        });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Say "ok"' }],
            max_tokens: 5
        });

        res.json({
            success: true,
            message: 'API key is valid and working',
            details: {
                model: completion.model,
                usage: completion.usage
            }
        });
    } catch (err) {
        const status = err.status || err.code;
        let message = 'API key test failed';
        if (status === 401) message = 'Invalid API key – authentication failed';
        else if (status === 429) message = 'Rate limited – key is valid but quota exceeded';
        else if (status === 403) message = 'Access denied – check key permissions';
        else message = `API error: ${err.message}`;

        res.json({ success: false, message });
    }
}));

// ═══════════════════════════════════════════════════════════
//  Mixpanel Settings
// ═══════════════════════════════════════════════════════════

const mixpanelTestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many test requests – please wait a minute.' },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * GET /api/user-settings/mixpanel
 * Returns current Mixpanel configuration for the authenticated user.
 * Secrets are masked.
 */
router.get('/mixpanel', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await db.query(
        `SELECT setting_key, setting_value, is_encrypted
         FROM user_settings
         WHERE user_id = $1 AND setting_key IN ('mixpanel_username', 'mixpanel_secret', 'mixpanel_project_id')`,
        [userId]
    );

    const settings = {};
    for (const row of result.rows) {
        if (row.is_encrypted && row.setting_value) {
            try {
                const decrypted = decrypt(row.setting_value);
                settings[row.setting_key] = { value: mask(decrypted), isSet: true };
            } catch {
                settings[row.setting_key] = { value: '', isSet: false };
            }
        } else {
            settings[row.setting_key] = { value: row.setting_value || '', isSet: !!row.setting_value };
        }
    }

    const hasEnvFallback = !!(process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME && process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET);

    res.json({
        success: true,
        settings: {
            username: settings.mixpanel_username || { value: '', isSet: false },
            secret: settings.mixpanel_secret || { value: '', isSet: false },
            projectId: settings.mixpanel_project_id || { value: '', isSet: false },
        },
        hasEnvFallback,
    });
}));

/**
 * PUT /api/user-settings/mixpanel
 * Save or update Mixpanel credentials for the authenticated user.
 * Body: { username?: string, secret?: string, projectId?: string }
 */
router.put('/mixpanel', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { username, secret, projectId } = req.body;

    const upsert = async (key, value, encrypted) => {
        if (value === '') {
            await db.query(`DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2`, [userId, key]);
        } else {
            const stored = encrypted ? encrypt(value) : value;
            await db.query(
                `INSERT INTO user_settings (user_id, setting_key, setting_value, is_encrypted, updated_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (user_id, setting_key)
                 DO UPDATE SET setting_value = $3, is_encrypted = $4, updated_at = NOW()`,
                [userId, key, stored, encrypted]
            );
        }
    };

    if (username !== undefined) await upsert('mixpanel_username', username, true);
    if (secret !== undefined) await upsert('mixpanel_secret', secret, true);
    if (projectId !== undefined) await upsert('mixpanel_project_id', projectId, false);

    logger.info('User saved Mixpanel settings', { userId });

    res.json({ success: true, message: 'Mixpanel settings saved successfully' });
}));

/**
 * DELETE /api/user-settings/mixpanel
 * Remove all Mixpanel settings for the authenticated user.
 */
router.delete('/mixpanel', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await db.query(
        `DELETE FROM user_settings WHERE user_id = $1 AND setting_key IN ('mixpanel_username', 'mixpanel_secret', 'mixpanel_project_id')`,
        [userId]
    );

    logger.info('User removed Mixpanel settings', { userId });
    res.json({ success: true, message: 'Mixpanel settings removed' });
}));

/**
 * POST /api/user-settings/mixpanel/test
 * Test connectivity using stored Mixpanel credentials.
 */
router.post('/mixpanel/test', mixpanelTestLimiter, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const mixpanelService = require('../services/mixpanel.service');

    const rows = await db.query(
        `SELECT setting_key, setting_value, is_encrypted
         FROM user_settings
         WHERE user_id = $1 AND setting_key IN ('mixpanel_username', 'mixpanel_secret', 'mixpanel_project_id')`,
        [userId]
    );

    const creds = {};
    for (const row of rows.rows) {
        creds[row.setting_key] = row.is_encrypted ? decrypt(row.setting_value) : row.setting_value;
    }

    const username = creds.mixpanel_username || process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME;
    const secret = creds.mixpanel_secret || process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
    const projectId = creds.mixpanel_project_id || process.env.MIXPANEL_PROJECT_ID;

    if (!username || !secret) {
        return res.json({ success: false, message: 'No Mixpanel credentials configured. Save credentials first.' });
    }

    const result = await mixpanelService.testConnection({ username, secret, projectId });
    res.json(result);
}));

module.exports = router;
