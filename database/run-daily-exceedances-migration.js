/**
 * Create daily exceedances tables and add the page to the pages table.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Running daily exceedances migration...');

        await client.query('BEGIN');

        // Create daily exceedances table
        await client.query(`
            CREATE TABLE IF NOT EXISTS mixpanel_daily_exceedances (
                project_id      VARCHAR(100) NOT NULL,
                days            INTEGER NOT NULL,
                tenant_id       VARCHAR(100) NOT NULL,
                event_date      DATE NOT NULL,
                metric_type     VARCHAR(100) NOT NULL,
                max_value       DOUBLE PRECISION,
                limit_value     DOUBLE PRECISION,
                utilization     DOUBLE PRECISION,
                exceeded        BOOLEAN DEFAULT FALSE,
                service_id      VARCHAR(255),
                snapshot_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, days, tenant_id, event_date, metric_type)
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_exc_project_days
                ON mixpanel_daily_exceedances (project_id, days)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_exc_exceeded
                ON mixpanel_daily_exceedances (project_id, days, exceeded)
                WHERE exceeded = TRUE
        `);

        // Add job_type column to refresh jobs table
        await client.query(`
            ALTER TABLE mixpanel_refresh_jobs
                ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) DEFAULT 'usage-limits'
        `);

        // Insert page
        await client.query(`
            INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
            VALUES 
                ('experimental.daily-exceedances', 'Daily Exceedances', 
                 'Shows which customers exceeded daily limits and on how many days within a given period', 
                 (SELECT id FROM pages WHERE name = 'experimental'), 
                 '/experimental/daily-exceedances', 'chart-bar', 5, FALSE)
            ON CONFLICT (name) DO NOTHING
        `);

        // Assign to admin role
        await client.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r CROSS JOIN pages p
            WHERE r.name = 'admin' AND p.name = 'experimental.daily-exceedances'
            ON CONFLICT (role_id, page_id) DO NOTHING
        `);

        // Assign to user role
        await client.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r CROSS JOIN pages p
            WHERE r.name = 'user' AND p.name = 'experimental.daily-exceedances'
            ON CONFLICT (role_id, page_id) DO NOTHING
        `);

        await client.query('COMMIT');

        // Verify
        const verify = await client.query(
            `SELECT p.name, p.display_name, p.route, 
                    array_agg(r.name) as roles
             FROM pages p
             LEFT JOIN role_pages rp ON p.id = rp.page_id
             LEFT JOIN roles r ON rp.role_id = r.id
             WHERE p.name = 'experimental.daily-exceedances'
             GROUP BY p.name, p.display_name, p.route`
        );

        if (verify.rows.length > 0) {
            const row = verify.rows[0];
            console.log('Migration completed successfully:');
            console.log(`  Table: mixpanel_daily_exceedances (created)`);
            console.log(`  Page: ${row.name}`);
            console.log(`  Display: ${row.display_name}`);
            console.log(`  Route: ${row.route}`);
            console.log(`  Roles: ${row.roles.join(', ')}`);
        } else {
            console.log('WARNING: Page was not created (may already exist).');
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
