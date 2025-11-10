-- Add Regional and Bundle Fields to Products Table
-- Adds Continent__c, IRP_Bundle_Region__c, and IRP_Bundle_Subregion__c fields

-- ===== ADD NEW COLUMNS =====
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS continent VARCHAR(255),                    -- Continent__c
ADD COLUMN IF NOT EXISTS irp_bundle_region VARCHAR(255),            -- IRP_Bundle_Region__c
ADD COLUMN IF NOT EXISTS irp_bundle_subregion VARCHAR(255);         -- IRP_Bundle_Subregion__c

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_products_continent ON products(continent);
CREATE INDEX IF NOT EXISTS idx_products_irp_bundle_region ON products(irp_bundle_region);
CREATE INDEX IF NOT EXISTS idx_products_irp_bundle_subregion ON products(irp_bundle_subregion);

-- Log the migration
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_table_regional_fields_added', 
    'system', 
    NULL, 
    '{"columns": ["continent", "irp_bundle_region", "irp_bundle_subregion"], "version": "1.1.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Regional and bundle fields added to products table';
    RAISE NOTICE '📦 New columns: continent, irp_bundle_region, irp_bundle_subregion';
    RAISE NOTICE '🔍 Indexes created for optimal query performance';
END $$;

