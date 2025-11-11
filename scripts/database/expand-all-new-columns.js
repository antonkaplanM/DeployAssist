/**
 * Expand All New Columns to TEXT
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function expandColumns() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployment_assistant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD,
    });

    try {
        console.log('🔧 Expanding all new columns to TEXT type...\n');
        
        const sql = fs.readFileSync('expand-all-new-columns.sql', 'utf8');
        await pool.query(sql);
        
        console.log('✅ All columns expanded to TEXT\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

expandColumns();

