import api from './api';

/**
 * Dashboard Service
 * Fetches data for all dashboard widgets
 */

// Get validation errors
export const getValidationErrors = async (timeFrame = '1d', enabledRules = [
  'app-quantity-validation',
  'entitlement-date-overlap-validation',
  'entitlement-date-gap-validation',
  'app-package-name-validation'
]) => {
  try {
    console.log('[DashboardService] Fetching validation errors with timeFrame:', timeFrame);
    const response = await api.get('/validation/errors', {
      params: {
        timeFrame,
        enabledRules: JSON.stringify(enabledRules)
      }
    });
    console.log('[DashboardService] Validation errors response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching validation errors:', error);
    console.error('[DashboardService] Error details:', error.response?.data || error.message);
    throw error;
  }
};

// Get PS requests with product removals
export const getRemovalsData = async (timeFrame = '1w') => {
  try {
    console.log('[DashboardService] Fetching removals with timeFrame:', timeFrame);
    const response = await api.get('/provisioning/removals', {
      params: { timeFrame }
    });
    console.log('[DashboardService] Removals response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching removals:', error);
    console.error('[DashboardService] Error details:', error.response?.data || error.message);
    throw error;
  }
};

// Get expiration monitor data
export const getExpirationData = async (expirationWindow = 7) => {
  try {
    console.log('[DashboardService] Fetching expiration data with window:', expirationWindow);
    const response = await api.get('/expiration/monitor', {
      params: {
        expirationWindow,
        showExtended: false
      }
    });
    console.log('[DashboardService] Expiration response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching expiration data:', error);
    console.error('[DashboardService] Error details:', error.response?.data || error.message);
    throw error;
  }
};

// Get all dashboard data at once
export const getDashboardData = async () => {
  try {
    const [validation, removals, expiration] = await Promise.allSettled([
      getValidationErrors(),
      getRemovalsData(),
      getExpirationData()
    ]);

    return {
      validation: validation.status === 'fulfilled' ? validation.value : null,
      validationError: validation.status === 'rejected' ? validation.reason : null,
      removals: removals.status === 'fulfilled' ? removals.value : null,
      removalsError: removals.status === 'rejected' ? removals.reason : null,
      expiration: expiration.status === 'fulfilled' ? expiration.value : null,
      expirationError: expiration.status === 'rejected' ? expiration.reason : null
    };
  } catch (error) {
    console.error('[DashboardService] Error fetching dashboard data:', error);
    throw error;
  }
};

