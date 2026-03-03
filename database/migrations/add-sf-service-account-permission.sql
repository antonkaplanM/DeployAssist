-- Migration: Add salesforce.service_account permission
-- Allows admins to grant users access to the shared Salesforce service account
-- instead of requiring personal OAuth credentials.

INSERT INTO permissions (name, description, resource, action)
VALUES (
    'salesforce.service_account',
    'Use shared Salesforce service account instead of personal credentials',
    'salesforce',
    'service_account'
)
ON CONFLICT (name) DO NOTHING;

-- Auto-assign to admin role (admins get all permissions by default)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name = 'salesforce.service_account'
ON CONFLICT (role_id, permission_id) DO NOTHING;
