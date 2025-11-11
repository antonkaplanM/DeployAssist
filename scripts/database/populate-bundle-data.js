/**
 * Populate Bundle Data
 * Runs just the data population part of the migration
 * (columns already exist, just need to identify bundles)
 */

require('dotenv').config();
const { Pool } = require('pg');

async function populateBundleData() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployassist',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🚀 Populating Bundle Data...\n');
        
        // Run the bundle identification logic
        const sql = `
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
    -- Note: Using comma as separator based on actual data
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
            
            -- Find base products with this exact subregion (no comma)
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

-- Verify results
SELECT 
    COUNT(*) FILTER (WHERE is_bundle = true) as bundles,
    COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents
FROM products
WHERE is_active = true;
        `;
        
        console.log('⏳ Running bundle identification logic...\n');
        
        const result = await pool.query(sql);
        
        console.log('\n✅ Data population complete!\n');
        
        // Show results
        if (result.length > 1 && result[result.length - 1].rows) {
            const stats = result[result.length - 1].rows[0];
            console.log('📊 Results:');
            console.log(`   Bundles identified: ${stats.bundles}`);
            console.log(`   Bundles with constituents: ${stats.with_constituents}`);
        }
        
        console.log('\n✅ Success! Restart your backend to activate the feature.\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

populateBundleData()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed:', error.message);
        process.exit(1);
    });

