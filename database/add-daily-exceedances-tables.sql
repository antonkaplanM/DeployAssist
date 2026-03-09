-- Daily Limit Exceedances tables
-- Tracks per-day, per-tenant quota exceedances from Mixpanel events

\echo 'Creating daily exceedances tables...'

-- Per-day per-tenant per-metric quota data (only quota events, not storage)
CREATE TABLE IF NOT EXISTS mixpanel_daily_exceedances (
    project_id      VARCHAR(100) NOT NULL,
    days            INTEGER NOT NULL,
    tenant_id       VARCHAR(100) NOT NULL,
    event_date      DATE NOT NULL,
    metric_type     VARCHAR(100) NOT NULL,
    max_value       DOUBLE PRECISION,
    limit_value     DOUBLE PRECISION,
    utilization     DOUBLE PRECISION,
    exceeded        BOOLEAN DEFAULT FALSE,
    service_id      VARCHAR(255),
    snapshot_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, days, tenant_id, event_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_exc_project_days
    ON mixpanel_daily_exceedances (project_id, days);
CREATE INDEX IF NOT EXISTS idx_daily_exc_exceeded
    ON mixpanel_daily_exceedances (project_id, days, exceeded)
    WHERE exceeded = TRUE;

-- Add job_type to existing refresh jobs table so both reports can share it
ALTER TABLE mixpanel_refresh_jobs
    ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) DEFAULT 'usage-limits';

\echo 'Daily exceedances tables created successfully!'
