-- Mixpanel Usage Limits: DB-backed snapshots + async refresh jobs
-- Stores aggregated per-tenant, per-metric data (~2,300 rows per time window)

CREATE TABLE IF NOT EXISTS mixpanel_usage_snapshots (
    id              SERIAL PRIMARY KEY,
    project_id      VARCHAR(100) NOT NULL,
    days            INTEGER NOT NULL,
    tenant_id       VARCHAR(100) NOT NULL,
    metric_type     VARCHAR(100) NOT NULL,
    metric_category VARCHAR(20) NOT NULL,  -- 'quota' or 'storage'
    current_value   DOUBLE PRECISION,
    limit_value     DOUBLE PRECISION,
    utilization     DOUBLE PRECISION,
    status          VARCHAR(20),           -- 'ok', 'warning', 'exceeded', 'unknown'
    service_id      VARCHAR(255),
    source          VARCHAR(255),
    sample_count    INTEGER DEFAULT 0,
    last_event_at   TIMESTAMP,
    storage_details JSONB,                 -- StorageStatus sub-fields (nullable)
    snapshot_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, days, tenant_id, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_project_days
    ON mixpanel_usage_snapshots (project_id, days);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_tenant
    ON mixpanel_usage_snapshots (tenant_id);

COMMENT ON TABLE mixpanel_usage_snapshots IS 'Aggregated Mixpanel quota/storage metrics per tenant, refreshed async from the Raw Export API.';

-- Tracks async refresh job status
CREATE TABLE IF NOT EXISTS mixpanel_refresh_jobs (
    id                SERIAL PRIMARY KEY,
    job_id            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    project_id        VARCHAR(100) NOT NULL,
    days              INTEGER NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'running',
    events_processed  INTEGER DEFAULT 0,
    tenants_found     INTEGER DEFAULT 0,
    error_message     TEXT,
    started_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at      TIMESTAMP,
    requested_by      INTEGER,
    CONSTRAINT valid_job_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_jobs_project_days_status
    ON mixpanel_refresh_jobs (project_id, days, status);

COMMENT ON TABLE mixpanel_refresh_jobs IS 'Tracks async Mixpanel data refresh jobs for the Usage Limits monitor.';
