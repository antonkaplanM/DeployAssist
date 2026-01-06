-- Add Staging page to Experimental Pages section
-- This is a PoC staging area for reviewing PS records before downstream processing

\echo 'Adding Staging page to Experimental Pages...'

-- Insert "Staging" sub-page under Experimental Pages
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental.staging', 'Staging', 'PoC staging area for PS record review before downstream processing', 
        (SELECT id FROM pages WHERE name = 'experimental'), '/experimental/staging', 'inbox-stack', 3, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name = 'experimental.staging'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role (accessible to all users for this PoC)
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name = 'experimental.staging'
ON CONFLICT (role_id, page_id) DO NOTHING;

\echo 'Staging page added successfully!'
\echo 'Page: experimental.staging'
\echo 'Route: /experimental/staging'
\echo 'Permissions: admin, user'

-- Verify the page was added
SELECT 'Verification:' as status;
SELECT name, display_name, route FROM pages WHERE name = 'experimental.staging';







