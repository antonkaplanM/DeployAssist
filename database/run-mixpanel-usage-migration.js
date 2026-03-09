/**
 * Create mixpanel_usage_snapshots and mixpanel_refresh_jobs tables.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function run() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, 'add-mixpanel-usage-tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Creating mixpanel_usage_snapshots and mixpanel_refresh_jobs tables...');
        await client.query(sql);

        // Verify
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('mixpanel_usage_snapshots', 'mixpanel_refresh_jobs')
            ORDER BY table_name
        `);

        for (const row of tables.rows) {
            const count = await client.query(`SELECT COUNT(*) as cnt FROM ${row.table_name}`);
            console.log(`  ${row.table_name}: created (${count.rows[0].cnt} rows)`);
        }

        if (tables.rows.length === 2) {
            console.log('Migration completed successfully.');
        } else {
            console.error('WARNING: Expected 2 tables, found', tables.rows.length);
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
