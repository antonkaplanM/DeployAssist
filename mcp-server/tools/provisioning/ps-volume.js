const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * PS Request Volume Analysis Tool
 * Get statistics on PS request volume over a time period
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
      
      // Set defaults
      const months = args.months || 6;
      
      // Call API
      const response = await context.apiClient.get('/api/audit-trail/ps-volume', {
        params: { months },
      });
      
      // Format success response
      return formatter.success(response.data, {
        executionTime: response.duration,
        months: months,
      });
      
    } catch (error) {
      throw error;
    }
  },
};




