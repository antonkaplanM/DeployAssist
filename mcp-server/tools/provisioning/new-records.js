const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get New Provisioning Records Tool
 * Get new provisioning records created since last check
 */
module.exports = {
  name: 'get_new_provisioning_records',
  description: 'Get provisioning records that are new since a specified date or the last check. Useful for monitoring new incoming requests and staying current.',
  
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        description: 'ISO date string to get records since (optional, defaults to last 24 hours)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}:\\d{2})?',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of records to return (default: 50, max: 200)',
        default: 50,
        minimum: 1,
        maximum: 200,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const params = {
        since: args.since,
        limit: args.limit || 50,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/provisioning/new-records', {
        params: params,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



