-- Add Product Catalogue page to Experimental Pages
-- Provides searchable catalogue of all Salesforce Product2 objects

-- Insert "Product Catalogue" sub-page under Experimental Pages
INSERT INTO pages (name, display_name, description, parent_page_id, route, icon, sort_order, is_system_page)
VALUES 
    ('experimental.product-catalogue', 'Product Catalogue', 'Browse all available products with their codes and descriptions', 
        (SELECT id FROM pages WHERE name = 'experimental'), '/experimental/product-catalogue', 'box', 2, FALSE)
ON CONFLICT (name) DO NOTHING;

-- ===== ASSIGN PAGE TO ADMIN ROLE =====
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'admin' 
    AND p.name = 'experimental.product-catalogue'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- ===== ASSIGN PAGE TO USER ROLE =====
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN pages p
WHERE r.name = 'user' 
    AND p.name = 'experimental.product-catalogue'
ON CONFLICT (role_id, page_id) DO NOTHING;

-- Log the addition
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'product_catalogue_page_added', 
    'page', 
    (SELECT id FROM pages WHERE name = 'experimental.product-catalogue'), 
    '{"page_name": "experimental.product-catalogue", "version": "1.0.0"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Product Catalogue page added successfully';
    RAISE NOTICE '📦 Page: experimental.product-catalogue';
    RAISE NOTICE '🔗 Route: /experimental/product-catalogue';
    RAISE NOTICE '🔐 Permissions: admin and user roles';
END $$;

