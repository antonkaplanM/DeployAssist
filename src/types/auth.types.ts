/**
 * Authentication and User Management Types
 */

import { Request } from 'express';

// ===== DATABASE ENTITY TYPES =====

/**
 * User entity from database
 */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  last_login_at: Date | null;
  password_changed_at: Date;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

/**
 * Role entity from database
 */
export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Permission entity from database
 */
export interface Permission {
  id: number;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: Date;
}

/**
 * Page entity from database
 */
export interface Page {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  parent_page_id: number | null;
  route: string | null;
  icon: string | null;
  sort_order: number;
  is_system_page: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * User-Role junction entity
 */
export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  assigned_at: Date;
  assigned_by: number | null;
}

/**
 * Role-Permission junction entity
 */
export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  created_at: Date;
}

/**
 * Role-Page junction entity
 */
export interface RolePage {
  id: number;
  role_id: number;
  page_id: number;
  created_at: Date;
}

/**
 * Refresh token entity
 */
export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  is_revoked: boolean;
  revoked_at: Date | null;
}

/**
 * Session activity entity
 */
export interface SessionActivity {
  id: number;
  user_id: number;
  session_token_hash: string;
  last_activity_at: Date;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

/**
 * Auth audit log entity
 */
export interface AuthAuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_value: any;
  new_value: any;
  performed_by: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ===== DTO TYPES (Data Transfer Objects) =====

/**
 * User data without sensitive information
 */
export interface UserDTO {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  roles: RoleDTO[];
}

/**
 * Role data transfer object
 */
export interface RoleDTO {
  id: number;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

/**
 * Permission data transfer object
 */
export interface PermissionDTO {
  id: number;
  name: string;
  description: string | null;
  resource: string;
  action: string;
}

/**
 * Page data transfer object
 */
export interface PageDTO {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  parent_page_id: number | null;
  route: string | null;
  icon: string | null;
  sort_order: number;
  is_system_page: boolean;
  children?: PageDTO[]; // For nested page structure
}

/**
 * User with roles for internal use
 */
export interface UserWithRoles extends Omit<User, 'password_hash'> {
  roles: Role[];
  permissions?: Permission[];
  pages?: Page[];
}

// ===== REQUEST/RESPONSE TYPES =====

/**
 * Login request body
 */
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  user: UserDTO;
  token?: string; // For debugging/mobile apps (optional)
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Admin change password request
 */
export interface AdminChangePasswordRequest {
  newPassword: string;
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  username: string;
  password: string;
  full_name: string;
  roleIds: number[];
}

/**
 * Update user request
 */
export interface UpdateUserRequest {
  full_name?: string;
  is_active?: boolean;
}

/**
 * Assign roles request
 */
export interface AssignRolesRequest {
  roleIds: number[];
}

/**
 * Create role request
 */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionIds?: number[];
  pageIds?: number[];
}

/**
 * Update role request
 */
export interface UpdateRoleRequest {
  description?: string;
  permissionIds?: number[];
  pageIds?: number[];
}

/**
 * Assign pages request
 */
export interface AssignPagesRequest {
  pageIds: number[];
}

// ===== JWT PAYLOAD TYPES =====

/**
 * JWT access token payload
 */
export interface JWTAccessPayload {
  userId: number;
  username: string;
  roles: string[];
  permissions: string[];
  sessionId: string; // For tracking activity
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * JWT refresh token payload
 */
export interface JWTRefreshPayload {
  userId: number;
  tokenId: string; // Hash reference in DB
  type: 'refresh';
  iat: number;
  exp: number;
}

// ===== EXTENDED EXPRESS TYPES =====

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: UserWithRoles;
  sessionId?: string;
}

// ===== SERVICE/REPOSITORY TYPES =====

/**
 * User creation data
 */
export interface CreateUserData {
  username: string;
  password: string;
  full_name: string;
  created_by?: number;
}

/**
 * User update data
 */
export interface UpdateUserData {
  full_name?: string;
  is_active?: boolean;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: UserWithRoles;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Session info
 */
export interface SessionInfo {
  userId: number;
  sessionId: string;
  expiresAt: Date;
}

/**
 * Audit log creation data
 */
export interface CreateAuditLogData {
  user_id?: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  old_value?: any;
  new_value?: any;
  performed_by?: number;
  ip_address?: string;
  user_agent?: string;
}

// ===== VALIDATION TYPES =====

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  accessTokenLifetime: number; // in seconds
  refreshTokenLifetime: number; // in seconds
  inactivityTimeout: number; // in seconds (60 minutes = 3600)
  maxFailedAttempts: number;
  lockoutDuration: number; // in seconds
}

// ===== ERROR TYPES =====

/**
 * Authentication error
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTH_ERROR',
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string = 'FORBIDDEN',
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * User locked error
 */
export class UserLockedError extends AuthenticationError {
  constructor(lockedUntil: Date) {
    super(
      `Account is locked until ${lockedUntil.toISOString()}`,
      'USER_LOCKED',
      423
    );
    this.name = 'UserLockedError';
  }
}

/**
 * Invalid credentials error
 */
export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid username or password', 'INVALID_CREDENTIALS', 401);
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Token expired error
 */
export class TokenExpiredError extends AuthenticationError {
  constructor() {
    super('Session has expired', 'TOKEN_EXPIRED', 401);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Session inactive error
 */
export class SessionInactiveError extends AuthenticationError {
  constructor() {
    super('Session inactive for too long', 'SESSION_INACTIVE', 401);
    this.name = 'SessionInactiveError';
  }
}

// ===== CONSTANTS =====

/**
 * Default password policy (Gmail-like)
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false, // Gmail doesn't require this
  requireLowercase: false, // Gmail doesn't require this
  requireNumbers: false, // Gmail doesn't require this
  requireSpecialChars: false, // Gmail doesn't require this
};

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  accessTokenLifetime: 24 * 60 * 60, // 24 hours
  refreshTokenLifetime: 30 * 24 * 60 * 60, // 30 days (for remember me)
  inactivityTimeout: 60 * 60, // 60 minutes
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60, // 15 minutes
};

/**
 * Role names
 */
export enum RoleName {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * Permission resources
 */
export enum PermissionResource {
  USERS = 'users',
  ROLES = 'roles',
  EXPIRATION_MONITOR = 'expiration_monitor',
  PACKAGES = 'packages',
  GHOST_ACCOUNTS = 'ghost_accounts',
  SALESFORCE = 'salesforce',
  SML = 'sml',
}

/**
 * Permission actions
 */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
  ASSIGN = 'assign',
  ACCESS = 'access',
  WRITE = 'write',
}

