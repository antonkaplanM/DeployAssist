/**
 * Mixpanel Usage Limits Routes
 *
 * DB-backed with async refresh:
 *   GET  /                 – reads aggregated data from mixpanel_usage_snapshots (instant)
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

// ── Credential resolution ────────────────────────────────────────
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

// ── Event type sets ──────────────────────────────────────────────
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

const STORAGE_EVENTS = [
    'StorageStatus',
    'Storage',
    'TotalDiskSpaceInMb',
    'UsedDiskSpaceInMb',
    'AvailableDiskSpaceInMb',
    'EDMDatabases',
    'TotalNumberOfRecycleBinItems',
];

const quotaSet = new Set(QUOTA_EVENTS);
const storageSet = new Set(STORAGE_EVENTS);

// ═══════════════════════════════════════════════════════════════════
//  GET /  — Read latest snapshot from DB (instant)
// ═══════════════════════════════════════════════════════════════════
router.get('/', asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 365);
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const projectId = creds.projectId;

    // Read aggregated rows from DB
    const snapResult = await db.query(
        `SELECT tenant_id, metric_type, metric_category, current_value,
                limit_value, utilization, status, service_id, source,
                sample_count, last_event_at, storage_details, snapshot_at
         FROM mixpanel_usage_snapshots
         WHERE project_id = $1 AND days = $2
         ORDER BY tenant_id, metric_type`,
        [projectId, days]
    );

    if (snapResult.rows.length === 0) {
        // Check for a running job
        const runningJob = await db.query(
            `SELECT job_id, status, events_processed, tenants_found, started_at
             FROM mixpanel_refresh_jobs
             WHERE project_id = $1 AND days = $2 AND status = 'running'
             ORDER BY started_at DESC LIMIT 1`,
            [projectId, days]
        );
        return res.json({
            success: true,
            tenants: [],
            summary: { totalTenants: 0, exceeded: 0, warning: 0, ok: 0 },
            dateRange: { days },
            totalEventsProcessed: 0,
            needsRefresh: true,
            activeJob: runningJob.rows[0] || null,
            timestamp: new Date().toISOString(),
        });
    }

    // Group rows by tenant
    const tenantMap = {};
    let snapshotAt = null;

    for (const row of snapResult.rows) {
        const tid = row.tenant_id;
        if (!tenantMap[tid]) {
            tenantMap[tid] = { tenantId: tid, quotaMetrics: [], storageMetrics: [], latestEvent: null };
        }
        if (!snapshotAt || row.snapshot_at > snapshotAt) snapshotAt = row.snapshot_at;

        const entry = {
            metricType: row.metric_type,
            currentValue: row.current_value,
            limit: row.limit_value,
            utilization: row.utilization,
            status: row.status,
            serviceId: row.service_id || '',
            source: row.source || '',
            lastSeen: row.last_event_at ? row.last_event_at.toISOString() : null,
        };

        if (row.metric_category === 'quota') {
            tenantMap[tid].quotaMetrics.push(entry);
        } else if (row.metric_category === 'storage') {
            if (row.storage_details) {
                entry.storageDetails = row.storage_details;
            }
            tenantMap[tid].storageMetrics.push(entry);
        }

        if (row.last_event_at && (!tenantMap[tid].latestEvent || row.last_event_at > tenantMap[tid].latestEvent)) {
            tenantMap[tid].latestEvent = row.last_event_at;
        }
    }

    // Build tenant array with computed fields
    const tenants = Object.values(tenantMap).map(t => {
        const maxQuotaUtil = t.quotaMetrics.reduce((mx, q) => Math.max(mx, q.utilization || 0), 0);
        const overallStatus = t.quotaMetrics.some(q => q.status === 'exceeded') ? 'exceeded'
            : t.quotaMetrics.some(q => q.status === 'warning') ? 'warning'
            : 'ok';

        return {
            tenantId: t.tenantId,
            accountName: null,
            overallStatus,
            maxQuotaUtilization: maxQuotaUtil,
            quotaMetrics: t.quotaMetrics,
            storageMetrics: t.storageMetrics,
            lastSeen: t.latestEvent ? t.latestEvent.toISOString() : null,
        };
    });

    // Bulk-resolve account names from sml_tenant_data
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
            logger.warn('Could not resolve account names from sml_tenant_data:', err.message);
        }
    }

    // Sort: exceeded first, then warning, then ok; within each group by maxQuotaUtilization desc
    const statusOrder = { exceeded: 0, warning: 1, ok: 2 };
    tenants.sort((a, b) => {
        const so = (statusOrder[a.overallStatus] || 9) - (statusOrder[b.overallStatus] || 9);
        if (so !== 0) return so;
        return b.maxQuotaUtilization - a.maxQuotaUtilization;
    });

    // Compute date range from snapshot metadata
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days);

    res.json({
        success: true,
        tenants,
        summary: {
            totalTenants: tenants.length,
            exceeded: tenants.filter(t => t.overallStatus === 'exceeded').length,
            warning: tenants.filter(t => t.overallStatus === 'warning').length,
            ok: tenants.filter(t => t.overallStatus === 'ok').length,
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
//  POST /refresh  — Start async Mixpanel export + aggregation
// ═══════════════════════════════════════════════════════════════════
router.post('/refresh', asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 7, 365);
    const creds = await resolveCredentials(req.user.id);

    if (!creds.username || !creds.secret) {
        return res.json({ success: false, message: 'Mixpanel credentials not configured.' });
    }

    const projectId = creds.projectId;

    // Guard: check if a refresh is already running for this project+days
    const existing = await db.query(
        `SELECT job_id, started_at, events_processed, tenants_found
         FROM mixpanel_refresh_jobs
         WHERE project_id = $1 AND days = $2 AND status = 'running'
         ORDER BY started_at DESC LIMIT 1`,
        [projectId, days]
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

    // Create job row
    const jobId = crypto.randomUUID();
    await db.query(
        `INSERT INTO mixpanel_refresh_jobs (job_id, project_id, days, status, requested_by, started_at)
         VALUES ($1, $2, $3, 'running', $4, CURRENT_TIMESTAMP)`,
        [jobId, projectId, days, req.user.id]
    );

    // Return 202 immediately
    res.status(202).json({
        success: true,
        message: 'Refresh started. Poll /refresh/status for progress.',
        jobId,
    });

    // Fire-and-forget: run the streaming aggregation in background
    runRefreshJob(jobId, projectId, days, creds).catch(err => {
        logger.error(`Refresh job ${jobId} unexpected error:`, err.message);
    });
}));

/**
 * Background refresh: streams events from Mixpanel, aggregates, writes to DB.
 */
async function runRefreshJob(jobId, projectId, days, creds) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    const toDate = today.toISOString().split('T')[0];
    const fromDate = start.toISOString().split('T')[0];

    const allTargetEvents = [...QUOTA_EVENTS, ...STORAGE_EVENTS];
    const eventFilter = JSON.stringify(allTargetEvents);

    const tenantMap = {};
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

                if (!tenantMap[tid]) {
                    tenantMap[tid] = {
                        tenantId: tid,
                        quotaMetrics: {},
                        storageMetrics: {},
                        latestTimestamp: 0,
                    };
                }

                const tenant = tenantMap[tid];
                const ts = evt.properties?.time || 0;
                if (ts > tenant.latestTimestamp) tenant.latestTimestamp = ts;

                const metricType = evt.event;
                const metricValue = evt.properties?.MetricValue;
                const limitValue = evt.properties?.limit;

                if (quotaSet.has(metricType)) {
                    if (!tenant.quotaMetrics[metricType]) {
                        tenant.quotaMetrics[metricType] = {
                            metricType,
                            currentValue: null,
                            limit: null,
                            serviceId: evt.properties?.ServiceId || '',
                            source: evt.properties?.source || '',
                            lastSeen: 0,
                            sampleCount: 0,
                        };
                    }
                    const m = tenant.quotaMetrics[metricType];
                    if (ts >= m.lastSeen) {
                        m.currentValue = metricValue;
                        m.lastSeen = ts;
                    }
                    if (limitValue !== undefined && limitValue !== null) {
                        m.limit = parseFloat(limitValue);
                    }
                    m.sampleCount++;
                }

                if (storageSet.has(metricType) || metricType === 'StorageStatus') {
                    if (metricType === 'StorageStatus') {
                        const props = evt.properties;
                        const existing = tenant.storageMetrics._storageStatus;
                        if (!existing || ts >= existing.lastSeen) {
                            tenant.storageMetrics._storageStatus = {
                                metricType: 'StorageStatus',
                                totalDiskMb: parseFloat(props.TotalDiskSpaceInMb) || null,
                                usedDiskMb: parseFloat(props.UsedDiskSpaceInMb) || null,
                                availableDiskMb: parseFloat(props.AvailableDiskSpaceInMb) || null,
                                storageMb: parseFloat(props.Storage) || null,
                                edmDatabases: parseFloat(props.EDMDatabases) || null,
                                rdmDatabases: parseFloat(props.RDMDatabases) || null,
                                totalDatabases: parseFloat(props.TotalDatabases) || null,
                                serviceId: props.ServiceId || '',
                                instanceName: props.InstanceName || '',
                                lastSeen: ts,
                            };
                        }
                    } else {
                        if (!tenant.storageMetrics[metricType]) {
                            tenant.storageMetrics[metricType] = {
                                metricType,
                                value: null,
                                serviceId: evt.properties?.ServiceId || '',
                                instanceName: evt.properties?.InstanceName || '',
                                lastSeen: 0,
                            };
                        }
                        const s = tenant.storageMetrics[metricType];
                        if (ts >= s.lastSeen) {
                            s.value = metricValue;
                            s.lastSeen = ts;
                        }
                    }
                }

                // Periodic progress updates (every 500k events)
                processedCount++;
                if (processedCount - lastProgressUpdate >= 500000) {
                    lastProgressUpdate = processedCount;
                    db.query(
                        `UPDATE mixpanel_refresh_jobs
                         SET events_processed = $1, tenants_found = $2
                         WHERE job_id = $3`,
                        [processedCount, Object.keys(tenantMap).length, jobId]
                    ).catch(() => {});
                }
            },
        });

        // Write aggregated data to DB in a transaction
        const snapshotAt = new Date();
        const tenantIds = Object.keys(tenantMap);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Clear old snapshot for this project+days
            await client.query(
                `DELETE FROM mixpanel_usage_snapshots WHERE project_id = $1 AND days = $2`,
                [projectId, days]
            );

            // Insert new snapshot rows
            for (const tid of tenantIds) {
                const tenant = tenantMap[tid];

                // Quota metrics
                for (const q of Object.values(tenant.quotaMetrics)) {
                    const utilization = (q.limit && q.limit > 0)
                        ? Math.round((q.currentValue / q.limit) * 10000) / 100
                        : null;
                    const status = utilization === null ? 'unknown'
                        : utilization >= 100 ? 'exceeded'
                        : utilization >= 80 ? 'warning'
                        : 'ok';

                    await client.query(
                        `INSERT INTO mixpanel_usage_snapshots
                         (project_id, days, tenant_id, metric_type, metric_category,
                          current_value, limit_value, utilization, status,
                          service_id, source, sample_count, last_event_at, snapshot_at)
                         VALUES ($1,$2,$3,$4,'quota',$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                        [
                            projectId, days, tid, q.metricType,
                            q.currentValue, q.limit, utilization, status,
                            q.serviceId, q.source, q.sampleCount,
                            q.lastSeen ? new Date(q.lastSeen * 1000) : null,
                            snapshotAt,
                        ]
                    );
                }

                // Storage metrics
                for (const [key, s] of Object.entries(tenant.storageMetrics)) {
                    let storageDetails = null;
                    let currentValue = null;
                    let utilization = null;
                    let status = 'unknown';
                    const metricType = key === '_storageStatus' ? 'StorageStatus' : s.metricType;

                    if (key === '_storageStatus') {
                        storageDetails = {
                            totalDiskMb: s.totalDiskMb,
                            usedDiskMb: s.usedDiskMb,
                            availableDiskMb: s.availableDiskMb,
                            storageMb: s.storageMb,
                            edmDatabases: s.edmDatabases,
                            rdmDatabases: s.rdmDatabases,
                            totalDatabases: s.totalDatabases,
                            instanceName: s.instanceName,
                        };
                        currentValue = s.usedDiskMb;
                        if (s.totalDiskMb && s.usedDiskMb) {
                            utilization = Math.round((s.usedDiskMb / s.totalDiskMb) * 10000) / 100;
                        }
                    } else {
                        currentValue = s.value;
                    }

                    await client.query(
                        `INSERT INTO mixpanel_usage_snapshots
                         (project_id, days, tenant_id, metric_type, metric_category,
                          current_value, limit_value, utilization, status,
                          service_id, sample_count, last_event_at, storage_details, snapshot_at)
                         VALUES ($1,$2,$3,$4,'storage',$5,NULL,$6,$7,$8,0,$9,$10,$11)`,
                        [
                            projectId, days, tid, metricType,
                            currentValue, utilization, status,
                            s.serviceId || '',
                            s.lastSeen ? new Date(s.lastSeen * 1000) : null,
                            storageDetails ? JSON.stringify(storageDetails) : null,
                            snapshotAt,
                        ]
                    );
                }
            }

            await client.query('COMMIT');
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }

        // Mark job completed
        await db.query(
            `UPDATE mixpanel_refresh_jobs
             SET status = 'completed', events_processed = $1, tenants_found = $2, completed_at = CURRENT_TIMESTAMP
             WHERE job_id = $3`,
            [totalCount, tenantIds.length, jobId]
        );

        logger.info(`Usage limits refresh completed: ${totalCount} events, ${tenantIds.length} tenants, job ${jobId}`);

    } catch (err) {
        logger.error(`Refresh job ${jobId} failed:`, err.message);
        await db.query(
            `UPDATE mixpanel_refresh_jobs
             SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP,
                 events_processed = $2, tenants_found = $3
             WHERE job_id = $4`,
            [err.message, processedCount, Object.keys(tenantMap).length, jobId]
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
