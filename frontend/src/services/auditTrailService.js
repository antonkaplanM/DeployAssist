import api from './api';

/**
 * Audit Trail Service
 * Handles all API calls related to PS Record audit trail tracking
 */

// Get audit trail statistics
export const getAuditStats = async () => {
  try {
    const response = await api.get('/audit-trail/stats');
    return response.data;
  } catch (error) {
    console.error('[AuditTrailService] Error fetching audit stats:', error);
    throw error;
  }
};

// Search for PS records
export const searchAuditTrail = async (searchTerm) => {
  try {
    const response = await api.get('/audit-trail/search', {
      params: { q: searchTerm }
    });
    return response.data;
  } catch (error) {
    console.error('[AuditTrailService] Error searching audit trail:', error);
    throw error;
  }
};

// Get audit trail for a specific PS record
export const getPSAuditTrail = async (identifier) => {
  try {
    const response = await api.get(`/audit-trail/ps-record/${identifier}`);
    return response.data;
  } catch (error) {
    console.error('[AuditTrailService] Error fetching PS audit trail:', error);
    throw error;
  }
};

// Get status change history for a PS record
export const getPSStatusChanges = async (identifier) => {
  try {
    const response = await api.get(`/audit-trail/status-changes/${identifier}`);
    return response.data;
  } catch (error) {
    console.error('[AuditTrailService] Error fetching status changes:', error);
    throw error;
  }
};

// Trigger manual capture
export const triggerManualCapture = async () => {
  try {
    const response = await api.post('/audit-trail/capture');
    return response.data;
  } catch (error) {
    console.error('[AuditTrailService] Error triggering capture:', error);
    throw error;
  }
};

export default {
  getAuditStats,
  searchAuditTrail,
  getPSAuditTrail,
  getPSStatusChanges,
  triggerManualCapture,
};

