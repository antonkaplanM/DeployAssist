/**
 * Bundle Service
 * API client for bundle management functionality
 */

import api from './api';

/**
 * Get all bundles
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term for bundle name/description
 * @param {string} params.sortBy - Sort field ('name' or 'created_at')
 * @param {string} params.sortOrder - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} Bundles data
 */
export async function getBundles(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `/bundles?${queryParams.toString()}`;
    const response = await api.get(url);
    
    if (response.data.success) {
      return {
        success: true,
        bundles: response.data.bundles || [],
        count: response.data.count || 0,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch bundles');
    }
  } catch (error) {
    console.error('❌ Error fetching bundles:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch bundles',
      bundles: [],
      count: 0
    };
  }
}

/**
 * Get a specific bundle by ID with its products
 * @param {string} bundleId - Bundle ID (e.g., 'BUNDLE-001')
 * @returns {Promise<Object>} Bundle details with products
 */
export async function getBundleById(bundleId) {
  try {
    const response = await api.get(`/bundles/${bundleId}`);
    
    if (response.data.success) {
      return {
        success: true,
        bundle: response.data.bundle,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Bundle not found');
    }
  } catch (error) {
    console.error('❌ Error fetching bundle:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch bundle',
      bundle: null
    };
  }
}

/**
 * Create a new bundle
 * @param {Object} bundleData - Bundle data
 * @param {string} bundleData.name - Bundle name
 * @param {string} bundleData.description - Bundle description
 * @returns {Promise<Object>} Created bundle data
 */
export async function createBundle(bundleData) {
  try {
    const response = await api.post('/bundles', bundleData);
    
    if (response.data.success) {
      return {
        success: true,
        bundle: response.data.bundle,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to create bundle');
    }
  } catch (error) {
    console.error('❌ Error creating bundle:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create bundle',
      bundle: null
    };
  }
}

/**
 * Update a bundle
 * @param {string} bundleId - Bundle ID
 * @param {Object} bundleData - Updated bundle data
 * @param {string} bundleData.name - Bundle name
 * @param {string} bundleData.description - Bundle description
 * @returns {Promise<Object>} Updated bundle data
 */
export async function updateBundle(bundleId, bundleData) {
  try {
    const response = await api.put(`/bundles/${bundleId}`, bundleData);
    
    if (response.data.success) {
      return {
        success: true,
        bundle: response.data.bundle,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to update bundle');
    }
  } catch (error) {
    console.error('❌ Error updating bundle:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update bundle',
      bundle: null
    };
  }
}

/**
 * Delete a bundle
 * @param {string} bundleId - Bundle ID
 * @returns {Promise<Object>} Success status
 */
export async function deleteBundle(bundleId) {
  try {
    const response = await api.delete(`/bundles/${bundleId}`);
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to delete bundle');
    }
  } catch (error) {
    console.error('❌ Error deleting bundle:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete bundle'
    };
  }
}

/**
 * Duplicate a bundle
 * @param {string} bundleId - Bundle ID to duplicate
 * @param {string} newName - Name for the new bundle
 * @returns {Promise<Object>} Created bundle data
 */
export async function duplicateBundle(bundleId, newName) {
  try {
    const response = await api.post(`/bundles/${bundleId}/duplicate`, { name: newName });
    
    if (response.data.success) {
      return {
        success: true,
        bundle: response.data.bundle,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to duplicate bundle');
    }
  } catch (error) {
    console.error('❌ Error duplicating bundle:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to duplicate bundle',
      bundle: null
    };
  }
}

/**
 * Add products to a bundle
 * @param {string} bundleId - Bundle ID
 * @param {Array} products - Array of products to add [{productId, quantity}, ...]
 * @returns {Promise<Object>} Success status
 */
export async function addProductsToBundle(bundleId, products) {
  try {
    const response = await api.post(`/bundles/${bundleId}/products`, { products });
    
    if (response.data.success) {
      return {
        success: true,
        addedProducts: response.data.addedProducts,
        count: response.data.count,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to add products to bundle');
    }
  } catch (error) {
    console.error('❌ Error adding products to bundle:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to add products to bundle'
    };
  }
}

/**
 * Update product quantity in bundle
 * @param {string} bundleId - Bundle ID
 * @param {string} productId - Product Salesforce ID
 * @param {number} quantity - New quantity
 * @returns {Promise<Object>} Success status
 */
export async function updateProductQuantity(bundleId, productId, quantity) {
  try {
    const response = await api.put(`/bundles/${bundleId}/products/${productId}`, { quantity });
    
    if (response.data.success) {
      return {
        success: true,
        product: response.data.product,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to update product quantity');
    }
  } catch (error) {
    console.error('❌ Error updating product quantity:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update product quantity'
    };
  }
}

/**
 * Remove a product from bundle
 * @param {string} bundleId - Bundle ID
 * @param {string} productId - Product Salesforce ID
 * @returns {Promise<Object>} Success status
 */
export async function removeProductFromBundle(bundleId, productId) {
  try {
    const response = await api.delete(`/bundles/${bundleId}/products/${productId}`);
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to remove product from bundle');
    }
  } catch (error) {
    console.error('❌ Error removing product from bundle:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to remove product from bundle'
    };
  }
}

export default {
  getBundles,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  duplicateBundle,
  addProductsToBundle,
  updateProductQuantity,
  removeProductFromBundle
};


