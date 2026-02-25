/**
 * Run Custom Reports database migration
 * Usage: node scripts/database/run-custom-reports-migration.js
 */

require('dotenv').config();
const db = require('../../database');

async function runMigration() {
    console.log('Starting Custom Reports migration...\n');

    try {
        // 1. Create custom_reports table
        console.log('1. Creating custom_reports table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS custom_reports (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                report_config JSONB NOT NULL,
                data_sources JSONB,
                conversation_history JSONB,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                version INTEGER DEFAULT 1
            )
        `);
        console.log('   ✅ Table created');

        // 2. Create indexes
        console.log('2. Creating indexes...');
        await db.query(`CREATE INDEX IF NOT EXISTS idx_custom_reports_slug ON custom_reports(slug)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_custom_reports_is_active ON custom_reports(is_active)`);
        console.log('   ✅ Indexes created');

        // 3. Add parent page
        console.log('3. Adding Custom Reports parent page...');
        await db.query(`
            INSERT INTO pages (name, display_name, description, route, icon, sort_order, is_system_page)
            VALUES 
                ('custom_reports', 'Custom Reports', 'AI-driven custom report builder', '/custom-reports', 'document-chart-bar', 6, FALSE)
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('   ✅ Parent page added');

        // 4. Add sub-pages
        console.log('4. Adding sub-pages...');
        await db.query(`
            INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
            VALUES 
                ('custom_reports.create', 'Create Report', 'Create a new report via AI chat', 
                    (SELECT id FROM pages WHERE name = 'custom_reports'), '/custom-reports/create', 'chat-bubble-left-right', 1, FALSE)
            ON CONFLICT (name) DO NOTHING
        `);
        await db.query(`
            INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
            VALUES 
                ('custom_reports.view', 'View Reports', 'View saved custom reports', 
                    (SELECT id FROM pages WHERE name = 'custom_reports'), '/custom-reports', 'rectangle-stack', 2, FALSE)
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('   ✅ Sub-pages added');

        // 5. Assign to admin role
        console.log('5. Assigning to admin role...');
        await db.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN pages p
            WHERE r.name = 'admin' 
                AND p.name IN ('custom_reports', 'custom_reports.create', 'custom_reports.view')
            ON CONFLICT (role_id, page_id) DO NOTHING
        `);
        console.log('   ✅ Admin role assigned');

        // 6. Assign to user role
        console.log('6. Assigning to user role...');
        await db.query(`
            INSERT INTO role_pages (role_id, page_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN pages p
            WHERE r.name = 'user' 
                AND p.name IN ('custom_reports', 'custom_reports.create', 'custom_reports.view')
            ON CONFLICT (role_id, page_id) DO NOTHING
        `);
        console.log('   ✅ User role assigned');

        // 7. Verify
        console.log('\n7. Verification:');
        const pages = await db.query(`SELECT name, display_name, route FROM pages WHERE name LIKE 'custom_reports%'`);
        console.table(pages.rows);

        const tableCheck = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'custom_reports' 
            ORDER BY ordinal_position
        `);
        console.log('\ncustom_reports table columns:');
        console.table(tableCheck.rows);

        console.log('\n✅ Custom Reports migration completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

runMigration();
