// Global reference to toast function (set by React component)
let globalShowToast = null;

const notificationService = {
  // Set the toast function from React context
  setToastFunction: (showToastFn) => {
    globalShowToast = showToastFn;
  },

  // Load notification settings from localStorage
  getSettings: () => {
    const defaultSettings = {
      inBrowserEnabled: true,
      desktopEnabled: true,
      soundEnabled: true,
      pollInterval: 60000, // 60 seconds
    };

    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
    return defaultSettings;
  },

  // Save notification settings to localStorage
  saveSettings: (settings) => {
    const current = notificationService.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
    return updated;
  },

  // Request browser notification permission
  requestPermission: async () => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Check notification permission status
  getPermissionStatus: () => {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  // Show a test notification
  showTestNotification: () => {
    const settings = notificationService.getSettings();

    // In-browser notification (toast)
    if (settings.inBrowserEnabled) {
      if (globalShowToast) {
        globalShowToast({
          title: 'Test Notification',
          message: 'This is a test notification from Deployment Assistant. All systems are working correctly!',
          duration: 10000,
        });
      } else {
        console.warn('Toast function not set - in-browser notification skipped');
      }
    }

    // Desktop notification
    if (settings.desktopEnabled && Notification.permission === 'granted') {
      new Notification('Test Notification', {
        body: 'This is a test notification from Deployment Assistant',
        icon: '/favicon.svg',
        tag: 'test-notification',
      });
    }

    // Sound notification
    if (settings.soundEnabled) {
      notificationService.playNotificationSound();
    }
  },

  // Show a notification (can be called with custom data)
  showNotification: ({ title, message, actionLabel, onAction }) => {
    const settings = notificationService.getSettings();

    // In-browser notification (toast)
    if (settings.inBrowserEnabled && globalShowToast) {
      globalShowToast({
        title,
        message,
        duration: 10000,
        actionLabel,
        onAction,
      });
    }

    // Desktop notification
    if (settings.desktopEnabled && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.svg',
        tag: 'ps-notification',
      });

      if (onAction) {
        notification.onclick = () => {
          window.focus();
          onAction();
          notification.close();
        };
      }
    }

    // Sound notification
    if (settings.soundEnabled) {
      notificationService.playNotificationSound();
    }
  },

  // Play notification sound
  playNotificationSound: () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  },
};

export default notificationService;

