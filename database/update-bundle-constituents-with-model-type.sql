-- =====================================================
-- Update Bundle Constituents with Model Type Matching
-- =====================================================
-- This script updates the constituents field for bundle products
-- to only include base products where ALL THREE conditions match:
-- 1. RI Subregion matches (existing logic)
-- 2. Peril attribute matches (added in v1.4.0)
-- 3. Model Type attribute matches (NEW constraint)
-- =====================================================

\echo ''
\echo '🔄 Updating Bundle Constituents with Model Type Matching Logic'
\echo '=============================================================='
\echo ''

-- ===== RESET CONSTITUENTS FOR ALL BUNDLES =====
UPDATE products
SET constituents = NULL
WHERE is_bundle = true;

\echo '✓ Reset all bundle constituents'
\echo ''

-- ===== REPOPULATE CONSTITUENTS WITH MODEL TYPE MATCHING =====
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
    RAISE NOTICE '🔍 Analyzing bundle products with Peril AND Model Type matching...';
    RAISE NOTICE '';
    
    -- Loop through all bundle products
    FOR bundle_record IN
        SELECT 
            id, 
            product_code, 
            name, 
            ri_platform_sub_region,
            peril,
            model_type
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
        
        -- For each subregion, find base products with matching subregion, peril, AND model type
        FOREACH subregion_value IN ARRAY subregion_array
        LOOP
            -- Trim whitespace
            subregion_value := TRIM(subregion_value);
            
            -- Find base products with this exact subregion, matching peril, AND matching model type
            FOR base_product_record IN
                SELECT DISTINCT product_code
                FROM products
                WHERE is_active = true
                AND ri_platform_sub_region = subregion_value
                AND product_code != bundle_record.product_code  -- Exclude self
                AND product_code IS NOT NULL
                -- Match Peril attribute (handle NULL as matching NULL)
                AND (
                    (peril = bundle_record.peril) OR 
                    (peril IS NULL AND bundle_record.peril IS NULL)
                )
                -- NEW: Match Model Type attribute (handle NULL as matching NULL)
                AND (
                    (model_type = bundle_record.model_type) OR 
                    (model_type IS NULL AND bundle_record.model_type IS NULL)
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
    RAISE NOTICE '✅ Bundle constituent update complete (with Peril + Model Type matching):';
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

-- ===== SHOW SAMPLE BUNDLES WITH PERIL + MODEL TYPE INFO =====
DO $$
DECLARE
    sample_record RECORD;
    counter INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📦 Sample Bundle Products with Peril + Model Type Matching (first 10):';
    RAISE NOTICE '';
    
    FOR sample_record IN
        SELECT 
            product_code,
            name,
            peril,
            model_type,
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
        RAISE NOTICE '   Model Type: %', COALESCE(sample_record.model_type, 'NULL');
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
        RAISE NOTICE '⚠️  Bundles Without Constituents (after Peril + Model Type filtering): % total', total_count;
        RAISE NOTICE '';
        RAISE NOTICE 'Sample (first 10):';
        
        FOR sample_record IN
            SELECT 
                product_code,
                name,
                peril,
                model_type,
                ri_platform_sub_region
            FROM products
            WHERE is_bundle = true AND constituents IS NULL
            ORDER BY product_code
            LIMIT 10
        LOOP
            counter := counter + 1;
            RAISE NOTICE '% - %: %', counter, sample_record.product_code, sample_record.name;
            RAISE NOTICE '   Peril: %', COALESCE(sample_record.peril, 'NULL');
            RAISE NOTICE '   Model Type: %', COALESCE(sample_record.model_type, 'NULL');
            RAISE NOTICE '   Subregions: %', sample_record.ri_platform_sub_region;
            RAISE NOTICE '   (No matching constituents with same Peril AND Model Type)';
            RAISE NOTICE '';
        END LOOP;
    END IF;
END $$;

-- ===== BREAKDOWN BY MODEL TYPE =====
DO $$
DECLARE
    model_type_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 Breakdown by Model Type:';
    RAISE NOTICE '-------------------------';
    
    FOR model_type_record IN
        SELECT 
            model_type,
            COUNT(*) as bundle_count,
            COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents,
            COUNT(*) FILTER (WHERE constituents IS NULL) as without_constituents
        FROM products
        WHERE is_bundle = true AND is_active = true
        GROUP BY model_type
        ORDER BY bundle_count DESC
    LOOP
        RAISE NOTICE '  %: % bundles (% with, % without constituents)',
            COALESCE(model_type_record.model_type, 'NULL'),
            model_type_record.bundle_count,
            model_type_record.with_constituents,
            model_type_record.without_constituents;
    END LOOP;
END $$;

-- Log the update
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_bundle_constituents_updated_with_model_type', 
    'system', 
    NULL, 
    '{"update": "constituents", "logic": "peril_and_model_type_matching_added", "version": "1.5.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Bundle constituents updated successfully with Peril + Model Type matching';
    RAISE NOTICE '🎯 New Logic: Constituents must match RI Subregion AND Peril AND Model Type';
    RAISE NOTICE '📊 Review the statistics above to see the impact';
END $$;

\echo ''
\echo '✅ Update Complete!'
\echo ''




