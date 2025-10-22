-- Quick script to add Experimental Pages feature to existing database
-- Run this script if you already have the database initialized

\echo 'Adding Experimental Pages feature...'

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

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND (p.name = 'experimental' OR p.name LIKE 'experimental.%')
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND (p.name = 'experimental' OR p.name LIKE 'experimental.%')
ON CONFLICT (role_id, page_id) DO NOTHING;

\echo 'Experimental Pages feature added successfully!'
\echo 'Pages added: experimental, experimental.roadmap'
\echo 'Permissions configured for admin and user roles'

-- Verify the pages were added
SELECT 'Verification:' as status;
SELECT name, display_name, route FROM pages WHERE name LIKE 'experimental%';


