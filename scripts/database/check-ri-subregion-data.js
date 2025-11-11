/**
 * Check RI Subregion Data
 * Examines the actual RI Subregion values to understand the data format
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkRISubregionData() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployassist',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔍 Examining RI Subregion Data...\n');
        
        // Check products with RI Subregion
        console.log('1️⃣ Sample products with RI Subregion:');
        const sampleResult = await pool.query(`
            SELECT 
                product_code,
                name,
                ri_platform_sub_region,
                LENGTH(ri_platform_sub_region) as length,
                CASE 
                    WHEN ri_platform_sub_region LIKE '%;%' THEN 'Has semicolon'
                    WHEN ri_platform_sub_region LIKE '%,%' THEN 'Has comma'
                    WHEN ri_platform_sub_region LIKE '%|%' THEN 'Has pipe'
                    ELSE 'Single value or other separator'
                END as separator_type
            FROM products
            WHERE is_active = true 
            AND ri_platform_sub_region IS NOT NULL
            ORDER BY LENGTH(ri_platform_sub_region) DESC
            LIMIT 20
        `);
        
        sampleResult.rows.forEach((row, idx) => {
            console.log(`\n   ${idx + 1}. ${row.product_code}`);
            console.log(`      Name: ${row.name}`);
            console.log(`      RI Subregion: "${row.ri_platform_sub_region}"`);
            console.log(`      Length: ${row.length} chars`);
            console.log(`      Type: ${row.separator_type}`);
        });
        
        // Check separator statistics
        console.log('\n\n2️⃣ Separator Analysis:');
        const separatorResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ri_platform_sub_region LIKE '%;%') as with_semicolon,
                COUNT(*) FILTER (WHERE ri_platform_sub_region LIKE '%,%') as with_comma,
                COUNT(*) FILTER (WHERE ri_platform_sub_region LIKE '%|%') as with_pipe,
                COUNT(*) FILTER (WHERE ri_platform_sub_region NOT LIKE '%;%' 
                                  AND ri_platform_sub_region NOT LIKE '%,%' 
                                  AND ri_platform_sub_region NOT LIKE '%|%') as single_or_other
            FROM products
            WHERE is_active = true 
            AND ri_platform_sub_region IS NOT NULL
        `);
        
        const stats = separatorResult.rows[0];
        console.log(`   Total with RI Subregion: ${stats.total}`);
        console.log(`   With semicolon (;): ${stats.with_semicolon}`);
        console.log(`   With comma (,): ${stats.with_comma}`);
        console.log(`   With pipe (|): ${stats.with_pipe}`);
        console.log(`   Single value or other: ${stats.single_or_other}`);
        
        // Check for longest values (likely bundles)
        console.log('\n\n3️⃣ Longest RI Subregion Values (likely bundles):');
        const longestResult = await pool.query(`
            SELECT 
                product_code,
                ri_platform_sub_region,
                LENGTH(ri_platform_sub_region) as length
            FROM products
            WHERE is_active = true 
            AND ri_platform_sub_region IS NOT NULL
            ORDER BY LENGTH(ri_platform_sub_region) DESC
            LIMIT 10
        `);
        
        longestResult.rows.forEach((row, idx) => {
            console.log(`   ${idx + 1}. ${row.product_code} (${row.length} chars)`);
            console.log(`      "${row.ri_platform_sub_region}"`);
        });
        
        console.log('\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

checkRISubregionData()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed:', error.message);
        process.exit(1);
    });

