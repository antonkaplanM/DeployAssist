// DOM elements
const greetingText = document.getElementById('greeting-text');
const timestampElement = document.getElementById('timestamp');
const nameInput = document.getElementById('name-input');
const greetButton = document.getElementById('greet-btn');
const themeToggle = document.getElementById('theme-toggle');

// Navigation elements
const navLanding = document.getElementById('nav-landing');
const navAnalytics = document.getElementById('nav-analytics');
const navRoadmap = document.getElementById('nav-roadmap');
const navSettings = document.getElementById('nav-settings');
const pageLanding = document.getElementById('page-landing');
const pageAnalytics = document.getElementById('page-analytics');
const pageRoadmap = document.getElementById('page-roadmap');
const pageSettings = document.getElementById('page-settings');

// Current page state
let currentPage = 'landing';

// MCP Configuration state
let mcpServices = [];

// Roadmap data and state
let initiativesData = [];
let filteredData = [];
let sortConfig = { key: null, direction: 'asc' };

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
            message: 'Hello, World! 🌍', 
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
navLanding.addEventListener('click', handleNavigation);
navAnalytics.addEventListener('click', handleNavigation);
navRoadmap.addEventListener('click', handleNavigation);
navSettings.addEventListener('click', handleNavigation);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initializeTheme();
    
    // Initialize navigation - restore saved page or default to landing
    const savedPage = localStorage.getItem('currentPage') || 'landing';
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
    
    // Ctrl/Cmd + 1 to go to Landing page
    if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        showPage('landing');
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
    
    // Escape to clear input (only on landing page)
    if (event.key === 'Escape' && currentPage === 'landing') {
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
    }
    
    // Arrow keys for navigation
    if (event.key === 'ArrowLeft' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (currentPage === 'analytics') {
            showPage('landing');
        }
    }
    
    if (event.key === 'ArrowRight' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (currentPage === 'landing') {
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
    loadMCPServices();
    setupSettingsEventListeners();
}

// Setup Settings page event listeners
function setupSettingsEventListeners() {
    // Add MCP Service form toggle
    const addMCPButton = document.getElementById('add-mcp-service');
    const addMCPForm = document.getElementById('add-mcp-form');
    const saveMCPButton = document.getElementById('save-mcp-service');
    const cancelMCPButton = document.getElementById('cancel-mcp-service');
    const settingsThemeToggle = document.getElementById('settings-theme-toggle');
    const testConnectivityButton = document.getElementById('test-web-connectivity');
    
    if (addMCPButton) {
        addMCPButton.addEventListener('click', () => {
            addMCPForm.classList.toggle('hidden');
            if (!addMCPForm.classList.contains('hidden')) {
                clearMCPForm();
                document.getElementById('mcp-name').focus();
            }
        });
    }
    
    if (saveMCPButton) {
        saveMCPButton.addEventListener('click', saveMCPService);
    }
    
    if (cancelMCPButton) {
        cancelMCPButton.addEventListener('click', () => {
            addMCPForm.classList.add('hidden');
            clearMCPForm();
        });
    }
    
    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('click', toggleTheme);
    }
    
    if (testConnectivityButton) {
        testConnectivityButton.addEventListener('click', testWebConnectivity);
    }
}

// Load and display MCP services
function loadMCPServices() {
    // Load from localStorage or use default Atlassian MCP config
    const savedServices = localStorage.getItem('mcpServices');
    if (savedServices) {
        mcpServices = JSON.parse(savedServices);
    } else {
        // Add default Atlassian MCP configuration with SSE-only transport strategy
        mcpServices = [
            {
                id: 'atlassian-mcp-server',
                name: 'atlassian-mcp-server',
                command: 'cmd',
                args: ['/c', 'npx', '-y', 'mcp-remote', 'https://mcp.atlassian.com/v1/sse', '--transport', 'sse-only'],
                env: {
                    'MCP_TIMEOUT': '120000',
                    'NODE_OPTIONS': '--max-old-space-size=4096',
                    'NODE_TLS_REJECT_UNAUTHORIZED': '0'
                },
                status: 'active',
                lastTested: null,
                description: 'Atlassian MCP Server for Jira and Confluence integration (SSE-only transport)'
            }
        ];
        saveMCPServicesToStorage();
    }
    
    // Sync configuration with backend on load
    syncMCPConfigWithBackend();
    renderMCPServices();
}

// Render MCP services list
function renderMCPServices() {
    const servicesList = document.getElementById('mcp-services-list');
    if (!servicesList) return;
    
    if (mcpServices.length === 0) {
        servicesList.innerHTML = `
            <div class="text-center py-8 text-muted-foreground">
                <svg class="h-12 w-12 mx-auto mb-4 opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v20M2 12h20"></path>
                </svg>
                <p>No MCP services configured</p>
                <p class="text-sm">Click "Add MCP Service" to get started</p>
            </div>
        `;
        return;
    }
    
    servicesList.innerHTML = mcpServices.map(service => `
        <div class="border rounded-lg p-4 bg-background">
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="font-semibold">${service.name}</h4>
                        <span class="px-2 py-1 text-xs rounded-full ${
                            service.status === 'active' ? 'bg-green-100 text-green-700' :
                            service.status === 'testing' ? 'bg-yellow-100 text-yellow-700' :
                            service.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                        }">${service.status}</span>
                    </div>
                    <p class="text-sm text-muted-foreground mb-2">${service.description || 'No description provided'}</p>
                    <div class="text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                        ${service.command} ${service.args.join(' ')}
                    </div>
                    <div class="text-xs text-muted-foreground mt-1">
                        ${service.lastTested ? `Last tested: ${new Date(service.lastTested).toLocaleString()}` : 'Never tested'}
                    </div>
                </div>
                <div class="flex gap-2 ml-4">
                    <button 
                        onclick="testMCPService('${service.id}')"
                        class="test-mcp-btn inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                    >
                        <svg class="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="5,3 19,12 5,21"></polygon>
                        </svg>
                        Test
                    </button>
                    <button 
                        onclick="editMCPService('${service.id}')"
                        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                    >
                        <svg class="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                        </svg>
                        Edit
                    </button>
                    <button 
                        onclick="deleteMCPService('${service.id}')"
                        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 px-3"
                    >
                        <svg class="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
            
            <!-- Environment Variables -->
            ${service.env && Object.keys(service.env).length > 0 ? `
                <details class="mt-3">
                    <summary class="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Environment Variables</summary>
                    <div class="mt-2 text-xs font-mono bg-muted p-2 rounded">
                        ${Object.entries(service.env).map(([key, value]) => `${key}="${value}"`).join('<br>')}
                    </div>
                </details>
            ` : ''}
        </div>
    `).join('');
}

// Test MCP Service
async function testMCPService(serviceId) {
    const service = mcpServices.find(s => s.id === serviceId);
    if (!service) return;
    
    // Update UI to show testing state
    service.status = 'testing';
    renderMCPServices();
    
    try {
        console.log(`Testing MCP service: ${service.name}`);
        
        // Call backend to test MCP service
        const response = await fetch('/api/test-mcp-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(service)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            service.status = 'active';
            service.lastTested = new Date().toISOString();
            console.log(`✅ MCP service ${service.name} test successful`);
        } else {
            service.status = 'error';
            service.lastTested = new Date().toISOString();
            console.error(`❌ MCP service ${service.name} test failed:`, result.error);
            alert(`Test failed: ${result.error || 'Unknown error'}`);
        }
    } catch (error) {
        service.status = 'error';
        service.lastTested = new Date().toISOString();
        console.error(`❌ MCP service ${service.name} test failed:`, error);
        alert(`Test failed: ${error.message}`);
    }
    
    saveMCPServicesToStorage();
    renderMCPServices();
}

// Save MCP Service
function saveMCPService() {
    const name = document.getElementById('mcp-name').value.trim();
    const command = document.getElementById('mcp-command').value.trim();
    const argsString = document.getElementById('mcp-args').value.trim();
    const envString = document.getElementById('mcp-env').value.trim();
    
    if (!name || !command) {
        alert('Please fill in Service Name and Command fields');
        return;
    }
    
    let args = [];
    if (argsString) {
        args = argsString.split(',').map(arg => arg.trim()).filter(arg => arg);
    }
    
    let env = {};
    if (envString) {
        try {
            env = JSON.parse(envString);
        } catch (error) {
            alert('Invalid JSON format for environment variables');
            return;
        }
    }
    
    const newService = {
        id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: name,
        command: command,
        args: args,
        env: env,
        status: 'inactive',
        lastTested: null,
        description: `Custom MCP service: ${name}`
    };
    
    // Check if service already exists
    const existingIndex = mcpServices.findIndex(s => s.id === newService.id);
    if (existingIndex >= 0) {
        mcpServices[existingIndex] = newService;
    } else {
        mcpServices.push(newService);
    }
    
    saveMCPServicesToStorage();
    renderMCPServices();
    
    // Hide form and clear
    document.getElementById('add-mcp-form').classList.add('hidden');
    clearMCPForm();
    
    console.log('MCP service saved:', newService);
}

// Edit MCP Service
function editMCPService(serviceId) {
    const service = mcpServices.find(s => s.id === serviceId);
    if (!service) return;
    
    // Populate form with service data
    document.getElementById('mcp-name').value = service.name;
    document.getElementById('mcp-command').value = service.command;
    document.getElementById('mcp-args').value = service.args.join(', ');
    document.getElementById('mcp-env').value = JSON.stringify(service.env, null, 2);
    
    // Show form
    document.getElementById('add-mcp-form').classList.remove('hidden');
    document.getElementById('mcp-name').focus();
}

// Delete MCP Service
function deleteMCPService(serviceId) {
    const service = mcpServices.find(s => s.id === serviceId);
    if (!service) return;
    
    if (confirm(`Are you sure you want to delete the MCP service "${service.name}"?`)) {
        mcpServices = mcpServices.filter(s => s.id !== serviceId);
        saveMCPServicesToStorage();
        renderMCPServices();
        console.log('MCP service deleted:', serviceId);
    }
}

// Clear MCP form
function clearMCPForm() {
    document.getElementById('mcp-name').value = '';
    document.getElementById('mcp-command').value = '';
    document.getElementById('mcp-args').value = '';
    document.getElementById('mcp-env').value = '';
}

// Save MCP services to localStorage and sync with backend
function saveMCPServicesToStorage() {
    localStorage.setItem('mcpServices', JSON.stringify(mcpServices));
    
    // Sync with backend for Jira integration
    syncMCPConfigWithBackend();
}

// Sync MCP configuration with backend
async function syncMCPConfigWithBackend() {
    try {
        console.log('🔄 Syncing MCP config with backend for Jira integration...');
        
        const response = await fetch('/api/mcp-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ services: mcpServices })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ MCP config synced with backend:', result.message);
        } else {
            console.error('❌ Failed to sync MCP config with backend');
        }
    } catch (error) {
        console.error('❌ Error syncing MCP config:', error);
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

// Global functions for onclick handlers
window.testMCPService = testMCPService;
window.editMCPService = editMCPService;
window.deleteMCPService = deleteMCPService;
