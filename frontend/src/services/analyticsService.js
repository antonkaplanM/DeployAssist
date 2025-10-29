import api from './api';

/**
 * Analytics Service
 * Fetches analytics data for Technical Team Requests
 */

// Get request types analytics (counts and validation failures)
export const getRequestTypesAnalytics = async (months = 12) => {
  try {
    // Get enabled rules from validation engine (simplified - in real app would come from settings)
    const enabledRules = [
      'app-quantity-validation',
      'entitlement-date-overlap-validation',
      'entitlement-date-gap-validation',
      'app-package-name-validation'
    ];

    const response = await api.get('/analytics/request-types-week', {
      params: {
        months,
        enabledRules: JSON.stringify(enabledRules)
      }
    });
    return response.data;
  } catch (error) {
    console.error('[AnalyticsService] Error fetching request types analytics:', error);
    throw error;
  }
};

// Get validation failure trend data
export const getValidationTrend = async (months = 12) => {
  try {
    const enabledRules = [
      'app-quantity-validation',
      'entitlement-date-overlap-validation',
      'entitlement-date-gap-validation',
      'app-package-name-validation'
    ];

    const response = await api.get('/analytics/validation-trend', {
      params: {
        months,
        enabledRules: JSON.stringify(enabledRules)
      }
    });
    return response.data;
  } catch (error) {
    console.error('[AnalyticsService] Error fetching validation trend:', error);
    throw error;
  }
};

// Get weekly provisioning completion times
export const getCompletionTimes = async () => {
  try {
    const response = await api.get('/analytics/completion-times');
    return response.data;
  } catch (error) {
    console.error('[AnalyticsService] Error fetching completion times:', error);
    throw error;
  }
};

