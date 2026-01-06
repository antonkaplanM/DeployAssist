import api from './api';

/**
 * Staging Service
 * Handles API calls for the Staging page (Experimental PoC)
 * Used to fetch and manage PS records in staging area before downstream processing
 */

/**
 * Fetch random PS records for staging review
 * @param {number} count - Number of records to fetch (default: 10)
 * @param {Array<string>} excludeIds - Array of record IDs to exclude
 * @returns {Promise<{success: boolean, records: Array, totalAvailable: number}>}
 */
export const getRandomStagingRecords = async (count = 10, excludeIds = []) => {
  try {
    const params = new URLSearchParams();
    params.append('count', count.toString());
    if (excludeIds.length > 0) {
      params.append('exclude', excludeIds.join(','));
    }

    const response = await api.get(`/staging/random-records?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('[StagingService] Error fetching random records:', error);
    throw error;
  }
};

/**
 * Fetch a single PS record by ID
 * @param {string} id - Record ID
 * @returns {Promise<{success: boolean, record: Object}>}
 */
export const getStagingRecordById = async (id) => {
  try {
    const response = await api.get(`/staging/record/${id}`);
    return response.data;
  } catch (error) {
    console.error('[StagingService] Error fetching record:', error);
    throw error;
  }
};

/**
 * Replace a record with a new random one
 * @param {Array<string>} excludeIds - Array of record IDs to exclude
 * @returns {Promise<{success: boolean, records: Array}>}
 */
export const replaceRecordWithRandom = async (excludeIds = []) => {
  return getRandomStagingRecords(1, excludeIds);
};







