/**
 * Run Database Migration for Regional and Bundle Fields
 * Adds Continent__c, IRP_Bundle_Region__c, and IRP_Bundle_Subregion__c to products table
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    console.log('🚀 Starting database migration for regional and bundle fields...\n');
    
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployment_assistant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD || 'secure_password_123',
    });

    try {
        // Read the migration SQL file
        const sqlPath = path.join(__dirname, 'database', 'add-regional-bundle-fields.sql');
        console.log(`📄 Reading migration file: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the migration
        console.log('⚙️  Executing migration...');
        await pool.query(sql);
        
        // Verify the columns were added
        console.log('\n🔍 Verifying columns were added...');
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('continent', 'irp_bundle_region', 'irp_bundle_subregion')
            ORDER BY column_name
        `);
        
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📊 New columns added:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });
        
        console.log('\n💡 Next steps:');
        console.log('   1. Run: node sync-products-from-salesforce.js');
        console.log('   2. This will re-sync products and populate the new fields\n');
        
        await pool.end();
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.error('Stack:', err.stack);
        await pool.end();
        process.exit(1);
    }
}

// Run the migration
runMigration();

