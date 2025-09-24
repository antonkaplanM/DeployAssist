// DOM elements
const greetingText = document.getElementById('greeting-text');
const timestampElement = document.getElementById('timestamp');
const nameInput = document.getElementById('name-input');
const greetButton = document.getElementById('greet-btn');
const themeToggle = document.getElementById('theme-toggle');

// Navigation elements
const navDashboard = document.getElementById('nav-dashboard');
const navAnalytics = document.getElementById('nav-analytics');
const navRoadmap = document.getElementById('nav-roadmap');
const navProvisioning = document.getElementById('nav-provisioning');
const navSettings = document.getElementById('nav-settings');
const pageDashboard = document.getElementById('page-dashboard');
const pageAnalytics = document.getElementById('page-analytics');
const pageRoadmap = document.getElementById('page-roadmap');
const pageProvisioning = document.getElementById('page-provisioning');
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
    hasMore: false,
    isLoading: false
};

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
    
    // Trigger page-specific initialization
    if (pageId === 'analytics') {
        initializeAnalytics();
    } else if (pageId === 'landing') {
        // Refocus on input field if returning to landing page
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    } else if (pageId === 'provisioning') {
        initializeProvisioning();
    } else if (pageId === 'roadmap') {
        initializeRoadmap();
    } else if (pageId === 'settings') {
        initializeSettings();
    }
}

function initializeAnalytics() {
    // Analytics page initialization
    console.log('Analytics page initialized');
    
    // Here you could load analytics data from an API
    // For now, we'll just show the empty state
    updateAnalyticsStats({
        totalAccounts: 0,
        totalProducts: 0,
        avgProductsPerAccount: 0
    });
}

function updateAnalyticsStats(stats) {
    // Update the stats cards in the analytics page
    const statsCards = document.querySelectorAll('#page-analytics .text-2xl');
    if (statsCards.length >= 3) {
        statsCards[0].textContent = stats.totalAccounts;
        statsCards[1].textContent = stats.totalProducts;
        statsCards[2].textContent = stats.avgProductsPerAccount.toFixed(1);
    }
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
        
        if (apiResponse && apiResponse.issues && apiResponse.issues.length > 0) {
            initiativesData = apiResponse.issues;
            
            // Update title with assignee name
            updateAssigneeTitle(assigneeName, apiResponse.issues.length);
        } else {
            // No data found
            showRoadmapNoData(assigneeName);
            return;
        }
        
        filteredData = [...initiativesData];
        renderRoadmapTable(filteredData);
        updateInitiativeCount(filteredData.length);
        
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

// Update greeting display
async function updateGreeting(name = '') {
    // Add loading state
    const originalText = greetButton.textContent;
    greetButton.textContent = 'Loading...';
    greetButton.disabled = true;
    greetButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    try {
        const data = await fetchGreeting(name);
        
        // Animate text change with shadcn-style transition
        greetingText.style.opacity = '0';
        greetingText.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            greetingText.textContent = data.message;
            greetingText.style.opacity = '1';
            greetingText.style.transform = 'translateY(0)';
            
            // Update timestamp
            const timestamp = new Date(data.timestamp);
            timestampElement.textContent = `Generated: ${timestamp.toLocaleString()}`;
        }, 150);
        
    } catch (error) {
        console.error('Error updating greeting:', error);
    } finally {
        // Reset button state
        setTimeout(() => {
            greetButton.textContent = originalText;
            greetButton.disabled = false;
            greetButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }, 500);
    }
}

// Handle greeting button click
function handleGreetClick() {
    const name = nameInput.value.trim();
    updateGreeting(name);
    
    // Add subtle click animation
    greetButton.style.transform = 'scale(0.98)';
    setTimeout(() => {
        greetButton.style.transform = '';
    }, 150);
}

// Handle Enter key in input field
function handleInputKeyPress(event) {
    if (event.key === 'Enter') {
        handleGreetClick();
    }
}

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

// Enhanced input validation with shadcn-style feedback
function validateInput() {
    const value = nameInput.value.trim();
    
    if (value.length > 50) {
        nameInput.value = value.substring(0, 50);
        
        // Add visual feedback
        nameInput.classList.add('border-red-500');
        setTimeout(() => {
            nameInput.classList.remove('border-red-500');
        }, 2000);
    }
}

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

// Event listeners
greetButton.addEventListener('click', handleGreetClick);
greetButton.addEventListener('click', createRippleEffect);
nameInput.addEventListener('keypress', handleInputKeyPress);
nameInput.addEventListener('input', validateInput);
themeToggle.addEventListener('click', toggleTheme);

// Navigation event listeners
navDashboard.addEventListener('click', handleNavigation);
navAnalytics.addEventListener('click', handleNavigation);
navRoadmap.addEventListener('click', handleNavigation);
navProvisioning.addEventListener('click', handleNavigation);
navSettings.addEventListener('click', handleNavigation);

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
            if (nameInput) {
                nameInput.focus();
            }
        }, 800);
        
        // Initial greeting for landing page
        setTimeout(() => {
            updateGreeting();
        }, 1000);
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
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
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
    setupCollapsibleSections();
}

// Setup collapsible sections functionality
function setupCollapsibleSections() {
    const sectionToggles = document.querySelectorAll('.settings-section-toggle');
    
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
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

// Initialize Provisioning Monitor page
async function initializeProvisioning() {
    console.log('Provisioning Monitor page initialized');
    
    // Load filter options first
    await loadProvisioningFilterOptions();
    
    // Load initial data
    await loadProvisioningRequests();
    
    // Setup event listeners
    setupProvisioningEventListeners();
}

// Setup event listeners for Provisioning Monitor
function setupProvisioningEventListeners() {
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
    
    // Load More button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreRecords);
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
async function loadProvisioningRequests(filters = {}, append = false) {
    if (provisioningPagination.isLoading) return;
    
    provisioningPagination.isLoading = true;
    
    try {
        console.log('Loading provisioning requests...', append ? 'appending' : 'new search');
        
        if (!append) {
            // Show loading state for new searches
            showProvisioningLoading();
            provisioningPagination.currentPage = 1;
            provisioningData = [];
        }
        
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
            hasMore: data.hasMore,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            fullResponse: data
        });
        
        if (data.success) {
            if (append) {
                // Append new records for lazy loading
                provisioningData = [...provisioningData, ...data.records];
            } else {
                // Replace records for new search/filter
                provisioningData = data.records || [];
            }
            
            // Update pagination state
            provisioningPagination.totalCount = data.totalCount;
            provisioningPagination.totalPages = data.totalPages;
            provisioningPagination.hasMore = data.hasMore;
            
            filteredProvisioningData = [...provisioningData];
            
            console.log(`✅ Loaded ${data.records.length} provisioning requests (page ${provisioningPagination.currentPage} of ${provisioningPagination.totalPages})`);
            renderProvisioningTable(filteredProvisioningData);
            updateProvisioningCount(data.totalCount);
            updatePaginationInfo();
            
        } else {
            console.error('Failed to load provisioning requests:', data.error);
            showProvisioningError(data.error || 'Failed to load requests');
        }
        
    } catch (err) {
        console.error('Error loading provisioning requests:', err);
        showProvisioningError('Network error while loading requests');
    } finally {
        provisioningPagination.isLoading = false;
    }
}

// Load more records for pagination
async function loadMoreRecords() {
    const shouldHaveMore = provisioningData.length < provisioningPagination.totalCount;
    const actualHasMore = provisioningPagination.hasMore !== false && shouldHaveMore;
    
    if (!actualHasMore || provisioningPagination.isLoading) {
        return;
    }
    
    provisioningPagination.currentPage++;
    
    // Get current filter values
    const filters = getCurrentFilters();
    
    await loadProvisioningRequests(filters, true); // append = true
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

// Update pagination info display
function updatePaginationInfo() {
    const paginationInfo = document.getElementById('pagination-info');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreLoading = document.getElementById('load-more-loading');
    
    if (paginationInfo) {
        const start = Math.min(1, provisioningPagination.totalCount);
        const end = provisioningData.length;
        const total = provisioningPagination.totalCount;
        
        paginationInfo.textContent = `Showing ${start}-${end} of ${total} records`;
    }
    
    // Show/hide load more button
    if (loadMoreBtn && loadMoreLoading) {
        // Calculate if there should be more records based on current data vs total
        const shouldHaveMore = provisioningData.length < provisioningPagination.totalCount;
        const actualHasMore = provisioningPagination.hasMore !== false && shouldHaveMore;
        
        if (actualHasMore && !provisioningPagination.isLoading) {
            loadMoreBtn.style.display = 'flex';
            loadMoreLoading.style.display = 'none';
        } else if (provisioningPagination.isLoading) {
            loadMoreBtn.style.display = 'none';
            loadMoreLoading.style.display = 'flex';
        } else {
            loadMoreBtn.style.display = 'none';
            loadMoreLoading.style.display = 'none';
        }
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
                    class="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                    onclick="showProductGroup('${request.Id}', 'models', ${JSON.stringify(modelEntitlements).replace(/"/g, '&quot;')})"
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
                    class="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    onclick="showProductGroup('${request.Id}', 'data', ${JSON.stringify(dataEntitlements).replace(/"/g, '&quot;')})"
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
                    class="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                    onclick="showProductGroup('${request.Id}', 'apps', ${JSON.stringify(appEntitlements).replace(/"/g, '&quot;')})"
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
    const request = provisioningData.find(r => r.Id === requestId);
    if (!request) {
        console.error('Request not found:', requestId);
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
    
    // Create and show modal
    showProductModal(request.Name, groupType, items);
}

// Create and display product modal
function showProductModal(requestName, groupType, items) {
    // Remove existing modal if any
    const existingModal = document.getElementById('product-modal');
    if (existingModal) {
        existingModal.remove();
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
                    ${renderProductItems(items, groupType)}
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
}

// Render product items based on type
function renderProductItems(items, groupType) {
    if (items.length === 0) {
        return '<p class="text-muted-foreground text-center py-8">No items found</p>';
    }
    
    if (groupType === 'models') {
        return items.map((item, index) => `
            <div class="border rounded-lg p-4 mb-3 hover:bg-muted/20 transition-colors">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-medium text-green-800">${item.productCode || 'Unknown Model'}</h3>
                    <span class="text-xs text-muted-foreground">#${index + 1}</span>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span class="text-muted-foreground">Start Date:</span>
                        <span class="ml-2 font-medium">${item.startDate || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-muted-foreground">End Date:</span>
                        <span class="ml-2 font-medium">${item.endDate || 'N/A'}</span>
                    </div>
                    ${item.productModifier ? `
                        <div class="col-span-2">
                            <span class="text-muted-foreground">Modifier:</span>
                            <span class="ml-2 font-medium">${item.productModifier}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } else {
        // For data and app entitlements, show as structured data
        return items.map((item, index) => `
            <div class="border rounded-lg p-4 mb-3 hover:bg-muted/20 transition-colors">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-medium ${groupType === 'data' ? 'text-blue-800' : 'text-purple-800'}">${groupType === 'data' ? 'Data' : 'App'} Item #${index + 1}</h3>
                </div>
                <pre class="text-xs bg-muted p-3 rounded overflow-x-auto font-mono">${JSON.stringify(item, null, 2)}</pre>
            </div>
        `).join('');
    }
}

// Close product modal
function closeProductModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleModalEscape);
    }
}

// Handle escape key for modal
function handleModalEscape(event) {
    if (event.key === 'Escape') {
        closeProductModal();
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

// Update provisioning count display
function updateProvisioningCount(count) {
    const countElement = document.getElementById('provisioning-count');
    if (countElement) {
        countElement.textContent = `${count} total requests`;
    }
}

// Handle search input change
async function handleProvisioningSearch(event) {
    const searchTerm = event.target.value;
    provisioningPagination.currentPage = 1;
    provisioningData = [];
    
    await loadProvisioningRequests({ search: searchTerm });
}

// Handle filter changes
async function handleProvisioningFilterChange() {
    provisioningPagination.currentPage = 1;
    provisioningData = [];
    
    const filters = getCurrentFilters();
    await loadProvisioningRequests(filters);
}

// Handle refresh button
async function handleProvisioningRefresh() {
    provisioningPagination.currentPage = 1;
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

