import api from './api';

const settingsService = {
  // Web Connectivity Test - Comprehensive testing of multiple endpoints
  testWebConnectivity: async () => {
    const endpoints = [
      { name: 'Google DNS', url: 'https://dns.google', type: 'DNS Service' },
      { name: 'Cloudflare CDN', url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js', type: 'CDN' },
      { name: 'GitHub API', url: 'https://api.github.com', type: 'API Service' },
      { name: 'NPM Registry', url: 'https://registry.npmjs.org', type: 'Package Registry' },
    ];

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const endpoint of endpoints) {
      const startTime = performance.now();
      try {
        const response = await fetch(endpoint.url, {
          method: 'HEAD',
          mode: 'no-cors', // Avoid CORS issues for simple connectivity test
          cache: 'no-cache',
        });
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        // In no-cors mode, we can't read the response, but if fetch succeeds, connection works
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          type: endpoint.type,
          status: 'success',
          duration: `${duration}ms`,
          message: 'Connection successful',
        });
        successCount++;
      } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          type: endpoint.type,
          status: 'failed',
          duration: `${duration}ms`,
          message: error.message || 'Connection failed',
        });
        failureCount++;
      }
    }

    return {
      overall: successCount === endpoints.length ? 'success' : successCount > 0 ? 'partial' : 'failed',
      summary: `${successCount}/${endpoints.length} endpoints reachable`,
      successCount,
      failureCount,
      totalTests: endpoints.length,
      results,
      timestamp: new Date().toISOString(),
    };
  },

  // Salesforce Integration Test
  testSalesforceConnection: async () => {
    try {
      const response = await api.get('/test/salesforce');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // SML Configuration
  saveSMLConfig: async (environment, bearerToken) => {
    try {
      const response = await api.post('/sml/config', {
        environment,
        authCookie: bearerToken,  // Backend expects 'authCookie', not 'bearerToken'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSMLConfig: async () => {
    try {
      const response = await api.get('/sml/config');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  testSMLConnection: async () => {
    try {
      const response = await api.get('/sml/test-connection');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // SML Token Status - Get detailed token status
  getSMLTokenStatus: async () => {
    try {
      const response = await api.get('/sml/token/status');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // SML Token Refresh - Trigger Playwright-based token refresh
  refreshSMLToken: async () => {
    try {
      const response = await api.post('/sml/token/refresh');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // LLM / AI Configuration (stored encrypted on the server)
  getLLMSettings: async () => {
    try {
      const response = await api.get('/user-settings/llm');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  saveLLMSettings: async ({ apiKey, model }) => {
    try {
      const response = await api.put('/user-settings/llm', { apiKey, model });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteLLMSettings: async () => {
    try {
      const response = await api.delete('/user-settings/llm');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  testLLMKey: async () => {
    try {
      const response = await api.post('/user-settings/llm/test');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Application Settings (stored in localStorage)
  getAppSettings: () => {
    const defaults = {
      theme: localStorage.getItem('theme') || 'light',
      autoRefreshInterval: parseInt(localStorage.getItem('autoRefreshInterval')) || 5,
      defaultAnalyticsTimeframe: parseInt(localStorage.getItem('defaultAnalyticsTimeframe')) || 3,
      defaultExpirationTimeframe: parseInt(localStorage.getItem('defaultExpirationTimeframe')) || 90,
      defaultPackageChangesTimeframe: parseInt(localStorage.getItem('defaultPackageChangesTimeframe')) || 30,
      defaultDashboardValidationTimeframe: localStorage.getItem('defaultDashboardValidationTimeframe') || '1w',
      defaultDashboardRemovalsTimeframe: localStorage.getItem('defaultDashboardRemovalsTimeframe') || '1w',
      defaultDashboardExpirationWindow: parseInt(localStorage.getItem('defaultDashboardExpirationWindow')) || 7,
    };
    return defaults;
  },

  saveAppSettings: (settings) => {
    Object.entries(settings).forEach(([key, value]) => {
      localStorage.setItem(key, value.toString());
    });
    
    // Apply theme immediately if changed
    if (settings.theme) {
      const html = document.documentElement;
      if (settings.theme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
    
    return settings;
  },
};

export default settingsService;

