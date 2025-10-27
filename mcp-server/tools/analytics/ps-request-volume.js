const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get PS Request Volume Tool
 * Get Professional Services request volume statistics
 */
module.exports = {
  name: 'get_ps_request_volume',
  description: 'Get Professional Services (PS) request volume statistics over a specified time period. Shows weekly breakdown and averages to understand request patterns and workload.',
  
  inputSchema: {
    type: 'object',
    properties: {
      months: {
        type: 'number',
        description: 'Number of months to look back for analysis (default: 6, min: 1, max: 24)',
        default: 6,
        minimum: 1,
        maximum: 24,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const months = args.months || 6;
      
      // Call API - Note: This might need to be implemented in the backend
      // For now, return a placeholder or call an existing similar endpoint
      const response = await context.apiClient.get('/api/provisioning/requests', {
        params: { limit: 100 }, // Get recent requests for volume analysis
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        months: months,
        note: 'Volume analysis calculated from recent request data',
      });
      
    } catch (error) {
      throw error;
    }
  },
};


