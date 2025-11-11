/**
 * Check if bundle columns exist in products table
 * Quick diagnostic to troubleshoot 500 errors
 */

const db = require('../../database.js');

async function checkBundleColumns() {
    try {
        console.log('🔍 Checking if bundle columns exist...\n');
        
        // Check if columns exist
        const columnCheck = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('is_bundle', 'constituents')
            ORDER BY column_name
        `);
        
        console.log('Columns found:', columnCheck.rows.length);
        columnCheck.rows.forEach(col => {
            console.log(`  ✓ ${col.column_name} (${col.data_type})`);
        });
        
        if (columnCheck.rows.length === 0) {
            console.log('\n❌ ERROR: Bundle columns do NOT exist!');
            console.log('\n🔧 SOLUTION: Run the migration:');
            console.log('   node scripts/database/run-bundle-constituents-migration.js\n');
            return false;
        } else if (columnCheck.rows.length === 2) {
            console.log('\n✅ Bundle columns exist!');
            
            // Check if data is populated
            const dataCheck = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_bundle = true) as bundles,
                    COUNT(*) FILTER (WHERE constituents IS NOT NULL) as with_constituents
                FROM products
                WHERE is_active = true
            `);
            
            const stats = dataCheck.rows[0];
            console.log('\nData population:');
            console.log(`  Total active products: ${stats.total}`);
            console.log(`  Bundle products: ${stats.bundles}`);
            console.log(`  With constituents: ${stats.with_constituents}`);
            
            if (stats.bundles === '0') {
                console.log('\n⚠️  WARNING: Columns exist but no bundles identified!');
                console.log('   The migration may not have completed properly.');
                console.log('   Try running it again.\n');
            } else {
                console.log('\n✅ Everything looks good!\n');
            }
            
            return true;
        } else {
            console.log('\n⚠️  WARNING: Only one column exists. Run migration to complete setup.\n');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error checking columns:', error.message);
        
        if (error.message.includes('relation "products" does not exist')) {
            console.log('\n⚠️  Products table does not exist!');
        } else if (error.message.includes('password')) {
            console.log('\n⚠️  Database connection issue. Check your credentials in database.js');
        }
        
        return false;
    } finally {
        await db.pool.end();
    }
}

// Run the check
checkBundleColumns()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

