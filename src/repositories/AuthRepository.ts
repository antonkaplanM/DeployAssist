/**
 * Auth Repository
 * Handles authentication-specific database operations (sessions, tokens, audit logs)
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import {
  RefreshToken,
  SessionActivity,
  AuthAuditLog,
  CreateAuditLogData,
} from '../types/auth.types';
import { Logger } from '../utils/logger';

export class AuthRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Create or update session activity
   */
  async upsertSession(
    userId: number,
    sessionTokenHash: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SessionActivity> {
    try {
      const query = `
        INSERT INTO session_activity (
          user_id, session_token_hash, last_activity_at, expires_at, 
          ip_address, user_agent
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
        ON CONFLICT (session_token_hash) 
        DO UPDATE SET 
          last_activity_at = CURRENT_TIMESTAMP,
          expires_at = EXCLUDED.expires_at
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        userId,
        sessionTokenHash,
        expiresAt,
        ipAddress || null,
        userAgent || null,
      ]);

      return result.rows[0];
    } catch (error) {
      Logger.error('Error upserting session', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get session by token hash
   */
  async getSession(sessionTokenHash: string): Promise<SessionActivity | null> {
    try {
      const query = `
        SELECT * FROM session_activity
        WHERE session_token_hash = $1
      `;

      const result = await this.pool.query(query, [sessionTokenHash]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error getting session', error as Error);
      throw error;
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionTokenHash: string): Promise<void> {
    try {
      const query = `
        UPDATE session_activity
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE session_token_hash = $1
      `;

      await this.pool.query(query, [sessionTokenHash]);
    } catch (error) {
      Logger.error('Error updating session activity', error as Error);
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionTokenHash: string): Promise<void> {
    try {
      const query = `DELETE FROM session_activity WHERE session_token_hash = $1`;
      await this.pool.query(query, [sessionTokenHash]);
    } catch (error) {
      Logger.error('Error deleting session', error as Error);
      throw error;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: number): Promise<void> {
    try {
      const query = `DELETE FROM session_activity WHERE user_id = $1`;
      await this.pool.query(query, [userId]);
      Logger.info('All user sessions deleted', { userId });
    } catch (error) {
      Logger.error('Error deleting user sessions', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const query = `
        DELETE FROM session_activity
        WHERE expires_at < CURRENT_TIMESTAMP
      `;

      const result = await this.pool.query(query);
      const count = result.rowCount || 0;
      
      if (count > 0) {
        Logger.info('Expired sessions cleaned up', { count });
      }
      
      return count;
    } catch (error) {
      Logger.error('Error cleaning up expired sessions', error as Error);
      throw error;
    }
  }

  // ===== REFRESH TOKEN MANAGEMENT =====

  /**
   * Create refresh token
   */
  async createRefreshToken(
    userId: number,
    token: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshToken> {
    try {
      const tokenHash = this.hashToken(token);

      const query = `
        INSERT INTO refresh_tokens (
          user_id, token_hash, expires_at, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        userId,
        tokenHash,
        expiresAt,
        ipAddress || null,
        userAgent || null,
      ]);

      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating refresh token', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get refresh token by token string
   */
  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    try {
      const tokenHash = this.hashToken(token);

      const query = `
        SELECT * FROM refresh_tokens
        WHERE token_hash = $1
          AND is_revoked = FALSE
          AND expires_at > CURRENT_TIMESTAMP
      `;

      const result = await this.pool.query(query, [tokenHash]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.error('Error getting refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Update refresh token last used timestamp
   */
  async updateRefreshTokenLastUsed(token: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);

      const query = `
        UPDATE refresh_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1
      `;

      await this.pool.query(query, [tokenHash]);
    } catch (error) {
      Logger.error('Error updating refresh token last used', error as Error);
      throw error;
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);

      const query = `
        UPDATE refresh_tokens
        SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = $1
      `;

      await this.pool.query(query, [tokenHash]);
    } catch (error) {
      Logger.error('Error revoking refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeUserRefreshTokens(userId: number): Promise<void> {
    try {
      const query = `
        UPDATE refresh_tokens
        SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_revoked = FALSE
      `;

      await this.pool.query(query, [userId]);
      Logger.info('All user refresh tokens revoked', { userId });
    } catch (error) {
      Logger.error('Error revoking user refresh tokens', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    try {
      const query = `
        DELETE FROM refresh_tokens
        WHERE expires_at < CURRENT_TIMESTAMP OR is_revoked = TRUE
      `;

      const result = await this.pool.query(query);
      const count = result.rowCount || 0;
      
      if (count > 0) {
        Logger.info('Expired refresh tokens cleaned up', { count });
      }
      
      return count;
    } catch (error) {
      Logger.error('Error cleaning up expired refresh tokens', error as Error);
      throw error;
    }
  }

  // ===== AUDIT LOG =====

  /**
   * Create audit log entry
   */
  async createAuditLog(data: CreateAuditLogData): Promise<AuthAuditLog> {
    try {
      const query = `
        INSERT INTO auth_audit_log (
          user_id, action, entity_type, entity_id, old_value, new_value,
          performed_by, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        data.user_id || null,
        data.action,
        data.entity_type,
        data.entity_id || null,
        data.old_value ? JSON.stringify(data.old_value) : null,
        data.new_value ? JSON.stringify(data.new_value) : null,
        data.performed_by || null,
        data.ip_address || null,
        data.user_agent || null,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      Logger.error('Error creating audit log', error as Error, { action: data.action });
      throw error;
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters?: {
    userId?: number;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuthAuditLog[]; total: number }> {
    try {
      const conditions: string[] = ['1=1'];
      const values: any[] = [];
      let paramCount = 1;

      if (filters?.userId) {
        conditions.push(`user_id = $${paramCount}`);
        values.push(filters.userId);
        paramCount++;
      }

      if (filters?.action) {
        conditions.push(`action = $${paramCount}`);
        values.push(filters.action);
        paramCount++;
      }

      if (filters?.entityType) {
        conditions.push(`entity_type = $${paramCount}`);
        values.push(filters.entityType);
        paramCount++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM auth_audit_log
        WHERE ${conditions.join(' AND ')}
      `;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated logs
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        SELECT * FROM auth_audit_log
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      const result = await this.pool.query(query, [...values, limit, offset]);

      return {
        logs: result.rows,
        total,
      };
    } catch (error) {
      Logger.error('Error getting audit logs', error as Error);
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Hash a token using SHA256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

