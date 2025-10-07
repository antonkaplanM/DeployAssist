// ============================================================================
// NOTIFICATION MANAGER
// Handles polling for new PS records and displaying notifications
// ============================================================================

class NotificationManager {
    constructor() {
        this.pollInterval = null;
        this.lastCheckTimestamp = new Date().toISOString();
        this.settings = this.loadSettings();
        this.notificationSound = null;
        this.unreadCount = 0;
        
        // Initialize sound
        this.initializeSound();
    }
    
    // Load notification settings from localStorage
    loadSettings() {
        const defaultSettings = {
            inBrowserEnabled: true,
            desktopEnabled: true,
            soundEnabled: true,
            pollInterval: 60000 // 60 seconds
        };
        
        const saved = localStorage.getItem('notificationSettings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (error) {
                console.error('Error loading notification settings:', error);
                return defaultSettings;
            }
        }
        return defaultSettings;
    }
    
    // Save notification settings to localStorage
    saveSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
        console.log('📝 Notification settings saved:', this.settings);
        
        // Restart polling if interval changed
        if (settings.pollInterval !== undefined && this.pollInterval) {
            this.stop();
            this.start();
        }
    }
    
    // Initialize notification sound
    initializeSound() {
        // Create a subtle notification sound using Web Audio API
        // Alternative: You can use an audio file if you prefer
        this.notificationSound = {
            context: null,
            play: () => {
                if (!this.settings.soundEnabled) return;
                
                try {
                    // Create audio context if not exists
                    if (!this.notificationSound.context) {
                        this.notificationSound.context = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    
                    const ctx = this.notificationSound.context;
                    const oscillator = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    
                    // Set up a pleasant notification tone
                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                    
                    oscillator.start(ctx.currentTime);
                    oscillator.stop(ctx.currentTime + 0.3);
                } catch (error) {
                    console.warn('Could not play notification sound:', error);
                }
            }
        };
    }
    
    // Request notification permission from browser
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    }
    
    // Start polling for new records
    start() {
        if (this.pollInterval) {
            console.warn('Notification polling already started');
            return;
        }
        
        console.log(`🔔 Starting notification polling (every ${this.settings.pollInterval / 1000}s)`);
        
        // Reset timestamp to now when starting
        this.lastCheckTimestamp = new Date().toISOString();
        
        // Start polling
        this.pollInterval = setInterval(() => {
            this.checkForNewRecords();
        }, this.settings.pollInterval);
        
        // Request permission if desktop notifications are enabled
        if (this.settings.desktopEnabled) {
            this.requestPermission();
        }
    }
    
    // Stop polling
    stop() {
        if (this.pollInterval) {
            console.log('🔕 Stopping notification polling');
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    // Check for new records
    async checkForNewRecords() {
        try {
            const response = await fetch(`/api/provisioning/new-records?since=${encodeURIComponent(this.lastCheckTimestamp)}`);
            const data = await response.json();
            
            if (data.success && data.newRecords && data.newRecords.length > 0) {
                console.log(`🔔 Found ${data.newRecords.length} new PS record(s)`);
                
                // Update last check timestamp
                this.lastCheckTimestamp = data.checkTimestamp;
                
                // Show notifications
                this.showNotifications(data.newRecords);
            } else {
                // Update timestamp even if no new records
                if (data.checkTimestamp) {
                    this.lastCheckTimestamp = data.checkTimestamp;
                }
            }
        } catch (error) {
            console.error('Error checking for new records:', error);
        }
    }
    
    // Show notifications for new records
    showNotifications(records) {
        const maxIndividualNotifications = 3;
        
        // Increment unread count
        this.unreadCount += records.length;
        this.updateBadge();
        
        // Play sound once
        this.notificationSound.play();
        
        if (records.length <= maxIndividualNotifications) {
            // Show individual notifications
            records.forEach((record, index) => {
                // Slight delay between multiple notifications
                setTimeout(() => {
                    this.showNotification(record);
                }, index * 200);
            });
        } else {
            // Show summary notification
            this.showSummaryNotification(records);
        }
    }
    
    // Show notification for a single record
    showNotification(record) {
        const title = `New PS Request: ${record.requestType}`;
        const message = `${record.name}${record.account ? ' - ' + record.account : ''}`;
        
        // Show in-browser notification
        if (this.settings.inBrowserEnabled) {
            this.showInBrowserNotification(title, message, record);
        }
        
        // Show desktop notification
        if (this.settings.desktopEnabled && Notification.permission === 'granted') {
            this.showDesktopNotification(title, message, record);
        }
    }
    
    // Show summary notification for multiple records
    showSummaryNotification(records) {
        const title = `${records.length} New PS Requests`;
        const requestTypes = [...new Set(records.map(r => r.requestType))].join(', ');
        const message = `Request types: ${requestTypes}`;
        
        // Show in-browser notification
        if (this.settings.inBrowserEnabled) {
            this.showInBrowserNotification(title, message, null, records);
        }
        
        // Show desktop notification
        if (this.settings.desktopEnabled && Notification.permission === 'granted') {
            this.showDesktopNotification(title, message, null, records);
        }
    }
    
    // Show in-browser toast notification
    showInBrowserNotification(title, message, record, records = null) {
        const container = this.getOrCreateNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = 'notification-toast animate-slide-in';
        
        const isMultiple = records !== null && records.length > 1;
        
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                    <svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-foreground">${title}</p>
                    <p class="text-sm text-muted-foreground mt-1">${message}</p>
                    <button class="notification-action-btn mt-2 text-xs font-medium text-primary hover:underline">
                        View in Provisioning Monitor →
                    </button>
                </div>
                <button class="notification-close flex-shrink-0 text-muted-foreground hover:text-foreground">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add click handler for navigation
        const actionBtn = notification.querySelector('.notification-action-btn');
        actionBtn.addEventListener('click', () => {
            this.navigateToProvisioningMonitor();
            this.removeNotification(notification);
        });
        
        // Add close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Add to container
        container.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                this.removeNotification(notification);
            }
        }, 10000);
    }
    
    // Show desktop system notification
    showDesktopNotification(title, message, record, records = null) {
        if (Notification.permission !== 'granted') return;
        
        try {
            const notification = new Notification(title, {
                body: message,
                icon: '/favicon.ico', // Update with your app icon
                badge: '/favicon.ico',
                tag: record ? record.id : 'summary',
                requireInteraction: false,
                silent: false // Let the sound be handled by our custom sound
            });
            
            // Handle click - navigate to provisioning monitor
            notification.onclick = () => {
                window.focus();
                this.navigateToProvisioningMonitor();
                notification.close();
            };
            
            // Auto-close after 10 seconds
            setTimeout(() => {
                notification.close();
            }, 10000);
        } catch (error) {
            console.error('Error showing desktop notification:', error);
        }
    }
    
    // Get or create notification container
    getOrCreateNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    // Remove a notification with animation
    removeNotification(notification) {
        notification.classList.add('animate-slide-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // Navigate to Provisioning Monitor
    navigateToProvisioningMonitor() {
        // Clear unread count
        this.unreadCount = 0;
        this.updateBadge();
        
        // Call the showPage function if available
        if (typeof showPage === 'function') {
            showPage('provisioning');
        } else {
            console.warn('showPage function not available');
        }
    }
    
    // Update notification badge
    updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }
    
    // Clear unread count
    clearUnreadCount() {
        this.unreadCount = 0;
        this.updateBadge();
    }
    
    // Get current status
    getStatus() {
        return {
            isRunning: this.pollInterval !== null,
            unreadCount: this.unreadCount,
            settings: this.settings,
            lastCheck: this.lastCheckTimestamp,
            permissionGranted: Notification.permission === 'granted'
        };
    }
}

// Create global instance
const notificationManager = new NotificationManager();

// Auto-start on page load if settings are enabled
window.addEventListener('DOMContentLoaded', () => {
    const settings = notificationManager.loadSettings();
    if (settings.inBrowserEnabled || settings.desktopEnabled) {
        // Start after a short delay to ensure page is fully loaded
        setTimeout(() => {
            notificationManager.start();
        }, 2000);
    }
});

// Stop polling when page is about to unload
window.addEventListener('beforeunload', () => {
    notificationManager.stop();
});

