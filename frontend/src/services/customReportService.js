import api from './api';

/**
 * Custom Report Service
 * CRUD operations for saved custom reports
 */

export const listReports = async (limit = 50, offset = 0) => {
  const response = await api.get('/custom-reports', { params: { limit, offset } });
  return response.data;
};

export const getReport = async (slug) => {
  const response = await api.get(`/custom-reports/${slug}`);
  return response.data;
};

export const createReport = async ({ name, description, reportConfig, conversationHistory }) => {
  const response = await api.post('/custom-reports', {
    name,
    description,
    reportConfig,
    conversationHistory
  });
  return response.data;
};

export const updateReport = async (id, updates) => {
  const response = await api.put(`/custom-reports/${id}`, updates);
  return response.data;
};

export const deleteReport = async (id) => {
  const response = await api.delete(`/custom-reports/${id}`);
  return response.data;
};

export const getDataCatalog = async (grouped = false) => {
  const response = await api.get('/custom-reports/data-catalog', { params: { grouped: String(grouped) } });
  return response.data;
};
