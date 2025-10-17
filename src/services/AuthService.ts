/**
 * Authentication Service
 * Handles authentication logic, token management, and password operations
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Pool } from 'pg';
import {
  AuthResult,
  JWTAccessPayload,
  JWTRefreshPayload,
  UserWithRoles,
  PasswordValidationResult,
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SESSION_CONFIG,
  InvalidCredentialsError,
  UserLockedError,
  TokenExpiredError,
  SessionInactiveError,
  PasswordPolicy,
  SessionConfig,
} from '../types/auth.types';
import { UserRepository } from '../repositories/UserRepository';
import { AuthRepository } from '../repositories/AuthRepository';
import { Logger } from '../utils/logger';

export class AuthService {
  private userRepo: UserRepository;
  private authRepo: AuthRepository;
  private jwtSecret: string;
  private passwordPolicy: PasswordPolicy;
  private sessionConfig: SessionConfig;

  constructor(
    pool: Pool,
    jwtSecret: string,
    passwordPolicy?: PasswordPolicy,
    sessionConfig?: SessionConfig
  ) {
    this.userRepo = new UserRepository(pool);
    this.authRepo = new AuthRepository(pool);
    this.jwtSecret = jwtSecret;
    this.passwordPolicy = passwordPolicy || DEFAULT_PASSWORD_POLICY;
    this.sessionConfig = sessionConfig || DEFAULT_SESSION_CONFIG;
  }

  /**
   * Authenticate user with username and password
   */
  async login(
    username: string,
    password: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      // Find user
      const user = await this.userRepo.findByUsername(username);
      
      if (!user) {
        throw new InvalidCredentialsError();
      }

      // Check if user is active
      if (!user.is_active) {
        throw new InvalidCredentialsError();
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new UserLockedError(new Date(user.locked_until));
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        // Increment failed attempts
        await this.userRepo.incrementFailedAttempts(
          user.id,
          this.sessionConfig.lockoutDuration
        );
        throw new InvalidCredentialsError();
      }

      // Load user permissions
      const permissions = await this.userRepo.getUserPermissions(user.id);
      const userWithPermissions = { ...user, permissions };

      // Update last login
      await this.userRepo.updateLastLogin(user.id);

      // Generate tokens
      const sessionId = this.generateSessionId();
      const accessToken = this.generateAccessToken(userWithPermissions, sessionId);
      
      let refreshToken: string | undefined;
      if (rememberMe) {
        refreshToken = await this.generateRefreshToken(
          user.id,
          ipAddress,
          userAgent
        );
      }

      // Create session
      const sessionExpiry = new Date(
        Date.now() + this.sessionConfig.accessTokenLifetime * 1000
      );
      const sessionTokenHash = this.hashString(sessionId);
      
      await this.authRepo.upsertSession(
        user.id,
        sessionTokenHash,
        sessionExpiry,
        ipAddress,
        userAgent
      );

      Logger.info('User logged in successfully', { 
        username, 
        userId: user.id,
        rememberMe 
      });

      return {
        success: true,
        user: userWithPermissions,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      Logger.warn('Login failed', { username, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(sessionId: string): Promise<void> {
    try {
      const sessionTokenHash = this.hashString(sessionId);
      await this.authRepo.deleteSession(sessionTokenHash);
      Logger.info('User logged out', { sessionId });
    } catch (error) {
      Logger.error('Logout failed', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JWTAccessPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTAccessPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check session activity
      const sessionTokenHash = this.hashString(payload.sessionId);
      const session = await this.authRepo.getSession(sessionTokenHash);

      if (!session) {
        throw new TokenExpiredError();
      }

      // Check if session expired
      if (new Date(session.expires_at) < new Date()) {
        await this.authRepo.deleteSession(sessionTokenHash);
        throw new TokenExpiredError();
      }

      // Check inactivity timeout
      const inactivityThreshold = new Date(
        Date.now() - this.sessionConfig.inactivityTimeout * 1000
      );

      if (new Date(session.last_activity_at) < inactivityThreshold) {
        await this.authRepo.deleteSession(sessionTokenHash);
        throw new SessionInactiveError();
      }

      // Update session activity
      await this.authRepo.updateSessionActivity(sessionTokenHash);

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtSecret) as JWTRefreshPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists and is valid in database
      const dbToken = await this.authRepo.getRefreshToken(refreshToken);

      if (!dbToken) {
        throw new TokenExpiredError();
      }

      // Update refresh token last used
      await this.authRepo.updateRefreshTokenLastUsed(refreshToken);

      // Get user
      const user = await this.userRepo.findById(payload.userId);

      if (!user || !user.is_active) {
        throw new InvalidCredentialsError();
      }

      // Load permissions
      const permissions = await this.userRepo.getUserPermissions(user.id);
      const userWithPermissions = { ...user, permissions };

      // Generate new access token
      const sessionId = this.generateSessionId();
      const accessToken = this.generateAccessToken(userWithPermissions, sessionId);

      // Create session
      const sessionExpiry = new Date(
        Date.now() + this.sessionConfig.accessTokenLifetime * 1000
      );
      const sessionTokenHash = this.hashString(sessionId);
      
      await this.authRepo.upsertSession(
        user.id,
        sessionTokenHash,
        sessionExpiry,
        ipAddress,
        userAgent
      );

      Logger.info('Access token refreshed', { userId: user.id });

      return {
        success: true,
        user: userWithPermissions,
        accessToken,
      };
    } catch (error) {
      Logger.warn('Token refresh failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user
      const user = await this.userRepo.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isPasswordValid) {
        throw new InvalidCredentialsError();
      }

      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password
      await this.userRepo.updatePassword(userId, passwordHash);

      // Invalidate all user sessions (force re-login)
      await this.authRepo.deleteUserSessions(userId);

      // Revoke all refresh tokens
      await this.authRepo.revokeUserRefreshTokens(userId);

      Logger.info('User password changed', { userId });
    } catch (error) {
      Logger.error('Password change failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Admin change user password (no current password required)
   */
  async adminChangePassword(userId: number, newPassword: string): Promise<void> {
    try {
      // Validate new password
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password
      await this.userRepo.updatePassword(userId, passwordHash);

      // Invalidate all user sessions
      await this.authRepo.deleteUserSessions(userId);

      // Revoke all refresh tokens
      await this.authRepo.revokeUserRefreshTokens(userId);

      Logger.info('User password changed by admin', { userId });
    } catch (error) {
      Logger.error('Admin password change failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < this.passwordPolicy.minLength) {
      errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }

    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.passwordPolicy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: UserWithRoles, sessionId: string): string {
    const payload: JWTAccessPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles.map(r => r.name),
      permissions: (user.permissions || []).map(p => p.name),
      sessionId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.sessionConfig.accessTokenLifetime,
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(
    userId: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const tokenId = this.generateTokenId();
    
    const payload: JWTRefreshPayload = {
      userId,
      tokenId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.sessionConfig.refreshTokenLifetime,
    };

    const token = jwt.sign(payload, this.jwtSecret);

    // Store token in database
    const expiresAt = new Date(Date.now() + this.sessionConfig.refreshTokenLifetime * 1000);
    await this.authRepo.createRefreshToken(userId, token, expiresAt, ipAddress, userAgent);

    return token;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique token ID
   */
  private generateTokenId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash string using SHA256
   */
  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Cleanup expired sessions and tokens (should be run periodically)
   */
  async cleanupExpired(): Promise<void> {
    try {
      const sessionsDeleted = await this.authRepo.cleanupExpiredSessions();
      const tokensDeleted = await this.authRepo.cleanupExpiredRefreshTokens();

      Logger.info('Cleanup completed', { sessionsDeleted, tokensDeleted });
    } catch (error) {
      Logger.error('Cleanup failed', error as Error);
    }
  }
}

