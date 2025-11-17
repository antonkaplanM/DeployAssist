require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

async function checkModelTypeMatchingResults() {
    const client = await pool.connect();
    
    try {
        console.log('\n📊 Bundle Constituents - Peril + Model Type Matching Results');
        console.log('=============================================================\n');
        
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
        
        // Compare with previous versions
        console.log('\n📈 Historical Comparison:');
        console.log('  Version 1.3.0 (Subregion only): 181 bundles with constituents (88%)');
        console.log('  Version 1.4.0 (+ Peril): 172 bundles with constituents (84%)');
        console.log(`  Version 1.5.0 (+ Model Type): ${bundles_with_constituents} bundles with constituents (${Math.round(bundles_with_constituents/total_bundles*100)}%)`);
        
        // Sample bundles with constituents
        console.log('\n📦 Sample Bundles WITH Constituents (first 5):');
        console.log('---------------------------------------------');
        
        const samplesWithQuery = `
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
            LIMIT 5
        `;
        
        const samplesWithResults = await client.query(samplesWithQuery);
        samplesWithResults.rows.forEach((row, idx) => {
            console.log(`\n${idx + 1}. ${row.product_code} - ${row.name}`);
            console.log(`   Peril: ${row.peril || 'NULL'}`);
            console.log(`   Model Type: ${row.model_type || 'NULL'}`);
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
                model_type,
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
                console.log(`   Model Type: ${row.model_type || 'NULL'}`);
                console.log(`   Subregions: ${row.ri_platform_sub_region}`);
                console.log(`   (No matching constituents with same Peril AND Model Type)`);
            });
        } else {
            console.log('\n   None found - all bundles have constituents!');
        }
        
        // Breakdown by Peril
        console.log('\n\n🔍 Breakdown by Peril:');
        console.log('---------------------');
        
        const perilQuery = `
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
        
        const perilResults = await client.query(perilQuery);
        perilResults.rows.forEach(row => {
            const pct = row.with_constituents > 0 ? Math.round(row.with_constituents/row.bundle_count*100) : 0;
            console.log(`  ${row.peril || 'NULL'}: ${row.bundle_count} bundles (${row.with_constituents} with [${pct}%], ${row.without_constituents} without)`);
        });
        
        // Breakdown by Model Type
        console.log('\n\n📊 Breakdown by Model Type:');
        console.log('---------------------------');
        
        const modelTypeQuery = `
            SELECT 
                model_type,
                COUNT(*) as bundle_count,
                COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents,
                COUNT(*) FILTER (WHERE constituents IS NULL) as without_constituents
            FROM products
            WHERE is_bundle = true AND is_active = true
            GROUP BY model_type
            ORDER BY bundle_count DESC
        `;
        
        const modelTypeResults = await client.query(modelTypeQuery);
        modelTypeResults.rows.forEach(row => {
            const pct = row.with_constituents > 0 ? Math.round(row.with_constituents/row.bundle_count*100) : 0;
            console.log(`  ${row.model_type || 'NULL'}: ${row.bundle_count} bundles (${row.with_constituents} with [${pct}%], ${row.without_constituents} without)`);
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

checkModelTypeMatchingResults();


