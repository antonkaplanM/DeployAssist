/**
 * Fix Data API Name Column Length
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function fixColumn() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deployment_assistant',
        user: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD,
    });

    try {
        console.log('🔧 Fixing data_api_name column length...\n');
        
        const sql = fs.readFileSync('fix-data-api-name-length.sql', 'utf8');
        await pool.query(sql);
        
        console.log('✅ Column type expanded to TEXT\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

fixColumn();

