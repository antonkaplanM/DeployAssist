/**
 * Daily Limit Exceedances Routes
 *
 * DB-backed with async refresh (same pattern as usage-limits):
 *   GET  /                 – reads per-day exceedance data from DB (instant)
 *   POST /refresh          – kicks off async Mixpanel streaming job, returns 202
 *   GET  /refresh/status   – polls job progress
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const mixpanelService = require('../services/mixpanel.service');
const db = require('../database');
const { asyncHandler } = require('../middleware/error-handler');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const JOB_TYPE = 'daily-exceedances';

const QUOTA_EVENTS = [
    'DailyJobsRun',
    'DailyUnderwriterJobsRun',
    'DailyTreatyJobsRun',
    'DailyTreatiesAnalyzed',
    'DailyExposureJobsRun',
    'JobCoreMinutes',
    'JobCoreCount',
    'LocationsModeled',
    'EntitlementUsage',
];
const quotaSet = new Set(QUOTA_EVENTS);

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

// ═══════════════════════════════════════════════════════════════════
//  GET /  — Read daily exceedance data from DB
// ═══════════════════════════════════════════════════════════════════
router.get('/', asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 14, 365);
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const projectId = creds.projectId;

    // Read all daily exceedance rows (only exceeded=true for the report)
    const snapResult = await db.query(
        `SELECT tenant_id, event_date, metric_type, max_value,
                limit_value, utilization, service_id, snapshot_at
         FROM mixpanel_daily_exceedances
         WHERE project_id = $1 AND days = $2 AND exceeded = TRUE
         ORDER BY tenant_id, event_date DESC, metric_type`,
        [projectId, days]
    );

    if (snapResult.rows.length === 0) {
        const runningJob = await db.query(
            `SELECT job_id, status, events_processed, tenants_found, started_at
             FROM mixpanel_refresh_jobs
             WHERE project_id = $1 AND days = $2 AND status = 'running'
               AND COALESCE(job_type, 'usage-limits') = $3
             ORDER BY started_at DESC LIMIT 1`,
            [projectId, days, JOB_TYPE]
        );
        return res.json({
            success: true,
            tenants: [],
            summary: { totalTenantsExceeded: 0, totalExceedanceDays: 0, periodDays: days },
            dateRange: { days },
            needsRefresh: true,
            activeJob: runningJob.rows[0] || null,
            timestamp: new Date().toISOString(),
        });
    }

    // Group by tenant → date → metrics
    const tenantMap = {};
    let snapshotAt = null;

    for (const row of snapResult.rows) {
        const tid = row.tenant_id;
        const dateStr = row.event_date instanceof Date
            ? row.event_date.toISOString().split('T')[0]
            : String(row.event_date);

        if (!tenantMap[tid]) {
            tenantMap[tid] = { tenantId: tid, dateMap: {} };
        }
        if (!tenantMap[tid].dateMap[dateStr]) {
            tenantMap[tid].dateMap[dateStr] = [];
        }
        tenantMap[tid].dateMap[dateStr].push({
            metricType: row.metric_type,
            value: row.max_value,
            limit: row.limit_value,
            utilization: row.utilization,
            serviceId: row.service_id || '',
        });

        if (!snapshotAt || row.snapshot_at > snapshotAt) snapshotAt = row.snapshot_at;
    }

    // Build tenant array
    const tenants = Object.values(tenantMap).map(t => {
        const exceedances = Object.entries(t.dateMap)
            .map(([date, metrics]) => ({ date, metrics }))
            .sort((a, b) => b.date.localeCompare(a.date));

        return {
            tenantId: t.tenantId,
            tenantName: null,
            accountName: null,
            displayName: null,
            totalExceedanceDays: exceedances.length,
            exceedances,
        };
    });

    // Bulk-resolve account names
    const tenantIds = tenants.map(t => t.tenantId);
    if (tenantIds.length > 0) {
        try {
            const accountResult = await db.query(
                `SELECT tenant_id, tenant_name, account_name, tenant_display_name
                 FROM sml_tenant_data
                 WHERE tenant_id = ANY($1) AND is_deleted = false`,
                [tenantIds]
            );
            const accountMap = {};
            for (const row of accountResult.rows) {
                accountMap[row.tenant_id] = {
                    tenantName: row.tenant_name || null,
                    accountName: row.account_name || null,
                    displayName: row.tenant_display_name || null,
                };
            }
            for (const t of tenants) {
                const match = accountMap[t.tenantId];
                if (match) {
                    t.tenantName = match.tenantName;
                    t.accountName = match.accountName;
                    t.displayName = match.displayName;
                }
            }
        } catch (err) {
            logger.warn('Could not resolve account names:', err.message);
        }
    }

    // Sort by exceedance days descending
    tenants.sort((a, b) => b.totalExceedanceDays - a.totalExceedanceDays);

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days);

    const totalExceedanceDays = tenants.reduce((sum, t) => sum + t.totalExceedanceDays, 0);

    res.json({
        success: true,
        tenants,
        summary: {
            totalTenantsExceeded: tenants.length,
            totalExceedanceDays,
            periodDays: days,
        },
        dateRange: {
            fromDate: start.toISOString().split('T')[0],
            toDate: today.toISOString().split('T')[0],
            days,
        },
        lastRefreshedAt: snapshotAt ? snapshotAt.toISOString() : null,
        timestamp: new Date().toISOString(),
    });
}));

// ═══════════════════════════════════════════════════════════════════
//  POST /refresh  — Start async Mixpanel export + daily aggregation
// ═══════════════════════════════════════════════════════════════════
router.post('/refresh', asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 14, 365);
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const projectId = creds.projectId;

    const existing = await db.query(
        `SELECT job_id, started_at, events_processed, tenants_found
         FROM mixpanel_refresh_jobs
         WHERE project_id = $1 AND days = $2 AND status = 'running'
           AND COALESCE(job_type, 'usage-limits') = $3
         ORDER BY started_at DESC LIMIT 1`,
        [projectId, days, JOB_TYPE]
    );

    if (existing.rows.length > 0) {
        const job = existing.rows[0];
        return res.status(202).json({
            success: true,
            message: 'A refresh is already in progress.',
            jobId: job.job_id,
            alreadyRunning: true,
            startedAt: job.started_at,
        });
    }

    const jobId = crypto.randomUUID();
    await db.query(
        `INSERT INTO mixpanel_refresh_jobs (job_id, project_id, days, status, requested_by, started_at, job_type)
         VALUES ($1, $2, $3, 'running', $4, CURRENT_TIMESTAMP, $5)`,
        [jobId, projectId, days, req.user.id, JOB_TYPE]
    );

    res.status(202).json({
        success: true,
        message: 'Refresh started. Poll /refresh/status for progress.',
        jobId,
    });

    runRefreshJob(jobId, projectId, days, creds).catch(err => {
        logger.error(`Daily exceedances refresh job ${jobId} unexpected error:`, err.message);
    });
}));

/**
 * Background refresh: streams quota events from Mixpanel, aggregates by day, writes to DB.
 *
 * For each quota event we track the MAX value per (tenant, date, metric).
 * After streaming we compute utilization and mark exceeded=true where utilization >= 100%.
 */
async function runRefreshJob(jobId, projectId, days, creds) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const toDate = today.toISOString().split('T')[0];
    const fromDate = start.toISOString().split('T')[0];

    const eventFilter = JSON.stringify(QUOTA_EVENTS);

    // Key: `${tenantId}|${dateStr}|${metricType}`
    const dailyMap = {};
    let processedCount = 0;
    let lastProgressUpdate = 0;

    try {
        const { totalCount } = await mixpanelService.exportEventsStreaming({
            ...creds,
            fromDate,
            toDate,
            event: eventFilter,
            onEvent(evt) {
                const tid = evt.properties?.TenantId;
                if (!tid) return;

                const metricType = evt.event;
                if (!quotaSet.has(metricType)) return;

                const ts = evt.properties?.time || 0;
                const eventDate = new Date(ts * 1000).toISOString().split('T')[0];
                const metricValue = parseFloat(evt.properties?.MetricValue) || 0;
                const limitValue = evt.properties?.limit != null ? parseFloat(evt.properties.limit) : null;
                const serviceId = evt.properties?.ServiceId || '';

                const key = `${tid}|${eventDate}|${metricType}`;
                const existing = dailyMap[key];

                if (!existing) {
                    dailyMap[key] = {
                        tenantId: tid,
                        eventDate,
                        metricType,
                        maxValue: metricValue,
                        limitValue,
                        serviceId,
                        lastTs: ts,
                    };
                } else {
                    if (metricValue > existing.maxValue) {
                        existing.maxValue = metricValue;
                    }
                    if (limitValue !== null && (existing.limitValue === null || ts > existing.lastTs)) {
                        existing.limitValue = limitValue;
                    }
                    if (ts > existing.lastTs) {
                        existing.lastTs = ts;
                        existing.serviceId = serviceId;
                    }
                }

                processedCount++;
                if (processedCount - lastProgressUpdate >= 500000) {
                    lastProgressUpdate = processedCount;
                    const uniqueTenants = new Set(Object.values(dailyMap).map(d => d.tenantId));
                    db.query(
                        `UPDATE mixpanel_refresh_jobs
                         SET events_processed = $1, tenants_found = $2
                         WHERE job_id = $3`,
                        [processedCount, uniqueTenants.size, jobId]
                    ).catch(() => {});
                }
            },
        });

        const snapshotAt = new Date();
        const records = Object.values(dailyMap);
        const uniqueTenants = new Set(records.map(r => r.tenantId));

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            await client.query(
                `DELETE FROM mixpanel_daily_exceedances WHERE project_id = $1 AND days = $2`,
                [projectId, days]
            );

            for (const rec of records) {
                const utilization = (rec.limitValue && rec.limitValue > 0)
                    ? Math.round((rec.maxValue / rec.limitValue) * 10000) / 100
                    : null;
                const exceeded = utilization !== null && utilization >= 100;

                await client.query(
                    `INSERT INTO mixpanel_daily_exceedances
                     (project_id, days, tenant_id, event_date, metric_type,
                      max_value, limit_value, utilization, exceeded, service_id, snapshot_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [
                        projectId, days, rec.tenantId, rec.eventDate, rec.metricType,
                        rec.maxValue, rec.limitValue, utilization, exceeded,
                        rec.serviceId, snapshotAt,
                    ]
                );
            }

            await client.query('COMMIT');
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }

        await db.query(
            `UPDATE mixpanel_refresh_jobs
             SET status = 'completed', events_processed = $1, tenants_found = $2, completed_at = CURRENT_TIMESTAMP
             WHERE job_id = $3`,
            [totalCount, uniqueTenants.size, jobId]
        );

        logger.info(`Daily exceedances refresh completed: ${totalCount} events, ${uniqueTenants.size} tenants, job ${jobId}`);

    } catch (err) {
        logger.error(`Daily exceedances refresh job ${jobId} failed:`, err.message);
        const uniqueTenants = new Set(Object.values(dailyMap).map(d => d.tenantId));
        await db.query(
            `UPDATE mixpanel_refresh_jobs
             SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP,
                 events_processed = $2, tenants_found = $3
             WHERE job_id = $4`,
            [err.message, processedCount, uniqueTenants.size, jobId]
        ).catch(() => {});
    }
}

// ═══════════════════════════════════════════════════════════════════
//  GET /refresh/status  — Poll job progress
// ═══════════════════════════════════════════════════════════════════
router.get('/refresh/status', asyncHandler(async (req, res) => {
    const { jobId } = req.query;

    if (!jobId) {
        return res.status(400).json({ success: false, message: 'jobId query parameter is required.' });
    }

    const result = await db.query(
        `SELECT job_id, project_id, days, status, events_processed, tenants_found,
                error_message, started_at, completed_at
         FROM mixpanel_refresh_jobs WHERE job_id = $1`,
        [jobId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const job = result.rows[0];
    const elapsedMs = job.completed_at
        ? new Date(job.completed_at) - new Date(job.started_at)
        : Date.now() - new Date(job.started_at);

    res.json({
        success: true,
        job: {
            jobId: job.job_id,
            status: job.status,
            eventsProcessed: job.events_processed,
            tenantsFound: job.tenants_found,
            errorMessage: job.error_message,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            elapsedSeconds: Math.round(elapsedMs / 1000),
        },
    });
}));

module.exports = router;
