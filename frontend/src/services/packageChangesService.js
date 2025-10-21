import api from './api';

/**
 * Package Changes Service
 * Handles all API calls related to package change analytics
 */

// Get package changes summary
export const getPackageChangesSummary = async (timeFrame = '1y') => {
  try {
    const response = await api.get('/analytics/package-changes/summary', {
      params: { timeFrame }
    });
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error fetching summary:', error);
    throw error;
  }
};

// Get package changes by product
export const getPackageChangesByProduct = async (timeFrame = '1y') => {
  try {
    const response = await api.get('/analytics/package-changes/by-product', {
      params: { timeFrame }
    });
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error fetching by product:', error);
    throw error;
  }
};

// Get package changes by account
export const getPackageChangesByAccount = async (timeFrame = '1y') => {
  try {
    const response = await api.get('/analytics/package-changes/by-account', {
      params: { timeFrame }
    });
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error fetching by account:', error);
    throw error;
  }
};

// Get recent package changes
export const getRecentPackageChanges = async (limit = 20) => {
  try {
    const response = await api.get('/analytics/package-changes/recent', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error fetching recent changes:', error);
    throw error;
  }
};

// Refresh package changes analysis
export const refreshPackageChangesAnalysis = async (lookbackYears = 5) => {
  try {
    const response = await api.post('/analytics/package-changes/refresh', {
      lookbackYears
    });
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error refreshing analysis:', error);
    throw error;
  }
};

// Get analysis status
export const getAnalysisStatus = async () => {
  try {
    const response = await api.get('/analytics/package-changes/status');
    return response.data;
  } catch (error) {
    console.error('[PackageChangesService] Error fetching status:', error);
    throw error;
  }
};

// Export package changes data
export const exportPackageChanges = async (timeFrame = '1y') => {
  try {
    const response = await api.get('/analytics/package-changes/export', {
      params: { timeFrame },
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `package-changes-${timeFrame}-${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error('[PackageChangesService] Error exporting:', error);
    throw error;
  }
};

export default {
  getPackageChangesSummary,
  getPackageChangesByProduct,
  getPackageChangesByAccount,
  getRecentPackageChanges,
  refreshPackageChangesAnalysis,
  getAnalysisStatus,
  exportPackageChanges,
};

