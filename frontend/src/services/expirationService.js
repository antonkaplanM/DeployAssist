import api from './api';

/**
 * Expiration Service
 * Handles all API calls related to expiration monitoring
 */

// Get expiration monitor data
export const getExpirationMonitor = async (expirationWindow = 30, showExtended = false) => {
  try {
    const params = {
      expirationWindow,
      showExtended
    };

    const response = await api.get('/expiration/monitor', { params });
    return response.data;
  } catch (error) {
    console.error('[ExpirationService] Error fetching expiration monitor:', error);
    throw error;
  }
};

// Refresh expiration analysis
export const refreshExpirationAnalysis = async (lookbackYears = 5, expirationWindow = 30) => {
  try {
    const response = await api.post('/expiration/refresh', {
      lookbackYears,
      expirationWindow
    });
    return response.data;
  } catch (error) {
    console.error('[ExpirationService] Error refreshing expiration analysis:', error);
    throw error;
  }
};

// Get expiration analysis status
export const getExpirationStatus = async () => {
  try {
    const response = await api.get('/expiration/status');
    return response.data;
  } catch (error) {
    console.error('[ExpirationService] Error fetching expiration status:', error);
    throw error;
  }
};

export default {
  getExpirationMonitor,
  refreshExpirationAnalysis,
  getExpirationStatus,
};

