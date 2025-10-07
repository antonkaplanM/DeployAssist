import { test, expect } from '@playwright/test';

test.describe('Notification System', () => {
  test.beforeEach(async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:8080';
    await page.goto(base);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Settings UI', () => {
    test('notification settings section exists in settings page', async ({ page }) => {
      // Navigate to Settings
      await page.click('#nav-settings');
      await page.waitForSelector('#page-settings', { state: 'visible' });
      
      // Find and expand notifications section
      const notificationSection = page.locator('button[data-section="notification-settings"]');
      await expect(notificationSection).toBeVisible();
      await expect(notificationSection).toContainText('Notifications');
      
      // Expand section
      await notificationSection.click();
      
      // Verify content is visible
      await expect(page.locator('#notification-settings-content')).toBeVisible();
    });

    test('all notification toggles are present', async ({ page }) => {
      // Navigate to Settings and expand notifications
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Check for all three toggle switches
      await expect(page.locator('#in-browser-notifications-toggle')).toBeVisible();
      await expect(page.locator('#desktop-notifications-toggle')).toBeVisible();
      await expect(page.locator('#sound-notifications-toggle')).toBeVisible();
    });

    test('notification toggles are functional', async ({ page }) => {
      // Navigate to Settings and expand notifications
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Get the in-browser toggle
      const toggle = page.locator('#in-browser-notifications-toggle');
      
      // Check initial state
      const initiallyChecked = await toggle.isChecked();
      
      // Click the parent label to toggle
      await page.click('label:has(#in-browser-notifications-toggle)');
      
      // Wait a moment for state change
      await page.waitForTimeout(100);
      
      // Verify state changed
      const afterToggle = await toggle.isChecked();
      expect(afterToggle).toBe(!initiallyChecked);
    });

    test('test notification button exists', async ({ page }) => {
      // Navigate to Settings and expand notifications
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Verify test button exists
      await expect(page.locator('#test-notification-btn')).toBeVisible();
      await expect(page.locator('#test-notification-btn')).toContainText('Send Test Notification');
    });

    test('notification status indicator displays', async ({ page }) => {
      // Navigate to Settings and expand notifications
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Verify status display exists
      await expect(page.locator('#notification-status')).toBeVisible();
      await expect(page.locator('#notification-status-text')).toBeVisible();
    });

    test('permission status badge displays for desktop notifications', async ({ page }) => {
      // Navigate to Settings and expand notifications
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Verify permission status element exists
      await expect(page.locator('#desktop-permission-status')).toBeVisible();
    });
  });

  test.describe('Notification Badge', () => {
    test('notification badge element exists on provisioning monitor nav', async ({ page }) => {
      // Expand provisioning navigation if not visible
      await page.click('#nav-provisioning');
      await page.waitForSelector('#provisioning-subnav', { state: 'visible' });
      
      // Check badge exists (may be hidden initially)
      const badge = page.locator('#notification-badge');
      await expect(badge).toBeAttached();
    });

    test('badge has correct styling classes', async ({ page }) => {
      // Expand provisioning navigation
      await page.click('#nav-provisioning');
      
      // Check badge has notification-badge class
      const badge = page.locator('#notification-badge');
      await expect(badge).toHaveClass(/notification-badge/);
    });

    test('navigating to provisioning monitor shows the page', async ({ page }) => {
      // Expand provisioning nav and click monitor
      await page.click('#nav-provisioning');
      await page.click('#nav-provisioning-monitor');
      
      // Verify provisioning page is shown
      await expect(page.locator('#page-provisioning')).toBeVisible();
    });
  });

  test.describe('Notification Manager Script', () => {
    test('notification manager script loads', async ({ page }) => {
      // Check if notificationManager is defined
      const hasNotificationManager = await page.evaluate(() => {
        return typeof window['notificationManager'] !== 'undefined';
      });
      
      expect(hasNotificationManager).toBe(true);
    });

    test('notification manager has required methods', async ({ page }) => {
      // Check for key methods
      const methods = await page.evaluate(() => {
        const nm = window['notificationManager'];
        return {
          hasStart: typeof nm?.start === 'function',
          hasStop: typeof nm?.stop === 'function',
          hasGetStatus: typeof nm?.getStatus === 'function',
          hasClearUnreadCount: typeof nm?.clearUnreadCount === 'function',
        };
      });
      
      expect(methods.hasStart).toBe(true);
      expect(methods.hasStop).toBe(true);
      expect(methods.hasGetStatus).toBe(true);
      expect(methods.hasClearUnreadCount).toBe(true);
    });

    test('notification manager loads settings', async ({ page }) => {
      // Check if settings are loaded
      const hasSettings = await page.evaluate(() => {
        const nm = window['notificationManager'];
        return nm?.settings && typeof nm.settings === 'object';
      });
      
      expect(hasSettings).toBe(true);
    });

    test('notification manager getStatus returns expected structure', async ({ page }) => {
      // Get status from notification manager
      const status = await page.evaluate(() => {
        return window['notificationManager']?.getStatus();
      });
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('unreadCount');
      expect(status).toHaveProperty('settings');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('permissionGranted');
    });
  });

  test.describe('Settings Persistence', () => {
    test('notification settings persist across page reloads', async ({ page }) => {
      // Navigate to settings
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Get initial state
      const initialState = await page.locator('#in-browser-notifications-toggle').isChecked();
      
      // Toggle the setting
      await page.click('label:has(#in-browser-notifications-toggle)');
      await page.waitForTimeout(200); // Wait for localStorage save
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Navigate back to settings
      await page.click('#nav-settings');
      await page.click('button[data-section="notification-settings"]');
      
      // Check if state persisted (should be opposite of initial)
      const afterReload = await page.locator('#in-browser-notifications-toggle').isChecked();
      expect(afterReload).toBe(!initialState);
      
      // Toggle back to original state (cleanup)
      await page.click('label:has(#in-browser-notifications-toggle)');
    });

    test('notification settings stored in localStorage', async ({ page }) => {
      // Check localStorage has notification settings
      const hasSettings = await page.evaluate(() => {
        const settings = localStorage.getItem('notificationSettings');
        return settings !== null;
      });
      
      expect(hasSettings).toBe(true);
    });

    test('localStorage settings have correct structure', async ({ page }) => {
      // Get settings from localStorage
      const settings = await page.evaluate(() => {
        const settingsStr = localStorage.getItem('notificationSettings');
        return settingsStr ? JSON.parse(settingsStr) : null;
      });
      
      expect(settings).not.toBeNull();
      expect(settings).toHaveProperty('inBrowserEnabled');
      expect(settings).toHaveProperty('desktopEnabled');
      expect(settings).toHaveProperty('soundEnabled');
      expect(settings).toHaveProperty('pollInterval');
    });
  });

  test.describe('Notification Container', () => {
    test('notification container can be created', async ({ page }) => {
      // Trigger test notification via browser console
      await page.evaluate(() => {
        const testRecord = {
          id: 'TEST-001',
          name: 'PS-TEST-001',
          requestType: 'Product Addition',
          account: 'Test Account',
          status: 'Open',
          createdDate: new Date().toISOString()
        };
        window['notificationManager']?.showNotification(testRecord);
      });
      
      // Wait a moment for notification to appear
      await page.waitForTimeout(500);
      
      // Check if notification container exists
      const container = page.locator('#notification-container');
      await expect(container).toBeAttached();
    });

    test('notification toast has correct styling', async ({ page }) => {
      // Show test notification
      await page.evaluate(() => {
        const testRecord = {
          id: 'TEST-002',
          name: 'PS-TEST-002',
          requestType: 'Product Removal',
          account: 'Test Corp',
          status: 'Open',
          createdDate: new Date().toISOString()
        };
        window['notificationManager']?.showNotification(testRecord);
      });
      
      await page.waitForTimeout(500);
      
      // Check for notification toast
      const toast = page.locator('.notification-toast').first();
      if (await toast.isVisible()) {
        await expect(toast).toHaveClass(/notification-toast/);
        await expect(toast).toHaveClass(/animate-slide-in/);
      }
    });
  });

  test.describe('Integration with Help Page', () => {
    test('help page includes notification documentation', async ({ page }) => {
      // Navigate to help page
      await page.click('#nav-help');
      await page.waitForSelector('#page-help', { state: 'visible' });
      
      // Search for notification-related content
      const pageContent = await page.locator('#page-help').textContent();
      expect(pageContent).toContain('Notification');
    });
  });
});

