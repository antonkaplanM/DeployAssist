/**
 * SML Repository
 * Data access layer for SML API operations
 * Handles HTTP requests to SML endpoints with cookie-based authentication
 */

import * as https from 'https';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';
import { getHttpsAgent } from '../config';
import {
  SMLAppsResponse,
  SMLModelsResponse,
  SMLDataResponse,
  SMLAuthError,
  SMLConnectionError,
  SMLConfig,
  SMLEnvironments
} from '../types/sml.types';

const SML_BASE_URLS: SMLEnvironments = {
  euw1: 'https://api-euw1.rms.com',
  use1: 'https://api-use1.rms.com'
};

const SML_CONFIG_FILE = '.sml_config.json';

/**
 * SML Repository Class
 */
export class SMLRepository {
  private config: SMLConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load SML configuration from disk
   */
  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(SML_CONFIG_FILE, 'utf8');
      this.config = JSON.parse(configData);
      Logger.info('SML configuration loaded');
    } catch (error) {
      Logger.warn('No SML configuration found - auth cookie needs to be set');
      this.config = null;
    }
  }

  /**
   * Save SML configuration to disk
   */
  async saveConfig(config: SMLConfig): Promise<void> {
    try {
      await fs.writeFile(SML_CONFIG_FILE, JSON.stringify(config, null, 2));
      this.config = config;
      Logger.info('SML configuration saved', { environment: config.environment });
    } catch (error) {
      Logger.error('Failed to save SML configuration', error as Error);
      throw new Error('Failed to save SML configuration');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SMLConfig | null {
    return this.config;
  }

  /**
   * Get base URL for current environment
   */
  private getBaseUrl(): string {
    if (!this.config || !this.config.environment) {
      throw new SMLConnectionError('SML environment not configured');
    }
    return SML_BASE_URLS[this.config.environment];
  }

  /**
   * Check if authentication is configured
   */
  hasAuthentication(): boolean {
    return !!(this.config && this.config.authCookie);
  }

  /**
   * Make HTTPS request to SML API
   */
  private async makeRequest<T>(path: string): Promise<T> {
    if (!this.hasAuthentication()) {
      throw new SMLAuthError('SML authentication cookie not configured');
    }

    const baseUrl = this.getBaseUrl();
    const url = new URL(path, baseUrl);

    Logger.info('SML API Request', { url: url.toString() });

    return new Promise((resolve, reject) => {
      const httpsAgent = getHttpsAgent();

      // Determine origin based on environment
      const origin = this.config!.environment === 'euw1' 
        ? 'https://tenant-zero.rms.com'
        : 'https://tenant-zero-us.rms.com';
      
      const requestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config!.authCookie}`,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': origin,
          'Referer': `${origin}/`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        },
        agent: httpsAgent
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 401 || res.statusCode === 403) {
              Logger.error('SML authentication failed', new Error('Unauthorized'), {
                statusCode: res.statusCode
              });
              reject(new SMLAuthError('SML authentication failed - cookie may be expired'));
              return;
            }

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const result = data ? JSON.parse(data) : {};
              Logger.info('SML API Response Success', { statusCode: res.statusCode });
              resolve(result);
            } else {
              Logger.error('SML API Error', new Error(`HTTP ${res.statusCode}`), {
                statusCode: res.statusCode,
                response: data.substring(0, 500)
              });
              reject(new SMLConnectionError(
                `SML API request failed with status ${res.statusCode}`,
                { statusCode: res.statusCode, response: data }
              ));
            }
          } catch (parseError) {
            Logger.error('Failed to parse SML response', parseError as Error, {
              responsePreview: data.substring(0, 500),
              statusCode: res.statusCode
            });
            reject(new SMLConnectionError('Failed to parse SML API response - received non-JSON response', {
              error: (parseError as Error).message,
              statusCode: res.statusCode,
              responsePreview: data.substring(0, 200)
            }));
          }
        });
      });

      req.on('error', (error) => {
        Logger.error('SML API request failed', error);
        reject(new SMLConnectionError('Failed to connect to SML API', {
          error: error.message
        }));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new SMLConnectionError('SML API request timeout'));
      });

      req.end();
    });
  }

  /**
   * Fetch Apps entitlements for a tenant
   */
  async fetchApps(tenantId: string): Promise<SMLAppsResponse> {
    try {
      const path = `/sml/entitlements/v1/tenants/${encodeURIComponent(tenantId)}/apps/current`;
      return await this.makeRequest<SMLAppsResponse>(path);
    } catch (error) {
      Logger.error('Failed to fetch SML apps', error as Error, { tenantId });
      throw error;
    }
  }

  /**
   * Fetch Models entitlements for a tenant
   */
  async fetchModels(tenantId: string): Promise<SMLModelsResponse> {
    try {
      const path = `/v1/tenants/${encodeURIComponent(tenantId)}/models/current`;
      return await this.makeRequest<SMLModelsResponse>(path);
    } catch (error) {
      Logger.error('Failed to fetch SML models', error as Error, { tenantId });
      throw error;
    }
  }

  /**
   * Fetch Data entitlements for a tenant
   */
  async fetchData(tenantId: string): Promise<SMLDataResponse> {
    try {
      const path = `/v1/tenants/${encodeURIComponent(tenantId)}/data/current`;
      return await this.makeRequest<SMLDataResponse>(path);
    } catch (error) {
      Logger.error('Failed to fetch SML data', error as Error, { tenantId });
      throw error;
    }
  }

  /**
   * Test connection to SML API
   */
  async testConnection(tenantId: string = '6000009'): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      if (!this.hasAuthentication()) {
        return {
          success: false,
          error: 'Authentication cookie not configured'
        };
      }

      // Try to fetch apps as a connection test using a known tenant
      await this.fetchApps(tenantId);
      
      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: (error as Error).message,
        details: error.details || {}
      };
    }
  }
}

export default SMLRepository;

