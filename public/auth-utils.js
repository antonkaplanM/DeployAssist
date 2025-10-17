/**
 * Authentication Utilities
 * Include this in your existing pages to add authentication
 */

const AuthUtils = {
    /**
     * Check if user is authenticated and redirect to login if not
     * Returns user data if authenticated
     */
    async requireAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                // Not authenticated, redirect to login
                window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
                return null;
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/login.html';
            return null;
        }
    },

    /**
     * Check if user is authenticated (optional - doesn't redirect)
     * Returns user data or null
     */
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            return null;
        }
    },

    /**
     * Check if current user has admin role
     */
    isAdmin(user) {
        if (!user || !user.roles) return false;
        return user.roles.some(role => role.name === 'admin');
    },

    /**
     * Check if current user has specific role
     */
    hasRole(user, roleName) {
        if (!user || !user.roles) return false;
        return user.roles.some(role => role.name === roleName);
    },

    /**
     * Check if current user has access to a specific page
     */
    async hasPageAccess(pageName) {
        try {
            const response = await fetch('/api/users/me/pages', {
                credentials: 'include'
            });

            if (!response.ok) return false;

            const data = await response.json();
            const pages = data.pages || [];
            
            return pages.some(page => page.name === pageName);
        } catch (error) {
            console.error('Page access check failed:', error);
            return false;
        }
    },

    /**
     * Get all pages accessible to current user
     */
    async getUserPages() {
        try {
            const response = await fetch('/api/users/me/pages', {
                credentials: 'include'
            });

            if (!response.ok) return [];

            const data = await response.json();
            return data.pages || [];
        } catch (error) {
            console.error('Failed to get user pages:', error);
            return [];
        }
    },

    /**
     * Check page access and redirect if denied
     */
    async requirePageAccess(pageName, redirectUrl = '/') {
        const hasAccess = await this.hasPageAccess(pageName);
        
        if (!hasAccess) {
            alert('Access denied. You do not have permission to access this page.');
            window.location.href = redirectUrl;
            return false;
        }
        
        return true;
    },

    /**
     * Build hierarchical page structure from flat list
     */
    buildPageHierarchy(pages) {
        const pageMap = new Map();
        const rootPages = [];

        // Create map
        pages.forEach(page => {
            pageMap.set(page.id, { ...page, children: [] });
        });

        // Build hierarchy
        pages.forEach(page => {
            const pageNode = pageMap.get(page.id);
            
            if (page.parent_page_id === null) {
                rootPages.push(pageNode);
            } else {
                const parent = pageMap.get(page.parent_page_id);
                if (parent) {
                    parent.children.push(pageNode);
                }
            }
        });

        return rootPages;
    },

    /**
     * Apply page-based visibility to navigation elements
     */
    async applyPageBasedVisibility() {
        const userPages = await this.getUserPages();
        const pageNames = userPages.map(p => p.name);

        // Hide navigation items based on page access
        document.querySelectorAll('[data-page-access]').forEach(element => {
            const requiredPage = element.getAttribute('data-page-access');
            const hasAccess = pageNames.includes(requiredPage);
            element.style.display = hasAccess ? '' : 'none';
        });

        // Hide sections or content based on page access
        document.querySelectorAll('[data-page-required]').forEach(element => {
            const requiredPage = element.getAttribute('data-page-required');
            const hasAccess = pageNames.includes(requiredPage);
            
            if (!hasAccess) {
                element.remove(); // Remove from DOM entirely
            }
        });

        return userPages;
    },

    /**
     * Show/hide elements based on role
     */
    applyRoleBasedVisibility(user) {
        // Hide admin-only elements if not admin
        const adminElements = document.querySelectorAll('[data-role="admin"]');
        const isAdmin = this.isAdmin(user);

        adminElements.forEach(element => {
            element.style.display = isAdmin ? '' : 'none';
        });

        // Show user info if element exists
        const userNameElements = document.querySelectorAll('[data-user-name]');
        userNameElements.forEach(element => {
            element.textContent = user.full_name || user.username;
        });

        const userUsernameElements = document.querySelectorAll('[data-user-username]');
        userUsernameElements.forEach(element => {
            element.textContent = user.username;
        });
    },

    /**
     * Logout user
     */
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            // Redirect anyway
            window.location.href = '/login.html';
        }
    },

    /**
     * Display user info in a navbar or header
     */
    renderUserInfo(user, containerId = 'userInfo') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const isAdmin = this.isAdmin(user);
        const roleLabel = isAdmin ? 
            '<span class="badge badge-admin">Admin</span>' : 
            '<span class="badge badge-user">User</span>';

        container.innerHTML = `
            <div class="user-info-container">
                <div class="user-details">
                    <span class="user-name">${user.full_name}</span>
                    ${roleLabel}
                </div>
                <button onclick="AuthUtils.logout()" class="btn-logout" title="Logout">
                    Logout
                </button>
            </div>
        `;
    },

    /**
     * Handle unauthorized responses
     */
    handleUnauthorized(response) {
        if (response.status === 401) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return true;
        }
        if (response.status === 403) {
            alert('Access denied. You do not have permission to perform this action.');
            return true;
        }
        return false;
    }
};

// Add simple styles for user info (can be customized)
if (!document.getElementById('auth-utils-styles')) {
    const style = document.createElement('style');
    style.id = 'auth-utils-styles';
    style.textContent = `
        .user-info-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .user-details {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .user-name {
            font-weight: 500;
            color: #333;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-admin {
            background: #667eea;
            color: white;
        }
        .badge-user {
            background: #48bb78;
            color: white;
        }
        .btn-logout {
            padding: 6px 16px;
            background: #e53e3e;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn-logout:hover {
            background: #c53030;
        }
    `;
    document.head.appendChild(style);
}

