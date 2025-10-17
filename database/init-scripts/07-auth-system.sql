-- Authentication System Tables
-- Creates tables for user management, roles, and audit logging

-- ===== ROLES TABLE =====
-- Stores available roles in the system
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE, -- True for admin/user roles that can't be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for roles
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ===== USERS TABLE =====
-- Stores user credentials and profile information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP, -- Account lockout after too many failed attempts
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9._-]+$'),
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 100)
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- ===== USER_ROLES TABLE =====
-- Junction table for many-to-many relationship between users and roles
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_user_role UNIQUE(user_id, role_id)
);

-- Create indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ===== PERMISSIONS TABLE =====
-- Stores granular permissions for future extensibility
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL, -- e.g., 'users', 'roles', 'packages', 'expiration_monitor'
    action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete', 'manage'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_resource_action UNIQUE(resource, action)
);

-- Create index for permissions
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- ===== ROLE_PERMISSIONS TABLE =====
-- Junction table for many-to-many relationship between roles and permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

-- Create indexes for role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ===== AUDIT_LOG TABLE =====
-- Tracks role changes and important authentication events
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'role_assigned', 'role_removed', 'user_created', 'user_deleted'
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'user', 'role', 'user_role'
    entity_id INTEGER,
    old_value JSONB, -- Previous state (for role changes)
    new_value JSONB, -- New state (for role changes)
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45), -- Support IPv6
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_by ON auth_audit_log(performed_by);

-- ===== REFRESH_TOKENS TABLE =====
-- Stores refresh tokens for "remember me" functionality
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA256 hash of the token
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP
);

-- Create indexes for refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ===== SESSION_ACTIVITY TABLE =====
-- Tracks user session activity for inactivity timeout
CREATE TABLE IF NOT EXISTS session_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(255) NOT NULL, -- Hash of JWT jti (JWT ID)
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_session_token UNIQUE(session_token_hash)
);

-- Create indexes for session_activity
CREATE INDEX IF NOT EXISTS idx_session_activity_user_id ON session_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_token_hash ON session_activity(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_session_activity_last_activity ON session_activity(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_session_activity_expires_at ON session_activity(expires_at);

-- ===== FUNCTIONS AND TRIGGERS =====

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM session_activity WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP AND is_revoked = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ===== SEED DATA =====

-- Insert default system roles
INSERT INTO roles (name, description, is_system_role)
VALUES 
    ('admin', 'Administrator role with full access including user and role management', TRUE),
    ('user', 'Standard user role with access to all features except user and role management', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action)
VALUES 
    -- User management permissions
    ('users.create', 'Create new users', 'users', 'create'),
    ('users.read', 'View user information', 'users', 'read'),
    ('users.update', 'Update user information', 'users', 'update'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    ('users.manage', 'Full user management access', 'users', 'manage'),
    
    -- Role management permissions
    ('roles.create', 'Create new roles', 'roles', 'create'),
    ('roles.read', 'View roles', 'roles', 'read'),
    ('roles.update', 'Update roles', 'roles', 'update'),
    ('roles.delete', 'Delete roles', 'roles', 'delete'),
    ('roles.assign', 'Assign roles to users', 'roles', 'assign'),
    ('roles.manage', 'Full role management access', 'roles', 'manage'),
    
    -- Application features (for future use)
    ('expiration_monitor.read', 'View expiration monitor data', 'expiration_monitor', 'read'),
    ('expiration_monitor.write', 'Modify expiration monitor data', 'expiration_monitor', 'write'),
    ('packages.read', 'View package information', 'packages', 'read'),
    ('packages.write', 'Modify package information', 'packages', 'write'),
    ('ghost_accounts.read', 'View ghost accounts', 'ghost_accounts', 'read'),
    ('ghost_accounts.write', 'Modify ghost accounts', 'ghost_accounts', 'write'),
    ('salesforce.access', 'Access Salesforce integration', 'salesforce', 'access'),
    ('sml.access', 'Access SML integration', 'sml', 'access')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to user role (all except user and role management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user' 
    AND p.resource NOT IN ('users', 'roles')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Log schema initialization
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES ('schema_initialized', 'system', NULL, '{"version": "1.0.0", "tables_created": ["users", "roles", "user_roles", "permissions", "role_permissions", "auth_audit_log", "refresh_tokens", "session_activity"]}'::jsonb, CURRENT_TIMESTAMP);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Authentication system schema initialized successfully';
    RAISE NOTICE '📋 Created tables: users, roles, user_roles, permissions, role_permissions, auth_audit_log, refresh_tokens, session_activity';
    RAISE NOTICE '🔐 Default roles created: admin, user';
    RAISE NOTICE '⚠️  Remember to create the default admin user using the setup script';
END $$;

