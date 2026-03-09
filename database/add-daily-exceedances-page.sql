-- Add Daily Exceedances page to Experimental Pages section

\echo 'Adding Daily Exceedances page to Experimental Pages...'

INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental.daily-exceedances', 'Daily Exceedances', 'Shows which customers exceeded daily limits and on how many days within a given period', 
        (SELECT id FROM pages WHERE name = 'experimental'), '/experimental/daily-exceedances', 'chart-bar', 5, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name = 'experimental.daily-exceedances'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name = 'experimental.daily-exceedances'
ON CONFLICT (role_id, page_id) DO NOTHING;

\echo 'Daily Exceedances page added successfully!'
\echo 'Page: experimental.daily-exceedances'
\echo 'Route: /experimental/daily-exceedances'
\echo 'Permissions: admin, user'

SELECT 'Verification:' as status;
SELECT name, display_name, route FROM pages WHERE name = 'experimental.daily-exceedances';
