/**
 * Debug Configuration Service
 * Controls which console output categories are muted/unmuted
 */

class DebugConfigService {
    constructor() {
        // Default debug categories - all enabled by default
        this.categories = {
            'excel-polling': {
                name: 'Excel Polling',
                description: 'Polling status, cell reads, and request processing',
                enabled: true
            },
            'excel-lookup': {
                name: 'Excel Lookup',
                description: 'Tenant lookup, entitlement parsing, and comparison logic',
                enabled: true
            },
            'sml': {
                name: 'SML Service',
                description: 'SML API calls, token validation, and data fetching',
                enabled: true
            },
            'salesforce': {
                name: 'Salesforce',
                description: 'Salesforce API queries and PS record lookups',
                enabled: true
            },
            'database': {
                name: 'Database',
                description: 'Database queries and timing information',
                enabled: true
            },
            'auth': {
                name: 'Authentication',
                description: 'Login, session management, and token operations',
                enabled: true
            },
            'graph-api': {
                name: 'Microsoft Graph API',
                description: 'Excel file operations via Graph API',
                enabled: true
            }
        };

        // Store original console methods
        this._originalConsole = {
            log: console.log.bind(console),
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console)
        };

        // Current category context (set by services before logging)
        this._currentCategory = null;
    }

    /**
     * Get all debug categories and their status
     */
    getCategories() {
        return Object.entries(this.categories).map(([id, config]) => ({
            id,
            ...config
        }));
    }

    /**
     * Check if a category is enabled
     */
    isEnabled(categoryId) {
        return this.categories[categoryId]?.enabled ?? true;
    }

    /**
     * Enable a debug category
     */
    enable(categoryId) {
        if (this.categories[categoryId]) {
            this.categories[categoryId].enabled = true;
            this._originalConsole.log(`[Debug] Enabled category: ${categoryId}`);
            return true;
        }
        return false;
    }

    /**
     * Disable (mute) a debug category
     */
    disable(categoryId) {
        if (this.categories[categoryId]) {
            this.categories[categoryId].enabled = false;
            this._originalConsole.log(`[Debug] Disabled category: ${categoryId}`);
            return true;
        }
        return false;
    }

    /**
     * Toggle a debug category
     */
    toggle(categoryId) {
        if (this.categories[categoryId]) {
            this.categories[categoryId].enabled = !this.categories[categoryId].enabled;
            this._originalConsole.log(`[Debug] Toggled category ${categoryId}: ${this.categories[categoryId].enabled ? 'enabled' : 'disabled'}`);
            return this.categories[categoryId].enabled;
        }
        return null;
    }

    /**
     * Set multiple categories at once
     */
    setCategories(updates) {
        for (const [categoryId, enabled] of Object.entries(updates)) {
            if (this.categories[categoryId]) {
                this.categories[categoryId].enabled = enabled;
            }
        }
        return this.getCategories();
    }

    /**
     * Enable all categories
     */
    enableAll() {
        for (const categoryId of Object.keys(this.categories)) {
            this.categories[categoryId].enabled = true;
        }
        this._originalConsole.log('[Debug] Enabled all categories');
        return this.getCategories();
    }

    /**
     * Disable all categories
     */
    disableAll() {
        for (const categoryId of Object.keys(this.categories)) {
            this.categories[categoryId].enabled = false;
        }
        this._originalConsole.log('[Debug] Disabled all categories');
        return this.getCategories();
    }

    /**
     * Create a logger for a specific category
     * Usage: const log = debugConfig.logger('excel-polling');
     *        log('Message here');
     */
    logger(categoryId) {
        return (...args) => {
            if (this.isEnabled(categoryId)) {
                this._originalConsole.log(...args);
            }
        };
    }

    /**
     * Log a message if the category is enabled
     */
    log(categoryId, ...args) {
        if (this.isEnabled(categoryId)) {
            this._originalConsole.log(...args);
        }
    }

    /**
     * Get status summary
     */
    getStatus() {
        const enabled = Object.values(this.categories).filter(c => c.enabled).length;
        const total = Object.keys(this.categories).length;
        return {
            enabledCount: enabled,
            totalCount: total,
            allEnabled: enabled === total,
            allDisabled: enabled === 0,
            categories: this.getCategories()
        };
    }
}

// Singleton instance
const debugConfigService = new DebugConfigService();

module.exports = debugConfigService;
