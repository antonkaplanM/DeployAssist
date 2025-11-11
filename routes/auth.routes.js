/**
 * Authentication Routes (JavaScript)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
});

function createAuthRoutes(authService, authenticate) {
    const router = express.Router();

    /**
     * POST /api/auth/login
     */
    router.post('/login', loginLimiter, async (req, res) => {
        try {
            const { username, password, rememberMe } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Username and password are required'
                });
            }

            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('user-agent');

            const result = await authService.login(username, password, rememberMe || false, ipAddress, userAgent);

            // Set HTTP-only cookies
            res.cookie('accessToken', result.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            if (result.refreshToken) {
                res.cookie('refreshToken', result.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    full_name: result.user.full_name,
                    roles: result.user.roles,
                    last_login_at: result.user.last_login_at
                }
            });
        } catch (error) {
            console.error('Login error:', error);

            let statusCode = 500;
            let message = 'Login failed';
            let code = 'LOGIN_ERROR';

            if (error.message === 'INVALID_CREDENTIALS') {
                statusCode = 401;
                message = 'Invalid username or password';
                code = 'INVALID_CREDENTIALS';
            } else if (error.message.startsWith('USER_LOCKED:')) {
                statusCode = 423;
                message = 'Account is locked. Please try again later.';
                code = 'USER_LOCKED';
            }

            res.status(statusCode).json({
                success: false,
                error: message,
                code
            });
        }
    });

    /**
     * POST /api/auth/logout
     */
    router.post('/logout', authenticate, async (req, res) => {
        try {
            if (req.sessionId) {
                await authService.logout(req.sessionId);
            }

            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            res.json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Logout failed'
            });
        }
    });

    /**
     * GET /api/auth/me
     */
    router.get('/me', authenticate, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
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
                    roles: req.user.roles
                }
            });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user info'
            });
        }
    });

    /**
     * POST /api/auth/change-password
     */
    router.post('/change-password', authenticate, async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authenticated'
                });
            }

            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password and new password are required'
                });
            }

            await authService.changePassword(req.user.id, currentPassword, newPassword);

            // Clear cookies to force re-login
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            res.json({
                success: true,
                message: 'Password changed successfully. Please log in again.'
            });
        } catch (error) {
            console.error('Change password error:', error);

            const statusCode = error.message === 'INVALID_CREDENTIALS' ? 401 : 400;

            res.status(statusCode).json({
                success: false,
                error: error.message || 'Password change failed'
            });
        }
    });

    return router;
}

module.exports = createAuthRoutes;

