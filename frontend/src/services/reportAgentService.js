import api from './api';

/**
 * Report Agent Service
 * Chat interface for the AI report-building agent
 */

export const sendMessage = async ({ message, conversationHistory, proposedConfig }) => {
  try {
    const response = await api.post('/report-agent/chat', {
      message,
      conversationHistory,
      proposedConfig
    });
    return response.data;
  } catch (error) {
    console.error('[ReportAgentService] Error sending message:', error);
    throw error;
  }
};

export const getCapabilities = async () => {
  try {
    const response = await api.get('/report-agent/capabilities');
    return response.data;
  } catch (error) {
    console.error('[ReportAgentService] Error fetching capabilities:', error);
    throw error;
  }
};
