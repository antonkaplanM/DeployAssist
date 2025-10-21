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
    const response = await api.get('/validation/errors', {
      params: {
        timeFrame,
        enabledRules: JSON.stringify(enabledRules)
      }
    });
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching validation errors:', error);
    throw error;
  }
};

// Get PS requests with product removals
export const getRemovalsData = async (timeFrame = '1w') => {
  try {
    const response = await api.get('/provisioning/removals', {
      params: { timeFrame }
    });
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching removals:', error);
    throw error;
  }
};

// Get expiration monitor data
export const getExpirationData = async (expirationWindow = 7) => {
  try {
    const response = await api.get('/expiration/monitor', {
      params: {
        expirationWindow,
        showExtended: false
      }
    });
    return response.data;
  } catch (error) {
    console.error('[DashboardService] Error fetching expiration data:', error);
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

