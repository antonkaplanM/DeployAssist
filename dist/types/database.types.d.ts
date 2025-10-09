/**
 * Database Type Definitions
 * Types for PostgreSQL database operations
 */
import { PoolConfig } from 'pg';
export interface DatabaseConfig extends PoolConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}
export interface ConnectionTestResult {
    success: boolean;
    connected: boolean;
    timestamp?: string;
    database?: string;
    user?: string;
    error?: string;
}
export interface PoolStats {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
}
export interface DatabaseResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    count?: number;
}
export interface ExpirationMonitorRow {
    id?: number;
    account_id: string;
    account_name: string;
    ps_record_id: string;
    ps_record_name: string;
    product_code: string;
    product_name: string;
    product_type: 'Model' | 'Data' | 'App';
    end_date: string;
    is_extended: boolean;
    extending_ps_record_id: string | null;
    extending_ps_record_name: string | null;
    extending_end_date: string | null;
    days_until_expiry: number;
    last_analyzed: Date;
    created_at?: Date;
}
export interface ExpirationSummary {
    total_expiring: string;
    at_risk: string;
    extended: string;
    accounts_affected: string;
    ps_records_affected?: string;
    earliest_expiry?: string;
    latest_expiry?: string;
}
export interface ExpirationQueryFilters {
    expirationWindow?: number;
    showExtended?: boolean;
    accountId?: string;
    productType?: 'Model' | 'Data' | 'App';
}
export interface ExpirationAnalysisLog {
    id?: number;
    analysis_started: Date;
    analysis_completed: Date;
    records_analyzed: number;
    entitlements_processed: number;
    expirations_found: number;
    extensions_found: number;
    lookback_years: number;
    status: 'completed' | 'failed' | 'schema_initialized';
    error_message: string | null;
    created_at?: Date;
}
export interface AnalysisStatus {
    success: boolean;
    hasAnalysis: boolean;
    analysis?: ExpirationAnalysisLog;
    error?: string;
}
export interface AllAccountRow {
    id?: number;
    account_id: string;
    account_name: string;
    total_ps_records: number;
    latest_ps_date: Date | null;
    first_seen?: Date;
    last_synced: Date;
    updated_at?: Date;
}
export interface AllAccountsFilters {
    search?: string;
}
export interface AllAccountsSummary {
    total_accounts: string;
    last_sync_time: Date | null;
}
export interface GhostAccountRow {
    id?: number;
    account_id: string;
    account_name: string;
    total_expired_products: number;
    latest_expiry_date: Date;
    last_checked: Date;
    is_reviewed: boolean;
    reviewed_at: Date | null;
    reviewed_by: string | null;
    notes: string | null;
    created_at?: Date;
    updated_at?: Date;
}
export interface GhostAccountFilters {
    isReviewed?: boolean;
    accountSearch?: string;
    expiryBefore?: Date;
    expiryAfter?: Date;
}
export interface GhostAccountsSummary {
    total_ghost_accounts: string;
    unreviewed: string;
    reviewed: string;
    earliest_expiry: Date | null;
    most_recent_expiry: Date | null;
    total_expired_products: string;
}
export interface PackageRow {
    id?: number;
    sf_package_id: string;
    package_name: string;
    ri_package_name: string | null;
    package_type: 'Base' | 'Expansion' | null;
    parent_package_id: string | null;
    locations: string | null;
    max_concurrent_model: number | null;
    max_concurrent_non_model: number | null;
    max_concurrent_accumulation_jobs: number | null;
    max_concurrent_non_accumulation_jobs: number | null;
    max_jobs_day: number | null;
    max_users: number | null;
    number_edms: number | null;
    max_exposure_storage_tb: number | null;
    max_other_storage_tb: number | null;
    max_risks_accumulated_day: number | null;
    max_risks_single_accumulation: number | null;
    api_rps: number | null;
    description: string | null;
    sf_owner_id: string | null;
    sf_created_by_id: string | null;
    sf_last_modified_by_id: string | null;
    is_deleted: boolean;
    metadata: any | null;
    last_synced: Date;
    created_at?: Date;
    updated_at?: Date;
}
export interface PackagesSummary {
    total_packages: string;
    active_packages: string;
    deleted_packages: string;
    base_packages: string;
    expansion_packages: string;
    last_sync_time: Date | null;
}
export interface PackageQueryOptions {
    includeDeleted?: boolean;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
//# sourceMappingURL=database.types.d.ts.map