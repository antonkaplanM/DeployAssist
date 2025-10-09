/**
 * Salesforce Repository
 * Data access layer for Salesforce operations
 * Handles only connection and raw queries - no business logic
 */
import { Connection, QueryResult, DescribeSObjectResult, IdentityInfo } from 'jsforce';
/**
 * Salesforce Repository Class
 */
export declare class SalesforceRepository {
    private static connectionInstance;
    private readonly tokenFile;
    constructor();
    /**
     * Get or create Salesforce connection
     */
    getConnection(): Promise<Connection>;
    /**
     * Check if valid authentication exists
     */
    hasValidAuthentication(): Promise<boolean>;
    /**
     * Execute a SOQL query
     */
    query<T extends Record<string, any> = any>(soql: string): Promise<QueryResult<T>>;
    /**
     * Get object description (metadata)
     */
    describe(objectName: string): Promise<DescribeSObjectResult>;
    /**
     * Get identity information
     */
    getIdentity(): Promise<IdentityInfo>;
    /**
     * Test connection
     */
    testConnection(): Promise<{
        success: boolean;
        details?: any;
        error?: string;
    }>;
    /**
     * Private: Make HTTPS request (for OAuth)
     */
    private makeHttpsRequest;
    /**
     * Private: Load auth from disk
     */
    private loadAuthFromDisk;
    /**
     * Private: Save auth to disk
     */
    private saveAuthToDisk;
    /**
     * Private: Clear auth from disk
     */
    private clearAuthFromDisk;
}
export default SalesforceRepository;
//# sourceMappingURL=SalesforceRepository.d.ts.map