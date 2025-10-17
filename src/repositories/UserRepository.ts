/**
 * User Repository
 * Handles all database operations related to users
 */

import { Pool } from 'pg';
import {
  User,
  UserWithRoles,
  CreateUserData,
  UpdateUserData,
  Role,
  Permission,
} from '../types/auth.types';
import { Logger } from '../utils/logger';

export class UserRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserWithRoles | null> {
    try {
      const query = `
        SELECT 
          u.id, u.username, u.password_hash, u.full_name, u.is_active,
          u.last_login_at, u.password_changed_at, u.failed_login_attempts,
          u.locked_until, u.created_at, u.updated_at, u.created_by,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'name', r.name,
                'description', r.description,
                'is_system_role', r.is_system_role
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.username = $1
        GROUP BY u.id
      `;

      const result = await this.pool.query(query, [username]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToUserWithRoles(row);
    } catch (error) {
      Logger.error('Error finding user by username', error as Error, { username });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<UserWithRoles | null> {
    try {
      const query = `
        SELECT 
          u.id, u.username, u.password_hash, u.full_name, u.is_active,
          u.last_login_at, u.password_changed_at, u.failed_login_attempts,
          u.locked_until, u.created_at, u.updated_at, u.created_by,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'name', r.name,
                'description', r.description,
                'is_system_role', r.is_system_role
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToUserWithRoles(row);
    } catch (error) {
      Logger.error('Error finding user by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Get all users with their roles
   */
  async findAll(): Promise<UserWithRoles[]> {
    try {
      const query = `
        SELECT 
          u.id, u.username, u.password_hash, u.full_name, u.is_active,
          u.last_login_at, u.password_changed_at, u.failed_login_attempts,
          u.locked_until, u.created_at, u.updated_at, u.created_by,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'name', r.name,
                'description', r.description,
                'is_system_role', r.is_system_role
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id
        ORDER BY u.username ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRowToUserWithRoles(row));
    } catch (error) {
      Logger.error('Error finding all users', error as Error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async create(userData: CreateUserData, passwordHash: string): Promise<User> {
    try {
      const query = `
        INSERT INTO users (username, password_hash, full_name, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const values = [
        userData.username,
        passwordHash,
        userData.full_name,
        userData.created_by || null,
      ];

      const result = await this.pool.query(query, values);
      Logger.info('User created', { username: userData.username, id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating user', error as Error, { username: userData.username });
      throw error;
    }
  }

  /**
   * Update user information
   */
  async update(id: number, userData: UpdateUserData): Promise<User | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (userData.full_name !== undefined) {
        updates.push(`full_name = $${paramCount}`);
        values.push(userData.full_name);
        paramCount++;
      }

      if (userData.is_active !== undefined) {
        updates.push(`is_active = $${paramCount}`);
        values.push(userData.is_active);
        paramCount++;
      }

      if (updates.length === 0) {
        return null;
      }

      values.push(id);
      const query = `
        UPDATE users
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      Logger.info('User updated', { id, updates: Object.keys(userData) });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error updating user', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(id: number, passwordHash: string): Promise<boolean> {
    try {
      const query = `
        UPDATE users
        SET password_hash = $1, 
            password_changed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      const result = await this.pool.query(query, [passwordHash, id]);
      Logger.info('User password updated', { id });
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      Logger.error('Error updating user password', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: number): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET last_login_at = CURRENT_TIMESTAMP,
            failed_login_attempts = 0,
            locked_until = NULL
        WHERE id = $1
      `;

      await this.pool.query(query, [id]);
    } catch (error) {
      Logger.error('Error updating last login', error as Error, { id });
      throw error;
    }
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedAttempts(id: number, lockoutDuration: number): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE 
              WHEN failed_login_attempts + 1 >= 5 
              THEN CURRENT_TIMESTAMP + INTERVAL '${lockoutDuration} seconds'
              ELSE NULL
            END
        WHERE id = $1
      `;

      await this.pool.query(query, [id]);
    } catch (error) {
      Logger.error('Error incrementing failed attempts', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM users WHERE id = $1`;
      const result = await this.pool.query(query, [id]);
      Logger.info('User deleted', { id });
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      Logger.error('Error deleting user', error as Error, { id });
      throw error;
    }
  }

  /**
   * Assign roles to a user (replaces existing roles)
   */
  async assignRoles(userId: number, roleIds: number[], assignedBy: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing role assignments
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // Insert new role assignments
      if (roleIds.length > 0) {
        const values = roleIds.map((roleId, index) => 
          `($1, $${index + 2}, $${roleIds.length + 2})`
        ).join(', ');

        const query = `
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ${values}
        `;

        await client.query(query, [userId, ...roleIds, assignedBy]);
      }

      await client.query('COMMIT');
      Logger.info('User roles assigned', { userId, roleIds, assignedBy });
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error assigning roles', error as Error, { userId, roleIds });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get permissions for a user (through their roles)
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    try {
      const query = `
        SELECT DISTINCT p.*
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY p.resource, p.action
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error getting user permissions', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: number, resource: string, action: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
          AND p.resource = $2
          AND (p.action = $3 OR p.action = 'manage')
      `;

      const result = await this.pool.query(query, [userId, resource, action]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      Logger.error('Error checking permission', error as Error, { userId, resource, action });
      throw error;
    }
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: number, roleName: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1 AND r.name = $2
      `;

      const result = await this.pool.query(query, [userId, roleName]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      Logger.error('Error checking role', error as Error, { userId, roleName });
      throw error;
    }
  }

  /**
   * Map database row to UserWithRoles object
   */
  private mapRowToUserWithRoles(row: any): UserWithRoles {
    const { password_hash, roles, ...userFields } = row;
    
    return {
      ...userFields,
      roles: Array.isArray(roles) ? roles : [],
    };
  }
}

