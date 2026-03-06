/**
 * Report Data Routes
 * Server-side data proxy that supports cross-endpoint enrichment.
 * When a report component needs data from two sources joined together,
 * the frontend POSTs to /api/report-data/fetch with an enrich config
 * and this route handles the join server-side.
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const { isEndpointAllowed, getByEndpoint, getDataCatalogByCategory } = require('../config/report-data-sources');
const { asyncHandler } = require('../middleware/error-handler');
const envConfig = require('../config/environment');
const logger = require('../utils/logger');

function resolveField(obj, dotPath) {
    if (!obj || !dotPath) return undefined;
    return dotPath.split('.').reduce((o, key) => o?.[key], obj);
}

function buildInternalFetcher(req) {
    const baseURL = `http://localhost:${envConfig.app.port}`;
    const headers = {};
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers.cookie) {
        headers['Cookie'] = req.headers.cookie;
    }

    return async (endpoint, params) => {
        const response = await axios.get(`${baseURL}${endpoint}`, {
            params,
            headers,
            timeout: 15000
        });
        return response.data;
    };
}

function extractArray(responseData, arrayKey) {
    if (!responseData) return [];
    if (Array.isArray(responseData)) return responseData;
    if (arrayKey && Array.isArray(responseData[arrayKey])) {
        return responseData[arrayKey];
    }
    for (const val of Object.values(responseData)) {
        if (Array.isArray(val)) return val;
    }
    return [];
}

/**
 * GET /api/report-data/catalog
 * Returns the data catalog grouped by category for display in the UI.
 */
router.get('/catalog', asyncHandler(async (req, res) => {
    const catalog = getDataCatalogByCategory();
    return res.json({ success: true, catalog });
}));

/**
 * POST /api/report-data/fetch
 * Fetch data from a primary endpoint, optionally enriching with a second endpoint.
 */
router.post('/fetch', asyncHandler(async (req, res) => {
    const { endpoint, params, arrayKey, enrich } = req.body;

    if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ success: false, error: 'endpoint is required' });
    }
    if (!isEndpointAllowed(endpoint)) {
        return res.status(400).json({ success: false, error: `Endpoint "${endpoint}" is not in the allowlisted data catalog` });
    }
    if (enrich) {
        if (!enrich.endpoint || !isEndpointAllowed(enrich.endpoint)) {
            return res.status(400).json({ success: false, error: `Enrichment endpoint "${enrich.endpoint}" is not in the allowlisted data catalog` });
        }
        if (!enrich.sourceField || !enrich.matchField || !Array.isArray(enrich.fields) || enrich.fields.length === 0) {
            return res.status(400).json({ success: false, error: 'enrich requires sourceField, matchField, and at least one field' });
        }
    }

    const fetcher = buildInternalFetcher(req);

    const primaryData = await fetcher(endpoint, params || {});

    if (!enrich) {
        return res.json(primaryData);
    }

    const enrichData = await fetcher(enrich.endpoint, enrich.params || {});

    const enrichArrayKey = enrich.arrayKey || getByEndpoint(enrich.endpoint)?.responseShape?.arrayKey;
    const enrichRows = extractArray(enrichData, enrichArrayKey);

    const lookupMap = new Map();
    for (const row of enrichRows) {
        const key = row?.[enrich.matchField];
        if (key != null) {
            const normalizedKey = String(key).toLowerCase().trim();
            if (!lookupMap.has(normalizedKey)) {
                lookupMap.set(normalizedKey, row);
            }
        }
    }

    const primaryArrayKey = arrayKey || getByEndpoint(endpoint)?.responseShape?.arrayKey;
    const primaryRows = extractArray(primaryData, primaryArrayKey);

    for (const row of primaryRows) {
        const sourceValue = resolveField(row, enrich.sourceField);
        if (sourceValue == null) continue;
        const normalizedSource = String(sourceValue).toLowerCase().trim();
        const match = lookupMap.get(normalizedSource);
        if (match) {
            for (const field of enrich.fields) {
                if (match[field] !== undefined) {
                    row[field] = match[field];
                }
            }
        }
    }

    logger.debug('Report data enrichment completed', {
        primaryEndpoint: endpoint,
        enrichEndpoint: enrich.endpoint,
        primaryRows: primaryRows.length,
        enrichRows: enrichRows.length,
        matchedRows: primaryRows.filter(r => enrich.fields.some(f => r[f] !== undefined)).length
    });

    return res.json(primaryData);
}));

module.exports = router;
