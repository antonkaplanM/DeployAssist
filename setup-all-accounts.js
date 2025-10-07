/**
 * Setup script for all_accounts table
 * Creates the table for storing all Salesforce accounts
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');

async function setupAllAccountsTable() {
    console.log('🔧 Setting up all_accounts table...\n');

    try {
        // Read and execute the SQL script
        const sqlPath = path.join(__dirname, 'database', 'init-scripts', '04-all-accounts.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 Executing 04-all-accounts.sql...');
        await db.query(sql);
        console.log('✅ all_accounts table created successfully');

        // Check the table
        const checkResult = await db.query(`
            SELECT COUNT(*) as count FROM all_accounts
        `);
        console.log(`\n📊 Current accounts in database: ${checkResult.rows[0].count}`);

        console.log('\n✅ Setup complete!');
        
    } catch (error) {
        console.error('❌ Error during setup:', error.message);
        process.exit(1);
    } finally {
        await db.closePool();
        process.exit(0);
    }
}

// Run the setup
setupAllAccountsTable();

