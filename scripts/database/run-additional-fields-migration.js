/**
 * Run Database Migration for Additional Product Fields
 * Adds Country, RI Platform, Model Type, Data API, Peril, and Data Type fields
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    console.log('🚀 Starting database migration for additional product fields...\n');
    
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployment_assistant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD || 'secure_password_123',
    });

    try {
        // Read the migration SQL file
        const sqlPath = path.join(__dirname, 'database', 'add-additional-product-fields.sql');
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
            AND column_name IN ('country', 'ri_platform_region', 'ri_platform_sub_region', 
                               'model_type', 'model_subtype', 'data_api_name', 'peril', 'data_type')
            ORDER BY column_name
        `);
        
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📊 New columns added:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });
        
        console.log('\n💡 Next steps:');
        console.log('   1. Run: node sync-products-from-salesforce.js');
        console.log('   2. Or run: node force-update-additional-fields.js (faster, updates existing products only)');
        console.log('   3. The new fields will be populated in the database\n');
        
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

