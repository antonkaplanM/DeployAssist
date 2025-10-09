/**
 * Salesforce Type Definitions
 * Comprehensive types for Prof_Services_Request__c and related objects
 */
export interface ProfServicesRequest {
    Id: string;
    Name: string;
    Account__c: string;
    Account_Site__c: string | null;
    Status__c: string;
    Deployment__c: string | null;
    Billing_Status__c: string | null;
    RecordTypeId: string | null;
    TenantRequestAction__c: string | null;
    Tenant_Name__c: string | null;
    Payload_Data__c: string | null;
    Requested_Install_Date__c: string | null;
    RequestedGoLiveDate__c: string | null;
    CreatedDate: string;
    LastModifiedDate: string;
    CreatedBy?: {
        Name: string;
    };
    Deployment__r?: {
        Name: string;
    };
}
export interface EntitlementPayload {
    properties?: {
        provisioningDetail?: {
            tenantName?: string;
            region?: string;
            entitlements?: EntitlementsObject;
        };
        tenantName?: string;
        region?: string;
        preferredSubdomain1?: string;
        preferredSubdomain2?: string;
    };
    preferredSubdomain1?: string;
    preferredSubdomain2?: string;
    tenantName?: string;
    region?: string;
    entitlements?: EntitlementsObject;
    productEntitlements?: ProductEntitlement[];
    dataEntitlements?: DataEntitlement[];
    appEntitlements?: AppEntitlement[];
    modelEntitlements?: ModelEntitlement[];
}
export interface EntitlementsObject {
    modelEntitlements?: ModelEntitlement[];
    dataEntitlements?: DataEntitlement[];
    appEntitlements?: AppEntitlement[];
}
export interface BaseEntitlement {
    productCode: string;
    name?: string;
    productName?: string;
    startDate?: string;
    endDate?: string;
    start_date?: string;
    end_date?: string;
    StartDate?: string;
    EndDate?: string;
    quantity?: number;
    packageName?: string;
}
export interface ModelEntitlement extends BaseEntitlement {
    code?: string;
    id?: string;
}
export interface DataEntitlement extends BaseEntitlement {
    code?: string;
    id?: string;
}
export interface AppEntitlement extends BaseEntitlement {
    product_code?: string;
    ProductCode?: string;
}
export interface ProductEntitlement extends BaseEntitlement {
    code?: string;
    id?: string;
}
export interface ParsedPayloadData {
    productEntitlements: ProductEntitlement[];
    modelEntitlements: ModelEntitlement[];
    dataEntitlements: DataEntitlement[];
    appEntitlements: AppEntitlement[];
    totalCount: number;
    summary: string;
    hasDetails: boolean;
    rawPayload?: EntitlementPayload;
    tenantName?: string | null;
    region?: string | null;
    error?: string;
}
export interface ProfServicesQueryFilters {
    requestType?: string;
    accountId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    pageSize?: number;
    offset?: number;
}
export interface ProfServicesQueryResult {
    success: boolean;
    records: ProfServicesRequest[];
    totalCount: number;
    pageSize: number;
    offset: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
    error?: string;
}
export interface FilterOptionsResult {
    success: boolean;
    requestTypes: string[];
    statuses: string[];
    accounts: string[];
    error?: string;
}
export interface ExpirationData {
    accountId: string;
    accountName: string;
    psRecordId: string;
    psRecordName: string;
    productCode: string;
    productName: string;
    productType: 'Model' | 'Data' | 'App';
    endDate: string;
    daysUntilExpiry: number;
    isExtended: boolean;
    extendingPsRecordId: string | null;
    extendingPsRecordName: string | null;
    extendingEndDate: string | null;
}
export interface ExpirationAnalysisResult {
    success: boolean;
    recordsAnalyzed: number;
    entitlementsProcessed: number;
    expirationsFound: number;
    extensionsFound: number;
    removedInSubsequentRecord?: number;
    expirationData: ExpirationData[];
    lookbackYears?: number;
    expirationWindow?: number;
    error?: string;
}
export interface CustomerProduct {
    productCode: string;
    productName: string;
    packageName: string | null;
    category: 'models' | 'data' | 'apps';
    region: string;
    startDate: string | null;
    endDate: string | null;
    status: 'active' | 'expiring-soon' | 'expiring';
    daysRemaining: number;
    sourcePSRecords: string[];
    isDataBridge: boolean;
}
export interface ProductsByRegion {
    [region: string]: {
        models: CustomerProduct[];
        data: CustomerProduct[];
        apps: CustomerProduct[];
    };
}
export interface CustomerProductsResult {
    success: boolean;
    account: string;
    summary: {
        totalActive: number;
        byCategory: {
            models: number;
            data: number;
            apps: number;
        };
    };
    productsByRegion: ProductsByRegion;
    lastUpdated: {
        psRecordId: string;
        date: string;
    } | null;
    psRecordsAnalyzed: number;
    error?: string;
}
export interface RequestTypeAnalytics {
    requestType: string;
    count: number;
    validationFailures: number;
    validationFailureRate: string;
    percentage: string;
}
export interface AnalyticsResult {
    success: boolean;
    data: RequestTypeAnalytics[];
    totalRequests: number;
    totalValidationFailures: number;
    enabledRulesCount: number;
    period: {
        startDate: string;
        endDate: string;
    };
    error?: string;
}
export interface ValidationTrendDataPoint {
    date: string;
    displayDate: string;
    total: number;
    failures: number;
    failurePercentage: string;
    updateTotal: number;
    updateFailures: number;
    updateFailurePercentage: string;
    onboardingTotal: number;
    onboardingFailures: number;
    onboardingFailurePercentage: string;
    deprovisionTotal: number;
    deprovisionFailures: number;
    deprovisionFailurePercentage: string;
}
export interface ValidationTrendResult {
    success: boolean;
    trendData: ValidationTrendDataPoint[];
    period: {
        startDate: string;
        endDate: string;
    };
    error?: string;
}
export interface GhostAccountAnalysis {
    success: boolean;
    isGhost: boolean;
    accountId?: string;
    accountName?: string;
    totalExpiredProducts?: number;
    latestExpiryDate?: string;
    psRecordsAnalyzed?: number;
    reason?: string;
    deprovisioningRecord?: string;
    error?: string;
}
export interface DeprovisionedAccount {
    accountId: string;
    accountName: string;
    totalExpiredProducts: number;
    latestExpiryDate: string;
    deprovisioningRecord: {
        id: string;
        name: string;
        createdDate: string;
        status: string;
    };
    daysSinceDeprovisioning: number;
}
export interface ProductRemoval {
    productCode: string;
    name: string;
    type: 'Model' | 'Data' | 'App';
}
export interface RemovalsAnalysis {
    hasRemovals: boolean;
    removedModels: ProductRemoval[];
    removedData: ProductRemoval[];
    removedApps: ProductRemoval[];
    totalCount: number;
    summary: string;
}
export interface PSRequestWithRemovals {
    currentRequest: {
        id: string;
        name: string;
        account: string;
        status: string;
        requestType: string;
        createdDate: string;
    };
    previousRequest: {
        id: string;
        name: string;
        createdDate: string;
    };
    removals: RemovalsAnalysis;
}
//# sourceMappingURL=salesforce.types.d.ts.map