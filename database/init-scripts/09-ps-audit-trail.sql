-- PS Record Audit Trail Database Schema
-- This schema supports tracking all PS record state changes over time

-- Main audit trail table to store snapshots of PS records
CREATE TABLE IF NOT EXISTS ps_audit_trail (
    id SERIAL PRIMARY KEY,
    ps_record_id VARCHAR(255) NOT NULL,  -- Salesforce Prof_Services_Request__c Id
    ps_record_name VARCHAR(100) NOT NULL,  -- PS-12345 format
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    account_site VARCHAR(255),
    status VARCHAR(100),  -- Status__c field - key field for tracking changes
    request_type VARCHAR(100),  -- TenantRequestAction__c
    deployment_id VARCHAR(255),
    deployment_name VARCHAR(100),
    tenant_name VARCHAR(255),
    billing_status VARCHAR(100),
    sml_error_message TEXT,
    payload_data TEXT,  -- JSON payload data
    created_date TIMESTAMP,  -- Original creation date in Salesforce
    created_by VARCHAR(255),
    last_modified_date TIMESTAMP,  -- Last modified date in Salesforce
    
    -- Audit metadata
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When we captured this snapshot
    change_type VARCHAR(50) DEFAULT 'snapshot',  -- 'initial', 'status_change', 'update', 'snapshot'
    previous_status VARCHAR(100),  -- Previous status if this is a status change
    
    -- Indexes for quick lookups
    CONSTRAINT idx_ps_audit_unique UNIQUE (ps_record_id, captured_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ps_audit_ps_record_id ON ps_audit_trail(ps_record_id);
CREATE INDEX IF NOT EXISTS idx_ps_audit_ps_record_name ON ps_audit_trail(ps_record_name);
CREATE INDEX IF NOT EXISTS idx_ps_audit_account_id ON ps_audit_trail(account_id);
CREATE INDEX IF NOT EXISTS idx_ps_audit_status ON ps_audit_trail(status);
CREATE INDEX IF NOT EXISTS idx_ps_audit_captured_at ON ps_audit_trail(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ps_audit_created_date ON ps_audit_trail(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_ps_audit_change_type ON ps_audit_trail(change_type);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_ps_audit_record_captured ON ps_audit_trail(ps_record_id, captured_at DESC);

-- Metadata table to track audit trail analysis runs
CREATE TABLE IF NOT EXISTS ps_audit_log (
    id SERIAL PRIMARY KEY,
    analysis_started TIMESTAMP,
    analysis_completed TIMESTAMP,
    records_processed INT,
    new_snapshots_created INT,
    changes_detected INT,
    status VARCHAR(50),  -- 'running', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_ps_audit_log_created ON ps_audit_log(created_at DESC);

-- View to get the latest snapshot for each PS record
CREATE OR REPLACE VIEW ps_audit_latest AS
SELECT DISTINCT ON (ps_record_id) 
    id,
    ps_record_id,
    ps_record_name,
    account_id,
    account_name,
    account_site,
    status,
    request_type,
    deployment_id,
    deployment_name,
    tenant_name,
    billing_status,
    sml_error_message,
    payload_data,
    created_date,
    created_by,
    last_modified_date,
    captured_at,
    change_type,
    previous_status
FROM ps_audit_trail
ORDER BY ps_record_id, captured_at DESC;

-- Function to get audit trail for a specific PS record
CREATE OR REPLACE FUNCTION get_ps_audit_trail(p_ps_record_identifier VARCHAR)
RETURNS TABLE (
    id INTEGER,
    ps_record_id VARCHAR,
    ps_record_name VARCHAR,
    account_id VARCHAR,
    account_name VARCHAR,
    account_site VARCHAR,
    status VARCHAR,
    request_type VARCHAR,
    deployment_id VARCHAR,
    deployment_name VARCHAR,
    tenant_name VARCHAR,
    billing_status VARCHAR,
    sml_error_message TEXT,
    payload_data TEXT,
    created_date TIMESTAMP,
    created_by VARCHAR,
    last_modified_date TIMESTAMP,
    captured_at TIMESTAMP,
    change_type VARCHAR,
    previous_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pat.id,
        pat.ps_record_id,
        pat.ps_record_name,
        pat.account_id,
        pat.account_name,
        pat.account_site,
        pat.status,
        pat.request_type,
        pat.deployment_id,
        pat.deployment_name,
        pat.tenant_name,
        pat.billing_status,
        pat.sml_error_message,
        pat.payload_data,
        pat.created_date,
        pat.created_by,
        pat.last_modified_date,
        pat.captured_at,
        pat.change_type,
        pat.previous_status
    FROM ps_audit_trail pat
    WHERE pat.ps_record_id = p_ps_record_identifier 
       OR pat.ps_record_name = p_ps_record_identifier
    ORDER BY pat.captured_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get status changes for a PS record
CREATE OR REPLACE FUNCTION get_ps_status_changes(p_ps_record_identifier VARCHAR)
RETURNS TABLE (
    status VARCHAR,
    previous_status VARCHAR,
    captured_at TIMESTAMP,
    change_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pat.status,
        pat.previous_status,
        pat.captured_at,
        pat.change_type
    FROM ps_audit_trail pat
    WHERE (pat.ps_record_id = p_ps_record_identifier 
       OR pat.ps_record_name = p_ps_record_identifier)
       AND (pat.change_type = 'status_change' OR pat.change_type = 'initial')
    ORDER BY pat.captured_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit trail statistics
CREATE OR REPLACE FUNCTION get_ps_audit_stats()
RETURNS TABLE (
    total_ps_records BIGINT,
    total_snapshots BIGINT,
    total_status_changes BIGINT,
    earliest_snapshot TIMESTAMP,
    latest_snapshot TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT ps_record_id),
        COUNT(*),
        COUNT(*) FILTER (WHERE change_type = 'status_change'),
        MIN(captured_at),
        MAX(captured_at)
    FROM ps_audit_trail;
END;
$$ LANGUAGE plpgsql;

-- Log schema initialization
INSERT INTO ps_audit_log (analysis_started, analysis_completed, records_processed, new_snapshots_created, changes_detected, status, created_at)
VALUES (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, 0, 'schema_initialized', CURRENT_TIMESTAMP);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ PS Audit Trail system initialized successfully';
    RAISE NOTICE '📋 Created table: ps_audit_trail';
    RAISE NOTICE '📊 Created view: ps_audit_latest';
    RAISE NOTICE '🔍 Created functions: get_ps_audit_trail, get_ps_status_changes, get_ps_audit_stats';
END $$;

