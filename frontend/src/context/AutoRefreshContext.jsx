import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const AutoRefreshContext = createContext();

export const useAutoRefresh = () => {
  const context = useContext(AutoRefreshContext);
  if (!context) {
    throw new Error('useAutoRefresh must be used within AutoRefreshProvider');
  }
  return context;
};

export const AutoRefreshProvider = ({ children }) => {
  const location = useLocation();
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5); // minutes
  const [lastRefreshTimes, setLastRefreshTimes] = useState({});
  const refreshCallbacksRef = useRef({});
  const timerRef = useRef(null);

  // Get current page ID from location
  const getCurrentPageId = useCallback(() => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/analytics/account-history')) return 'account-history';
    if (path.startsWith('/analytics/package-changes')) return 'package-changes';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/provisioning/expiration')) return 'expiration';
    if (path.startsWith('/provisioning/ghost-accounts')) return 'ghost-accounts';
    if (path.startsWith('/provisioning/customer-products')) return 'customer-products';
    if (path.startsWith('/provisioning')) return 'provisioning';
    if (path.startsWith('/ps-audit-trail')) return 'ps-audit-trail';
    return null;
  }, [location.pathname]);

  // Load auto-refresh interval from localStorage
  useEffect(() => {
    const savedInterval = localStorage.getItem('autoRefreshInterval');
    if (savedInterval) {
      setAutoRefreshInterval(parseInt(savedInterval));
    }
  }, []);

  // Register a page's refresh callback
  const registerRefreshCallback = useCallback((pageId, callback) => {
    console.log(`[AutoRefresh] Registering refresh callback for page: ${pageId}`);
    refreshCallbacksRef.current[pageId] = callback;

    // Cleanup function
    return () => {
      console.log(`[AutoRefresh] Unregistering refresh callback for page: ${pageId}`);
      delete refreshCallbacksRef.current[pageId];
    };
  }, []);

  // Update auto-refresh interval
  const updateAutoRefreshInterval = useCallback((interval) => {
    console.log(`[AutoRefresh] Updating interval to: ${interval} minutes`);
    setAutoRefreshInterval(interval);
    localStorage.setItem('autoRefreshInterval', interval.toString());
  }, []);

  // Refresh inactive pages
  const refreshInactivePages = useCallback(() => {
    const currentPageId = getCurrentPageId();
    console.log(`[AutoRefresh] Timer triggered - Current page: ${currentPageId}`);

    // Pages that should support auto-refresh
    const dataPages = [
      'dashboard',
      'analytics',
      'account-history',
      'package-changes',
      'provisioning',
      'expiration',
      'ghost-accounts',
      'customer-products',
      'ps-audit-trail'
    ];

    // Refresh all registered pages EXCEPT the current one
    dataPages.forEach(pageId => {
      if (pageId !== currentPageId && refreshCallbacksRef.current[pageId]) {
        console.log(`[AutoRefresh] Refreshing inactive page: ${pageId}`);
        try {
          refreshCallbacksRef.current[pageId]();
          setLastRefreshTimes(prev => ({
            ...prev,
            [pageId]: new Date().toISOString()
          }));
        } catch (error) {
          console.error(`[AutoRefresh] Error refreshing ${pageId}:`, error);
        }
      } else if (pageId === currentPageId) {
        console.log(`[AutoRefresh] Skipping active page: ${pageId}`);
      }
    });
  }, [getCurrentPageId]);

  // Set up the auto-refresh timer
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Don't start timer if interval is 0 (Never)
    if (autoRefreshInterval === 0) {
      console.log('[AutoRefresh] Auto-refresh disabled (interval set to Never)');
      return;
    }

    // Start new timer
    const intervalMs = autoRefreshInterval * 60 * 1000; // Convert minutes to milliseconds
    console.log(`[AutoRefresh] Starting timer with ${autoRefreshInterval} minute interval`);
    
    timerRef.current = setInterval(refreshInactivePages, intervalMs);

    // Cleanup on unmount or interval change
    return () => {
      if (timerRef.current) {
        console.log('[AutoRefresh] Clearing timer');
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefreshInterval, refreshInactivePages]);

  const value = {
    autoRefreshInterval,
    updateAutoRefreshInterval,
    registerRefreshCallback,
    lastRefreshTimes,
    currentPageId: getCurrentPageId(),
  };

  return (
    <AutoRefreshContext.Provider value={value}>
      {children}
    </AutoRefreshContext.Provider>
  );
};

