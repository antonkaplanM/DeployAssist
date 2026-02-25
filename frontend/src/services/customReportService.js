import api from './api';

/**
 * Custom Report Service
 * CRUD operations for saved custom reports
 */

export const listReports = async (limit = 50, offset = 0) => {
  try {
    const response = await api.get('/custom-reports', { params: { limit, offset } });
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error listing reports:', error);
    throw error;
  }
};

export const getReport = async (slug) => {
  try {
    const response = await api.get(`/custom-reports/${slug}`);
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error fetching report:', error);
    throw error;
  }
};

export const createReport = async ({ name, description, reportConfig, conversationHistory }) => {
  try {
    const response = await api.post('/custom-reports', {
      name,
      description,
      reportConfig,
      conversationHistory
    });
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error creating report:', error);
    throw error;
  }
};

export const updateReport = async (id, updates) => {
  try {
    const response = await api.put(`/custom-reports/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error updating report:', error);
    throw error;
  }
};

export const deleteReport = async (id) => {
  try {
    const response = await api.delete(`/custom-reports/${id}`);
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error deleting report:', error);
    throw error;
  }
};

export const getDataCatalog = async (grouped = false) => {
  try {
    const response = await api.get('/custom-reports/data-catalog', { params: { grouped: String(grouped) } });
    return response.data;
  } catch (error) {
    console.error('[CustomReportService] Error fetching data catalog:', error);
    throw error;
  }
};
