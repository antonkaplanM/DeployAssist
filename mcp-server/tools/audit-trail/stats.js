const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Audit Stats Tool
 * Retrieve PS audit trail statistics
 */
module.exports = {
  name: 'get_audit_stats',
  description: 'Get statistics about Professional Services (PS) audit trail, including total records tracked, status changes, and activity summary. Useful for understanding overall PS record management.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/audit-trail/stats');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};





