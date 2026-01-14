/**
 * Current Accounts Service
 * Frontend API service for the Current Accounts analytics page
 */

import api from './api';

/**
 * Get current accounts with pagination and sorting
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Accounts and pagination info
 */
export const getCurrentAccounts = async (params = {}) => {
    try {
        const {
            page = 1,
            pageSize = 50,
            sortBy = 'completion_date',
            sortOrder = 'DESC',
            includeRemoved = false,
            search = ''
        } = params;

        const response = await api.get('/current-accounts', {
            params: {
                page,
                pageSize,
                sortBy,
                sortOrder,
                includeRemoved: includeRemoved.toString(),
                search
            }
        });

        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error fetching accounts:', error);
        throw error;
    }
};

/**
 * Get sync status and statistics
 * @returns {Promise<Object>} Sync status info
 */
export const getSyncStatus = async () => {
    try {
        const response = await api.get('/current-accounts/sync-status');
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error fetching sync status:', error);
        throw error;
    }
};

/**
 * Trigger a manual sync of current accounts data
 * @returns {Promise<Object>} Sync result
 */
export const triggerSync = async () => {
    try {
        const response = await api.post('/current-accounts/sync');
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error triggering sync:', error);
        
        // Handle SML token expiration (503 with SML_TOKEN_EXPIRED)
        if (error.response?.status === 503 && error.response?.data?.errorCode === 'SML_TOKEN_EXPIRED') {
            return {
                success: false,
                tokenExpired: true,
                error: error.response.data.error,
                errorCode: 'SML_TOKEN_EXPIRED',
                resolution: error.response.data.resolution || 'Please refresh your SML token in Settings → SML Configuration'
            };
        }
        
        throw error;
    }
};

/**
 * Trigger a quick sync - only adds new tenants that don't exist
 * Faster than full sync as it skips updating existing records
 * @returns {Promise<Object>} Sync result
 */
export const triggerQuickSync = async () => {
    try {
        const response = await api.post('/current-accounts/quick-sync');
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error triggering quick sync:', error);
        
        // Handle SML token expiration (503 with SML_TOKEN_EXPIRED)
        if (error.response?.status === 503 && error.response?.data?.errorCode === 'SML_TOKEN_EXPIRED') {
            return {
                success: false,
                tokenExpired: true,
                error: error.response.data.error,
                errorCode: 'SML_TOKEN_EXPIRED',
                resolution: error.response.data.resolution || 'Please refresh your SML token in Settings → SML Configuration'
            };
        }
        
        throw error;
    }
};

/**
 * Update comments for a specific account row
 * @param {number} id - Row ID
 * @param {string} comments - New comments value
 * @returns {Promise<Object>} Update result
 */
export const updateComments = async (id, comments) => {
    try {
        const response = await api.patch(`/current-accounts/${id}/comments`, {
            comments
        });
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error updating comments:', error);
        throw error;
    }
};

/**
 * Publish current accounts to Confluence
 * @param {string} spaceKey - Confluence space key (optional, uses default)
 * @param {string} pageTitle - Page title (optional, defaults to 'Current Accounts')
 * @returns {Promise<Object>} Publish result with page URL
 */
export const publishToConfluence = async (spaceKey = null, pageTitle = 'Current Accounts') => {
    try {
        const response = await api.post('/current-accounts/publish-to-confluence', {
            spaceKey,
            pageTitle
        });
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error publishing to Confluence:', error);
        
        // Extract error message from response
        const errorMessage = error.response?.data?.error || error.message || 'Failed to publish to Confluence';
        throw new Error(errorMessage);
    }
};

/**
 * Export current accounts data as CSV
 * @param {boolean} includeRemoved - Whether to include removed records
 * @returns {Promise<Blob>} CSV file blob
 */
export const exportAccounts = async (includeRemoved = false) => {
    try {
        const response = await api.get('/current-accounts/export', {
            params: { includeRemoved: includeRemoved.toString() },
            responseType: 'blob'
        });
        return response.data;
    } catch (error) {
        console.error('[CurrentAccountsService] Error exporting accounts:', error);
        throw error;
    }
};

export default {
    getCurrentAccounts,
    getSyncStatus,
    triggerSync,
    triggerQuickSync,
    updateComments,
    publishToConfluence,
    exportAccounts
};



