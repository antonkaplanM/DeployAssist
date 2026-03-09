/**
 * Mixpanel Service
 * Provides authenticated access to Mixpanel APIs using service account credentials.
 * Supports Raw Event Export, Query API (Insights, Funnels, Retention), and Engage (Profiles).
 *
 * Credentials are stored per-user (encrypted) in the user_settings table,
 * with optional fallback to environment variables for shared/server-wide config.
 */

const https = require('https');
const logger = require('../utils/logger');
const { InternalServerError, BadRequestError } = require('../middleware/error-handler');

const MIXPANEL_DATA_HOST = 'data.mixpanel.com';
const MIXPANEL_API_HOST = 'mixpanel.com';
const REQUEST_TIMEOUT_MS = 120000;

class MixpanelService {

    /**
     * Build the Basic Auth header from service account username + secret.
     */
    _authHeader(username, secret) {
        return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64');
    }

    /**
     * Generic HTTPS request helper.
     * Returns parsed JSON (or raw text for JSONL export).
     */
    _request(host, path, { method = 'GET', auth, body, parseJsonl = false } = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: host,
                path,
                method,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': auth,
                },
                timeout: REQUEST_TIMEOUT_MS,
            };

            if (body) {
                const payload = typeof body === 'string' ? body : JSON.stringify(body);
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                options.headers['Content-Length'] = Buffer.byteLength(payload);
            }

            const req = https.request(options, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8');

                    if (res.statusCode === 401 || res.statusCode === 403) {
                        return reject(new Error(`Mixpanel auth failed (${res.statusCode}). Check service account credentials.`));
                    }
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Mixpanel API error ${res.statusCode}: ${raw.substring(0, 500)}`));
                    }

                    if (parseJsonl) {
                        const events = raw
                            .split('\n')
                            .filter(line => line.trim())
                            .map(line => {
                                try { return JSON.parse(line); }
                                catch { return null; }
                            })
                            .filter(Boolean);
                        return resolve(events);
                    }

                    try {
                        resolve(JSON.parse(raw));
                    } catch {
                        resolve(raw);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Mixpanel request timed out'));
            });

            req.on('error', reject);

            if (body) {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
            req.end();
        });
    }

    // ─────────────────────────────────────────────────────
    //  Connection test
    // ─────────────────────────────────────────────────────

    /**
     * Test connectivity and authentication against Mixpanel.
     * Makes a lightweight call to the export API with a 1-day window.
     */
    async testConnection({ username, secret, projectId }) {
        if (!username || !secret) {
            return { success: false, message: 'Service account username and secret are required' };
        }
        if (!projectId) {
            return { success: false, message: 'Project ID is required. Find it in Mixpanel → Project Settings.' };
        }

        const auth = this._authHeader(username, secret);
        const today = new Date().toISOString().split('T')[0];

        try {
            const path = `/api/2.0/export?project_id=${encodeURIComponent(projectId)}&from_date=${today}&to_date=${today}&limit=1`;
            await this._request(MIXPANEL_DATA_HOST, path, { auth, parseJsonl: true });

            return {
                success: true,
                message: 'Mixpanel connection successful',
                details: {
                    host: MIXPANEL_DATA_HOST,
                    projectId,
                    authenticatedAt: new Date().toISOString(),
                }
            };
        } catch (err) {
            return {
                success: false,
                message: err.message || 'Connection failed',
            };
        }
    }

    // ─────────────────────────────────────────────────────
    //  Raw Event Export
    // ─────────────────────────────────────────────────────

    /**
     * Export raw events from Mixpanel (buffered — suitable for small result sets only).
     * @param {Object} opts
     * @param {string} opts.username   Service account username
     * @param {string} opts.secret     Service account secret
     * @param {string} opts.fromDate   YYYY-MM-DD
     * @param {string} opts.toDate     YYYY-MM-DD
     * @param {string} [opts.event]    Specific event name(s) as JSON array string
     * @param {number} [opts.limit]    Max events to return
     */
    async exportEvents({ username, secret, projectId, fromDate, toDate, event, limit }) {
        if (!fromDate || !toDate) {
            throw new BadRequestError('fromDate and toDate are required (YYYY-MM-DD)');
        }

        const auth = this._authHeader(username, secret);
        let path = `/api/2.0/export?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
        if (projectId) path += `&project_id=${encodeURIComponent(projectId)}`;
        if (event) path += `&event=${encodeURIComponent(event)}`;
        if (limit) path += `&limit=${limit}`;

        const events = await this._request(MIXPANEL_DATA_HOST, path, { auth, parseJsonl: true });

        const eventCounts = {};
        for (const evt of events) {
            const name = evt.event || 'unknown';
            eventCounts[name] = (eventCounts[name] || 0) + 1;
        }

        return {
            events,
            totalCount: events.length,
            eventCounts,
            dateRange: { fromDate, toDate },
        };
    }

    /**
     * Stream-export raw events from Mixpanel, invoking onEvent(parsedObj) for
     * each JSONL line.  Never buffers the full response — safe for arbitrarily
     * large exports.
     *
     * @param {Object} opts
     * @param {string}   opts.username
     * @param {string}   opts.secret
     * @param {string}   opts.projectId
     * @param {string}   opts.fromDate    YYYY-MM-DD
     * @param {string}   opts.toDate      YYYY-MM-DD
     * @param {string}   [opts.event]     JSON-encoded array of event names
     * @param {Function} opts.onEvent     Called with each parsed event object
     * @returns {Promise<{ totalCount: number, dateRange: object }>}
     */
    exportEventsStreaming({ username, secret, projectId, fromDate, toDate, event, onEvent }) {
        if (!fromDate || !toDate) {
            throw new BadRequestError('fromDate and toDate are required (YYYY-MM-DD)');
        }
        if (typeof onEvent !== 'function') {
            throw new BadRequestError('onEvent callback is required for streaming export');
        }

        const auth = this._authHeader(username, secret);
        let path = `/api/2.0/export?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
        if (projectId) path += `&project_id=${encodeURIComponent(projectId)}`;
        if (event) path += `&event=${encodeURIComponent(event)}`;

        return new Promise((resolve, reject) => {
            const options = {
                hostname: MIXPANEL_DATA_HOST,
                path,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': auth,
                },
                timeout: REQUEST_TIMEOUT_MS,
            };

            const req = https.request(options, (res) => {
                if (res.statusCode === 401 || res.statusCode === 403) {
                    res.resume();
                    return reject(new Error(`Mixpanel auth failed (${res.statusCode}).`));
                }
                if (res.statusCode >= 400) {
                    const errChunks = [];
                    res.on('data', c => errChunks.push(c));
                    res.on('end', () => reject(new Error(
                        `Mixpanel API error ${res.statusCode}: ${Buffer.concat(errChunks).toString('utf8').substring(0, 500)}`
                    )));
                    return;
                }

                let totalCount = 0;
                let partial = '';

                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    partial += chunk;
                    const lines = partial.split('\n');
                    partial = lines.pop();
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const evt = JSON.parse(trimmed);
                            totalCount++;
                            onEvent(evt);
                        } catch {
                            // skip malformed lines
                        }
                    }
                });

                res.on('end', () => {
                    if (partial.trim()) {
                        try {
                            const evt = JSON.parse(partial.trim());
                            totalCount++;
                            onEvent(evt);
                        } catch {
                            // skip
                        }
                    }
                    resolve({ totalCount, dateRange: { fromDate, toDate } });
                });

                res.on('error', reject);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Mixpanel streaming export timed out'));
            });
            req.on('error', reject);
            req.end();
        });
    }

    // ─────────────────────────────────────────────────────
    //  Query API — Insights
    // ─────────────────────────────────────────────────────

    /**
     * Query Mixpanel Insights for a saved report or inline query.
     * @param {Object} opts
     * @param {string} opts.username
     * @param {string} opts.secret
     * @param {string} opts.projectId
     * @param {string} [opts.bookmarkId]  Saved report bookmark ID
     */
    async queryInsights({ username, secret, projectId, bookmarkId }) {
        if (!projectId) throw new BadRequestError('projectId is required for Insights queries');

        const auth = this._authHeader(username, secret);
        let path = `/api/query/insights?project_id=${encodeURIComponent(projectId)}`;
        if (bookmarkId) path += `&bookmark_id=${encodeURIComponent(bookmarkId)}`;

        const data = await this._request(MIXPANEL_API_HOST, path, { auth });
        return { results: data, projectId };
    }

    // ─────────────────────────────────────────────────────
    //  Query API — Funnels
    // ─────────────────────────────────────────────────────

    /**
     * Query Mixpanel Funnels.
     * @param {Object} opts
     * @param {string} opts.username
     * @param {string} opts.secret
     * @param {string} opts.projectId
     * @param {string} [opts.funnelId]  Saved funnel ID
     */
    async queryFunnels({ username, secret, projectId, funnelId }) {
        if (!projectId) throw new BadRequestError('projectId is required for Funnel queries');

        const auth = this._authHeader(username, secret);
        let path = `/api/query/funnels?project_id=${encodeURIComponent(projectId)}`;
        if (funnelId) path += `&funnel_id=${encodeURIComponent(funnelId)}`;

        const data = await this._request(MIXPANEL_API_HOST, path, { auth });
        return { results: data, projectId };
    }

    // ─────────────────────────────────────────────────────
    //  Query API — Retention
    // ─────────────────────────────────────────────────────

    /**
     * Query Mixpanel Retention.
     */
    async queryRetention({ username, secret, projectId, bookmarkId }) {
        if (!projectId) throw new BadRequestError('projectId is required for Retention queries');

        const auth = this._authHeader(username, secret);
        let path = `/api/query/retention?project_id=${encodeURIComponent(projectId)}`;
        if (bookmarkId) path += `&bookmark_id=${encodeURIComponent(bookmarkId)}`;

        const data = await this._request(MIXPANEL_API_HOST, path, { auth });
        return { results: data, projectId };
    }

    // ─────────────────────────────────────────────────────
    //  Engage API — User Profiles
    // ─────────────────────────────────────────────────────

    /**
     * Query user profiles from Mixpanel.
     * @param {Object} opts
     * @param {string} opts.username
     * @param {string} opts.secret
     * @param {string} opts.projectId
     * @param {string} [opts.where]           Expression to filter profiles
     * @param {string} [opts.outputProperties] JSON array of property names
     */
    async queryProfiles({ username, secret, projectId, where, outputProperties }) {
        if (!projectId) throw new BadRequestError('projectId is required for profile queries');

        const auth = this._authHeader(username, secret);
        let path = `/api/query/engage?project_id=${encodeURIComponent(projectId)}`;

        const params = new URLSearchParams();
        if (where) params.set('where', where);
        if (outputProperties) params.set('output_properties', outputProperties);
        const qs = params.toString();
        if (qs) path += `&${qs}`;

        const data = await this._request(MIXPANEL_API_HOST, path, { auth, method: 'POST' });

        return {
            profiles: data.results || [],
            totalCount: data.total || 0,
            page: data.page || 0,
            projectId,
        };
    }

    // ─────────────────────────────────────────────────────
    //  Event names list (for UI dropdowns)
    // ─────────────────────────────────────────────────────

    /**
     * Get distinct event names tracked in the project (last 30 days).
     */
    async getEventNames({ username, secret, projectId }) {
        if (!projectId) throw new BadRequestError('projectId is required');

        const auth = this._authHeader(username, secret);
        const path = `/api/2.0/events/names?project_id=${encodeURIComponent(projectId)}&type=general&limit=255`;

        const data = await this._request(MIXPANEL_DATA_HOST, path, { auth });
        return { eventNames: Array.isArray(data) ? data : [], projectId };
    }
}

module.exports = new MixpanelService();
