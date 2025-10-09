/**
 * Salesforce Routes
 * HTTP routes for Salesforce-related operations
 */

import { Router, Request, Response } from 'express';
import { SalesforceService } from '../services/SalesforceService';
import { asyncHandler } from '../middleware/errors';
import { Logger } from '../utils/logger';
import { ProfServicesQueryFilters } from '../types/salesforce.types';

const router = Router();
const salesforceService = new SalesforceService();

/**
 * GET /api/salesforce/test
 * Test Salesforce connectivity
 */
router.get('/test', asyncHandler(async (_req: Request, res: Response) => {
  Logger.api('GET', '/api/salesforce/test', {});
  
  const result = await salesforceService.testConnection();
  
  res.json({
    success: result.success,
    ...(result.success ? { details: result.details } : { error: result.error }),
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/salesforce/provisioning/requests
 * Query Professional Services Requests with filters and pagination
 */
router.get('/provisioning/requests', asyncHandler(async (req: Request, res: Response) => {
  Logger.api('GET', '/api/salesforce/provisioning/requests', { query: req.query });
  
  const filters: ProfServicesQueryFilters = {
    requestType: req.query.requestType as string,
    accountId: req.query.accountId as string,
    status: req.query.status as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    search: req.query.search as string,
    pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 25,
    offset: req.query.offset ? parseInt(req.query.offset as string) : 0
  };
  
  // Remove undefined values
  Object.keys(filters).forEach(key => {
    if (filters[key as keyof ProfServicesQueryFilters] === undefined || filters[key as keyof ProfServicesQueryFilters] === '') {
      delete filters[key as keyof ProfServicesQueryFilters];
    }
  });
  
  const result = await salesforceService.queryProfServicesRequests(filters);
  
  res.json({
    ...result,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/salesforce/provisioning/filter-options
 * Get filter options for dropdowns
 */
router.get('/provisioning/filter-options', asyncHandler(async (_req: Request, res: Response) => {
  Logger.api('GET', '/api/salesforce/provisioning/filter-options', {});
  
  const result = await salesforceService.getFilterOptions();
  
  res.json({
    ...result,
    timestamp: new Date().toISOString()
  });
}));

export default router;

