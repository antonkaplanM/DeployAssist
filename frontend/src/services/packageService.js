/**
 * Package Service
 * API client for fetching package data from Salesforce Package__c object
 */

import api from './api';

/**
 * Get packages from the catalogue
 * @param {Object} params - Query parameters
 * @param {string} params.type - Filter by package type (Base, Expansion)
 * @param {boolean} params.includeDeleted - Include deleted packages
 * @returns {Promise<Object>} Package catalogue data
 */
export async function getPackages(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.type && params.type !== 'all') queryParams.append('type', params.type);
    if (params.includeDeleted !== undefined) queryParams.append('includeDeleted', params.includeDeleted);
    
    const url = `/packages?${queryParams.toString()}`;
    const response = await api.get(url);
    
    if (response.data.success) {
      return {
        success: true,
        packages: response.data.packages || [],
        count: response.data.count || 0,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch packages');
    }
  } catch (error) {
    console.error('❌ Error fetching packages:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch packages',
      packages: [],
      count: 0
    };
  }
}

/**
 * Get a specific package by identifier (name, RI name, or Salesforce ID)
 * @param {string} identifier - Package identifier
 * @returns {Promise<Object>} Package details
 */
export async function getPackageByIdentifier(identifier) {
  try {
    const response = await api.get(`/packages/${encodeURIComponent(identifier)}`);
    
    if (response.data.success) {
      return {
        success: true,
        package: response.data.package,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Package not found');
    }
  } catch (error) {
    console.error('❌ Error fetching package:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch package',
      package: null
    };
  }
}

/**
 * Get package summary statistics
 * @returns {Promise<Object>} Package summary data
 */
export async function getPackageSummary() {
  try {
    const response = await api.get('/packages/summary/stats');
    
    if (response.data.success) {
      return {
        success: true,
        summary: response.data.summary,
        timestamp: response.data.timestamp
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch package summary');
    }
  } catch (error) {
    console.error('❌ Error fetching package summary:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch package summary',
      summary: null
    };
  }
}

/**
 * Get products associated with a package
 * @param {string} packageName - Package name or identifier
 * @returns {Promise<Object>} Associated products
 */
export async function getProductsForPackage(packageName) {
  try {
    const response = await api.get(`/packages/${encodeURIComponent(packageName)}/products`);
    
    if (response.data.success) {
      return {
        success: true,
        products: response.data.products || [],
        count: response.data.count || 0
      };
    } else {
      throw new Error(response.data.error || 'Failed to fetch products for package');
    }
  } catch (error) {
    console.error('❌ Error fetching products for package:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch products for package',
      products: [],
      count: 0
    };
  }
}

/**
 * Export packages to Excel
 * Triggers a download of all packages in Excel format
 * @returns {Promise<void>}
 */
export async function exportPackagesToExcel() {
  try {
    console.log('🔵 Starting package export to Excel...');
    
    // Make API call to get the Excel file
    const response = await api.get('/packages/export', {
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
    link.download = `Packages_Catalogue_${timestamp}.xlsx`;
    
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
    console.error('❌ Error exporting packages:', error);
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
        throw new Error(error.message || 'Failed to export packages');
      }
    }
    
    throw new Error(
      error.response?.data?.message || error.message || 'Failed to export packages'
    );
  }
}

export default {
  getPackages,
  getPackageByIdentifier,
  getPackageSummary,
  getProductsForPackage,
  exportPackagesToExcel
};

