/**
 * SML Compare Service
 * Handles API calls for SML tenant comparison
 */

const API_BASE = '/api/sml';

/**
 * Fetch SML tenant details using headless browser
 * @param {string} tenantName - Name of the tenant to fetch
 * @returns {Promise<Object>} - Response containing tenant details
 */
export const fetchSMLTenantDetails = async (tenantName) => {
  try {
    const response = await fetch(`${API_BASE}/tenant-compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantName }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch SML tenant details');
    }

    return data;
  } catch (error) {
    console.error('Error fetching SML tenant details:', error);
    throw error;
  }
};

/**
 * Get SML configuration status
 * @returns {Promise<Object>} - SML configuration status
 */
export const getSMLConfig = async () => {
  try {
    const response = await fetch(`${API_BASE}/config`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get SML config');
    }

    return data;
  } catch (error) {
    console.error('Error getting SML config:', error);
    throw error;
  }
};

