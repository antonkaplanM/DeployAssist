-- Verification script for Staging page migration
-- Run this to confirm the page was added correctly

\echo '🔍 Verifying Staging page setup...'
\echo ''

-- Check if the page exists
\echo '1. Checking page entry:'
SELECT 
    name, 
    display_name, 
    route, 
    parent_page_id,
    is_system_page
FROM pages 
WHERE name = 'experimental.staging';

\echo ''
\echo '2. Checking parent page (Experimental Pages):'
SELECT 
    p.name,
    p.display_name,
    p.route
FROM pages p
WHERE p.id = (SELECT parent_page_id FROM pages WHERE name = 'experimental.staging');

\echo ''
\echo '3. Checking role permissions:'
SELECT 
    r.name as role_name,
    p.name as page_name,
    p.display_name
FROM role_pages rp
JOIN roles r ON r.id = rp.role_id
JOIN pages p ON p.id = rp.page_id
WHERE p.name = 'experimental.staging'
ORDER BY r.name;

\echo ''
\echo '4. Checking all experimental pages:'
SELECT 
    name,
    display_name,
    route,
    sort_order
FROM pages
WHERE name LIKE 'experimental%'
ORDER BY sort_order;

\echo ''
\echo '✅ Verification complete!'
\echo 'If you see the staging page above with admin and user permissions, setup is successful!'







