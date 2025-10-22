-- Experimental Pages and Roadmap Feature
-- Adds experimental pages section with roadmap sub-page

-- ===== ADD EXPERIMENTAL PAGES =====

-- Insert parent "Experimental Pages" page
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental', 'Experimental Pages', 'Experimental features and pages', NULL, '/experimental', 'beaker', 9, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Insert "Roadmap" sub-page under Experimental Pages
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental.roadmap', 'Roadmap', 'Platform roadmap with Jira integration', 
        (SELECT id FROM pages WHERE name = 'experimental'), '/experimental/roadmap', 'map', 1, FALSE)
ON CONFLICT (name) DO NOTHING;

-- ===== ASSIGN PAGES TO ADMIN ROLE =====
-- Admins get access to all experimental pages
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND (p.name = 'experimental' OR p.name LIKE 'experimental.%')
ON CONFLICT (role_id, page_id) DO NOTHING;

-- ===== ASSIGN PAGES TO USER ROLE =====
-- Standard users also get access to experimental pages (can be restricted later)
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND (p.name = 'experimental' OR p.name LIKE 'experimental.%')
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Log the addition
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'experimental_pages_added', 
    'system', 
    NULL, 
    '{"pages_added": ["experimental", "experimental.roadmap"], "version": "1.0.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Experimental Pages feature initialized successfully';
    RAISE NOTICE '📋 Created pages: experimental, experimental.roadmap';
    RAISE NOTICE '🔐 Page permissions configured for admin and user roles';
END $$;

