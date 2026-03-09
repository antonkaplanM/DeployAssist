-- Add Usage Limits page to Experimental Pages section
-- Monitors customer quota utilization from Mixpanel with SML entitlement cross-reference

\echo 'Adding Usage Limits page to Experimental Pages...'

-- Insert "Usage Limits" sub-page under Experimental Pages
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental.usage-limits', 'Usage Limits', 'Monitor customer quota utilization from Mixpanel with SML entitlement cross-reference', 
        (SELECT id FROM pages WHERE name = 'experimental'), '/experimental/usage-limits', 'chart-bar', 4, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Assign to admin role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name = 'experimental.usage-limits'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Assign to user role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name = 'experimental.usage-limits'
ON CONFLICT (role_id, page_id) DO NOTHING;

\echo 'Usage Limits page added successfully!'
\echo 'Page: experimental.usage-limits'
\echo 'Route: /experimental/usage-limits'
\echo 'Permissions: admin, user'

-- Verify the page was added
SELECT 'Verification:' as status;
SELECT name, display_name, route FROM pages WHERE name = 'experimental.usage-limits';
