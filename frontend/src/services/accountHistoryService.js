import api from './api';

/**
 * Account History Service
 * Handles account-specific provisioning request history
 */

// Search for accounts (reuses provisioning search)
export const searchAccounts = async (searchTerm) => {
  try {
    const response = await api.get('/provisioning/search', {
      params: { q: searchTerm, limit: 20 }
    });
    return response.data;
  } catch (error) {
    console.error('[AccountHistoryService] Error searching accounts:', error);
    throw error;
  }
};

// Get account provisioning request history
export const getAccountHistory = async (accountName, pageSize = 100) => {
  try {
    const response = await api.get('/provisioning/requests', {
      params: { 
        search: accountName,
        pageSize: pageSize
      }
    });
    
    return {
      success: true,
      requests: response.data.records || [],
      totalCount: response.data.totalCount || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[AccountHistoryService] Error fetching account history:', error);
    throw error;
  }
};

// Get product changes between two requests (for comparison)
export const compareRequests = async (request1Id, request2Id) => {
  try {
    // This would need a backend endpoint, for now return a client-side comparison
    const [req1, req2] = await Promise.all([
      api.get(`/provisioning/requests/${request1Id}`),
      api.get(`/provisioning/requests/${request2Id}`)
    ]);
    
    return {
      success: true,
      request1: req1.data,
      request2: req2.data
    };
  } catch (error) {
    console.error('[AccountHistoryService] Error comparing requests:', error);
    throw error;
  }
};

export default {
  searchAccounts,
  getAccountHistory,
  compareRequests,
};

