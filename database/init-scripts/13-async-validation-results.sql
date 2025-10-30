-- Async Validation Results Table
-- Stores validation results that require async processing (e.g., SML integration)

CREATE TABLE IF NOT EXISTS async_validation_results (
    id SERIAL PRIMARY KEY,
    
    -- PS Record identification
    ps_record_id VARCHAR(255) NOT NULL,
    ps_record_name VARCHAR(100),
    account_name VARCHAR(255),
    tenant_name VARCHAR(255),
    request_type VARCHAR(100),
    
    -- Validation rule identification
    rule_id VARCHAR(100) NOT NULL,
    rule_name VARCHAR(255),
    
    -- Validation result
    status VARCHAR(20) NOT NULL, -- 'PASS', 'FAIL', 'WARNING', 'PENDING', 'ERROR'
    message TEXT,
    details JSONB, -- Structured details about the validation result
    
    -- SML data (for deprovision validation)
    sml_entitlements JSONB, -- Active entitlements from SML
    active_entitlements_count INT DEFAULT 0,
    
    -- Processing metadata
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_duration_ms INT,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('PASS', 'FAIL', 'WARNING', 'PENDING', 'ERROR'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_async_validation_ps_record ON async_validation_results(ps_record_id);
CREATE INDEX IF NOT EXISTS idx_async_validation_rule ON async_validation_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_async_validation_status ON async_validation_results(status);
CREATE INDEX IF NOT EXISTS idx_async_validation_created ON async_validation_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_validation_updated ON async_validation_results(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_validation_tenant ON async_validation_results(tenant_name);
CREATE INDEX IF NOT EXISTS idx_async_validation_request_type ON async_validation_results(request_type);

-- Composite index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_async_validation_lookup ON async_validation_results(ps_record_id, rule_id, status);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_async_validation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_async_validation_updated_at
    BEFORE UPDATE ON async_validation_results
    FOR EACH ROW
    EXECUTE FUNCTION update_async_validation_updated_at();

-- Processing log table to track background worker runs
CREATE TABLE IF NOT EXISTS async_validation_processing_log (
    id SERIAL PRIMARY KEY,
    process_started TIMESTAMP NOT NULL,
    process_completed TIMESTAMP,
    records_queued INT DEFAULT 0,
    records_processed INT DEFAULT 0,
    records_succeeded INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    records_skipped INT DEFAULT 0,
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for processing log
CREATE INDEX IF NOT EXISTS idx_async_validation_log_created ON async_validation_processing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_validation_log_status ON async_validation_processing_log(status);

