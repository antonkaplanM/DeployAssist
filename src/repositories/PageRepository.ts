/**
 * Page Repository
 * Handles all database operations related to pages and role-page assignments
 */

import { Pool } from 'pg';
import { Page, PageDTO } from '../types/auth.types';
import { Logger } from '../utils/logger';

export class PageRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Find page by ID
   */
  async findById(id: number): Promise<Page | null> {
    try {
      const query = `SELECT * FROM pages WHERE id = $1`;
      const result = await this.pool.query(query, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error finding page by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Find page by name
   */
  async findByName(name: string): Promise<Page | null> {
    try {
      const query = `SELECT * FROM pages WHERE name = $1`;
      const result = await this.pool.query(query, [name]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error finding page by name', error as Error, { name });
      throw error;
    }
  }

  /**
   * Get all pages (flat list)
   */
  async findAll(): Promise<Page[]> {
    try {
      const query = `
        SELECT * FROM pages
        ORDER BY sort_order ASC, display_name ASC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Error finding all pages', error as Error);
      throw error;
    }
  }

  /**
   * Get all pages with hierarchical structure
   */
  async findAllHierarchical(): Promise<PageDTO[]> {
    try {
      const pages = await this.findAll();
      return this.buildPageHierarchy(pages);
    } catch (error) {
      Logger.error('Error finding pages hierarchically', error as Error);
      throw error;
    }
  }

  /**
   * Get top-level pages (no parent)
   */
  async findTopLevel(): Promise<Page[]> {
    try {
      const query = `
        SELECT * FROM pages
        WHERE parent_page_id IS NULL
        ORDER BY sort_order ASC, display_name ASC
      `;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      Logger.error('Error finding top-level pages', error as Error);
      throw error;
    }
  }

  /**
   * Get child pages for a parent
   */
  async findChildren(parentId: number): Promise<Page[]> {
    try {
      const query = `
        SELECT * FROM pages
        WHERE parent_page_id = $1
        ORDER BY sort_order ASC, display_name ASC
      `;
      const result = await this.pool.query(query, [parentId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error finding child pages', error as Error, { parentId });
      throw error;
    }
  }

  /**
   * Create a new page
   */
  async create(data: {
    name: string;
    display_name: string;
    description?: string;
    parent_page_id?: number;
    route?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<Page> {
    try {
      const query = `
        INSERT INTO pages (
          name, display_name, description, parent_page_id, 
          route, icon, sort_order, is_system_page
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
        RETURNING *
      `;

      const values = [
        data.name,
        data.display_name,
        data.description || null,
        data.parent_page_id || null,
        data.route || null,
        data.icon || null,
        data.sort_order || 0,
      ];

      const result = await this.pool.query(query, values);
      Logger.info('Page created', { name: data.name, id: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating page', error as Error, { name: data.name });
      throw error;
    }
  }

  /**
   * Update a page
   */
  async update(
    id: number,
    data: {
      display_name?: string;
      description?: string;
      route?: string;
      icon?: string;
      sort_order?: number;
    }
  ): Promise<Page | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.display_name !== undefined) {
        updates.push(`display_name = $${paramCount}`);
        values.push(data.display_name);
        paramCount++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramCount}`);
        values.push(data.description);
        paramCount++;
      }

      if (data.route !== undefined) {
        updates.push(`route = $${paramCount}`);
        values.push(data.route);
        paramCount++;
      }

      if (data.icon !== undefined) {
        updates.push(`icon = $${paramCount}`);
        values.push(data.icon);
        paramCount++;
      }

      if (data.sort_order !== undefined) {
        updates.push(`sort_order = $${paramCount}`);
        values.push(data.sort_order);
        paramCount++;
      }

      if (updates.length === 0) {
        return this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE pages
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND is_system_page = FALSE
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      Logger.info('Page updated', { id });
      return result.rows[0];
    } catch (error) {
      Logger.error('Error updating page', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete a page (only non-system pages)
   */
  async delete(id: number): Promise<boolean> {
    try {
      const query = `DELETE FROM pages WHERE id = $1 AND is_system_page = FALSE`;
      const result = await this.pool.query(query, [id]);
      Logger.info('Page deleted', { id });
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      Logger.error('Error deleting page', error as Error, { id });
      throw error;
    }
  }

  /**
   * Get pages accessible to a role
   */
  async getRolePages(roleId: number): Promise<Page[]> {
    try {
      const query = `
        SELECT p.*
        FROM pages p
        INNER JOIN role_pages rp ON p.id = rp.page_id
        WHERE rp.role_id = $1
        ORDER BY p.sort_order, p.display_name
      `;
      const result = await this.pool.query(query, [roleId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error getting role pages', error as Error, { roleId });
      throw error;
    }
  }

  /**
   * Get pages accessible to a user (combines all their roles using OR logic)
   */
  async getUserPages(userId: number): Promise<Page[]> {
    try {
      const query = `
        SELECT DISTINCT p.*
        FROM pages p
        INNER JOIN role_pages rp ON p.id = rp.page_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY p.sort_order, p.display_name
      `;
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      Logger.error('Error getting user pages', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get pages accessible to a user with hierarchical structure
   */
  async getUserPagesHierarchical(userId: number): Promise<PageDTO[]> {
    try {
      const pages = await this.getUserPages(userId);
      return this.buildPageHierarchy(pages);
    } catch (error) {
      Logger.error('Error getting user pages hierarchically', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Check if user has access to a specific page
   */
  async checkUserAccess(userId: number, pageName: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM pages p
          INNER JOIN role_pages rp ON p.id = rp.page_id
          INNER JOIN user_roles ur ON rp.role_id = ur.role_id
          WHERE ur.user_id = $1 AND p.name = $2
        ) as has_access
      `;
      const result = await this.pool.query(query, [userId, pageName]);
      return result.rows[0].has_access;
    } catch (error) {
      Logger.error('Error checking user page access', error as Error, { userId, pageName });
      throw error;
    }
  }

  /**
   * Assign pages to a role (replaces existing assignments)
   */
  async assignPagesToRole(roleId: number, pageIds: number[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing page assignments
      await client.query('DELETE FROM role_pages WHERE role_id = $1', [roleId]);

      // Insert new page assignments
      if (pageIds.length > 0) {
        const values = pageIds
          .map((pageId, index) => `($1, $${index + 2})`)
          .join(', ');

        const query = `
          INSERT INTO role_pages (role_id, page_id)
          VALUES ${values}
        `;

        await client.query(query, [roleId, ...pageIds]);
      }

      await client.query('COMMIT');
      Logger.info('Role pages assigned', { roleId, pageIds });
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error assigning pages to role', error as Error, { roleId, pageIds });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Build hierarchical page structure from flat list
   */
  private buildPageHierarchy(pages: Page[]): PageDTO[] {
    const pageMap = new Map<number, PageDTO>();
    const rootPages: PageDTO[] = [];

    // Convert all pages to DTOs and create a map
    pages.forEach((page) => {
      pageMap.set(page.id, {
        ...page,
        children: [],
      });
    });

    // Build hierarchy
    pages.forEach((page) => {
      const pageDto = pageMap.get(page.id)!;
      
      if (page.parent_page_id === null) {
        rootPages.push(pageDto);
      } else {
        const parent = pageMap.get(page.parent_page_id);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(pageDto);
        }
      }
    });

    return rootPages;
  }

  /**
   * Get roles count for a page
   */
  async getRoleCountForPage(pageId: number): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM role_pages
        WHERE page_id = $1
      `;
      const result = await this.pool.query(query, [pageId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      Logger.error('Error getting role count for page', error as Error, { pageId });
      throw error;
    }
  }
}

