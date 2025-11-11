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

/**
 * Get packages associated with a product
 * @param {string} productCode - Product code
 * @returns {Promise<Object>} Associated packages
 */
export async function getPackagesForProduct(productCode) {
  try {
    const response = await api.get(`/products/${encodeURIComponent(productCode)}/packages`);
    
    if (response.data.success) {
      return {
        success: true,
        packages: response.data.packages || [],
        count: response.data.count || 0
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch packages for product');
    }
  } catch (error) {
    console.error('❌ Error fetching packages for product:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch packages for product',
      packages: [],
      count: 0
    };
  }
}

/**
 * Get regional bundles (products with multiple RI Subregion values)
 * @param {Object} params - Query parameters (same as getProductCatalogue)
 * @returns {Promise<Object>} Regional bundles data
 */
export async function getRegionalBundles(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.append('search', params.search);
    if (params.family && params.family !== 'all') queryParams.append('family', params.family);
    if (params.productGroup && params.productGroup !== 'all') queryParams.append('productGroup', params.productGroup);
    if (params.productSelectionGrouping && params.productSelectionGrouping !== 'all') queryParams.append('productSelectionGrouping', params.productSelectionGrouping);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);
    
    const url = `/product-catalogue/regional-bundles?${queryParams.toString()}`;
    const response = await api.get(url);
    
    if (response.data.success) {
      return {
        success: true,
        bundles: response.data.bundles || [],
        count: response.data.count || 0,
        totalSize: response.data.totalSize || 0,
        done: response.data.done || true,
        filterOptions: response.data.filterOptions || { families: [] },
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch regional bundles');
    }
  } catch (error) {
    console.error('❌ Error fetching regional bundles:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch regional bundles',
      bundles: [],
      count: 0,
      totalSize: 0,
      filterOptions: { families: [] }
    };
  }
}

/**
 * Export product catalogue to Excel
 * Triggers a download of all products in Excel format
 * @returns {Promise<void>}
 */
export async function exportProductCatalogueToExcel() {
  try {
    console.log('🔵 Starting export to Excel...');
    
    // Make API call to get the Excel file
    const response = await api.get('/product-catalogue/export', {
      responseType: 'blob' // Important: tell axios to expect a binary file
    });

    console.log('🔵 Received response:', response.status, response.headers['content-type']);
    console.log('🔵 Blob size:', response.data.size, 'bytes');

    // Check if response is actually an error JSON
    if (response.data.type === 'application/json') {
      // The server returned JSON (likely an error) instead of Excel
      const text = await response.data.text();
      const errorData = JSON.parse(text);
      throw new Error(errorData.error || errorData.message || 'Server returned an error');
    }

    // Create a blob from the response
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    console.log('🔵 Created blob:', blob.size, 'bytes');

    // Create a temporary download link and trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with current date
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `Product_Catalogue_${timestamp}.xlsx`;
    
    console.log('🔵 Triggering download:', link.download);
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup with a slight delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log('🔵 Download cleanup complete');
    }, 100);

    return { success: true };
  } catch (error) {
    console.error('❌ Error exporting product catalogue:', error);
    console.error('❌ Error details:', error.response?.data, error.response?.status);
    
    // If the error response is a blob, try to read it as text
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        console.error('❌ Error response body:', text);
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Server error');
      } catch (parseError) {
        // If we can't parse it, throw the original error
        throw new Error(error.message || 'Failed to export product catalogue');
      }
    }
    
    throw new Error(
      error.response?.data?.message || error.message || 'Failed to export product catalogue'
    );
  }
}

export default {
  getProductCatalogue,
  getProductById,
  getPackagesForProduct,
  getRegionalBundles,
  exportProductCatalogueToExcel
};

