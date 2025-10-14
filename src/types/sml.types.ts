/**
 * SML Integration Type Definitions
 * Types for SML API integration (Apps, Models, Data entitlements)
 */

// ===== Configuration Types =====

export interface SMLConfig {
  environment: 'euw1' | 'use1';
  authCookie: string | null;
}

export interface SMLEnvironments {
  euw1: string;
  use1: string;
}

// ===== API Response Types =====

/**
 * SML Apps Entitlement
 * From: /sml/entitlements/v1/tenants/{tenant-id}/apps/current
 */
export interface SMLAppEntitlement {
  appId?: string;
  appCode?: string;
  productCode: string;
  productName?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  quantity?: number;
}

export interface SMLAppsResponse {
  apps?: SMLAppEntitlement[];
  entitlements?: SMLAppEntitlement[];
  data?: SMLAppEntitlement[];
}

/**
 * SML Models Entitlement
 * From: /v1/tenants/{tenant-id}/models/current
 */
export interface SMLModelEntitlement {
  modelId?: string;
  modelCode?: string;
  productCode: string;
  productName?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  version?: string;
}

export interface SMLModelsResponse {
  models?: SMLModelEntitlement[];
  entitlements?: SMLModelEntitlement[];
  data?: SMLModelEntitlement[];
}

/**
 * SML Data Entitlement
 * From: /v1/tenants/{tenant-id}/data/current
 */
export interface SMLDataEntitlement {
  dataId?: string;
  dataCode?: string;
  productCode: string;
  productName?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  dataType?: string;
}

export interface SMLDataResponse {
  data?: SMLDataEntitlement[];
  entitlements?: SMLDataEntitlement[];
  datasets?: SMLDataEntitlement[];
}

// ===== Unified Product Types =====

export interface SMLProduct {
  productCode: string;
  productName: string | null;
  category: 'apps' | 'models' | 'data';
  startDate: string | null;
  endDate: string | null;
  status: 'active' | 'expired' | 'pending';
  daysRemaining: number | null;
  additionalInfo?: Record<string, any>;
}

export interface SMLProductsByCategory {
  apps: SMLProduct[];
  models: SMLProduct[];
  data: SMLProduct[];
}

// ===== Service Result Types =====

export interface SMLTenantProductsResult {
  success: boolean;
  tenantId: string;
  tenantName: string | null;
  products: SMLProductsByCategory;
  summary: {
    totalActive: number;
    byCategory: {
      apps: number;
      models: number;
      data: number;
    };
  };
  fetchedAt: string;
  error?: string;
}

export interface SMLConnectionTestResult {
  success: boolean;
  environment?: string;
  baseUrl?: string;
  authenticated?: boolean;
  error?: string;
}

// ===== Error Types =====

export class SMLError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SMLError';
  }
}

export class SMLAuthError extends SMLError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'SMLAuthError';
  }
}

export class SMLConnectionError extends SMLError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'SMLConnectionError';
  }
}

