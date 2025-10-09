/**
 * Salesforce Repository
 * Data access layer for Salesforce operations
 * Handles only connection and raw queries - no business logic
 */

import { Connection, QueryResult, DescribeSObjectResult, IdentityInfo } from 'jsforce';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as querystring from 'querystring';
import { config, getHttpsAgent } from '../config';
import { Logger } from '../utils/logger';
import { SalesforceConnectionError, SalesforceError } from '../middleware/errors';

interface AuthInfo {
  accessToken: string;
  instanceUrl: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  authenticatedAt?: string;
  id?: string;
  organizationId?: string;
}

/**
 * Salesforce Repository Class
 */
export class SalesforceRepository {
  private static connectionInstance: Connection | null = null;
  private readonly tokenFile: string;

  constructor() {
    this.tokenFile = config.salesforce.tokenFile;
  }

  /**
   * Get or create Salesforce connection
   */
  async getConnection(): Promise<Connection> {
    if (SalesforceRepository.connectionInstance) {
      return SalesforceRepository.connectionInstance;
    }

    // Create new connection
    const conn = new Connection({
      loginUrl: config.salesforce.loginUrl
    });

    // Try to load existing access token
    const authInfo = await this.loadAuthFromDisk();
    if (authInfo && authInfo.accessToken) {
      try {
        conn.accessToken = authInfo.accessToken;
        conn.instanceUrl = authInfo.instanceUrl;
        
        // Test if the token is still valid
        await conn.identity();
        Logger.salesforce('Using existing access token', { instanceUrl: authInfo.instanceUrl });
        SalesforceRepository.connectionInstance = conn;
        return conn;
      } catch (err) {
        Logger.warn('Existing access token invalid, requesting new token');
        await this.clearAuthFromDisk();
      }
    }

    // Authenticate using Client Credentials Flow
    try {
      Logger.salesforce('Authenticating with Client Credentials Flow', {});
      
      const postData = querystring.stringify({
        grant_type: 'client_credentials',
        client_id: config.salesforce.clientId,
        client_secret: config.salesforce.clientSecret
      });

      const authResult = await this.makeHttpsRequest(
        `${config.salesforce.loginUrl}/services/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          },
          body: postData
        }
      );

      conn.accessToken = authResult.access_token;
      conn.instanceUrl = authResult.instance_url;

      // Save authentication
      await this.saveAuthToDisk({
        accessToken: authResult.access_token,
        instanceUrl: authResult.instance_url,
        tokenType: authResult.token_type,
        scope: authResult.scope,
        authenticatedAt: new Date().toISOString()
      });

      Logger.salesforce('Authentication successful', { instanceUrl: authResult.instance_url });
      SalesforceRepository.connectionInstance = conn;
      return conn;
      
    } catch (error) {
      Logger.error('Salesforce authentication failed', error as Error);
      throw new SalesforceConnectionError(
        'Failed to authenticate with Salesforce',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Check if valid authentication exists
   */
  async hasValidAuthentication(): Promise<boolean> {
    try {
      const authData = await fs.readFile(this.tokenFile, 'utf8');
      const auth: AuthInfo = JSON.parse(authData);
      return !!(auth.accessToken);
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a SOQL query
   */
  async query<T extends Record<string, any> = any>(soql: string): Promise<QueryResult<T>> {
    try {
      const conn = await this.getConnection();
      Logger.salesforce('Executing SOQL query', { query: soql.substring(0, 100) + '...' });
      
      const result = await conn.query<T>(soql);
      Logger.salesforce('Query executed successfully', { recordCount: result.records.length });
      
      return result;
    } catch (error) {
      Logger.error('Salesforce query failed', error as Error, { query: soql });
      throw new SalesforceError(
        'Failed to execute Salesforce query',
        { error: (error as Error).message, query: soql }
      );
    }
  }

  /**
   * Get object description (metadata)
   */
  async describe(objectName: string): Promise<DescribeSObjectResult> {
    try {
      const conn = await this.getConnection();
      return await conn.sobject(objectName).describe();
    } catch (error) {
      Logger.error(`Failed to describe ${objectName}`, error as Error);
      throw new SalesforceError(
        `Failed to describe ${objectName}`,
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Get identity information
   */
  async getIdentity(): Promise<IdentityInfo> {
    try {
      const conn = await this.getConnection();
      return await conn.identity();
    } catch (error) {
      Logger.error('Failed to get Salesforce identity', error as Error);
      throw new SalesforceError(
        'Failed to get Salesforce identity',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; details?: any; error?: string }> {
    try {
      const conn = await this.getConnection();
      const result = await conn.query("SELECT Id, Name FROM Organization LIMIT 1");
      
      return {
        success: true,
        details: {
          recordCount: result.totalSize,
          organizationName: result.records[0]?.['Name'],
          instanceUrl: conn.instanceUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Private: Make HTTPS request (for OAuth)
   */
  private async makeHttpsRequest(url: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const httpsAgent = getHttpsAgent();
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: options.method || 'GET',
        headers: options.headers || {},
        agent: httpsAgent
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              const result = JSON.parse(data);
              reject(new Error(`HTTP ${res.statusCode}: ${result.error || 'Unknown error'} - ${result.error_description || data}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  /**
   * Private: Load auth from disk
   */
  private async loadAuthFromDisk(): Promise<AuthInfo | null> {
    try {
      const tokenData = await fs.readFile(this.tokenFile, 'utf8');
      return JSON.parse(tokenData);
    } catch (err) {
      return null;
    }
  }

  /**
   * Private: Save auth to disk
   */
  private async saveAuthToDisk(authInfo: AuthInfo): Promise<void> {
    try {
      await fs.writeFile(this.tokenFile, JSON.stringify(authInfo, null, 2));
      Logger.salesforce('Auth token saved to disk', {});
    } catch (err) {
      Logger.error('Failed to save auth token', err as Error);
    }
  }

  /**
   * Private: Clear auth from disk
   */
  private async clearAuthFromDisk(): Promise<void> {
    try {
      await fs.unlink(this.tokenFile);
      Logger.salesforce('Auth token cleared from disk', {});
    } catch (err) {
      // File might not exist, which is fine
    }
  }
}

export default SalesforceRepository;

