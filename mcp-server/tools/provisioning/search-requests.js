const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

module.exports = {
  ...getToolSchema('primary.salesforce.provisioning-search'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    validator.validate(args, this.inputSchema);

    const sanitizedArgs = validator.sanitizeInputs(args);

    const params = {};
    if (sanitizedArgs.q !== undefined) params.q = sanitizedArgs.q;
    if (sanitizedArgs.limit !== undefined) params.limit = sanitizedArgs.limit;
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/provisioning/search', { params });

    return formatter.success(response.data.results || response.data, {
      executionTime: response.duration,
    });
  },
};
