-- Expiration Monitor Database Schema
-- This schema supports tracking product entitlement expirations across PS records

-- Main expiration monitor cache table
CREATE TABLE IF NOT EXISTS expiration_monitor (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    ps_record_id VARCHAR(255) NOT NULL,
    ps_record_name VARCHAR(100) NOT NULL,
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(255),
    product_type VARCHAR(50) NOT NULL, -- 'Model', 'Data', 'App'
    end_date DATE NOT NULL,
    is_extended BOOLEAN DEFAULT FALSE,
    extending_ps_record_id VARCHAR(255),
    extending_ps_record_name VARCHAR(100),
    extending_end_date DATE,
    days_until_expiry INT,
    last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expiration_end_date ON expiration_monitor(end_date);
CREATE INDEX IF NOT EXISTS idx_expiration_account_id ON expiration_monitor(account_id);
CREATE INDEX IF NOT EXISTS idx_expiration_product_code ON expiration_monitor(product_code);
CREATE INDEX IF NOT EXISTS idx_expiration_is_extended ON expiration_monitor(is_extended);
CREATE INDEX IF NOT EXISTS idx_expiration_days_until_expiry ON expiration_monitor(days_until_expiry);
CREATE INDEX IF NOT EXISTS idx_expiration_ps_record ON expiration_monitor(ps_record_id);

-- Metadata table to track analysis runs
CREATE TABLE IF NOT EXISTS expiration_analysis_log (
    id SERIAL PRIMARY KEY,
    analysis_started TIMESTAMP,
    analysis_completed TIMESTAMP,
    records_analyzed INT,
    entitlements_processed INT,
    expirations_found INT,
    extensions_found INT,
    lookback_years INT DEFAULT 5,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for analysis log
CREATE INDEX IF NOT EXISTS idx_analysis_log_created ON expiration_analysis_log(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE expiration_monitor IS 'Cached expiration data for product entitlements from Professional Services requests';
COMMENT ON TABLE expiration_analysis_log IS 'Log of expiration analysis runs for monitoring and debugging';

COMMENT ON COLUMN expiration_monitor.is_extended IS 'TRUE if this expiring entitlement has an extension in another PS record for the same account';
COMMENT ON COLUMN expiration_monitor.days_until_expiry IS 'Calculated days from analysis date to end_date';
COMMENT ON COLUMN expiration_analysis_log.status IS 'Status of analysis run: running, completed, failed';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON expiration_monitor TO your_app_user;
-- GRANT SELECT, INSERT ON expiration_analysis_log TO your_app_user;

-- Insert initial log entry to indicate schema is set up
INSERT INTO expiration_analysis_log (
    analysis_started,
    analysis_completed,
    status,
    records_analyzed,
    entitlements_processed,
    expirations_found,
    extensions_found
) VALUES (
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'schema_initialized',
    0,
    0,
    0,
    0
);

COMMIT;

