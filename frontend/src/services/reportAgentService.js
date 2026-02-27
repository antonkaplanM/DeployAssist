import api from './api';

/**
 * Report Agent Service
 * Chat interface for the AI report-building agent
 */

export const sendMessage = async ({ message, conversationHistory, proposedConfig }) => {
  const response = await api.post('/report-agent/chat', {
    message,
    conversationHistory,
    proposedConfig
  });
  return response.data;
};

export const getCapabilities = async () => {
  const response = await api.get('/report-agent/capabilities');
  return response.data;
};
