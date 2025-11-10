-- ===================================================================
-- SML Tenant Data Table - Stores tenant information from SML
-- ===================================================================

CREATE TABLE IF NOT EXISTS sml_tenant_data (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) UNIQUE NOT NULL,     -- SML tenant ID (e.g., "6000009")
    tenant_name VARCHAR(255) NOT NULL,           -- SML tenant name (e.g., "mycompany-prod")
    account_name VARCHAR(255),                   -- Mapped account name from our DB
    tenant_display_name VARCHAR(500),            -- Display name from SML
    is_deleted BOOLEAN DEFAULT FALSE,            -- Deleted flag from SML
    raw_data JSONB,                              -- Full tenant data from SML
    product_entitlements JSONB,                  -- Product entitlements data (apps, models, data)
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sml_tenant_data_tenant_id ON sml_tenant_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sml_tenant_data_tenant_name ON sml_tenant_data(tenant_name);
CREATE INDEX IF NOT EXISTS idx_sml_tenant_data_account_name ON sml_tenant_data(account_name);
CREATE INDEX IF NOT EXISTS idx_sml_tenant_data_last_synced ON sml_tenant_data(last_synced DESC);

-- Add comments for documentation
COMMENT ON TABLE sml_tenant_data IS 'Stores tenant information synced from SML with account name mapping';
COMMENT ON COLUMN sml_tenant_data.tenant_id IS 'Unique tenant ID from SML';
COMMENT ON COLUMN sml_tenant_data.tenant_name IS 'Tenant name from SML (used for mapping to account name)';
COMMENT ON COLUMN sml_tenant_data.account_name IS 'Mapped account name from all_accounts or prof_services_requests tables';
COMMENT ON COLUMN sml_tenant_data.product_entitlements IS 'Product entitlements from SML (extensionData with apps, models, data)';
COMMENT ON COLUMN sml_tenant_data.last_synced IS 'When this tenant data was last synced from SML';

-- ===================================================================
-- SML Ghost Accounts Table - Stores ghost accounts found via SML
-- ===================================================================

CREATE TABLE IF NOT EXISTS sml_ghost_accounts (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,             -- SML tenant ID
    tenant_name VARCHAR(255) NOT NULL,           -- SML tenant name
    account_name VARCHAR(255),                   -- Mapped account name (may be null)
    total_expired_products INT NOT NULL,         -- Count of expired products
    latest_expiry_date DATE NOT NULL,            -- Most recent expiry date
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(255),
    notes TEXT,
    data_source VARCHAR(20) DEFAULT 'sml',       -- Always 'sml' for this table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sml_ghost_accounts_tenant_id ON sml_ghost_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sml_ghost_accounts_tenant_name ON sml_ghost_accounts(tenant_name);
CREATE INDEX IF NOT EXISTS idx_sml_ghost_accounts_is_reviewed ON sml_ghost_accounts(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_sml_ghost_accounts_latest_expiry ON sml_ghost_accounts(latest_expiry_date);
CREATE INDEX IF NOT EXISTS idx_sml_ghost_accounts_last_checked ON sml_ghost_accounts(last_checked DESC);

-- Add comments for documentation
COMMENT ON TABLE sml_ghost_accounts IS 'Tracks ghost accounts identified from SML data (tenants with all products expired)';
COMMENT ON COLUMN sml_ghost_accounts.tenant_id IS 'SML tenant ID';
COMMENT ON COLUMN sml_ghost_accounts.account_name IS 'Mapped account name (may be null if no mapping found)';
COMMENT ON COLUMN sml_ghost_accounts.data_source IS 'Source of data - always sml for this table';

-- Add data_source column to ghost_accounts table to distinguish sources
ALTER TABLE ghost_accounts ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'salesforce';
CREATE INDEX IF NOT EXISTS idx_ghost_accounts_data_source ON ghost_accounts(data_source);

COMMIT;

