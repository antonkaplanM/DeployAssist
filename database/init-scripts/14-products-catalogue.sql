-- Products Catalogue Table
-- Stores product data synced from Salesforce Product2 object

-- ===== CREATE PRODUCTS TABLE =====
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    
    -- Salesforce fields
    salesforce_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    product_code VARCHAR(255),
    description TEXT,
    family VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    display_url TEXT,
    
    -- Extended product fields
    product_group VARCHAR(255),              -- Product_Group__c
    product_family_l2 VARCHAR(255),          -- Product_Family_L2__c
    product_reporting_group VARCHAR(255),    -- ProductReportingGroup__c
    product_variant VARCHAR(255),            -- Product_Variant__c
    product_versions TEXT,                   -- ProductVersions__c
    type_of_configuration TEXT,              -- TypeOfConfiguration__c
    is_expansion_pack BOOLEAN DEFAULT false, -- IsExpansionPack__c
    product_selection_grouping VARCHAR(255), -- Product_Selection_Grouping__c
    product_selection_restriction VARCHAR(255), -- Product_Selection_Restriction__c
    
    -- Salesforce metadata
    sf_created_date TIMESTAMP,
    sf_last_modified_date TIMESTAMP,
    sf_created_by_id VARCHAR(255),
    sf_last_modified_by_id VARCHAR(255),
    
    -- Local metadata
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_salesforce_id ON products(salesforce_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_family ON products(family);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON products(is_archived);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description_search ON products USING gin(to_tsvector('english', COALESCE(description, '')));

-- Create a view for active products only (commonly queried)
CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products
WHERE is_active = true AND is_archived = false
ORDER BY name;

-- ===== CREATE SYNC LOG TABLE =====
CREATE TABLE IF NOT EXISTS product_sync_log (
    id SERIAL PRIMARY KEY,
    sync_started_at TIMESTAMP NOT NULL,
    sync_completed_at TIMESTAMP,
    total_products INTEGER,
    products_added INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_unchanged INTEGER DEFAULT 0,
    status VARCHAR(50), -- 'in_progress', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log the creation
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_table_created', 
    'system', 
    NULL, 
    '{"table": "products", "version": "1.0.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Products catalogue table created successfully';
    RAISE NOTICE '📦 Table: products (with full-text search indexes)';
    RAISE NOTICE '📊 View: active_products (for quick filtering)';
    RAISE NOTICE '📝 Table: product_sync_log (for tracking sync operations)';
END $$;

