/**
 * SML Service
 * Business logic layer for SML operations
 * Handles data transformation, normalization, and aggregation
 * 
 * Features:
 * - Token status monitoring
 * - Automatic token refresh via Playwright
 * - Data normalization for apps, models, and data products
 */

import { SMLRepository } from '../repositories/SMLRepository';
import { Logger } from '../utils/logger';
import {
  SMLProduct,
  SMLProductsByCategory,
  SMLTenantProductsResult,
  SMLConfig,
  SMLConnectionTestResult,
  SMLAppEntitlement,
  SMLModelEntitlement,
  SMLDataEntitlement
} from '../types/sml.types';

/**
 * SML Service Class
 */
export class SMLService {
  private repository: SMLRepository;

  constructor(repository?: SMLRepository) {
    this.repository = repository || new SMLRepository();
  }

  /**
   * Set SML authentication configuration
   */
  async setAuthConfig(environment: 'euw1' | 'use1', authCookie: string): Promise<void> {
    const config: SMLConfig = {
      environment,
      authCookie
    };
    await this.repository.saveConfig(config);
    Logger.info('SML auth configuration updated', { environment });
  }

  /**
   * Get current configuration
   */
  getConfig(): SMLConfig | null {
    return this.repository.getConfig();
  }

  /**
   * Get token expiration information
   */
  getTokenInfo(): {
    hasToken: boolean;
    expired: boolean;
    expiresAt: Date | null;
    remainingMinutes: number;
  } {
    return this.repository.getTokenInfo();
  }

  /**
   * Check if the current token is valid
   */
  isTokenValid(): boolean {
    return this.repository.isTokenValid();
  }

  /**
   * Refresh the token using Playwright SSO flow
   * Opens a browser window for authentication
   */
  async refreshToken(): Promise<boolean> {
    return this.repository.refreshToken();
  }

  /**
   * Reload configuration from disk
   */
  async reloadConfig(): Promise<void> {
    await this.repository.reloadConfig();
  }

  /**
   * Test SML connection
   */
  async testConnection(): Promise<SMLConnectionTestResult> {
    try {
      const config = this.repository.getConfig();
      
      if (!config || !config.authCookie) {
        return {
          success: false,
          error: 'SML authentication not configured'
        };
      }

      const result = await this.repository.testConnection();
      
      if (result.success) {
        return {
          success: true,
          environment: config.environment,
          baseUrl: config.environment === 'euw1' 
            ? 'https://api-euw1.rms.com' 
            : 'https://api-use1.rms.com',
          authenticated: true
        };
      } else {
        return {
          success: false,
          environment: config.environment,
          error: result.error
        };
      }
    } catch (error) {
      Logger.error('SML connection test failed', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Fetch all products for a tenant
   */
  async fetchTenantProducts(tenantId: string, tenantName?: string): Promise<SMLTenantProductsResult> {
    try {
      Logger.info('Fetching SML products for tenant', { tenantId, tenantName });

      // Fetch all product types in parallel
      const [appsResponse, modelsResponse, dataResponse] = await Promise.all([
        this.repository.fetchApps(tenantId).catch(err => {
          Logger.warn('Failed to fetch apps', { error: err.message });
          return { apps: [], entitlements: [], data: [] };
        }),
        this.repository.fetchModels(tenantId).catch(err => {
          Logger.warn('Failed to fetch models', { error: err.message });
          return { models: [], entitlements: [], data: [] };
        }),
        this.repository.fetchData(tenantId).catch(err => {
          Logger.warn('Failed to fetch data', { error: err.message });
          return { data: [], entitlements: [], datasets: [] };
        })
      ]);

      // Normalize and transform data
      const apps = this.normalizeApps(appsResponse);
      const models = this.normalizeModels(modelsResponse);
      const data = this.normalizeData(dataResponse);

      const products: SMLProductsByCategory = {
        apps,
        models,
        data
      };

      const summary = {
        totalActive: apps.length + models.length + data.length,
        byCategory: {
          apps: apps.length,
          models: models.length,
          data: data.length
        }
      };

      Logger.info('SML products fetched successfully', {
        tenantId,
        totalProducts: summary.totalActive
      });

      return {
        success: true,
        tenantId,
        tenantName: tenantName || null,
        products,
        summary,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      Logger.error('Failed to fetch tenant products', error as Error, { tenantId });
      return {
        success: false,
        tenantId,
        tenantName: tenantName || null,
        products: {
          apps: [],
          models: [],
          data: []
        },
        summary: {
          totalActive: 0,
          byCategory: {
            apps: 0,
            models: 0,
            data: 0
          }
        },
        fetchedAt: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Normalize Apps data
   */
  private normalizeApps(response: any): SMLProduct[] {
    const apps = response.apps || response.entitlements || response.data || [];
    
    return apps.map((app: SMLAppEntitlement) => this.createProduct(app, 'apps'));
  }

  /**
   * Normalize Models data
   */
  private normalizeModels(response: any): SMLProduct[] {
    const models = response.models || response.entitlements || response.data || [];
    
    return models.map((model: SMLModelEntitlement) => this.createProduct(model, 'models'));
  }

  /**
   * Normalize Data products
   */
  private normalizeData(response: any): SMLProduct[] {
    const datasets = response.data || response.datasets || response.entitlements || [];
    
    return datasets.map((dataset: SMLDataEntitlement) => this.createProduct(dataset, 'data'));
  }

  /**
   * Create unified product object
   */
  private createProduct(
    entitlement: SMLAppEntitlement | SMLModelEntitlement | SMLDataEntitlement,
    category: 'apps' | 'models' | 'data'
  ): SMLProduct {
    const productCode = entitlement.productCode;
    const productName = entitlement.productName || entitlement.name || null;
    const startDate = entitlement.startDate || null;
    const endDate = entitlement.endDate || null;

    // Calculate status and days remaining
    const { status, daysRemaining } = this.calculateStatus(startDate, endDate);

    return {
      productCode,
      productName,
      category,
      startDate,
      endDate,
      status,
      daysRemaining,
      additionalInfo: {
        ...entitlement
      }
    };
  }

  /**
   * Calculate product status and days remaining
   */
  private calculateStatus(
    startDate: string | null,
    endDate: string | null
  ): { status: 'active' | 'expired' | 'pending'; daysRemaining: number | null } {
    const now = new Date();

    if (!endDate) {
      return { status: 'active', daysRemaining: null };
    }

    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { status: 'expired', daysRemaining };
    } else if (daysRemaining < 30) {
      return { status: 'active', daysRemaining }; // Could add 'expiring-soon' status if needed
    } else {
      return { status: 'active', daysRemaining };
    }
  }
}

export default SMLService;

