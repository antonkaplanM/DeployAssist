const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Test Salesforce Connection Tool
 * Test connectivity to Salesforce
 */
module.exports = {
  name: 'test_salesforce_connection',
  description: 'Test connectivity and authentication to Salesforce. Validates that the integration is working correctly. Returns connection status and basic org information.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/test-salesforce');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'connection_test',
      });
      
    } catch (error) {
      throw error;
    }
  },
};



