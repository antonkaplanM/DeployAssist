-- Add Bundle Constituents Feature
-- Adds a 'constituents' field to products that are bundles
-- Bundles are identified as products with multiple RI Subregion values (semicolon-separated)

-- ===== ADD CONSTITUENTS COLUMN =====
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS constituents TEXT;  -- Comma-separated list of product codes

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_products_constituents ON products USING gin(to_tsvector('english', COALESCE(constituents, '')));

-- Add column to track if product is a bundle
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_bundle ON products(is_bundle);

-- ===== IDENTIFY BUNDLES AND POPULATE CONSTITUENTS =====
DO $$
DECLARE
    bundle_record RECORD;
    base_product_record RECORD;
    subregion_value TEXT;
    subregion_array TEXT[];
    constituents_list TEXT[];
    constituents_text TEXT;
    bundle_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Identifying bundle products and their constituents...';
    
    -- Step 1: Mark all products as base products by default
    UPDATE products SET is_bundle = false WHERE ri_platform_sub_region IS NOT NULL;
    
    -- Step 2: Identify and process bundle products
    -- Note: Using comma as separator (not semicolon) based on actual data
    FOR bundle_record IN 
        SELECT 
            id,
            product_code,
            name,
            ri_platform_sub_region
        FROM products
        WHERE is_active = true 
        AND ri_platform_sub_region IS NOT NULL
        AND ri_platform_sub_region LIKE '%,%'  -- Contains comma = multiple values
    LOOP
        bundle_count := bundle_count + 1;
        constituents_list := ARRAY[]::TEXT[];
        
        -- Split the ri_platform_sub_region by comma
        subregion_array := string_to_array(bundle_record.ri_platform_sub_region, ',');
        
        -- For each subregion, find base products with that single subregion
        FOREACH subregion_value IN ARRAY subregion_array
        LOOP
            -- Trim whitespace
            subregion_value := TRIM(subregion_value);
            
            -- Find base products with this exact subregion (no semicolon)
            FOR base_product_record IN
                SELECT DISTINCT product_code
                FROM products
                WHERE is_active = true
                AND ri_platform_sub_region = subregion_value
                AND product_code != bundle_record.product_code  -- Exclude self
                AND product_code IS NOT NULL
            LOOP
                -- Add to constituents list if not already present
                IF NOT (base_product_record.product_code = ANY(constituents_list)) THEN
                    constituents_list := array_append(constituents_list, base_product_record.product_code);
                END IF;
            END LOOP;
        END LOOP;
        
        -- Convert array to comma-separated string
        IF array_length(constituents_list, 1) > 0 THEN
            constituents_text := array_to_string(constituents_list, ', ');
            updated_count := updated_count + 1;
        ELSE
            constituents_text := NULL;
        END IF;
        
        -- Update the bundle product
        UPDATE products
        SET 
            is_bundle = true,
            constituents = constituents_text
        WHERE id = bundle_record.id;
        
    END LOOP;
    
    RAISE NOTICE '✅ Bundle analysis complete:';
    RAISE NOTICE '   Total bundles identified: %', bundle_count;
    RAISE NOTICE '   Bundles with constituents: %', updated_count;
    RAISE NOTICE '   Bundles without constituents: %', (bundle_count - updated_count);
END $$;

-- ===== VERIFY RESULTS =====
DO $$
DECLARE
    total_products INTEGER;
    base_products INTEGER;
    bundle_products INTEGER;
    bundles_with_constituents INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_products FROM products WHERE is_active = true AND ri_platform_sub_region IS NOT NULL;
    SELECT COUNT(*) INTO base_products FROM products WHERE is_active = true AND is_bundle = false AND ri_platform_sub_region IS NOT NULL;
    SELECT COUNT(*) INTO bundle_products FROM products WHERE is_active = true AND is_bundle = true;
    SELECT COUNT(*) INTO bundles_with_constituents FROM products WHERE is_active = true AND is_bundle = true AND constituents IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Final Statistics:';
    RAISE NOTICE '   Total active products with RI Subregion: %', total_products;
    RAISE NOTICE '   Base products: %', base_products;
    RAISE NOTICE '   Bundle products: %', bundle_products;
    RAISE NOTICE '   Bundles with constituents: %', bundles_with_constituents;
END $$;

-- ===== SHOW SAMPLE BUNDLES =====
DO $$
DECLARE
    sample_record RECORD;
    counter INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📦 Sample Bundle Products (first 10):';
    RAISE NOTICE '';
    
    FOR sample_record IN
        SELECT 
            product_code,
            name,
            ri_platform_sub_region,
            constituents
        FROM products
        WHERE is_bundle = true AND constituents IS NOT NULL
        ORDER BY product_code
        LIMIT 10
    LOOP
        counter := counter + 1;
        RAISE NOTICE '% - %: %', counter, sample_record.product_code, sample_record.name;
        RAISE NOTICE '   Subregions: %', sample_record.ri_platform_sub_region;
        RAISE NOTICE '   Constituents: %', sample_record.constituents;
        RAISE NOTICE '';
    END LOOP;
END $$;

-- Log the migration
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_bundle_constituents_added', 
    'system', 
    NULL, 
    '{"columns": ["constituents", "is_bundle"], "version": "1.3.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Bundle constituents feature added successfully';
    RAISE NOTICE '📦 New columns: constituents (TEXT), is_bundle (BOOLEAN)';
    RAISE NOTICE '🔍 Indexes created for optimal query performance';
    RAISE NOTICE '🎯 Bundle identification complete - use is_bundle = true to filter';
END $$;

