-- Custom Reports feature: database migration
-- Creates the custom_reports table and page entitlements

\echo 'Creating custom_reports table...'

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
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_slug ON custom_reports(slug);
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_active ON custom_reports(is_active);

\echo 'Custom reports table created.'

-- Add Custom Reports parent page
\echo 'Adding Custom Reports pages...'

INSERT INTO pages (name, display_name, description, route, icon, sort_order, is_system_page)
VALUES 
    ('custom_reports', 'Custom Reports', 'AI-driven custom report builder', '/custom-reports', 'document-chart-bar', 6, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Add sub-pages
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('custom_reports.create', 'Create Report', 'Create a new report via AI chat', 
        (SELECT id FROM pages WHERE name = 'custom_reports'), '/custom-reports/create', 'chat-bubble-left-right', 1, FALSE),
    ('custom_reports.view', 'View Reports', 'View saved custom reports', 
        (SELECT id FROM pages WHERE name = 'custom_reports'), '/custom-reports', 'rectangle-stack', 2, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name IN ('custom_reports', 'custom_reports.create', 'custom_reports.view')
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name IN ('custom_reports', 'custom_reports.create', 'custom_reports.view')
ON CONFLICT (role_id, page_id) DO NOTHING;

\echo 'Custom Reports pages added successfully!'
\echo 'Pages: custom_reports, custom_reports.create, custom_reports.view'
\echo 'Routes: /custom-reports, /custom-reports/create'
\echo 'Permissions: admin, user'

-- Verify
SELECT 'Verification:' as status;
SELECT name, display_name, route FROM pages WHERE name LIKE 'custom_reports%';
