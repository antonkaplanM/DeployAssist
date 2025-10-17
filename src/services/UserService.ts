/**
 * User Service
 * Handles user and role management operations
 */

import { Pool } from 'pg';
import {
  UserDTO,
  UserWithRoles,
  CreateUserData,
  UpdateUserData,
  Role,
  RoleDTO,
  Permission,
  CreateAuditLogData,
} from '../types/auth.types';
import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { AuthRepository } from '../repositories/AuthRepository';
import { AuthService } from './AuthService';
import { Logger } from '../utils/logger';

export class UserService {
  private userRepo: UserRepository;
  private roleRepo: RoleRepository;
  private authRepo: AuthRepository;
  private authService: AuthService;

  constructor(pool: Pool, authService: AuthService) {
    this.userRepo = new UserRepository(pool);
    this.roleRepo = new RoleRepository(pool);
    this.authRepo = new AuthRepository(pool);
    this.authService = authService;
  }

  /**
   * Get all users (without sensitive data)
   */
  async getAllUsers(): Promise<UserDTO[]> {
    try {
      const users = await this.userRepo.findAll();
      return users.map(user => this.toUserDTO(user));
    } catch (error) {
      Logger.error('Error getting all users', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<UserDTO | null> {
    try {
      const user = await this.userRepo.findById(id);
      return user ? this.toUserDTO(user) : null;
    } catch (error) {
      Logger.error('Error getting user by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(
    userData: CreateUserData,
    roleIds: number[],
    createdBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDTO> {
    try {
      // Validate password
      const validation = this.authService.validatePassword(userData.password);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check if username already exists
      const existingUser = await this.userRepo.findByUsername(userData.username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Validate roles exist
      const validRoles = await Promise.all(
        roleIds.map(roleId => this.roleRepo.findById(roleId))
      );

      if (validRoles.some(role => !role)) {
        throw new Error('One or more role IDs are invalid');
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(userData.password);

      // Create user
      const user = await this.userRepo.create(
        { ...userData, created_by: createdBy },
        passwordHash
      );

      // Assign roles
      if (roleIds.length > 0) {
        await this.userRepo.assignRoles(user.id, roleIds, createdBy);
      }

      // Create audit log
      await this.authRepo.createAuditLog({
        action: 'user_created',
        entity_type: 'user',
        entity_id: user.id,
        new_value: {
          username: user.username,
          full_name: user.full_name,
          roles: roleIds,
        },
        performed_by: createdBy,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      Logger.info('User created', { username: user.username, userId: user.id, createdBy });

      // Return user with roles
      const userWithRoles = await this.userRepo.findById(user.id);
      return this.toUserDTO(userWithRoles!);
    } catch (error) {
      Logger.error('Error creating user', error as Error, { username: userData.username });
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(
    id: number,
    userData: UpdateUserData,
    updatedBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDTO | null> {
    try {
      // Get old user data for audit
      const oldUser = await this.userRepo.findById(id);
      if (!oldUser) {
        return null;
      }

      // Update user
      const updated = await this.userRepo.update(id, userData);
      if (!updated) {
        return null;
      }

      // Create audit log
      await this.authRepo.createAuditLog({
        user_id: id,
        action: 'user_updated',
        entity_type: 'user',
        entity_id: id,
        old_value: {
          full_name: oldUser.full_name,
          is_active: oldUser.is_active,
        },
        new_value: userData,
        performed_by: updatedBy,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      Logger.info('User updated', { userId: id, updatedBy });

      const userWithRoles = await this.userRepo.findById(id);
      return this.toUserDTO(userWithRoles!);
    } catch (error) {
      Logger.error('Error updating user', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(
    id: number,
    deletedBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      // Get user data for audit
      const user = await this.userRepo.findById(id);
      if (!user) {
        return false;
      }

      // Don't allow deleting yourself
      if (id === deletedBy) {
        throw new Error('Cannot delete your own account');
      }

      // Delete user
      const deleted = await this.userRepo.delete(id);

      if (deleted) {
        // Create audit log
        await this.authRepo.createAuditLog({
          user_id: id,
          action: 'user_deleted',
          entity_type: 'user',
          entity_id: id,
          old_value: {
            username: user.username,
            full_name: user.full_name,
          },
          performed_by: deletedBy,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        Logger.info('User deleted', { userId: id, deletedBy });
      }

      return deleted;
    } catch (error) {
      Logger.error('Error deleting user', error as Error, { id });
      throw error;
    }
  }

  /**
   * Assign roles to a user
   */
  async assignRoles(
    userId: number,
    roleIds: number[],
    assignedBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Get old roles for audit
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldRoles = user.roles.map(r => ({ id: r.id, name: r.name }));

      // Validate roles exist
      const validRoles = await Promise.all(
        roleIds.map(roleId => this.roleRepo.findById(roleId))
      );

      if (validRoles.some(role => !role)) {
        throw new Error('One or more role IDs are invalid');
      }

      // Assign roles
      await this.userRepo.assignRoles(userId, roleIds, assignedBy);

      // Get new roles
      const updatedUser = await this.userRepo.findById(userId);
      const newRoles = updatedUser!.roles.map(r => ({ id: r.id, name: r.name }));

      // Create audit log
      await this.authRepo.createAuditLog({
        user_id: userId,
        action: 'roles_assigned',
        entity_type: 'user_roles',
        entity_id: userId,
        old_value: oldRoles,
        new_value: newRoles,
        performed_by: assignedBy,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      Logger.info('Roles assigned to user', { userId, roleIds, assignedBy });
    } catch (error) {
      Logger.error('Error assigning roles', error as Error, { userId, roleIds });
      throw error;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<RoleDTO[]> {
    try {
      const roles = await this.roleRepo.findAll();
      return roles.map(role => this.toRoleDTO(role));
    } catch (error) {
      Logger.error('Error getting all roles', error as Error);
      throw error;
    }
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(id: number): Promise<(RoleDTO & { permissions: Permission[] }) | null> {
    try {
      const role = await this.roleRepo.findById(id);
      if (!role) {
        return null;
      }

      const permissions = await this.roleRepo.getRolePermissions(id);

      return {
        ...this.toRoleDTO(role),
        permissions,
      };
    } catch (error) {
      Logger.error('Error getting role by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    description: string | undefined,
    permissionIds: number[],
    createdBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RoleDTO> {
    try {
      // Check if role name already exists
      const existingRole = await this.roleRepo.findByName(name);
      if (existingRole) {
        throw new Error('Role name already exists');
      }

      // Create role
      const role = await this.roleRepo.create(name, description);

      // Assign permissions
      if (permissionIds.length > 0) {
        await this.roleRepo.assignPermissions(role.id, permissionIds);
      }

      // Create audit log
      await this.authRepo.createAuditLog({
        action: 'role_created',
        entity_type: 'role',
        entity_id: role.id,
        new_value: {
          name: role.name,
          description: role.description,
          permissions: permissionIds,
        },
        performed_by: createdBy,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      Logger.info('Role created', { roleName: name, roleId: role.id, createdBy });

      return this.toRoleDTO(role);
    } catch (error) {
      Logger.error('Error creating role', error as Error, { name });
      throw error;
    }
  }

  /**
   * Update a role
   */
  async updateRole(
    id: number,
    description: string,
    permissionIds: number[],
    updatedBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RoleDTO | null> {
    try {
      // Get old role data for audit
      const oldRole = await this.roleRepo.findById(id);
      if (!oldRole) {
        return null;
      }

      const oldPermissions = await this.roleRepo.getRolePermissions(id);

      // Update role
      const updated = await this.roleRepo.update(id, description);
      if (!updated) {
        return null;
      }

      // Update permissions
      await this.roleRepo.assignPermissions(id, permissionIds);

      // Create audit log
      await this.authRepo.createAuditLog({
        action: 'role_updated',
        entity_type: 'role',
        entity_id: id,
        old_value: {
          description: oldRole.description,
          permissions: oldPermissions.map(p => p.id),
        },
        new_value: {
          description,
          permissions: permissionIds,
        },
        performed_by: updatedBy,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      Logger.info('Role updated', { roleId: id, updatedBy });

      return this.toRoleDTO(updated);
    } catch (error) {
      Logger.error('Error updating role', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a role (only non-system roles)
   */
  async deleteRole(
    id: number,
    deletedBy: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      // Get role data for audit
      const role = await this.roleRepo.findById(id);
      if (!role) {
        return false;
      }

      if (role.is_system_role) {
        throw new Error('Cannot delete system role');
      }

      // Check if role is assigned to any users
      const userCount = await this.roleRepo.getUserCountForRole(id);
      if (userCount > 0) {
        throw new Error(`Cannot delete role: ${userCount} user(s) have this role assigned`);
      }

      // Delete role
      const deleted = await this.roleRepo.delete(id);

      if (deleted) {
        // Create audit log
        await this.authRepo.createAuditLog({
          action: 'role_deleted',
          entity_type: 'role',
          entity_id: id,
          old_value: {
            name: role.name,
            description: role.description,
          },
          performed_by: deletedBy,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        Logger.info('Role deleted', { roleId: id, deletedBy });
      }

      return deleted;
    } catch (error) {
      Logger.error('Error deleting role', error as Error, { id });
      throw error;
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<Permission[]> {
    try {
      return await this.roleRepo.getAllPermissions();
    } catch (error) {
      Logger.error('Error getting all permissions', error as Error);
      throw error;
    }
  }

  /**
   * Get audit logs for role changes
   */
  async getRoleChangeAuditLogs(
    filters?: {
      userId?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: any[]; total: number }> {
    try {
      const actions = ['role_assigned', 'roles_assigned', 'role_created', 'role_updated', 'role_deleted'];
      
      // For simplicity, we'll query for each action type
      // In production, you might want to optimize this with a single query
      const results = await Promise.all(
        actions.map(action => 
          this.authRepo.getAuditLogs({ action, ...filters })
        )
      );

      // Combine and sort results
      const allLogs = results.flatMap(r => r.logs);
      const sortedLogs = allLogs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Apply pagination
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;
      const paginatedLogs = sortedLogs.slice(offset, offset + limit);

      return {
        logs: paginatedLogs,
        total: sortedLogs.length,
      };
    } catch (error) {
      Logger.error('Error getting role change audit logs', error as Error);
      throw error;
    }
  }

  /**
   * Convert UserWithRoles to UserDTO (remove sensitive data)
   */
  private toUserDTO(user: UserWithRoles): UserDTO {
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      roles: user.roles.map(r => this.toRoleDTO(r)),
    };
  }

  /**
   * Convert Role to RoleDTO
   */
  private toRoleDTO(role: Role): RoleDTO {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      is_system_role: role.is_system_role,
    };
  }
}

