-- Page Entitlements System
-- Creates tables for page-level access control

-- ===== PAGES TABLE =====
-- Stores all pages and sub-pages in the application
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier (e.g., 'dashboard', 'analytics.overview')
    display_name VARCHAR(100) NOT NULL, -- Display name for UI
    description TEXT,
    parent_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE, -- NULL for top-level pages
    route VARCHAR(255), -- URL route or identifier
    icon VARCHAR(100), -- Icon identifier for UI
    sort_order INTEGER DEFAULT 0, -- For ordering in navigation
    is_system_page BOOLEAN DEFAULT FALSE, -- True for core pages that can't be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for pages
CREATE INDEX IF NOT EXISTS idx_pages_name ON pages(name);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_sort_order ON pages(sort_order);

-- ===== ROLE_PAGES TABLE =====
-- Junction table for many-to-many relationship between roles and pages
CREATE TABLE IF NOT EXISTS role_pages (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_page UNIQUE(role_id, page_id)
);

-- Create indexes for role_pages
CREATE INDEX IF NOT EXISTS idx_role_pages_role_id ON role_pages(role_id);
CREATE INDEX IF NOT EXISTS idx_role_pages_page_id ON role_pages(page_id);

-- ===== TRIGGER FOR UPDATED_AT =====
DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===== SEED DATA - TOP LEVEL PAGES =====
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES 
    ('dashboard', 'Dashboard', 'Main dashboard with overview widgets', NULL, '/', 1, TRUE),
    ('analytics', 'Analytics', 'Analytics and reporting section', NULL, '/analytics', 2, TRUE),
    ('provisioning', 'Provisioning Monitor', 'Provisioning and monitoring tools', NULL, '/provisioning', 3, TRUE),
    ('customer_products', 'Customer Products', 'Customer products management', NULL, '/customer-products', 4, TRUE),
    ('roadmap', 'Roadmap', 'Feature roadmap and planning', NULL, '/roadmap', 5, TRUE),
    ('help', 'Help', 'Help and documentation', NULL, '/help', 6, TRUE),
    ('settings', 'Settings', 'Application settings', NULL, '/settings', 7, TRUE),
    ('user_management', 'User Management', 'User and role management', NULL, '/user-management', 8, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ===== SEED DATA - ANALYTICS SUB-PAGES =====
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES 
    ('analytics.overview', 'Analytics Overview', 'Overview of analytics data', 
        (SELECT id FROM pages WHERE name = 'analytics'), '/analytics/overview', 1, TRUE),
    ('analytics.account_history', 'Account History', 'Historical account data and trends', 
        (SELECT id FROM pages WHERE name = 'analytics'), '/analytics/account-history', 2, TRUE),
    ('analytics.package_changes', 'Package Changes', 'Package change history and analytics', 
        (SELECT id FROM pages WHERE name = 'analytics'), '/analytics/package-changes', 3, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ===== SEED DATA - PROVISIONING SUB-PAGES =====
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES 
    ('provisioning.monitor', 'Provisioning Monitor', 'Monitor provisioning status', 
        (SELECT id FROM pages WHERE name = 'provisioning'), '/provisioning/monitor', 1, TRUE),
    ('provisioning.expiration', 'Expiration Monitor', 'Monitor upcoming expirations', 
        (SELECT id FROM pages WHERE name = 'provisioning'), '/provisioning/expiration', 2, TRUE),
    ('provisioning.ghost_accounts', 'Ghost Accounts', 'Manage ghost accounts', 
        (SELECT id FROM pages WHERE name = 'provisioning'), '/provisioning/ghost-accounts', 3, TRUE),
    ('provisioning.audit_trail', 'Audit Trail', 'PS record history and status tracking', 
        (SELECT id FROM pages WHERE name = 'provisioning'), '/provisioning/audit-trail', 4, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ===== ASSIGN ALL PAGES TO ADMIN ROLE =====
-- Admins get access to all pages
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- ===== ASSIGN PAGES TO USER ROLE =====
-- Standard users get access to all pages except user management
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name != 'user_management'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- ===== HELPER FUNCTION: Get User's Accessible Pages =====
CREATE OR REPLACE FUNCTION get_user_pages(p_user_id INTEGER)
RETURNS TABLE (
    page_id INTEGER,
    page_name VARCHAR,
    display_name VARCHAR,
    description TEXT,
    parent_page_id INTEGER,
    route VARCHAR,
    icon VARCHAR,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        p.id,
        p.name,
        p.display_name,
        p.description,
        p.parent_page_id,
        p.route,
        p.icon,
        p.sort_order
    FROM pages p
    INNER JOIN role_pages rp ON p.id = rp.page_id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = p_user_id
    ORDER BY p.sort_order;
END;
$$ LANGUAGE plpgsql;

-- ===== HELPER FUNCTION: Check User Page Access =====
CREATE OR REPLACE FUNCTION check_user_page_access(p_user_id INTEGER, p_page_name VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM pages p
        INNER JOIN role_pages rp ON p.id = rp.page_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = p_user_id
            AND p.name = p_page_name
    );
END;
$$ LANGUAGE plpgsql;

-- Log schema initialization
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES ('page_entitlements_initialized', 'system', NULL, '{"version": "1.0.0", "tables_created": ["pages", "role_pages"], "functions_created": ["get_user_pages", "check_user_page_access"]}'::jsonb, CURRENT_TIMESTAMP);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Page entitlements system initialized successfully';
    RAISE NOTICE '📋 Created tables: pages, role_pages';
    RAISE NOTICE '📄 Seeded % pages', (SELECT COUNT(*) FROM pages);
    RAISE NOTICE '🔐 Page permissions configured for system roles';
END $$;

