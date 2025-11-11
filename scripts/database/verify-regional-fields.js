/**
 * Verify Regional Fields Update
 * Checks that the new fields were populated correctly
 */

require('dotenv').config();
const { Pool } = require('pg');

async function verify() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployment_assistant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD,
    });

    try {
        console.log('🔍 Verifying regional fields update...\n');
        
        // Check ALM-EQ-ARG specifically
        console.log('Checking ALM-EQ-ARG product:');
        const almResult = await pool.query(
            'SELECT product_code, name, continent, irp_bundle_region, irp_bundle_subregion FROM products WHERE product_code = $1',
            ['ALM-EQ-ARG']
        );
        
        if (almResult.rows.length > 0) {
            const product = almResult.rows[0];
            console.log(`  Product Code: ${product.product_code}`);
            console.log(`  Name: ${product.name}`);
            console.log(`  Continent: ${product.continent || 'NULL'}`);
            console.log(`  IRP Bundle Region: ${product.irp_bundle_region || 'NULL'}`);
            console.log(`  IRP Bundle Subregion: ${product.irp_bundle_subregion || 'NULL'}`);
        } else {
            console.log('  ❌ Product not found');
        }
        console.log('');
        
        // Check how many products have the new fields populated
        console.log('Statistics:');
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(continent) as with_continent,
                COUNT(irp_bundle_region) as with_irp_region,
                COUNT(irp_bundle_subregion) as with_irp_subregion
            FROM products
        `);
        
        const s = stats.rows[0];
        console.log(`  Total products: ${s.total_products}`);
        console.log(`  With Continent: ${s.with_continent} (${((s.with_continent / s.total_products) * 100).toFixed(1)}%)`);
        console.log(`  With IRP Bundle Region: ${s.with_irp_region} (${((s.with_irp_region / s.total_products) * 100).toFixed(1)}%)`);
        console.log(`  With IRP Bundle Subregion: ${s.with_irp_subregion} (${((s.with_irp_subregion / s.total_products) * 100).toFixed(1)}%)`);
        console.log('');
        
        // Show sample products with regional fields
        console.log('Sample products with regional fields:');
        const samples = await pool.query(`
            SELECT product_code, name, continent, irp_bundle_region, irp_bundle_subregion
            FROM products
            WHERE continent IS NOT NULL OR irp_bundle_region IS NOT NULL OR irp_bundle_subregion IS NOT NULL
            LIMIT 5
        `);
        
        if (samples.rows.length > 0) {
            samples.rows.forEach((p, idx) => {
                console.log(`  ${idx + 1}. ${p.product_code} - ${p.name}`);
                if (p.continent) console.log(`     Continent: ${p.continent}`);
                if (p.irp_bundle_region) console.log(`     IRP Region: ${p.irp_bundle_region}`);
                if (p.irp_bundle_subregion) console.log(`     IRP Subregion: ${p.irp_bundle_subregion}`);
            });
        } else {
            console.log('  ⚠️  No products found with regional/bundle fields populated');
            console.log('  This may be normal if Salesforce does not have these fields populated.');
        }
        
        console.log('');
        console.log('✅ Verification complete!');
        
        await pool.end();
        process.exit(0);
        
    } catch (err) {
        console.error('❌ Verification failed:', err.message);
        await pool.end();
        process.exit(1);
    }
}

verify();

