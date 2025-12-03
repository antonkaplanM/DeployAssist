-- =====================================================
-- Update Bundle Constituents with Peril Matching Logic
-- =====================================================
-- This script updates the constituents field for bundle products
-- to only include base products where BOTH conditions match:
-- 1. RI Subregion matches (existing logic)
-- 2. Peril attribute matches (NEW constraint)
-- =====================================================

\echo ''
\echo '🔄 Updating Bundle Constituents with Peril Matching Logic'
\echo '=========================================================='
\echo ''

-- ===== RESET CONSTITUENTS FOR ALL BUNDLES =====
UPDATE products
SET constituents = NULL
WHERE is_bundle = true;

\echo '✓ Reset all bundle constituents'
\echo ''

-- ===== REPOPULATE CONSTITUENTS WITH PERIL MATCHING =====
DO $$
DECLARE
    bundle_record RECORD;
    base_product_record RECORD;
    subregion_array TEXT[];
    subregion_value TEXT;
    constituents_list TEXT[] := '{}';
    constituents_text TEXT;
    bundle_count INTEGER := 0;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 Analyzing bundle products and finding constituents with Peril matching...';
    RAISE NOTICE '';
    
    -- Loop through all bundle products
    FOR bundle_record IN
        SELECT 
            id, 
            product_code, 
            name, 
            ri_platform_sub_region,
            peril
        FROM products
        WHERE is_active = true 
        AND is_bundle = true
        AND ri_platform_sub_region IS NOT NULL
        ORDER BY product_code
    LOOP
        bundle_count := bundle_count + 1;
        constituents_list := '{}';  -- Reset for each bundle
        
        -- Split the ri_platform_sub_region by comma
        subregion_array := string_to_array(bundle_record.ri_platform_sub_region, ',');
        
        -- For each subregion, find base products with matching subregion AND peril
        FOREACH subregion_value IN ARRAY subregion_array
        LOOP
            -- Trim whitespace
            subregion_value := TRIM(subregion_value);
            
            -- Find base products with this exact subregion AND matching peril
            FOR base_product_record IN
                SELECT DISTINCT product_code
                FROM products
                WHERE is_active = true
                AND ri_platform_sub_region = subregion_value
                AND product_code != bundle_record.product_code  -- Exclude self
                AND product_code IS NOT NULL
                -- NEW: Match Peril attribute (handle NULL as matching NULL)
                AND (
                    (peril = bundle_record.peril) OR 
                    (peril IS NULL AND bundle_record.peril IS NULL)
                )
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
        
        -- Update the bundle product with new constituents
        UPDATE products
        SET constituents = constituents_text
        WHERE id = bundle_record.id;
        
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Bundle constituent update complete (with Peril matching):';
    RAISE NOTICE '   Total bundles processed: %', bundle_count;
    RAISE NOTICE '   Bundles with constituents: %', updated_count;
    RAISE NOTICE '   Bundles without constituents: %', (bundle_count - updated_count);
END $$;

-- ===== VERIFY RESULTS =====
DO $$
DECLARE
    total_bundles INTEGER;
    bundles_with_constituents INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_bundles FROM products WHERE is_active = true AND is_bundle = true;
    SELECT COUNT(*) INTO bundles_with_constituents FROM products WHERE is_active = true AND is_bundle = true AND constituents IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Updated Statistics:';
    RAISE NOTICE '   Total bundle products: %', total_bundles;
    RAISE NOTICE '   Bundles with constituents: %', bundles_with_constituents;
    RAISE NOTICE '   Bundles without constituents: %', (total_bundles - bundles_with_constituents);
END $$;

-- ===== SHOW SAMPLE BUNDLES WITH PERIL INFO =====
DO $$
DECLARE
    sample_record RECORD;
    counter INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📦 Sample Bundle Products with Peril Matching (first 10):';
    RAISE NOTICE '';
    
    FOR sample_record IN
        SELECT 
            product_code,
            name,
            peril,
            ri_platform_sub_region,
            constituents
        FROM products
        WHERE is_bundle = true AND constituents IS NOT NULL
        ORDER BY product_code
        LIMIT 10
    LOOP
        counter := counter + 1;
        RAISE NOTICE '% - %: %', counter, sample_record.product_code, sample_record.name;
        RAISE NOTICE '   Peril: %', COALESCE(sample_record.peril, 'NULL');
        RAISE NOTICE '   Subregions: %', sample_record.ri_platform_sub_region;
        RAISE NOTICE '   Constituents: %', sample_record.constituents;
        RAISE NOTICE '';
    END LOOP;
END $$;

-- ===== SHOW BUNDLES THAT LOST CONSTITUENTS =====
DO $$
DECLARE
    sample_record RECORD;
    counter INTEGER := 0;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count 
    FROM products 
    WHERE is_bundle = true AND constituents IS NULL;
    
    IF total_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  Bundles Without Constituents (after Peril filtering): % total', total_count;
        RAISE NOTICE '';
        RAISE NOTICE 'Sample (first 10):';
        
        FOR sample_record IN
            SELECT 
                product_code,
                name,
                peril,
                ri_platform_sub_region
            FROM products
            WHERE is_bundle = true AND constituents IS NULL
            ORDER BY product_code
            LIMIT 10
        LOOP
            counter := counter + 1;
            RAISE NOTICE '% - %: %', counter, sample_record.product_code, sample_record.name;
            RAISE NOTICE '   Peril: %', COALESCE(sample_record.peril, 'NULL');
            RAISE NOTICE '   Subregions: %', sample_record.ri_platform_sub_region;
            RAISE NOTICE '   (No matching constituents with same Peril)';
            RAISE NOTICE '';
        END LOOP;
    END IF;
END $$;

-- Log the update
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_bundle_constituents_updated_with_peril', 
    'system', 
    NULL, 
    '{"update": "constituents", "logic": "peril_matching_added", "version": "1.4.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Bundle constituents updated successfully with Peril matching';
    RAISE NOTICE '🎯 New Logic: Constituents must match BOTH RI Subregion AND Peril';
    RAISE NOTICE '📊 Review the statistics above to see the impact';
END $$;

\echo ''
\echo '✅ Update Complete!'
\echo ''




