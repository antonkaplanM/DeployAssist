/**
 * User Management Routes (JavaScript)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many requests, please try again later'
});

function createUserRoutes(pool, authService, authenticate, requireAdmin) {
    const router = express.Router();

    // ==========================================
    // ROLE ROUTES (Must come before /api/users/:id)
    // ==========================================

    /**
     * GET /api/users/roles/all - Get all roles
     */
    router.get('/roles/all', authenticate, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, name, description, is_system_role
                FROM roles
                ORDER BY 
                    CASE 
                        WHEN name = 'admin' THEN 1
                        WHEN name = 'user' THEN 2
                        ELSE 3
                    END,
                    name
            `);

            res.json({
                success: true,
                roles: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Get all roles error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve roles'
            });
        }
    });

    /**
     * POST /api/users/roles - Create new role
     */
    router.post('/roles', authenticate, requireAdmin(), async (req, res) => {
        try {
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Role name is required'
                });
            }

            // Check if role already exists
            const existing = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
            if (existing.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Role name already exists'
                });
            }

            const result = await pool.query(`
                INSERT INTO roles (name, description, is_system_role)
                VALUES ($1, $2, FALSE)
                RETURNING id, name, description, is_system_role
            `, [name, description || null]);

            // Audit log
            await pool.query(`
                INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, new_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                req.user.id,
                'role_created',
                'role',
                result.rows[0].id,
                JSON.stringify({ name, description }),
                req.user.id
            ]);

            res.status(201).json({
                success: true,
                message: 'Role created successfully',
                role: result.rows[0]
            });
        } catch (error) {
            console.error('Create role error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to create role'
            });
        }
    });

    /**
     * GET /api/users/roles/:id/pages - Get pages assigned to a role
     */
    router.get('/roles/:id/pages', authenticate, requireAdmin(), async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);
            
            const result = await pool.query(`
                SELECT p.*
                FROM pages p
                INNER JOIN role_pages rp ON p.id = rp.page_id
                WHERE rp.role_id = $1
                ORDER BY p.sort_order, p.display_name
            `, [roleId]);

            res.json({
                success: true,
                pages: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Get role pages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve role pages'
            });
        }
    });

    /**
     * PUT /api/users/roles/:id/pages - Assign pages to a role
     */
    router.put('/roles/:id/pages', authenticate, requireAdmin(), async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);
            const { pageIds } = req.body;

            if (!pageIds || !Array.isArray(pageIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'pageIds array is required'
                });
            }

            // Check if it's a system role
            const roleCheck = await pool.query(
                'SELECT name, is_system_role FROM roles WHERE id = $1',
                [roleId]
            );

            if (roleCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Role not found'
                });
            }

            // Begin transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Delete existing page assignments
                await client.query('DELETE FROM role_pages WHERE role_id = $1', [roleId]);

                // Insert new page assignments
                if (pageIds.length > 0) {
                    for (const pageId of pageIds) {
                        await client.query(
                            'INSERT INTO role_pages (role_id, page_id) VALUES ($1, $2)',
                            [roleId, pageId]
                        );
                    }
                }

                await client.query('COMMIT');

                // Audit log
                await pool.query(`
                    INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, new_value, performed_by)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [req.user.id, 'pages_assigned', 'role_pages', roleId, JSON.stringify(pageIds), req.user.id]);

                res.json({
                    success: true,
                    message: 'Pages assigned to role successfully'
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Assign role pages error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to assign pages to role'
            });
        }
    });

    /**
     * DELETE /api/users/roles/:id - Delete role
     */
    router.delete('/roles/:id', authenticate, requireAdmin(), async (req, res) => {
        try {
            const roleId = parseInt(req.params.id);

            // Check if it's a system role
            const roleCheck = await pool.query(
                'SELECT name, is_system_role FROM roles WHERE id = $1',
                [roleId]
            );

            if (roleCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Role not found'
                });
            }

            if (roleCheck.rows[0].is_system_role) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete system role'
                });
            }

            // Check if role is assigned to any users
            const usageCheck = await pool.query(
                'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1',
                [roleId]
            );

            if (parseInt(usageCheck.rows[0].count) > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete role that is assigned to users'
                });
            }

            // Delete the role
            await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);

            // Audit log
            await pool.query(`
                INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, old_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                req.user.id,
                'role_deleted',
                'role',
                roleId,
                JSON.stringify(roleCheck.rows[0]),
                req.user.id
            ]);

            res.json({
                success: true,
                message: 'Role deleted successfully'
            });
        } catch (error) {
            console.error('Delete role error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to delete role'
            });
        }
    });

    // ==========================================
    // PAGE ROUTES (Must come before /api/users/:id)
    // ==========================================

    /**
     * GET /api/users/pages/all - Get all pages
     */
    router.get('/pages/all', authenticate, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    id, name, display_name, description, parent_page_id,
                    route, icon, sort_order, is_system_page
                FROM pages
                ORDER BY sort_order ASC, display_name ASC
            `);

            res.json({
                success: true,
                pages: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Get all pages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve pages'
            });
        }
    });

    // ==========================================
    // ME ROUTES (Must come before /api/users/:id)
    // ==========================================

    /**
     * GET /api/users/me/pages - Get current user's accessible pages
     */
    router.get('/me/pages', authenticate, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT DISTINCT p.*
                FROM pages p
                INNER JOIN role_pages rp ON p.id = rp.page_id
                INNER JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.user_id = $1
                ORDER BY p.sort_order, p.display_name
            `, [req.user.id]);

            res.json({
                success: true,
                pages: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Get user pages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user pages'
            });
        }
    });

    // ==========================================
    // USER ROUTES
    // ==========================================

    /**
     * GET /api/users - Get all users
     */
    router.get('/', authenticate, requireAdmin(), async (req, res) => {
        try {
            const result = await pool.query(`
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
                GROUP BY u.id
                ORDER BY u.username
            `);

            res.json({
                success: true,
                users: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve users'
            });
        }
    });

    /**
     * POST /api/users - Create new user
     */
    router.post('/', authenticate, requireAdmin(), strictRateLimit, async (req, res) => {
        try {
            const { username, password, full_name, roleIds } = req.body;

            if (!username || !password || !full_name || !roleIds || !Array.isArray(roleIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username, password, full_name, and roleIds are required'
                });
            }

            // Validate password
            const validation = authService.validatePassword(password);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: validation.errors.join(', ')
                });
            }

            // Check if username exists
            const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existing.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Username already exists'
                });
            }

            // Hash password
            const passwordHash = await authService.hashPassword(password);

            // Create user
            const userResult = await pool.query(`
                INSERT INTO users (username, password_hash, full_name, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id, username, full_name, created_at
            `, [username, passwordHash, full_name, req.user.id]);

            const newUser = userResult.rows[0];

            // Assign roles
            for (const roleId of roleIds) {
                await pool.query(
                    'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
                    [newUser.id, roleId, req.user.id]
                );
            }

            // Audit log
            await pool.query(`
                INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, new_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                newUser.id,
                'user_created',
                'user',
                newUser.id,
                JSON.stringify({ username, full_name, roleIds }),
                req.user.id
            ]);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                user: newUser
            });
        } catch (error) {
            console.error('Create user error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to create user'
            });
        }
    });

    /**
     * GET /api/users/:id - Get single user
     */
    router.get('/:id', authenticate, requireAdmin(), async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            
            const result = await pool.query(`
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
            `, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            res.json({
                success: true,
                user: result.rows[0]
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user'
            });
        }
    });

    /**
     * PUT /api/users/:id - Update user
     */
    router.put('/:id', authenticate, requireAdmin(), async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { full_name, is_active } = req.body;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (full_name !== undefined) {
                updates.push(`full_name = $${paramCount}`);
                values.push(full_name);
                paramCount++;
            }

            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount}`);
                values.push(is_active);
                paramCount++;
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No fields to update'
                });
            }

            values.push(userId);
            const result = await pool.query(`
                UPDATE users
                SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                WHERE id = $${paramCount}
                RETURNING id, username, full_name, is_active
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            res.json({
                success: true,
                message: 'User updated successfully',
                user: result.rows[0]
            });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to update user'
            });
        }
    });

    /**
     * DELETE /api/users/:id - Delete user
     */
    router.delete('/:id', authenticate, requireAdmin(), async (req, res) => {
        try {
            const userId = parseInt(req.params.id);

            // Prevent self-deletion
            if (userId === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete your own account'
                });
            }

            // Check if user exists
            const userCheck = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Delete the user (cascade will handle user_roles)
            await pool.query('DELETE FROM users WHERE id = $1', [userId]);

            // Audit log
            await pool.query(`
                INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, old_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                req.user.id,
                'user_deleted',
                'user',
                userId,
                JSON.stringify(userCheck.rows[0]),
                req.user.id
            ]);

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to delete user'
            });
        }
    });

    /**
     * PUT /api/users/:id/password - Admin change password
     */
    router.put('/:id/password', authenticate, requireAdmin(), strictRateLimit, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { newPassword } = req.body;

            if (!newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'newPassword is required'
                });
            }

            await authService.adminChangePassword(userId, newPassword);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Admin change password error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to change password'
            });
        }
    });

    /**
     * PUT /api/users/:id/roles - Assign roles
     */
    router.put('/:id/roles', authenticate, requireAdmin(), async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const { roleIds } = req.body;

            if (!roleIds || !Array.isArray(roleIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'roleIds array is required'
                });
            }

            // Delete existing roles
            await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

            // Insert new roles
            for (const roleId of roleIds) {
                await pool.query(
                    'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
                    [userId, roleId, req.user.id]
                );
            }

            // Audit log
            await pool.query(`
                INSERT INTO auth_audit_log (user_id, action, entity_type, entity_id, new_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, 'roles_assigned', 'user_roles', userId, JSON.stringify(roleIds), req.user.id]);

            res.json({
                success: true,
                message: 'Roles assigned successfully'
            });
        } catch (error) {
            console.error('Assign roles error:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to assign roles'
            });
        }
    });

    return router;
}

module.exports = createUserRoutes;
