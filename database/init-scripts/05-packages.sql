-- Packages Table
-- Stores package information synced from Salesforce Package__c object

CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    
    -- Salesforce identifiers
    sf_package_id VARCHAR(255) UNIQUE NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    ri_package_name VARCHAR(255),
    
    -- Package classification
    package_type VARCHAR(50),  -- Base, Expansion, etc.
    parent_package_id VARCHAR(255),  -- For expansion packs
    
    -- Capacity and limits
    locations BIGINT,
    max_concurrent_model INTEGER,
    max_concurrent_non_model INTEGER,
    max_concurrent_accumulation_jobs INTEGER,
    max_concurrent_non_accumulation_jobs INTEGER,
    max_jobs_day BIGINT,
    max_users INTEGER,
    number_edms INTEGER,
    
    -- Storage limits (in TB)
    max_exposure_storage_tb DECIMAL(10, 2),
    max_other_storage_tb DECIMAL(10, 2),
    
    -- Risk processing limits
    max_risks_accumulated_day BIGINT,
    max_risks_single_accumulation BIGINT,
    
    -- API limits
    api_rps INTEGER,  -- Requests per second
    
    -- Description
    description TEXT,
    
    -- Salesforce metadata
    sf_owner_id VARCHAR(255),
    sf_created_by_id VARCHAR(255),
    sf_last_modified_by_id VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    first_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional metadata
    metadata JSONB  -- Store any additional fields from Salesforce
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_packages_sf_id ON packages(sf_package_id);
CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(package_name);
CREATE INDEX IF NOT EXISTS idx_packages_ri_name ON packages(ri_package_name);
CREATE INDEX IF NOT EXISTS idx_packages_type ON packages(package_type);
CREATE INDEX IF NOT EXISTS idx_packages_parent ON packages(parent_package_id);
CREATE INDEX IF NOT EXISTS idx_packages_deleted ON packages(is_deleted);

-- Create view for active packages only
CREATE OR REPLACE VIEW active_packages AS
SELECT * FROM packages WHERE is_deleted = FALSE;

-- Create view for base packages
CREATE OR REPLACE VIEW base_packages AS
SELECT * FROM packages WHERE package_type = 'Base' AND is_deleted = FALSE;

-- Create view for expansion packages
CREATE OR REPLACE VIEW expansion_packages AS
SELECT * FROM packages WHERE package_type = 'Expansion' AND is_deleted = FALSE;

COMMENT ON TABLE packages IS 'Stores package configuration and limits synced from Salesforce Package__c object';
COMMENT ON COLUMN packages.sf_package_id IS 'Salesforce Package__c record ID';
COMMENT ON COLUMN packages.package_name IS 'Package name from Salesforce';
COMMENT ON COLUMN packages.ri_package_name IS 'Risk Intelligence package name/code (e.g., P1, P2, X1)';
COMMENT ON COLUMN packages.locations IS 'Maximum number of locations/risks that can be modeled';
COMMENT ON COLUMN packages.metadata IS 'Additional Salesforce fields stored as JSON';

