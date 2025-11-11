/**
 * Simple Migration Runner
 * Runs SQL migration directly without the db wrapper
 */

// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
    console.log('🔑 Database Connection Info:');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || 5432}`);
    console.log(`   Database: ${process.env.DB_NAME || 'deployassist'}`);
    console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
    console.log(`   Password: ${process.env.DB_PASSWORD ? '****** (loaded)' : '(not set)'}`);
    console.log('');

    // Create a direct pool connection
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployassist',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🚀 Running Bundle Constituents Migration...\n');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, '../../database/add-bundle-constituents.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 Migration file loaded');
        console.log('⏳ Executing migration (this may take a moment)...\n');
        
        // Execute the migration
        const result = await pool.query(sql);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        
        if (error.message.includes('password')) {
            console.log('\n💡 Database connection issue detected.');
            console.log('Please check your environment variables:');
            console.log('  - DB_HOST');
            console.log('  - DB_NAME');
            console.log('  - DB_USER');
            console.log('  - DB_PASSWORD');
            console.log('\nOr run the SQL file manually in your database tool (pgAdmin, DBeaver, etc.)');
            console.log('File location: database/add-bundle-constituents.sql');
        } else if (error.message.includes('already exists')) {
            console.log('\n⚠️  Columns may already exist. This is OK if you already ran the migration.');
        }
        
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the migration
runMigration()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });

