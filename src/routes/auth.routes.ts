/**
 * Authentication Routes
 * Handles login, logout, token refresh, and password changes
 */

import { Router, Response } from 'express';
import { Pool } from 'pg';
import {
  AuthenticatedRequest,
  LoginRequest,
  ChangePasswordRequest,
} from '../types/auth.types';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { createAuthMiddleware, requireOwnershipOrAdmin } from '../middleware/auth';
import { Logger } from '../utils/logger';

export function createAuthRoutes(pool: Pool, authService: AuthService): Router {
  const router = Router();
  const userRepo = new UserRepository(pool);
  const authenticate = createAuthMiddleware(authService, userRepo);

  /**
   * POST /api/auth/login
   * Login with username and password
   */
  router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, password, rememberMe }: LoginRequest = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required',
        });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.login(
        username,
        password,
        rememberMe || false,
        ipAddress,
        userAgent
      );

      // Set access token in HTTP-only cookie
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Set refresh token in HTTP-only cookie if remember me
      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: result.user!.id,
          username: result.user!.username,
          full_name: result.user!.full_name,
          roles: result.user!.roles.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
          })),
          last_login_at: result.user!.last_login_at,
        },
      });
    } catch (error) {
      Logger.error('Login error', error as Error);

      const err = error as any;
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Login failed';

      res.status(statusCode).json({
        success: false,
        error: message,
        code: err.code || 'LOGIN_ERROR',
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout user (invalidate session)
   */
  router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.sessionId) {
        await authService.logout(req.sessionId);
      }

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      Logger.error('Logout error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user info
   */
  router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
      }

      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          full_name: req.user.full_name,
          is_active: req.user.is_active,
          last_login_at: req.user.last_login_at,
          created_at: req.user.created_at,
          roles: req.user.roles.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
          })),
          permissions: (req.user.permissions || []).map(p => ({
            id: p.id,
            name: p.name,
            resource: p.resource,
            action: p.action,
          })),
        },
      });
    } catch (error) {
      Logger.error('Get current user error', error as Error);

      res.status(500).json({
        success: false,
        error: 'Failed to get user info',
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  router.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'No refresh token provided',
        });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.refreshAccessToken(
        refreshToken,
        ipAddress,
        userAgent
      );

      // Set new access token in cookie
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        success: true,
        message: 'Token refreshed',
        user: {
          id: result.user!.id,
          username: result.user!.username,
          full_name: result.user!.full_name,
          roles: result.user!.roles.map(r => ({
            id: r.id,
            name: r.name,
          })),
        },
      });
    } catch (error) {
      Logger.error('Token refresh error', error as Error);

      const err = error as any;
      const statusCode = err.statusCode || 401;

      res.status(statusCode).json({
        success: false,
        error: 'Token refresh failed',
        code: err.code || 'REFRESH_ERROR',
      });
    }
  });

  /**
   * POST /api/auth/change-password
   * Change own password
   */
  router.post(
    '/change-password',
    authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Not authenticated',
          });
        }

        const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            error: 'Current password and new password are required',
          });
        }

        await authService.changePassword(req.user.id, currentPassword, newPassword);

        // Clear cookies to force re-login
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
          success: true,
          message: 'Password changed successfully. Please log in again.',
        });
      } catch (error) {
        Logger.error('Change password error', error as Error);

        const err = error as any;
        const statusCode = err.statusCode || 500;

        res.status(statusCode).json({
          success: false,
          error: err.message || 'Password change failed',
        });
      }
    }
  );

  return router;
}

