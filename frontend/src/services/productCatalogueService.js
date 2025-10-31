/**
 * Product Catalogue Service
 * API client for fetching product data from Salesforce Product2 object
 */

import api from './api';

/**
 * Get products from the catalogue
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term for product name/code
 * @param {string} params.family - Filter by product family
 * @param {string} params.productGroup - Filter by product group
 * @param {string} params.productSelectionGrouping - Filter by product selection grouping
 * @param {boolean} params.isActive - Filter by active status
 * @param {number} params.limit - Max results per page
 * @param {number} params.offset - Pagination offset
 * @returns {Promise<Object>} Product catalogue data
 */
export async function getProductCatalogue(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.family && params.family !== 'all') queryParams.append('family', params.family);
    if (params.productGroup && params.productGroup !== 'all') queryParams.append('productGroup', params.productGroup);
    if (params.productSelectionGrouping && params.productSelectionGrouping !== 'all') queryParams.append('productSelectionGrouping', params.productSelectionGrouping);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);
    
    const url = `/product-catalogue?${queryParams.toString()}`;
    const response = await api.get(url);
    
    if (response.data.success) {
      return {
        success: true,
        products: response.data.products || [],
        count: response.data.count || 0,
        totalSize: response.data.totalSize || 0,
        done: response.data.done || true,
        filterOptions: response.data.filterOptions || { families: [] },
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch product catalogue');
    }
  } catch (error) {
    console.error('❌ Error fetching product catalogue:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch product catalogue',
      products: [],
      count: 0,
      totalSize: 0,
      filterOptions: { families: [] }
    };
  }
}

/**
 * Get a specific product by ID
 * @param {string} productId - Salesforce Product ID
 * @returns {Promise<Object>} Product details
 */
export async function getProductById(productId) {
  try {
    const response = await api.get(`/product-catalogue/${productId}`);
    
    if (response.data.success) {
      return {
        success: true,
        product: response.data.product,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Product not found');
    }
  } catch (error) {
    console.error('❌ Error fetching product:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch product',
      product: null
    };
  }
}

export default {
  getProductCatalogue,
  getProductById
};

