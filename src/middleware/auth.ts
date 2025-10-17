/**
 * Authentication and Authorization Middleware
 */

import { Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  AuthenticatedRequest,
  AuthenticationError,
  AuthorizationError,
  RoleName,
} from '../types/auth.types';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { Logger } from '../utils/logger';

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(authService: AuthService, userRepo: UserRepository) {
  /**
   * Middleware to verify JWT token and attach user to request
   */
  return async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract token from cookie or Authorization header
      let token: string | undefined;

      // Try cookie first (preferred method)
      if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
      }

      // Fallback to Authorization header (for API clients)
      if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        throw new AuthenticationError('No authentication token provided');
      }

      // Verify token
      const payload = await authService.verifyAccessToken(token);

      // Get full user data with roles and permissions
      const user = await userRepo.findById(payload.userId);

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (!user.is_active) {
        throw new AuthenticationError('User account is inactive');
      }

      // Load permissions
      const permissions = await userRepo.getUserPermissions(user.id);
      const userWithPermissions = { ...user, permissions };

      // Attach user and session to request
      req.user = userWithPermissions;
      req.sessionId = payload.sessionId;

      next();
    } catch (error) {
      Logger.warn('Authentication failed', { 
        error: (error as Error).message,
        path: req.path 
      });

      if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
        });
      }
    }
  };
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 * Useful for routes that have different behavior for authenticated users
 */
export function createOptionalAuthMiddleware(authService: AuthService, userRepo: UserRepository) {
  return async function optionalAuthenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract token
      let token: string | undefined;

      if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
      }

      if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (token) {
        const payload = await authService.verifyAccessToken(token);
        const user = await userRepo.findById(payload.userId);

        if (user && user.is_active) {
          const permissions = await userRepo.getUserPermissions(user.id);
          req.user = { ...user, permissions };
          req.sessionId = payload.sessionId;
        }
      }

      next();
    } catch (error) {
      // Silently fail for optional auth
      next();
    }
  };
}

/**
 * Middleware to require specific role(s)
 */
export function requireRole(...roleNames: string[]) {
  return function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const userRoles = req.user.roles.map(r => r.name);
      const hasRole = roleNames.some(roleName => userRoles.includes(roleName));

      if (!hasRole) {
        throw new AuthorizationError(
          `Access denied. Required role(s): ${roleNames.join(', ')}`
        );
      }

      next();
    } catch (error) {
      Logger.warn('Authorization failed', {
        error: (error as Error).message,
        userId: req.user?.id,
        requiredRoles: roleNames,
        path: req.path,
      });

      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
      }
    }
  };
}

/**
 * Middleware to require admin role
 */
export function requireAdmin() {
  return requireRole(RoleName.ADMIN);
}

/**
 * Middleware to require specific permission(s)
 */
export function requirePermission(resource: string, action: string) {
  return async function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const permissions = req.user.permissions || [];
      const permissionName = `${resource}.${action}`;
      const managePermission = `${resource}.manage`;

      const hasPermission = permissions.some(
        p => p.name === permissionName || p.name === managePermission
      );

      if (!hasPermission) {
        throw new AuthorizationError(
          `Access denied. Required permission: ${permissionName}`
        );
      }

      next();
    } catch (error) {
      Logger.warn('Authorization failed', {
        error: (error as Error).message,
        userId: req.user?.id,
        requiredPermission: `${resource}.${action}`,
        path: req.path,
      });

      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
      }
    }
  };
}

/**
 * Middleware to check if user owns the resource or is admin
 */
export function requireOwnershipOrAdmin(userIdParam: string = 'id') {
  return function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const resourceUserId = parseInt(req.params[userIdParam]);
      const isOwner = req.user.id === resourceUserId;
      const isAdmin = req.user.roles.some(r => r.name === RoleName.ADMIN);

      if (!isOwner && !isAdmin) {
        throw new AuthorizationError('Access denied. You can only access your own resources.');
      }

      next();
    } catch (error) {
      Logger.warn('Ownership check failed', {
        error: (error as Error).message,
        userId: req.user?.id,
        resourceUserId: req.params[userIdParam],
        path: req.path,
      });

      if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      } else {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
      }
    }
  };
}

