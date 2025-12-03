require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

async function updateBundleConstituentsWithPeril() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating Bundle Constituents with Peril Matching Logic');
        console.log('==========================================================\n');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, '../../database/update-bundle-constituents-with-peril.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Remove \echo commands as they're psql-specific
        const cleanSql = sql
            .split('\n')
            .filter(line => !line.trim().startsWith('\\echo'))
            .join('\n');
        
        // Execute the SQL
        console.log('Executing SQL migration...\n');
        await client.query(cleanSql);
        
        console.log('\n✅ Migration completed successfully!');
        console.log('📊 Check the output above for detailed statistics\n');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
updateBundleConstituentsWithPeril();




