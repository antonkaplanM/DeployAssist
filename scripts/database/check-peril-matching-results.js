require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

async function checkPerilMatchingResults() {
    const client = await pool.connect();
    
    try {
        console.log('\n📊 Bundle Constituents Update - Results with Peril Matching');
        console.log('===========================================================\n');
        
        // Get overall statistics
        const statsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE is_bundle = true) as total_bundles,
                COUNT(*) FILTER (WHERE is_bundle = true AND constituents IS NOT NULL) as bundles_with_constituents,
                COUNT(*) FILTER (WHERE is_bundle = true AND constituents IS NULL) as bundles_without_constituents
            FROM products
            WHERE is_active = true
        `;
        
        const stats = await client.query(statsQuery);
        const { total_bundles, bundles_with_constituents, bundles_without_constituents } = stats.rows[0];
        
        console.log('Overall Statistics:');
        console.log(`  Total Bundles: ${total_bundles}`);
        console.log(`  Bundles WITH Constituents: ${bundles_with_constituents} (${Math.round(bundles_with_constituents/total_bundles*100)}%)`);
        console.log(`  Bundles WITHOUT Constituents: ${bundles_without_constituents} (${Math.round(bundles_without_constituents/total_bundles*100)}%)`);
        
        // Sample bundles with constituents
        console.log('\n📦 Sample Bundles WITH Constituents (first 5):');
        console.log('---------------------------------------------');
        
        const samplesWithQuery = `
            SELECT 
                product_code,
                name,
                peril,
                ri_platform_sub_region,
                constituents
            FROM products
            WHERE is_bundle = true AND constituents IS NOT NULL
            ORDER BY product_code
            LIMIT 5
        `;
        
        const samplesWithResults = await client.query(samplesWithQuery);
        samplesWithResults.rows.forEach((row, idx) => {
            console.log(`\n${idx + 1}. ${row.product_code} - ${row.name}`);
            console.log(`   Peril: ${row.peril || 'NULL'}`);
            console.log(`   Subregions: ${row.ri_platform_sub_region}`);
            console.log(`   Constituents: ${row.constituents}`);
        });
        
        // Sample bundles without constituents
        console.log('\n\n⚠️  Sample Bundles WITHOUT Constituents (first 5):');
        console.log('------------------------------------------------');
        
        const samplesWithoutQuery = `
            SELECT 
                product_code,
                name,
                peril,
                ri_platform_sub_region
            FROM products
            WHERE is_bundle = true AND constituents IS NULL
            ORDER BY product_code
            LIMIT 5
        `;
        
        const samplesWithoutResults = await client.query(samplesWithoutQuery);
        
        if (samplesWithoutResults.rows.length > 0) {
            samplesWithoutResults.rows.forEach((row, idx) => {
                console.log(`\n${idx + 1}. ${row.product_code} - ${row.name}`);
                console.log(`   Peril: ${row.peril || 'NULL'}`);
                console.log(`   Subregions: ${row.ri_platform_sub_region}`);
                console.log(`   (No matching constituents with same Peril)`);
            });
        } else {
            console.log('\n   None found - all bundles have constituents!');
        }
        
        // Check if Peril matching made a difference
        console.log('\n\n🔍 Peril Matching Impact Analysis:');
        console.log('-----------------------------------');
        
        const impactQuery = `
            SELECT 
                peril,
                COUNT(*) as bundle_count,
                COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents,
                COUNT(*) FILTER (WHERE constituents IS NULL) as without_constituents
            FROM products
            WHERE is_bundle = true AND is_active = true
            GROUP BY peril
            ORDER BY bundle_count DESC
        `;
        
        const impactResults = await client.query(impactQuery);
        console.log('\nBreakdown by Peril:');
        impactResults.rows.forEach(row => {
            console.log(`  ${row.peril || 'NULL'}: ${row.bundle_count} bundles (${row.with_constituents} with, ${row.without_constituents} without constituents)`);
        });
        
        console.log('\n✅ Analysis complete!\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

checkPerilMatchingResults();




