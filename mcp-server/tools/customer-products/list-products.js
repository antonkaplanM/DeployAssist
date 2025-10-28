const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Customer Products Tool
 * Get all active products for customers, organized by region and category
 */
module.exports = {
  name: 'list_customer_products',
  description: 'List all active products for customers, organized by region (NAM, EMEA, APAC) and product category (Core, Add-on, Professional Services). Can filter by account name or region.',
  
  inputSchema: {
    type: 'object',
    properties: {
      accountName: {
        type: 'string',
        description: 'Filter by specific account name (optional)',
        maxLength: 255,
      },
      region: {
        type: 'string',
        description: 'Filter by region (optional)',
        enum: ['NAM', 'EMEA', 'APAC', 'LATAM'],
      },
      category: {
        type: 'string',
        description: 'Filter by product category (optional)',
        enum: ['Core', 'Add-on', 'Professional Services', 'Support'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100, max: 500)',
        default: 100,
        minimum: 1,
        maximum: 500,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      // Sanitize inputs
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Build query parameters
      const params = {
        accountName: sanitizedArgs.accountName,
        region: sanitizedArgs.region,
        category: sanitizedArgs.category,
        limit: sanitizedArgs.limit || 100,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/customer-products', {
        params: params,
      });
      
      // Format response
      const products = response.data.products || response.data;
      
      return formatter.success(products, {
        executionTime: response.duration,
        count: Array.isArray(products) ? products.length : 0,
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};






