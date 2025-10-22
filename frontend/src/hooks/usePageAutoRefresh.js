import { useEffect } from 'react';
import { useAutoRefresh } from '../context/AutoRefreshContext';

/**
 * Hook to register a page for auto-refresh
 * @param {string} pageId - Unique identifier for the page
 * @param {function} refreshCallback - Function to call when page should refresh
 * @param {boolean} enabled - Whether auto-refresh is enabled for this page (default: true)
 */
export const usePageAutoRefresh = (pageId, refreshCallback, enabled = true) => {
  const { registerRefreshCallback, autoRefreshInterval } = useAutoRefresh();

  useEffect(() => {
    if (!enabled || autoRefreshInterval === 0) {
      return;
    }

    console.log(`[usePageAutoRefresh] Registering ${pageId} for auto-refresh`);
    const unregister = registerRefreshCallback(pageId, refreshCallback);

    return () => {
      console.log(`[usePageAutoRefresh] Unregistering ${pageId} from auto-refresh`);
      unregister();
    };
  }, [pageId, refreshCallback, enabled, registerRefreshCallback, autoRefreshInterval]);
};

