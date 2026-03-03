/**
 * Authentication Middleware (JavaScript)
 */

const salesforce = require('../salesforce');
const db = require('../database');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * Create authentication middleware
 */
function createAuthMiddleware(authService, pool) {
    return async function authenticate(req, res, next) {
        try {
            // Extract token from cookie or Authorization header
            let token;

            if (req.cookies && req.cookies.accessToken) {
                token = req.cookies.accessToken;
            } else if (req.headers.authorization) {
                const authHeader = req.headers.authorization;
                if (authHeader.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                }
            }

            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No authentication token provided',
                    code: 'AUTH_MISSING'
                });
            }

            // Verify token
            const payload = await authService.verifyAccessToken(token);

            // Get full user data
            const userResult = await pool.query(`
                SELECT 
                    u.id, u.username, u.full_name, u.is_active,
                    u.last_login_at, u.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object('id', r.id, 'name', r.name, 'description', r.description)
                        ) FILTER (WHERE r.id IS NOT NULL),
                        '[]'
                    ) as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.id = $1
                GROUP BY u.id
            `, [payload.userId]);

            if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found or inactive',
                    code: 'AUTH_INVALID'
                });
            }

            // Attach user to request
            req.user = userResult.rows[0];
            req.sessionId = payload.sessionId;

            next();
        } catch (error) {
            console.error('Authentication failed:', error.message);

            const statusCode = error.message === 'TOKEN_EXPIRED' ? 401 : 401;
            res.status(statusCode).json({
                success: false,
                error: error.message || 'Authentication failed',
                code: error.message || 'AUTH_ERROR'
            });
        }
    };
}

/**
 * Middleware to require admin role
 */
function requireAdmin() {
    return function(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
                code: 'AUTH_MISSING'
            });
        }

        const hasAdminRole = req.user.roles.some(r => r.name === 'admin');

        if (!hasAdminRole) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin role required.',
                code: 'FORBIDDEN'
            });
        }

        next();
    };
}

/**
 * Middleware to require specific role(s)
 */
function requireRole(...roleNames) {
    return function(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
                code: 'AUTH_MISSING'
            });
        }

        const userRoles = req.user.roles.map(r => r.name);
        const hasRole = roleNames.some(roleName => userRoles.includes(roleName));

        if (!hasRole) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role(s): ${roleNames.join(', ')}`,
                code: 'FORBIDDEN'
            });
        }

        next();
    };
}

/**
 * Middleware to require a specific permission (resource + action).
 * Checks req.user.permissions which must be loaded by loadPermissions().
 * Also accepts the wildcard 'resource.manage' permission.
 */
function requirePermission(resource, action) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
                code: 'AUTH_MISSING'
            });
        }

        const permissions = req.user.permissions || [];
        const permissionName = `${resource}.${action}`;
        const managePermission = `${resource}.manage`;

        const hasIt = permissions.some(
            p => p.name === permissionName || p.name === managePermission
        );

        if (!hasIt) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required permission: ${permissionName}`,
                code: 'FORBIDDEN'
            });
        }

        next();
    };
}

/**
 * Middleware to load the user's granular permissions onto req.user.permissions.
 * Should be applied after authenticate middleware.
 */
function loadPermissions(pool) {
    return async function (req, res, next) {
        try {
            if (!req.user || !req.user.id) return next();

            const result = await pool.query(
                `SELECT DISTINCT p.id, p.name, p.resource, p.action
                 FROM permissions p
                 INNER JOIN role_permissions rp ON p.id = rp.permission_id
                 INNER JOIN user_roles ur ON rp.role_id = ur.role_id
                 WHERE ur.user_id = $1`,
                [req.user.id]
            );

            req.user.permissions = result.rows;
            next();
        } catch (error) {
            console.error('Failed to load permissions:', error);
            req.user.permissions = [];
            next();
        }
    };
}

/**
 * Check if user has access to a specific page
 * @param {string} pageName - Name of the page to check access for
 * @returns {Function} Middleware function
 */
function requirePageAccess(pageName, pool) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            // Check if user has access to the page
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM pages p
                    INNER JOIN role_pages rp ON p.id = rp.page_id
                    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
                    WHERE ur.user_id = $1 AND p.name = $2
                ) as has_access
            `, [req.user.id, pageName]);

            if (!result.rows[0].has_access) {
                return res.status(403).json({
                    success: false,
                    error: `Access denied. You do not have permission to access this page: ${pageName}`,
                    code: 'FORBIDDEN'
                });
            }

            next();
        } catch (error) {
            console.error('Page access check error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify page access',
                code: 'INTERNAL_ERROR'
            });
        }
    };
}

/**
 * Middleware that resolves the correct Salesforce connection for the
 * authenticated user (per-user OAuth or service account based on preference
 * and permissions) and binds it into the AsyncLocalStorage context.
 * All downstream salesforce.js calls automatically use the resolved connection.
 *
 * Must be applied AFTER authenticate and loadPermissions.
 * If the user has no Salesforce credentials and no service-account permission,
 * the request proceeds without a connection (individual functions will throw
 * their own errors).
 */
function withSalesforceConnection(pool) {
    return async function (req, res, next) {
        if (!req.user || !req.user.id) return next();

        try {
            const conn = await salesforce.getConnectionForRequest(
                req.user.id,
                req.user.permissions || [],
                db,
                decrypt,
                encrypt
            );

            salesforce.runWithConnection(conn, () => {
                next();
            });
        } catch (err) {
            req.salesforceError = {
                code: err.code || 'SF_ERROR',
                message: err.message
            };

            // Run in a context with an error marker so downstream calls to
            // salesforce.getConnection() rethrow the user-specific error
            // instead of silently falling back to the service account.
            salesforce.runWithConnectionError(err, () => {
                next();
            });
        }
    };
}

module.exports = {
    createAuthMiddleware,
    requireAdmin,
    requireRole,
    requirePermission,
    loadPermissions,
    requirePageAccess,
    withSalesforceConnection
};

