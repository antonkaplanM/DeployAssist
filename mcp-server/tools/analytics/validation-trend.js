const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Validation Trend Tool
 * Retrieves validation error trends over time
 */
module.exports = {
  name: 'get_validation_trend',
  description: 'Get validation error trends for Technical Team Requests over a specified time period. Shows how validation errors have changed over time, useful for monitoring data quality.',
  
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look back (default: 30, max: 90)',
        default: 30,
        minimum: 1,
        maximum: 90,
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
      const days = args.days || 30;
      
      // Call API
      const response = await context.apiClient.get('/api/analytics/validation-trend', {
        params: { days },
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        days: days,
      });
      
    } catch (error) {
      throw error;
    }
  },
};






