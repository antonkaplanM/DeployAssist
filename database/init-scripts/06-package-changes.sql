-- Package Name Change Analytics Database Schema
-- This schema supports tracking package name changes (upgrades/downgrades) across PS records

-- Main package change analysis cache table
CREATE TABLE IF NOT EXISTS package_change_analysis (
    id SERIAL PRIMARY KEY,
    analysis_date TIMESTAMP NOT NULL,
    ps_record_id VARCHAR(50) NOT NULL,
    ps_record_name VARCHAR(100) NOT NULL,
    previous_ps_record_id VARCHAR(50) NOT NULL,
    previous_ps_record_name VARCHAR(100) NOT NULL,
    deployment_number VARCHAR(100) NOT NULL,
    tenant_name VARCHAR(255),
    account_id VARCHAR(255),
    account_name VARCHAR(255) NOT NULL,
    account_site VARCHAR(255),
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(255),
    previous_package VARCHAR(100) NOT NULL,
    new_package VARCHAR(100) NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'upgrade' or 'downgrade'
    previous_start_date DATE,
    previous_end_date DATE,
    new_start_date DATE,
    new_end_date DATE,
    ps_created_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add tenant_name column if it doesn't exist (for existing installations)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'package_change_analysis' 
        AND column_name = 'tenant_name'
    ) THEN
        ALTER TABLE package_change_analysis ADD COLUMN tenant_name VARCHAR(255);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_package_change_analysis_date ON package_change_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_package_change_ps_record ON package_change_analysis(ps_record_id);
CREATE INDEX IF NOT EXISTS idx_package_change_deployment ON package_change_analysis(deployment_number);
CREATE INDEX IF NOT EXISTS idx_package_change_account ON package_change_analysis(account_name);
CREATE INDEX IF NOT EXISTS idx_package_change_product ON package_change_analysis(product_code);
CREATE INDEX IF NOT EXISTS idx_package_change_type ON package_change_analysis(change_type);
CREATE INDEX IF NOT EXISTS idx_package_change_created ON package_change_analysis(ps_created_date DESC);

-- Metadata table to track analysis runs
CREATE TABLE IF NOT EXISTS package_change_analysis_log (
    id SERIAL PRIMARY KEY,
    analysis_started TIMESTAMP NOT NULL,
    analysis_completed TIMESTAMP,
    records_analyzed INT DEFAULT 0,
    deployments_processed INT DEFAULT 0,
    changes_found INT DEFAULT 0,
    upgrades_found INT DEFAULT 0,
    downgrades_found INT DEFAULT 0,
    ps_records_with_changes INT DEFAULT 0,
    accounts_affected INT DEFAULT 0,
    lookback_years INT DEFAULT 2,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'schema_initialized'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for analysis log
CREATE INDEX IF NOT EXISTS idx_package_analysis_log_created ON package_change_analysis_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_analysis_log_status ON package_change_analysis_log(status);

-- Add comments for documentation
COMMENT ON TABLE package_change_analysis IS 'Cached package change data showing upgrades and downgrades from PS Update requests';
COMMENT ON TABLE package_change_analysis_log IS 'Log of package change analysis runs for monitoring and debugging';

COMMENT ON COLUMN package_change_analysis.change_type IS 'Type of package change: upgrade (P4->P5) or downgrade (P5->P4)';
COMMENT ON COLUMN package_change_analysis.deployment_number IS 'Deployment number linking consecutive PS records';
COMMENT ON COLUMN package_change_analysis.ps_record_id IS 'Current PS record ID showing the package change';
COMMENT ON COLUMN package_change_analysis.previous_ps_record_id IS 'Previous PS record ID for comparison';
COMMENT ON COLUMN package_change_analysis_log.status IS 'Status of analysis run: running, completed, failed, schema_initialized';
COMMENT ON COLUMN package_change_analysis_log.ps_records_with_changes IS 'Count of distinct PS records that had at least one package change';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON package_change_analysis TO your_app_user;
-- GRANT SELECT, INSERT ON package_change_analysis_log TO your_app_user;

-- Insert initial log entry to indicate schema is set up
INSERT INTO package_change_analysis_log (
    analysis_started,
    analysis_completed,
    status,
    records_analyzed,
    deployments_processed,
    changes_found,
    upgrades_found,
    downgrades_found,
    ps_records_with_changes,
    accounts_affected
) VALUES (
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'schema_initialized',
    0,
    0,
    0,
    0,
    0,
    0,
    0
);

COMMIT;

