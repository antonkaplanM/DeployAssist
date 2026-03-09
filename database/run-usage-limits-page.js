/**
 * Add Usage Limits page to the pages table and assign to roles.
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
        console.log('Adding Usage Limits page to Experimental Pages...');

        await client.query('BEGIN');

        // Insert page
        await client.query(`
            INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
            VALUES 
                ('experimental.usage-limits', 'Usage Limits', 
                 'Monitor customer quota utilization from Mixpanel with SML entitlement cross-reference', 
                 (SELECT id FROM pages WHERE name = 'experimental'), 
                 '/experimental/usage-limits', 'chart-bar', 4, FALSE)
            ON CONFLICT (name) DO NOTHING
        `);

        // Assign to admin role
        await client.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r CROSS JOIN pages p
            WHERE r.name = 'admin' AND p.name = 'experimental.usage-limits'
            ON CONFLICT (role_id, page_id) DO NOTHING
        `);

        // Assign to user role
        await client.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r CROSS JOIN pages p
            WHERE r.name = 'user' AND p.name = 'experimental.usage-limits'
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
             WHERE p.name = 'experimental.usage-limits'
             GROUP BY p.name, p.display_name, p.route`
        );

        if (verify.rows.length > 0) {
            const row = verify.rows[0];
            console.log('Page added successfully:');
            console.log(`  Name: ${row.name}`);
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
