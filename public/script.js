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

// Navigation elements
const navDashboard = document.getElementById('nav-dashboard');
const navAnalytics = document.getElementById('nav-analytics');
const navRoadmap = document.getElementById('nav-roadmap');
const navProvisioning = document.getElementById('nav-provisioning');
const navProvisioningMonitor = document.getElementById('nav-provisioning-monitor');
const navValidationRules = document.getElementById('nav-validation-rules');
const navHelp = document.getElementById('nav-help');
const navSettings = document.getElementById('nav-settings');
const pageDashboard = document.getElementById('page-dashboard');
const pageAnalytics = document.getElementById('page-analytics');
const pageRoadmap = document.getElementById('page-roadmap');
const pageProvisioning = document.getElementById('page-provisioning');
const pageValidationRules = document.getElementById('page-validation-rules');
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
    if (pageId === 'provisioning' || pageId === 'validation-rules') {
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
    } else if (pageId === 'validation-rules') {
        const validationRulesNav = document.getElementById('nav-validation-rules');
        if (validationRulesNav) {
            validationRulesNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            validationRulesNav.classList.remove('text-muted-foreground');
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
        initializeProvisioning();
    } else if (pageId === 'validation-rules') {
        initializeValidationRules();
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
}

// Load analytics data for Technical Team Requests by type
async function loadAnalyticsData() {
    try {
        const response = await fetch('/api/analytics/request-types-week');
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
                    <div class="text-muted-foreground text-sm">No Technical Team Requests found in the last 6 months</div>
                </div>
            </div>
        `;
        return;
    }
    
    // Generate color classes for different request types
    const colors = [
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800', 
        'bg-purple-100 text-purple-800',
        'bg-orange-100 text-orange-800',
        'bg-pink-100 text-pink-800',
        'bg-indigo-100 text-indigo-800'
    ];
    
    const tiles = analyticsData.map((item, index) => {
        const colorClass = colors[index % colors.length];
        const isZeroCount = item.count === 0;
        const tileClass = isZeroCount ? 'rounded-lg border bg-card text-card-foreground shadow-sm p-6 opacity-60' : 'rounded-lg border bg-card text-card-foreground shadow-sm p-6';
        const badgeClass = isZeroCount ? 'bg-gray-100 text-gray-500' : colorClass;
        
        return `
            <div class="${tileClass}">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-muted-foreground">${item.requestType}</p>
                        <p class="text-2xl font-bold ${isZeroCount ? 'text-gray-400' : ''}">${item.count}</p>
                        <p class="text-xs text-muted-foreground">${item.percentage}% of total</p>
                    </div>
                    <div class="h-4 w-4 text-muted-foreground">
                        <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeClass}">
                            ${item.count}
                        </span>
                    </div>
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
    const now = new Date();
    timestampElement.textContent = `Last updated: ${now.toLocaleString()}`;
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
navValidationRules.addEventListener('click', handleNavigation);
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
    
    // Initialize navigation - restore saved page or default to dashboard
    const savedPage = localStorage.getItem('currentPage') || 'dashboard';
    showPage(savedPage);
    
    // Update timestamp
    updateTimestamp();
    
    // Add entrance animations
    setTimeout(() => {
        addEntranceAnimations();
    }, 100);
    
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
}

// Setup Settings page event listeners
function setupSettingsEventListeners() {
    const settingsThemeToggle = document.getElementById('settings-theme-toggle');
    const testConnectivityButton = document.getElementById('test-web-connectivity');
    const testSalesforceButton = document.getElementById('test-salesforce-connection');
    
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('click', toggleTheme);
    }
    
    if (testConnectivityButton) {
        testConnectivityButton.addEventListener('click', testWebConnectivity);
    }
    
    if (testSalesforceButton) {
        testSalesforceButton.addEventListener('click', testSalesforceConnection);
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
            <td colspan="7" class="px-4 py-8 text-center">
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
            <td colspan="7" class="px-4 py-8 text-center">
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
                <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">
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
                <div class="text-xs text-muted-foreground">ID: ${request.Id}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Account__c || 'N/A'}</div>
                ${request.Account_Site__c ? `<div class="text-xs text-muted-foreground">Site: ${request.Account_Site__c}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRequestTypeColor(request.Request_Type_RI__c)}">
                    ${request.Request_Type_RI__c || 'N/A'}
                </span>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Deployment__c || 'N/A'}</div>
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
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                    data-request-id="${request.Id}"
                    data-group-type="models"
                    data-entitlements="${JSON.stringify(modelEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4"></path>
                        <circle cx="21" cy="11" r="8"></circle>
                        <path d="M21 21l-4.35-4.35"></path>
                    </svg>
                    <span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full text-xs font-medium">${modelEntitlements.length}</span>
                    Models
                </button>
            `);
        }
        
        if (dataEntitlements.length > 0) {
            groups.push(`
                <button 
                    class="product-group-btn inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    data-request-id="${request.Id}"
                    data-group-type="data"
                    data-entitlements="${JSON.stringify(dataEntitlements).replace(/"/g, '&quot;')}"
                >
                    <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                    </svg>
                    <span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-medium">${dataEntitlements.length}</span>
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
        'models': `<svg class="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="21" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
        </svg>`,
        'data': `<svg class="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

    // Helper function to check if an entitlement has validation issues
    const hasValidationIssue = (item, index) => {
        if (!validationResult || validationResult.overallStatus !== 'FAIL') return false;
        
        // Look for date overlap validation failures
        const dateOverlapRule = validationResult.ruleResults?.find(rule => 
            rule.ruleId === 'entitlement-date-overlap-validation' && rule.status === 'FAIL'
        );
        
        if (!dateOverlapRule?.details?.overlaps) return false;
        
        // Map UI groupType to validation engine type
        const validationGroupType = {
            'models': 'model',
            'apps': 'app', 
            'data': 'data'
        }[groupType] || groupType;
        
        // Check if this item is involved in any overlaps
        return dateOverlapRule.details.overlaps.some(overlap => 
            (overlap.entitlement1.type === validationGroupType && overlap.entitlement1.index === (index + 1)) ||
            (overlap.entitlement2.type === validationGroupType && overlap.entitlement2.index === (index + 1))
        );
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

    const rowsHtml = items.map((item, index) => {
        const hasIssue = hasValidationIssue(item, index);
        const rowClass = hasIssue ? 'border-b last:border-0 bg-red-25 border-red-200' : 'border-b last:border-0';
        const cellClass = hasIssue ? 'px-3 py-2 text-sm relative' : 'px-3 py-2 text-sm';
        
        return `
            <tr class="${rowClass}" ${hasIssue ? 'title="This entitlement has a date overlap validation failure"' : ''}>
                ${hasIssue ? '<td class="px-1 py-2 w-4"><svg class="h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="m12 17 .01 0"></path></svg></td>' : '<td class="px-1 py-2 w-4"></td>'}
                ${columns.map(c => `<td class="${cellClass}">${escapeHtml(String(c.get(item)))}</td>`).join('')}
            </tr>
        `;
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
                <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">
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
                <td colspan="7" class="px-4 py-8 text-center text-red-600">
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
    const headers = ['Technical Team Request', 'Account', 'Request Type', 'Deployment Number', 'Status', 'Created Date'];
    const csvContent = [
        headers.join(','),
        ...filteredProvisioningData.map(request => [
            request.Name || '',
            request.Account__c || '',
            request.Request_Type_RI__c || '',
            request.Deployment__c || '',
            request.Status__c || '',
            formatDate(request.CreatedDate)
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
        let aVal = a[sortKey] || '';
        let bVal = b[sortKey] || '';
        
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
                <td colspan="8" class="px-4 py-8 text-center">
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
                <div class="text-sm text-muted-foreground">${request.Id}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Account__c || 'N/A'}</div>
                ${request.Account_Site__c ? `<div class="text-xs text-muted-foreground">${request.Account_Site__c}</div>` : ''}
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Request_Type_RI__c || 'N/A'}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-sm">${request.Deployment__c || 'N/A'}</div>
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
            const outliveClass = hasModelOverlap ? 'ring-2 ring-red-400' : '';
            
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
            const outliveClass = hasAppOverlap ? 'ring-2 ring-red-400' : '';
            
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
    if (pageId === 'provisioning' || pageId === 'validation-rules') {
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
    } else if (pageId === 'validation-rules') {
        const validationRulesNav = document.getElementById('nav-validation-rules');
        if (validationRulesNav) {
            validationRulesNav.classList.add('active', 'bg-accent', 'text-accent-foreground');
            validationRulesNav.classList.remove('text-muted-foreground');
        }
    }
    
    // Trigger page-specific initialization
    if (pageId === 'analytics') {
        initializeAnalytics();
    } else if (pageId === 'provisioning') {
        initializeProvisioning();
    } else if (pageId === 'validation-rules') {
        initializeValidationRules();
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
    const navValidationRules = document.getElementById('nav-validation-rules');
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
    if (navValidationRules) navValidationRules.addEventListener('click', handleNavigation);
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

// Fetch PS requests with removals from the API
async function fetchPSRemovals() {
    if (!removalsStatus || !removalsList || !removalsTimeFrameSelect) {
        console.warn('PS Removals monitoring elements not found');
        return;
    }
    
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
        removalsList.innerHTML = requests.map(item => {
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
        }).join('');
        
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
        'models': 'border-green-200 bg-green-50',
        'data': 'border-blue-200 bg-blue-50',
        'apps': 'border-purple-200 bg-purple-50'
    };
    
    const headerColors = {
        'models': 'text-green-800',
        'data': 'text-blue-800', 
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
    limit: 5  // Default to showing latest 5 requests
};

// Initialize Account History page
function initializeAccountHistory() {
    const searchInput = document.getElementById('account-history-search');
    const clearButton = document.getElementById('account-history-clear');
    const comparisonToggle = document.getElementById('show-comparison-toggle');
    const limitSelector = document.getElementById('account-history-limit');
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
            limit: currentLimit === 'all' ? null : parseInt(currentLimit)
        };
        
        // Ensure the limit selector is set to the current value
        if (limitSelector && !limitSelector.value) {
            limitSelector.value = '5';
        }
        
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
                <td class="p-4 align-middle text-center text-muted-foreground" colspan="7">
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
    const allRequests = [...currentAccountHistory.requests].sort((a, b) => {
        return new Date(b.CreatedDate) - new Date(a.CreatedDate);
    });
    
    // Apply limit if set
    const totalCount = allRequests.length;
    const limit = currentAccountHistory.limit;
    const requests = limit ? allRequests.slice(0, limit) : allRequests;
    
    // Update count indicator
    const countIndicator = document.getElementById('account-history-count-indicator');
    if (countIndicator) {
        if (limit && limit < totalCount) {
            countIndicator.textContent = `Showing latest ${requests.length} of ${totalCount} requests`;
        } else {
            countIndicator.textContent = `Showing all ${totalCount} requests`;
        }
    }
    
    let html = '';
    
    requests.forEach((request, index) => {
        const createdDate = new Date(request.CreatedDate);
        
        // Main row
        html += `
            <tr class="border-b transition-colors hover:bg-muted/50" data-request-name="${request.Name}">
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
                <td class="px-4 py-3 align-middle">
                    <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700">
                        ${request.Status__c || 'Unknown'}
                    </span>
                </td>
                <td class="px-4 py-3 align-middle text-sm">
                    ${request.Request_Type_RI__c || 'N/A'}
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
                <td colspan="7" class="p-0">
                    <div class="p-6">
                        ${renderRequestDetails(request, index < requests.length - 1 ? requests[index + 1] : null)}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Render request details (for expandable row)
function renderRequestDetails(request, previousRequest) {
    // Parse the payload data properly
    let parsedPayload = {};
    if (request.Payload_Data__c) {
        try {
            const payload = JSON.parse(request.Payload_Data__c);
            const entitlements = payload.properties?.provisioningDetail?.entitlements || {};
            parsedPayload = {
                hasDetails: true,
                modelEntitlements: entitlements.modelEntitlements || [],
                dataEntitlements: entitlements.dataEntitlements || [],
                appEntitlements: entitlements.appEntitlements || []
            };
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
    
    // Add comparison section if enabled and previous request exists
    if (showComparison && previousRequest) {
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
        
        html += `
            <div class="mt-6 pt-6 border-t">
                <h4 class="font-semibold mb-3 flex items-center gap-2">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 3 21 3 21 8"></polyline>
                        <line x1="4" x2="21" y1="20" y2="3"></line>
                        <polyline points="21 16 21 21 16 21"></polyline>
                        <line x1="15" x2="10" y1="15" y2="15"></line>
                        <line x1="15" x2="10" y1="19" y2="19"></line>
                    </svg>
                    Changes from Previous Request (${previousRequest.Name})
                </h4>
                ${renderProductComparison(parsedPayload, previousParsedPayload)}
            </div>
        `;
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
            removed: previous.models.filter(p => !current.models.includes(p))
        },
        data: {
            added: current.data.filter(p => !previous.data.includes(p)),
            removed: previous.data.filter(p => !current.data.includes(p))
        },
        apps: {
            added: current.apps.filter(p => !previous.apps.includes(p)),
            removed: previous.apps.filter(p => !current.apps.includes(p))
        }
    };
    
    const hasChanges = 
        changes.models.added.length > 0 || changes.models.removed.length > 0 ||
        changes.data.added.length > 0 || changes.data.removed.length > 0 ||
        changes.apps.added.length > 0 || changes.apps.removed.length > 0;
    
    if (!hasChanges) {
        return '<p class="text-sm text-muted-foreground">No changes in product entitlements</p>';
    }
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">';
    
    // Added products
    const hasAdded = changes.models.added.length > 0 || changes.data.added.length > 0 || changes.apps.added.length > 0;
    if (hasAdded) {
        html += '<div class="space-y-2">';
        html += '<h5 class="font-medium text-green-700 flex items-center gap-2">';
        html += '<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
        html += 'Added</h5>';
        
        if (changes.models.added.length > 0) {
            html += `<p><span class="font-medium">Models:</span> ${changes.models.added.join(', ')}</p>`;
        }
        if (changes.data.added.length > 0) {
            html += `<p><span class="font-medium">Data:</span> ${changes.data.added.join(', ')}</p>`;
        }
        if (changes.apps.added.length > 0) {
            html += `<p><span class="font-medium">Apps:</span> ${changes.apps.added.join(', ')}</p>`;
        }
        html += '</div>';
    }
    
    // Removed products
    const hasRemoved = changes.models.removed.length > 0 || changes.data.removed.length > 0 || changes.apps.removed.length > 0;
    if (hasRemoved) {
        html += '<div class="space-y-2">';
        html += '<h5 class="font-medium text-red-700 flex items-center gap-2">';
        html += '<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"></line></svg>';
        html += 'Removed</h5>';
        
        if (changes.models.removed.length > 0) {
            html += `<p><span class="font-medium">Models:</span> ${changes.models.removed.join(', ')}</p>`;
        }
        if (changes.data.removed.length > 0) {
            html += `<p><span class="font-medium">Data:</span> ${changes.data.removed.join(', ')}</p>`;
        }
        if (changes.apps.removed.length > 0) {
            html += `<p><span class="font-medium">Apps:</span> ${changes.apps.removed.join(', ')}</p>`;
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
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
        limit: 5  // Reset to default
    };
    
    const searchInput = document.getElementById('account-history-search');
    const searchResults = document.getElementById('account-history-search-results');
    const emptyState = document.getElementById('account-history-empty-state');
    const summarySection = document.getElementById('account-summary-section');
    const tableSection = document.getElementById('account-history-table-section');
    const comparisonToggle = document.getElementById('show-comparison-toggle');
    const limitSelector = document.getElementById('account-history-limit');
    
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (summarySection) summarySection.classList.add('hidden');
    if (tableSection) tableSection.classList.add('hidden');
    if (comparisonToggle) comparisonToggle.checked = false;
    if (limitSelector) limitSelector.value = '5';  // Reset to default
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
