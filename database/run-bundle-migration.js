/**
 * Run Bundle Migration Script
 * Executes the add-bundles-feature.sql migration
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from .env
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'deployassist_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Running bundle feature migration...');
        console.log(`📊 Database: ${process.env.DB_NAME || 'deployassist_dev'}`);
        console.log(`🔌 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
        console.log('');
        
        // Read SQL file
        const sqlFilePath = path.join(__dirname, 'add-bundles-feature.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('📄 Executing SQL migration...');
        
        // Execute the SQL
        await client.query(sql);
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('Created:');
        console.log('  - product_bundles table');
        console.log('  - bundle_products table');
        console.log('  - bundle_id_seq sequence');
        console.log('  - Updated experimental.product-catalogue page → Catalogue');
        console.log('');
        console.log('🎉 Bundle feature is ready to use!');
        
    } catch (error) {
        console.error('❌ Migration failed:');
        console.error(error.message);
        if (error.detail) {
            console.error('Detail:', error.detail);
        }
        if (error.hint) {
            console.error('Hint:', error.hint);
        }
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
runMigration();









