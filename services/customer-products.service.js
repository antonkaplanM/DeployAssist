/**
 * Customer Products Service
 * Business logic for customer product management
 */

const salesforce = require('../salesforce');
const logger = require('../utils/logger');
const { BadRequestError, InternalServerError } = require('../middleware/error-handler');

class CustomerProductsService {
    /**
     * Get aggregated customer products for an account
     * Uses the latest PS record with status "Tenant Request Completed" from the audit trail
     * @param {String} accountName - Account name
     * @param {Boolean} includeExpired - Include expired products
     * @returns {Promise<Object>} Customer products by region
     */
    async getCustomerProducts(accountName, includeExpired = false) {
        if (!accountName) {
            throw new BadRequestError('Account name is required');
        }
        
        logger.info(`Fetching customer products from audit trail for: ${accountName} (includeExpired: ${includeExpired})`);
        
        try {
            const result = await salesforce.getCustomerProducts(accountName, includeExpired);
            
            if (result.success) {
                return result;
            } else {
                throw new InternalServerError(result.error || 'Failed to fetch customer products');
            }
        } catch (err) {
            logger.error('Error fetching customer products:', err);
            throw new InternalServerError('Failed to fetch customer products');
        }
    }
}

module.exports = new CustomerProductsService();

