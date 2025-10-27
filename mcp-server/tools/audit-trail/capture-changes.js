const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Capture Audit Changes Tool
 * Manually trigger PS audit trail capture (WRITE OPERATION)
 */
module.exports = {
  name: 'capture_ps_audit_changes',
  description: 'Manually trigger Professional Services audit trail capture from Salesforce. This is a WRITE operation that fetches and stores current PS data. Use sparingly as it queries Salesforce.',
  
  inputSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Force capture even if recently captured (default: false)',
        default: false,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API (POST request)
      const response = await context.apiClient.post('/api/audit-trail/capture', {
        force: args.force || false,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'capture_triggered',
        forced: args.force || false,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


