// DOM elements
const greetingText = document.getElementById('greeting-text');
const timestampElement = document.getElementById('timestamp');
const themeToggle = document.getElementById('theme-toggle');

// Validation monitoring elements
const timeFrameSelect = document.getElementById('time-frame-select');
const validationStatus = document.getElementById('validation-status');
const validationErrors = document.getElementById('validation-errors');

// PS Request Removals monitoring elements
const removalsTimeFrameSelect = document.getElementById('removals-time-frame-select');
const removalsStatus = document.getElementById('removals-status');
const removalsList = document.getElementById('removals-list');

// Expiration Monitor widget elements (dashboard widget only - NOT the full page)
const expirationWindowSelect = document.getElementById('expiration-window-select'); // Dashboard dropdown
const expirationStatus = document.getElementById('expiration-status'); // Dashboard widget status
const expirationSummary = document.getElementById('expiration-summary'); // Dashboard summary cards

// Note: Expiration Monitor PAGE uses different IDs:
// - expiration-page-window-select (dropdown)
// - expiration-page-status (status text)
// - See setupExpirationEventListeners() for page-specific elements

// Navigation elements
const navDashboard = document.getElementById('nav-dashboard');
const navAnalytics = document.getElementById('nav-analytics');
const navRoadmap = document.getElementById('nav-roadmap');
const navProvisioning = document.getElementById('nav-provisioning');
const navProvisioningMonitor = document.getElementById('nav-provisioning-monitor');
const navExpiration = document.getElementById('nav-expiration');
const navGhostAccounts = document.getElementById('nav-ghost-accounts');
const navCustomerProducts = document.getElementById('nav-customer-products');
const navHelp = document.getElementById('nav-help');
const navSettings = document.getElementById('nav-settings');
const pageDashboard = document.getElementById('page-dashboard');
const pageAnalytics = document.getElementById('page-analytics');
const pageRoadmap = document.getElementById('page-roadmap');
const pageProvisioning = document.getElementById('page-provisioning');
const pageHelp = document.getElementById('page-help');
const pageSettings = document.getElementById('page-settings');

// Current page state
let currentPage = 'dashboard';


// Roadmap data and state
let initiativesData = [];
let filteredData = [];
let sortConfig = { key: null, direction: 'asc' };

// Provisioning Monitor data and state
let provisioningData = [];
let filteredProvisioningData = [];
let provisioningSortConfig = { key: null, direction: 'asc' };
let provisioningPagination = {
    currentPage: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    isLoading: false
};
let exactMatchFilter = null; // For filtering to exact PS-ID matches from Account History

// Validation state
let validationResults = new Map(); // recordId -> validationResult
let enabledValidationRules = [];

// Type-ahead search state
let currentSearchRequest = null;
let searchDropdownVisible = false;
let currentSearchTerm = '';

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;
    
    if (savedTheme === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    
    // Add a subtle animation to the toggle button
    themeToggle.style.transform = 'rotate(180deg)';
    setTimeout(() => {
        themeToggle.style.transform = '';
    }, 300);
}

// ============================================================================
// AUTO-REFRESH MANAGEMENT
// ============================================================================

// Auto-refresh state
let autoRefreshInterval = 5; // minutes (0 = disabled)
let autoRefreshTimer = null;
let lastRefreshTimes = {}; // pageId -> timestamp

// Initialize auto-refresh settings from localStorage
function initializeAutoRefresh() {
    // Clean up old localStorage key from previous implementation
    const oldEnabled = localStorage.getItem('autoRefreshEnabled');
    if (oldEnabled !== null) {
        // Migrate old setting: if it was disabled, set interval to 0 (Never)
        if (oldEnabled === 'false') {
            localStorage.setItem('autoRefreshInterval', '0');
        }
        localStorage.removeItem('autoRefreshEnabled');
    }
    
    const savedInterval = localStorage.getItem('autoRefreshInterval');
    autoRefreshInterval = savedInterval ? parseInt(savedInterval) : 5;
    
    // Update UI elements
    const intervalSelect = document.getElementById('auto-refresh-interval');
    
    if (intervalSelect) {
        intervalSelect.value = autoRefreshInterval.toString();
    }
    
    // Start auto-refresh if interval is not 0 (Never)
    if (autoRefreshInterval > 0) {
        startAutoRefresh();
    }
}

// Start auto-refresh timer
function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing timer
    
    if (autoRefreshInterval === 0) return; // Don't start if set to "Never"
    
    const intervalMs = autoRefreshInterval * 60 * 1000; // Convert minutes to milliseconds
    
    autoRefreshTimer = setInterval(() => {
        refreshInactivePages();
    }, intervalMs);
    
    console.log(`Auto-refresh started: ${autoRefreshInterval} minute interval`);
}

// Stop auto-refresh timer
function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
        console.log('Auto-refresh stopped');
    }
}

// Refresh all inactive pages (NOT the current page)
function refreshInactivePages() {
    console.log(`Auto-refresh triggered - Current page: ${currentPage}`);
    
    // List of pages with Salesforce integration that should auto-refresh
    const dataPages = [
        'dashboard',
        'analytics', 
        'account-history',
        'provisioning',
        'expiration',
        'ghost-accounts',
        'customer-products',
        'roadmap'
    ];
    
    // Refresh all data pages EXCEPT the currently active one
    dataPages.forEach(pageId => {
        if (pageId !== currentPage) {
            console.log(`Auto-refreshing inactive page: ${pageId}`);
            
            switch (pageId) {
                case 'dashboard':
                    refreshDashboard();
                    break;
                case 'analytics':
                    refreshAnalytics();
                    break;
                case 'account-history':
                    refreshAccountHistory();
                    break;
                case 'provisioning':
                    refreshProvisioning();
                    break;
                case 'expiration':
                    refreshExpiration();
                    break;
                case 'ghost-accounts':
                    refreshGhostAccountsPage();
                    break;
                case 'customer-products':
                    refreshCustomerProducts();
                    break;
                case 'roadmap':
                    refreshRoadmap();
                    break;
            }
            
            updateLastRefreshTimestamp(pageId);
        } else {
            console.log(`Skipping auto-refresh for active page: ${pageId}`);
        }
    });
}

// Update last refresh timestamp display
function updateLastRefreshTimestamp(pageId) {
    const now = new Date();
    lastRefreshTimes[pageId] = now;
    
    const timestampElement = document.getElementById(`${pageId}-last-refresh`);
    if (timestampElement) {
        timestampElement.textContent = formatTimestamp(now);
    }
}

// Format timestamp for display
function formatTimestamp(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins === 1) {
        return '1 minute ago';
    } else if (diffMins < 60) {
        return `${diffMins} minutes ago`;
    } else {
        const hours = Math.floor(diffMins / 60);
        if (hours === 1) {
            return '1 hour ago';
        } else {
            return `${hours} hours ago`;
        }
    }
}

// Page-specific refresh functions
function refreshDashboard() {
    console.log('Refreshing Dashboard...');
    // Refresh validation monitor
    if (typeof fetchValidationErrors === 'function') {
        fetchValidationErrors();
    }
    // Refresh removals monitor
    if (typeof fetchPSRemovals === 'function') {
        fetchPSRemovals();
    }
    // Refresh expiration monitor widget
    if (typeof fetchExpirationWidget === 'function') {
        fetchExpirationWidget();
    }
}

function refreshAnalytics() {
    console.log('Refreshing Analytics...');
    // Reload analytics data
    if (typeof loadAnalyticsData === 'function') {
        loadAnalyticsData();
    }
}

function refreshAccountHistory() {
    console.log('Refreshing Account History...');
    // Only refresh if there's an active search
    const accountInput = document.getElementById('account-search-input');
    if (accountInput && accountInput.value.trim()) {
        if (typeof searchAccountHistory === 'function') {
            searchAccountHistory();
        }
    }
}

function refreshProvisioning() {
    console.log('Refreshing Provisioning Monitor...');
    // Reload provisioning data
    if (typeof loadProvisioningRequests === 'function') {
        loadProvisioningRequests();
    }
}

function refreshExpiration() {
    console.log('Refreshing Expiration Monitor...');
    // Reload expiration data
    if (typeof loadExpirationData === 'function') {
        loadExpirationData();
    }
}

function refreshGhostAccountsPage() {
    console.log('Refreshing Ghost Accounts...');
    // Reload ghost accounts data
    if (typeof loadGhostAccountsData === 'function') {
        loadGhostAccountsData();
    }
}

function refreshCustomerProducts() {
    console.log('Refreshing Customer Products...');
    // Only refresh if there's an active search
    const customerInput = document.getElementById('customer-search-input');
    if (customerInput && customerInput.value.trim()) {
        if (typeof searchCustomerProducts === 'function') {
            searchCustomerProducts();
        }
    }
}

function refreshRoadmap() {
    console.log('Refreshing Roadmap...');
    // Reload roadmap data
    const assigneeInput = document.getElementById('assignee-input');
    if (assigneeInput && assigneeInput.value.trim()) {
        if (typeof loadJiraInitiatives === 'function') {
            loadJiraInitiatives(assigneeInput.value.trim());
        }
    }
}

// Handle auto-refresh interval change
function handleAutoRefreshIntervalChange(event) {
    autoRefreshInterval = parseInt(event.target.value);
    localStorage.setItem('autoRefreshInterval', autoRefreshInterval.toString());
    
    if (autoRefreshInterval === 0) {
        // User selected "Never" - disable auto-refresh
        stopAutoRefresh();
        console.log('Auto-refresh disabled (Never)');
    } else {
        // User selected a time interval - start/restart auto-refresh
        startAutoRefresh();
        console.log(`Auto-refresh interval changed to ${autoRefreshInterval} minutes`);
    }
}

// Navigation and routing
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('page-enter');
    });
    
    // Show selected page with animation
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('page-enter');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            targetPage.classList.remove('page-enter');
        }, 300);
    }
    
    // Update navigation active states
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        item.classList.remove('bg-accent', 'text-accent-foreground');
    });
    
    // Add active state to current nav item
    const activeNav = document.getElementById(`nav-${pageId}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.classList.add('bg-accent', 'text-accent-foreground');
    }
    
    currentPage = pageId;
    
    // Save current page to localStorage
    localStorage.setItem('currentPage', pageId);
    
    // Handle sub-navigation visibility
    const provisioningSubnav = document.getElementById('provisioning-subnav');
    if (pageId === 'provisioning' || pageId === 'expiration' || pageId === 'ghost-accounts') {
        if (provisioningSubnav) {
            provisioningSubnav.classList.remove('hidden');
        }
    } else {
        if (provisioningSubnav) {
            provisioningSubnav.classList.add('hidden');
        }
    }
    
    // Update sub-navigation active states
    const subNavItems = document.querySelectorAll('.sub-nav-item');
    subNavItems.forEach(item => {
        item.classList.remove('active');
        item.classList.remove('bg-accent', 'text-accent-foreground');
        item.classList.add('text-muted-foreground');
    });
    
    // Handle sub-navigation for provisioning pages
    if (pageId === 'provisioning') {
        const provisioningMonitorNav = document.getElementById('nav-provisioning-monitor');
        if (provisioningMonitorNav) {
            provisioningMonitorNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            provisioningMonitorNav.classList.remove('text-muted-foreground');
        }
    } else if (pageId === 'expiration') {
        const expirationNav = document.getElementById('nav-expiration');
        if (expirationNav) {
            expirationNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            expirationNav.classList.remove('text-muted-foreground');
        }
    } else if (pageId === 'customer-products') {
        const customerProductsNav = document.getElementById('nav-customer-products');
        if (customerProductsNav) {
            customerProductsNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            customerProductsNav.classList.remove('text-muted-foreground');
        }
    }
    
    // Trigger page-specific initialization
    if (pageId === 'analytics') {
        initializeAnalytics();
    } else if (pageId === 'landing') {
        // Refocus on input field if returning to landing page
        setTimeout(() => {
            // Focus on time frame selector if available
            if (timeFrameSelect) {
                timeFrameSelect.focus();
            }
        }, 100);
    } else if (pageId === 'provisioning') {
        clearProvisioningNotificationBadge();
        initializeProvisioning();
    } else if (pageId === 'expiration') {
        initializeExpiration();
    } else if (pageId === 'customer-products') {
        initializeCustomerProducts();
    } else if (pageId === 'roadmap') {
        initializeRoadmap();
    } else if (pageId === 'settings') {
        initializeSettings();
    }
}

// Handle analytics main navigation (toggle sub-navigation)
function handleAnalyticsNavigation(event) {
    event.preventDefault();
    
    const analyticsSubnav = document.getElementById('analytics-subnav');
    if (analyticsSubnav) {
        const isHidden = analyticsSubnav.classList.contains('hidden');
        if (isHidden) {
            // Show sub-navigation and navigate to analytics overview
            analyticsSubnav.classList.remove('hidden');
            showPage('analytics');
        } else {
            // If already visible, always navigate to analytics overview (don't collapse)
            showPage('analytics');
        }
    } else {
        // Fallback to regular navigation
        showPage('analytics');
    }
}

// Handle provisioning main navigation (toggle sub-navigation)
function handleProvisioningNavigation(event) {
    event.preventDefault();
    
    const provisioningSubnav = document.getElementById('provisioning-subnav');
    if (provisioningSubnav) {
        const isHidden = provisioningSubnav.classList.contains('hidden');
        if (isHidden) {
            // Show sub-navigation and navigate to provisioning monitor
            provisioningSubnav.classList.remove('hidden');
            showPage('provisioning');
        } else {
            // If already visible, always navigate to provisioning monitor (don't collapse)
            showPage('provisioning');
        }
    } else {
        // Fallback to regular navigation
        showPage('provisioning');
    }
}

// Navigation handler for regular navigation items
function handleNavigation(event) {
    event.preventDefault();
    
    // Get the target page from the button ID
    const targetPage = event.currentTarget;
    if (!targetPage) return;
    
    let pageId = targetPage.id.replace('nav-', '');
    
    // Handle special mappings for sub-navigation items
    if (pageId === 'analytics-overview') {
        pageId = 'analytics';
        // Make sure analytics sub-navigation is visible
        const analyticsSubnav = document.getElementById('analytics-subnav');
        if (analyticsSubnav) {
            analyticsSubnav.classList.remove('hidden');
        }
    } else if (pageId === 'provisioning-monitor') {
        pageId = 'provisioning';
        // Make sure sub-navigation is visible when navigating to monitor
        const provisioningSubnav = document.getElementById('provisioning-subnav');
        if (provisioningSubnav) {
            provisioningSubnav.classList.remove('hidden');
        }
    } else if (pageId === 'account-history') {
        // Make sure analytics sub-navigation is visible for Account History
        const analyticsSubnav = document.getElementById('analytics-subnav');
        if (analyticsSubnav) {
            analyticsSubnav.classList.remove('hidden');
        }
    }
    
    showPage(pageId);
    
    // Add click effect
    targetPage.style.transform = 'scale(0.95)';
    setTimeout(() => {
        targetPage.style.transform = '';
    }, 150);
}

function initializeAnalytics() {
    // Analytics page initialization
    console.log('Analytics page initialized');
    
    // Load analytics data for Technical Team Requests by type
    loadAnalyticsData();
    
    // Load validation failure trend chart
    loadValidationTrendChart();
}

// Load analytics data for Technical Team Requests by type
async function loadAnalyticsData() {
    try {
        // Update timestamp when starting to load
        updateLastRefreshTimestamp('analytics');
        
        // Get enabled rules from localStorage (same as validation monitoring)
        let enabledRuleIds = [];
        try {
            const validationConfig = localStorage.getItem('deploymentAssistant_validationRules');
            if (validationConfig) {
                const config = JSON.parse(validationConfig);
                enabledRuleIds = Object.keys(config.enabledRules || {}).filter(ruleId => 
                    config.enabledRules[ruleId] === true
                );
            }
            
            // If no config found, use default enabled rules
            if (enabledRuleIds.length === 0) {
                enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
            }
            
            console.log(`📋 Analytics using enabled validation rules: ${enabledRuleIds.join(', ')}`);
        } catch (error) {
            console.warn('⚠️ Error loading validation config for analytics, using default rules:', error);
            enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
        }
        
        const response = await fetch(`/api/analytics/request-types-week?enabledRules=${encodeURIComponent(JSON.stringify(enabledRuleIds))}`);
        const data = await response.json();
        
        if (data.success) {
            renderRequestTypeTiles(data.data);
            updateAnalyticsPeriod(data.period);
        } else {
            console.error('Failed to load analytics data:', data.error);
            showAnalyticsError();
        }
    } catch (error) {
        console.error('Error loading analytics data:', error);
        showAnalyticsError();
    }
}

// Render request type tiles with data
function renderRequestTypeTiles(analyticsData) {
    const container = document.getElementById('request-type-tiles');
    if (!container) return;
    
    if (analyticsData.length === 0) {
        container.innerHTML = `
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6 col-span-full">
                <div class="text-center">
                    <div class="text-muted-foreground text-sm">No Technical Team Requests found in the last year</div>
                </div>
            </div>
        `;
        return;
    }
    
    // Map request types to specific colors matching trend lines
    const requestTypeColors = {
        'Update': 'bg-red-100 text-red-800',
        'Onboarding': 'bg-blue-100 text-blue-800',
        'Deprovision': 'bg-green-100 text-green-800',
        // Fallback colors for other request types
        'default': [
            'bg-purple-100 text-purple-800',
            'bg-orange-100 text-orange-800',
            'bg-pink-100 text-pink-800',
            'bg-indigo-100 text-indigo-800'
        ]
    };
    
    const tiles = analyticsData.map((item, index) => {
        // Get color based on request type name, or use fallback
        const colorClass = requestTypeColors[item.requestType] || 
                          requestTypeColors.default[index % requestTypeColors.default.length];
        const isZeroCount = item.count === 0;
        const tileClass = isZeroCount ? 'rounded-lg border bg-card text-card-foreground shadow-sm p-6 opacity-60' : 'rounded-lg border bg-card text-card-foreground shadow-sm p-6';
        const badgeClass = isZeroCount ? 'bg-gray-100 text-gray-500' : colorClass;
        
        // Validation failure information
        const validationFailures = item.validationFailures || 0;
        const validationFailureRate = item.validationFailureRate || '0.0';
        const hasValidationFailures = validationFailures > 0;
        const validationBadgeColor = hasValidationFailures ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
        const validationIcon = hasValidationFailures ? '⚠️' : '✓';
        
        return `
            <div class="${tileClass}">
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <p class="text-sm font-medium text-muted-foreground">${item.requestType}</p>
                            <p class="text-3xl font-bold ${isZeroCount ? 'text-gray-400' : ''}">${item.count}</p>
                        </div>
                        <div>
                            <span class="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${badgeClass}">
                                ${item.percentage}%
                            </span>
                        </div>
                    </div>
                    ${!isZeroCount ? `
                    <div class="pt-2 border-t border-gray-100">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1">
                                <span class="text-xs font-medium ${hasValidationFailures ? 'text-red-600' : 'text-green-600'}">
                                    ${validationIcon} Validation
                                </span>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-semibold ${hasValidationFailures ? 'text-red-600' : 'text-green-600'}">${validationFailures}</p>
                                <p class="text-xs text-muted-foreground">failed (${validationFailureRate}%)</p>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = tiles;
}

// Update the analytics period display
function updateAnalyticsPeriod(period) {
    const periodElement = document.getElementById('analytics-period');
    if (periodElement && period) {
        const startDate = new Date(period.startDate).toLocaleDateString();
        const endDate = new Date(period.endDate).toLocaleDateString();
        periodElement.textContent = `${startDate} - ${endDate}`;
    }
}

// Show error state for analytics
function showAnalyticsError() {
    const container = document.getElementById('request-type-tiles');
    if (container) {
        container.innerHTML = `
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6 col-span-full">
                <div class="text-center">
                    <div class="text-red-600 text-sm">Failed to load analytics data</div>
                    <button onclick="loadAnalyticsData()" class="mt-2 text-xs text-blue-600 hover:text-blue-800">
                        Try Again
                    </button>
                </div>
            </div>
        `;
    }
}

// Load validation failure trend chart
let validationTrendChart = null;
let validationTrendData = null; // Store data globally for re-rendering

async function loadValidationTrendChart() {
    const canvas = document.getElementById('validation-trend-chart');
    const container = document.getElementById('validation-trend-container');
    const loading = document.getElementById('trend-loading');
    const error = document.getElementById('trend-error');
    const periodElement = document.getElementById('trend-period');
    
    if (!canvas || !container || !loading || !error) {
        console.warn('Validation trend chart elements not found');
        return;
    }
    
    try {
        // Show loading state
        container.style.display = 'none';
        loading.style.display = 'flex';
        error.style.display = 'none';
        
        // Get enabled rules from localStorage (same as analytics)
        let enabledRuleIds = [];
        try {
            const validationConfig = localStorage.getItem('deploymentAssistant_validationRules');
            if (validationConfig) {
                const config = JSON.parse(validationConfig);
                enabledRuleIds = Object.keys(config.enabledRules || {}).filter(ruleId => 
                    config.enabledRules[ruleId] === true
                );
            }
            
            if (enabledRuleIds.length === 0) {
                enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
            }
        } catch (e) {
            enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
        }
        
        console.log('📈 Fetching validation trend data...');
        const response = await fetch(`/api/analytics/validation-trend?enabledRules=${encodeURIComponent(JSON.stringify(enabledRuleIds))}`);
        const data = await response.json();
        
        if (data.success && data.trendData && data.trendData.length > 0) {
            // Store data globally
            validationTrendData = data;
            
            // Hide loading, show chart
            loading.style.display = 'none';
            container.style.display = 'block';
            
            // Update period display
            if (periodElement && data.period) {
                const startDate = new Date(data.period.startDate).toLocaleDateString();
                const endDate = new Date(data.period.endDate).toLocaleDateString();
                periodElement.textContent = `${startDate} - ${endDate}`;
            }
            
            // Set up toggle event listeners
            setupTrendToggleListeners();
            
            // Render the chart
            renderValidationTrendChart();
            
            console.log('✅ Validation trend chart loaded with', data.trendData.length, 'data points');
        } else {
            // Show error state
            loading.style.display = 'none';
            container.style.display = 'none';
            error.style.display = 'flex';
            console.error('No trend data available');
        }
    } catch (err) {
        console.error('Error loading validation trend chart:', err);
        loading.style.display = 'none';
        container.style.display = 'none';
        error.style.display = 'flex';
    }
}

// Set up event listeners for trend line toggles
function setupTrendToggleListeners() {
    const toggles = document.querySelectorAll('.trend-toggle');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            // Save preferences to localStorage
            const preferences = {
                showUpdate: document.getElementById('trend-toggle-update')?.checked ?? true,
                showOnboarding: document.getElementById('trend-toggle-onboarding')?.checked ?? true,
                showDeprovision: document.getElementById('trend-toggle-deprovision')?.checked ?? true
            };
            localStorage.setItem('validationTrendPreferences', JSON.stringify(preferences));
            
            // Re-render chart with new settings
            renderValidationTrendChart();
        });
    });
}

// Render the validation trend chart based on current toggle states
function renderValidationTrendChart() {
    if (!validationTrendData || !validationTrendData.trendData) {
        console.warn('No trend data available to render');
        return;
    }
    
    const canvas = document.getElementById('validation-trend-chart');
    if (!canvas) return;
    
    // Get toggle states from localStorage or default to all enabled
    let preferences = {
        showUpdate: true,
        showOnboarding: true,
        showDeprovision: true
    };
    
    try {
        const saved = localStorage.getItem('validationTrendPreferences');
        if (saved) {
            preferences = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not load trend preferences:', e);
    }
    
    // Update checkbox states
    const updateToggle = document.getElementById('trend-toggle-update');
    const onboardingToggle = document.getElementById('trend-toggle-onboarding');
    const deprovisionToggle = document.getElementById('trend-toggle-deprovision');
    
    if (updateToggle) updateToggle.checked = preferences.showUpdate;
    if (onboardingToggle) onboardingToggle.checked = preferences.showOnboarding;
    if (deprovisionToggle) deprovisionToggle.checked = preferences.showDeprovision;
    
    // Prepare chart data - sample every 3 days to avoid overcrowding
    const sampledData = validationTrendData.trendData.filter((d, index) => index % 3 === 0);
    const labels = sampledData.map(d => d.displayDate);
    
    // Debug: Log a sample data point to check structure
    if (sampledData.length > 0) {
        console.log('Sample data point:', sampledData[0]);
    }
    
    // Extract data for each request type
    const updateFailurePercentages = sampledData.map(d => parseFloat(d.updateFailurePercentage || d.failurePercentage || 0));
    const onboardingFailurePercentages = sampledData.map(d => parseFloat(d.onboardingFailurePercentage || 0));
    const deprovisionFailurePercentages = sampledData.map(d => parseFloat(d.deprovisionFailurePercentage || 0));
    
    // Debug: Log extracted percentages
    console.log('Update percentages sample:', updateFailurePercentages.slice(0, 3));
    console.log('Onboarding percentages sample:', onboardingFailurePercentages.slice(0, 3));
    console.log('Deprovision percentages sample:', deprovisionFailurePercentages.slice(0, 3));
    
    // Build datasets based on toggle states
    const datasets = [];
    const visibleValues = [];
    
    if (preferences.showUpdate) {
        datasets.push({
            label: 'Update - Validation Failure Rate (%)',
            data: updateFailurePercentages,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgb(239, 68, 68)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        });
        visibleValues.push(...updateFailurePercentages);
    }
    
    if (preferences.showOnboarding) {
        datasets.push({
            label: 'Onboarding - Validation Failure Rate (%)',
            data: onboardingFailurePercentages,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgb(59, 130, 246)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        });
        visibleValues.push(...onboardingFailurePercentages);
    }
    
    if (preferences.showDeprovision) {
        datasets.push({
            label: 'Deprovision - Validation Failure Rate (%)',
            data: deprovisionFailurePercentages,
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgb(16, 185, 129)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        });
        visibleValues.push(...deprovisionFailurePercentages);
    }
    
    // Calculate dynamic y-axis range based on visible data only
    const maxValue = visibleValues.length > 0 ? Math.max(...visibleValues) : 10;
    const minValue = visibleValues.length > 0 ? Math.min(...visibleValues) : 0;
    
    // Set y-axis max with 15% padding above the highest value, minimum of 10%
    const yAxisMax = Math.max(Math.ceil(maxValue * 1.15), 10);
    // Set y-axis min to 0 or slightly below min value if all values are high
    const yAxisMin = minValue > 5 ? Math.max(0, Math.floor(minValue * 0.85)) : 0;
    
    // Destroy existing chart if it exists
    if (validationTrendChart) {
        validationTrendChart.destroy();
    }
    
    // Create the chart with selected datasets
    const ctx = canvas.getContext('2d');
    validationTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        family: 'Inter',
                        size: 13
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 12
                    },
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const dataPoint = sampledData[context.dataIndex];
                            const datasetLabel = context.dataset.label;
                            
                            if (datasetLabel.startsWith('Update')) {
                                return [
                                    `Update Annual Failure Rate: ${dataPoint.updateFailurePercentage || dataPoint.failurePercentage || '0.0'}%`,
                                    `Rolling Year: ${dataPoint.updateFailures || dataPoint.failures || 0} of ${dataPoint.updateTotal || dataPoint.total || 0} failed`
                                ];
                            } else if (datasetLabel.startsWith('Onboarding')) {
                                return [
                                    `Onboarding Annual Failure Rate: ${dataPoint.onboardingFailurePercentage || '0.0'}%`,
                                    `Rolling Year: ${dataPoint.onboardingFailures || 0} of ${dataPoint.onboardingTotal || 0} failed`
                                ];
                            } else if (datasetLabel.startsWith('Deprovision')) {
                                return [
                                    `Deprovision Annual Failure Rate: ${dataPoint.deprovisionFailurePercentage || '0.0'}%`,
                                    `Rolling Year: ${dataPoint.deprovisionFailures || 0} of ${dataPoint.deprovisionTotal || 0} failed`
                                ];
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: yAxisMin,
                    max: yAxisMax,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    title: {
                        display: true,
                        text: 'Rolling Annual Failure %',
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Date (Last 3 Months)',
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            }
        }
    });
    
    console.log('✅ Chart re-rendered with preferences:', preferences);
}

function updateAnalyticsStats(stats) {
    // Legacy function - kept for compatibility
    console.log('updateAnalyticsStats called with:', stats);
}

// Roadmap page functionality
function initializeRoadmap() {
    console.log('Roadmap page initialized');
    
    // Set Kevin Yu as default assignee
    const assigneeInput = document.getElementById('assignee-input');
    if (assigneeInput) {
        assigneeInput.value = 'Kevin Yu';
    }
    
    // Automatically load Kevin Yu's initiatives
    console.log('Loading default assignee: Kevin Yu');
    loadJiraInitiatives('Kevin Yu');
    
    setupRoadmapEventListeners();
}

async function loadJiraInitiatives(assigneeName = null) {
    try {
        if (!assigneeName) {
            // Clear the table and show initial state
            showInitialRoadmapState();
            return;
        }

        console.log(`Loading Jira initiatives for assignee: ${assigneeName}`);
        
        // Show loading state
        showRoadmapLoading();
        
        // Try to fetch from Jira API
        const apiResponse = await fetchJiraInitiatives(assigneeName);
        
        if (apiResponse && apiResponse.error) {
            // Handle API error
            showRoadmapError(apiResponse.error);
            return;
        }
        
        if (apiResponse && apiResponse.issues) {
            if (apiResponse.issues.length > 0) {
                // Success case - has data
                initiativesData = apiResponse.issues;
                
                // Update title with assignee name
                updateAssigneeTitle(assigneeName, apiResponse.issues.length);
                
                filteredData = [...initiativesData];
                renderRoadmapTable(filteredData);
                updateInitiativeCount(filteredData.length);
            } else {
                // No data found (empty array)
                showRoadmapNoData(assigneeName);
            }
        } else {
            // Unexpected response structure - treat as error
            console.warn('Unexpected API response structure:', apiResponse);
            showRoadmapError('Unexpected response from server. Please try again.');
        }
        
    } catch (error) {
        console.error('Error loading initiatives:', error);
        showRoadmapError('Failed to connect to Jira. Please try again.');
    }
}

async function fetchJiraInitiatives(assigneeName = null) {
    try {
        if (!assigneeName || assigneeName.trim() === '') {
            console.log('No assignee name provided');
            return null;
        }

        console.log(`Fetching Jira initiatives from API for assignee: ${assigneeName}`);
        
        const response = await fetch('/api/jira/initiatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assigneeName: assigneeName })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Successfully fetched initiatives from API:', data);
            return data;
        } else {
            const errorData = await response.json();
            console.error('Failed to fetch initiatives:', response.status, errorData);
            return { error: errorData.message || 'Failed to fetch initiatives' };
        }
    } catch (error) {
        console.error('Error fetching initiatives:', error);
        return { error: 'Network error while fetching initiatives' };
    }
}

// Update assignee title
function updateAssigneeTitle(assigneeName, count) {
    const titleElement = document.getElementById('assignee-initiatives-title');
    const subtitleElement = document.getElementById('assignee-initiatives-subtitle');
    
    if (titleElement) {
        titleElement.textContent = `${assigneeName}'s Initiatives`;
    }
    
    if (subtitleElement) {
        subtitleElement.textContent = `Initiatives and tasks assigned to ${assigneeName}`;
    }
}

// Show initial roadmap state
function showInitialRoadmapState() {
    const tbody = document.getElementById('roadmap-tbody');
    const titleElement = document.getElementById('assignee-initiatives-title');
    const subtitleElement = document.getElementById('assignee-initiatives-subtitle');
    
    if (titleElement) titleElement.textContent = 'Initiatives';
    if (subtitleElement) subtitleElement.textContent = 'Enter an assignee name above to load their initiatives';
    
    tbody.innerHTML = `
        <tr class="border-b transition-colors hover:bg-muted/50">
            <td class="p-4 align-middle text-center text-muted-foreground" colspan="6">
                <div class="flex flex-col items-center gap-2 py-8">
                    <svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <p class="text-sm">No assignee selected</p>
                    <p class="text-xs text-muted-foreground">Enter an assignee name and click "Load Initiatives" to view their tasks</p>
                </div>
            </td>
        </tr>
    `;
    updateInitiativeCount(0);
}

// Show loading state
function showRoadmapLoading() {
    const tbody = document.getElementById('roadmap-tbody');
    tbody.innerHTML = `
        <tr class="border-b transition-colors hover:bg-muted/50">
            <td class="p-4 align-middle text-center text-muted-foreground" colspan="6">
                <div class="flex flex-col items-center gap-2 py-8">
                    <div class="loading-spinner"></div>
                    <p class="text-sm">Loading initiatives...</p>
                    <p class="text-xs text-muted-foreground">Fetching data from Jira...</p>
                </div>
            </td>
        </tr>
    `;
    updateInitiativeCount('Loading...');
}

// Show no data found state
function showRoadmapNoData(assigneeName) {
    const tbody = document.getElementById('roadmap-tbody');
    tbody.innerHTML = `
        <tr class="border-b transition-colors hover:bg-muted/50">
            <td class="p-4 align-middle text-center text-muted-foreground" colspan="6">
                <div class="flex flex-col items-center gap-2 py-8">
                    <svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21 21-4.35-4.35"></path>
                        <circle cx="11" cy="11" r="8"></circle>
                    </svg>
                    <p class="text-sm">No initiatives found for ${assigneeName}</p>
                    <p class="text-xs text-muted-foreground">Try checking the spelling or use a different assignee name</p>
                </div>
            </td>
        </tr>
    `;
    updateInitiativeCount(0);
}

function getMockInitiatives() {
    return [
        {
            key: 'PLAT-001',
            summary: 'Enhanced User Authentication System',
            status: 'Committed',
            created: '2025-01-10T09:00:00Z',
            updated: '2025-01-18T14:30:00Z',
            description: 'Implement multi-factor authentication and improve login security across the platform.'
        },
        {
            key: 'PLAT-002',
            summary: 'Real-time Analytics Dashboard',
            status: 'Proposed',
            created: '2025-01-15T10:15:00Z',
            updated: '2025-01-17T16:45:00Z',
            description: 'Create a comprehensive real-time analytics dashboard for platform metrics and user behavior.'
        },
        {
            key: 'PLAT-003',
            summary: 'API Rate Limiting Framework',
            status: 'Open',
            created: '2025-01-08T11:30:00Z',
            updated: '2025-01-16T09:20:00Z',
            description: 'Implement intelligent API rate limiting to protect platform resources and ensure fair usage.'
        },
        {
            key: 'PLAT-004',
            summary: 'Microservices Migration Phase 1',
            status: 'Committed',
            created: '2025-01-05T08:45:00Z',
            updated: '2025-01-19T13:15:00Z',
            description: 'Begin migration of monolithic architecture to microservices, starting with user management.'
        },
        {
            key: 'PLAT-005',
            summary: 'Advanced Search Capabilities',
            status: 'Proposed',
            created: '2025-01-12T15:20:00Z',
            updated: '2025-01-18T11:10:00Z',
            description: 'Implement Elasticsearch-powered search with filtering, faceting, and intelligent recommendations.'
        }
    ];
}

function renderRoadmapTable(data) {
    const tbody = document.getElementById('roadmap-tbody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr class="border-b transition-colors hover:bg-muted/50">
                <td class="p-4 align-middle text-center text-muted-foreground" colspan="6">
                    <div class="flex flex-col items-center gap-2 py-8">
                        <svg class="h-8 w-8 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p class="text-sm">No initiatives found</p>
                        <p class="text-xs text-muted-foreground">Try adjusting your filters or refresh the data</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = data.map(initiative => {
        const createdDate = new Date(initiative.created).toLocaleDateString();
        const updatedDate = new Date(initiative.updated).toLocaleDateString();
        const statusColor = getStatusColor(initiative.status);
        
        return `
            <tr class="border-b transition-colors hover:bg-muted/50">
                <td class="p-4 align-middle">
                    <code class="rounded bg-muted px-[0.3rem] py-[0.2rem] text-xs font-mono">${initiative.key}</code>
                </td>
                <td class="p-4 align-middle">
                    <div class="max-w-[300px]">
                        <div class="font-medium">${initiative.summary}</div>
                        <div class="text-xs text-muted-foreground mt-1 line-clamp-2">${initiative.description}</div>
                    </div>
                </td>
                <td class="p-4 align-middle">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}">
                        ${initiative.status}
                    </span>
                </td>
                <td class="p-4 align-middle text-sm text-muted-foreground">${createdDate}</td>
                <td class="p-4 align-middle text-sm text-muted-foreground">${updatedDate}</td>
                <td class="p-4 align-middle">
                    <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8" onclick="viewInitiativeDetails('${initiative.key}')">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
}

function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'proposed':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case 'committed':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'open':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
}

function updateInitiativeCount(count) {
    const countElement = document.getElementById('initiative-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

function setupRoadmapEventListeners() {
    // Assignee input and load button
    const assigneeInput = document.getElementById('assignee-input');
    const loadBtn = document.getElementById('load-initiatives');
    
    if (loadBtn) {
        loadBtn.addEventListener('click', handleLoadInitiatives);
    }
    
    if (assigneeInput) {
        assigneeInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleLoadInitiatives();
            }
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('roadmap-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleStatusFilter);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }
    
    // Export button
    const exportBtn = document.getElementById('export-roadmap');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    // Table sorting
    const sortableHeaders = document.querySelectorAll('#roadmap-table th[data-sort]');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.sort));
    });
}

// Handle load initiatives button click
function handleLoadInitiatives() {
    const assigneeInput = document.getElementById('assignee-input');
    const assigneeName = assigneeInput ? assigneeInput.value.trim() : '';
    
    if (!assigneeName) {
        alert('Please enter an assignee name');
        return;
    }
    
    loadJiraInitiatives(assigneeName);
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    
    filteredData = initiativesData.filter(initiative => 
        initiative.key.toLowerCase().includes(searchTerm) ||
        initiative.summary.toLowerCase().includes(searchTerm) ||
        initiative.description.toLowerCase().includes(searchTerm) ||
        initiative.status.toLowerCase().includes(searchTerm)
    );
    
    // Apply status filter as well
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter && statusFilter.value) {
        filteredData = filteredData.filter(initiative => 
            initiative.status === statusFilter.value
        );
    }
    
    renderRoadmapTable(filteredData);
    updateInitiativeCount(filteredData.length);
}

function handleStatusFilter(event) {
    const selectedStatus = event.target.value;
    
    if (selectedStatus) {
        filteredData = initiativesData.filter(initiative => 
            initiative.status === selectedStatus
        );
    } else {
        filteredData = [...initiativesData];
    }
    
    // Apply search filter as well
    const searchInput = document.getElementById('roadmap-search');
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase();
        filteredData = filteredData.filter(initiative => 
            initiative.key.toLowerCase().includes(searchTerm) ||
            initiative.summary.toLowerCase().includes(searchTerm) ||
            initiative.description.toLowerCase().includes(searchTerm) ||
            initiative.status.toLowerCase().includes(searchTerm)
        );
    }
    
    renderRoadmapTable(filteredData);
    updateInitiativeCount(filteredData.length);
}

function handleSort(sortKey) {
    if (sortConfig.key === sortKey) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = sortKey;
        sortConfig.direction = 'asc';
    }
    
    filteredData.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        
        // Handle different data types
        if (sortKey === 'created' || sortKey === 'updated') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        if (aVal < bVal) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    renderRoadmapTable(filteredData);
    updateSortIndicators();
}

function updateSortIndicators() {
    // Reset all sort indicators
    const headers = document.querySelectorAll('#roadmap-table th[data-sort] svg');
    headers.forEach(svg => {
        svg.className = 'h-4 w-4 opacity-50';
    });
    
    // Update active sort indicator
    if (sortConfig.key) {
        const activeHeader = document.querySelector(`#roadmap-table th[data-sort="${sortConfig.key}"] svg`);
        if (activeHeader) {
            activeHeader.className = `h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''} opacity-100`;
        }
    }
}

function handleRefresh() {
    const assigneeInput = document.getElementById('assignee-input');
    const assigneeName = assigneeInput ? assigneeInput.value.trim() : '';
    
    if (!assigneeName) {
        alert('Please enter an assignee name first');
        return;
    }
    
    const refreshBtn = document.getElementById('refresh-data');
    if (refreshBtn) {
        // Add loading state
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `
            <div class="loading-spinner mr-2"></div>
            Refreshing...
        `;
        
        // Reset filters
        const searchInput = document.getElementById('roadmap-search');
        const statusFilter = document.getElementById('status-filter');
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = '';
        
        // Reload data
        setTimeout(() => {
            loadJiraInitiatives(assigneeName);
            
            // Reset button
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                </svg>
                Refresh
            `;
        }, 1000);
    }
}

function handleExport() {
    try {
        // Convert data to CSV format
        const csvContent = convertToCSV(filteredData);
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `kevin_yu_roadmap_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Roadmap exported successfully');
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
    }
}

function convertToCSV(data) {
    const headers = ['Key', 'Summary', 'Status', 'Created', 'Updated', 'Description'];
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(item => {
        const row = [
            `"${item.key}"`,
            `"${item.summary.replace(/"/g, '""')}"`,
            `"${item.status}"`,
            `"${new Date(item.created).toLocaleDateString()}"`,
            `"${new Date(item.updated).toLocaleDateString()}"`,
            `"${item.description.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

function viewInitiativeDetails(key) {
    const initiative = initiativesData.find(item => item.key === key);
    if (initiative) {
        alert(`Initiative: ${initiative.key}\n\nSummary: ${initiative.summary}\n\nStatus: ${initiative.status}\n\nDescription: ${initiative.description}`);
        // TODO: Implement proper modal or detail view
    }
}

function showRoadmapError(message) {
    const tbody = document.getElementById('roadmap-tbody');
    tbody.innerHTML = `
        <tr class="border-b transition-colors hover:bg-muted/50">
            <td class="p-4 align-middle text-center text-muted-foreground" colspan="6">
                <div class="flex flex-col items-center gap-2 py-8">
                    <svg class="h-8 w-8 text-yellow-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <p class="text-sm">${message}</p>
                    <button onclick="handleRefresh()" class="text-xs text-primary hover:underline">Try Again</button>
                </div>
            </td>
        </tr>
    `;
    updateInitiativeCount(0);
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleNavigation(event) {
    const targetPage = event.target.closest('.nav-item');
    if (!targetPage) return;
    
    const pageId = targetPage.id.replace('nav-', '');
    showPage(pageId);
    
    // Add click effect
    targetPage.style.transform = 'scale(0.98)';
    setTimeout(() => {
        targetPage.style.transform = '';
    }, 150);
}

// Update timestamp on page load
function updateTimestamp() {
    if (timestampElement) {
        const now = new Date();
        timestampElement.textContent = `Last updated: ${now.toLocaleString()}`;
    }
}

// Fetch greeting from API
async function fetchGreeting(name = '') {
    try {
        const response = await fetch(`/api/greeting${name ? `?name=${encodeURIComponent(name)}` : ''}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching greeting:', error);
        return { 
            message: 'Welcome to Deployment Assistant! 🚀', 
            timestamp: new Date().toISOString() 
        };
    }
}

// Greeting functionality removed - replaced with validation monitoring
// (Functions commented out to avoid breaking existing references)
/*
async function updateGreeting(name = '') {
    // Legacy greeting functionality removed
}
*/

// Handle greeting button click - DISABLED (elements removed)
/*
function handleGreetClick() {
    // Legacy greeting functionality removed
}
*/

// Handle Enter key in input field - DISABLED (elements removed)
/*
function handleInputKeyPress(event) {
    // Legacy greeting functionality removed
}
*/

// Add entrance animations to cards
function addEntranceAnimations() {
    const cards = document.querySelectorAll('.rounded-lg.border');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease-out';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Enhanced input validation - DISABLED (elements removed)
/*
function validateInput() {
    // Legacy greeting functionality removed
}
*/

// Add subtle hover effects to feature cards
function addHoverEffects() {
    const featureCards = document.querySelectorAll('.grid .rounded-lg.border');
    
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '';
        });
    });
}

// Create subtle ripple effect for button clicks
function createRippleEffect(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.className = 'absolute rounded-full bg-white/20 pointer-events-none';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s ease-out';
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Add ripple animation keyframes
const style = document.createElement('style');
style.textContent = `
@keyframes ripple {
    to {
        transform: scale(2);
        opacity: 0;
    }
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
}

.shake {
    animation: shake 0.4s ease-in-out;
}
`;
document.head.appendChild(style);

// Event listeners (greeting functionality removed)
themeToggle.addEventListener('click', toggleTheme);

// Navigation event listeners
navDashboard.addEventListener('click', handleNavigation);
navAnalytics.addEventListener('click', handleAnalyticsNavigation);
navRoadmap.addEventListener('click', handleNavigation);
navProvisioning.addEventListener('click', handleProvisioningNavigation);
navProvisioningMonitor.addEventListener('click', handleNavigation);
navExpiration.addEventListener('click', handleNavigation);
navCustomerProducts.addEventListener('click', handleNavigation);
navHelp.addEventListener('click', handleNavigation);
navSettings.addEventListener('click', handleNavigation);

// Analytics sub-navigation event listeners
const navAnalyticsOverview = document.getElementById('nav-analytics-overview');
const navAccountHistory = document.getElementById('nav-account-history');
if (navAnalyticsOverview) navAnalyticsOverview.addEventListener('click', handleNavigation);
if (navAccountHistory) navAccountHistory.addEventListener('click', handleNavigation);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initializeTheme();
    
    // Initialize auto-refresh
    initializeAutoRefresh();
    
    // Initialize navigation - restore saved page or default to dashboard
    const savedPage = localStorage.getItem('currentPage') || 'dashboard';
    showPage(savedPage);
    
    // Update timestamp
    updateTimestamp();
    
    // Add entrance animations
    setTimeout(() => {
        addEntranceAnimations();
    }, 100);
    
    // Update relative timestamps every minute
    setInterval(() => {
        Object.keys(lastRefreshTimes).forEach(pageId => {
            const timestampElement = document.getElementById(`${pageId}-last-refresh`);
            if (timestampElement && lastRefreshTimes[pageId]) {
                timestampElement.textContent = formatTimestamp(lastRefreshTimes[pageId]);
            }
        });
    }, 60000); // Update every minute
    
    // Add hover effects
    setTimeout(() => {
        addHoverEffects();
    }, 200);
    
    // Page-specific initialization
    if (savedPage === 'landing') {
        // Focus on input field after animations for landing page
        setTimeout(() => {
            // Focus removed - no input field available
        }, 800);
        
        // Initial greeting removed - replaced with validation monitoring
    }
});

// Update timestamp every minute
setInterval(updateTimestamp, 60000);

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + D to toggle dark mode
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        toggleTheme();
    }
    
    // Ctrl/Cmd + 1 to go to Dashboard page
    if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        showPage('dashboard');
    }
    
    // Ctrl/Cmd + 2 to go to Analytics page
    if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault();
        showPage('analytics');
    }
    
    // Ctrl/Cmd + 3 to go to Roadmap page
    if ((event.ctrlKey || event.metaKey) && event.key === '3') {
        event.preventDefault();
        showPage('roadmap');
    }
    
    // Escape to clear input (only on dashboard page)
    if (event.key === 'Escape' && currentPage === 'dashboard') {
        // Input field functionality removed
    }
    
    // Arrow keys for navigation
    if (event.key === 'ArrowLeft' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (currentPage === 'analytics') {
            showPage('dashboard');
        }
    }
    
    if (event.key === 'ArrowRight' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (currentPage === 'dashboard') {
            showPage('analytics');
        }
    }
});

// Add smooth transitions for theme changes
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // Theme change detected, add smooth transition
            document.body.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                document.body.style.transition = '';
            }, 300);
        }
    });
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// ============================================================================
// SETTINGS PAGE FUNCTIONALITY
// ============================================================================

// Initialize Settings page
function initializeSettings() {
    console.log('Settings page initialized');
    setupSettingsEventListeners();
    
    // Initialize validation rules section
    if (typeof initializeValidationRules === 'function') {
        initializeValidationRules();
    }
    
    // Initialize notification settings
    initializeNotificationSettings();
}

// Setup Settings page event listeners
function setupSettingsEventListeners() {
    const settingsThemeToggle = document.getElementById('settings-theme-toggle');
    const testConnectivityButton = document.getElementById('test-web-connectivity');
    const testSalesforceButton = document.getElementById('test-salesforce-connection');
    const autoRefreshIntervalSelect = document.getElementById('auto-refresh-interval');
    
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('click', toggleTheme);
    }
    
    if (testConnectivityButton) {
        testConnectivityButton.addEventListener('click', testWebConnectivity);
    }
    
    if (testSalesforceButton) {
        testSalesforceButton.addEventListener('click', testSalesforceConnection);
    }
    
    // Auto-refresh interval control
    if (autoRefreshIntervalSelect) {
        autoRefreshIntervalSelect.addEventListener('change', handleAutoRefreshIntervalChange);
    }

    // Setup collapsible sections
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
        setupCollapsibleSections();
    }, 100);
}

// Setup collapsible sections functionality
function setupCollapsibleSections() {
    const sectionToggles = document.querySelectorAll('.settings-section-toggle');
    
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const sectionName = this.getAttribute('data-section');
            const content = document.getElementById(`${sectionName}-content`);
            const chevron = this.querySelector('.section-chevron');
            
            if (content && chevron) {
                const isHidden = content.classList.contains('hidden');
                
                if (isHidden) {
                    // Expand section
                    content.classList.remove('hidden');
                    chevron.style.transform = 'rotate(180deg)';
                } else {
                    // Collapse section
                    content.classList.add('hidden');
                    chevron.style.transform = 'rotate(0deg)';
                }
            }
        });
    });
}


// ============================================================================
// NOTIFICATION SETTINGS FUNCTIONS
// ============================================================================

// Initialize notification settings UI
function initializeNotificationSettings() {
    console.log('Initializing notification settings...');
    
    // Load current settings from notification manager
    if (typeof notificationManager === 'undefined') {
        console.warn('Notification manager not loaded yet');
        return;
    }
    
    const settings = notificationManager.settings;
    
    // Set toggle states
    const inBrowserToggle = document.getElementById('in-browser-notifications-toggle');
    const desktopToggle = document.getElementById('desktop-notifications-toggle');
    const soundToggle = document.getElementById('sound-notifications-toggle');
    
    if (inBrowserToggle) {
        inBrowserToggle.checked = settings.inBrowserEnabled;
    }
    
    if (desktopToggle) {
        desktopToggle.checked = settings.desktopEnabled;
    }
    
    if (soundToggle) {
        soundToggle.checked = settings.soundEnabled;
    }
    
    // Update permission status
    updateNotificationPermissionStatus();
    
    // Setup event listeners
    setupNotificationSettingsListeners();
    
    // Update status text
    updateNotificationStatus();
}

// Setup notification settings event listeners
function setupNotificationSettingsListeners() {
    const inBrowserToggle = document.getElementById('in-browser-notifications-toggle');
    const desktopToggle = document.getElementById('desktop-notifications-toggle');
    const soundToggle = document.getElementById('sound-notifications-toggle');
    const requestPermissionBtn = document.getElementById('request-notification-permission');
    const testNotificationBtn = document.getElementById('test-notification-btn');
    
    // In-browser notifications toggle
    if (inBrowserToggle) {
        inBrowserToggle.addEventListener('change', function() {
            notificationManager.saveSettings({ inBrowserEnabled: this.checked });
            updateNotificationStatus();
            console.log('In-browser notifications:', this.checked ? 'enabled' : 'disabled');
        });
    }
    
    // Desktop notifications toggle
    if (desktopToggle) {
        desktopToggle.addEventListener('change', async function() {
            if (this.checked && Notification.permission !== 'granted') {
                // Request permission first
                const granted = await notificationManager.requestPermission();
                if (!granted) {
                    this.checked = false;
                    alert('Desktop notification permission was denied. Please enable it in your browser settings.');
                    return;
                }
            }
            
            notificationManager.saveSettings({ desktopEnabled: this.checked });
            updateNotificationPermissionStatus();
            updateNotificationStatus();
            console.log('Desktop notifications:', this.checked ? 'enabled' : 'disabled');
        });
    }
    
    // Sound notifications toggle
    if (soundToggle) {
        soundToggle.addEventListener('change', function() {
            notificationManager.saveSettings({ soundEnabled: this.checked });
            console.log('Sound notifications:', this.checked ? 'enabled' : 'disabled');
        });
    }
    
    // Request permission button
    if (requestPermissionBtn) {
        requestPermissionBtn.addEventListener('click', async function() {
            const granted = await notificationManager.requestPermission();
            updateNotificationPermissionStatus();
            
            if (granted) {
                const desktopToggle = document.getElementById('desktop-notifications-toggle');
                if (desktopToggle) {
                    desktopToggle.checked = true;
                    notificationManager.saveSettings({ desktopEnabled: true });
                }
            }
        });
    }
    
    // Test notification button
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', function() {
            console.log('Sending test notification...');
            
            const testRecord = {
                id: 'TEST-001',
                name: 'PS-TEST-001',
                requestType: 'Product Addition',
                account: 'Test Account Inc.',
                accountSite: 'US',
                status: 'Open',
                createdDate: new Date().toISOString()
            };
            
            notificationManager.showNotification(testRecord);
        });
    }
}

// Update notification permission status display
function updateNotificationPermissionStatus() {
    const statusElement = document.getElementById('desktop-permission-status');
    const requestSection = document.getElementById('request-permission-section');
    
    if (!statusElement) return;
    
    const permission = Notification.permission;
    
    if (permission === 'granted') {
        statusElement.innerHTML = '<span class="permission-badge granted">✓ Granted</span>';
        if (requestSection) requestSection.classList.add('hidden');
    } else if (permission === 'denied') {
        statusElement.innerHTML = '<span class="permission-badge denied">✗ Denied</span>';
        if (requestSection) requestSection.classList.add('hidden');
    } else {
        statusElement.innerHTML = '<span class="permission-badge default">? Not Set</span>';
        if (requestSection) requestSection.classList.remove('hidden');
    }
}

// Update notification status text
function updateNotificationStatus() {
    const statusText = document.getElementById('notification-status-text');
    
    if (!statusText || typeof notificationManager === 'undefined') return;
    
    const status = notificationManager.getStatus();
    
    if (status.isRunning && (status.settings.inBrowserEnabled || status.settings.desktopEnabled)) {
        statusText.textContent = 'Active';
        statusText.className = 'text-green-600';
    } else {
        statusText.textContent = 'Inactive';
        statusText.className = 'text-muted-foreground';
    }
}

// Clear badge when navigating to provisioning monitor
function clearProvisioningNotificationBadge() {
    if (typeof notificationManager !== 'undefined') {
        notificationManager.clearUnreadCount();
    }
}

// Test Web Connectivity
async function testWebConnectivity() {
    const testButton = document.getElementById('test-web-connectivity');
    const resultsContainer = document.getElementById('connectivity-results');
    
    // Update button to show loading state
    testButton.disabled = true;
    testButton.innerHTML = `
        <div class="loading-spinner mr-2"></div>
        Testing...
    `;
    
    // Show loading state in results
    resultsContainer.innerHTML = `
        <div class="text-center py-8 text-muted-foreground">
            <div class="loading-spinner mx-auto mb-4"></div>
            <p>Testing connectivity to external services...</p>
            <p class="text-sm">This may take a few seconds</p>
        </div>
    `;
    
    try {
        console.log('Testing web connectivity from UI...');
        
        const response = await fetch('/api/test-web-connectivity');
        const data = await response.json();
        
        if (response.ok) {
            renderConnectivityResults(data);
        } else {
            throw new Error(data.error || 'Connectivity test failed');
        }
        
    } catch (error) {
        console.error('Web connectivity test error:', error);
        resultsContainer.innerHTML = `
            <div class="text-center py-8 text-destructive">
                <svg class="h-12 w-12 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <p class="font-medium">Connectivity test failed</p>
                <p class="text-sm">${error.message}</p>
            </div>
        `;
    } finally {
        // Reset button
        testButton.disabled = false;
        testButton.innerHTML = `
            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"></path>
                <path d="M9.5 12.5 11 14l4-4"></path>
            </svg>
            Test Connectivity
        `;
    }
}

// Render connectivity test results
function renderConnectivityResults(data) {
    const resultsContainer = document.getElementById('connectivity-results');
    const { connectivity, results, summary, timestamp } = data;
    
    const overallStatus = connectivity ? 'success' : 'error';
    const statusColor = connectivity ? 'text-green-600' : 'text-red-600';
    const statusBg = connectivity ? 'bg-green-50' : 'bg-red-50';
    
    resultsContainer.innerHTML = `
        <!-- Overall Status -->
        <div class="p-4 rounded-lg border ${statusBg}">
            <div class="flex items-center gap-3">
                <div class="flex-shrink-0">
                    ${connectivity ? `
                        <svg class="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"></path>
                            <path d="M9.5 12.5 11 14l4-4"></path>
                        </svg>
                    ` : `
                        <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    `}
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold ${statusColor}">
                        ${connectivity ? 'Web Connectivity: Active' : 'Web Connectivity: Limited'}
                    </h4>
                    <p class="text-sm text-muted-foreground">
                        ${summary.successful} of ${summary.total} services reachable
                        ${connectivity ? '• All critical services accessible' : '• Some services may be blocked'}
                    </p>
                </div>
                <div class="text-xs text-muted-foreground">
                    ${new Date(timestamp).toLocaleTimeString()}
                </div>
            </div>
        </div>
        
        <!-- Detailed Results -->
        <div class="space-y-3">
            <h5 class="text-sm font-medium text-foreground">Service Test Results:</h5>
            ${results.map(result => `
                <div class="flex items-center justify-between p-3 rounded-lg border bg-background">
                    <div class="flex items-center gap-3">
                        <div class="flex-shrink-0">
                            ${result.success ? `
                                <svg class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"></path>
                                    <path d="M9.5 12.5 11 14l4-4"></path>
                                </svg>
                            ` : `
                                <svg class="h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                            `}
                        </div>
                        <div class="flex-1">
                            <div class="font-medium">${result.name}</div>
                            <div class="text-xs text-muted-foreground">${result.url}</div>
                            ${result.error ? `<div class="text-xs text-red-600 mt-1">${result.error}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-right text-sm">
                        ${result.success ? `
                            <div class="text-green-600 font-medium">${result.statusCode}</div>
                            <div class="text-xs text-muted-foreground">${result.responseTime}ms</div>
                        ` : `
                            <div class="text-red-600 font-medium">Failed</div>
                        `}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Test Information -->
        <div class="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <p><strong>Test Details:</strong></p>
            <ul class="list-disc list-inside mt-1 space-y-1">
                <li>Tests application's ability to reach external web resources</li>
                <li>Uses HTTP HEAD requests to minimize data transfer</li>
                <li>404 responses are considered successful (server reachable)</li>
                <li>SSL certificate issues may occur in corporate environments</li>
            </ul>
        </div>
    `;
    
    console.log('Connectivity test completed:', {
        overall: connectivity,
        successful: summary.successful,
        failed: summary.failed,
        results: results
    });
}

// ===== PROVISIONING MONITOR FUNCTIONALITY =====

// Load filter options for provisioning monitor
async function loadProvisioningFilterOptions() {
    try {
        console.log('Loading provisioning filter options from Salesforce...');
        
        const response = await fetch('/api/provisioning/filter-options');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🔧 Filter options response:', data);
        
        if (data.success) {
            // Populate Request Type filter
            const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
            if (requestTypeFilter && data.requestTypes) {
                const currentValue = requestTypeFilter.value;
                requestTypeFilter.innerHTML = '<option value="">All Request Types</option>' + 
                    data.requestTypes.map(type => 
                        `<option value="${type}" ${type === currentValue ? 'selected' : ''}>${type}</option>`
                    ).join('');
            }
            
            // Populate Status filter
            const statusFilter = document.getElementById('provisioning-status-filter');
            if (statusFilter && data.statuses) {
                const currentValue = statusFilter.value;
                statusFilter.innerHTML = '<option value="">All Statuses</option>' + 
                    data.statuses.map(status => 
                        `<option value="${status}" ${status === currentValue ? 'selected' : ''}>${status}</option>`
                    ).join('');
            }
            
            console.log(`✅ Filter options loaded: ${data.requestTypes?.length || 0} request types, ${data.statuses?.length || 0} statuses`);
        } else {
            console.error('Failed to load filter options:', data.error);
            // Fall back to default options on error
            loadDefaultFilterOptions();
        }
    } catch (error) {
        console.error('Error loading filter options:', error);
        // Fall back to default options on error
        this.loadDefaultFilterOptions();
    }
}

// Load default filter options as fallback
function loadDefaultFilterOptions() {
    console.log('Loading default filter options...');
    
    const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
    if (requestTypeFilter) {
        requestTypeFilter.innerHTML = `
            <option value="">All Request Types</option>
            <option value="New Implementation">New Implementation</option>
            <option value="Configuration">Configuration</option>
            <option value="Training">Training</option>
            <option value="Support">Support</option>
        `;
    }
    
    const statusFilter = document.getElementById('provisioning-status-filter');
    if (statusFilter) {
        statusFilter.innerHTML = `
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
        `;
    }
}

// Initialize Provisioning Monitor page
async function initializeProvisioning() {
    console.log('Provisioning Monitor page initialized');
    
    // Set initial loading state
    const countElement = document.getElementById('provisioning-count');
    if (countElement) {
        countElement.textContent = 'Loading...';
        console.log('🔧 Set initial loading text');
    }
    
    try {
        // Load filter options first
        await loadProvisioningFilterOptions();
        
        // Load initial data
        await loadProvisioningRequests();
        
        // Setup event listeners
        setupProvisioningEventListeners();
        
    } catch (error) {
        console.error('❌ Error during provisioning initialization:', error);
        if (countElement) {
            countElement.textContent = 'Error loading data';
        }
    }
}

// Setup event listeners for Provisioning Monitor
function setupProvisioningEventListeners() {
    // Global delegation (attach once) for product group buttons as a fallback
    if (!window.__productGroupDelegationAttached) {
        document.addEventListener('click', function(event) {
            if (event.defaultPrevented) return;
            const button = event.target && event.target.closest && event.target.closest('.product-group-btn');
            if (!button) return;
            event.preventDefault();
            const requestId = button.getAttribute('data-request-id');
            const groupType = button.getAttribute('data-group-type');
            const entitlements = button.getAttribute('data-entitlements');
            if (requestId && groupType && entitlements) {
                showProductGroup(requestId, groupType, entitlements);
            }
        }, true);
        window.__productGroupDelegationAttached = true;
    }

    // Event delegation for product group buttons
    const provisioningTable = document.getElementById('provisioning-table-body');
    if (provisioningTable) {
        provisioningTable.addEventListener('click', function(event) {
            const button = event.target.closest('.product-group-btn');
            if (button) {
                event.preventDefault();
                
                const requestId = button.getAttribute('data-request-id');
                const groupType = button.getAttribute('data-group-type');
                const entitlements = button.getAttribute('data-entitlements');
                
                if (requestId && groupType && entitlements) {
                    showProductGroup(requestId, groupType, entitlements);
                } else {
                    console.error('Missing button data:', { requestId, groupType, entitlements: !!entitlements });
                }
            }
        });
        console.log('Event delegation set up for product group buttons');
    }
    
    // Enhanced search with type-ahead
    const searchInput = document.getElementById('provisioning-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleProvisioningTypeAhead, 300));
        searchInput.addEventListener('keydown', handleSearchKeyDown);
        searchInput.addEventListener('focus', handleSearchFocus);
        searchInput.addEventListener('blur', handleSearchBlur);
    }
    
    // Filter functionality
    const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
    if (requestTypeFilter) {
        requestTypeFilter.addEventListener('change', handleProvisioningFilterChange);
    }
    
    const statusFilter = document.getElementById('provisioning-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleProvisioningFilterChange);
    }
    
    // Action buttons
    const refreshBtn = document.getElementById('refresh-provisioning');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleProvisioningRefresh);
    }
    
    const exportBtn = document.getElementById('export-provisioning');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleProvisioningExport);
    }
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prev-page-btn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', handlePreviousPage);
    }
    
    const nextPageBtn = document.getElementById('next-page-btn');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', handleNextPage);
    }
    
    // Table sorting
    const sortableHeaders = document.querySelectorAll('#provisioning-table th[data-sort]');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => handleProvisioningSort(header.dataset.sort));
    });
    
    // Click outside to close dropdown
    document.addEventListener('click', handleDocumentClick);
}

// Enhanced type-ahead search functionality
async function handleProvisioningTypeAhead(event) {
    const searchTerm = event.target.value.trim();
    currentSearchTerm = searchTerm;
    
    // Clear exact match filter when user manually types a new search
    if (exactMatchFilter) {
        console.log('🔍 Clearing exact match filter - user initiated new search');
        exactMatchFilter = null;
    }
    
    if (searchTerm.length < 2) {
        hideSearchDropdown();
        return;
    }
    
    try {
        // Cancel previous request if still pending
        if (currentSearchRequest) {
            currentSearchRequest.abort();
        }
        
        // Create new AbortController for this request
        const controller = new AbortController();
        currentSearchRequest = controller;
        
        const response = await fetch(`/api/provisioning/search?q=${encodeURIComponent(searchTerm)}&limit=10`, {
            signal: controller.signal
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        currentSearchRequest = null;
        
        if (data.success) {
            displaySearchResults(data.results, searchTerm);
        } else {
            console.error('Search failed:', data.error);
            hideSearchDropdown();
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Search request aborted');
        } else {
            console.error('Search error:', err);
            hideSearchDropdown();
        }
        currentSearchRequest = null;
    }
}

// Display search results in dropdown
function displaySearchResults(results, searchTerm) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    const { technicalRequests, accounts } = results;
    const hasResults = technicalRequests.length > 0 || accounts.length > 0;
    
    if (!hasResults) {
        dropdown.innerHTML = `
            <div class="p-3 text-center text-muted-foreground text-sm">
                No results found for "${searchTerm}"
            </div>
        `;
        showSearchDropdown();
        return;
    }
    
    let html = '';
    
    // Technical Team Requests section
    if (technicalRequests.length > 0) {
        html += `
            <div class="p-2 bg-muted text-xs font-medium text-muted-foreground border-b">
                Technical Team Requests (${technicalRequests.length})
            </div>
        `;
        
        technicalRequests.forEach(request => {
            html += `
                <div class="p-3 hover:bg-muted cursor-pointer border-b search-result-item" 
                     data-type="technical_request" 
                     data-id="${request.id}" 
                     data-name="${request.name}">
                    <div class="font-medium text-sm">${highlightMatch(request.name, searchTerm)}</div>
                    <div class="text-xs text-muted-foreground">
                        Account: ${request.account || 'N/A'} • Status: ${request.status || 'N/A'}
                    </div>
                </div>
            `;
        });
    }
    
    // Accounts section
    if (accounts.length > 0) {
        html += `
            <div class="p-2 bg-muted text-xs font-medium text-muted-foreground border-b">
                Accounts (${accounts.length})
            </div>
        `;
        
        accounts.forEach(account => {
            html += `
                <div class="p-3 hover:bg-muted cursor-pointer border-b search-result-item" 
                     data-type="account" 
                     data-id="${account.id}" 
                     data-name="${account.name}">
                    <div class="font-medium text-sm">${highlightMatch(account.name, searchTerm)}</div>
                    <div class="text-xs text-muted-foreground">
                        ${account.type ? `Type: ${account.type}` : ''} 
                        ${account.industry ? `• Industry: ${account.industry}` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    dropdown.innerHTML = html;
    
    // Add click listeners to search results
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', handleSearchResultClick);
    });
    
    showSearchDropdown();
}

// Highlight matching text in search results
function highlightMatch(text, searchTerm) {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
}

// Handle search result selection
function handleSearchResultClick(event) {
    const item = event.currentTarget;
    const name = item.dataset.name;
    const type = item.dataset.type;
    
    // Clear exact match filter when user selects from type-ahead
    if (exactMatchFilter) {
        console.log('🔍 Clearing exact match filter - user selected from type-ahead');
        exactMatchFilter = null;
    }
    
    // Set the search input value
    const searchInput = document.getElementById('provisioning-search');
    if (searchInput) {
        searchInput.value = name;
    }
    
    // Hide dropdown
    hideSearchDropdown();
    
    // Trigger search with the selected item
    handleProvisioningSearch({ target: { value: name } });
    
    console.log(`Selected ${type}: ${name}`);
}

// Handle keyboard navigation in search
function handleSearchKeyDown(event) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    
    const items = dropdown.querySelectorAll('.search-result-item');
    if (items.length === 0) return;
    
    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('bg-accent')) {
            currentIndex = index;
        }
    });
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            selectSearchResult(items, nextIndex);
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            selectSearchResult(items, prevIndex);
            break;
            
        case 'Enter':
            event.preventDefault();
            if (currentIndex >= 0) {
                items[currentIndex].click();
            }
            break;
            
        case 'Escape':
            event.preventDefault();
            hideSearchDropdown();
            break;
    }
}

// Select search result with keyboard
function selectSearchResult(items, index) {
    items.forEach(item => item.classList.remove('bg-accent'));
    if (items[index]) {
        items[index].classList.add('bg-accent');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// Show/hide search dropdown
function showSearchDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) {
        dropdown.classList.remove('hidden');
        searchDropdownVisible = true;
    }
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        searchDropdownVisible = false;
    }
}

// Handle search input focus/blur
function handleSearchFocus() {
    if (currentSearchTerm.length >= 2) {
        showSearchDropdown();
    }
}

function handleSearchBlur() {
    // Delay hiding to allow clicks on dropdown items
    setTimeout(() => {
        hideSearchDropdown();
    }, 200);
}

// Handle document click to close dropdown
function handleDocumentClick(event) {
    const searchContainer = document.getElementById('provisioning-search')?.parentElement;
    if (searchContainer && !searchContainer.contains(event.target)) {
        hideSearchDropdown();
    }
}

// Load provisioning requests with filters and pagination
async function loadProvisioningRequests(filters = {}) {
    if (provisioningPagination.isLoading) return;
    
    provisioningPagination.isLoading = true;
    
    // Update timestamp when loading
    updateLastRefreshTimestamp('provisioning');
    
    try {
        console.log(`Loading provisioning requests (page ${provisioningPagination.currentPage})...`);
        
        // Show loading state
        showProvisioningLoading();
        
        // Build query parameters
        const queryParams = new URLSearchParams();
        if (filters.requestType) queryParams.set('requestType', filters.requestType);
        if (filters.accountId) queryParams.set('accountId', filters.accountId);
        if (filters.status) queryParams.set('status', filters.status);
        if (filters.search) queryParams.set('search', filters.search);
        
        // Add pagination parameters
        queryParams.set('pageSize', provisioningPagination.pageSize.toString());
        const offset = (provisioningPagination.currentPage - 1) * provisioningPagination.pageSize;
        queryParams.set('offset', offset.toString());
        
        const url = `/api/provisioning/requests?${queryParams.toString()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('🔍 Raw API Response:', {
            url: url,
            success: data.success,
            recordsCount: data.records ? data.records.length : 0,
            totalCount: data.totalCount,
            totalCountType: typeof data.totalCount,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            fullResponse: data
        });
        
        if (data.success) {
            // Load current page records
            provisioningData = data.records || [];
            filteredProvisioningData = [...provisioningData];
            
            // Update pagination state
            provisioningPagination.totalCount = data.totalCount !== undefined ? data.totalCount : 0;
            provisioningPagination.totalPages = data.totalPages !== undefined ? data.totalPages : 1;
            
            console.log(`✅ Loaded ${data.records.length} provisioning requests (page ${provisioningPagination.currentPage} of ${provisioningPagination.totalPages})`);
            console.log('🔍 Pagination state before update:', {
                totalCount: provisioningPagination.totalCount,
                currentPage: provisioningPagination.currentPage,
                totalPages: provisioningPagination.totalPages
            });
            
            // Process validation for loaded data
            await processValidationResults();
            
            renderProvisioningTable(filteredProvisioningData);
            updateProvisioningCount();
            updatePaginationInfo();
            
        } else {
            console.error('Failed to load provisioning requests:', data.error);
            showProvisioningError(data.error || 'Failed to load requests');
            // Set default values on error
            provisioningPagination.totalCount = 0;
            provisioningPagination.totalPages = 0;
            updateProvisioningCount();
        }
        
    } catch (err) {
        console.error('Error loading provisioning requests:', err);
        showProvisioningError('Network error while loading requests');
        // Set default values on error
        provisioningPagination.totalCount = 0;
        provisioningPagination.totalPages = 0;
        updateProvisioningCount();
    } finally {
        provisioningPagination.isLoading = false;
    }
}

// Get current filter values from UI
function getCurrentFilters() {
    const searchInput = document.getElementById('provisioning-search');
    const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
    const statusFilter = document.getElementById('provisioning-status-filter');
    
    return {
        search: searchInput?.value || '',
        requestType: requestTypeFilter?.value || '',
        status: statusFilter?.value || ''
    };
}

// Update provisioning count display
function updateProvisioningCount() {
    const countElement = document.getElementById('provisioning-count');
    if (!countElement) {
        console.error('❌ provisioning-count element not found');
        return;
    }
    
    const totalRecords = provisioningPagination.totalCount;
    
    console.log('🔢 [COUNT] Updating provisioning count:', {
        totalCount: totalRecords,
        totalCountType: typeof totalRecords,
        isUndefined: totalRecords === undefined,
        isNull: totalRecords === null,
        isNumber: typeof totalRecords === 'number',
        fullPaginationState: provisioningPagination
    });
    
    // Always make it visible and set the text
    countElement.style.visibility = 'visible';
    countElement.style.display = 'block';
    
    // More defensive checking
    if (typeof totalRecords === 'number' && !isNaN(totalRecords) && totalRecords >= 0) {
        if (totalRecords === 0) {
            countElement.textContent = 'No requests found';
        } else {
            countElement.textContent = `${totalRecords} total requests`;
        }
        console.log('✅ [COUNT] Set valid count:', countElement.textContent);
    } else {
        console.warn('⚠️ [COUNT] Invalid totalRecords, showing loading:', totalRecords);
        countElement.textContent = 'Loading...';
    }
}

// Show loading state for provisioning table
function showProvisioningLoading() {
    const tbody = document.getElementById('provisioning-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="px-4 py-8 text-center">
                <div class="space-y-4">
                    <div class="loading-spinner mx-auto"></div>
                    <p class="text-sm text-muted-foreground">Loading provisioning requests...</p>
                </div>
            </td>
        </tr>
    `;
    
    // Update count during loading
    const countElement = document.getElementById('provisioning-count');
    if (countElement) {
        countElement.textContent = 'Loading...';
    }
}

// Show error state for provisioning table
function showProvisioningError(message) {
    const tbody = document.getElementById('provisioning-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="px-4 py-8 text-center">
                <div class="space-y-4">
                    <svg class="h-12 w-12 mx-auto text-red-500 opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <div>
                        <p class="font-medium text-red-600">Error Loading Requests</p>
                        <p class="text-sm text-muted-foreground">${message}</p>
                    </div>
                </div>
            </td>
        </tr>
    `;
    
    // Show count with error message
    const countElement = document.getElementById('provisioning-count');
    if (countElement) {
        countElement.textContent = 'Error loading data';
    }
}

// Render provisioning table
function renderProvisioningTable(data) {
    const tbody = document.getElementById('provisioning-table-body');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-muted-foreground">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"></path>
                            <path d="m15 9-6 6"></path>
                            <path d="m9 9 6 6"></path>
                        </svg>
                        <span>No provisioning requests found</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(request => `
        <tr class="hover:bg-muted/50 transition-colors">
            <td class="px-4 py-3">
                <div class="font-medium text-sm">${request.Name || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Account__c || 'N/A'}</div>
                ${request.Account_Site__c ? `<div class="text-xs text-muted-foreground">Site: ${request.Account_Site__c}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRequestTypeColor(request.TenantRequestAction__c)}">
                    ${request.TenantRequestAction__c || 'N/A'}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Deployment__r?.Name || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                ${getProductsDisplay(request)}
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(request.Status__c)}">
                    ${request.Status__c || 'N/A'}
                </span>
                ${request.Billing_Status__c ? `<div class="text-xs text-muted-foreground mt-1">Billing: ${request.Billing_Status__c}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${formatDate(request.CreatedDate)}</div>
                ${request.LastModifiedDate ? `<div class="text-xs text-muted-foreground">Modified: ${formatDate(request.LastModifiedDate)}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.CreatedBy?.Name || 'N/A'}</div>
            </td>
        </tr>
    `).join('');
}

// Update pagination info display
function updatePaginationInfo() {
    const paginationInfo = document.getElementById('pagination-info');
    const pageIndicator = document.getElementById('page-indicator');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    
    if (paginationInfo) {
        const startRecord = ((provisioningPagination.currentPage - 1) * provisioningPagination.pageSize) + 1;
        const endRecord = Math.min(provisioningPagination.currentPage * provisioningPagination.pageSize, provisioningPagination.totalCount);
        const totalRecords = provisioningPagination.totalCount;
        
        console.log('📄 [PAGINATION] Updating pagination info:', {
            totalRecords: totalRecords,
            totalRecordsType: typeof totalRecords,
            startRecord: startRecord,
            endRecord: endRecord,
            fullPaginationState: provisioningPagination
        });
        
        if (totalRecords === 0) {
            paginationInfo.textContent = 'No records to display';
        } else {
            paginationInfo.textContent = `Showing ${startRecord}-${endRecord} of ${totalRecords} records`;
        }
    }
    
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${provisioningPagination.currentPage} of ${provisioningPagination.totalPages}`;
    }
    
    // Update button states
    if (prevPageBtn) {
        prevPageBtn.disabled = provisioningPagination.currentPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = provisioningPagination.currentPage >= provisioningPagination.totalPages;
    }
}

// Handle previous page navigation
async function handlePreviousPage() {
    if (provisioningPagination.currentPage > 1) {
        
        provisioningPagination.currentPage--;
        const filters = getCurrentFilters();
        await loadProvisioningRequests(filters);
    }
}

// Handle next page navigation
async function handleNextPage() {
    if (provisioningPagination.currentPage < provisioningPagination.totalPages) {
        
        provisioningPagination.currentPage++;
        const filters = getCurrentFilters();
        await loadProvisioningRequests(filters);
    }
}

// Get products display for provisioning request - REMOVED DUPLICATE

// Get status color classes
function getStatusColor(status) {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('complete') || statusLower.includes('active')) {
        return 'bg-green-100 text-green-800';
    } else if (statusLower.includes('progress') || statusLower.includes('pending')) {
        return 'bg-blue-100 text-blue-800';
    } else if (statusLower.includes('error') || statusLower.includes('failed')) {
        return 'bg-red-100 text-red-800';
    } else if (statusLower.includes('waiting') || statusLower.includes('hold')) {
        return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-gray-100 text-gray-800';
}

// Get request type color classes
function getRequestTypeColor(requestType) {
    if (!requestType) return 'bg-gray-100 text-gray-800';
    
    const typeLower = requestType.toLowerCase();
    if (typeLower.includes('new') || typeLower.includes('create')) {
        return 'bg-blue-100 text-blue-800';
    } else if (typeLower.includes('update') || typeLower.includes('modify')) {
        return 'bg-orange-100 text-orange-800';
    } else if (typeLower.includes('delete') || typeLower.includes('remove')) {
        return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
}

// Get products display with enhanced formatting
function getProductsDisplay(request) {
    if (!request.Payload_Data__c) {
        return '<span class="text-muted-foreground text-xs">No payload data</span>';
    }
    
    try {
        const payload = JSON.parse(request.Payload_Data__c);
        
        // Extract entitlements from the nested structure
        const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
        const modelEntitlements = entitlements.modelEntitlements || [];
        const dataEntitlements = entitlements.dataEntitlements || [];
        const appEntitlements = entitlements.appEntitlements || [];
        
        const totalCount = modelEntitlements.length + dataEntitlements.length + appEntitlements.length;
        
        if (totalCount === 0) {
            return '<span class="text-muted-foreground text-xs">No entitlements</span>';
        }
        
        // Create interactive summary with expandable groups
        const groups = [];
        
        if (modelEntitlements.length > 0) {
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    data-request-id="${request.Id}"
                    data-group-type="models"
                    data-entitlements="${JSON.stringify(modelEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="21" cy="11" r="8"></circle>
                        <path d="M21 21l-4.35-4.35"></path>
                    </svg>
                    <span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-medium">${modelEntitlements.length}</span>
                    Models
                </button>
            `);
        }
        
        if (dataEntitlements.length > 0) {
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                    data-request-id="${request.Id}"
                    data-group-type="data"
                    data-entitlements="${JSON.stringify(dataEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    </svg>
                    <span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full text-xs font-medium">${dataEntitlements.length}</span>
                    Data
                </button>
            `);
        }
        
        if (appEntitlements.length > 0) {
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                    data-request-id="${request.Id}"
                    data-group-type="apps"
                    data-entitlements="${JSON.stringify(appEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="7" height="7" x="3" y="3" rx="1"></rect>
                        <rect width="7" height="7" x="14" y="3" rx="1"></rect>
                        <rect width="7" height="7" x="14" y="14" rx="1"></rect>
                        <rect width="7" height="7" x="3" y="14" rx="1"></rect>
                    </svg>
                    <span class="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full text-xs font-medium">${appEntitlements.length}</span>
                    Apps
                </button>
            `);
        }
        
        return `
            <div class="flex flex-col gap-1">
                ${groups.join('')}
            </div>
        `;
        
    } catch (err) {
        console.error('Error parsing payload:', err);
        return '<span class="text-red-500 text-xs">Invalid JSON</span>';
    }
}

// Show specific product group details in a modal
function showProductGroup(requestId, groupType, entitlements) {
    // Try to find the request in provisioning data first, then in account history
    let request = provisioningData.find(r => r.Id === requestId);
    if (!request && currentAccountHistory && currentAccountHistory.requests) {
        request = currentAccountHistory.requests.find(r => r.Id === requestId);
    }
    
    if (!request) {
        console.error('Request not found in provisioning or account history data:', requestId);
        return;
    }
    
    // Parse the entitlements if they're passed as a string
    let items = entitlements;
    if (typeof entitlements === 'string') {
        try {
            items = JSON.parse(entitlements.replace(/&quot;/g, '"'));
        } catch (err) {
            console.error('Error parsing entitlements:', err);
            alert('Error parsing product data');
            return;
        }
    }
    
    // Get validation results for this request (mainly for provisioning monitor)
    const validationResult = validationResults.get(requestId);
    
    // Create and show modal
    showProductModal(request.Name, groupType, items, validationResult);
}

// Create and display product modal
function showProductModal(requestName, groupType, items, validationResult = null) {
    // Remove existing modal if any and clean up event listeners
    const existingModal = document.getElementById('product-modal');
    if (existingModal) {
        existingModal.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleModalEscape);
    }
    
    // Create modal HTML
    const groupTitle = {
        'models': 'Model Entitlements',
        'data': 'Data Entitlements', 
        'apps': 'App Entitlements'
    }[groupType] || 'Product Entitlements';
    
    const groupIcon = {
        'models': `<svg class="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="21" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
        </svg>`,
        'data': `<svg class="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>`,
        'apps': `<svg class="h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1"></rect>
            <rect width="7" height="7" x="14" y="3" rx="1"></rect>
            <rect width="7" height="7" x="14" y="14" rx="1"></rect>
            <rect width="7" height="7" x="3" y="14" rx="1"></rect>
        </svg>`
    }[groupType] || '';
    
    const modalHTML = `
        <div id="product-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="closeProductModal(event)">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onclick="event.stopPropagation()">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-6 border-b">
                    <div class="flex items-center gap-3">
                        ${groupIcon}
                        <div>
                            <h2 class="text-lg font-semibold">${groupTitle}</h2>
                            <p class="text-sm text-muted-foreground">${requestName} • ${items.length} item${items.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onclick="closeProductModal()" class="text-muted-foreground hover:text-foreground">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Modal Body -->
                <div class="p-6 overflow-y-auto max-h-[60vh]">
                    <div id="entitlements-table-container" data-group-type="${groupType}" data-items='${JSON.stringify(items).replace(/"/g, '&quot;')}' data-validation-result='${JSON.stringify(validationResult || {}).replace(/"/g, '&quot;')}' data-sort-key="" data-sort-direction="asc">
                        ${renderProductItems(items, groupType, validationResult)}
                    </div>
                </div>
                
                <!-- Modal Footer -->
                <div class="flex justify-end gap-3 p-6 border-t bg-muted/20">
                    <button onclick="closeProductModal()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Add escape key listener
    document.addEventListener('keydown', handleModalEscape);

    // Attach sorting handlers for entitlements table
    try {
        const container = document.getElementById('entitlements-table-container');
        if (container) {
            container.addEventListener('click', (ev) => {
                const th = ev.target.closest && ev.target.closest('th[data-sort-key]');
                if (!th) return;
                const sortKey = th.getAttribute('data-sort-key');
                const currentKey = container.getAttribute('data-sort-key') || '';
                let direction = container.getAttribute('data-sort-direction') || 'asc';
                if (currentKey === sortKey) {
                    direction = direction === 'asc' ? 'desc' : 'asc';
                } else {
                    direction = 'asc';
                }

                container.setAttribute('data-sort-key', sortKey);
                container.setAttribute('data-sort-direction', direction);

                let itemsRaw = container.getAttribute('data-items') || '[]';
                try { itemsRaw = itemsRaw.replace(/&quot;/g, '"'); } catch {}
                let parsed = [];
                try { parsed = JSON.parse(itemsRaw); } catch { parsed = []; }

                // Define accessors matching renderProductItems columns
                const accessors = {
                    productCode: (it) => it.productCode || it.product_code || it.ProductCode || it.name || '',
                    startDate: (it) => it.startDate || it.start_date || it.StartDate || '',
                    endDate: (it) => it.endDate || it.end_date || it.EndDate || '',
                    modifier: (it) => it.productModifier || it.ProductModifier || '',
                    quantity: (it) => (it.quantity !== undefined ? it.quantity : (it.Quantity !== undefined ? it.Quantity : ''))
                };

                const accessor = accessors[sortKey] || (() => '');
                parsed.sort((a, b) => {
                    const av = accessor(a);
                    const bv = accessor(b);
                    const na = typeof av === 'number' ? av : (Number(av) || NaN);
                    const nb = typeof bv === 'number' ? bv : (Number(bv) || NaN);
                    let cmp;
                    if (!isNaN(na) && !isNaN(nb)) {
                        cmp = na - nb;
                    } else {
                        cmp = String(av).localeCompare(String(bv));
                    }
                    return direction === 'asc' ? cmp : -cmp;
                });

                container.setAttribute('data-items', JSON.stringify(parsed).replace(/"/g, '&quot;'));
                const storedValidationResult = container.getAttribute('data-validation-result');
                let validationResult = null;
                try {
                    validationResult = storedValidationResult ? JSON.parse(storedValidationResult.replace(/&quot;/g, '"')) : null;
                } catch (e) {
                    console.warn('Error parsing stored validation result:', e);
                }
                container.innerHTML = renderProductItems(parsed, container.getAttribute('data-group-type'), validationResult);
            }, true);
        }
    } catch (e) {
        console.warn('Failed to bind entitlements sorting:', e);
    }
}

// Render product items based on type
function renderProductItems(items, groupType, validationResult = null) {
    if (items.length === 0) {
        return '<p class="text-muted-foreground text-center py-8">No items found</p>';
    }

    // Accessors to normalize common fields across varying payload shapes
    const getProductCode = (it) => it.productCode || it.product_code || it.ProductCode || it.name || '—';
    const getStartDate = (it) => it.startDate || it.start_date || it.StartDate || '—';
    const getEndDate = (it) => it.endDate || it.end_date || it.EndDate || '—';
    const getQuantity = (it) => (it.quantity !== undefined ? it.quantity : (it.Quantity !== undefined ? it.Quantity : '—'));
    const getModifier = (it) => it.productModifier || it.ProductModifier || '—';
    const getPackageName = (it) => it.packageName || it.package_name || it.PackageName || '—';

    // Group items by product code (name) to consolidate duplicate products with different dates
    const groupedProducts = new Map();
    items.forEach((item, originalIndex) => {
        const productCode = getProductCode(item);
        const startDate = getStartDate(item);
        const endDate = getEndDate(item);
        
        if (!groupedProducts.has(productCode)) {
            groupedProducts.set(productCode, {
                productCode: productCode,
                items: [],
                minStartDate: startDate,
                maxEndDate: endDate,
                // Store first item's other fields as defaults
                defaultItem: item
            });
        }
        
        const group = groupedProducts.get(productCode);
        group.items.push({ ...item, originalIndex });
        
        // Update min/max dates
        if (startDate !== '—' && (group.minStartDate === '—' || new Date(startDate) < new Date(group.minStartDate))) {
            group.minStartDate = startDate;
        }
        if (endDate !== '—' && (group.maxEndDate === '—' || new Date(endDate) > new Date(group.maxEndDate))) {
            group.maxEndDate = endDate;
        }
    });

    // Helper function to check if an entitlement has validation issues
    const hasValidationIssue = (item, index) => {
        if (!validationResult || validationResult.overallStatus !== 'FAIL') return false;
        
        // Look for date overlap validation failures
        const dateOverlapRule = validationResult.ruleResults?.find(rule => 
            rule.ruleId === 'entitlement-date-overlap-validation' && rule.status === 'FAIL'
        );
        
        if (dateOverlapRule?.details?.overlaps) {
            // Map UI groupType to validation engine type
            const validationGroupType = {
                'models': 'model',
                'apps': 'app', 
                'data': 'data'
            }[groupType] || groupType;
            
            // Check if this item is involved in any overlaps
            const hasOverlap = dateOverlapRule.details.overlaps.some(overlap => 
                (overlap.entitlement1.type === validationGroupType && overlap.entitlement1.index === (index + 1)) ||
                (overlap.entitlement2.type === validationGroupType && overlap.entitlement2.index === (index + 1))
            );
            
            if (hasOverlap) return true;
        }
        
        // Look for app quantity validation failures (only for apps groupType)
        if (groupType === 'apps') {
            const appQuantityRule = validationResult.ruleResults?.find(rule => 
                rule.ruleId === 'app-quantity-validation' && rule.status === 'FAIL'
            );
            
            if (appQuantityRule?.details?.failures && appQuantityRule.details.failures.length > 0) {
                // Check if this specific app failed
                const productCode = item.productCode || item.product_code || item.ProductCode;
                const quantity = item.quantity;
                
                // An app fails if quantity !== 1 AND productCode !== "IC-DATABRIDGE"
                if (quantity !== 1 && productCode !== "IC-DATABRIDGE") {
                    return true;
                }
            }
        }
        
        return false;
    };

    // Determine columns per group type
    let columns;
    if (groupType === 'models') {
        columns = [
            { key: 'productCode', label: 'Product Code', get: getProductCode },
            { key: 'startDate', label: 'Start Date', get: getStartDate },
            { key: 'endDate', label: 'End Date', get: getEndDate },
            { key: 'modifier', label: 'Modifier', get: getModifier }
        ];
    } else if (groupType === 'apps') {
        columns = [
            { key: 'productCode', label: 'Product Code', get: getProductCode },
            { key: 'packageName', label: 'Package Name', get: getPackageName, showInfo: true }, // Flag to show info icon
            { key: 'quantity', label: 'Quantity', get: getQuantity },
            { key: 'startDate', label: 'Start Date', get: getStartDate },
            { key: 'endDate', label: 'End Date', get: getEndDate }
        ];
    } else {
        // data entitlements
        columns = [
            { key: 'productCode', label: 'Product Code', get: getProductCode },
            { key: 'startDate', label: 'Start Date', get: getStartDate },
            { key: 'endDate', label: 'End Date', get: getEndDate }
        ];
    }

    // Render as a single consolidated table for readability  
    const headerHtml = `
        <tr>
            <th class="px-1 py-2 w-4 text-center text-xs font-medium text-muted-foreground">⚠</th>
            ${columns.map(c => `<th class=\"px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none\" data-sort-key=\"${c.key}\">${c.label} <span class=\"sort-indicator opacity-50\">↕</span></th>`).join('')}
        </tr>
    `;

    // Render grouped products with expandable rows
    const rowsHtml = Array.from(groupedProducts.values()).map((group, groupIndex) => {
        const isMultiple = group.items.length > 1;
        const groupId = `product-group-${groupIndex}`;
        
        // Check if any item in the group has validation issues
        const hasGroupIssue = group.items.some(item => hasValidationIssue(item, item.originalIndex));
        
        // Build main row (consolidated view)
        const mainRowClass = hasGroupIssue 
            ? 'border-b group-row bg-red-25 border-red-200 hover:bg-red-50 transition-colors' 
            : 'border-b group-row hover:bg-gray-50 transition-colors';
        
        const mainRow = `
            <tr class="${mainRowClass}" data-group-id="${groupId}" ${isMultiple ? `style="cursor: pointer;" onclick="toggleProductGroup('${groupId}')"` : ''} ${hasGroupIssue ? 'title="This product group contains validation issues"' : ''}>
                <td class="px-1 py-2 w-4 text-center">
                    ${isMultiple ? `
                        <svg class="h-4 w-4 text-gray-500 expand-icon transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    ` : hasGroupIssue ? `
                        <svg class="h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                            <path d="M12 9v4"></path>
                            <path d="m12 17 .01 0"></path>
                        </svg>
                    ` : ''}
                </td>
                ${columns.map(c => {
                    let value;
                    if (c.key === 'startDate') {
                        value = escapeHtml(String(group.minStartDate));
                    } else if (c.key === 'endDate') {
                        value = escapeHtml(String(group.maxEndDate));
                    } else {
                        value = escapeHtml(String(c.get(group.defaultItem)));
                    }
                    
                    const cellContent = isMultiple && (c.key === 'productCode') 
                        ? `<span class="font-medium">${value}</span><span class="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">${group.items.length} instances</span>`
                        : value;
                    
                    // Add info icon for package names in apps modal
                    if (c.showInfo && value !== '—' && value) {
                        return `<td class="px-3 py-2 text-sm">
                            <div class="flex items-center gap-2">
                                <span>${cellContent}</span>
                                <button 
                                    class="package-info-btn inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors p-1"
                                    data-package-name="${value.replace(/"/g, '&quot;')}"
                                    title="View package details"
                                    onclick="event.stopPropagation(); showPackageInfo('${value.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')"
                                >
                                    <svg class="h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M12 16v-4"></path>
                                        <path d="m12 8 .01 0"></path>
                                    </svg>
                                </button>
                            </div>
                        </td>`;
                    }
                    return `<td class="px-3 py-2 text-sm">${cellContent}</td>`;
                }).join('')}
            </tr>
        `;
        
        // Build child rows (individual instances) - hidden by default
        const childRows = isMultiple ? group.items.map((item, itemIndex) => {
            const hasIssue = hasValidationIssue(item, item.originalIndex);
            const childRowClass = hasIssue 
                ? 'child-row bg-red-25 border-red-200 border-b' 
                : 'child-row bg-gray-50 border-b';
            
            return `
                <tr class="${childRowClass}" data-parent-group="${groupId}" style="display: none;" ${hasIssue ? 'title="This entitlement has a validation failure"' : ''}>
                    <td class="px-1 py-2 w-4 text-center pl-6">
                        ${hasIssue ? `
                            <svg class="h-3 w-3 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                <path d="M12 9v4"></path>
                                <path d="m12 17 .01 0"></path>
                            </svg>
                        ` : `<span class="text-xs text-gray-400">${itemIndex + 1}</span>`}
                    </td>
                    ${columns.map(c => {
                        const value = escapeHtml(String(c.get(item)));
                        // Add info icon for package names in apps modal
                        if (c.showInfo && value !== '—' && value) {
                            return `<td class="px-3 py-2 text-sm text-gray-700">
                                <div class="flex items-center gap-2">
                                    <span>${value}</span>
                                    <button 
                                        class="package-info-btn inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors p-1"
                                        data-package-name="${value.replace(/"/g, '&quot;')}"
                                        title="View package details"
                                        onclick="event.stopPropagation(); showPackageInfo('${value.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')"
                                    >
                                        <svg class="h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 16v-4"></path>
                                            <path d="m12 8 .01 0"></path>
                                        </svg>
                                    </button>
                                </div>
                            </td>`;
                        }
                        return `<td class="px-3 py-2 text-sm text-gray-700">${value}</td>`;
                    }).join('')}
                </tr>
            `;
        }).join('') : '';
        
        return mainRow + childRows;
    }).join('');

    return `
        <div class=\"rounded-lg border bg-card text-card-foreground shadow-sm\">
            <div class=\"overflow-x-auto\">
                <table class=\"w-full text-sm\" id=\"entitlements-table\">
                    <thead class=\"border-b bg-muted/50\">
                        ${headerHtml}
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Simple HTML escaper for table cell content
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Toggle expand/collapse for product groups
function toggleProductGroup(groupId) {
    const mainRow = document.querySelector(`tr[data-group-id="${groupId}"]`);
    const childRows = document.querySelectorAll(`tr[data-parent-group="${groupId}"]`);
    const expandIcon = mainRow?.querySelector('.expand-icon');
    
    if (!mainRow || childRows.length === 0) return;
    
    const isExpanded = childRows[0].style.display !== 'none';
    
    // Toggle visibility of child rows
    childRows.forEach(row => {
        row.style.display = isExpanded ? 'none' : 'table-row';
    });
    
    // Rotate the expand icon
    if (expandIcon) {
        if (isExpanded) {
            expandIcon.style.transform = 'rotate(0deg)';
        } else {
            expandIcon.style.transform = 'rotate(90deg)';
        }
    }
}

// Close product modal
function closeProductModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.remove();
    }
    
    // Always clean up, even if modal doesn't exist
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalEscape);
}

// Handle escape key for modal
function handleModalEscape(event) {
    if (event.key === 'Escape') {
        // Check if modal actually exists before trying to close
        const modal = document.getElementById('product-modal');
        if (modal) {
            closeProductModal();
        }
        // Also close package info tooltip if open
        const tooltip = document.getElementById('package-info-tooltip');
        if (tooltip) {
            closePackageInfo();
        }
    }
}

// ===== PACKAGE INFO HELPER FUNCTIONS =====

// Cache for package data to avoid repeated API calls
const packageCache = new Map();

/**
 * Fetch package details from the API
 * @param {string} packageName - The package name to look up
 * @returns {Promise<Object|null>} Package data or null if not found
 */
async function fetchPackageInfo(packageName) {
    // Check cache first
    if (packageCache.has(packageName)) {
        return packageCache.get(packageName);
    }
    
    try {
        const response = await fetch(`/api/packages/${encodeURIComponent(packageName)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Package not found: ${packageName}`);
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.package) {
            // Cache the result
            packageCache.set(packageName, data.package);
            return data.package;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching package info:', error);
        return null;
    }
}

/**
 * Show package information tooltip
 * @param {string} packageName - The package name to display info for
 */
async function showPackageInfo(packageName) {
    // Remove any existing tooltip
    closePackageInfo();
    
    // Create loading tooltip
    const loadingTooltip = document.createElement('div');
    loadingTooltip.id = 'package-info-tooltip';
    loadingTooltip.className = 'fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center';
    loadingTooltip.style.zIndex = '9999'; // Ensure it's above the product modal
    loadingTooltip.onclick = (e) => { if (e.target === loadingTooltip) closePackageInfo(); };
    
    loadingTooltip.innerHTML = `
        <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 p-6" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Package Information</h3>
                <button onclick="closePackageInfo()" class="text-gray-400 hover:text-gray-600">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="flex items-center justify-center py-8">
                <div class="loading-spinner"></div>
                <span class="ml-3 text-gray-600">Loading package details...</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(loadingTooltip);
    
    // Fetch package data
    const packageData = await fetchPackageInfo(packageName);
    
    // Update tooltip with package data or error
    const tooltipElement = document.getElementById('package-info-tooltip');
    if (!tooltipElement) return; // User closed it while loading
    
    if (packageData) {
        tooltipElement.innerHTML = `
            <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onclick="event.stopPropagation()">
                <!-- Header -->
                <div class="flex items-start justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <svg class="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-900">${escapeHtml(packageData.package_name)}</h3>
                        </div>
                        ${packageData.ri_package_name ? `<p class="text-sm text-gray-500">RI Package: ${escapeHtml(packageData.ri_package_name)}</p>` : ''}
                        ${packageData.package_type ? `<span class="inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${packageData.package_type === 'Base' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${escapeHtml(packageData.package_type)}</span>` : ''}
                    </div>
                    <button onclick="closePackageInfo()" class="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Description -->
                ${packageData.description ? `
                    <div class="p-6 border-b">
                        <h4 class="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                        <p class="text-sm text-gray-600 leading-relaxed">${escapeHtml(packageData.description)}</p>
                    </div>
                ` : ''}
                
                <!-- Capacity & Limits -->
                <div class="p-6">
                    <h4 class="text-sm font-semibold text-gray-700 mb-4">Capacity & Limits</h4>
                    <div class="grid grid-cols-2 gap-4">
                        ${packageData.locations ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Locations</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.locations).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_concurrent_model ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Concurrent Model Jobs</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.max_concurrent_model}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_concurrent_non_model ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Concurrent Non-Model Jobs</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.max_concurrent_non_model}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_jobs_day ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Jobs per Day</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.max_jobs_day).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_users ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Users</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.max_users).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${packageData.api_rps ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">API Requests/Second</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.api_rps}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_exposure_storage_tb ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Exposure Storage</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.max_exposure_storage_tb} TB</div>
                            </div>
                        ` : ''}
                        ${packageData.max_other_storage_tb ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Other Storage</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.max_other_storage_tb} TB</div>
                            </div>
                        ` : ''}
                        ${packageData.max_risks_accumulated_day ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Risks Accumulated/Day</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.max_risks_accumulated_day).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_risks_single_accumulation ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Risks Single Accumulation</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.max_risks_single_accumulation).toLocaleString()}</div>
                            </div>
                        ` : ''}
                        ${packageData.max_concurrent_accumulation_jobs ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Max Concurrent Accumulation Jobs</div>
                                <div class="text-lg font-semibold text-gray-900">${packageData.max_concurrent_accumulation_jobs}</div>
                            </div>
                        ` : ''}
                        ${packageData.number_edms ? `
                            <div class="bg-gray-50 rounded-lg p-3">
                                <div class="text-xs text-gray-500 mb-1">Number of EDMs</div>
                                <div class="text-lg font-semibold text-gray-900">${Number(packageData.number_edms).toLocaleString()}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="flex justify-end gap-3 p-6 border-t bg-gray-50">
                    <button onclick="closePackageInfo()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2">
                        Close
                    </button>
                </div>
            </div>
        `;
    } else {
        tooltipElement.innerHTML = `
            <div class="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6" onclick="event.stopPropagation()">
                <div class="flex items-start justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">Package Not Found</h3>
                    <button onclick="closePackageInfo()" class="text-gray-400 hover:text-gray-600">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="text-center py-4">
                    <svg class="h-16 w-16 text-gray-300 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="m15 9-6 6"></path>
                        <path d="m9 9 6 6"></path>
                    </svg>
                    <p class="text-gray-600 mb-2">No information found for package:</p>
                    <p class="font-semibold text-gray-900">${escapeHtml(packageName)}</p>
                </div>
                <div class="flex justify-end mt-6">
                    <button onclick="closePackageInfo()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                        Close
                    </button>
                </div>
            </div>
        `;
    }
}

/**
 * Close the package info tooltip
 */
function closePackageInfo() {
    const tooltip = document.getElementById('package-info-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (err) {
        return 'Invalid Date';
    }
}

// Show loading state
function showProvisioningLoading() {
    const tbody = document.getElementById('provisioning-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-muted-foreground">
                    <div class="flex flex-col items-center gap-2">
                        <div class="loading-spinner"></div>
                        <span>Loading provisioning data...</span>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Show error state
function showProvisioningError(message) {
    const tbody = document.getElementById('provisioning-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-red-600">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="h-12 w-12 text-red-500/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <span>Error: ${message}</span>
                    </div>
                </td>
            </tr>
        `;
    }
}

// (Removed duplicate updateProvisioningCount(count) to avoid overriding the state-based version)

// Handle search input change
async function handleProvisioningSearch(event) {
    const searchTerm = event.target.value;
    provisioningPagination.currentPage = 1; // Reset to first page
    provisioningData = [];
    
    
    await loadProvisioningRequests({ search: searchTerm });
}

// Handle filter changes
async function handleProvisioningFilterChange() {
    provisioningPagination.currentPage = 1; // Reset to first page
    provisioningData = [];
    
    
    const filters = getCurrentFilters();
    await loadProvisioningRequests(filters);
}

// Handle refresh button
async function handleProvisioningRefresh() {
    // Clear exact match filter on refresh
    if (exactMatchFilter) {
        console.log('🔍 Clearing exact match filter - user clicked refresh');
        exactMatchFilter = null;
    }
    
    provisioningPagination.currentPage = 1; // Reset to first page
    provisioningData = [];
    
    const filters = getCurrentFilters();
    await loadProvisioningRequests(filters);
}

// Handle export button
function handleProvisioningExport() {
    if (filteredProvisioningData.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV content
    const headers = ['Technical Team Request', 'Account', 'Request Type', 'Deployment Number', 'Status', 'Created Date', 'Created By'];
    const csvContent = [
        headers.join(','),
        ...filteredProvisioningData.map(request => [
            request.Name || '',
            request.Account__c || '',
            request.TenantRequestAction__c || '',
            request.Deployment__r?.Name || '',
            request.Status__c || '',
            formatDate(request.CreatedDate),
            request.CreatedBy?.Name || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provisioning-requests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Handle table sorting
function handleProvisioningSort(sortKey) {
    if (provisioningSortConfig.key === sortKey) {
        provisioningSortConfig.direction = provisioningSortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        provisioningSortConfig.key = sortKey;
        provisioningSortConfig.direction = 'asc';
    }
    
    // Sort the data
    filteredProvisioningData.sort((a, b) => {
        let aVal, bVal;
        
        // Handle nested objects separately
        if (sortKey === 'createdBy') {
            aVal = a.CreatedBy?.Name || '';
            bVal = b.CreatedBy?.Name || '';
        } else if (sortKey === 'deployment') {
            aVal = a.Deployment__r?.Name || '';
            bVal = b.Deployment__r?.Name || '';
        } else {
            aVal = a[sortKey] || '';
            bVal = b[sortKey] || '';
        }
        
        // Handle different data types
        if (sortKey === 'CreatedDate' || sortKey === 'LastModifiedDate') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return provisioningSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return provisioningSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Update sort indicators
    document.querySelectorAll('#provisioning-table .sort-indicator').forEach(indicator => {
        indicator.textContent = '↕';
    });
    
    const currentHeader = document.querySelector(`#provisioning-table th[data-sort="${sortKey}"] .sort-indicator`);
    if (currentHeader) {
        currentHeader.textContent = provisioningSortConfig.direction === 'asc' ? '↑' : '↓';
    }
    
    // Re-render table
    renderProvisioningTable(filteredProvisioningData);
}

// Load filter options
async function loadProvisioningFilterOptions() {
    try {
        const response = await fetch('/api/provisioning/filter-options');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Populate request type filter
            const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
            if (requestTypeFilter && data.requestTypes) {
                const currentValue = requestTypeFilter.value;
                requestTypeFilter.innerHTML = '<option value="">All Request Types</option>' + 
                    data.requestTypes.map(type => 
                        `<option value="${type}" ${currentValue === type ? 'selected' : ''}>${type}</option>`
                    ).join('');
            }
            
            // Populate status filter
            const statusFilter = document.getElementById('provisioning-status-filter');
            if (statusFilter && data.statuses) {
                const currentValue = statusFilter.value;
                statusFilter.innerHTML = '<option value="">All Statuses</option>' + 
                    data.statuses.map(status => 
                        `<option value="${status}" ${currentValue === status ? 'selected' : ''}>${status}</option>`
                    ).join('');
            }
        }
    } catch (err) {
        console.error('Error loading filter options:', err);
    }
}

// Salesforce Testing Function
async function testSalesforceConnection() {
    const button = document.getElementById('test-salesforce-connection');
    const resultsDiv = document.getElementById('salesforce-results');
    
    if (!button || !resultsDiv) return;
    
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = `
        <div class="loading-spinner w-4 h-4 mr-2"></div>
        Testing...
    `;
    
    resultsDiv.innerHTML = `
        <div class="text-center py-8">
            <div class="loading-spinner mx-auto mb-4"></div>
            <p class="text-sm text-muted-foreground">Running Salesforce connectivity tests...</p>
        </div>
    `;
    
    try {
        const response = await fetch('/api/test-salesforce');
        const data = await response.json();
        
        if (data.success) {
            displaySalesforceTestResults(data, resultsDiv);
        } else {
            resultsDiv.innerHTML = `
                <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h4 class="font-medium text-destructive">Test Failed</h4>
                    </div>
                    <p class="text-sm text-muted-foreground">${data.error || 'Unknown error occurred'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Salesforce test failed:', error);
        resultsDiv.innerHTML = `
            <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 class="font-medium text-destructive">Connection Error</h4>
                </div>
                <p class="text-sm text-muted-foreground">Failed to connect to test endpoint: ${error.message}</p>
            </div>
        `;
    } finally {
        // Re-enable button
        button.disabled = false;
        button.innerHTML = `
            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"></path>
                <path d="M9.5 12.5 11 14l4-4"></path>
            </svg>
            Test Salesforce
        `;
    }
}

function displaySalesforceTestResults(data, container) {
    const getStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return '<svg class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>';
            case 'warning':
                return '<svg class="h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
            case 'error':
                return '<svg class="h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
            default:
                return '<svg class="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'success': return 'bg-green-50 border-green-200';
            case 'warning': return 'bg-yellow-50 border-yellow-200';
            case 'error': return 'bg-red-50 border-red-200';
            default: return 'bg-gray-50 border-gray-200';
        }
    };

    let html = `
        <div class="space-y-4">
            <!-- Overall Status -->
            <div class="p-4 rounded-lg border ${getStatusColor(data.overall)}">
                <div class="flex items-center gap-2 mb-2">
                    ${getStatusIcon(data.overall)}
                    <h4 class="font-medium">Overall Status: ${data.summary}</h4>
                </div>
                <p class="text-xs text-muted-foreground">Test completed at ${new Date(data.timestamp).toLocaleString()}</p>
            </div>

            <!-- Individual Tests -->
            <div class="space-y-3">
    `;

    data.tests.forEach(test => {
        html += `
            <div class="p-3 rounded-lg border ${getStatusColor(test.status)}">
                <div class="flex items-center gap-2 mb-2">
                    ${getStatusIcon(test.status)}
                    <h5 class="font-medium">${test.name}</h5>
                </div>
                <p class="text-sm text-muted-foreground mb-2">${test.message}</p>
        `;

        // Add details if available
        if (test.details) {
            html += `
                <details class="text-xs">
                    <summary class="cursor-pointer text-muted-foreground hover:text-foreground">View Details</summary>
                    <pre class="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">${JSON.stringify(test.details, null, 2)}</pre>
                </details>
            `;
        }

        // Add OAuth URL if available
        if (test.authUrl) {
            html += `
                <div class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <p class="text-xs text-blue-800 mb-1">OAuth URL Generated:</p>
                    <a href="${test.authUrl}" target="_blank" class="text-xs text-blue-600 hover:text-blue-800 underline break-all">
                        Click here to authenticate with Salesforce
                    </a>
                </div>
            `;
        }

        html += `</div>`;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}



// ===== VALIDATION RULES FUNCTIONALITY =====

// Initialize Validation Rules page
async function initializeValidationRules() {
    console.log('Validation Rules page initialized');
    
    try {
        // Load validation configuration
        loadValidationRulesConfiguration();
        
        // Setup event listeners
        setupValidationRulesEventListeners();
        
        // Load enabled rules
        enabledValidationRules = getEnabledValidationRules();
        
        console.log(' Validation Rules page initialized successfully');
    } catch (error) {
        console.error(' Error initializing Validation Rules page:', error);
    }
}

// Load and display validation rules configuration
function loadValidationRulesConfiguration() {
    const config = loadValidationConfig();
    
    // Update summary cards
    const totalRulesElement = document.getElementById('total-rules-count');
    const enabledRulesElement = document.getElementById('enabled-rules-count');
    const lastUpdatedElement = document.getElementById('last-updated-time');
    
    if (totalRulesElement) {
        totalRulesElement.textContent = config.rules.length;
    }
    
    if (enabledRulesElement) {
        const enabledCount = Object.values(config.enabledRules).filter(enabled => enabled).length;
        enabledRulesElement.textContent = enabledCount;
    }
    
    if (lastUpdatedElement) {
        const lastUpdated = new Date(config.lastUpdated);
        lastUpdatedElement.textContent = lastUpdated.toLocaleDateString() + ' ' + lastUpdated.toLocaleTimeString();
    }
    
    // Render rules list
    renderValidationRulesList(config);
}

// Toggle validation rule enabled state
function toggleValidationRule(ruleId, enabled) {
    updateRuleEnabledState(ruleId, enabled);
    
    // Reload configuration display
    loadValidationRulesConfiguration();
    
    // Update enabled rules cache
    enabledValidationRules = getEnabledValidationRules();
    
    // Re-process validation for current provisioning data if available
    if (provisioningData && provisioningData.length > 0) {
        processValidationResults().then(() => {
            // Re-render the provisioning table to show updated validation results
            if (document.getElementById('page-provisioning') && !document.getElementById('page-provisioning').classList.contains('hidden')) {
                renderProvisioningTable(filteredProvisioningData);
            }
        });
    }
    
    console.log(`[VALIDATION] Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
}

// Setup event listeners for validation rules page
function setupValidationRulesEventListeners() {
    // Test validation button
    const testBtn = document.getElementById('test-validation-btn');
    if (testBtn) {
        testBtn.addEventListener('click', testValidationRules);
    }
    
    // Debug JSON button
    const debugBtn = document.getElementById('debug-json-btn');
    if (debugBtn) {
        debugBtn.addEventListener('click', debugPayloadStructure);
    }
}

// ===== PROVISIONING MONITOR CORE FUNCTIONS =====

// Initialize Provisioning Monitor page with validation
async function initializeProvisioning() {
    console.log('Provisioning Monitor page initialized');
    
    // Set initial loading state
    const countElement = document.getElementById('provisioning-count');
    if (countElement) {
        countElement.textContent = 'Loading...';
        console.log(' Set initial loading text');
    }
    
    try {
        // Load enabled validation rules
        enabledValidationRules = getEnabledValidationRules();
        console.log('[VALIDATION] Loaded', enabledValidationRules.length, 'enabled validation rules');
        
        // Load filter options first
        await loadProvisioningFilterOptions();
        
        // Load initial data
        await loadProvisioningRequests();
        
        // Setup event listeners
        setupProvisioningEventListeners();
        
    } catch (error) {
        console.error(' Error during provisioning initialization:', error);
        if (countElement) {
            countElement.textContent = 'Error loading data';
        }
    }
}

// Load filter options for provisioning monitor
async function loadProvisioningFilterOptions() {
    try {
        console.log('Loading provisioning filter options from Salesforce...');
        
        const response = await fetch('/api/provisioning/filter-options');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(' Filter options response:', data);
        
        if (data.success) {
            // Populate Request Type filter
            const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
            if (requestTypeFilter && data.requestTypes) {
                const currentValue = requestTypeFilter.value;
                requestTypeFilter.innerHTML = '<option value="">All Request Types</option>' + 
                    data.requestTypes.map(type => 
                        `<option value="${type}" ${type === currentValue ? 'selected' : ''}>${type}</option>`
                    ).join('');
            }
            
            // Populate Status filter
            const statusFilter = document.getElementById('provisioning-status-filter');
            if (statusFilter && data.statuses) {
                const currentValue = statusFilter.value;
                statusFilter.innerHTML = '<option value="">All Statuses</option>' + 
                    data.statuses.map(status => 
                        `<option value="${status}" ${status === currentValue ? 'selected' : ''}>${status}</option>`
                    ).join('');
            }
            
            console.log(` Filter options loaded: ${data.requestTypes?.length || 0} request types, ${data.statuses?.length || 0} statuses`);
        } else {
            console.error('Failed to load filter options:', data.error);
            // Fall back to default options on error
            loadDefaultFilterOptions();
        }
    } catch (error) {
        console.error('Error loading filter options:', error);
        // Fall back to default options on error
        loadDefaultFilterOptions();
    }
}

// Load default filter options as fallback
function loadDefaultFilterOptions() {
    console.log('Loading default filter options...');
    
    const requestTypeFilter = document.getElementById('provisioning-request-type-filter');
    if (requestTypeFilter) {
        requestTypeFilter.innerHTML = `
            <option value="">All Request Types</option>
            <option value="New Implementation">New Implementation</option>
            <option value="Configuration">Configuration</option>
            <option value="Training">Training</option>
            <option value="Support">Support</option>
        `;
    }
    
    const statusFilter = document.getElementById('provisioning-status-filter');
    if (statusFilter) {
        statusFilter.innerHTML = `
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
        `;
    }
}

// Render provisioning table with validation column
function renderProvisioningTable(data) {
    const tbody = document.getElementById('provisioning-table-body');
    if (!tbody) return;
    
    // Apply exact match filter if set (from Account History navigation)
    if (exactMatchFilter && data && data.length > 0) {
        data = data.filter(record => record.Name === exactMatchFilter);
        console.log(`🔍 Applied exact match filter for: ${exactMatchFilter}, found ${data.length} record(s)`);
    }
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center">
                    <div class="flex flex-col items-center gap-2">
                        <svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 3v18h18V3H3z"></path>
                            <path d="M8 8h8v8H8V8z"></path>
                        </svg>
                        <p class="text-sm text-muted-foreground">No provisioning requests found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(request => `
        <tr class="border-b hover:bg-muted/50">
            <td class="px-4 py-3">
                <div class="font-medium">${request.Name || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Account__c || 'N/A'}</div>
                ${request.Account_Site__c ? `<div class="text-xs text-muted-foreground">${request.Account_Site__c}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.TenantRequestAction__c || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Deployment__r?.Name || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                ${getProductsDisplay(request, validationResults.get(request.Id))}
            </td>
            <td class="px-4 py-3 text-center">
                ${renderValidationColumn(request)}
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(request.Status__c)}">
                    ${request.Status__c || 'Unknown'}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${new Date(request.CreatedDate).toLocaleDateString()}</div>
                <div class="text-xs text-muted-foreground">${new Date(request.CreatedDate).toLocaleTimeString()}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.CreatedBy?.Name || 'N/A'}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <button 
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                    onclick="viewAccountHistoryForRequest('${(request.Account__c || '').replace(/'/g, "\\'")}', '${(request.Name || '').replace(/'/g, "\\'")}')"
                    title="View account history for this PS request"
                >
                    <svg class="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3v18h18"/>
                        <path d="M18 17V9"/>
                        <path d="M13 17V5"/>
                        <path d="M8 17v-3"/>
                    </svg>
                    <span class="hidden sm:inline">History</span>
                </button>
            </td>
        </tr>
    `).join('');
}

// Render validation column for a record
function renderValidationColumn(record) {
    const result = validationResults.get(record.Id);
    
    if (!result) {
        // Default to Pass if no validation result
        return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800" title="All validation rules passed">Pass</span>`;
    }
    
    const statusClass = result.overallStatus === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const tooltip = ValidationEngine.getValidationTooltip(result);
    
    return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClass}" title="${tooltip}">${result.overallStatus}</span>`;
}

// Process validation results for loaded records
async function processValidationResults() {
    if (!enabledValidationRules || enabledValidationRules.length === 0) {
        console.log('[VALIDATION] No enabled rules, skipping validation');
        return;
    }
    
    console.log('[VALIDATION] Processing validation for', provisioningData.length, 'records');
    
    // Clear previous validation results
    validationResults.clear();
    
    // Process each record
    for (const record of provisioningData) {
        try {
            const result = ValidationEngine.validateRecord(record, enabledValidationRules);
            validationResults.set(record.Id, result);
            console.log(`[VALIDATION] Record ${record.Id}: ${result.overallStatus}`);
        } catch (error) {
            console.error(`[VALIDATION] Error validating record ${record.Id}:`, error);
            // Default to PASS on validation errors
            validationResults.set(record.Id, {
                recordId: record.Id,
                overallStatus: 'PASS',
                ruleResults: [],
                hasErrors: true,
                validatedAt: new Date().toISOString()
            });
        }
    }
    
    console.log(`[VALIDATION] Completed validation for ${validationResults.size} records`);
}

// Update provisioning count display
function updateProvisioningCount() {
    const countElement = document.getElementById('provisioning-count');
    if (!countElement) {
        console.error(' provisioning-count element not found');
        return;
    }
    
    const totalRecords = provisioningPagination.totalCount;
    
    console.log(' [COUNT] Updating provisioning count:', {
        totalCount: totalRecords,
        totalCountType: typeof totalRecords,
        isUndefined: totalRecords === undefined,
        isNull: totalRecords === null,
        isNumber: typeof totalRecords === 'number',
        fullPaginationState: provisioningPagination
    });
    
    // Always make it visible and set the text
    countElement.style.visibility = 'visible';
    countElement.style.display = 'block';
    
    // More defensive checking
    if (typeof totalRecords === 'number' && !isNaN(totalRecords) && totalRecords >= 0) {
        if (totalRecords === 0) {
            countElement.textContent = 'No requests found';
        } else {
            countElement.textContent = `${totalRecords} total requests`;
        }
        console.log(' [COUNT] Set valid count:', countElement.textContent);
    } else {
        console.warn(' [COUNT] Invalid totalRecords, showing loading:', totalRecords);
        countElement.textContent = 'Loading...';
    }
}

// Utility functions for table rendering
function getStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'completed':
            return 'bg-green-100 text-green-800';
        case 'in progress':
            return 'bg-blue-100 text-blue-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'on hold':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function getProductsDisplay(request, validationResult = null) {
    if (!request.Payload_Data__c) {
        return '<span class="text-muted-foreground text-xs">No payload data</span>';
    }
    
    try {
        const payload = JSON.parse(request.Payload_Data__c);
        
        // Extract entitlements from the nested structure
        const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
        const modelEntitlements = entitlements.modelEntitlements || [];
        const dataEntitlements = entitlements.dataEntitlements || [];
        const appEntitlements = entitlements.appEntitlements || [];
        
        const totalCount = modelEntitlements.length + dataEntitlements.length + appEntitlements.length;
        
        if (totalCount === 0) {
            return '<span class="text-muted-foreground text-xs">No entitlements</span>';
        }
        
        // Check for date overlap validation failures
        let hasDateOverlapFailure = false;
        let dateOverlapDetails = null;
        if (validationResult && validationResult.overallStatus === 'FAIL') {
            const dateOverlapRule = validationResult.ruleResults.find(rule => 
                rule.ruleId === 'entitlement-date-overlap-validation' && rule.status === 'FAIL'
            );
            if (dateOverlapRule) {
                hasDateOverlapFailure = true;
                dateOverlapDetails = dateOverlapRule.details;
            }
        }
        
        // Helper function to check if an entitlement type/index has overlap issues
        const hasOverlapIssue = (type, index) => {
            if (!hasDateOverlapFailure || !dateOverlapDetails?.overlaps) return false;
            return dateOverlapDetails.overlaps.some(overlap => 
                (overlap.entitlement1.type === type && overlap.entitlement1.index === (index + 1)) ||
                (overlap.entitlement2.type === type && overlap.entitlement2.index === (index + 1))
            );
        };
        
        // Create interactive summary with expandable groups
        const groups = [];
        
        if (modelEntitlements.length > 0) {
            const hasModelOverlap = modelEntitlements.some((_, index) => hasOverlapIssue('model', index));
            
            // Check for model count validation failures
            let hasModelCountFailure = false;
            if (validationResult && validationResult.overallStatus === 'FAIL') {
                const modelCountRule = validationResult.ruleResults.find(rule => 
                    rule.ruleId === 'model-count-validation' && rule.status === 'FAIL'
                );
                if (modelCountRule) {
                    hasModelCountFailure = true;
                }
            }
            
            const outliveClass = (hasModelOverlap || hasModelCountFailure) ? 'ring-2 ring-red-400' : '';
            
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors ${outliveClass}"
                    data-request-id="${request.Id}"
                    data-group-type="models"
                    data-entitlements="${JSON.stringify(modelEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    ${modelEntitlements.length} Model${modelEntitlements.length > 1 ? 's' : ''}
                </button>
            `);
        }
        
        if (dataEntitlements.length > 0) {
            const hasDataOverlap = dataEntitlements.some((_, index) => hasOverlapIssue('data', index));
            const outliveClass = hasDataOverlap ? 'ring-2 ring-red-400' : '';
            
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors ${outliveClass}"
                    data-request-id="${request.Id}"
                    data-group-type="data"
                    data-entitlements="${JSON.stringify(dataEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                    </svg>
                    ${dataEntitlements.length} Data
                </button>
            `);
        }
        
        if (appEntitlements.length > 0) {
            const hasAppOverlap = appEntitlements.some((_, index) => hasOverlapIssue('app', index));
            
            // Check for app quantity validation failures
            let hasAppQuantityFailure = false;
            if (validationResult && validationResult.overallStatus === 'FAIL') {
                const appQuantityRule = validationResult.ruleResults.find(rule => 
                    rule.ruleId === 'app-quantity-validation' && rule.status === 'FAIL'
                );
                if (appQuantityRule) {
                    hasAppQuantityFailure = true;
                }
            }
            
            const outliveClass = (hasAppOverlap || hasAppQuantityFailure) ? 'ring-2 ring-red-400' : '';
            
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors ${outliveClass}"
                    data-request-id="${request.Id}"
                    data-group-type="apps"
                    data-entitlements="${JSON.stringify(appEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <path d="M22 6l-10 7L2 6"></path>
                    </svg>
                    ${appEntitlements.length} App${appEntitlements.length > 1 ? 's' : ''}
                </button>
            `);
        }
        
        return `
            <div class="space-y-1">
                <div class="text-xs text-muted-foreground">${totalCount} total</div>
                <div class="flex flex-wrap gap-1">
                    ${groups.join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.warn('Error parsing payload data:', error);
        return '<span class="text-muted-foreground text-xs">Invalid payload</span>';
    }
}

// Render the list of validation rules
function renderValidationRulesList(config) {
    const container = document.getElementById('validation-rules-container');
    if (!container) return;
    
    const rulesHtml = config.rules.map(rule => {
        const isEnabled = config.enabledRules[rule.id] || false;
        
        return `
            <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h3 class="font-semibold">${rule.name}</h3>
                            <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                ${isEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <p class="text-sm text-muted-foreground mb-3">${rule.description}</p>
                        <details class="text-sm">
                            <summary class="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">Show Details</summary>
                            <div class="pl-4 border-l-2 border-blue-200">
                                <p class="mb-2"><strong>Logic:</strong> ${rule.longDescription}</p>
                                <p class="mb-1"><strong>Category:</strong> ${rule.category}</p>
                                <p class="mb-1"><strong>Version:</strong> ${rule.version}</p>
                                <p><strong>Created:</strong> ${rule.createdDate}</p>
                            </div>
                        </details>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                class="sr-only peer" 
                                ${isEnabled ? 'checked' : ''}
                                onchange="toggleValidationRule('${rule.id}', this.checked)"
                            >
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = rulesHtml;
}

// Test validation rules against current provisioning data
async function testValidationRules() {
    const testBtn = document.getElementById('test-validation-btn');
    const resultsSection = document.getElementById('test-results-section');
    const resultsContent = document.getElementById('test-results-content');
    
    if (!testBtn || !resultsSection || !resultsContent) return;
    
    // Show loading state
    testBtn.disabled = true;
    testBtn.innerHTML = `
        <div class="loading-spinner w-4 h-4 mr-2"></div>
        Testing...
    `;
    
    resultsSection.classList.remove('hidden');
    resultsContent.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="loading-spinner w-6 h-6 mr-3"></div>
            <span>Running validation tests...</span>
        </div>
    `;
    
    try {
        // Get current provisioning data (if any)
        if (!provisioningData || provisioningData.length === 0) {
            resultsContent.innerHTML = `
                <div class="text-center py-8">
                    <svg class="h-12 w-12 text-yellow-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-muted-foreground">No provisioning data available for testing.</p>
                    <p class="text-sm text-muted-foreground mt-2">Navigate to the Provisioning Monitor page and load some data first.</p>
                </div>
            `;
            return;
        }
        
        // Run validation on current data
        const testResults = [];
        const enabledRules = getEnabledValidationRules();
        
        if (enabledRules.length === 0) {
            resultsContent.innerHTML = `
                <div class="text-center py-8">
                    <svg class="h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    <p class="text-muted-foreground">No validation rules are enabled.</p>
                    <p class="text-sm text-muted-foreground mt-2">Enable some rules below to test validation.</p>
                </div>
            `;
            return;
        }
        
        for (const record of provisioningData) {
            const result = ValidationEngine.validateRecord(record, enabledRules);
            testResults.push(result);
        }
        
        // Display results
        renderTestResults(testResults);
        
    } catch (error) {
        console.error('Error testing validation rules:', error);
        resultsContent.innerHTML = `
            <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 class="font-medium text-destructive">Test Error</h4>
                </div>
                <p class="text-sm text-muted-foreground">Failed to run validation tests: ${error.message}</p>
            </div>
        `;
    } finally {
        // Restore button
        testBtn.disabled = false;
        testBtn.innerHTML = `
            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 12 2 2 4-4"></path>
                <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Test Rules
        `;
    }
}

// Render test results
function renderTestResults(testResults) {
    const resultsContent = document.getElementById('test-results-content');
    if (!resultsContent) return;
    
    const passCount = testResults.filter(r => r.overallStatus === 'PASS').length;
    const failCount = testResults.filter(r => r.overallStatus === 'FAIL').length;
    
    const summaryHtml = `
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="text-center p-4 bg-blue-50 rounded-lg">
                <div class="text-2xl font-bold text-blue-600">${testResults.length}</div>
                <div class="text-sm text-blue-600">Total Records</div>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
                <div class="text-2xl font-bold text-green-600">${passCount}</div>
                <div class="text-sm text-green-600">Passed</div>
            </div>
            <div class="text-center p-4 bg-red-50 rounded-lg">
                <div class="text-2xl font-bold text-red-600">${failCount}</div>
                <div class="text-sm text-red-600">Failed</div>
            </div>
        </div>
    `;
    
    const detailsHtml = testResults.map(result => `
        <div class="border rounded-lg p-4 ${result.overallStatus === 'PASS' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium">${result.recordName}</h4>
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${result.overallStatus === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${result.overallStatus}
                </span>
            </div>
            <div class="text-sm text-muted-foreground">
                ${result.ruleResults.map(ruleResult => `
                    <div class="mb-1">
                        <strong>${ruleResult.ruleId}:</strong> ${ruleResult.message}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    resultsContent.innerHTML = summaryHtml + '<div class="space-y-4">' + detailsHtml + '</div>';
}

// Debug payload structure
async function debugPayloadStructure() {
    const debugBtn = document.getElementById('debug-json-btn');
    const debugSection = document.getElementById('debug-results-section');
    const debugContent = document.getElementById('debug-results-content');
    
    if (!debugBtn || !debugSection || !debugContent) return;
    
    // Show loading state
    debugBtn.disabled = true;
    debugBtn.innerHTML = `
        <div class="loading-spinner w-4 h-4 mr-2"></div>
        Analyzing...
    `;
    
    debugSection.classList.remove('hidden');
    debugContent.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="loading-spinner w-6 h-6 mr-3"></div>
            <span>Analyzing JSON structure...</span>
        </div>
    `;
    
    try {
        if (!provisioningData || provisioningData.length === 0) {
            debugContent.innerHTML = `
                <div class="text-center py-8">
                    <svg class="h-12 w-12 text-yellow-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-muted-foreground">No provisioning data available for analysis.</p>
                    <p class="text-sm text-muted-foreground mt-2">Navigate to the Provisioning Monitor page and load some data first.</p>
                </div>
            `;
            return;
        }
        
        // Analyze first few records
        const analyses = [];
        const maxRecords = Math.min(5, provisioningData.length);
        
        for (let i = 0; i < maxRecords; i++) {
            const record = provisioningData[i];
            if (record.Payload_Data__c) {
                try {
                    const payload = JSON.parse(record.Payload_Data__c);
                    const analysis = ValidationEngine.analyzePayloadStructure(payload);
                    analyses.push({
                        recordName: record.Name || `Record ${i + 1}`,
                        analysis: analysis,
                        payload: payload
                    });
                } catch (error) {
                    analyses.push({
                        recordName: record.Name || `Record ${i + 1}`,
                        error: error.message,
                        payload: null
                    });
                }
            } else {
                analyses.push({
                    recordName: record.Name || `Record ${i + 1}`,
                    error: 'No Payload_Data__c field',
                    payload: null
                });
            }
        }
        
        // Render debug results
        renderDebugResults(analyses);
        
    } catch (error) {
        console.error('Error debugging payload structure:', error);
        debugContent.innerHTML = `
            <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="h-4 w-4 text-destructive" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 class="font-medium text-destructive">Debug Error</h4>
                </div>
                <p class="text-sm text-muted-foreground">Failed to analyze payload structure: ${error.message}</p>
            </div>
        `;
    } finally {
        // Restore button
        debugBtn.disabled = false;
        debugBtn.innerHTML = `
            <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
            Debug JSON
        `;
    }
}

// Render debug results
function renderDebugResults(analyses) {
    const debugContent = document.getElementById('debug-results-content');
    if (!debugContent) return;
    
    const debugHtml = analyses.map(analysis => {
        if (analysis.error) {
            return `
                <div class="border border-red-200 rounded-lg p-4 bg-red-50">
                    <h4 class="font-medium text-red-800 mb-2">${analysis.recordName}</h4>
                    <p class="text-sm text-red-600">Error: ${analysis.error}</p>
                </div>
            `;
        }
        
        const { analysis: struct, payload } = analysis;
        
        return `
            <div class="border rounded-lg p-4">
                <h4 class="font-medium mb-3">${analysis.recordName}</h4>
                
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <h5 class="font-medium text-sm mb-2">Structure Analysis</h5>
                        <div class="text-xs space-y-1">
                            <div>Has Properties: <span class="${struct.hasProperties ? 'text-green-600' : 'text-red-600'}">${struct.hasProperties}</span></div>
                            <div>Has Provisioning Detail: <span class="${struct.hasProvisioningDetail ? 'text-green-600' : 'text-red-600'}">${struct.hasProvisioningDetail}</span></div>
                            <div>Has Entitlements: <span class="${struct.hasEntitlements ? 'text-green-600' : 'text-red-600'}">${struct.hasEntitlements}</span></div>
                            <div>App Entitlements Path: <span class="font-mono">${struct.appEntitlementsPath || 'Not found'}</span></div>
                            <div>App Entitlements Count: <span class="font-bold">${struct.appEntitlementsCount}</span></div>
                        </div>
                        
                        ${struct.sampleAppEntitlement ? `
                            <div class="mt-3">
                                <h6 class="font-medium text-xs mb-1">Sample App Entitlement</h6>
                                <pre class="text-xs bg-gray-100 p-2 rounded overflow-auto">${JSON.stringify(struct.sampleAppEntitlement, null, 2)}</pre>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div>
                        <h5 class="font-medium text-sm mb-2">Available Paths</h5>
                        <div class="text-xs bg-gray-50 p-2 rounded max-h-48 overflow-y-auto">
                            ${struct.allPaths.slice(0, 20).map(path => `<div class="font-mono">${path}</div>`).join('')}
                            ${struct.allPaths.length > 20 ? `<div class="text-muted-foreground">... and ${struct.allPaths.length - 20} more</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    debugContent.innerHTML = `
        <div class="mb-4">
            <p class="text-sm text-muted-foreground">Analyzed ${analyses.length} records with payload data. Use this information to verify the correct path to app entitlements.</p>
        </div>
        <div class="space-y-4">${debugHtml}</div>
    `;
}

// ===== NAVIGATION SYSTEM =====

// Navigation and routing
function showPage(pageId) {
    console.log('Showing page:', pageId);
    
    // Hide all pages
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.classList.add('hidden');
        page.classList.remove('page-enter');
    });
    
    // Show selected page with animation
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('page-enter');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            targetPage.classList.remove('page-enter');
        }, 300);
    }
    
    // Update navigation active states
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        item.classList.remove('bg-accent', 'text-accent-foreground');
    });
    
    // Add active state to current nav item
    const activeNav = document.getElementById(`nav-${pageId}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.classList.add('bg-accent', 'text-accent-foreground');
    }
    
    currentPage = pageId;
    
    // Save current page to localStorage
    localStorage.setItem('currentPage', pageId);
    
    // Handle sub-navigation visibility
    const provisioningSubnav = document.getElementById('provisioning-subnav');
    if (pageId === 'provisioning' || pageId === 'expiration' || pageId === 'ghost-accounts') {
        if (provisioningSubnav) {
            provisioningSubnav.classList.remove('hidden');
        }
    } else {
        if (provisioningSubnav) {
            provisioningSubnav.classList.add('hidden');
        }
    }
    
    // Update sub-navigation active states
    const subNavItems = document.querySelectorAll('.sub-nav-item');
    subNavItems.forEach(item => {
        item.classList.remove('active');
        item.classList.remove('bg-accent', 'text-accent-foreground');
        item.classList.add('text-muted-foreground');
    });
    
    // Handle sub-navigation for provisioning pages
    if (pageId === 'provisioning') {
        const provisioningMonitorNav = document.getElementById('nav-provisioning-monitor');
        if (provisioningMonitorNav) {
            provisioningMonitorNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            provisioningMonitorNav.classList.remove('text-muted-foreground');
        }
    } else if (pageId === 'expiration') {
        const expirationNav = document.getElementById('nav-expiration');
        if (expirationNav) {
            expirationNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            expirationNav.classList.remove('text-muted-foreground');
        }
    } else if (pageId === 'customer-products') {
        const customerProductsNav = document.getElementById('nav-customer-products');
        if (customerProductsNav) {
            customerProductsNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            customerProductsNav.classList.remove('text-muted-foreground');
        }
    }
    
    // Trigger page-specific initialization
    if (pageId === 'analytics') {
        initializeAnalytics();
    } else if (pageId === 'provisioning') {
        clearProvisioningNotificationBadge();
        initializeProvisioning();
    } else if (pageId === 'expiration') {
        initializeExpiration();
    } else if (pageId === 'customer-products') {
        initializeCustomerProducts();
    } else if (pageId === 'roadmap') {
        initializeRoadmap();
    } else if (pageId === 'settings') {
        initializeSettings();
    }
}

// Handle analytics main navigation (toggle sub-navigation)
function handleAnalyticsNavigation(event) {
    event.preventDefault();
    
    const analyticsSubnav = document.getElementById('analytics-subnav');
    if (analyticsSubnav) {
        const isHidden = analyticsSubnav.classList.contains('hidden');
        if (isHidden) {
            // Show sub-navigation and navigate to analytics overview
            analyticsSubnav.classList.remove('hidden');
            showPage('analytics');
        } else {
            // If already visible, always navigate to analytics overview (don't collapse)
            showPage('analytics');
        }
    } else {
        // Fallback to regular navigation
        showPage('analytics');
    }
}

// Handle provisioning main navigation (toggle sub-navigation)
function handleProvisioningNavigation(event) {
    event.preventDefault();
    
    const provisioningSubnav = document.getElementById('provisioning-subnav');
    if (provisioningSubnav) {
        const isHidden = provisioningSubnav.classList.contains('hidden');
        if (isHidden) {
            // Show sub-navigation and navigate to provisioning monitor
            provisioningSubnav.classList.remove('hidden');
            showPage('provisioning');
        } else {
            // If already visible, always navigate to provisioning monitor (don't collapse)
            showPage('provisioning');
        }
    } else {
        // Fallback to regular navigation
        showPage('provisioning');
    }
}

// Navigation handler for regular navigation items
function handleNavigation(event) {
    event.preventDefault();
    
    // Get the target page from the button ID
    const targetPage = event.currentTarget;
    if (!targetPage) return;
    
    let pageId = targetPage.id.replace('nav-', '');
    
    // Handle special mappings for sub-navigation items
    if (pageId === 'analytics-overview') {
        pageId = 'analytics';
        // Make sure analytics sub-navigation is visible
        const analyticsSubnav = document.getElementById('analytics-subnav');
        if (analyticsSubnav) {
            analyticsSubnav.classList.remove('hidden');
        }
    } else if (pageId === 'provisioning-monitor') {
        pageId = 'provisioning';
        // Make sure sub-navigation is visible when navigating to monitor
        const provisioningSubnav = document.getElementById('provisioning-subnav');
        if (provisioningSubnav) {
            provisioningSubnav.classList.remove('hidden');
        }
    } else if (pageId === 'account-history') {
        // Make sure analytics sub-navigation is visible for Account History
        const analyticsSubnav = document.getElementById('analytics-subnav');
        if (analyticsSubnav) {
            analyticsSubnav.classList.remove('hidden');
        }
    }
    
    showPage(pageId);
    
    // Add click effect
    targetPage.style.transform = 'scale(0.95)';
    setTimeout(() => {
        targetPage.style.transform = '';
    }, 150);
}

// Initialize navigation event listeners
function setupNavigationEventListeners() {
    console.log('Setting up navigation event listeners...');
    
    // Main navigation items
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('nav-analytics');
    const navRoadmap = document.getElementById('nav-roadmap');
    const navProvisioning = document.getElementById('nav-provisioning');
    const navProvisioningMonitor = document.getElementById('nav-provisioning-monitor');
    const navHelp = document.getElementById('nav-help');
    const navSettings = document.getElementById('nav-settings');
    
    // Analytics sub-navigation items
    const navAnalyticsOverview = document.getElementById('nav-analytics-overview');
    const navAccountHistory = document.getElementById('nav-account-history');
    
    // Add event listeners
    if (navDashboard) navDashboard.addEventListener('click', handleNavigation);
    if (navAnalytics) navAnalytics.addEventListener('click', handleAnalyticsNavigation);
    if (navRoadmap) navRoadmap.addEventListener('click', handleNavigation);
    if (navProvisioning) navProvisioning.addEventListener('click', handleProvisioningNavigation);
    if (navProvisioningMonitor) navProvisioningMonitor.addEventListener('click', handleNavigation);
    if (navHelp) navHelp.addEventListener('click', handleNavigation);
    if (navSettings) navSettings.addEventListener('click', handleNavigation);
    
    // Analytics sub-navigation listeners
    if (navAnalyticsOverview) navAnalyticsOverview.addEventListener('click', handleNavigation);
    if (navAccountHistory) navAccountHistory.addEventListener('click', handleNavigation);
    
    console.log('Navigation event listeners setup completed');
}

// Initialize placeholder functions for pages that don't exist yet

// ===== HELP PAGE FUNCTIONS =====

// Initialize help page with smooth scrolling for internal links
function initializeHelpPage() {
    console.log('Initializing help page...');
    
    // Add smooth scrolling for internal navigation links
    const helpPage = document.getElementById('page-help');
    if (!helpPage) return;
    
    // Find all internal navigation links (href starting with #)
    const internalLinks = helpPage.querySelectorAll('a[href^="#"]');
    
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').slice(1); // Remove the #
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // Smooth scroll to the target element
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Optional: Add a temporary highlight effect
                targetElement.style.transition = 'background-color 0.3s ease';
                targetElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                
                setTimeout(() => {
                    targetElement.style.backgroundColor = '';
                }, 2000);
            }
        });
    });
    
    console.log(`✅ Help page initialized with ${internalLinks.length} internal navigation links`);
}

// Call help page initialization when help page is shown
document.addEventListener('DOMContentLoaded', function() {
    // Listen for help page navigation
    const originalShowPage = showPage;
    showPage = function(pageId) {
        originalShowPage(pageId);
        if (pageId === 'help') {
            setTimeout(initializeHelpPage, 100);
        }
    };
});

// initializeRoadmap function moved to earlier in file (around line 254)

// initializeSettings function moved to earlier in file (around line 1155)

// ===== VALIDATION MONITORING FUNCTIONS =====

// Initialize validation monitoring tile
function initializeValidationMonitoring() {
    console.log('Initializing validation monitoring...');
    
    if (timeFrameSelect) {
        timeFrameSelect.addEventListener('change', fetchValidationErrors);
    }
    
    // Load initial validation errors
    fetchValidationErrors();
}

// Fetch validation errors from the API
async function fetchValidationErrors() {
    if (!validationStatus || !validationErrors || !timeFrameSelect) {
        console.warn('Validation monitoring elements not found');
        return;
    }
    
    // Update timestamp when loading
    updateLastRefreshTimestamp('dashboard');
    
    const timeFrame = timeFrameSelect.value || '1w';
    
    try {
        // Show loading state
        validationStatus.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="loading-spinner"></div>
                <span class="text-sm text-muted-foreground">Loading validation status for ${getTimeFrameLabel(timeFrame)}...</span>
            </div>
        `;
        validationErrors.classList.add('hidden');
        
        console.log(`Fetching validation errors for time frame: ${timeFrame}`);
        
        // Get enabled rules from the validation rules configuration
        let enabledRuleIds = [];
        try {
            // Try to get enabled rules from localStorage (same as validation rules page)
            const validationConfig = localStorage.getItem('deploymentAssistant_validationRules');
            if (validationConfig) {
                const config = JSON.parse(validationConfig);
                enabledRuleIds = Object.keys(config.enabledRules || {}).filter(ruleId => 
                    config.enabledRules[ruleId] === true
                );
            }
            
            // If no config found, use default enabled rules
            if (enabledRuleIds.length === 0) {
                enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
            }
            
            console.log(`📋 Using enabled validation rules: ${enabledRuleIds.join(', ')}`);
        } catch (error) {
            console.warn('⚠️ Error loading validation config, using default rules:', error);
            enabledRuleIds = ['app-quantity-validation', 'model-count-validation', 'entitlement-date-overlap-validation'];
        }
        
        const response = await fetch(`/api/validation/errors?timeFrame=${timeFrame}&enabledRules=${encodeURIComponent(JSON.stringify(enabledRuleIds))}`);
        const data = await response.json();
        
        if (data.success) {
            displayValidationResults(data);
        } else {
            displayValidationError(data.error || 'Failed to load validation data');
        }
        
    } catch (error) {
        console.error('Error fetching validation errors:', error);
        displayValidationError(`Network error: ${error.message}`);
    }
}

// Display validation results in the tile
function displayValidationResults(data) {
    const { summary, errors } = data;
    const timeFrameLabel = getTimeFrameLabel(summary.timeFrame);
    
    if (summary.invalidRecords === 0) {
        // No validation errors
        validationStatus.innerHTML = `
            <div class="flex items-center gap-3 text-green-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">No validation failures found</p>
                    <p class="text-sm text-muted-foreground">
                        All ${summary.totalRecords} PS records from ${timeFrameLabel} passed validation
                        ${summary.enabledRulesCount > 0 ? `(${summary.enabledRulesCount} rules checked)` : ''}
                    </p>
                </div>
            </div>
        `;
        validationErrors.classList.add('hidden');
        
    } else {
        // Show validation errors
        validationStatus.innerHTML = `
            <div class="flex items-center gap-3 text-red-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">${summary.invalidRecords} validation error${summary.invalidRecords > 1 ? 's' : ''} found</p>
                    <p class="text-sm text-muted-foreground">
                        ${summary.invalidRecords} of ${summary.totalRecords} PS records from ${timeFrameLabel} failed validation
                    </p>
                </div>
            </div>
        `;
        
        // Display individual errors
        displayValidationErrorDetails(errors);
        validationErrors.classList.remove('hidden');
    }
}

// Display detailed validation error information
function displayValidationErrorDetails(errors) {
    if (!errors || errors.length === 0) {
        validationErrors.innerHTML = '<p class="text-sm text-muted-foreground">No error details available</p>';
        return;
    }
    
    const errorHtml = errors.map((error, index) => `
        <div class="border border-red-200 rounded-lg p-4 bg-red-50">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="font-medium text-red-900">${error.recordName || error.recordId}</span>
                        ${error.account ? `<span class="text-sm text-red-600">(${error.account})</span>` : ''}
                    </div>
                    <div class="space-y-1">
                        ${error.failedRules.map(rule => `
                            <div class="text-sm">
                                <span class="font-medium text-red-800">${rule.ruleName}:</span>
                                <span class="text-red-700 ml-1">${rule.message}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${error.createdDate ? `
                        <div class="text-xs text-red-600 mt-2">
                            Created: ${new Date(error.createdDate).toLocaleDateString()}
                        </div>
                    ` : ''}
                </div>
                <button 
                    class="text-red-600 hover:text-red-800 text-sm font-medium"
                    onclick="viewPSRecord('${error.recordId}', '${error.recordName || error.recordId}')"
                >
                    View Record
                </button>
            </div>
        </div>
    `).join('');
    
    validationErrors.innerHTML = errorHtml;
}

// Display validation error message
function displayValidationError(errorMessage) {
    validationStatus.innerHTML = `
        <div class="flex items-center gap-3 text-yellow-700">
            <div class="flex-shrink-0">
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                    <path d="M12 9v4"></path>
                    <path d="m12 17 .01 0"></path>
                </svg>
            </div>
            <div class="flex-1">
                <p class="font-medium">Unable to load validation data</p>
                <p class="text-sm text-muted-foreground">${errorMessage}</p>
            </div>
        </div>
    `;
    validationErrors.classList.add('hidden');
}

// Helper function to get user-friendly time frame labels
function getTimeFrameLabel(timeFrame) {
    switch (timeFrame) {
        case '1d': return 'the last 24 hours';
        case '1w': return 'the last week';
        case '1m': return 'the last month';
        case '1y': return 'the last year';
        default: return 'the selected time period';
    }
}

// ===== PS REQUEST REMOVALS MONITORING FUNCTIONS =====

// Initialize PS Request Removals monitoring tile
function initializePSRemovalsMonitoring() {
    console.log('Initializing PS Request Removals monitoring...');
    
    if (removalsTimeFrameSelect) {
        removalsTimeFrameSelect.addEventListener('change', fetchPSRemovals);
    }
    
    // Load initial removals data
    fetchPSRemovals();
}

// Initialize Expiration Monitor widget
function initializeExpirationWidget() {
    console.log('[ExpirationWidget] Initializing expiration monitor widget...');
    
    if (expirationWindowSelect) {
        expirationWindowSelect.addEventListener('change', fetchExpirationWidget);
    }
    
    // Load initial expiration data
    fetchExpirationWidget();
}

// Fetch PS requests with removals from the API
async function fetchPSRemovals() {
    if (!removalsStatus || !removalsList || !removalsTimeFrameSelect) {
        console.warn('PS Removals monitoring elements not found');
        return;
    }
    
    // Update timestamp when loading
    updateLastRefreshTimestamp('dashboard');
    
    const timeFrame = removalsTimeFrameSelect.value || '1w';
    
    try {
        // Show loading state
        removalsStatus.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="loading-spinner"></div>
                <span class="text-sm text-muted-foreground">Loading PS request removals for ${getTimeFrameLabel(timeFrame)}...</span>
            </div>
        `;
        removalsList.classList.add('hidden');
        
        console.log(`Fetching PS request removals for time frame: ${timeFrame}`);
        
        const response = await fetch(`/api/provisioning/removals?timeFrame=${timeFrame}`);
        
        // Check if the response is OK
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            console.error(`API error: Status ${response.status}, Content-Type: ${contentType}`);
            
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                displayRemovalsError(errorData.error || `API error: ${response.status}`);
            } else {
                // Server returned HTML or other non-JSON response
                const textResponse = await response.text();
                console.error('Non-JSON response:', textResponse.substring(0, 200));
                displayRemovalsError(`Server error (${response.status}). Please ensure the server is running and the endpoint exists.`);
            }
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            displayRemovalsResults(data);
        } else {
            displayRemovalsError(data.error || 'Failed to load removal data');
        }
        
    } catch (error) {
        console.error('Error fetching PS request removals:', error);
        displayRemovalsError(`Network error: ${error.message}. Please check the browser console for details.`);
    }
}

// Display removals results in the tile
function displayRemovalsResults(data) {
    const { requests, totalCount, timeFrame, note } = data;
    const timeFrameLabel = getTimeFrameLabel(timeFrame);
    
    // Check if this is a "no authentication" response
    if (note && note.includes('No Salesforce authentication')) {
        removalsStatus.innerHTML = `
            <div class="flex items-center gap-3 text-blue-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">Salesforce Authentication Required</p>
                    <p class="text-sm text-muted-foreground">
                        Please configure Salesforce authentication in Settings to view product removals.
                    </p>
                </div>
            </div>
        `;
        removalsList.classList.add('hidden');
        return;
    }
    
    if (totalCount === 0) {
        // No removals found
        removalsStatus.innerHTML = `
            <div class="flex items-center gap-3 text-green-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">No product removals found</p>
                    <p class="text-sm text-muted-foreground">
                        No PS requests with product entitlement removals in ${timeFrameLabel}
                    </p>
                </div>
            </div>
        `;
        removalsList.classList.add('hidden');
    } else {
        // Display removals count
        removalsStatus.innerHTML = `
            <div class="flex items-center gap-3 text-orange-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">${totalCount} PS request${totalCount !== 1 ? 's' : ''} with product removals</p>
                    <p class="text-sm text-muted-foreground">
                        Found in ${timeFrameLabel}
                    </p>
                </div>
            </div>
        `;
        
        // Display list of removals
        const renderRemovalCard = (item) => {
            const { currentRequest, previousRequest, removals } = item;
            const removedItems = [
                ...removals.removedModels.map(m => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mr-1 mb-1">Model: ${m.productCode}</span>`),
                ...removals.removedData.map(d => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mr-1 mb-1">Data: ${d.productCode}</span>`),
                ...removals.removedApps.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mr-1 mb-1">App: ${a.productCode}</span>`)
            ].join('');
            
            return `
                <div class="rounded-lg border bg-white p-4 hover:shadow-md transition-shadow">
                    <div class="space-y-3">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <h3 class="font-semibold text-base">${currentRequest.name}</h3>
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        ${currentRequest.requestType || 'Update'}
                                    </span>
                                </div>
                                <p class="text-sm text-muted-foreground mt-1">
                                    Account: ${currentRequest.account}
                                </p>
                                <p class="text-xs text-muted-foreground mt-0.5">
                                    Created: ${new Date(currentRequest.createdDate).toLocaleDateString()}
                                </p>
                            </div>
                            <button 
                                onclick="viewPSRecordExact('${currentRequest.id}', '${currentRequest.name}')" 
                                class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                            >
                                View Record
                            </button>
                        </div>
                        
                        <div class="border-t pt-3">
                            <div class="flex items-start gap-2">
                                <svg class="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-orange-900 mb-2">
                                        Removed from ${previousRequest.name}
                                        <span class="text-xs text-muted-foreground ml-1">
                                            (${new Date(previousRequest.createdDate).toLocaleDateString()})
                                        </span>
                                    </p>
                                    <div class="flex flex-wrap gap-1">
                                        ${removedItems}
                                    </div>
                                    <p class="text-xs text-muted-foreground mt-2">
                                        Total removals: ${removals.totalCount} product${removals.totalCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };
        
        // Show only the first record, rest are collapsible
        const firstRecord = renderRemovalCard(requests[0]);
        const remainingRecords = requests.slice(1);
        
        if (remainingRecords.length > 0) {
            removalsList.innerHTML = `
                ${firstRecord}
                <div id="removals-additional" class="space-y-2 hidden">
                    ${remainingRecords.map(item => renderRemovalCard(item)).join('')}
                </div>
                <button 
                    id="removals-expand-btn"
                    onclick="toggleRemovalsExpand()"
                    class="w-full inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                    <svg id="removals-expand-icon" class="h-4 w-4 transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m6 9 6 6 6-6"></path>
                    </svg>
                    <span id="removals-expand-text">Show ${remainingRecords.length} more record${remainingRecords.length !== 1 ? 's' : ''}</span>
                </button>
            `;
        } else {
            removalsList.innerHTML = firstRecord;
        }
        
        removalsList.classList.remove('hidden');
    }
}

// Display error message for removals
function displayRemovalsError(errorMessage) {
    removalsStatus.innerHTML = `
        <div class="flex items-center gap-3 text-red-700">
            <div class="flex-shrink-0">
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <div class="flex-1">
                <p class="font-medium">Error loading removal data</p>
                <p class="text-sm text-muted-foreground">${errorMessage}</p>
            </div>
        </div>
    `;
    removalsList.classList.add('hidden');
}

// ===== EXPIRATION MONITOR WIDGET (DASHBOARD) =====

// Fetch expiration data for dashboard widget
async function fetchExpirationWidget() {
    if (!expirationStatus || !expirationSummary || !expirationWindowSelect) {
        console.warn('[ExpirationWidget] Dashboard elements not found');
        return;
    }
    
    // Update timestamp when loading
    updateLastRefreshTimestamp('dashboard');
    
    const expirationWindow = parseInt(expirationWindowSelect.value) || 7;
    
    try {
        // Show loading state
        expirationStatus.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="loading-spinner"></div>
                <span class="text-sm text-muted-foreground">Loading expiration data (${expirationWindow} days)...</span>
            </div>
        `;
        expirationSummary.classList.add('hidden');
        
        console.log(`[ExpirationWidget] Fetching data for ${expirationWindow} day window`);
        
        const response = await fetch(`/api/expiration/monitor?expirationWindow=${expirationWindow}&showExtended=true`);
        const data = await response.json();
        
        if (data.success) {
            displayExpirationWidget(data);
        } else {
            displayExpirationWidgetError(data.error || 'Failed to load expiration data');
        }
        
    } catch (error) {
        console.error('[ExpirationWidget] Error fetching data:', error);
        displayExpirationWidgetError('Failed to fetch expiration data. Please check your connection.');
    }
}

// Display expiration widget results
function displayExpirationWidget(data) {
    const { summary, expirations, expirationWindow, lastAnalyzed, note } = data;
    
    console.log('[ExpirationWidget] Displaying data:', summary);
    
    // Check if this is a "no authentication" response
    if (note && note.includes('No Salesforce authentication')) {
        expirationStatus.innerHTML = `
            <div class="flex items-center gap-3 text-blue-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">Salesforce Authentication Required</p>
                    <p class="text-sm text-muted-foreground">
                        Please configure Salesforce authentication in Settings to view expiration data.
                    </p>
                </div>
            </div>
        `;
        expirationSummary.classList.add('hidden');
        return;
    }
    
    // Check if analysis has been run
    if (!lastAnalyzed) {
        expirationStatus.innerHTML = `
            <div class="flex items-center gap-3 text-yellow-700">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <div class="flex-1">
                    <p class="font-medium">No Analysis Data Available</p>
                    <p class="text-sm text-muted-foreground">
                        Please run the analysis in the <a href="#" onclick="event.preventDefault(); showPage('expiration'); return false;" class="text-purple-600 hover:underline font-medium">Expiration Monitor</a> to view expiration data.
                    </p>
                </div>
            </div>
        `;
        expirationSummary.classList.add('hidden');
        return;
    }
    
    // Display summary
    const atRiskCount = summary.atRisk || 0;
    const extendedCount = summary.extended || 0;
    const totalExpiring = summary.totalExpiring || 0;
    const accountsAffected = summary.accountsAffected || 0;
    
    // Filter at-risk expirations
    const atRiskExpirations = (expirations || []).filter(exp => exp.status === 'at-risk');
    
    // Determine status color
    let statusColor = 'green';
    let statusIcon = '✓';
    let statusText = 'All products extended';
    
    if (atRiskCount > 0) {
        statusColor = 'red';
        statusIcon = '⚠️';
        statusText = `${atRiskCount} product${atRiskCount !== 1 ? 's' : ''} at risk`;
    } else if (totalExpiring > 0) {
        statusColor = 'green';
        statusIcon = '✓';
        statusText = `All ${totalExpiring} expiring product${totalExpiring !== 1 ? 's are' : ' is'} extended`;
    }
    
    expirationStatus.innerHTML = `
        <div class="flex items-center gap-3 text-${statusColor}-700">
            <div class="flex-shrink-0">
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${atRiskCount > 0 ? `
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                    ` : `
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    `}
                </svg>
            </div>
            <div class="flex-1">
                <p class="font-medium">${statusText}</p>
                <p class="text-sm text-muted-foreground">
                    ${totalExpiring} total product${totalExpiring !== 1 ? 's' : ''} expiring in next ${expirationWindow} days across ${accountsAffected} account${accountsAffected !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    `;
    
    // Display detailed summary cards
    if (totalExpiring > 0) {
        let summaryHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <!-- Total Expiring -->
                <div class="rounded-lg border bg-purple-50 p-3">
                    <div class="text-2xl font-bold text-purple-700">${totalExpiring}</div>
                    <div class="text-xs text-purple-600 mt-1">Total Expiring</div>
                </div>
                
                <!-- At Risk -->
                <div class="rounded-lg border ${atRiskCount > 0 ? 'bg-red-50 ring-2 ring-red-600' : 'bg-slate-50'} p-3">
                    <div class="text-2xl font-bold ${atRiskCount > 0 ? 'text-red-700' : 'text-slate-600'}">${atRiskCount}</div>
                    <div class="text-xs ${atRiskCount > 0 ? 'text-red-600' : 'text-slate-500'} mt-1">At Risk</div>
                </div>
                
                <!-- Extended -->
                <div class="rounded-lg border bg-green-50 p-3">
                    <div class="text-2xl font-bold text-green-700">${extendedCount}</div>
                    <div class="text-xs text-green-600 mt-1">Extended</div>
                </div>
                
                <!-- Accounts -->
                <div class="rounded-lg border bg-blue-50 p-3">
                    <div class="text-2xl font-bold text-blue-700">${accountsAffected}</div>
                    <div class="text-xs text-blue-600 mt-1">Accounts</div>
                </div>
            </div>
        `;
        
        // Add expandable at-risk records section
        if (atRiskCount > 0 && atRiskExpirations.length > 0) {
            summaryHTML += `
                <div class="border-t pt-3 mt-3">
                    <button 
                        id="expiration-expand-btn"
                        onclick="toggleExpirationExpand(); return false;"
                        class="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                    >
                        <svg id="expiration-expand-icon" class="h-4 w-4 transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                        <span id="expiration-expand-text">Show ${atRiskCount} at-risk record${atRiskCount !== 1 ? 's' : ''}</span>
                    </button>
                    
                    <div id="expiration-at-risk-list" class="hidden mt-3 space-y-2">
                        ${renderAtRiskRecords(atRiskExpirations)}
                    </div>
                </div>
            `;
        }
        
        summaryHTML += `
            <!-- View Full Details Button -->
            <div class="flex items-center justify-between pt-2 border-t mt-3">
                <div class="text-xs text-muted-foreground">
                    Last analyzed: ${formatTimestamp(lastAnalyzed)}
                </div>
                <button 
                    onclick="showPage('expiration'); return false;"
                    class="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 transition-colors"
                >
                    View Full Details
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
            </div>
        `;
        
        expirationSummary.innerHTML = summaryHTML;
        expirationSummary.classList.remove('hidden');
    } else {
        expirationSummary.classList.add('hidden');
    }
}

// Render at-risk records for the expandable section
function renderAtRiskRecords(atRiskExpirations) {
    return atRiskExpirations.slice(0, 10).map(item => {
        const { account, psRecord, expiringProducts, earliestExpiry } = item;
        
        // Count products by type that are at risk
        const atRiskModels = (expiringProducts.models || []).filter(p => !p.isExtended).length;
        const atRiskData = (expiringProducts.data || []).filter(p => !p.isExtended).length;
        const atRiskApps = (expiringProducts.apps || []).filter(p => !p.isExtended).length;
        const totalAtRisk = atRiskModels + atRiskData + atRiskApps;
        
        // Calculate days until expiry
        const daysUntil = Math.ceil((new Date(earliestExpiry) - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="rounded-lg border border-red-200 bg-red-50 p-3 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-medium text-sm text-red-900">${account.name}</span>
                            <span class="text-xs text-red-600">•</span>
                            <span class="text-sm text-red-700">${psRecord.name}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${atRiskModels > 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">${atRiskModels} Model${atRiskModels !== 1 ? 's' : ''}</span>` : ''}
                            ${atRiskData > 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">${atRiskData} Data</span>` : ''}
                            ${atRiskApps > 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">${atRiskApps} App${atRiskApps !== 1 ? 's' : ''}</span>` : ''}
                        </div>
                        <div class="text-xs text-red-600 mt-1">
                            Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${formatDate(earliestExpiry)})
                        </div>
                    </div>
                    <button 
                        onclick="showPage('expiration'); return false;"
                        class="flex-shrink-0 inline-flex items-center gap-1 rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 transition-colors"
                    >
                        View
                        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('') + (atRiskExpirations.length > 10 ? `
        <div class="text-center text-xs text-muted-foreground py-2">
            Showing 10 of ${atRiskExpirations.length} at-risk records. <button onclick="showPage('expiration'); return false;" class="text-purple-600 hover:underline font-medium">View all in Expiration Monitor</button>
        </div>
    ` : '');
}

// Toggle expand/collapse for at-risk records
function toggleExpirationExpand() {
    const atRiskList = document.getElementById('expiration-at-risk-list');
    const expandIcon = document.getElementById('expiration-expand-icon');
    const expandText = document.getElementById('expiration-expand-text');
    
    if (!atRiskList) return;
    
    const isHidden = atRiskList.classList.contains('hidden');
    
    if (isHidden) {
        atRiskList.classList.remove('hidden');
        expandIcon.style.transform = 'rotate(90deg)';
        expandText.textContent = expandText.textContent.replace('Show', 'Hide');
    } else {
        atRiskList.classList.add('hidden');
        expandIcon.style.transform = 'rotate(0deg)';
        expandText.textContent = expandText.textContent.replace('Hide', 'Show');
    }
}

// Display expiration widget error
function displayExpirationWidgetError(errorMessage) {
    expirationStatus.innerHTML = `
        <div class="flex items-center gap-3 text-red-700">
            <div class="flex-shrink-0">
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <div class="flex-1">
                <p class="font-medium">Error loading expiration data</p>
                <p class="text-sm text-muted-foreground">${errorMessage}</p>
            </div>
        </div>
    `;
    expirationSummary.classList.add('hidden');
}

// Toggle expand/collapse for additional removal records
function toggleRemovalsExpand() {
    const additionalRecords = document.getElementById('removals-additional');
    const expandIcon = document.getElementById('removals-expand-icon');
    const expandText = document.getElementById('removals-expand-text');
    const expandBtn = document.getElementById('removals-expand-btn');
    
    if (!additionalRecords) return;
    
    const isHidden = additionalRecords.classList.contains('hidden');
    
    if (isHidden) {
        // Expand
        additionalRecords.classList.remove('hidden');
        expandIcon.style.transform = 'rotate(180deg)';
        expandText.textContent = 'Show less';
    } else {
        // Collapse
        additionalRecords.classList.add('hidden');
        expandIcon.style.transform = 'rotate(0deg)';
        const remainingCount = additionalRecords.children.length;
        expandText.textContent = `Show ${remainingCount} more record${remainingCount !== 1 ? 's' : ''}`;
    }
}

// Navigate to view a specific PS record with exact matching (for Account History)
async function viewPSRecordExact(recordId, recordName) {
    console.log(`Navigating to PS record with exact match: ${recordName} (${recordId})`);
    
    // Navigate to provisioning monitor
    showPage('provisioning');
    
    // Store the search term for after initialization
    const searchTerm = recordName || recordId;
    
    // Wait for the page to fully initialize before searching
    const waitForInitialization = async () => {
        let attempts = 0;
        const maxAttempts = 20; // Wait up to 4 seconds (20 * 200ms)
        
        while (attempts < maxAttempts) {
            const searchInput = document.getElementById('provisioning-search');
            const tableBody = document.getElementById('provisioning-table-body');
            
            // Check if both the search input and table body are available and not in loading state
            if (searchInput && tableBody && !provisioningPagination.isLoading) {
                console.log(`✅ Provisioning page is ready after ${attempts * 200}ms`);
                return true;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.warn('⚠️ Timeout waiting for provisioning page to initialize');
        return false;
    };
    
    // Wait for initialization, then perform search
    setTimeout(async () => {
        const isReady = await waitForInitialization();
        
        if (isReady) {
            const searchInput = document.getElementById('provisioning-search');
            
            try {
                // Clear any existing search
                searchInput.value = '';
                
                // Set the search value
                searchInput.value = searchTerm;
                
                // Set exact match filter flag
                exactMatchFilter = searchTerm;
                console.log(`🔍 Setting exact match filter for: ${searchTerm}`);
                
                // Clear current data to force fresh search
                provisioningData = [];
                provisioningPagination.currentPage = 1;
                provisioningPagination.isLoading = false;
                
                // Trigger the search directly via loadProvisioningRequests
                // The renderProvisioningTable function will automatically apply the exact match filter
                await loadProvisioningRequests({ search: searchTerm });
                
            } catch (error) {
                console.error('❌ Error searching for PS record:', error);
            }
        } else {
            console.error('❌ Provisioning page failed to initialize');
        }
    }, 100);
}

// Navigate to view a specific PS record in the provisioning monitor
async function viewPSRecord(recordId, recordName) {
    console.log(`Navigating to PS record: ${recordName} (${recordId})`);
    
    // Navigate to provisioning monitor
    showPage('provisioning');
    
    // Store the search term for after initialization
    const searchTerm = recordName || recordId;
    
    // Wait for the page to fully initialize before searching
    const waitForInitialization = async () => {
        let attempts = 0;
        const maxAttempts = 20; // Wait up to 4 seconds (20 * 200ms)
        
        while (attempts < maxAttempts) {
            const searchInput = document.getElementById('provisioning-search');
            const tableBody = document.getElementById('provisioning-table-body');
            
            // Check if both the search input and table body are available and not in loading state
            if (searchInput && tableBody && !provisioningPagination.isLoading) {
                console.log(`✅ Provisioning page is ready after ${attempts * 200}ms`);
                return true;
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.warn('⚠️ Timeout waiting for provisioning page to initialize');
        return false;
    };
    
    // Wait for initialization, then perform search
    setTimeout(async () => {
        const isReady = await waitForInitialization();
        
        if (isReady) {
            const searchInput = document.getElementById('provisioning-search');
            
            try {
                // Clear any existing search
                searchInput.value = '';
                
                // Set the search value
                searchInput.value = searchTerm;
                
                // Clear current data to force fresh search
                provisioningData = [];
                provisioningPagination.currentPage = 1;
                provisioningPagination.isLoading = false;
                
                // Trigger the search directly via loadProvisioningRequests
                console.log(`🔍 Triggering search for: ${searchTerm}`);
                await loadProvisioningRequests({ search: searchTerm });
                
                // Focus on the search input to highlight the search
                searchInput.focus();
                
                console.log(`✅ Successfully searched for record: ${searchTerm}`);
                
            } catch (error) {
                console.error('❌ Error during search:', error);
                // Fallback: try triggering search via event handler
                try {
                    handleProvisioningSearch({ target: { value: searchTerm } });
                    searchInput.focus();
                    console.log(`✅ Fallback search triggered for: ${searchTerm}`);
                } catch (fallbackError) {
                    console.error('❌ Fallback search also failed:', fallbackError);
                }
            }
        } else {
            console.error('❌ Failed to initialize provisioning page for search');
        }
    }, 100); // Start checking after a short delay
}

// ===== PACKAGE LOOKUP FUNCTIONALITY (Help Page) =====

/**
 * Search for a package from the Help page quick reference buttons
 */
function searchPackageFromHelp(packageName) {
    const input = document.getElementById('package-lookup-input');
    if (input) {
        input.value = packageName;
        performPackageLookup();
    }
}

/**
 * Perform the package lookup search
 */
async function performPackageLookup() {
    const input = document.getElementById('package-lookup-input');
    const resultContainer = document.getElementById('package-lookup-result');
    
    if (!input || !resultContainer) return;
    
    const searchTerm = input.value.trim();
    if (!searchTerm) {
        resultContainer.classList.add('hidden');
        return;
    }
    
    // Show loading state
    resultContainer.classList.remove('hidden');
    resultContainer.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <svg class="animate-spin h-8 w-8 mx-auto mb-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm text-blue-800">Searching for "${searchTerm}"...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/packages/${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (data.success && data.package) {
            const pkg = data.package;
            displayPackageResult(pkg);
        } else {
            // Package not found
            resultContainer.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div class="flex items-start gap-3">
                        <svg class="h-6 w-6 text-yellow-600 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                            <path d="M12 9v4"></path>
                            <path d="M12 17h.01"></path>
                        </svg>
                        <div>
                            <h3 class="font-semibold text-yellow-900">Package Not Found</h3>
                            <p class="text-sm text-yellow-800 mt-1">
                                No package found matching "${searchTerm}". Try searching by:
                            </p>
                            <ul class="text-sm text-yellow-800 mt-2 ml-4 list-disc">
                                <li>Full package name (e.g., "RMS 2.0 P6", "P6 Expansion Pack")</li>
                                <li>Package code (e.g., "P6", "X3", "U4")</li>
                                <li>RI package name if available</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching for package:', error);
        resultContainer.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <div class="flex items-start gap-3">
                    <svg class="h-6 w-6 text-red-600 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div>
                        <h3 class="font-semibold text-red-900">Error</h3>
                        <p class="text-sm text-red-800 mt-1">
                            Failed to search for package. Please try again or contact support if the problem persists.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Display the package lookup result
 */
function displayPackageResult(pkg) {
    const resultContainer = document.getElementById('package-lookup-result');
    if (!resultContainer) return;
    
    // Format numbers with commas
    const formatNumber = (num) => {
        if (num === null || num === undefined) return '—';
        return num.toLocaleString();
    };
    
    // Build capacity details HTML
    let capacityDetails = '';
    const capacityFields = [
        { label: 'Locations', value: pkg.locations, format: formatNumber },
        { label: 'Max Concurrent Model Jobs', value: pkg.max_concurrent_model, format: formatNumber },
        { label: 'Max Concurrent Non-Model Jobs', value: pkg.max_concurrent_non_model, format: formatNumber },
        { label: 'Max Concurrent Accumulation Jobs', value: pkg.max_concurrent_accumulation_jobs, format: formatNumber },
        { label: 'Max Concurrent Non-Accumulation Jobs', value: pkg.max_concurrent_non_accumulation_jobs, format: formatNumber },
        { label: 'Max Jobs per Day', value: pkg.max_jobs_day, format: formatNumber },
        { label: 'Max Users', value: pkg.max_users, format: formatNumber },
        { label: 'Number of EDMs', value: pkg.number_edms, format: formatNumber },
        { label: 'Max Exposure Storage (TB)', value: pkg.max_exposure_storage_tb, format: (v) => v ? `${v} TB` : '—' },
        { label: 'Max Other Storage (TB)', value: pkg.max_other_storage_tb, format: (v) => v ? `${v} TB` : '—' },
        { label: 'Max Risks Accumulated per Day', value: pkg.max_risks_accumulated_day, format: formatNumber },
        { label: 'Max Risks in Single Accumulation', value: pkg.max_risks_single_accumulation, format: formatNumber },
        { label: 'API Requests Per Second', value: pkg.api_rps, format: formatNumber }
    ];
    
    const hasCapacityData = capacityFields.some(field => field.value !== null && field.value !== undefined);
    
    if (hasCapacityData) {
        capacityDetails = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">';
        capacityFields.forEach(field => {
            if (field.value !== null && field.value !== undefined) {
                capacityDetails += `
                    <div class="bg-gray-50 rounded p-3">
                        <p class="text-xs text-muted-foreground">${field.label}</p>
                        <p class="text-sm font-semibold mt-1">${field.format(field.value)}</p>
                    </div>
                `;
            }
        });
        capacityDetails += '</div>';
    }
    
    resultContainer.innerHTML = `
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-6">
            <div class="flex items-start gap-3 mb-4">
                <svg class="h-8 w-8 text-green-600 mt-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m7.5 4.27 9 5.15"></path>
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                    <path d="m3.3 7 8.7 5 8.7-5"></path>
                    <path d="M12 22V12"></path>
                </svg>
                <div class="flex-1">
                    <h3 class="text-xl font-bold text-green-900">${pkg.package_name || '—'}</h3>
                    ${pkg.ri_package_name ? `<p class="text-sm text-green-700 mt-1">RI Package: ${pkg.ri_package_name}</p>` : ''}
                    ${pkg.package_type ? `
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                            pkg.package_type === 'Base' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }">
                            ${pkg.package_type} Package
                        </span>
                    ` : ''}
                </div>
            </div>
            
            ${pkg.description ? `
                <div class="bg-white rounded-lg p-4 mb-4">
                    <h4 class="font-semibold text-gray-900 mb-2">Description</h4>
                    <p class="text-sm text-gray-700">${pkg.description}</p>
                </div>
            ` : ''}
            
            ${hasCapacityData ? `
                <div class="bg-white rounded-lg p-4">
                    <h4 class="font-semibold text-gray-900 mb-3">Capacity & Limits</h4>
                    ${capacityDetails}
                </div>
            ` : ''}
            
            <div class="mt-4 pt-4 border-t border-green-200">
                <p class="text-xs text-green-700">
                    <strong>Last Synced:</strong> ${pkg.last_synced ? new Date(pkg.last_synced).toLocaleString() : 'Unknown'}
                </p>
            </div>
        </div>
    `;
}

/**
 * Setup package lookup event listeners
 */
function setupPackageLookupListeners() {
    const input = document.getElementById('package-lookup-input');
    const button = document.getElementById('package-lookup-btn');
    
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performPackageLookup();
            }
        });
    }
    
    if (button) {
        button.addEventListener('click', performPackageLookup);
    }
}

// ===== END PACKAGE LOOKUP FUNCTIONALITY =====

// Initialize the application
function initializeApp() {
    console.log('Initializing Deployment Assistant...');
    
    // Setup navigation
    setupNavigationEventListeners();
    
    // Initialize theme
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // Initialize validation monitoring
    initializeValidationMonitoring();
    
    // Initialize PS Request Removals monitoring
    initializePSRemovalsMonitoring();
    
    // Initialize Expiration Monitor widget
    initializeExpirationWidget();
    
    // Setup package lookup listeners (Help page)
    setupPackageLookupListeners();
    
    // Initialize navigation - restore saved page or default to dashboard
    const savedPage = localStorage.getItem('currentPage') || 'dashboard';
    showPage(savedPage);
    
    console.log('Deployment Assistant initialized successfully');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('Navigation system loaded');

// (Removed legacy duplicate showProductGroup implementation)

// Render individual entitlement card
function renderEntitlementCard(entitlement, index, groupType) {
    const colorClasses = {
        'models': 'border-blue-200 bg-blue-50',
        'data': 'border-green-200 bg-green-50',
        'apps': 'border-purple-200 bg-purple-50'
    };
    
    const headerColors = {
        'models': 'text-blue-800',
        'data': 'text-green-800', 
        'apps': 'text-purple-800'
    };
    
    // Extract key fields from entitlement
    const name = entitlement.name || entitlement.productName || entitlement.title || `${groupType.slice(0, -1)} ${index + 1}`;
    const productCode = entitlement.productCode || entitlement.code || entitlement.id || 'N/A';
    const quantity = entitlement.quantity || entitlement.qty || 'N/A';
    const status = entitlement.status || entitlement.state || 'Active';
    
    // Build additional fields dynamically
    const additionalFields = Object.entries(entitlement)
        .filter(([key, value]) => 
            !['name', 'productName', 'title', 'productCode', 'code', 'id', 'quantity', 'qty', 'status', 'state'].includes(key) &&
            value !== null && value !== undefined && value !== ''
        )
        .map(([key, value]) => {
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            
            return `
                <div class="grid grid-cols-3 gap-2 py-1">
                    <span class="text-sm font-medium text-gray-600">${displayKey}:</span>
                    <span class="text-sm text-gray-900 col-span-2 break-all">${displayValue}</span>
                </div>
            `;
        }).join('');
    
    return `
        <div class="border rounded-lg p-4 ${colorClasses[groupType] || 'border-gray-200 bg-gray-50'}">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h4 class="font-semibold ${headerColors[groupType] || 'text-gray-800'}">${name}</h4>
                    <p class="text-sm text-gray-600">${productCode}</p>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium">Qty: ${quantity}</div>
                    <div class="text-xs text-gray-500">${status}</div>
                </div>
            </div>
            
            ${additionalFields ? `
                <div class="border-t pt-3 mt-3">
                    <details class="group">
                        <summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1">
                            <svg class="h-4 w-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                            Additional Details
                        </summary>
                        <div class="mt-2 pl-5">
                            ${additionalFields}
                        </div>
                    </details>
                </div>
            ` : ''}
        </div>
    `;
}

// REMOVED DUPLICATE FUNCTIONS - These are defined earlier in the file around line 2335
// ===== ACCOUNT HISTORY PAGE FUNCTIONS =====

// Account History state
let currentAccountHistory = {
    accountName: null,
    requests: [],
    showComparison: false,
    limit: 5,  // Default to showing latest 5 requests
    deploymentFilter: '',  // Deployment number filter
    selectedRecords: []  // For flexible side-by-side comparison (max 2)
};

// Initialize Account History page
function initializeAccountHistory() {
    const searchInput = document.getElementById('account-history-search');
    const clearButton = document.getElementById('account-history-clear');
    const comparisonToggle = document.getElementById('show-comparison-toggle');
    const limitSelector = document.getElementById('account-history-limit');
    const deploymentFilter = document.getElementById('account-history-deployment-filter');
    const tableBody = document.getElementById('account-history-table-body');
    
    if (searchInput) {
        // Debounce search to avoid too many API calls
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleAccountHistorySearch(e.target.value);
            }, 300);
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', clearAccountHistory);
    }
    
    if (comparisonToggle) {
        comparisonToggle.addEventListener('change', (e) => {
            currentAccountHistory.showComparison = e.target.checked;
            renderAccountHistoryTable();
        });
    }
    
    if (limitSelector) {
        limitSelector.addEventListener('change', (e) => {
            const value = e.target.value;
            currentAccountHistory.limit = value === 'all' ? null : parseInt(value);
            renderAccountHistoryTable();
        });
    }
    
    if (deploymentFilter) {
        deploymentFilter.addEventListener('change', (e) => {
            currentAccountHistory.deploymentFilter = e.target.value;
            renderAccountHistoryTable();
        });
    }
    
    // Set up event delegation for product group buttons in Account History table
    if (tableBody && !tableBody.dataset.productDelegationSet) {
        tableBody.addEventListener('click', function(event) {
            const button = event.target.closest('.product-group-btn');
            if (button) {
                event.preventDefault();
                event.stopPropagation();
                
                const requestId = button.getAttribute('data-request-id');
                const groupType = button.getAttribute('data-group-type');
                const entitlements = button.getAttribute('data-entitlements');
                
                console.log('Account History: Product button clicked', { requestId, groupType, hasEntitlements: !!entitlements });
                
                if (requestId && groupType && entitlements) {
                    showProductGroup(requestId, groupType, entitlements);
                } else {
                    console.error('Missing button data:', { requestId, groupType, entitlements: !!entitlements });
                }
            }
        });
        tableBody.dataset.productDelegationSet = 'true';
        console.log('Event delegation set up for Account History product group buttons');
    }
    
    console.log('Account History page initialized');
}

// Toggle record selection for comparison
function toggleRecordSelection(requestId, checkbox) {
    const index = currentAccountHistory.selectedRecords.indexOf(requestId);
    
    if (checkbox.checked) {
        // Add record if not already selected and limit not reached
        if (index === -1 && currentAccountHistory.selectedRecords.length < 2) {
            currentAccountHistory.selectedRecords.push(requestId);
        } else if (currentAccountHistory.selectedRecords.length >= 2) {
            // Prevent selecting more than 2
            checkbox.checked = false;
            alert('You can only select 2 records for comparison. Please unselect one first.');
            return;
        }
    } else {
        // Remove record if it was selected
        if (index > -1) {
            currentAccountHistory.selectedRecords.splice(index, 1);
        }
    }
    
    updateComparisonButtonState();
}

// Update the state of the comparison button based on selected records
function updateComparisonButtonState() {
    const compareButton = document.getElementById('flexible-compare-button');
    if (compareButton) {
        if (currentAccountHistory.selectedRecords.length === 2) {
            compareButton.disabled = false;
            compareButton.classList.remove('opacity-50', 'cursor-not-allowed');
            compareButton.classList.add('hover:bg-primary/90');
        } else {
            compareButton.disabled = true;
            compareButton.classList.add('opacity-50', 'cursor-not-allowed');
            compareButton.classList.remove('hover:bg-primary/90');
        }
    }
}

// Show flexible comparison modal with selected records
function showFlexibleComparison() {
    if (currentAccountHistory.selectedRecords.length !== 2) {
        alert('Please select exactly 2 records for comparison.');
        return;
    }
    
    const [recordId1, recordId2] = currentAccountHistory.selectedRecords;
    
    // Find the request records to get their names
    const request1 = currentAccountHistory.requests.find(r => r.Id === recordId1);
    const request2 = currentAccountHistory.requests.find(r => r.Id === recordId2);
    
    if (!request1 || !request2) {
        alert('Could not find selected records.');
        return;
    }
    
    // Extract PS numbers from request names (e.g., "PS-4280" -> 4280)
    const extractPSNumber = (name) => {
        const match = name.match(/PS-(\d+)/i);
        return match ? parseInt(match[1]) : 0;
    };
    
    const psNumber1 = extractPSNumber(request1.Name);
    const psNumber2 = extractPSNumber(request2.Name);
    
    // Higher PS number should be "current" (first parameter), lower should be "previous" (second parameter)
    if (psNumber1 > psNumber2) {
        showDetailedComparisonModal(recordId1, recordId2);
    } else {
        showDetailedComparisonModal(recordId2, recordId1);
    }
}

// Clear all selected records
function clearRecordSelection() {
    currentAccountHistory.selectedRecords = [];
    
    // Uncheck all checkboxes
    document.querySelectorAll('.record-select-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    updateComparisonButtonState();
}

// Handle account history search with smart detection
async function handleAccountHistorySearch(searchTerm) {
    const searchInput = document.getElementById('account-history-search');
    const searchResults = document.getElementById('account-history-search-results');
    const searchLoading = document.getElementById('account-history-search-loading');
    
    if (!searchTerm || searchTerm.trim().length < 2) {
        searchResults.classList.add('hidden');
        return;
    }
    
    // Show loading indicator
    if (searchLoading) searchLoading.classList.remove('hidden');
    
    try {
        // Smart detection: if starts with PS-, search by request ID, otherwise by account name
        const isPSID = /^PS-/i.test(searchTerm.trim());
        
        const response = await fetch(`/api/provisioning/search?q=${encodeURIComponent(searchTerm)}&limit=20`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Search failed');
        }
        
        // Display search results
        displayAccountHistorySearchResults(data.results, searchTerm, isPSID);
        
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = `<div class="p-4 text-sm text-red-600">Error: ${error.message}</div>`;
        searchResults.classList.remove('hidden');
    } finally {
        if (searchLoading) searchLoading.classList.add('hidden');
    }
}

// Display search results with account and request options
function displayAccountHistorySearchResults(results, searchTerm, isPSID) {
    const searchResults = document.getElementById('account-history-search-results');
    
    const technicalRequests = results.technicalRequests || [];
    const accounts = results.accounts || [];
    
    if (technicalRequests.length === 0 && accounts.length === 0) {
        searchResults.innerHTML = `
            <div class="p-4 text-sm text-muted-foreground">
                No results found for "${searchTerm}"
            </div>
        `;
        searchResults.classList.remove('hidden');
        return;
    }
    
    let html = '';
    
    // Show Technical Team Requests section
    if (technicalRequests.length > 0) {
        html += `
            <div class="p-2 border-b bg-muted/50">
                <p class="text-xs font-medium text-muted-foreground uppercase">Technical Team Requests</p>
            </div>
        `;
        
        technicalRequests.forEach(request => {
            html += `
                <button 
                    class="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                    onclick="selectAccountFromRequest('${request.id}', '${request.name}', '${escapeHtml(request.account)}')"
                >
                    <div class="font-medium text-sm">${request.name}</div>
                    <div class="text-xs text-muted-foreground mt-1">
                        Account: ${escapeHtml(request.account)} 
                        <span class="mx-1">•</span>
                        ${request.requestType || 'N/A'}
                    </div>
                </button>
            `;
        });
    }
    
    // Show Accounts section
    if (accounts.length > 0) {
        html += `
            <div class="p-2 border-b bg-muted/50">
                <p class="text-xs font-medium text-muted-foreground uppercase">Accounts</p>
            </div>
        `;
        
        accounts.forEach(account => {
            html += `
                <button 
                    class="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                    onclick="selectAccount('${escapeHtml(account.name)}')"
                >
                    <div class="font-medium text-sm">${escapeHtml(account.name)}</div>
                    ${account.industry ? `<div class="text-xs text-muted-foreground mt-1">${account.industry}</div>` : ''}
                </button>
            `;
        });
    }
    
    searchResults.innerHTML = html;
    searchResults.classList.remove('hidden');
}

// Select account from a Technical Team Request
async function selectAccountFromRequest(requestId, requestName, accountName) {
    console.log('Selecting account from request:', requestName, accountName);
    
    // Hide search results
    const searchResults = document.getElementById('account-history-search-results');
    if (searchResults) searchResults.classList.add('hidden');
    
    // Load the account history
    await loadAccountHistory(accountName);
    
    // Optionally scroll to the specific request in the table
    setTimeout(() => {
        const requestRow = document.querySelector(`[data-request-name="${requestName}"]`);
        if (requestRow) {
            requestRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            requestRow.classList.add('bg-accent');
            setTimeout(() => requestRow.classList.remove('bg-accent'), 2000);
        }
    }, 100);
}

// Select account directly
async function selectAccount(accountName) {
    console.log('Selecting account:', accountName);
    
    // Hide search results
    const searchResults = document.getElementById('account-history-search-results');
    if (searchResults) searchResults.classList.add('hidden');
    
    // Load the account history
    await loadAccountHistory(accountName);
}

// Load account history
async function loadAccountHistory(accountName) {
    try {
        console.log('Loading history for account:', accountName);
        
        // Show loading state
        showAccountHistoryLoading(true);
        
        // Fetch all requests for this account
        const response = await fetch(`/api/provisioning/requests?search=${encodeURIComponent(accountName)}&pageSize=100`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load account history');
        }
        
        // Sort requests by date (oldest to newest)
        const requests = (data.records || []).sort((a, b) => {
            return new Date(a.CreatedDate) - new Date(b.CreatedDate);
        });
        
        // Update state (preserve limit setting)
        const limitSelector = document.getElementById('account-history-limit');
        const currentLimit = limitSelector?.value || '5';
        
        currentAccountHistory = {
            accountName: accountName,
            requests: requests,
            showComparison: document.getElementById('show-comparison-toggle')?.checked || false,
            limit: currentLimit === 'all' ? null : parseInt(currentLimit),
            deploymentFilter: '', // Reset deployment filter
            selectedRecords: [] // Reset selected records for comparison
        };
        
        // Ensure the limit selector is set to the current value
        if (limitSelector && !limitSelector.value) {
            limitSelector.value = '5';
        }
        
        // Populate deployment filter dropdown
        populateDeploymentFilter(requests);
        
        // Update UI
        displayAccountSummary(accountName, requests);
        renderAccountHistoryTable();
        
        // Hide loading state
        showAccountHistoryLoading(false);
        
    } catch (error) {
        console.error('Error loading account history:', error);
        alert('Failed to load account history: ' + error.message);
        showAccountHistoryLoading(false);
    }
}

// Populate deployment filter dropdown with unique deployment numbers
function populateDeploymentFilter(requests) {
    const deploymentFilter = document.getElementById('account-history-deployment-filter');
    if (!deploymentFilter) return;
    
    // Extract unique deployment numbers from requests
    const deploymentNumbers = new Set();
    requests.forEach(request => {
        const deploymentNumber = request.Deployment__r?.Name;
        if (deploymentNumber && deploymentNumber !== 'N/A') {
            deploymentNumbers.add(deploymentNumber);
        }
    });
    
    // Sort deployment numbers alphabetically
    const sortedDeploymentNumbers = Array.from(deploymentNumbers).sort();
    
    // Build options HTML
    let optionsHtml = '<option value="">All Deployments</option>';
    sortedDeploymentNumbers.forEach(deploymentNumber => {
        optionsHtml += `<option value="${deploymentNumber}">${deploymentNumber}</option>`;
    });
    
    deploymentFilter.innerHTML = optionsHtml;
    
    console.log(`Populated deployment filter with ${sortedDeploymentNumbers.length} unique deployment(s)`);
}

// Show/hide loading state
function showAccountHistoryLoading(isLoading) {
    const emptyState = document.getElementById('account-history-empty-state');
    const summarySection = document.getElementById('account-summary-section');
    const tableSection = document.getElementById('account-history-table-section');
    
    if (isLoading) {
        if (emptyState) emptyState.classList.add('hidden');
        if (summarySection) summarySection.classList.add('hidden');
        if (tableSection) tableSection.classList.add('hidden');
        // Could add a loading spinner here
    }
}

// Display account summary card
function displayAccountSummary(accountName, requests) {
    const emptyState = document.getElementById('account-history-empty-state');
    const summarySection = document.getElementById('account-summary-section');
    const summaryName = document.getElementById('account-summary-name');
    const summaryCount = document.getElementById('account-summary-count');
    const summaryDateRange = document.getElementById('account-summary-date-range');
    
    if (emptyState) emptyState.classList.add('hidden');
    if (summarySection) summarySection.classList.remove('hidden');
    
    if (summaryName) summaryName.textContent = accountName;
    if (summaryCount) summaryCount.textContent = requests.length;
    
    if (summaryDateRange && requests.length > 0) {
        const oldestDate = new Date(requests[0].CreatedDate);
        const newestDate = new Date(requests[requests.length - 1].CreatedDate);
        const dateRange = `${oldestDate.toLocaleDateString()} - ${newestDate.toLocaleDateString()}`;
        summaryDateRange.textContent = dateRange;
    }
}

// Render account history table
function renderAccountHistoryTable() {
    const tableSection = document.getElementById('account-history-table-section');
    const tableBody = document.getElementById('account-history-table-body');
    
    if (!tableBody) return;
    
    if (!currentAccountHistory.requests || currentAccountHistory.requests.length === 0) {
        tableBody.innerHTML = `
            <tr class="border-b transition-colors">
                <td class="p-4 align-middle text-center text-muted-foreground" colspan="10">
                    <div class="flex flex-col items-center gap-2 py-8">
                        <p class="text-sm">No requests found for this account</p>
                    </div>
                </td>
            </tr>
        `;
        if (tableSection) tableSection.classList.add('hidden');
        return;
    }
    
    if (tableSection) tableSection.classList.remove('hidden');
    
    // Sort requests by date descending (most recent first)
    let allRequests = [...currentAccountHistory.requests].sort((a, b) => {
        return new Date(b.CreatedDate) - new Date(a.CreatedDate);
    });
    
    // Apply deployment filter if set
    const deploymentFilter = currentAccountHistory.deploymentFilter;
    if (deploymentFilter) {
        allRequests = allRequests.filter(request => {
            const deploymentNumber = request.Deployment__r?.Name || 'N/A';
            return deploymentNumber === deploymentFilter;
        });
    }
    
    // Apply limit if set
    const totalCount = allRequests.length;
    const unfilteredCount = currentAccountHistory.requests.length;
    const limit = currentAccountHistory.limit;
    const requests = limit ? allRequests.slice(0, limit) : allRequests;
    
    // Update count indicator
    const countIndicator = document.getElementById('account-history-count-indicator');
    if (countIndicator) {
        let countText = '';
        if (deploymentFilter) {
            // Filtering is active
            if (limit && limit < totalCount) {
                countText = `Showing latest ${requests.length} of ${totalCount} filtered requests (${unfilteredCount} total)`;
            } else {
                countText = `Showing all ${totalCount} filtered requests (${unfilteredCount} total)`;
            }
        } else {
            // No filtering
            if (limit && limit < totalCount) {
                countText = `Showing latest ${requests.length} of ${totalCount} requests`;
            } else {
                countText = `Showing all ${totalCount} requests`;
            }
        }
        countIndicator.textContent = countText;
    }
    
    let html = '';
    
    requests.forEach((request, index) => {
        const createdDate = new Date(request.CreatedDate);
        
        // DEBUG: Log PS-4652 data
        if (request.Name === 'PS-4652') {
            console.log('🔍 DEBUG PS-4652:', {
                name: request.Name,
                account: request.Account__c,
                tenantNameField: request.Tenant_Name__c,
                parsedPayloadTenantName: request.parsedPayload?.tenantName,
                parsedPayloadKeys: request.parsedPayload ? Object.keys(request.parsedPayload) : 'no parsedPayload',
                hasPayloadData: !!request.Payload_Data__c,
                payloadDataLength: request.Payload_Data__c?.length
            });
            
            // Try to parse raw payload if available
            if (request.Payload_Data__c) {
                try {
                    const rawPayload = JSON.parse(request.Payload_Data__c);
                    console.log('🔍 PS-4652 Payload structure check:', {
                        'Salesforce Tenant_Name__c field': request.Tenant_Name__c,
                        'properties.provisioningDetail.tenantName': rawPayload.properties?.provisioningDetail?.tenantName,
                        'properties.tenantName': rawPayload.properties?.tenantName,
                        'preferredSubdomain1': rawPayload.preferredSubdomain1,
                        'preferredSubdomain2': rawPayload.preferredSubdomain2,
                        'tenantName (root)': rawPayload.tenantName,
                        'properties keys': rawPayload.properties ? Object.keys(rawPayload.properties) : 'no properties'
                    });
                    
                    // Search for "ajg-eudev" in the entire payload
                    const payloadStr = JSON.stringify(rawPayload);
                    if (payloadStr.includes('ajg-eudev')) {
                        console.log('✅ Found "ajg-eudev" in payload, searching for location...');
                        // Find the key path
                        const lines = JSON.stringify(rawPayload, null, 2).split('\n');
                        lines.forEach((line, idx) => {
                            if (line.includes('ajg-eudev')) {
                                console.log('  Line', idx, ':', line.trim());
                            }
                        });
                    } else {
                        console.log('❌ "ajg-eudev" NOT found in payload at all!');
                    }
                } catch (e) {
                    console.error('❌ Error parsing PS-4652 payload:', e);
                }
            }
        }
        
        // Extract tenantName and deploymentNumber
        const tenantName = request.parsedPayload?.tenantName || 'N/A';
        const deploymentNumber = request.Deployment__r?.Name || 'N/A';
        
        // Find the previous request with the same deployment number (for comparison)
        // Since requests are sorted by date descending (newest first), we look forward in the array
        let previousRequestSameDeployment = null;
        for (let i = index + 1; i < requests.length; i++) {
            const candidateDeploymentNumber = requests[i].Deployment__r?.Name || 'N/A';
            if (candidateDeploymentNumber === deploymentNumber && deploymentNumber !== 'N/A') {
                previousRequestSameDeployment = requests[i];
                break;
            }
        }
        
        // Check if this record is selected
        const isSelected = currentAccountHistory.selectedRecords.includes(request.Id);
        
        // Main row
        html += `
            <tr class="border-b transition-colors hover:bg-muted/50" data-request-name="${request.Name}" data-tenant-name="${tenantName}">
                <td class="px-4 py-3 align-middle text-center">
                    <input 
                        type="checkbox" 
                        class="record-select-checkbox h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        ${isSelected ? 'checked' : ''}
                        onchange="toggleRecordSelection('${request.Id}', this)"
                        title="Select for comparison"
                    >
                </td>
                <td class="px-4 py-3 align-middle">
                    <button 
                        class="text-muted-foreground hover:text-foreground transition-colors"
                        onclick="toggleRequestDetails('${request.Id}')"
                        title="View details"
                    >
                        <svg id="expand-icon-${request.Id}" class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </td>
                <td class="px-4 py-3 align-middle">
                    <span class="font-medium">${request.Name}</span>
                </td>
                <td class="px-4 py-3 align-middle text-sm text-muted-foreground">
                    ${createdDate.toLocaleDateString()}
                </td>
                <td class="px-4 py-3 align-middle text-sm">
                    ${deploymentNumber}
                </td>
                <td class="px-4 py-3 align-middle text-sm">
                    ${tenantName}
                </td>
                <td class="px-4 py-3 align-middle">
                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">
                        ${request.Status__c || 'Unknown'}
                    </span>
                </td>
                <td class="px-4 py-3 align-middle text-sm">
                    ${request.TenantRequestAction__c || 'N/A'}
                </td>
                <td class="px-4 py-3 align-middle text-sm">
                    ${getProductsDisplay(request)}
                </td>
                <td class="px-4 py-3 align-middle text-center">
                    <div class="relative inline-block">
                        <button 
                            onclick="toggleActionDropdown('${request.Id}')"
                            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            title="Actions"
                        >
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                        <div id="action-dropdown-${request.Id}" class="hidden absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                            <div class="py-1" role="menu">
                                <button 
                                    onclick="viewRequestInProvisioning('${request.Id}', '${request.Name}')"
                                    class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    role="menuitem"
                                >
                                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    View in Provisioning Monitor
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr id="details-row-${request.Id}" class="hidden border-b bg-muted/30">
                <td colspan="10" class="p-0">
                    <div class="p-6">
                        ${renderRequestDetails(request, previousRequestSameDeployment)}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // Update the comparison button state after rendering
    updateComparisonButtonState();
}

// Render request details (for expandable row)
function renderRequestDetails(request, previousRequest) {
    // Parse the payload data properly
    let parsedPayload = {};
    if (request.Payload_Data__c) {
        try {
            const payload = JSON.parse(request.Payload_Data__c);
            const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
            
            // Extract tenant name from multiple possible locations (matches backend logic)
            const tenantName = payload.properties?.provisioningDetail?.tenantName 
                || payload.properties?.tenantName 
                || payload.preferredSubdomain1
                || payload.preferredSubdomain2
                || payload.properties?.preferredSubdomain1
                || payload.properties?.preferredSubdomain2
                || payload.tenantName 
                || null;
            
            // Extract region from multiple possible locations
            const region = payload.properties?.provisioningDetail?.region 
                || payload.properties?.region 
                || payload.region 
                || null;
            
            parsedPayload = {
                hasDetails: true,
                modelEntitlements: entitlements.modelEntitlements || [],
                dataEntitlements: entitlements.dataEntitlements || [],
                appEntitlements: entitlements.appEntitlements || [],
                tenantName: tenantName,
                region: region
            };
            
            // Debug logging for app entitlements to help understand discrepancies
            if (parsedPayload.appEntitlements.length > 0) {
                const appsWithCode = parsedPayload.appEntitlements.filter(e => e.productCode || e.name).length;
                const appsWithoutCode = parsedPayload.appEntitlements.length - appsWithCode;
                if (appsWithoutCode > 0) {
                    console.log(`⚠️ ${request.Name}: ${appsWithoutCode} app(s) missing productCode/name (Total: ${parsedPayload.appEntitlements.length}, With codes: ${appsWithCode})`);
                    console.log('Apps without codes:', parsedPayload.appEntitlements.filter(e => !e.productCode && !e.name));
                }
            }
        } catch (e) {
            console.error('Error parsing payload:', e);
        }
    }
    
    const showComparison = currentAccountHistory.showComparison && previousRequest;
    
    let html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h4 class="font-semibold mb-3">Request Information</h4>
                <dl class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">Salesforce ID:</dt>
                        <dd class="font-medium">${request.Id}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">Created:</dt>
                        <dd class="font-medium">${new Date(request.CreatedDate).toLocaleString()}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">Last Modified:</dt>
                        <dd class="font-medium">${new Date(request.LastModifiedDate).toLocaleString()}</dd>
                    </div>
                    ${request.Deployment__c ? `
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">Deployment ID:</dt>
                        <dd class="font-medium font-mono text-xs">${request.Deployment__c}</dd>
                    </div>
                    ` : ''}
                </dl>
            </div>
            
            <div>
                <h4 class="font-semibold mb-3">Product Entitlements</h4>
                ${renderEntitlementsSummary(parsedPayload, request.Id)}
            </div>
        </div>
    `;
    
    // Add comparison section if enabled
    if (showComparison) {
        if (previousRequest) {
            // Parse previous request payload
            let previousParsedPayload = {};
            if (previousRequest.Payload_Data__c) {
                try {
                    const prevPayload = JSON.parse(previousRequest.Payload_Data__c);
                    const prevEntitlements = prevPayload.properties?.provisioningDetail?.entitlements || {};
                    previousParsedPayload = {
                        hasDetails: true,
                        modelEntitlements: prevEntitlements.modelEntitlements || [],
                        dataEntitlements: prevEntitlements.dataEntitlements || [],
                        appEntitlements: prevEntitlements.appEntitlements || []
                    };
                } catch (e) {
                    console.error('Error parsing previous payload:', e);
                }
            }
            
            const currentDeploymentNumber = request.Deployment__r?.Name || 'N/A';
            html += `
                <div class="mt-6 pt-6 border-t">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold flex items-center gap-2">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="16 3 21 3 21 8"></polyline>
                                <line x1="4" x2="21" y1="20" y2="3"></line>
                                <polyline points="21 16 21 21 16 21"></polyline>
                                <line x1="15" x2="10" y1="15" y2="15"></line>
                                <line x1="15" x2="10" y1="19" y2="19"></line>
                            </svg>
                            Changes from Previous Request for Deployment ${currentDeploymentNumber} (${previousRequest.Name})
                        </h4>
                        <button 
                            onclick="showDetailedComparisonModal('${request.Id}', '${previousRequest.Id}')"
                            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                                <line x1="9" x2="9" y1="3" y2="21"></line>
                            </svg>
                            View Side-by-Side
                        </button>
                    </div>
                    ${renderProductComparison(parsedPayload, previousParsedPayload)}
                </div>
            `;
        } else {
            // No previous request for the same deployment
            const currentDeploymentNumber = request.Deployment__r?.Name || 'N/A';
            html += `
                <div class="mt-6 pt-6 border-t">
                    <h4 class="font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" x2="12" y1="8" y2="12"></line>
                            <line x1="12" x2="12.01" y1="16" y2="16"></line>
                        </svg>
                        No Previous Request for Deployment ${currentDeploymentNumber}
                    </h4>
                    <p class="text-sm text-muted-foreground">This is the first or only request for this deployment in the current view.</p>
                </div>
            `;
        }
    }
    
    return html;
}

// Render entitlements summary with collapsible categories
function renderEntitlementsSummary(parsedPayload, requestId) {
    if (!parsedPayload.hasDetails) {
        return '<p class="text-sm text-muted-foreground">No entitlements data available</p>';
    }
    
    let html = '<div class="space-y-3 text-sm">';
    
    const modelEntitlements = parsedPayload.modelEntitlements || [];
    const dataEntitlements = parsedPayload.dataEntitlements || [];
    const appEntitlements = parsedPayload.appEntitlements || [];
    
    // Models - Collapsible
    if (modelEntitlements.length > 0) {
        const modelsId = `detail-models-${requestId}`;
        html += `
            <div>
                <button 
                    onclick="toggleDetailProductGroup('${modelsId}')"
                    class="flex items-center gap-2 font-medium mb-1 text-left hover:text-primary transition-colors"
                >
                    <svg id="${modelsId}-icon" class="h-3 w-3 transform transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    Models (${modelEntitlements.length})
                </button>
                <div id="${modelsId}" class="hidden text-muted-foreground ml-5">
                    ${modelEntitlements.map(e => e.productCode || 'Unknown').join(', ')}
                </div>
            </div>
        `;
    }
    
    // Data Entitlements - Collapsible
    if (dataEntitlements.length > 0) {
        const dataId = `detail-data-${requestId}`;
        html += `
            <div>
                <button 
                    onclick="toggleDetailProductGroup('${dataId}')"
                    class="flex items-center gap-2 font-medium mb-1 text-left hover:text-primary transition-colors"
                >
                    <svg id="${dataId}-icon" class="h-3 w-3 transform transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    Data Entitlements (${dataEntitlements.length})
                </button>
                <div id="${dataId}" class="hidden text-muted-foreground ml-5">
                    ${dataEntitlements.map(e => e.productCode || e.name || 'Unknown').join(', ')}
                </div>
            </div>
        `;
    }
    
    // Applications - Collapsible
    if (appEntitlements.length > 0) {
        const appsId = `detail-apps-${requestId}`;
        html += `
            <div>
                <button 
                    onclick="toggleDetailProductGroup('${appsId}')"
                    class="flex items-center gap-2 font-medium mb-1 text-left hover:text-primary transition-colors"
                >
                    <svg id="${appsId}-icon" class="h-3 w-3 transform transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    Applications (${appEntitlements.length})
                </button>
                <div id="${appsId}" class="hidden text-muted-foreground ml-5">
                    ${appEntitlements.map(e => e.productCode || e.name || 'Unknown').join(', ')}
                </div>
            </div>
        `;
    }
    
    if (parsedPayload.tenantName) {
        html += `<div class="pt-2 border-t"><span class="text-muted-foreground">Tenant:</span> <span class="font-medium">${parsedPayload.tenantName}</span></div>`;
    }
    
    if (parsedPayload.region) {
        html += `<div><span class="text-muted-foreground">Region:</span> <span class="font-medium">${parsedPayload.region}</span></div>`;
    }
    
    html += '</div>';
    return html;
}

// Toggle detail product group visibility
function toggleDetailProductGroup(groupId) {
    const group = document.getElementById(groupId);
    const icon = document.getElementById(`${groupId}-icon`);
    
    if (group && icon) {
        group.classList.toggle('hidden');
        if (group.classList.contains('hidden')) {
            icon.classList.remove('rotate-90');
        } else {
            icon.classList.add('rotate-90');
        }
    }
}

// Render product comparison
function renderProductComparison(currentPayload, previousPayload) {
    const current = {
        models: (currentPayload.modelEntitlements || []).map(e => e.productCode).filter(Boolean),
        data: (currentPayload.dataEntitlements || []).map(e => e.productCode || e.name).filter(Boolean),
        apps: (currentPayload.appEntitlements || []).map(e => e.productCode || e.name).filter(Boolean)
    };
    
    const previous = {
        models: (previousPayload.modelEntitlements || []).map(e => e.productCode).filter(Boolean),
        data: (previousPayload.dataEntitlements || []).map(e => e.productCode || e.name).filter(Boolean),
        apps: (previousPayload.appEntitlements || []).map(e => e.productCode || e.name).filter(Boolean)
    };
    
    const changes = {
        models: {
            added: current.models.filter(p => !previous.models.includes(p)),
            removed: previous.models.filter(p => !current.models.includes(p)),
            unchanged: current.models.filter(p => previous.models.includes(p))
        },
        data: {
            added: current.data.filter(p => !previous.data.includes(p)),
            removed: previous.data.filter(p => !current.data.includes(p)),
            unchanged: current.data.filter(p => previous.data.includes(p))
        },
        apps: {
            added: current.apps.filter(p => !previous.apps.includes(p)),
            removed: previous.apps.filter(p => !current.apps.includes(p)),
            unchanged: current.apps.filter(p => previous.apps.includes(p))
        }
    };
    
    const hasChanges = 
        changes.models.added.length > 0 || changes.models.removed.length > 0 ||
        changes.data.added.length > 0 || changes.data.removed.length > 0 ||
        changes.apps.added.length > 0 || changes.apps.removed.length > 0;
    
    if (!hasChanges) {
        return '<p class="text-sm text-muted-foreground">No changes in product entitlements</p>';
    }
    
    // Count summary
    let html = '<div class="mb-4 p-3 bg-muted/30 rounded-md text-xs space-y-1">';
    html += '<p class="font-semibold text-muted-foreground">Change Summary:</p>';
    if (previous.models.length > 0 || current.models.length > 0) {
        html += `<p><strong>Models:</strong> Previous: ${previous.models.length}, Current: ${current.models.length}, Unchanged: ${changes.models.unchanged.length}</p>`;
    }
    if (previous.data.length > 0 || current.data.length > 0) {
        html += `<p><strong>Data:</strong> Previous: ${previous.data.length}, Current: ${current.data.length}, Unchanged: ${changes.data.unchanged.length}</p>`;
    }
    if (previous.apps.length > 0 || current.apps.length > 0) {
        html += `<p><strong>Apps:</strong> Previous: ${previous.apps.length}, Current: ${current.apps.length}, Unchanged: ${changes.apps.unchanged.length}</p>`;
    }
    html += '</div>';
    
    html += '<div class="grid grid-cols-1 gap-4 text-sm">';
    
    // Added products
    const hasAdded = changes.models.added.length > 0 || changes.data.added.length > 0 || changes.apps.added.length > 0;
    if (hasAdded) {
        html += '<div class="space-y-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">';
        html += '<h5 class="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">';
        html += '<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
        html += 'Added</h5>';
        
        if (changes.models.added.length > 0) {
            html += `<p><span class="font-medium">Models (${changes.models.added.length}):</span> ${changes.models.added.join(', ')}</p>`;
        }
        if (changes.data.added.length > 0) {
            html += `<p><span class="font-medium">Data (${changes.data.added.length}):</span> ${changes.data.added.join(', ')}</p>`;
        }
        if (changes.apps.added.length > 0) {
            html += `<p><span class="font-medium">Apps (${changes.apps.added.length}):</span> ${changes.apps.added.join(', ')}</p>`;
        }
        html += '</div>';
    }
    
    // Removed products
    const hasRemoved = changes.models.removed.length > 0 || changes.data.removed.length > 0 || changes.apps.removed.length > 0;
    if (hasRemoved) {
        html += '<div class="space-y-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">';
        html += '<h5 class="font-medium text-red-700 dark:text-red-400 flex items-center gap-2">';
        html += '<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
        html += 'Removed</h5>';
        
        if (changes.models.removed.length > 0) {
            html += `<p><span class="font-medium">Models (${changes.models.removed.length}):</span> ${changes.models.removed.join(', ')}</p>`;
        }
        if (changes.data.removed.length > 0) {
            html += `<p><span class="font-medium">Data (${changes.data.removed.length}):</span> ${changes.data.removed.join(', ')}</p>`;
        }
        if (changes.apps.removed.length > 0) {
            html += `<p><span class="font-medium">Apps (${changes.apps.removed.length}):</span> ${changes.apps.removed.join(', ')}</p>`;
        }
        html += '</div>';
    }
    
    // Unchanged products (new section)
    const hasUnchanged = changes.models.unchanged.length > 0 || changes.data.unchanged.length > 0 || changes.apps.unchanged.length > 0;
    if (hasUnchanged) {
        html += '<details class="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">';
        html += '<summary class="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300">';
        html += '<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        html += `Unchanged (${changes.models.unchanged.length + changes.data.unchanged.length + changes.apps.unchanged.length} items - click to expand)</summary>`;
        html += '<div class="mt-2 space-y-2 text-muted-foreground">';
        
        if (changes.models.unchanged.length > 0) {
            html += `<p><span class="font-medium">Models (${changes.models.unchanged.length}):</span> ${changes.models.unchanged.join(', ')}</p>`;
        }
        if (changes.data.unchanged.length > 0) {
            html += `<p><span class="font-medium">Data (${changes.data.unchanged.length}):</span> ${changes.data.unchanged.join(', ')}</p>`;
        }
        if (changes.apps.unchanged.length > 0) {
            html += `<p><span class="font-medium">Apps (${changes.apps.unchanged.length}):</span> ${changes.apps.unchanged.join(', ')}</p>`;
        }
        html += '</div>';
        html += '</details>';
    }
    
    html += '</div>';
    return html;
}

// Render enhanced comparison table with attribute-level details
function renderEnhancedComparisonTable(title, type, comparison, prevName, currName) {
    const { added, removed, updated, unchanged } = comparison;
    const total = added.length + removed.length + updated.length + unchanged.length;
    
    if (total === 0) {
        return `
            <div class="border rounded-lg p-4">
                <h3 class="font-semibold mb-2">${title}</h3>
                <p class="text-sm text-muted-foreground">No ${title.toLowerCase()} found in either request.</p>
            </div>
        `;
    }
    
    // Helper to format attribute value
    const formatValue = (value) => {
        if (value === null || value === undefined) return '<span class="text-muted-foreground italic text-xs">-</span>';
        if (typeof value === 'number') return value.toLocaleString();
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return escapeHtml(String(value));
    };
    
    // Define columns based on product type (excluding productCode as it's the identifier)
    let columns = [];
    if (type === 'models') {
        columns = [
            { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' },
            { key: 'productModifier', label: 'Product Modifier' }
        ];
    } else if (type === 'data') {
        columns = [
            { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' },
            { key: 'productModifier', label: 'Product Modifier' }
        ];
    } else if (type === 'apps') {
        columns = [
            { key: 'packageName', label: 'Package Name' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' },
            { key: 'productModifier', label: 'Product Modifier' }
        ];
    }
    
    // Build all products with their comparison data
    const allProducts = [];
    
    // Added products
    added.forEach(item => {
        allProducts.push({
            productCode: item.id,
            prev: null,
            curr: item.product,
            status: 'added',
            changes: []
        });
    });
    
    // Removed products
    removed.forEach(item => {
        allProducts.push({
            productCode: item.id,
            prev: item.product,
            curr: null,
            status: 'removed',
            changes: []
        });
    });
    
    // Updated products
    updated.forEach(item => {
        allProducts.push({
            productCode: item.id,
            prev: item.prev,
            curr: item.curr,
            status: 'updated',
            changes: item.changes.map(c => c.field)
        });
    });
    
    // Unchanged products
    unchanged.forEach(item => {
        allProducts.push({
            productCode: item.id,
            prev: item.product,
            curr: item.product,
            status: 'unchanged',
            changes: []
        });
    });
    
    // Sort products by product code
    allProducts.sort((a, b) => String(a.productCode).localeCompare(String(b.productCode)));
    
    // Determine if section should be collapsed (only if ALL products are unchanged)
    const hasChanges = added.length > 0 || removed.length > 0 || updated.length > 0;
    const openAttribute = hasChanges ? 'open' : '';
    
    let html = `
        <div class="border rounded-lg overflow-hidden">
            <details ${openAttribute}>
                <summary class="bg-muted/50 p-4 border-b cursor-pointer hover:bg-muted/70 transition-colors">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-semibold inline-flex items-center gap-2">
                                <svg class="h-4 w-4 transition-transform details-chevron" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                                ${title}
                            </h3>
                            <p class="text-xs text-muted-foreground mt-1">
                                Total: ${total} | <span class="text-green-700 dark:text-green-400">Added: ${added.length}</span> | 
                                <span class="text-red-700 dark:text-red-400">Removed: ${removed.length}</span> | 
                                <span class="text-yellow-700 dark:text-yellow-400">Updated: ${updated.length}</span> | 
                                <span class="text-blue-700 dark:text-blue-400">Unchanged: ${unchanged.length}</span>
                            </p>
                        </div>
                        ${hasChanges ? '<span class="text-xs font-medium text-yellow-700 dark:text-yellow-400">Has Changes</span>' : '<span class="text-xs font-medium text-blue-700 dark:text-blue-400">No Changes</span>'}
                    </div>
                </summary>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead class="bg-muted/30 border-b-2 border-gray-300 dark:border-gray-600">
                            <tr>
                                <th class="px-2 py-2 text-left font-semibold text-muted-foreground border-r border-gray-300 dark:border-gray-600" rowspan="2">Product Code</th>
                                <th class="px-2 py-2 text-center font-semibold text-muted-foreground border-r border-gray-300 dark:border-gray-600" colspan="${columns.length}">${prevName}</th>
                                <th class="px-2 py-2 text-center font-semibold text-muted-foreground border-r border-gray-300 dark:border-gray-600" colspan="${columns.length}">${currName}</th>
                                <th class="px-2 py-2 text-center font-semibold text-muted-foreground" rowspan="2">Status</th>
                            </tr>
                            <tr>
    `;
    
    // Add column headers for previous version
    columns.forEach(col => {
        html += `<th class="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground border-r border-gray-200 dark:border-gray-700">${col.label}</th>`;
    });
    
    // Add column headers for current version
    columns.forEach((col, idx) => {
        const borderClass = idx === columns.length - 1 ? 'border-r border-gray-300 dark:border-gray-600' : 'border-r border-gray-200 dark:border-gray-700';
        html += `<th class="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground ${borderClass}">${col.label}</th>`;
    });
    
    html += `
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    // Render all products
    allProducts.forEach(product => {
        const changedFieldsSet = new Set(product.changes);
        let statusColor = '';
        let statusIcon = '';
        let statusText = '';
        
        if (product.status === 'added') {
            statusColor = 'bg-green-50 dark:bg-green-900/10';
            statusIcon = '<svg class="h-3 w-3 text-green-700 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
            statusText = '<span class="text-green-700 dark:text-green-400 text-xs font-medium">Added</span>';
        } else if (product.status === 'removed') {
            statusColor = 'bg-red-50 dark:bg-red-900/10';
            statusIcon = '<svg class="h-3 w-3 text-red-700 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
            statusText = '<span class="text-red-700 dark:text-red-400 text-xs font-medium">Removed</span>';
        } else if (product.status === 'updated') {
            statusColor = 'bg-yellow-50 dark:bg-yellow-900/10';
            statusIcon = '<svg class="h-3 w-3 text-yellow-700 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>';
            statusText = '<span class="text-yellow-700 dark:text-yellow-400 text-xs font-medium">Updated</span>';
        } else if (product.status === 'unchanged') {
            statusColor = 'bg-blue-50 dark:bg-blue-900/10';
            statusIcon = '<svg class="h-3 w-3 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            statusText = '<span class="text-blue-700 dark:text-blue-400 text-xs font-medium">Unchanged</span>';
        }
        
        html += `<tr class="${statusColor} border-b border-gray-200 dark:border-gray-700">`;
        html += `<td class="px-2 py-2 font-medium border-r border-gray-300 dark:border-gray-600">${formatValue(product.productCode)}</td>`;
        
        // Previous version columns
        columns.forEach(col => {
            const value = product.prev ? product.prev[col.key] : null;
            const isChanged = changedFieldsSet.has(col.key);
            const cellClass = isChanged ? 'bg-yellow-100 dark:bg-yellow-900/30' : '';
            html += `<td class="px-2 py-2 border-r border-gray-200 dark:border-gray-700 ${cellClass}">${formatValue(value)}</td>`;
        });
        
        // Current version columns
        columns.forEach((col, idx) => {
            const value = product.curr ? product.curr[col.key] : null;
            const isChanged = changedFieldsSet.has(col.key);
            const cellClass = isChanged ? 'bg-yellow-100 dark:bg-yellow-900/30' : '';
            const borderClass = idx === columns.length - 1 ? 'border-r border-gray-300 dark:border-gray-600' : 'border-r border-gray-200 dark:border-gray-700';
            html += `<td class="px-2 py-2 ${borderClass} ${cellClass}">${formatValue(value)}</td>`;
        });
        
        // Status column
        html += `<td class="px-2 py-2 text-center"><div class="flex items-center justify-center gap-1">${statusIcon}${statusText}</div></td>`;
        html += `</tr>`;
    });
    
    html += `
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    `;
    
    return html;
}

// Show detailed side-by-side comparison modal
function showDetailedComparisonModal(currentRequestId, previousRequestId) {
    // Find both requests
    const currentRequest = currentAccountHistory.requests.find(r => r.Id === currentRequestId);
    const previousRequest = currentAccountHistory.requests.find(r => r.Id === previousRequestId);
    
    if (!currentRequest || !previousRequest) {
        console.error('Could not find requests for comparison');
        return;
    }
    
    // Store request names for use in table headers
    window._comparisonCurrentName = currentRequest.Name;
    window._comparisonPreviousName = previousRequest.Name;
    
    // Parse both payloads
    const currentPayload = parseRequestPayload(currentRequest);
    const previousPayload = parseRequestPayload(previousRequest);
    
    // Helper function to compare products and detect changes
    const compareProducts = (prevProducts, currProducts, getIdentifier, compareAttributes) => {
        const result = {
            added: [],
            removed: [],
            updated: [],
            unchanged: []
        };
        
        // Create maps for easy lookup
        const prevMap = new Map();
        const currMap = new Map();
        
        prevProducts.forEach(p => {
            const id = getIdentifier(p);
            if (id) prevMap.set(id, p);
        });
        
        currProducts.forEach(p => {
            const id = getIdentifier(p);
            if (id) currMap.set(id, p);
        });
        
        // Check all previous products
        prevMap.forEach((prevProduct, id) => {
            if (currMap.has(id)) {
                // Product exists in both - check if attributes changed
                const currProduct = currMap.get(id);
                const changes = compareAttributes(prevProduct, currProduct);
                
                if (changes.length > 0) {
                    result.updated.push({
                        id,
                        prev: prevProduct,
                        curr: currProduct,
                        changes
                    });
                } else {
                    result.unchanged.push({
                        id,
                        product: prevProduct
                    });
                }
            } else {
                // Product only in previous - removed
                result.removed.push({
                    id,
                    product: prevProduct
                });
            }
        });
        
        // Check for products only in current - added
        currMap.forEach((currProduct, id) => {
            if (!prevMap.has(id)) {
                result.added.push({
                    id,
                    product: currProduct
                });
            }
        });
        
        return result;
    };
    
    // Compare Models
    const modelComparison = compareProducts(
        previousPayload.modelEntitlements || [],
        currentPayload.modelEntitlements || [],
        (m) => m.productCode,
        (prev, curr) => {
            const changes = [];
            const fields = ['startDate', 'endDate', 'productModifier'];
            fields.forEach(field => {
                if (prev[field] !== curr[field]) {
                    changes.push({ field, prev: prev[field], curr: curr[field] });
                }
            });
            return changes;
        }
    );
    
    // Compare Data Entitlements
    const dataComparison = compareProducts(
        previousPayload.dataEntitlements || [],
        currentPayload.dataEntitlements || [],
        (d) => d.productCode || d.name,
        (prev, curr) => {
            const changes = [];
            const fields = ['startDate', 'endDate', 'productModifier'];
            fields.forEach(field => {
                if (prev[field] !== curr[field]) {
                    changes.push({ field, prev: prev[field], curr: curr[field] });
                }
            });
            return changes;
        }
    );
    
    // Compare App Entitlements
    const appComparison = compareProducts(
        previousPayload.appEntitlements || [],
        currentPayload.appEntitlements || [],
        (app) => app.productCode || app.name,
        (prev, curr) => {
            const changes = [];
            const fields = ['packageName', 'quantity', 'startDate', 'endDate', 'productModifier'];
            fields.forEach(field => {
                if (prev[field] !== curr[field]) {
                    changes.push({ field, prev: prev[field], curr: curr[field] });
                }
            });
            return changes;
        }
    );
    
    // Build modal content
    const modalHTML = `
        <div id="comparison-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeComparisonModal(event)">
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col" onclick="event.stopPropagation()">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-6 border-b dark:border-gray-700 flex-shrink-0">
                    <div>
                        <h2 class="text-xl font-semibold">Side-by-Side Product Comparison</h2>
                        <p class="text-sm text-muted-foreground mt-1">
                            ${previousRequest.Name} → ${currentRequest.Name}
                        </p>
                    </div>
                    <button onclick="closeComparisonModal()" class="text-muted-foreground hover:text-foreground">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18"></path>
                            <path d="M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Modal Body - Scrollable -->
                <div class="flex-1 overflow-y-auto p-6" style="overscroll-behavior: contain;">
                    <div class="space-y-6">
                        ${renderEnhancedComparisonTable('Model Entitlements', 'models', modelComparison, previousRequest.Name, currentRequest.Name)}
                        ${renderEnhancedComparisonTable('Data Entitlements', 'data', dataComparison, previousRequest.Name, currentRequest.Name)}
                        ${renderEnhancedComparisonTable('App Entitlements', 'apps', appComparison, previousRequest.Name, currentRequest.Name)}
                    </div>
                </div>
                
                <!-- Modal Footer -->
                <div class="flex justify-between items-center gap-3 p-6 border-t dark:border-gray-700 bg-muted/20 flex-shrink-0">
                    <div class="flex items-center gap-4 text-xs">
                        <span class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700"></span>
                            Added
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700"></span>
                            Removed
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700"></span>
                            Updated
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700"></span>
                            Unchanged
                        </span>
                    </div>
                    <button onclick="closeComparisonModal()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
    
    // Add escape key listener
    document.addEventListener('keydown', handleComparisonModalEscape);
}

// Helper to parse request payload
function parseRequestPayload(request) {
    if (!request.Payload_Data__c) return {};
    
    try {
        const payload = JSON.parse(request.Payload_Data__c);
        const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
        return {
            modelEntitlements: entitlements.modelEntitlements || [],
            dataEntitlements: entitlements.dataEntitlements || [],
            appEntitlements: entitlements.appEntitlements || []
        };
    } catch (e) {
        console.error('Error parsing payload:', e);
        return {};
    }
}

// Render comparison table for a product category
function renderComparisonTable(title, category, allProducts, previousProducts, currentProducts) {
    if (allProducts.length === 0) {
        return `
            <div>
                <h3 class="text-lg font-semibold mb-2">${title}</h3>
                <p class="text-sm text-muted-foreground">No products in this category</p>
            </div>
        `;
    }
    
    let rows = '';
    
    // Special handling for apps (which are objects)
    if (category === 'apps') {
        allProducts.forEach(item => {
            const status = item.status;
            let rowClass = '';
            
            if (status === 'Added') {
                rowClass = 'bg-green-50 dark:bg-green-900/20';
            } else if (status === 'Removed') {
                rowClass = 'bg-red-50 dark:bg-red-900/20';
            } else {
                rowClass = 'bg-blue-50 dark:bg-blue-900/20';
            }
            
            // Escape HTML in display strings
            const prevDisplayEscaped = item.prevDisplay ? item.prevDisplay.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
            const currDisplayEscaped = item.currDisplay ? item.currDisplay.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
            
            rows += `
                <tr class="${rowClass}">
                    <td class="px-4 py-3 text-sm font-mono ${item.prevDisplay ? '' : 'text-muted-foreground text-center'}">
                        ${item.prevDisplay ? prevDisplayEscaped : '—'}
                    </td>
                    <td class="px-4 py-3 text-sm font-mono ${item.currDisplay ? '' : 'text-muted-foreground text-center'}">
                        ${item.currDisplay ? currDisplayEscaped : '—'}
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            status === 'Added' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            status === 'Removed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        });
    } else {
        // Standard handling for models and data (strings)
        allProducts.forEach(product => {
            const inPrevious = previousProducts.includes(product);
            const inCurrent = currentProducts.includes(product);
            
            let status = '';
            let rowClass = '';
            if (!inPrevious && inCurrent) {
                status = 'Added';
                rowClass = 'bg-green-50 dark:bg-green-900/20';
            } else if (inPrevious && !inCurrent) {
                status = 'Removed';
                rowClass = 'bg-red-50 dark:bg-red-900/20';
            } else {
                status = 'Unchanged';
                rowClass = 'bg-gray-50/50 dark:bg-gray-800/50';
            }
            
            // Escape HTML in product string
            const escapedProduct = product.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            
            rows += `
                <tr class="${rowClass}">
                    <td class="px-4 py-3 text-sm font-mono ${inPrevious ? '' : 'text-muted-foreground'}">
                        ${inPrevious ? escapedProduct : '—'}
                    </td>
                    <td class="px-4 py-3 text-sm font-mono ${inCurrent ? '' : 'text-muted-foreground'}">
                        ${inCurrent ? escapedProduct : '—'}
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            status === 'Added' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            status === 'Removed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        });
    }
    
    const columnHeader = category === 'apps' ? 'Product Details' : 'Product Code';
    
    // Calculate counts - for apps, count by status
    let prevCount, currCount;
    if (category === 'apps') {
        prevCount = allProducts.filter(p => p.status === 'Removed' || p.status === 'Unchanged').length;
        currCount = allProducts.filter(p => p.status === 'Added' || p.status === 'Unchanged').length;
    } else {
        prevCount = previousProducts.length;
        currCount = currentProducts.length;
    }
    
    const sectionId = `comparison-${category}`;
    const previousName = window._comparisonPreviousName || 'Previous';
    const currentName = window._comparisonCurrentName || 'Current';
    
    return `
        <div class="border rounded-lg dark:border-gray-700">
            <button 
                onclick="toggleComparisonSection('${sectionId}')"
                class="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
                <h3 class="text-lg font-semibold">${title}</h3>
                <div class="flex items-center gap-3">
                    <span class="text-sm text-muted-foreground">
                        ${previousName}: ${prevCount} | ${currentName}: ${currCount}
                    </span>
                    <svg id="${sectionId}-icon" class="h-5 w-5 transform transition-transform" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </button>
            <div id="${sectionId}" class="hidden border-t dark:border-gray-700">
                <div class="overflow-x-auto max-h-96 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-muted/50 sticky top-0">
                            <tr class="border-b dark:border-gray-700">
                                <th class="px-4 py-3 text-left font-medium">${previousName}<br/><span class="text-xs text-muted-foreground font-normal">(${prevCount} items)</span></th>
                                <th class="px-4 py-3 text-left font-medium">${currentName}<br/><span class="text-xs text-muted-foreground font-normal">(${currCount} items)</span></th>
                                <th class="px-4 py-3 text-center font-medium w-40">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y dark:divide-gray-700">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Toggle comparison section visibility
function toggleComparisonSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (section && icon) {
        const isHidden = section.classList.contains('hidden');
        if (isHidden) {
            section.classList.remove('hidden');
            icon.classList.add('rotate-180');
        } else {
            section.classList.add('hidden');
            icon.classList.remove('rotate-180');
        }
    }
}

// Close comparison modal
function closeComparisonModal(event) {
    if (event && event.target.id !== 'comparison-modal') return;
    
    const modal = document.getElementById('comparison-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleComparisonModalEscape);
    }
}

// Handle escape key for comparison modal
function handleComparisonModalEscape(e) {
    if (e.key === 'Escape') {
        closeComparisonModal();
    }
}

// Toggle request details row
function toggleRequestDetails(requestId) {
    const detailsRow = document.getElementById(`details-row-${requestId}`);
    const expandIcon = document.getElementById(`expand-icon-${requestId}`);
    
    if (!detailsRow) return;
    
    const isHidden = detailsRow.classList.contains('hidden');
    
    if (isHidden) {
        detailsRow.classList.remove('hidden');
        if (expandIcon) {
            expandIcon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        }
    } else {
        detailsRow.classList.add('hidden');
        if (expandIcon) {
            expandIcon.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
        }
    }
}

// Toggle action dropdown for a specific request
function toggleActionDropdown(requestId) {
    const dropdown = document.getElementById(`action-dropdown-${requestId}`);
    if (!dropdown) return;
    
    // Close all other dropdowns first
    document.querySelectorAll('[id^="action-dropdown-"]').forEach(dd => {
        if (dd.id !== `action-dropdown-${requestId}`) {
            dd.classList.add('hidden');
        }
    });
    
    // Toggle this dropdown
    dropdown.classList.toggle('hidden');
}

// Close dropdowns when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('[id^="action-dropdown-"]') && !event.target.closest('button[onclick*="toggleActionDropdown"]')) {
        document.querySelectorAll('[id^="action-dropdown-"]').forEach(dd => {
            dd.classList.add('hidden');
        });
    }
});

// View request in provisioning monitor
function viewRequestInProvisioning(requestId, requestName) {
    console.log('Viewing request in provisioning:', requestName);
    
    // Close the dropdown
    const dropdown = document.getElementById(`action-dropdown-${requestId}`);
    if (dropdown) dropdown.classList.add('hidden');
    
    // View the record with exact matching
    viewPSRecordExact(requestId, requestName);
}

// Clear account history and return to search
function clearAccountHistory() {
    currentAccountHistory = {
        accountName: null,
        requests: [],
        showComparison: false,
        limit: 5,  // Reset to default
        deploymentFilter: '',
        selectedRecords: []
    };
    
    const searchInput = document.getElementById('account-history-search');
    const searchResults = document.getElementById('account-history-search-results');
    const emptyState = document.getElementById('account-history-empty-state');
    const summarySection = document.getElementById('account-summary-section');
    const tableSection = document.getElementById('account-history-table-section');
    const comparisonToggle = document.getElementById('show-comparison-toggle');
    const limitSelector = document.getElementById('account-history-limit');
    const deploymentFilter = document.getElementById('account-history-deployment-filter');
    
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (summarySection) summarySection.classList.add('hidden');
    if (tableSection) tableSection.classList.add('hidden');
    if (comparisonToggle) comparisonToggle.checked = false;
    if (limitSelector) limitSelector.value = '5';  // Reset to default
    if (deploymentFilter) deploymentFilter.value = '';  // Reset deployment filter
}

// HTML escape helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize Account History page when it's shown
const originalShowPage2 = showPage;
if (typeof showPage === 'function') {
    window.showPage = function(pageId) {
        originalShowPage2(pageId);
        if (pageId === 'account-history') {
            setTimeout(initializeAccountHistory, 100);
        }
    };
}

console.log('Account History module loaded');
// ===== ACCOUNT HISTORY NAVIGATION HELPERS =====

// Navigate to Account History page (with optional pre-selected account)
function navigateToAccountHistory(accountName = null) {
    console.log('Navigating to Account History', accountName ? `for account: ${accountName}` : '');
    
    // Show analytics subnav
    const analyticsSubnav = document.getElementById('analytics-subnav');
    if (analyticsSubnav) {
        analyticsSubnav.classList.remove('hidden');
    }
    
    // Navigate to the page
    showPage('account-history');
    
    // If account name is provided, automatically load it
    if (accountName) {
        setTimeout(() => {
            const searchInput = document.getElementById('account-history-search');
            if (searchInput) {
                searchInput.value = accountName;
                // Automatically trigger the search and load
                selectAccount(accountName);
            }
        }, 200);
    }
}

// Navigate to Account History from a specific request (used in Provisioning Monitor)
function viewAccountHistoryForRequest(accountName, requestName = null) {
    console.log(`Navigating to Account History for account: ${accountName}, request: ${requestName || 'N/A'}`);
    
    // Show analytics subnav
    const analyticsSubnav = document.getElementById('analytics-subnav');
    if (analyticsSubnav) {
        analyticsSubnav.classList.remove('hidden');
    }
    
    // Navigate to the page
    showPage('account-history');
    
    // Load the account history
    setTimeout(async () => {
        await loadAccountHistory(accountName);
        
        // If request name is provided, scroll to it
        if (requestName) {
            setTimeout(() => {
                const requestRow = document.querySelector(`[data-request-name="${requestName}"]`);
                if (requestRow) {
                    requestRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    requestRow.classList.add('bg-accent');
                    setTimeout(() => requestRow.classList.remove('bg-accent'), 2000);
                }
            }, 100);
        }
    }, 200);
}

console.log('Account History navigation helpers loaded');

// ==================== CUSTOMER PRODUCTS PAGE ====================

// State management for customer products
let currentCustomerProducts = {
    accountName: null,
    data: null
};

// Initialize Customer Products page
function initializeCustomerProducts() {
    console.log('Initializing Customer Products page...');
    
    const searchInput = document.getElementById('customer-products-search');
    const searchBtn = document.getElementById('customer-products-search-btn');
    const clearBtn = document.getElementById('customer-products-clear');
    const viewHistoryBtn = document.getElementById('customer-products-view-history');
    
    // Search button click
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const accountName = searchInput?.value?.trim();
            if (accountName) {
                loadCustomerProducts(accountName);
            }
        });
    }
    
    // Enter key on search input
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const accountName = searchInput.value.trim();
                if (accountName) {
                    loadCustomerProducts(accountName);
                }
            }
        });
        
        // Simple autocomplete - reuse account search from provisioning
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            if (searchTerm.length < 2) {
                hideCustomerProductsSearchResults();
                return;
            }
            
            searchTimeout = setTimeout(async () => {
                await fetchCustomerProductsSearchSuggestions(searchTerm);
            }, 300);
        });
    }
    
    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearCustomerProducts();
        });
    }
    
    // View Account History button
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            if (currentCustomerProducts.accountName) {
                navigateToAccountHistory(currentCustomerProducts.accountName);
            }
        });
    }
    
    console.log('✅ Customer Products page initialized');
}

// Fetch search suggestions for accounts
async function fetchCustomerProductsSearchSuggestions(searchTerm) {
    try {
        const response = await fetch(`/api/provisioning/search?search=${encodeURIComponent(searchTerm)}&limit=10`);
        const data = await response.json();
        
        if (data.success && data.results) {
            displayCustomerProductsSearchResults(data.results.accounts || []);
        }
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
    }
}

// Display search results dropdown
function displayCustomerProductsSearchResults(accounts) {
    const resultsContainer = document.getElementById('customer-products-search-results');
    
    if (!resultsContainer) return;
    
    if (accounts.length === 0) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    resultsContainer.innerHTML = accounts.map(account => `
        <button 
            class="w-full text-left px-4 py-2 hover:bg-accent border-b last:border-b-0"
            onclick="selectCustomerProductsAccount('${account.name.replace(/'/g, "\\'")}')"
        >
            <div class="font-medium">${escapeHtml(account.name)}</div>
            <div class="text-xs text-muted-foreground">${account.requestCount} request${account.requestCount !== 1 ? 's' : ''}</div>
        </button>
    `).join('');
    
    resultsContainer.classList.remove('hidden');
    
    // Hide dropdown when clicking outside
    const hideHandler = (e) => {
        if (!resultsContainer.contains(e.target) && e.target.id !== 'customer-products-search') {
            hideCustomerProductsSearchResults();
            document.removeEventListener('click', hideHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', hideHandler), 100);
}

// Hide search results dropdown
function hideCustomerProductsSearchResults() {
    const resultsContainer = document.getElementById('customer-products-search-results');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
}

// Select account from search results
function selectCustomerProductsAccount(accountName) {
    const searchInput = document.getElementById('customer-products-search');
    if (searchInput) {
        searchInput.value = accountName;
    }
    hideCustomerProductsSearchResults();
    loadCustomerProducts(accountName);
}

// Load customer products for an account
async function loadCustomerProducts(accountName) {
    try {
        console.log(`Loading customer products for: ${accountName}`);
        
        showCustomerProductsLoading(true);
        hideCustomerProductsSearchResults();
        
        const response = await fetch(`/api/customer-products?account=${encodeURIComponent(accountName)}`);
        const data = await response.json();
        
        showCustomerProductsLoading(false);
        
        if (data.success) {
            currentCustomerProducts = {
                accountName: accountName,
                data: data
            };
            
            renderCustomerProducts(data);
        } else {
            console.error('Error loading customer products:', data.error);
            showCustomerProductsError(data.error);
        }
    } catch (error) {
        console.error('Error loading customer products:', error);
        showCustomerProductsLoading(false);
        showCustomerProductsError('Failed to load customer products');
    }
}

// Show/hide loading state
function showCustomerProductsLoading(isLoading) {
    const loadingSpinner = document.getElementById('customer-products-search-loading');
    const searchBtn = document.getElementById('customer-products-search-btn');
    
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('hidden', !isLoading);
    }
    if (searchBtn) {
        searchBtn.disabled = isLoading;
    }
}

// Render customer products data
function renderCustomerProducts(data) {
    // Hide empty state, show summary and regions
    const emptyState = document.getElementById('customer-products-empty-state');
    const summary = document.getElementById('customer-products-summary');
    const regionsSection = document.getElementById('customer-products-regions');
    
    if (emptyState) emptyState.classList.add('hidden');
    if (summary) summary.classList.remove('hidden');
    if (regionsSection) regionsSection.classList.remove('hidden');
    
    // Update account name
    const accountNameEl = document.getElementById('customer-products-account-name');
    if (accountNameEl) {
        accountNameEl.textContent = data.account;
    }
    
    // Update product count
    const countEl = document.getElementById('customer-products-count');
    if (countEl) {
        const total = data.summary.totalActive || 0;
        countEl.textContent = `${total} active product${total !== 1 ? 's' : ''}`;
    }
    
    // Update last updated
    const lastUpdatedEl = document.getElementById('customer-products-last-updated');
    if (lastUpdatedEl && data.lastUpdated) {
        const date = new Date(data.lastUpdated.date);
        lastUpdatedEl.textContent = `${data.lastUpdated.psRecordId} on ${date.toLocaleDateString()}`;
    }
    
    // Update category counts
    document.getElementById('customer-products-models-count').textContent = data.summary.byCategory.models || 0;
    document.getElementById('customer-products-data-count').textContent = data.summary.byCategory.data || 0;
    document.getElementById('customer-products-apps-count').textContent = data.summary.byCategory.apps || 0;
    
    // Render regions
    renderCustomerProductsRegions(data.productsByRegion);
}

// Render products by region
function renderCustomerProductsRegions(productsByRegion) {
    const regionsSection = document.getElementById('customer-products-regions');
    if (!regionsSection) return;
    
    const regions = Object.keys(productsByRegion).sort();
    
    if (regions.length === 0) {
        regionsSection.innerHTML = `
            <div class="rounded-lg border bg-card p-8 text-center">
                <p class="text-muted-foreground">No active products found for this account</p>
            </div>
        `;
        return;
    }
    
    regionsSection.innerHTML = regions.map((region, index) => {
        const products = productsByRegion[region];
        const totalProducts = (products.models?.length || 0) + (products.data?.length || 0) + (products.apps?.length || 0);
        const regionId = `region-${index}`;
        
        return `
            <div class="mb-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <button 
                    class="w-full p-6 border-b bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    onclick="toggleRegionSection('${regionId}')"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <svg class="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                                <path d="M2 12h20"></path>
                            </svg>
                            <h2 class="text-xl font-semibold">${escapeHtml(region)}</h2>
                            <span class="text-sm text-muted-foreground">${totalProducts} product${totalProducts !== 1 ? 's' : ''}</span>
                        </div>
                        <svg class="h-6 w-6 text-muted-foreground transition-transform" id="${regionId}-chevron" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </button>
                <div id="${regionId}" class="p-6 space-y-6">
                    ${renderCategorySection('Models', products.models || [], 'blue')}
                    ${renderCategorySection('Data', products.data || [], 'green')}
                    ${renderCategorySection('Apps', products.apps || [], 'purple')}
                </div>
            </div>
        `;
    }).join('');
}

// Render category section (Models, Data, Apps)
function renderCategorySection(categoryName, products, color) {
    if (products.length === 0) return '';
    
    const categoryId = `category-${categoryName.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return `
        <div class="category-section">
            <button 
                class="flex w-full items-center justify-between p-3 rounded-lg bg-${color}-50 border border-${color}-200 hover:bg-${color}-100 transition-colors"
                onclick="toggleCustomerProductsCategory('${categoryId}')"
            >
                <div class="flex items-center gap-2">
                    <svg class="h-4 w-4 text-${color}-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" x2="12" y1="22.08" y2="12"></line>
                    </svg>
                    <span class="font-semibold text-${color}-900">${categoryName}</span>
                    <span class="text-sm text-${color}-700">(${products.length})</span>
                </div>
                <svg class="h-5 w-5 text-${color}-700 transition-transform" id="${categoryId}-chevron" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div id="${categoryId}" class="mt-3 space-y-2">
                ${products.map(product => renderProductCard(product, color)).join('')}
            </div>
        </div>
    `;
}

// Render individual product card
function renderProductCard(product, color) {
    const statusIcon = getStatusIcon(product.status);
    const statusColor = getStatusColor(product.status);
    
    return `
        <div class="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        ${statusIcon}
                        <h4 class="font-semibold">${escapeHtml(product.productName)}</h4>
                    </div>
                    <p class="text-sm text-muted-foreground">
                        Product Code: <span class="font-mono">${escapeHtml(product.productCode)}</span>
                    </p>
                    ${product.packageName ? `
                        <p class="text-sm text-muted-foreground">
                            Package: <span class="font-mono">${escapeHtml(product.packageName)}</span>
                        </p>
                    ` : ''}
                    <p class="text-sm text-muted-foreground mt-2">
                        Active: ${product.startDate} → ${product.endDate}
                    </p>
                    <p class="text-sm">
                        <span class="font-medium ${statusColor}">${product.status === 'active' ? '🟢 Active' : product.status === 'expiring-soon' ? '🟡 Expiring Soon' : '🟠 Expiring'}</span>
                        <span class="text-muted-foreground"> (${product.daysRemaining} days remaining)</span>
                    </p>
                    <div class="mt-2">
                        <p class="text-xs text-muted-foreground">Source PS Records:</p>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${product.sourcePSRecords.map(psId => `
                                <button 
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
                                    onclick="navigateToProvisioningWithExactMatch('${psId}')"
                                >
                                    ${psId}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get status icon
function getStatusIcon(status) {
    switch (status) {
        case 'active':
            return '<svg class="h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        case 'expiring-soon':
            return '<svg class="h-4 w-4 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
        case 'expiring':
            return '<svg class="h-4 w-4 text-orange-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        default:
            return '';
    }
}

// Get status color class
function getStatusColor(status) {
    switch (status) {
        case 'active':
            return 'text-green-700';
        case 'expiring-soon':
            return 'text-yellow-700';
        case 'expiring':
            return 'text-orange-700';
        default:
            return 'text-muted-foreground';
    }
}

// Toggle category section
function toggleCustomerProductsCategory(categoryId) {
    const section = document.getElementById(categoryId);
    const chevron = document.getElementById(`${categoryId}-chevron`);
    
    if (section && chevron) {
        section.classList.toggle('hidden');
        chevron.classList.toggle('rotate-180');
    }
}

// Toggle region section
function toggleRegionSection(regionId) {
    const section = document.getElementById(regionId);
    const chevron = document.getElementById(`${regionId}-chevron`);
    
    if (section && chevron) {
        section.classList.toggle('hidden');
        chevron.classList.toggle('rotate-180');
    }
}

// Navigate to Provisioning Monitor with exact match
function navigateToProvisioningWithExactMatch(psId) {
    exactMatchFilter = psId;
    showPage('provisioning');
    
    // Set search input
    const searchInput = document.getElementById('provisioning-search');
    if (searchInput) {
        searchInput.value = psId;
    }
    
    // Refresh provisioning data
    setTimeout(() => {
        refreshProvisioningMonitor();
    }, 100);
}

// Clear customer products view
function clearCustomerProducts() {
    currentCustomerProducts = {
        accountName: null,
        data: null
    };
    
    // Clear search input
    const searchInput = document.getElementById('customer-products-search');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Hide summary and regions, show empty state
    const emptyState = document.getElementById('customer-products-empty-state');
    const summary = document.getElementById('customer-products-summary');
    const regionsSection = document.getElementById('customer-products-regions');
    
    if (emptyState) emptyState.classList.remove('hidden');
    if (summary) summary.classList.add('hidden');
    if (regionsSection) {
        regionsSection.classList.add('hidden');
        regionsSection.innerHTML = '';
    }
}

// Show error message
function showCustomerProductsError(message) {
    const regionsSection = document.getElementById('customer-products-regions');
    if (regionsSection) {
        regionsSection.innerHTML = `
            <div class="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                <p class="text-red-900 font-semibold">Error Loading Customer Products</p>
                <p class="text-red-700 text-sm mt-2">${escapeHtml(message)}</p>
            </div>
        `;
        regionsSection.classList.remove('hidden');
    }
}

console.log('Customer Products page functions loaded');

// ===== EXPIRATION MONITOR FUNCTIONS =====

// Expiration Monitor state
let expirationData = [];
let expirationWindow = 30;
let showExtended = true;

// Initialize Expiration Monitor page
async function initializeExpiration() {
    console.log('[Expiration] ========================================');
    console.log('[Expiration] initializeExpiration() called');
    console.log('[Expiration] ========================================');
    
    try {
        // Set up event listeners
        console.log('[Expiration] Setting up event listeners...');
        setupExpirationEventListeners();
        
        // Load expiration status
        console.log('[Expiration] Loading status...');
        await loadExpirationStatus();
        
        // Load expiration data
        console.log('[Expiration] Loading data...');
        await loadExpirationData();
        
        console.log('[Expiration] Initialization complete');
    } catch (error) {
        console.error('[Expiration] Error during initialization:', error);
    }
}

// Set up event listeners for expiration monitor
function setupExpirationEventListeners() {
    const refreshBtn = document.getElementById('refresh-expiration-btn');
    const refreshEmptyBtn = document.getElementById('refresh-empty-btn');
    const windowSelect = document.getElementById('expiration-page-window-select'); // Page-specific dropdown
    const extendedCheckbox = document.getElementById('show-extended-checkbox');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshExpirationAnalysis);
    }
    
    if (refreshEmptyBtn) {
        refreshEmptyBtn.addEventListener('click', refreshExpirationAnalysis);
    }
    
    if (windowSelect) {
        console.log('[Expiration] Window select element found, attaching listener');
        windowSelect.addEventListener('change', async (e) => {
            expirationWindow = parseInt(e.target.value);
            console.log('[Expiration] Window changed to:', expirationWindow, 'days - triggering auto-refresh');
            
            // Auto-refresh the analysis with new window
            await autoRefreshExpirationData();
        });
    } else {
        console.warn('[Expiration] Window select element NOT found - event listener not attached');
    }
    
    if (extendedCheckbox) {
        extendedCheckbox.addEventListener('change', (e) => {
            showExtended = e.target.checked;
            renderExpirationTable();
        });
    }
}

// Load expiration analysis status
async function loadExpirationStatus() {
    try {
        const response = await fetch('/api/expiration/status');
        const data = await response.json();
        
        const lastAnalyzedEl = document.getElementById('expiration-last-analyzed');
        if (lastAnalyzedEl) {
            if (data.hasAnalysis) {
                lastAnalyzedEl.textContent = `Last analyzed: ${data.analysis.lastRunAgo}`;
            } else {
                lastAnalyzedEl.textContent = 'Last analyzed: Never';
            }
        }
    } catch (error) {
        console.error('Error loading expiration status:', error);
    }
}

// Load expiration data from API
async function loadExpirationData() {
    console.log('[Expiration] loadExpirationData() called');
    
    // Update timestamp when starting to load
    updateLastRefreshTimestamp('expiration');
    
    try {
        const statusEl = document.getElementById('expiration-page-status');
        console.log('[Expiration] Status element found:', !!statusEl);
        if (statusEl) statusEl.textContent = 'Loading...';
        
        const params = new URLSearchParams({
            expirationWindow: expirationWindow,
            showExtended: showExtended
        });
        
        console.log('[Expiration] Fetching data with params:', params.toString());
        const response = await fetch(`/api/expiration/monitor?${params}`);
        console.log('[Expiration] Response received:', response.status);
        
        const data = await response.json();
        console.log('[Expiration] Data parsed:', { success: data.success, count: data.expirations?.length, summary: data.summary });
        
        if (data.success) {
            expirationData = data.expirations || [];
            console.log('[Expiration] Updating summary...');
            updateExpirationSummary(data.summary);
            
            console.log('[Expiration] Rendering table with', expirationData.length, 'items...');
            console.log('[Expiration] Sample item:', expirationData[0]);
            renderExpirationTable();
            
            if (statusEl) {
                statusEl.textContent = `Showing ${expirationData.length} account${expirationData.length !== 1 ? 's' : ''}`;
            }
            console.log('[Expiration] Load complete');
        } else {
            console.error('[Expiration] API returned error:', data.error);
            if (statusEl) statusEl.textContent = 'Error loading data';
        }
    } catch (error) {
        console.error('[Expiration] Exception in loadExpirationData:', error);
        console.error('[Expiration] Stack:', error.stack);
        const statusEl = document.getElementById('expiration-page-status');
        if (statusEl) statusEl.textContent = 'Error: ' + error.message;
    }
}

// Update summary cards
function updateExpirationSummary(summary) {
    document.getElementById('expiration-total').textContent = summary.totalExpiring || 0;
    document.getElementById('expiration-at-risk').textContent = summary.atRisk || 0;
    document.getElementById('expiration-extended').textContent = summary.extended || 0;
    document.getElementById('expiration-accounts').textContent = summary.accountsAffected || 0;
}

// View PS record from expiration monitor in provisioning monitor
function viewExpirationInProvisioning(recordId, recordName) {
    console.log('Viewing PS record from expiration monitor:', recordName);
    
    // View the record with exact matching
    viewPSRecordExact(recordId, recordName);
}

// Render expiration table
function renderExpirationTable() {
    const tbody = document.getElementById('expiration-table-body');
    const emptyState = document.getElementById('expiration-empty-state');
    const tableSection = document.querySelector('#expiration-table-section > div:nth-child(2)');
    
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (expirationData.length === 0) {
        // Show empty state
        if (tableSection) tableSection.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    // Hide empty state, show table
    if (tableSection) tableSection.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Render rows
    expirationData.forEach((item, index) => {
        // Debug logging for first few items to verify status
        if (index < 3) {
            console.log(`[ExpirationTable] Item ${index} status:`, item.status, 'PS Record:', item.psRecord.name);
        }
        
        const row = document.createElement('tr');
        row.className = 'border-b transition-colors hover:bg-muted/50';
        
        // Account
        const accountCell = document.createElement('td');
        accountCell.className = 'p-4 align-middle';
        accountCell.textContent = item.account.name || item.account.id;
        row.appendChild(accountCell);
        
        // PS Record
        const psRecordCell = document.createElement('td');
        psRecordCell.className = 'p-4 align-middle';
        psRecordCell.innerHTML = `<span class="font-mono text-sm">${item.psRecord.name}</span>`;
        row.appendChild(psRecordCell);
        
        // Expiring Products
        const productsCell = document.createElement('td');
        productsCell.className = 'p-4 align-middle';
        productsCell.innerHTML = getExpiringProductsBadges(item);
        row.appendChild(productsCell);
        
        // Status
        const statusCell = document.createElement('td');
        statusCell.className = 'p-4 align-middle';
        if (item.status === 'at-risk') {
            statusCell.innerHTML = `
                <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-2 ring-red-600">
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                    </svg>
                    At-Risk
                </span>
            `;
        } else {
            statusCell.innerHTML = `
                <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-2 ring-green-600">
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Extended
                </span>
            `;
        }
        row.appendChild(statusCell);
        
        // Earliest Expiry
        const expiryCell = document.createElement('td');
        expiryCell.className = 'p-4 align-middle';
        const expiryDate = new Date(item.earliestExpiry);
        const daysUntil = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        expiryCell.innerHTML = `
            <div class="text-sm">${expiryDate.toLocaleDateString()}</div>
            <div class="text-xs text-muted-foreground">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</div>
        `;
        row.appendChild(expiryCell);
        
        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.className = 'p-4 align-middle';
        
        // Container for action buttons
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-2';
        
        // View Details button
        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3';
        detailsBtn.textContent = 'View Details';
        detailsBtn.onclick = () => showExpirationDetails(item);
        actionsContainer.appendChild(detailsBtn);
        
        // Open in Monitor button
        const monitorBtn = document.createElement('button');
        monitorBtn.className = 'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3';
        monitorBtn.title = 'View in Provisioning Monitor';
        monitorBtn.innerHTML = `
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Monitor</span>
        `;
        monitorBtn.onclick = () => viewExpirationInProvisioning(item.psRecord.id, item.psRecord.name);
        actionsContainer.appendChild(monitorBtn);
        
        actionsCell.appendChild(actionsContainer);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
}

// Get expiring products badges with red contour for at-risk categories
function getExpiringProductsBadges(item) {
    const badges = [];
    const products = item.expiringProducts;
    
    // Models badge (blue when extended, red when at-risk)
    if (products.models && products.models.length > 0) {
        const hasAtRisk = products.models.some(p => !p.isExtended);
        const badgeClass = hasAtRisk 
            ? 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 ring-2 ring-red-600' 
            : 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-600/20';
        badges.push(`<span class="${badgeClass}">Models (${products.models.length})</span>`);
    }
    
    // Data badge (green when extended, red when at-risk)
    if (products.data && products.data.length > 0) {
        const hasAtRisk = products.data.some(p => !p.isExtended);
        const badgeClass = hasAtRisk 
            ? 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 ring-2 ring-red-600' 
            : 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-50 text-green-700 ring-1 ring-green-600/20';
        badges.push(`<span class="${badgeClass}">Data (${products.data.length})</span>`);
    }
    
    // Apps badge (purple when extended, red when at-risk)
    if (products.apps && products.apps.length > 0) {
        const hasAtRisk = products.apps.some(p => !p.isExtended);
        const badgeClass = hasAtRisk 
            ? 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 ring-2 ring-red-600' 
            : 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 ring-1 ring-purple-600/20';
        badges.push(`<span class="${badgeClass}">Apps (${products.apps.length})</span>`);
    }
    
    return `<div class="flex flex-wrap gap-1">${badges.join(' ')}</div>`;
}

// Show expiration details modal
function showExpirationDetails(item) {
    if (!item) {
        console.error('No item provided to showExpirationDetails');
        return;
    }
    
    // Debug logging
    console.log('[ExpirationDetails] Item received:', item);
    console.log('[ExpirationDetails] Expiring products:', item.expiringProducts);
    
    const products = item.expiringProducts;
    const accountName = item.account.name;
    const psRecordName = item.psRecord.name;
    
    let modalContent = `
        <div class="space-y-4">
            <div>
                <h3 class="text-lg font-semibold">Account: ${accountName}</h3>
                <p class="text-sm text-muted-foreground">PS Record: ${psRecordName}</p>
            </div>
    `;
    
    let hasProducts = false;
    
    // Models
    if (products.models && products.models.length > 0) {
        hasProducts = true;
        const hasAtRisk = products.models.some(p => !p.isExtended);
        const headerClass = hasAtRisk 
            ? 'text-lg font-semibold text-red-600 border-l-4 border-red-600 pl-3' 
            : 'text-lg font-semibold text-blue-700 border-l-4 border-blue-600 pl-3';
        const icon = hasAtRisk ? '🔴' : '🔵';
        modalContent += `
            <div>
                <h4 class="${headerClass} mb-2">${icon} Models (${products.models.length} expiring)</h4>
                <div class="space-y-2">
                    ${products.models.map(p => renderExpiringProduct(p)).join('')}
                </div>
            </div>
        `;
    }
    
    // Data
    if (products.data && products.data.length > 0) {
        hasProducts = true;
        const hasAtRisk = products.data.some(p => !p.isExtended);
        const headerClass = hasAtRisk 
            ? 'text-lg font-semibold text-red-600 border-l-4 border-red-600 pl-3' 
            : 'text-lg font-semibold text-green-700 border-l-4 border-green-600 pl-3';
        const icon = hasAtRisk ? '🔴' : '🟢';
        modalContent += `
            <div>
                <h4 class="${headerClass} mb-2">${icon} Data (${products.data.length} expiring)</h4>
                <div class="space-y-2">
                    ${products.data.map(p => renderExpiringProduct(p)).join('')}
                </div>
            </div>
        `;
    }
    
    // Apps
    if (products.apps && products.apps.length > 0) {
        hasProducts = true;
        const hasAtRisk = products.apps.some(p => !p.isExtended);
        const headerClass = hasAtRisk 
            ? 'text-lg font-semibold text-red-600 border-l-4 border-red-600 pl-3' 
            : 'text-lg font-semibold text-purple-700 border-l-4 border-purple-600 pl-3';
        const icon = hasAtRisk ? '🔴' : '🟣';
        modalContent += `
            <div>
                <h4 class="${headerClass} mb-2">${icon} Apps (${products.apps.length} expiring)</h4>
                <div class="space-y-2">
                    ${products.apps.map(p => renderExpiringProduct(p)).join('')}
                </div>
            </div>
        `;
    }
    
    // Show message if no products found
    if (!hasProducts) {
        modalContent += `
            <div class="text-center py-8 text-muted-foreground">
                <p>No expiring products found.</p>
                <p class="text-sm mt-2">This may indicate a data structure issue.</p>
            </div>
        `;
        console.warn('[ExpirationDetails] No products found in categories. Products object:', products);
    }
    
    modalContent += '</div>';
    
    showModal(`Expiring Products - ${psRecordName}`, modalContent);
}

// Render individual expiring product
function renderExpiringProduct(product) {
    const bgClass = product.isExtended ? 'bg-green-50' : 'bg-red-50';
    const textClass = product.isExtended ? 'text-green-700' : 'text-red-700';
    const icon = product.isExtended ? '🟢' : '🔴';
    
    let html = `
        <div class="${bgClass} rounded-lg p-3">
            <div class="flex items-start justify-between">
                <div>
                    <p class="font-semibold ${textClass}">${icon} ${product.productName || product.productCode}</p>
                    <p class="text-sm text-muted-foreground">Code: ${product.productCode}</p>
                    <p class="text-sm">End Date: ${new Date(product.endDate).toLocaleDateString()} (${product.daysUntilExpiry} day${product.daysUntilExpiry !== 1 ? 's' : ''})</p>
                </div>
    `;
    
    if (product.isExtended) {
        html += `
                <span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    ✓ Extended
                </span>
        `;
    } else {
        html += `
                <span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                    ⚠️ At-Risk
                </span>
        `;
    }
    
    html += '</div>';
    
    if (product.isExtended && product.extendingPsRecordName) {
        html += `
            <div class="mt-2 pt-2 border-t border-green-200">
                <p class="text-sm text-green-700">
                    ✓ Extended by <span class="font-mono">${product.extendingPsRecordName}</span> until ${new Date(product.extendingEndDate).toLocaleDateString()}
                </p>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Refresh expiration analysis
// Auto-refresh expiration data (silent, no alert)
async function autoRefreshExpirationData() {
    const statusEl = document.getElementById('expiration-page-status');
    
    try {
        if (statusEl) statusEl.textContent = 'Analyzing...';
        
        console.log('[Expiration] Auto-refreshing analysis for', expirationWindow, 'day window');
        
        const response = await fetch('/api/expiration/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lookbackYears: 5,
                expirationWindow: expirationWindow
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[Expiration] ✅ Auto-refresh complete:', data.summary.expirationsFound, 'expirations found');
            
            // Reload data and status (no alert)
            await loadExpirationStatus();
            await loadExpirationData();
        } else {
            console.error('[Expiration] ❌ Auto-refresh failed:', data.error);
            if (statusEl) statusEl.textContent = `Error: ${data.error}`;
        }
    } catch (error) {
        console.error('[Expiration] Error during auto-refresh:', error);
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
    }
}

// Manual refresh expiration analysis (with alert)
async function refreshExpirationAnalysis() {
    const refreshBtn = document.getElementById('refresh-expiration-btn');
    const refreshEmptyBtn = document.getElementById('refresh-empty-btn');
    const statusEl = document.getElementById('expiration-page-status');
    
    const originalBtnText = refreshBtn ? refreshBtn.innerHTML : '';
    const originalEmptyBtnText = refreshEmptyBtn ? refreshEmptyBtn.innerHTML : '';
    
    try {
        // Update button states
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="h-4 w-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
                Analyzing...
            `;
        }
        
        if (refreshEmptyBtn) {
            refreshEmptyBtn.disabled = true;
            refreshEmptyBtn.textContent = 'Analyzing...';
        }
        
        if (statusEl) statusEl.textContent = 'Running analysis...';
        
        const response = await fetch('/api/expiration/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lookbackYears: 5,
                expirationWindow: expirationWindow
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Analysis complete:', data.summary.expirationsFound, 'expirations found');
            alert(`Analysis complete!\n\n${data.summary.expirationsFound} expirations found\n${data.summary.extensionsFound} extensions detected\n${data.summary.recordsAnalyzed} records analyzed`);
            
            // Reload data and status
            await loadExpirationStatus();
            await loadExpirationData();
        } else {
            console.error('❌ Analysis failed:', data.error);
            alert(`Analysis failed: ${data.error}`);
        }
    } catch (error) {
        console.error('Error refreshing expiration analysis:', error);
        alert('Failed to refresh expiration analysis. Check console for details.');
    } finally {
        // Restore button states
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnText;
        }
        
        if (refreshEmptyBtn) {
            refreshEmptyBtn.disabled = false;
            refreshEmptyBtn.textContent = originalEmptyBtnText;
        }
    }
}

console.log('Expiration Monitor module loaded');

// ===== GHOST ACCOUNTS MODULE =====

let ghostAccountsData = [];
let filteredGhostAccountsData = [];
let deprovisionedAccountsData = [];
let currentGhostView = 'ghost'; // 'ghost' or 'deprovisioned'

// Load ghost accounts data
async function loadGhostAccountsData() {
    console.log('[GhostAccounts] Loading ghost accounts data...');
    
    const tableBody = document.getElementById('ghost-accounts-table-body');
    const emptyState = document.getElementById('ghost-accounts-empty-state');
    const statusEl = document.getElementById('ghost-accounts-page-status');
    const tableSection = document.querySelector('#ghost-accounts-table-section .rounded-lg');
    
    if (!tableBody) return;
    
    // Show loading state
    if (statusEl) statusEl.textContent = 'Loading...';
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="p-8 text-center">
                <div class="loading-spinner mx-auto mb-2"></div>
                <div class="text-sm text-muted-foreground">Loading ghost accounts...</div>
            </td>
        </tr>
    `;
    
    try {
        // Get filter values
        const accountSearch = document.getElementById('ghost-account-search')?.value || '';
        const reviewStatus = document.getElementById('ghost-review-status-filter')?.value || 'unreviewed';
        
        // Build query params
        const params = new URLSearchParams();
        if (accountSearch) params.append('accountSearch', accountSearch);
        if (reviewStatus !== 'all') params.append('isReviewed', reviewStatus === 'reviewed');
        
        const response = await fetch(`/api/ghost-accounts?${params}`);
        const data = await response.json();
        
        if (data.success) {
            ghostAccountsData = data.ghostAccounts || [];
            filteredGhostAccountsData = ghostAccountsData;
            
            console.log('[GhostAccounts] Loaded', ghostAccountsData.length, 'ghost accounts');
            
            // Update summary cards
            updateGhostAccountsSummary(data.summary);
            
            // Update last refresh time
            const lastRefreshEl = document.getElementById('ghost-accounts-last-refresh');
            if (lastRefreshEl) {
                lastRefreshEl.textContent = new Date().toLocaleTimeString();
            }
            
            // Render table or show empty state
            if (ghostAccountsData.length === 0) {
                if (tableSection) tableSection.classList.add('hidden');
                if (emptyState) emptyState.classList.remove('hidden');
                if (statusEl) statusEl.textContent = 'No ghost accounts found';
            } else {
                if (tableSection) tableSection.classList.remove('hidden');
                if (emptyState) emptyState.classList.add('hidden');
                renderGhostAccountsTable();
                if (statusEl) statusEl.textContent = `Showing ${ghostAccountsData.length} account(s)`;
            }
        } else {
            console.error('[GhostAccounts] Error loading data:', data.error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-red-600">
                        Error loading ghost accounts: ${data.error || 'Unknown error'}
                    </td>
                </tr>
            `;
            if (statusEl) statusEl.textContent = 'Error loading data';
        }
    } catch (error) {
        console.error('[GhostAccounts] Error:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-red-600">
                    Failed to load ghost accounts. Check console for details.
                </td>
            </tr>
        `;
        if (statusEl) statusEl.textContent = 'Error';
    }
}

// Update summary cards
function updateGhostAccountsSummary(summary) {
    const totalEl = document.getElementById('ghost-total');
    const unreviewedEl = document.getElementById('ghost-unreviewed');
    const reviewedEl = document.getElementById('ghost-reviewed');
    
    if (totalEl) totalEl.textContent = summary.total_ghost_accounts || 0;
    if (unreviewedEl) unreviewedEl.textContent = summary.unreviewed || 0;
    if (reviewedEl) reviewedEl.textContent = summary.reviewed || 0;
}

// Render ghost accounts table
function renderGhostAccountsTable() {
    console.log('[GhostAccounts] Rendering table with', filteredGhostAccountsData.length, 'accounts');
    
    const tableBody = document.getElementById('ghost-accounts-table-body');
    if (!tableBody) return;
    
    if (filteredGhostAccountsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-muted-foreground">
                    No ghost accounts match the current filters.
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = filteredGhostAccountsData.map(account => {
        const expiryDate = new Date(account.latest_expiry_date);
        const daysSinceExpiry = Math.floor((new Date() - expiryDate) / (1000 * 60 * 60 * 24));
        
        return `
            <tr class="border-b hover:bg-accent/50 transition-colors">
                <td class="p-4">
                    <div class="font-medium">${escapeHtml(account.account_name)}</div>
                    <div class="text-xs text-muted-foreground">${daysSinceExpiry} days since latest expiry</div>
                </td>
                <td class="p-4 text-center">
                    <span class="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                        ${account.total_expired_products} products
                    </span>
                </td>
                <td class="p-4">
                    <div class="text-sm">${expiryDate.toLocaleDateString()}</div>
                    <div class="text-xs text-muted-foreground">${daysSinceExpiry} days ago</div>
                </td>
                <td class="p-4">
                    ${account.is_reviewed ? `
                        <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                            <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 12l2 2 4-4"></path>
                                <circle cx="12" cy="12" r="10"></circle>
                            </svg>
                            Reviewed
                        </span>
                        ${account.reviewed_at ? `<div class="text-xs text-muted-foreground mt-1">${new Date(account.reviewed_at).toLocaleDateString()}</div>` : ''}
                    ` : `
                        <span class="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                            <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                <path d="M12 9v4"></path>
                                <path d="M12 17h.01"></path>
                            </svg>
                            Needs Review
                        </span>
                    `}
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        ${!account.is_reviewed ? `
                            <button 
                                onclick="showReviewGhostAccountDialog('${account.account_id}', '${escapeHtml(account.account_name).replace(/'/g, "\\'")}')"
                                class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                title="Mark as Reviewed"
                            >
                                <svg class="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 12l2 2 4-4"></path>
                                    <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                                Review
                            </button>
                        ` : ''}
                        <button 
                            onclick="viewGhostAccountDetails('${account.account_id}', '${escapeHtml(account.account_name).replace(/'/g, "\\'")}')"
                            class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            title="View Details"
                        >
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Show review dialog
function showReviewGhostAccountDialog(accountId, accountName) {
    const dialogHTML = `
        <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
                Mark this ghost account as reviewed? This indicates that you have investigated this account and taken appropriate action.
            </p>
            <div>
                <label class="text-sm font-medium mb-2 block">Reviewer Name:</label>
                <input 
                    type="text" 
                    id="reviewer-name-input" 
                    placeholder="Your name or email"
                    class="w-full h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
            </div>
            <div>
                <label class="text-sm font-medium mb-2 block">Notes (optional):</label>
                <textarea 
                    id="review-notes-input" 
                    placeholder="Add any notes about this account..."
                    rows="3"
                    class="w-full px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                ></textarea>
            </div>
            <div class="flex justify-end gap-2 pt-4">
                <button 
                    onclick="closeModal()"
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                    Cancel
                </button>
                <button 
                    onclick="submitGhostAccountReview('${accountId}')"
                    class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    Mark as Reviewed
                </button>
            </div>
        </div>
    `;
    
    showModal(`Review Ghost Account: ${accountName}`, dialogHTML);
}

// Submit ghost account review
async function submitGhostAccountReview(accountId) {
    const reviewerNameInput = document.getElementById('reviewer-name-input');
    const notesInput = document.getElementById('review-notes-input');
    
    if (!reviewerNameInput || !reviewerNameInput.value.trim()) {
        alert('Please enter your name or email');
        return;
    }
    
    try {
        const response = await fetch(`/api/ghost-accounts/${accountId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reviewedBy: reviewerNameInput.value.trim(),
                notes: notesInput.value.trim() || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[GhostAccounts] Account marked as reviewed');
            closeModal();
            await loadGhostAccountsData(); // Reload data
        } else {
            alert(`Failed to mark as reviewed: ${data.error}`);
        }
    } catch (error) {
        console.error('[GhostAccounts] Error marking as reviewed:', error);
        alert('Failed to mark account as reviewed. Check console for details.');
    }
}

// View ghost account details (navigate to account history page)
function viewGhostAccountDetails(accountId, accountName) {
    console.log('[GhostAccounts] Viewing details for:', accountName);
    
    // Navigate to Account History page
    showPage('account-history');
    
    // Set the search input value
    const accountInput = document.getElementById('account-search-input');
    if (accountInput) {
        accountInput.value = accountName;
    }
    
    // Load the account history directly
    setTimeout(() => {
        if (typeof loadAccountHistory === 'function') {
            loadAccountHistory(accountName);
        }
    }, 100);
}

// Export ghost accounts to Excel with formatting
function exportGhostAccountsToExcel() {
    console.log('[GhostAccounts] Exporting to Excel...');
    
    if (ghostAccountsData.length === 0) {
        alert('No ghost accounts data to export. Please load the data first.');
        return;
    }
    
    try {
        // Prepare data for export
        const exportData = ghostAccountsData.map((account, index) => {
            const expiryDate = new Date(account.latest_expiry_date);
            const daysSinceExpiry = Math.floor((new Date() - expiryDate) / (1000 * 60 * 60 * 24));
            
            return {
                'No.': index + 1,
                'Account Name': account.account_name || '',
                'Account ID': account.account_id || '',
                'Expired Products': account.total_expired_products || 0,
                'Latest Expiry Date': expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                'Days Since Expiry': daysSinceExpiry,
                'Review Status': account.is_reviewed ? 'Reviewed' : 'Needs Review',
                'Reviewed By': account.reviewed_by || '',
                'Reviewed At': account.reviewed_at ? new Date(account.reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
                'Notes': account.notes || '',
                'Created At': account.created_at ? new Date(account.created_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
                'Updated At': account.updated_at ? new Date(account.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''
            };
        });
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths
        const colWidths = [
            { wch: 5 },   // No.
            { wch: 40 },  // Account Name
            { wch: 20 },  // Account ID
            { wch: 16 },  // Expired Products
            { wch: 18 },  // Latest Expiry Date
            { wch: 18 },  // Days Since Expiry
            { wch: 15 },  // Review Status
            { wch: 20 },  // Reviewed By
            { wch: 15 },  // Reviewed At
            { wch: 50 },  // Notes
            { wch: 15 },  // Created At
            { wch: 15 }   // Updated At
        ];
        ws['!cols'] = colWidths;
        
        // Style the header row
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellAddress]) continue;
            
            ws[cellAddress].s = {
                font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4472C4" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            };
        }
        
        // Apply alternating row colors and borders to data rows
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const isEvenRow = (row % 2 === 0);
            
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
                
                ws[cellAddress].s = {
                    fill: { fgColor: { rgb: isEvenRow ? "F2F2F2" : "FFFFFF" } },
                    alignment: { 
                        horizontal: col === 1 || col === 9 ? "left" : "center",
                        vertical: "center",
                        wrapText: col === 9 // Wrap text for Notes column
                    },
                    border: {
                        top: { style: "thin", color: { rgb: "D0D0D0" } },
                        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
                        left: { style: "thin", color: { rgb: "D0D0D0" } },
                        right: { style: "thin", color: { rgb: "D0D0D0" } }
                    }
                };
                
                // Highlight unreviewed accounts in orange
                if (col === 6 && ws[cellAddress].v === 'Needs Review') {
                    ws[cellAddress].s.fill = { fgColor: { rgb: "FFF4E6" } };
                    ws[cellAddress].s.font = { color: { rgb: "F97316" }, bold: true };
                }
                
                // Highlight reviewed accounts in green
                if (col === 6 && ws[cellAddress].v === 'Reviewed') {
                    ws[cellAddress].s.fill = { fgColor: { rgb: "ECFDF5" } };
                    ws[cellAddress].s.font = { color: { rgb: "22C55E" }, bold: true };
                }
            }
        }
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Ghost Accounts');
        
        // Create summary sheet
        const summary = [
            { 'Metric': 'Report Generated', 'Value': new Date().toLocaleString('en-US') },
            { 'Metric': 'Total Ghost Accounts', 'Value': ghostAccountsData.length },
            { 'Metric': 'Unreviewed Accounts', 'Value': ghostAccountsData.filter(a => !a.is_reviewed).length },
            { 'Metric': 'Reviewed Accounts', 'Value': ghostAccountsData.filter(a => a.is_reviewed).length }
        ];
        
        const wsSummary = XLSX.utils.json_to_sheet(summary);
        wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
        
        // Style summary sheet header
        ['A1', 'B1'].forEach(cell => {
            if (wsSummary[cell]) {
                wsSummary[cell].s = {
                    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "16A34A" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
        });
        
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Ghost_Accounts_Report_${timestamp}.xlsx`;
        
        // Write file
        XLSX.writeFile(wb, filename);
        
        console.log('[GhostAccounts] ✅ Excel export complete:', filename);
        
        // Show success message
        const exportBtn = document.getElementById('export-ghost-accounts-btn');
        if (exportBtn) {
            const originalHTML = exportBtn.innerHTML;
            exportBtn.innerHTML = `
                <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 12l2 2 4-4"></path>
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
                Exported!
            `;
            exportBtn.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
            
            setTimeout(() => {
                exportBtn.innerHTML = originalHTML;
                exportBtn.classList.remove('bg-green-50', 'text-green-700', 'border-green-200');
            }, 2000);
        }
    } catch (error) {
        console.error('[GhostAccounts] Error exporting to Excel:', error);
        alert('Failed to export to Excel. Check console for details.');
    }
}

// Refresh ghost accounts analysis
async function refreshGhostAccounts() {
    console.log('[GhostAccounts] Starting ghost accounts analysis...');
    
    const refreshBtn = document.getElementById('refresh-ghost-accounts-btn');
    const refreshEmptyBtn = document.getElementById('refresh-ghost-empty-btn');
    const statusEl = document.getElementById('ghost-accounts-page-status');
    
    const originalBtnText = refreshBtn?.innerHTML || '';
    const originalEmptyBtnText = refreshEmptyBtn?.textContent || '';
    
    try {
        // Update button states
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="h-4 w-4 mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                </svg>
                Analyzing...
            `;
        }
        
        if (refreshEmptyBtn) {
            refreshEmptyBtn.disabled = true;
            refreshEmptyBtn.textContent = 'Analyzing...';
        }
        
        if (statusEl) statusEl.textContent = 'Running analysis...';
        
        const response = await fetch('/api/ghost-accounts/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('[GhostAccounts] ✅ Analysis complete:', data.summary.ghostAccountsFound, 'ghost accounts found');
            alert(`Analysis complete!\n\n${data.summary.ghostAccountsFound} ghost account(s) found\n${data.summary.totalAnalyzed} accounts analyzed`);
            
            // Reload data
            await loadGhostAccountsData();
        } else {
            console.error('[GhostAccounts] ❌ Analysis failed:', data.error);
            alert(`Analysis failed: ${data.error}`);
        }
    } catch (error) {
        console.error('[GhostAccounts] Error refreshing:', error);
        alert('Failed to refresh ghost accounts analysis. Check console for details.');
    } finally {
        // Restore button states
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnText;
        }
        
        if (refreshEmptyBtn) {
            refreshEmptyBtn.disabled = false;
            refreshEmptyBtn.textContent = originalEmptyBtnText;
        }
    }
}

// Load deprovisioned accounts data
async function loadDeprovisionedAccountsData() {
    console.log('[Deprovisioned] Loading deprovisioned accounts data...');
    
    const tableBody = document.getElementById('deprovisioned-accounts-table-body');
    const emptyState = document.getElementById('deprovisioned-accounts-empty-state');
    const statusEl = document.getElementById('deprovisioned-accounts-status');
    const tableSection = document.querySelector('#deprovisioned-accounts-section .rounded-lg');
    
    if (!tableBody) return;
    
    // Show loading state
    if (statusEl) statusEl.textContent = 'Loading...';
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="p-8 text-center">
                <div class="loading-spinner mx-auto mb-2"></div>
                <div class="text-sm text-muted-foreground">Loading deprovisioned accounts...</div>
            </td>
        </tr>
    `;
    
    try {
        // Get filter values
        const daysBack = document.getElementById('deprovisioned-timeframe-filter')?.value || '30';
        
        // Build query params
        const params = new URLSearchParams();
        params.append('daysBack', daysBack);
        
        const response = await fetch(`/api/deprovisioned-accounts?${params}`);
        const data = await response.json();
        
        if (data.success) {
            deprovisionedAccountsData = data.deprovisionedAccounts || [];
            
            console.log('[Deprovisioned] Loaded', deprovisionedAccountsData.length, 'deprovisioned accounts');
            
            // Update last refresh time
            const lastRefreshEl = document.getElementById('ghost-accounts-last-refresh');
            if (lastRefreshEl) {
                lastRefreshEl.textContent = new Date().toLocaleTimeString();
            }
            
            // Render table or show empty state
            if (deprovisionedAccountsData.length === 0) {
                if (tableSection) tableSection.classList.add('hidden');
                if (emptyState) emptyState.classList.remove('hidden');
                if (statusEl) statusEl.textContent = `No deprovisioned accounts in last ${daysBack} days`;
            } else {
                if (tableSection) tableSection.classList.remove('hidden');
                if (emptyState) emptyState.classList.add('hidden');
                renderDeprovisionedAccountsTable();
                if (statusEl) statusEl.textContent = `Showing ${deprovisionedAccountsData.length} account(s)`;
            }
        } else {
            console.error('[Deprovisioned] Error loading data:', data.error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-8 text-center text-red-600">
                        Error loading deprovisioned accounts: ${data.error || 'Unknown error'}
                    </td>
                </tr>
            `;
            if (statusEl) statusEl.textContent = 'Error loading data';
        }
    } catch (error) {
        console.error('[Deprovisioned] Error:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-red-600">
                    Failed to load deprovisioned accounts. Check console for details.
                </td>
            </tr>
        `;
        if (statusEl) statusEl.textContent = 'Error';
    }
}

// Render deprovisioned accounts table
function renderDeprovisionedAccountsTable() {
    console.log('[Deprovisioned] Rendering table with', deprovisionedAccountsData.length, 'accounts');
    
    const tableBody = document.getElementById('deprovisioned-accounts-table-body');
    if (!tableBody) return;
    
    if (deprovisionedAccountsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-muted-foreground">
                    No deprovisioned accounts found.
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = deprovisionedAccountsData.map(account => {
        const expiryDate = new Date(account.latestExpiryDate);
        const deprovDate = new Date(account.deprovisioningRecord.createdDate);
        
        return `
            <tr class="border-b hover:bg-accent/50 transition-colors">
                <td class="p-4">
                    <div class="font-medium">${escapeHtml(account.accountName)}</div>
                </td>
                <td class="p-4 text-center">
                    <span class="inline-flex items-center justify-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        ${account.totalExpiredProducts} products
                    </span>
                </td>
                <td class="p-4">
                    <div class="text-sm">${expiryDate.toLocaleDateString()}</div>
                </td>
                <td class="p-4">
                    <div class="font-medium text-sm">${account.deprovisioningRecord.name}</div>
                    <div class="text-xs text-muted-foreground">${account.deprovisioningRecord.status || 'N/A'}</div>
                </td>
                <td class="p-4">
                    <div class="text-sm">${deprovDate.toLocaleDateString()}</div>
                    <div class="text-xs text-muted-foreground">${account.daysSinceDeprovisioning} days ago</div>
                </td>
                <td class="p-4">
                    <button 
                        onclick="viewGhostAccountDetails('${account.accountId}', '${escapeHtml(account.accountName).replace(/'/g, "\\'")}')"
                        class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                        title="View Details"
                    >
                        <svg class="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// Toggle between ghost and deprovisioned views
function toggleGhostView(view) {
    console.log('[GhostAccounts] Switching to view:', view);
    currentGhostView = view;
    
    // Update toggle buttons
    const ghostBtn = document.getElementById('view-toggle-ghost');
    const deprovisionedBtn = document.getElementById('view-toggle-deprovisioned');
    
    if (view === 'ghost') {
        ghostBtn.classList.add('bg-primary', 'text-primary-foreground');
        ghostBtn.classList.remove('border', 'border-input', 'bg-background');
        deprovisionedBtn.classList.remove('bg-primary', 'text-primary-foreground');
        deprovisionedBtn.classList.add('border', 'border-input', 'bg-background');
        
        // Show ghost filters and table
        document.getElementById('ghost-filters')?.classList.remove('hidden');
        document.getElementById('deprovisioned-filters')?.classList.add('hidden');
        document.getElementById('ghost-accounts-table-section')?.classList.remove('hidden');
        document.getElementById('deprovisioned-accounts-section')?.classList.add('hidden');
        
        // Load data if not loaded
        if (ghostAccountsData.length === 0) {
            loadGhostAccountsData();
        }
    } else {
        deprovisionedBtn.classList.add('bg-primary', 'text-primary-foreground');
        deprovisionedBtn.classList.remove('border', 'border-input', 'bg-background');
        ghostBtn.classList.remove('bg-primary', 'text-primary-foreground');
        ghostBtn.classList.add('border', 'border-input', 'bg-background');
        
        // Show deprovisioned filters and table
        document.getElementById('ghost-filters')?.classList.add('hidden');
        document.getElementById('deprovisioned-filters')?.classList.remove('hidden');
        document.getElementById('ghost-accounts-table-section')?.classList.add('hidden');
        document.getElementById('deprovisioned-accounts-section')?.classList.remove('hidden');
        
        // Load data
        loadDeprovisionedAccountsData();
    }
}

// Setup ghost accounts event listeners
function setupGhostAccountsEventListeners() {
    // View toggle buttons
    const ghostToggle = document.getElementById('view-toggle-ghost');
    const deprovisionedToggle = document.getElementById('view-toggle-deprovisioned');
    
    if (ghostToggle) {
        ghostToggle.addEventListener('click', () => toggleGhostView('ghost'));
    }
    
    if (deprovisionedToggle) {
        deprovisionedToggle.addEventListener('click', () => toggleGhostView('deprovisioned'));
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-ghost-accounts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshGhostAccounts);
    }
    
    // Refresh empty state button
    const refreshEmptyBtn = document.getElementById('refresh-ghost-empty-btn');
    if (refreshEmptyBtn) {
        refreshEmptyBtn.addEventListener('click', refreshGhostAccounts);
    }
    
    // Search filter
    const searchInput = document.getElementById('ghost-account-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // Debounce search
            clearTimeout(searchInput.debounceTimer);
            searchInput.debounceTimer = setTimeout(() => {
                loadGhostAccountsData();
            }, 300);
        });
    }
    
    // Review status filter
    const statusFilter = document.getElementById('ghost-review-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadGhostAccountsData);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-ghost-filters-btn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = 'unreviewed';
            loadGhostAccountsData();
        });
    }
    
    // Deprovisioned timeframe filter
    const timeframeFilter = document.getElementById('deprovisioned-timeframe-filter');
    if (timeframeFilter) {
        timeframeFilter.addEventListener('change', loadDeprovisionedAccountsData);
    }
    
    // Navigation handler
    if (navGhostAccounts) {
        navGhostAccounts.addEventListener('click', () => {
            showPage('ghost-accounts');
            // Load data if not loaded yet
            if (currentGhostView === 'ghost' && ghostAccountsData.length === 0) {
                loadGhostAccountsData();
            } else if (currentGhostView === 'deprovisioned' && deprovisionedAccountsData.length === 0) {
                loadDeprovisionedAccountsData();
            }
        });
    }
    
    console.log('[GhostAccounts] Event listeners setup complete');
}

// Initialize ghost accounts on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGhostAccountsEventListeners);
} else {
    setupGhostAccountsEventListeners();
}

console.log('Ghost Accounts module loaded');

// ===== MODAL FUNCTIONS =====

// Show modal with title and content
function showModal(title, content) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (modalOverlay && modalTitle && modalContent) {
        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        modalOverlay.style.display = 'flex';
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
}

// Close modal
function closeModal(event) {
    // If event is provided and target is not the overlay, don't close
    if (event && event.target.id !== 'modal-overlay') {
        return;
    }
    
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
