/**
 * Tool Registry
 * Central registration of all MCP tools
 */

// ===== Analytics Tools =====
const validationTrend = require('../tools/analytics/validation-trend');
const requestTypesWeek = require('../tools/analytics/request-types-week');
const packageChangesSummary = require('../tools/analytics/package-changes-summary');
const packageChangesByProduct = require('../tools/analytics/package-changes-by-product');
const packageChangesByAccount = require('../tools/analytics/package-changes-by-account');
const recentPackageChanges = require('../tools/analytics/recent-package-changes');
const packageChangesStatus = require('../tools/analytics/package-changes-status');
const psRequestVolume = require('../tools/analytics/ps-request-volume');

// ===== Provisioning Tools =====
const searchProvisioningRequests = require('../tools/provisioning/search-requests');
const getProvisioningRequest = require('../tools/provisioning/get-request');
const getProvisioningFilterOptions = require('../tools/provisioning/filter-options');
const getNewProvisioningRecords = require('../tools/provisioning/new-records');
const getProvisioningRemovals = require('../tools/provisioning/removals');
const listProvisioningRequests = require('../tools/provisioning/list-requests');
const getValidationErrors = require('../tools/provisioning/validation-errors');

// ===== Audit Trail Tools =====
const getAuditStats = require('../tools/audit-trail/stats');
const searchPSRecords = require('../tools/audit-trail/search-records');
const getPSRecord = require('../tools/audit-trail/get-record');
const getPSStatusChanges = require('../tools/audit-trail/status-changes');
const capturePSAuditChanges = require('../tools/audit-trail/capture-changes');

// ===== Customer Products Tools =====
const listCustomerProducts = require('../tools/customer-products/list-products');
const getProductUpdateOptions = require('../tools/customer-products/update-options');
const createProductUpdateRequest = require('../tools/customer-products/create-update-request');
const getProductUpdateRequests = require('../tools/customer-products/list-update-requests');
const getProductUpdateRequest = require('../tools/customer-products/get-update-request');
const updateProductRequestStatus = require('../tools/customer-products/update-request-status');
const getProductRequestHistory = require('../tools/customer-products/request-history');

// ===== Expiration Tools =====
const getExpirationMonitor = require('../tools/expiration/monitor');
const refreshExpirationData = require('../tools/expiration/refresh-data');
const getExpirationStatus = require('../tools/expiration/status');

// ===== Account Tools =====
const listGhostAccounts = require('../tools/accounts/list-ghost-accounts');
const reviewGhostAccount = require('../tools/accounts/review-ghost-account');
const deleteGhostAccount = require('../tools/accounts/delete-ghost-account');
const getDeprovisionedAccounts = require('../tools/accounts/deprovisioned');

// ===== Package Tools =====
const listPackages = require('../tools/packages/list-packages');
const getPackage = require('../tools/packages/get-package');
const getPackageStats = require('../tools/packages/stats');

// ===== Integration Tools =====
const testSalesforceConnection = require('../tools/integrations/test-salesforce');
const querySalesforce = require('../tools/integrations/query-salesforce');
const searchJiraInitiatives = require('../tools/integrations/search-jira');

/**
 * Registry of all available tools
 * Organized by category for better maintainability
 */
const tools = [
  // Analytics Tools (8 tools)
  validationTrend,
  requestTypesWeek,
  packageChangesSummary,
  packageChangesByProduct,
  packageChangesByAccount,
  recentPackageChanges,
  packageChangesStatus,
  psRequestVolume,
  
  // Provisioning Tools (7 tools)
  searchProvisioningRequests,
  getProvisioningRequest,
  getProvisioningFilterOptions,
  getNewProvisioningRecords,
  getProvisioningRemovals,
  listProvisioningRequests,
  getValidationErrors,
  
  // Audit Trail Tools (5 tools)
  getAuditStats,
  searchPSRecords,
  getPSRecord,
  getPSStatusChanges,
  capturePSAuditChanges,
  
  // Customer Products Tools (7 tools)
  listCustomerProducts,
  getProductUpdateOptions,
  createProductUpdateRequest,
  getProductUpdateRequests,
  getProductUpdateRequest,
  updateProductRequestStatus,
  getProductRequestHistory,
  
  // Expiration Tools (3 tools)
  getExpirationMonitor,
  refreshExpirationData,
  getExpirationStatus,
  
  // Account Tools (4 tools)
  listGhostAccounts,
  reviewGhostAccount,
  deleteGhostAccount,
  getDeprovisionedAccounts,
  
  // Package Tools (3 tools)
  listPackages,
  getPackage,
  getPackageStats,
  
  // Integration Tools (3 tools)
  testSalesforceConnection,
  querySalesforce,
  searchJiraInitiatives,
];

/**
 * Get all registered tools
 */
function getTools() {
  return tools;
}

/**
 * Get a specific tool by name
 */
function getTool(name) {
  return tools.find(tool => tool.name === name);
}

/**
 * Get tool metadata for MCP protocol
 */
function getToolMetadata() {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Validate tool exists
 */
function toolExists(name) {
  return tools.some(tool => tool.name === name);
}

/**
 * Get tools by category
 */
function getToolsByCategory() {
  return {
    analytics: tools.slice(0, 8),
    provisioning: tools.slice(8, 15),
    auditTrail: tools.slice(15, 20),
    customerProducts: tools.slice(20, 27),
    expiration: tools.slice(27, 30),
    accounts: tools.slice(30, 34),
    packages: tools.slice(34, 37),
    integrations: tools.slice(37, 40),
  };
}

/**
 * Get tool count summary
 */
function getToolCount() {
  return {
    total: tools.length,
    byCategory: {
      analytics: 8,
      provisioning: 7,
      auditTrail: 5,
      customerProducts: 7,
      expiration: 3,
      accounts: 4,
      packages: 3,
      integrations: 3,
    },
  };
}

module.exports = {
  getTools,
  getTool,
  getToolMetadata,
  toolExists,
  getToolsByCategory,
  getToolCount,
};
