// Packages Database Setup Script
// Sets up the packages table to store Salesforce Package__c data
require('dotenv').config();
const db = require('./database');
const fs = require('fs').promises;
const path = require('path');

async function setupPackagesTable() {
    try {
        console.log('🔌 Connecting to PostgreSQL database...');
        const testResult = await db.testConnection();
        if (!testResult.success) {
            throw new Error(`Database connection failed: ${testResult.error}`);
        }
        console.log('✅ Connected to database\n');
        
        // Read and execute the SQL script
        const sqlPath = path.join(__dirname, 'database', 'init-scripts', '05-packages.sql');
        console.log(`📄 Reading SQL script: ${sqlPath}`);
        
        const sql = await fs.readFile(sqlPath, 'utf8');
        console.log('✅ SQL script loaded\n');
        
        console.log('🔨 Creating packages table and related objects...');
        await db.query(sql);
        console.log('✅ Packages table created successfully!\n');
        
        // Verify the table was created
        const result = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'packages'
            ORDER BY ordinal_position;
        `);
        
        console.log('📊 Packages table structure:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(40)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Check views
        const viewsResult = await db.query(`
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name LIKE '%packages%'
            ORDER BY table_name;
        `);
        
        if (viewsResult.rows.length > 0) {
            console.log('📋 Created views:');
            viewsResult.rows.forEach(view => {
                console.log(`  ✓ ${view.table_name}`);
            });
            console.log('');
        }
        
        console.log('✅ Packages table setup complete!');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run "node sync-packages.js" to sync packages from Salesforce');
        console.log('  2. Access packages via the API at /api/packages');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error setting up packages table:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await db.closePool();
    }
}

// Run the setup
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                      PACKAGES TABLE SETUP                                 ');
console.log('═══════════════════════════════════════════════════════════════════════════\n');

setupPackagesTable();

