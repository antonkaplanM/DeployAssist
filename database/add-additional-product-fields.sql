-- Add Additional Product Fields to Products Table
-- Adds Country, RI Platform, Model, Data API, Peril, and Data Type fields

-- ===== ADD NEW COLUMNS =====
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS country VARCHAR(255),                    -- Country__c
ADD COLUMN IF NOT EXISTS ri_platform_region VARCHAR(255),         -- RI_Platform_Region__c
ADD COLUMN IF NOT EXISTS ri_platform_sub_region VARCHAR(255),     -- RI_Platform_Sub_Region__c
ADD COLUMN IF NOT EXISTS model_type VARCHAR(255),                 -- Model_Type__c
ADD COLUMN IF NOT EXISTS model_subtype VARCHAR(255),              -- Model_Subtype__c
ADD COLUMN IF NOT EXISTS data_api_name VARCHAR(500),              -- Data_API_Name__c
ADD COLUMN IF NOT EXISTS peril VARCHAR(255),                      -- Peril__c
ADD COLUMN IF NOT EXISTS data_type VARCHAR(255);                  -- Data_Type__c

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_products_country ON products(country);
CREATE INDEX IF NOT EXISTS idx_products_ri_platform_region ON products(ri_platform_region);
CREATE INDEX IF NOT EXISTS idx_products_ri_platform_sub_region ON products(ri_platform_sub_region);
CREATE INDEX IF NOT EXISTS idx_products_model_type ON products(model_type);
CREATE INDEX IF NOT EXISTS idx_products_model_subtype ON products(model_subtype);
CREATE INDEX IF NOT EXISTS idx_products_peril ON products(peril);
CREATE INDEX IF NOT EXISTS idx_products_data_type ON products(data_type);

-- Log the migration
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_table_additional_fields_added', 
    'system', 
    NULL, 
    '{"columns": ["country", "ri_platform_region", "ri_platform_sub_region", "model_type", "model_subtype", "data_api_name", "peril", "data_type"], "version": "1.2.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Additional product fields added to products table';
    RAISE NOTICE '📦 New columns: country, ri_platform_region, ri_platform_sub_region, model_type, model_subtype, data_api_name, peril, data_type';
    RAISE NOTICE '🔍 Indexes created for optimal query performance';
END $$;

