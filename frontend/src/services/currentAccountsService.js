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
    updateComments,
    exportAccounts
};



