import api from './api';

/**
 * Provisioning Service
 * Handles all API calls related to provisioning requests, customer products, and product removals
 */

// Get provisioning requests with filters and pagination
export const getProvisioningRequests = async (filters = {}) => {
  try {
    const params = {
      requestType: filters.requestType,
      accountId: filters.accountId,
      status: filters.status,
      search: filters.search,
      pageSize: filters.pageSize || 25,
      offset: filters.offset || 0
    };

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    const response = await api.get('/provisioning/requests', { params });
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching requests:', error);
    throw error;
  }
};

// Get filter options for provisioning
export const getProvisioningFilterOptions = async () => {
  try {
    const response = await api.get('/provisioning/filter-options');
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching filter options:', error);
    throw error;
  }
};

// Search for accounts or requests (type-ahead)
export const searchProvisioning = async (searchTerm, limit = 20) => {
  try {
    const response = await api.get('/provisioning/search', {
      params: { q: searchTerm, limit }
    });
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error searching:', error);
    throw error;
  }
};

// Get specific provisioning request by ID
export const getProvisioningRequestById = async (id) => {
  try {
    const response = await api.get(`/provisioning/requests/${id}`);
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching request:', error);
    throw error;
  }
};

// Get customer products for an account
export const getCustomerProducts = async (accountName) => {
  try {
    const response = await api.get('/customer-products', {
      params: { account: accountName }
    });
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching customer products:', error);
    throw error;
  }
};

// Get provisioning requests with product removals
export const getProvisioningWithRemovals = async (timeFrame = '1w') => {
  try {
    const response = await api.get('/provisioning/removals', {
      params: { timeFrame }
    });
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching removals:', error);
    throw error;
  }
};

// Get new provisioning records since timestamp
export const getNewProvisioningRecords = async (since) => {
  try {
    const response = await api.get('/provisioning/new-records', {
      params: { since }
    });
    return response.data;
  } catch (error) {
    console.error('[ProvisioningService] Error fetching new records:', error);
    throw error;
  }
};



























