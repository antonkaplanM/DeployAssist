/**
 * Authentication Service (JavaScript)
 * Handles authentication logic, token management, and password operations
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Default configuration
const DEFAULT_PASSWORD_POLICY = {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false
};

const DEFAULT_SESSION_CONFIG = {
    accessTokenLifetime: 24 * 60 * 60, // 24 hours
    refreshTokenLifetime: 30 * 24 * 60 * 60, // 30 days
    inactivityTimeout: 60 * 60, // 60 minutes
    maxFailedAttempts: 5,
    lockoutDuration: 15 * 60 // 15 minutes
};

class AuthService {
    constructor(pool, jwtSecret, passwordPolicy, sessionConfig) {
        this.pool = pool;
        this.jwtSecret = jwtSecret;
        this.passwordPolicy = passwordPolicy || DEFAULT_PASSWORD_POLICY;
        this.sessionConfig = sessionConfig || DEFAULT_SESSION_CONFIG;
    }

    /**
     * Authenticate user with username and password
     */
    async login(username, password, rememberMe = false, ipAddress, userAgent) {
        try {
            // Find user with roles
            const userResult = await this.pool.query(`
                SELECT 
                    u.id, u.username, u.password_hash, u.full_name, u.is_active,
                    u.last_login_at, u.password_changed_at, u.failed_login_attempts,
                    u.locked_until, u.created_at, u.updated_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', r.id,
                                'name', r.name,
                                'description', r.description
                            )
                        ) FILTER (WHERE r.id IS NOT NULL),
                        '[]'
                    ) as roles
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                WHERE u.username = $1
                GROUP BY u.id
            `, [username]);

            if (userResult.rows.length === 0) {
                throw new Error('INVALID_CREDENTIALS');
            }

            const user = userResult.rows[0];

            // Check if user is active
            if (!user.is_active) {
                throw new Error('INVALID_CREDENTIALS');
            }

            // Check if account is locked
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                throw new Error(`USER_LOCKED:${user.locked_until}`);
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                // Increment failed attempts
                await this.pool.query(`
                    UPDATE users
                    SET failed_login_attempts = failed_login_attempts + 1,
                        locked_until = CASE 
                            WHEN failed_login_attempts + 1 >= $2 
                            THEN CURRENT_TIMESTAMP + INTERVAL '${this.sessionConfig.lockoutDuration} seconds'
                            ELSE NULL
                        END
                    WHERE id = $1
                `, [user.id, this.sessionConfig.maxFailedAttempts]);

                throw new Error('INVALID_CREDENTIALS');
            }

            // Load permissions
            const permissionsResult = await this.pool.query(`
                SELECT DISTINCT p.*
                FROM permissions p
                INNER JOIN role_permissions rp ON p.id = rp.permission_id
                INNER JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.user_id = $1
            `, [user.id]);

            user.permissions = permissionsResult.rows;

            // Update last login
            await this.pool.query(`
                UPDATE users
                SET last_login_at = CURRENT_TIMESTAMP,
                    failed_login_attempts = 0,
                    locked_until = NULL
                WHERE id = $1
            `, [user.id]);

            // Generate tokens
            const sessionId = crypto.randomBytes(32).toString('hex');
            const accessToken = this.generateAccessToken(user, sessionId);

            let refreshToken = null;
            if (rememberMe) {
                refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);
            }

            // Create session
            const sessionExpiry = new Date(Date.now() + this.sessionConfig.accessTokenLifetime * 1000);
            const sessionTokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');

            await this.pool.query(`
                INSERT INTO session_activity (user_id, session_token_hash, expires_at, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (session_token_hash) DO UPDATE SET last_activity_at = CURRENT_TIMESTAMP
            `, [user.id, sessionTokenHash, sessionExpiry, ipAddress, userAgent]);

            console.log(`✅ User logged in: ${username}`);

            return {
                success: true,
                user,
                accessToken,
                refreshToken
            };
        } catch (error) {
            console.error('Login error:', error.message);
            throw error;
        }
    }

    /**
     * Logout user (invalidate session)
     */
    async logout(sessionId) {
        const sessionTokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
        await this.pool.query('DELETE FROM session_activity WHERE session_token_hash = $1', [sessionTokenHash]);
    }

    /**
     * Verify and decode access token
     */
    async verifyAccessToken(token) {
        try {
            const payload = jwt.verify(token, this.jwtSecret);

            if (payload.type !== 'access') {
                throw new Error('Invalid token type');
            }

            // Check session
            const sessionTokenHash = crypto.createHash('sha256').update(payload.sessionId).digest('hex');
            const sessionResult = await this.pool.query(
                'SELECT * FROM session_activity WHERE session_token_hash = $1',
                [sessionTokenHash]
            );

            if (sessionResult.rows.length === 0) {
                throw new Error('TOKEN_EXPIRED');
            }

            const session = sessionResult.rows[0];

            // Check if session expired
            if (new Date(session.expires_at) < new Date()) {
                await this.pool.query('DELETE FROM session_activity WHERE session_token_hash = $1', [sessionTokenHash]);
                throw new Error('TOKEN_EXPIRED');
            }

            // Check inactivity timeout
            const inactivityThreshold = new Date(Date.now() - this.sessionConfig.inactivityTimeout * 1000);
            if (new Date(session.last_activity_at) < inactivityThreshold) {
                await this.pool.query('DELETE FROM session_activity WHERE session_token_hash = $1', [sessionTokenHash]);
                throw new Error('SESSION_INACTIVE');
            }

            // Update session activity
            await this.pool.query(
                'UPDATE session_activity SET last_activity_at = CURRENT_TIMESTAMP WHERE session_token_hash = $1',
                [sessionTokenHash]
            );

            return payload;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('TOKEN_EXPIRED');
            }
            throw error;
        }
    }

    /**
     * Change user password
     */
    async changePassword(userId, currentPassword, newPassword) {
        // Get user
        const userResult = await this.pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) {
            throw new Error('INVALID_CREDENTIALS');
        }

        // Validate new password
        const validation = this.validatePassword(newPassword);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        // Hash new password
        const passwordHash = await this.hashPassword(newPassword);

        // Update password
        await this.pool.query(
            'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, userId]
        );

        // Invalidate all sessions
        await this.pool.query('DELETE FROM session_activity WHERE user_id = $1', [userId]);
        await this.pool.query(
            'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1',
            [userId]
        );

        console.log(`✅ Password changed for user ID: ${userId}`);
    }

    /**
     * Admin change user password
     */
    async adminChangePassword(userId, newPassword) {
        const validation = this.validatePassword(newPassword);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        const passwordHash = await this.hashPassword(newPassword);
        await this.pool.query(
            'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, userId]
        );

        // Invalidate all sessions
        await this.pool.query('DELETE FROM session_activity WHERE user_id = $1', [userId]);
        await this.pool.query(
            'UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1',
            [userId]
        );
    }

    /**
     * Validate password
     */
    validatePassword(password) {
        const errors = [];

        if (password.length < this.passwordPolicy.minLength) {
            errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Hash password
     */
    async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    /**
     * Generate access token
     */
    generateAccessToken(user, sessionId) {
        const payload = {
            userId: user.id,
            username: user.username,
            roles: user.roles.map(r => r.name),
            permissions: (user.permissions || []).map(p => p.name),
            sessionId,
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.sessionConfig.accessTokenLifetime
        };

        return jwt.sign(payload, this.jwtSecret);
    }

    /**
     * Generate refresh token
     */
    async generateRefreshToken(userId, ipAddress, userAgent) {
        const tokenId = crypto.randomBytes(32).toString('hex');
        const payload = {
            userId,
            tokenId,
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.sessionConfig.refreshTokenLifetime
        };

        const token = jwt.sign(payload, this.jwtSecret);
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + this.sessionConfig.refreshTokenLifetime * 1000);

        await this.pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [userId, tokenHash, expiresAt, ipAddress, userAgent]
        );

        return token;
    }

    /**
     * Cleanup expired sessions and tokens
     */
    async cleanupExpired() {
        const sessionsDeleted = await this.pool.query('DELETE FROM session_activity WHERE expires_at < CURRENT_TIMESTAMP');
        const tokensDeleted = await this.pool.query('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP');

        console.log(`🧹 Cleanup: ${sessionsDeleted.rowCount} sessions, ${tokensDeleted.rowCount} tokens`);
    }
}

module.exports = AuthService;

