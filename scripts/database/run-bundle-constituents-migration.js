/**
 * Run Bundle Constituents Migration
 * Adds constituents field to products and identifies bundles
 */

const fs = require('fs');
const path = require('path');
const db = require('../../database.js');

async function runMigration() {
    try {
        console.log('🚀 Running Bundle Constituents Migration...\n');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, '../../database/add-bundle-constituents.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 Migration file loaded');
        console.log('⏳ Executing migration (this may take a moment)...\n');
        
        // Execute the migration
        await db.query(sql);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        await db.pool.end();
    }
}

// Run the migration
runMigration()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

