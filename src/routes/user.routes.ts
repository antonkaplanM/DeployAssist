/**
 * User Management Routes
 * Handles user and role CRUD operations (admin only)
 */

import { Router, Response } from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import {
  AuthenticatedRequest,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRolesRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  AdminChangePasswordRequest,
} from '../types/auth.types';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { UserRepository } from '../repositories/UserRepository';
import {
  createAuthMiddleware,
  requireAdmin,
  requireOwnershipOrAdmin,
} from '../middleware/auth';
import { Logger } from '../utils/logger';

export function createUserRoutes(
  pool: Pool,
  authService: AuthService,
  userService: UserService
): Router {
  const router = Router();
  const userRepo = new UserRepository(pool);
  const authenticate = createAuthMiddleware(authService, userRepo);

  // Rate limiting for sensitive operations
  const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: 'Too many requests, please try again later',
  });

  // ===== USER ROUTES =====

  /**
   * GET /api/users
   * Get all users (admin only)
   */
  router.get('/', authenticate, requireAdmin(), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await userService.getAllUsers();

      res.json({
        success: true,
        users,
        count: users.length,
      });
    } catch (error) {
      Logger.error('Get all users error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve users',
      });
    }
  });

  /**
   * GET /api/users/:id
   * Get user by ID
   */
  router.get('/:id', authenticate, requireOwnershipOrAdmin(), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
      }

      const user = await userService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error) {
      Logger.error('Get user by ID error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user',
      });
    }
  });

  /**
   * POST /api/users
   * Create a new user (admin only)
   */
  router.post(
    '/',
    authenticate,
    requireAdmin(),
    strictRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { username, password, full_name, roleIds }: CreateUserRequest = req.body;

        if (!username || !password || !full_name || !roleIds || !Array.isArray(roleIds)) {
          return res.status(400).json({
            success: false,
            error: 'Username, password, full_name, and roleIds are required',
          });
        }

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const user = await userService.createUser(
          { username, password, full_name },
          roleIds,
          req.user!.id,
          ipAddress,
          userAgent
        );

        res.status(201).json({
          success: true,
          message: 'User created successfully',
          user,
        });
      } catch (error) {
        Logger.error('Create user error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to create user',
        });
      }
    }
  );

  /**
   * PUT /api/users/:id
   * Update user information (admin only)
   */
  router.put(
    '/:id',
    authenticate,
    requireAdmin(),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID',
          });
        }

        const { full_name, is_active }: UpdateUserRequest = req.body;

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const user = await userService.updateUser(
          userId,
          { full_name, is_active },
          req.user!.id,
          ipAddress,
          userAgent
        );

        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        res.json({
          success: true,
          message: 'User updated successfully',
          user,
        });
      } catch (error) {
        Logger.error('Update user error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to update user',
        });
      }
    }
  );

  /**
   * DELETE /api/users/:id
   * Delete a user (admin only)
   */
  router.delete(
    '/:id',
    authenticate,
    requireAdmin(),
    strictRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID',
          });
        }

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const deleted = await userService.deleteUser(
          userId,
          req.user!.id,
          ipAddress,
          userAgent
        );

        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
          });
        }

        res.json({
          success: true,
          message: 'User deleted successfully',
        });
      } catch (error) {
        Logger.error('Delete user error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to delete user',
        });
      }
    }
  );

  /**
   * PUT /api/users/:id/roles
   * Assign roles to a user (admin only)
   */
  router.put(
    '/:id/roles',
    authenticate,
    requireAdmin(),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID',
          });
        }

        const { roleIds }: AssignRolesRequest = req.body;

        if (!roleIds || !Array.isArray(roleIds)) {
          return res.status(400).json({
            success: false,
            error: 'roleIds array is required',
          });
        }

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        await userService.assignRoles(
          userId,
          roleIds,
          req.user!.id,
          ipAddress,
          userAgent
        );

        res.json({
          success: true,
          message: 'Roles assigned successfully',
        });
      } catch (error) {
        Logger.error('Assign roles error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to assign roles',
        });
      }
    }
  );

  /**
   * PUT /api/users/:id/password
   * Admin change user password (admin only)
   */
  router.put(
    '/:id/password',
    authenticate,
    requireAdmin(),
    strictRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid user ID',
          });
        }

        const { newPassword }: AdminChangePasswordRequest = req.body;

        if (!newPassword) {
          return res.status(400).json({
            success: false,
            error: 'newPassword is required',
          });
        }

        await authService.adminChangePassword(userId, newPassword);

        res.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error) {
        Logger.error('Admin change password error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to change password',
        });
      }
    }
  );

  // ===== ROLE ROUTES =====

  /**
   * GET /api/users/roles/all
   * Get all roles
   */
  router.get('/roles/all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roles = await userService.getAllRoles();

      res.json({
        success: true,
        roles,
        count: roles.length,
      });
    } catch (error) {
      Logger.error('Get all roles error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve roles',
      });
    }
  });

  /**
   * GET /api/users/roles/:id
   * Get role by ID with permissions
   */
  router.get('/roles/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roleId = parseInt(req.params.id);

      if (isNaN(roleId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role ID',
        });
      }

      const role = await userService.getRoleById(roleId);

      if (!role) {
        return res.status(404).json({
          success: false,
          error: 'Role not found',
        });
      }

      res.json({
        success: true,
        role,
      });
    } catch (error) {
      Logger.error('Get role by ID error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve role',
      });
    }
  });

  /**
   * POST /api/users/roles
   * Create a new role (admin only)
   */
  router.post(
    '/roles',
    authenticate,
    requireAdmin(),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { name, description, permissionIds }: CreateRoleRequest = req.body;

        if (!name) {
          return res.status(400).json({
            success: false,
            error: 'Role name is required',
          });
        }

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const role = await userService.createRole(
          name,
          description,
          permissionIds || [],
          req.user!.id,
          ipAddress,
          userAgent
        );

        res.status(201).json({
          success: true,
          message: 'Role created successfully',
          role,
        });
      } catch (error) {
        Logger.error('Create role error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to create role',
        });
      }
    }
  );

  /**
   * PUT /api/users/roles/:id
   * Update a role (admin only)
   */
  router.put(
    '/roles/:id',
    authenticate,
    requireAdmin(),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const roleId = parseInt(req.params.id);

        if (isNaN(roleId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid role ID',
          });
        }

        const { description, permissionIds }: UpdateRoleRequest = req.body;

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const role = await userService.updateRole(
          roleId,
          description || '',
          permissionIds || [],
          req.user!.id,
          ipAddress,
          userAgent
        );

        if (!role) {
          return res.status(404).json({
            success: false,
            error: 'Role not found or is a system role',
          });
        }

        res.json({
          success: true,
          message: 'Role updated successfully',
          role,
        });
      } catch (error) {
        Logger.error('Update role error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to update role',
        });
      }
    }
  );

  /**
   * DELETE /api/users/roles/:id
   * Delete a role (admin only)
   */
  router.delete(
    '/roles/:id',
    authenticate,
    requireAdmin(),
    strictRateLimit,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const roleId = parseInt(req.params.id);

        if (isNaN(roleId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid role ID',
          });
        }

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');

        const deleted = await userService.deleteRole(
          roleId,
          req.user!.id,
          ipAddress,
          userAgent
        );

        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: 'Role not found or cannot be deleted',
          });
        }

        res.json({
          success: true,
          message: 'Role deleted successfully',
        });
      } catch (error) {
        Logger.error('Delete role error', error as Error);

        res.status(400).json({
          success: false,
          error: (error as Error).message || 'Failed to delete role',
        });
      }
    }
  );

  /**
   * GET /api/users/permissions/all
   * Get all permissions
   */
  router.get('/permissions/all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const permissions = await userService.getAllPermissions();

      res.json({
        success: true,
        permissions,
        count: permissions.length,
      });
    } catch (error) {
      Logger.error('Get all permissions error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve permissions',
      });
    }
  });

  /**
   * GET /api/users/audit/role-changes
   * Get audit logs for role changes (admin only)
   */
  router.get(
    '/audit/role-changes',
    authenticate,
    requireAdmin(),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
        const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;

        const result = await userService.getRoleChangeAuditLogs({
          userId,
          limit,
          offset,
        });

        res.json({
          success: true,
          logs: result.logs,
          total: result.total,
          limit,
          offset,
        });
      } catch (error) {
        Logger.error('Get role change audit logs error', error as Error);

        res.status(500).json({
          success: false,
          error: 'Failed to retrieve audit logs',
        });
      }
    }
  );

  return router;
}

