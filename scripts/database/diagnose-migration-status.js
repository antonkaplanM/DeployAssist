/**
 * Diagnose Migration Status
 * Checks what parts of the migration succeeded and what failed
 */

// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');

async function diagnoseMigration() {
    // Show connection info (without password)
    console.log('🔑 Database Connection Info:');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || 5432}`);
    console.log(`   Database: ${process.env.DB_NAME || 'deployassist'}`);
    console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
    console.log(`   Password: ${process.env.DB_PASSWORD ? '****** (loaded from .env)' : '(not set)'}`);
    console.log('');

    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployassist',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔍 Diagnosing Migration Status...\n');
        
        // Check 1: Do columns exist?
        console.log('1️⃣ Checking if columns exist...');
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('is_bundle', 'constituents')
            ORDER BY column_name
        `);
        
        if (columnsResult.rows.length === 0) {
            console.log('   ❌ NO columns exist - migration did not run\n');
            console.log('   🔧 Action: Run the migration SQL in your database tool\n');
            return { status: 'not_started', columns: false, data: false };
        } else {
            console.log(`   ✅ ${columnsResult.rows.length} columns exist:`);
            columnsResult.rows.forEach(col => {
                console.log(`      - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
            });
            console.log('');
        }
        
        // Check 2: Are there indexes?
        console.log('2️⃣ Checking indexes...');
        const indexResult = await pool.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'products' 
            AND indexname IN ('idx_products_is_bundle', 'idx_products_constituents')
            ORDER BY indexname
        `);
        
        console.log(`   ${indexResult.rows.length > 0 ? '✅' : '⚠️'} ${indexResult.rows.length} bundle indexes found`);
        if (indexResult.rows.length > 0) {
            indexResult.rows.forEach(idx => console.log(`      - ${idx.indexname}`));
        }
        console.log('');
        
        // Check 3: Is data populated?
        console.log('3️⃣ Checking data population...');
        const dataResult = await pool.query(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(*) FILTER (WHERE ri_platform_sub_region IS NOT NULL) as with_subregion,
                COUNT(*) FILTER (WHERE ri_platform_sub_region LIKE '%;%') as potential_bundles,
                COUNT(*) FILTER (WHERE is_bundle = true) as marked_as_bundles,
                COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents
            FROM products
            WHERE is_active = true
        `);
        
        const stats = dataResult.rows[0];
        console.log('   Statistics:');
        console.log(`      Total active products: ${stats.total_products}`);
        console.log(`      With RI Subregion: ${stats.with_subregion}`);
        console.log(`      Potential bundles (semicolon in subregion): ${stats.potential_bundles}`);
        console.log(`      Marked as bundles (is_bundle=true): ${stats.marked_as_bundles}`);
        console.log(`      With constituents populated: ${stats.with_constituents}`);
        console.log('');
        
        // Check 4: Sample data
        if (parseInt(stats.marked_as_bundles) > 0) {
            console.log('4️⃣ Sample bundle products:');
            const sampleResult = await pool.query(`
                SELECT 
                    product_code,
                    name,
                    ri_platform_sub_region,
                    constituents
                FROM products
                WHERE is_bundle = true
                ORDER BY product_code
                LIMIT 3
            `);
            
            sampleResult.rows.forEach((row, idx) => {
                console.log(`   ${idx + 1}. ${row.product_code}`);
                console.log(`      Name: ${row.name}`);
                console.log(`      Subregions: ${row.ri_platform_sub_region}`);
                console.log(`      Constituents: ${row.constituents || '(none)'}`);
                console.log('');
            });
        } else {
            console.log('4️⃣ No bundle products marked yet\n');
        }
        
        // Determine status
        const columnsExist = columnsResult.rows.length === 2;
        const dataPopulated = parseInt(stats.marked_as_bundles) > 0;
        
        let status, recommendation;
        
        if (!columnsExist) {
            status = 'columns_missing';
            recommendation = 'Run the full migration SQL';
        } else if (columnsExist && !dataPopulated) {
            status = 'columns_exist_no_data';
            recommendation = 'Run the data population part of migration (DO $$ block)';
        } else if (columnsExist && dataPopulated) {
            status = 'complete';
            recommendation = 'Migration is complete! Restart backend.';
        }
        
        console.log('📊 SUMMARY:');
        console.log(`   Status: ${status}`);
        console.log(`   Recommendation: ${recommendation}`);
        console.log('');
        
        return {
            status,
            columns: columnsExist,
            data: dataPopulated,
            stats
        };
        
    } catch (error) {
        console.error('❌ Error during diagnosis:', error.message);
        
        if (error.message.includes('relation "products" does not exist')) {
            console.log('\n⚠️  The products table does not exist!');
        } else if (error.message.includes('column') && error.message.includes('does not exist')) {
            console.log('\n⚠️  Some columns are missing. The migration may have partially failed.');
        }
        
        throw error;
    } finally {
        await pool.end();
    }
}

// Run diagnosis
diagnoseMigration()
    .then((result) => {
        if (result.status === 'complete') {
            console.log('✅ All good! The migration is complete.');
            process.exit(0);
        } else {
            console.log('⚠️  Migration incomplete. See recommendations above.');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Failed:', error.message);
        process.exit(1);
    });

