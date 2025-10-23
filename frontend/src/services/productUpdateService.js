// Product Update Service
// API service for product update workflow

import api from './api';

/**
 * Get all product update options for dropdowns
 * @returns {Promise<Object>} All options organized by type
 */
export async function getAllProductOptions() {
    try {
        const response = await api.get('/product-update/options');
        return response.data;
    } catch (error) {
        console.error('Error fetching product options:', error);
        throw error;
    }
}

/**
 * Get specific product update options
 * @param {string} type - Option type (package, product, modifier, region)
 * @param {string} category - Optional category (models, data, apps)
 * @returns {Promise<Object>} Options data
 */
export async function getProductOptions(type, category = null) {
    try {
        const params = { type };
        if (category) params.category = category;
        
        const response = await api.get('/product-update/options', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching product options:', error);
        throw error;
    }
}

/**
 * Create a new product update request
 * @param {Object} requestData - Request details
 * @returns {Promise<Object>} Created request
 */
export async function createProductUpdateRequest(requestData) {
    try {
        const response = await api.post('/product-update/requests', requestData);
        return response.data;
    } catch (error) {
        console.error('Error creating product update request:', error);
        throw error;
    }
}

/**
 * Get pending product update requests
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} List of requests
 */
export async function getPendingProductUpdateRequests(filters = {}) {
    try {
        const response = await api.get('/product-update/requests', { params: filters });
        return response.data;
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        throw error;
    }
}

/**
 * Get a specific product update request
 * @param {string} identifier - Request ID or number
 * @returns {Promise<Object>} Request details
 */
export async function getProductUpdateRequest(identifier) {
    try {
        const response = await api.get(`/product-update/requests/${identifier}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching request:', error);
        throw error;
    }
}

/**
 * Update product update request status
 * @param {string} identifier - Request ID or number
 * @param {string} status - New status
 * @param {Object} updateData - Additional update data
 * @returns {Promise<Object>} Updated request
 */
export async function updateProductUpdateRequestStatus(identifier, status, updateData = {}) {
    try {
        const response = await api.patch(`/product-update/requests/${identifier}/status`, {
            status,
            ...updateData
        });
        return response.data;
    } catch (error) {
        console.error('Error updating request status:', error);
        throw error;
    }
}

/**
 * Delete a product update request
 * @param {string} identifier - Request ID or number
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteProductUpdateRequest(identifier) {
    try {
        const response = await api.delete(`/product-update/requests/${identifier}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting request:', error);
        throw error;
    }
}

/**
 * Get product update request history
 * @param {string} identifier - Request ID or number
 * @returns {Promise<Object>} Request history
 */
export async function getProductUpdateRequestHistory(identifier) {
    try {
        const response = await api.get(`/product-update/requests/${identifier}/history`);
        return response.data;
    } catch (error) {
        console.error('Error fetching request history:', error);
        throw error;
    }
}

/**
 * Refresh product options from PS audit trail
 * @returns {Promise<Object>} Refresh result
 */
export async function refreshProductOptions() {
    try {
        const response = await api.post('/product-update/options/refresh');
        return response.data;
    } catch (error) {
        console.error('Error refreshing product options:', error);
        throw error;
    }
}

