/**
 * SML Routes
 * HTTP routes for SML-related operations
 */

import { Router, Request, Response } from 'express';
import { SMLService } from '../services/SMLService';
import { asyncHandler } from '../middleware/errors';
import { Logger } from '../utils/logger';

const router = Router();
const smlService = new SMLService();

/**
 * GET /api/sml/config
 * Get current SML configuration (without exposing the auth cookie)
 */
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  Logger.api('GET', '/api/sml/config', {});
  
  const config = smlService.getConfig();
  
  res.json({
    success: true,
    configured: !!config,
    environment: config?.environment || null,
    hasAuthCookie: !!(config?.authCookie),
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/sml/config
 * Set SML authentication configuration
 */
router.post('/config', asyncHandler(async (req: Request, res: Response) => {
  Logger.api('POST', '/api/sml/config', { environment: req.body.environment });
  
  const { environment, authCookie } = req.body;
  
  // Validate input
  if (!environment || !['euw1', 'use1'].includes(environment)) {
    res.status(400).json({
      success: false,
      error: 'Invalid environment. Must be "euw1" or "use1"',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (!authCookie || typeof authCookie !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Auth cookie is required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  await smlService.setAuthConfig(environment, authCookie);
  
  res.json({
    success: true,
    message: 'SML configuration saved successfully',
    environment,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/sml/test
 * Test SML connectivity
 */
router.get('/test', asyncHandler(async (_req: Request, res: Response) => {
  Logger.api('GET', '/api/sml/test', {});
  
  const result = await smlService.testConnection();
  
  res.json({
    ...result,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/sml/tenant/:tenantId/products
 * Get all products for a specific tenant
 */
router.get('/tenant/:tenantId/products', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId;
  const tenantName = req.query.tenantName as string | undefined;
  
  Logger.api('GET', `/api/sml/tenant/${tenantId}/products`, { tenantId, tenantName });
  
  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  const result = await smlService.fetchTenantProducts(tenantId, tenantName);
  
  res.json({
    ...result,
    timestamp: new Date().toISOString()
  });
}));

export default router;

