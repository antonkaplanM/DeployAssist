/**
 * Common Type Definitions
 * Shared types used across the application
 */

// ===== API Response Types =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  totalCount: number;
  pageSize: number;
  offset: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

// ===== Error Types =====

export enum ErrorCode {
  // Authentication Errors (1000-1099)
  AUTH_MISSING = 1000,
  AUTH_INVALID = 1001,
  AUTH_EXPIRED = 1002,
  
  // Validation Errors (1100-1199)
  VALIDATION_FAILED = 1100,
  INVALID_INPUT = 1101,
  MISSING_REQUIRED_FIELD = 1102,
  
  // Database Errors (1200-1299)
  DATABASE_CONNECTION_FAILED = 1200,
  DATABASE_QUERY_FAILED = 1201,
  DATABASE_TRANSACTION_FAILED = 1202,
  
  // External Service Errors (1300-1399)
  SALESFORCE_CONNECTION_FAILED = 1300,
  SALESFORCE_QUERY_FAILED = 1301,
  SALESFORCE_AUTH_FAILED = 1302,
  ATLASSIAN_CONNECTION_FAILED = 1310,
  ATLASSIAN_QUERY_FAILED = 1311,
  
  // Business Logic Errors (1400-1499)
  RESOURCE_NOT_FOUND = 1400,
  DUPLICATE_RESOURCE = 1401,
  INVALID_OPERATION = 1402,
  
  // System Errors (1500-1599)
  INTERNAL_ERROR = 1500,
  CONFIGURATION_ERROR = 1501,
  TIMEOUT_ERROR = 1502
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  stack?: string;
  isOperational?: boolean;
}

// ===== Configuration Types =====

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  enableSSL: boolean;
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    maxConnections: number;
  };
  salesforce: {
    loginUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokenFile: string;
  };
  atlassian?: {
    email: string;
    apiToken: string;
    siteUrl: string;
    cloudId?: string;
  };
}

// ===== Logging Types =====

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose'
}

export interface LogMetadata {
  [key: string]: any;
  timestamp?: string;
  service?: string;
  userId?: string;
  requestId?: string;
}

// ===== Validation Types =====

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  enabled: boolean;
  category: string;
  version: string;
  createdDate: string;
}

export interface ValidationResult {
  recordId: string;
  recordName: string;
  overallStatus: 'PASS' | 'FAIL';
  ruleResults: RuleResult[];
  hasErrors: boolean;
  validatedAt: string;
}

export interface RuleResult {
  ruleId: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details: any;
}

// ===== Query Builder Types =====

export interface WhereClause {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

export interface QueryOptions {
  select?: string[];
  where?: WhereClause[];
  orderBy?: {
    field: string;
    direction: 'ASC' | 'DESC';
  }[];
  limit?: number;
  offset?: number;
}

// ===== Health Check Types =====

export interface HealthCheckResult {
  status: 'OK' | 'DEGRADED' | 'ERROR';
  timestamp: string;
  uptime: number;
  services: {
    database?: ServiceHealth;
    salesforce?: ServiceHealth;
    cache?: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'OK' | 'ERROR';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

