-- ===================================================================
-- Current Accounts Table - Stores consolidated tenant account information
-- for the "Current Accounts" Analytics page
-- ===================================================================

CREATE TABLE IF NOT EXISTS current_accounts (
    id SERIAL PRIMARY KEY,
    
    -- Core Fields
    client VARCHAR(255) NOT NULL,                    -- Account name (same as Account__c on Provisioning Monitor)
    services VARCHAR(255),                           -- App name (one per row)
    account_type VARCHAR(50),                        -- 'POC' or 'Subscription' (calculated from term length)
    csm_owner VARCHAR(255),                          -- Same as CreatedBy.Name on Provisioning Monitor
    provisioning_status VARCHAR(100),                -- Same as Status__c on Provisioning Monitor
    completion_date TIMESTAMP,                       -- Same as CreatedDate on Provisioning Monitor
    size VARCHAR(255),                               -- Package name of the app
    region VARCHAR(100),                             -- From PS record payload "region" field
    tenant_name VARCHAR(255),                        -- Extracted from SML payload
    tenant_url VARCHAR(500),                         -- Derived: https://{tenant_name}.rms.com
    tenant_id VARCHAR(255),                          -- From SML integration
    salesforce_account_id VARCHAR(100),              -- Salesforce Account ID
    initial_tenant_admin VARCHAR(255),               -- From PS payload "adminUsername" field
    comments TEXT,                                   -- User-editable, preserved on sync
    
    -- Status tracking
    record_status VARCHAR(50) DEFAULT 'active',      -- 'active' or 'removed'
    
    -- Correlation keys
    ps_record_id VARCHAR(100),                       -- Salesforce PS Record ID for correlation
    ps_record_name VARCHAR(255),                     -- PS Record Name for reference
    
    -- App-specific dates (used for Type calculation)
    app_start_date DATE,
    app_end_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP,
    
    -- Unique constraint: one row per app per tenant
    CONSTRAINT current_accounts_tenant_services_unique UNIQUE(tenant_name, services)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_current_accounts_client ON current_accounts(client);
CREATE INDEX IF NOT EXISTS idx_current_accounts_tenant_name ON current_accounts(tenant_name);
CREATE INDEX IF NOT EXISTS idx_current_accounts_tenant_id ON current_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_current_accounts_status ON current_accounts(record_status);
CREATE INDEX IF NOT EXISTS idx_current_accounts_completion_date ON current_accounts(completion_date DESC);
CREATE INDEX IF NOT EXISTS idx_current_accounts_last_synced ON current_accounts(last_synced DESC);
CREATE INDEX IF NOT EXISTS idx_current_accounts_ps_record_id ON current_accounts(ps_record_id);

-- Add comments for documentation
COMMENT ON TABLE current_accounts IS 'Consolidated tenant account information for Current Accounts Analytics page. One row per Tenant+App combination.';
COMMENT ON COLUMN current_accounts.client IS 'Account name (same as Account__c field on Provisioning Monitor)';
COMMENT ON COLUMN current_accounts.services IS 'App name from entitlement payload. One app per row.';
COMMENT ON COLUMN current_accounts.account_type IS 'POC if term < 1 year, Subscription if >= 1 year';
COMMENT ON COLUMN current_accounts.csm_owner IS 'Created By name from Provisioning Monitor';
COMMENT ON COLUMN current_accounts.size IS 'Package name associated with the app';
COMMENT ON COLUMN current_accounts.region IS 'Extracted from PS record payload region field';
COMMENT ON COLUMN current_accounts.tenant_url IS 'Derived URL: https://{tenant_name}.rms.com';
COMMENT ON COLUMN current_accounts.initial_tenant_admin IS 'From PS payload adminUsername field';
COMMENT ON COLUMN current_accounts.comments IS 'User-editable field preserved on sync';
COMMENT ON COLUMN current_accounts.record_status IS 'active or removed - removed records are kept for audit';

-- ===================================================================
-- Sync Log Table - Track sync operations
-- ===================================================================

CREATE TABLE IF NOT EXISTS current_accounts_sync_log (
    id SERIAL PRIMARY KEY,
    sync_started TIMESTAMP NOT NULL,
    sync_completed TIMESTAMP,
    tenants_processed INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_marked_removed INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress',        -- 'in_progress', 'completed', 'failed'
    error_message TEXT,
    initiated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_current_accounts_sync_log_created ON current_accounts_sync_log(created_at DESC);

COMMENT ON TABLE current_accounts_sync_log IS 'Logs sync operations for Current Accounts table';

-- ===================================================================
-- Add page entitlement for Current Accounts page
-- ===================================================================

-- Add the Current Accounts page under Analytics
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES 
    ('analytics.current_accounts', 'Current Accounts', 'View all active tenant accounts', 
        (SELECT id FROM pages WHERE name = 'analytics'), '/analytics/current-accounts', 4, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name = 'analytics.current_accounts'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name = 'analytics.current_accounts'
ON CONFLICT (role_id, page_id) DO NOTHING;

COMMIT;

