/**
 * Salesforce Service
 * Business logic layer for Salesforce operations
 * Handles parsing, validation, and data transformation
 */
import { SalesforceRepository } from '../repositories/SalesforceRepository';
import { ProfServicesQueryFilters, ProfServicesQueryResult, ParsedPayloadData, FilterOptionsResult } from '../types/salesforce.types';
/**
 * Salesforce Service Class
 */
export declare class SalesforceService {
    private repository;
    constructor(repository?: SalesforceRepository);
    /**
     * Query Professional Services Requests with filters and pagination
     */
    queryProfServicesRequests(filters: ProfServicesQueryFilters): Promise<ProfServicesQueryResult>;
    /**
     * Parse payload data from JSON string
     */
    parsePayloadData(jsonString: string | null | undefined): ParsedPayloadData;
    /**
     * Get filter options for dropdowns
     */
    getFilterOptions(): Promise<FilterOptionsResult>;
    /**
     * Test Salesforce connection
     */
    testConnection(): Promise<{
        success: boolean;
        details?: any;
        error?: string;
    }>;
    /**
     * Private: Build SOQL query with filters
     */
    private buildProfServicesQuery;
    /**
     * Private: Build count query
     */
    private buildProfServicesCountQuery;
    /**
     * Private: Escape SOQL special characters
     */
    private escapeSOQL;
    /**
     * Private: Process record with parsed payload
     */
    private processRecord;
    /**
     * Private: Get empty payload data
     */
    private getEmptyPayloadData;
    /**
     * Private: Create entitlement summary
     */
    private createEntitlementSummary;
    /**
     * Private: Extract tenant name from payload
     */
    private extractTenantName;
}
export default SalesforceService;
//# sourceMappingURL=SalesforceService.d.ts.map