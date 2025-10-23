// Populate product update options from PS audit trail
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
});

async function populateOptions() {
    try {
        console.log('🔄 Populating product update options from PS audit trail...\n');
        
        // Check if PS audit trail has data
        const auditCount = await pool.query(`
            SELECT COUNT(*) as count 
            FROM ps_audit_trail 
            WHERE status = 'Tenant Request Completed'
            AND payload_data IS NOT NULL
        `);
        
        console.log(`📊 Found ${auditCount.rows[0].count} completed PS records in audit trail`);
        
        if (auditCount.rows[0].count === 0) {
            console.log('⚠️  No completed PS records found. Options will be limited to defaults.');
            console.log('💡 Run the PS audit capture to populate more data.');
        }
        
        // Run refresh function
        console.log('\n⏳ Extracting options from PS records...');
        const result = await pool.query('SELECT * FROM refresh_product_options()');
        
        if (result.rows && result.rows.length > 0) {
            const { packages_added, products_added } = result.rows[0];
            console.log('\n✅ Options refreshed successfully:');
            console.log(`   📦 Packages: ${packages_added} new`);
            console.log(`   🏷️  Products: ${products_added} new`);
        }
        
        // Get current counts
        const countResult = await pool.query(`
            SELECT 
                option_type,
                category,
                COUNT(*) as count
            FROM product_update_options
            WHERE is_active = true
            GROUP BY option_type, category
            ORDER BY option_type, category
        `);
        
        console.log('\n📊 Current option counts:');
        countResult.rows.forEach(row => {
            const categoryLabel = row.category ? ` (${row.category})` : ' (general)';
            console.log(`   ${row.option_type}${categoryLabel}: ${row.count}`);
        });
        
        // Total count
        const totalResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM product_update_options 
            WHERE is_active = true
        `);
        console.log(`\n   Total active options: ${totalResult.rows[0].count}`);
        
        console.log('\n🎉 Product options are ready!');
        
    } catch (error) {
        console.error('❌ Error populating options:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

populateOptions();

