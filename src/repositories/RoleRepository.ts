/**
 * Role Repository
 * Handles all database operations related to roles and permissions
 */

import { Pool } from 'pg';
import { Role, Permission, RolePermission } from '../types/auth.types';
import { Logger } from '../utils/logger';

export class RoleRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Find role by ID
   */
  async findById(id: number): Promise<Role | null> {
    try {
      const query = `SELECT * FROM roles WHERE id = $1`;
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error finding role by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Find role by name
   */
  async findByName(name: string): Promise<Role | null> {
    try {
      const query = `SELECT * FROM roles WHERE name = $1`;
      const result = await this.pool.query(query, [name]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error finding role by name', error as Error, { name });
      throw error;
    }
  }

  /**
   * Get all roles
   */
  async findAll(): Promise<Role[]> {
    try {
      const query = `
        SELECT * FROM roles
        ORDER BY 
          CASE 
            WHEN name = 'admin' THEN 1
            WHEN name = 'user' THEN 2
            ELSE 3
          END,
          name ASC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Error finding all roles', error as Error);
      throw error;
    }
  }

  /**
   * Create a new role
   */
  async create(name: string, description?: string): Promise<Role> {
    try {
      const query = `
        INSERT INTO roles (name, description, is_system_role)
        VALUES ($1, $2, FALSE)
        RETURNING *
      `;

      const result = await this.pool.query(query, [name, description || null]);
      Logger.info('Role created', { name, id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating role', error as Error, { name });
      throw error;
    }
  }

  /**
   * Update a role
   */
  async update(id: number, description: string): Promise<Role | null> {
    try {
      const query = `
        UPDATE roles
        SET description = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND is_system_role = FALSE
        RETURNING *
      `;

      const result = await this.pool.query(query, [description, id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      Logger.info('Role updated', { id });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error updating role', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a role (only non-system roles)
   */
  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM roles WHERE id = $1 AND is_system_role = FALSE`;
      const result = await this.pool.query(query, [id]);
      Logger.info('Role deleted', { id });
      return result.rowCount ? result.rowCount > 0 : false;
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
      const query = `
        SELECT * FROM permissions
        ORDER BY resource, action
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Error getting all permissions', error as Error);
      throw error;
    }
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: number): Promise<Permission[]> {
    try {
      const query = `
        SELECT p.*
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.resource, p.action
      `;
      const result = await this.pool.query(query, [roleId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error getting role permissions', error as Error, { roleId });
      throw error;
    }
  }

  /**
   * Assign permissions to a role (replaces existing permissions)
   */
  async assignPermissions(roleId: number, permissionIds: number[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing permission assignments
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Insert new permission assignments
      if (permissionIds.length > 0) {
        const values = permissionIds.map((permissionId, index) => 
          `($1, $${index + 2})`
        ).join(', ');

        const query = `
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${values}
        `;

        await client.query(query, [roleId, ...permissionIds]);
      }

      await client.query('COMMIT');
      Logger.info('Role permissions assigned', { roleId, permissionIds });
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error assigning permissions', error as Error, { roleId, permissionIds });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get roles with their permissions
   */
  async findAllWithPermissions(): Promise<Array<Role & { permissions: Permission[] }>> {
    try {
      // Get all roles
      const roles = await this.findAll();

      // Get permissions for each role
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => {
          const permissions = await this.getRolePermissions(role.id);
          return { ...role, permissions };
        })
      );

      return rolesWithPermissions;
    } catch (error) {
      Logger.error('Error finding all roles with permissions', error as Error);
      throw error;
    }
  }

  /**
   * Get users count for a role
   */
  async getUserCountForRole(roleId: number): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM user_roles
        WHERE role_id = $1
      `;
      const result = await this.pool.query(query, [roleId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      Logger.error('Error getting user count for role', error as Error, { roleId });
      throw error;
    }
  }
}

