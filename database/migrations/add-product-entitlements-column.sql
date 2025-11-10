-- ===================================================================
-- Migration: Add product_entitlements column to sml_tenant_data table
-- Date: 2025-01-10
-- Description: Separates product entitlement data from raw_data into its own column
-- ===================================================================

-- Add the new column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sml_tenant_data' 
        AND column_name = 'product_entitlements'
    ) THEN
        ALTER TABLE sml_tenant_data 
        ADD COLUMN product_entitlements JSONB;
        
        COMMENT ON COLUMN sml_tenant_data.product_entitlements IS 'Product entitlements from SML (extensionData with apps, models, data)';
        
        RAISE NOTICE 'Added product_entitlements column to sml_tenant_data';
    ELSE
        RAISE NOTICE 'Column product_entitlements already exists in sml_tenant_data';
    END IF;
END $$;

-- Migrate existing data: Extract extensionData from raw_data and move to product_entitlements
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    UPDATE sml_tenant_data
    SET product_entitlements = (raw_data->'extensionData')
    WHERE raw_data IS NOT NULL 
    AND raw_data ? 'extensionData'
    AND product_entitlements IS NULL;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Migrated extensionData to product_entitlements for % rows', row_count;
END $$;

COMMIT;

