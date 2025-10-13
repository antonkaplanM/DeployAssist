/**
 * Salesforce Service
 * Business logic layer for Salesforce operations
 * Handles parsing, validation, and data transformation
 */

import { SalesforceRepository } from '../repositories/SalesforceRepository';
import { Logger } from '../utils/logger';
import { SalesforceError } from '../middleware/errors';
import {
  ProfServicesRequest,
  ProfServicesQueryFilters,
  ProfServicesQueryResult,
  ParsedPayloadData,
  EntitlementPayload,
  FilterOptionsResult
} from '../types/salesforce.types';

/**
 * Salesforce Service Class
 */
export class SalesforceService {
  private repository: SalesforceRepository;

  constructor(repository?: SalesforceRepository) {
    this.repository = repository || new SalesforceRepository();
  }

  /**
   * Query Professional Services Requests with filters and pagination
   */
  /**
   * Helper: Compute effective status based on SMLErrorMessage__c
   */
  private getEffectiveStatus(record: any): string {
    // If SMLErrorMessage__c has a value, the effective status is "Provisioning Failed"
    if (record.SMLErrorMessage__c && record.SMLErrorMessage__c.trim() !== '') {
      return 'Provisioning Failed';
    }
    // Otherwise, use the actual Status__c field
    return record.Status__c;
  }

  /**
   * Helper: Filter records by effective status
   */
  private filterByEffectiveStatus(records: any[], statusFilter: string): any[] {
    if (!statusFilter) {
      return records; // No filter
    }
    
    return records.filter(record => {
      const effectiveStatus = this.getEffectiveStatus(record);
      return effectiveStatus === statusFilter;
    });
  }

  async queryProfServicesRequests(
    filters: ProfServicesQueryFilters
  ): Promise<ProfServicesQueryResult> {
    try {
      // Validate object exists
      const desc = await this.repository.describe('Prof_Services_Request__c');
      Logger.salesforce('Prof_Services_Request__c object found', { fieldCount: desc.fields.length });

      // Extract pagination parameters
      const pageSize = filters.pageSize || 25;
      const offset = filters.offset || 0;

      // For status filtering, we need to fetch more records and filter server-side
      // because SMLErrorMessage__c cannot be filtered in SOQL WHERE clause
      const shouldFetchMore = !!filters.status;
      const fetchPageSize = shouldFetchMore ? 1000 : pageSize; // Fetch more records when status filter is active
      const fetchOffset = shouldFetchMore ? 0 : offset; // Always start from 0 when we need to filter server-side

      // Build SOQL query with proper escaping (without status filter in SOQL)
      let soql = this.buildProfServicesQuery(filters, fetchPageSize, fetchOffset);
      
      // Execute query
      const result = await this.repository.query<ProfServicesRequest>(soql);

      // Process records
      let processedRecords = result.records.map((record: any) => this.processRecord(record));

      // Apply status filter server-side
      if (filters.status) {
        processedRecords = this.filterByEffectiveStatus(processedRecords, filters.status);
        Logger.salesforce('Applied server-side status filter', { 
          status: filters.status, 
          remaining: processedRecords.length 
        });
      }

      // Calculate pagination for filtered results
      const totalCount = processedRecords.length;
      const paginatedRecords = shouldFetchMore ? processedRecords.slice(offset, offset + pageSize) : processedRecords;
      const hasMore = (offset + pageSize) < totalCount;
      const currentPage = Math.floor(offset / pageSize) + 1;
      const totalPages = Math.ceil(totalCount / pageSize);

      Logger.salesforce('Query completed', {
        found: paginatedRecords.length,
        page: currentPage,
        totalPages,
        totalCount
      });

      return {
        success: true,
        records: paginatedRecords,
        totalCount,
        pageSize,
        offset,
        hasMore,
        currentPage,
        totalPages
      };
    } catch (error) {
      Logger.error('Failed to query Prof Services Requests', error as Error);
      throw new SalesforceError(
        'Failed to query Prof Services Requests',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Parse payload data from JSON string
   */
  parsePayloadData(jsonString: string | null | undefined): ParsedPayloadData {
    if (!jsonString) {
      return this.getEmptyPayloadData();
    }

    try {
      const payload: EntitlementPayload = JSON.parse(jsonString);
      
      // Extract entitlements from nested structure
      const entitlements = payload.properties?.provisioningDetail?.entitlements || payload.entitlements || {};
      
      const modelEntitlements = entitlements.modelEntitlements || payload.modelEntitlements || [];
      const dataEntitlements = entitlements.dataEntitlements || payload.dataEntitlements || [];
      const appEntitlements = entitlements.appEntitlements || payload.appEntitlements || [];
      
      const totalCount = modelEntitlements.length + dataEntitlements.length + appEntitlements.length;
      
      // Create readable summary
      const summary = this.createEntitlementSummary(
        modelEntitlements.length,
        dataEntitlements.length,
        appEntitlements.length,
        modelEntitlements
      );
      
      // Extract tenant name and region
      const tenantName = this.extractTenantName(payload);
      const region = payload.properties?.provisioningDetail?.region || payload.properties?.region || payload.region || null;
      
      return {
        productEntitlements: modelEntitlements,
        modelEntitlements,
        dataEntitlements,
        appEntitlements,
        totalCount,
        summary,
        hasDetails: totalCount > 0,
        rawPayload: payload,
        tenantName,
        region
      };
    } catch (error) {
      Logger.warn('Failed to parse payload JSON', { error: (error as Error).message });
      return {
        ...this.getEmptyPayloadData(),
        summary: 'Invalid JSON data',
        error: (error as Error).message
      };
    }
  }

  /**
   * Get filter options for dropdowns
   */
  async getFilterOptions(): Promise<FilterOptionsResult> {
    try {
      // Get unique request types
      const requestTypeQuery = `
        SELECT TenantRequestAction__c 
        FROM Prof_Services_Request__c 
        WHERE TenantRequestAction__c != null 
        GROUP BY TenantRequestAction__c 
        ORDER BY TenantRequestAction__c 
        LIMIT 50
      `;
      
      // Get unique statuses
      const statusQuery = `
        SELECT Status__c 
        FROM Prof_Services_Request__c 
        WHERE Status__c != null 
        GROUP BY Status__c 
        ORDER BY Status__c 
        LIMIT 50
      `;
      
      const [requestTypeResult, statusResult] = await Promise.all([
        this.repository.query(requestTypeQuery),
        this.repository.query(statusQuery)
      ]);
      
      // Add "Provisioning Failed" as a custom status option (for records with SMLErrorMessage__c)
      const statuses = statusResult.records.map((r: any) => r.Status__c).filter(Boolean);
      statuses.push('Provisioning Failed');
      
      return {
        success: true,
        requestTypes: requestTypeResult.records.map((r: any) => r.TenantRequestAction__c).filter(Boolean),
        statuses: statuses,
        accounts: []
      };
    } catch (error) {
      Logger.error('Failed to get filter options', error as Error);
      throw new SalesforceError(
        'Failed to get filter options',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Test Salesforce connection
   */
  async testConnection(): Promise<{ success: boolean; details?: any; error?: string }> {
    return await this.repository.testConnection();
  }

  /**
   * Private: Build SOQL query with filters
   */
  private buildProfServicesQuery(
    filters: ProfServicesQueryFilters,
    pageSize: number,
    offset: number
  ): string {
    let soql = `
      SELECT Id, Name, Account__c, Status__c, Deployment__c, Deployment__r.Name,
             Account_Site__c, Billing_Status__c, RecordTypeId,
             TenantRequestAction__c, Tenant_Name__c, Payload_Data__c,
             Requested_Install_Date__c, RequestedGoLiveDate__c,
             SMLErrorMessage__c,
             CreatedDate, LastModifiedDate, CreatedBy.Name
      FROM Prof_Services_Request__c 
      WHERE Name LIKE 'PS-%'
    `;
    
    // Add filters with proper escaping
    if (filters.startDate) {
      soql += ` AND CreatedDate >= ${this.escapeSOQL(filters.startDate)}`;
    }
    if (filters.endDate) {
      soql += ` AND CreatedDate <= ${this.escapeSOQL(filters.endDate)}`;
    }
    if (filters.requestType) {
      soql += ` AND TenantRequestAction__c = '${this.escapeSOQL(filters.requestType)}'`;
    }
    // Note: Status filtering is now done server-side after fetching records
    // because SMLErrorMessage__c cannot be filtered in SOQL WHERE clause
    if (filters.search) {
      soql += ` AND (Name LIKE '%${this.escapeSOQL(filters.search)}%' OR Account__c LIKE '%${this.escapeSOQL(filters.search)}%')`;
    }
    
    soql += ` ORDER BY CreatedDate DESC LIMIT ${pageSize} OFFSET ${offset}`;
    
    return soql;
  }

  /**
   * Private: Build count query
   */
  private buildProfServicesCountQuery(filters: ProfServicesQueryFilters): string {
    let soql = `
      SELECT COUNT() 
      FROM Prof_Services_Request__c 
      WHERE Name LIKE 'PS-%'
    `;
    
    // Add same filters
    if (filters.startDate) {
      soql += ` AND CreatedDate >= ${this.escapeSOQL(filters.startDate)}`;
    }
    if (filters.endDate) {
      soql += ` AND CreatedDate <= ${this.escapeSOQL(filters.endDate)}`;
    }
    if (filters.requestType) {
      soql += ` AND TenantRequestAction__c = '${this.escapeSOQL(filters.requestType)}'`;
    }
    // Note: Status filtering is now done server-side after fetching records
    // because SMLErrorMessage__c cannot be filtered in SOQL WHERE clause
    if (filters.search) {
      soql += ` AND (Name LIKE '%${this.escapeSOQL(filters.search)}%' OR Account__c LIKE '%${this.escapeSOQL(filters.search)}%')`;
    }
    
    return soql;
  }

  /**
   * Private: Escape SOQL special characters
   */
  private escapeSOQL(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  /**
   * Private: Process record with parsed payload
   */
  private processRecord(record: ProfServicesRequest): any {
    const parsedPayload = this.parsePayloadData(record.Payload_Data__c);
    
    // Override tenantName with Salesforce field if available
    if (record.Tenant_Name__c) {
      parsedPayload.tenantName = record.Tenant_Name__c;
    }
    
    return {
      ...record,
      parsedPayload
    };
  }

  /**
   * Private: Get empty payload data
   */
  private getEmptyPayloadData(): ParsedPayloadData {
    return {
      productEntitlements: [],
      dataEntitlements: [],
      appEntitlements: [],
      modelEntitlements: [],
      totalCount: 0,
      summary: 'No entitlements data',
      hasDetails: false
    };
  }

  /**
   * Private: Create entitlement summary
   */
  private createEntitlementSummary(
    modelCount: number,
    dataCount: number,
    appCount: number,
    modelEntitlements: any[]
  ): string {
    const summaryParts = [];
    
    if (modelCount > 0) {
      const productCodes = modelEntitlements.map(e => e.productCode).filter(Boolean);
      if (productCodes.length > 0 && productCodes.length <= 3) {
        summaryParts.push(`Models: ${productCodes.join(', ')}`);
      } else {
        summaryParts.push(`${modelCount} Model${modelCount !== 1 ? 's' : ''}`);
      }
    }
    if (dataCount > 0) {
      summaryParts.push(`${dataCount} Data`);
    }
    if (appCount > 0) {
      summaryParts.push(`${appCount} App${appCount !== 1 ? 's' : ''}`);
    }
    
    return summaryParts.length > 0 ? summaryParts.join(', ') : 'No entitlements';
  }

  /**
   * Private: Extract tenant name from payload
   */
  private extractTenantName(payload: EntitlementPayload): string | null {
    return payload.properties?.provisioningDetail?.tenantName ||
           payload.properties?.tenantName ||
           payload.preferredSubdomain1 ||
           payload.preferredSubdomain2 ||
           payload.properties?.preferredSubdomain1 ||
           payload.properties?.preferredSubdomain2 ||
           payload.tenantName ||
           null;
  }
}

export default SalesforceService;

