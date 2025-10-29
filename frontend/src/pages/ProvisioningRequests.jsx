import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ArrowPathIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ProductModal from '../components/features/ProductModal';
import SMLComparisonModal from '../components/features/SMLComparisonModal';
import ActionsMenu from '../components/common/ActionsMenu';
import TypeAheadSearch from '../components/common/TypeAheadSearch';
import { getProvisioningRequests, searchProvisioning, getProvisioningFilterOptions } from '../services/provisioningService';
import { validateRecord, getValidationTooltip, parseEntitlements, parseTenantName } from '../utils/validationEngine';
import { fetchSMLTenantDetails, getSMLConfig } from '../services/smlCompareService';

const ENABLED_VALIDATION_RULES = [
  'app-quantity-validation',
  'entitlement-date-overlap-validation',
  'entitlement-date-gap-validation',
  'app-package-name-validation'
];

const ProvisioningRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [exactMatchFilter, setExactMatchFilter] = useState(null);
  const [filters, setFilters] = useState({
    requestType: '',
    status: '',
  });
  const [filterOptions, setFilterOptions] = useState({
    requestTypes: [],
    statuses: [],
    loading: true,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    pageSize: 25,
  });
  const [validationResults, setValidationResults] = useState(new Map());
  const [productModal, setProductModal] = useState({
    isOpen: false,
    products: [],
    productType: '',
    requestName: '',
    validationResult: null,
  });
  const [smlComparisonModal, setSmlComparisonModal] = useState({
    isOpen: false,
    salesforceData: null,
    smlData: null,
    tenantName: '',
    loading: false,
    error: null,
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'created',
    direction: 'desc',
  });

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const data = await getProvisioningFilterOptions();
        if (data.success) {
          setFilterOptions({
            requestTypes: data.requestTypes || [],
            statuses: data.statuses || [],
            loading: false,
          });
        } else {
          console.error('Failed to fetch filter options:', data.error);
          setFilterOptions({
            requestTypes: [],
            statuses: [],
            loading: false,
          });
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
        setFilterOptions({
          requestTypes: [],
          statuses: [],
          loading: false,
        });
      }
    };

    fetchFilterOptions();
  }, []);

  // Handle exact match filter from URL
  useEffect(() => {
    const exactMatch = searchParams.get('exact');
    if (exactMatch) {
      setExactMatchFilter(exactMatch);
      setSearchTerm(exactMatch);
    }
  }, [searchParams]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [filters.requestType, filters.status, filters.accountId]);

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.requestType, filters.status, filters.accountId, pagination.currentPage, exactMatchFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        offset: (pagination.currentPage - 1) * pagination.pageSize,
        pageSize: pagination.pageSize,
        // Don't send search param if we have a specific accountId filter
        search: filters.accountId ? undefined : (exactMatchFilter || searchTerm || undefined),
      };
      const data = await getProvisioningRequests(params);
      
      if (data.success) {
        let filteredRecords = data.records || [];
        
        // Apply exact match filter client-side if set
        if (exactMatchFilter) {
          filteredRecords = filteredRecords.filter(record => record.Name === exactMatchFilter);
          console.log(`🔍 Applied exact match filter for: ${exactMatchFilter}, found ${filteredRecords.length} record(s)`);
        }
        
        setRequests(filteredRecords);
        setPagination(prev => ({
          ...prev,
          totalPages: data.totalPages || 1,
          totalRecords: exactMatchFilter ? filteredRecords.length : (data.totalCount || 0),
        }));

        // Run validation on all records
        const validations = new Map();
        filteredRecords.forEach(record => {
          const result = validateRecord(record, ENABLED_VALIDATION_RULES);
          validations.set(record.Id, result);
        });
        setValidationResults(validations);
      }
    } catch (err) {
      console.error('Error fetching provisioning requests:', err);
      setError(err.message || 'Failed to load provisioning requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRequests();
  };

  // Handle type-ahead search selection
  const handleSearchSelect = (item) => {
    if (item.type === 'technical_request') {
      // Filter by specific technical request
      setSearchTerm(item.name);
      setExactMatchFilter(item.name);
      // Clear account filter when filtering by technical request
      setFilters(prev => ({ ...prev, accountId: undefined }));
    } else if (item.type === 'account') {
      // Filter by account - use account name (not ID) since Account__c field stores names
      setSearchTerm(item.name);
      setFilters(prev => ({ ...prev, accountId: item.name }));
      // Clear exact match filter when filtering by account
      setExactMatchFilter(null);
    }
  };

  // Wrapper for searchProvisioning that matches the expected signature
  const searchFunction = async (term, limit, signal) => {
    try {
      return await searchProvisioning(term, limit);
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return { success: false, results: { technicalRequests: [], accounts: [] } };
    }
  };

  const handleExport = () => {
    if (requests.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Technical Team Request',
      'Account',
      'Account Site',
      'Request Type',
      'Deployment Number',
      'Tenant Name',
      'Status',
      'Created Date',
      'Created By'
    ];
    
    const csvContent = [
      headers.join(','),
      ...requests.map(request => [
        request.Name || '',
        request.Account__c || '',
        request.Account_Site__c || '',
        request.TenantRequestAction__c || '',
        request.Deployment__r?.Name || '',
        parseTenantName(request),
        getStatusText(request),
        new Date(request.CreatedDate).toLocaleDateString(),
        request.CreatedBy?.Name || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provisioning-requests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const openProductModal = (products, type, requestName, validationResult = null) => {
    setProductModal({
      isOpen: true,
      products,
      productType: type,
      requestName,
      validationResult,
    });
  };

  const closeProductModal = () => {
    setProductModal({
      isOpen: false,
      products: [],
      productType: '',
      requestName: '',
      validationResult: null,
    });
  };

  const handleSMLCompare = async (request) => {
    // Extract tenant name
    const tenantName = parseTenantName(request);
    
    if (!tenantName) {
      alert('Unable to determine tenant name from this request');
      return;
    }

    // Check SML configuration
    try {
      const config = await getSMLConfig();
      if (!config.configured || !config.hasAuthCookie) {
        alert('SML is not configured. Please configure SML authentication in Settings before using SML Compare.');
        return;
      }
    } catch (error) {
      console.error('Error checking SML config:', error);
      alert('Failed to check SML configuration. Please try again.');
      return;
    }

    // Open modal in loading state
    setSmlComparisonModal({
      isOpen: true,
      salesforceData: request,
      smlData: null,
      tenantName,
      loading: true,
      error: null,
    });

    // Fetch SML tenant details
    try {
      const result = await fetchSMLTenantDetails(tenantName);
      
      if (result.success && result.tenantDetails) {
        setSmlComparisonModal(prev => ({
          ...prev,
          smlData: result.tenantDetails,
          loading: false,
        }));
      } else {
        setSmlComparisonModal(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to fetch SML tenant details',
        }));
      }
    } catch (error) {
      console.error('Error fetching SML tenant details:', error);
      setSmlComparisonModal(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch SML tenant details',
      }));
    }
  };

  const closeSMLComparisonModal = () => {
    setSmlComparisonModal({
      isOpen: false,
      salesforceData: null,
      smlData: null,
      tenantName: '',
      loading: false,
      error: null,
    });
  };

  const getStatusText = (request) => {
    if (request.SMLErrorMessage__c && request.SMLErrorMessage__c.trim() !== '') {
      return 'Provisioning Failed';
    }
    return request.Status__c || 'Unknown';
  };

  const getStatusColor = (request) => {
    const status = getStatusText(request);
    const colorMap = {
      'Provisioning Failed': 'bg-red-100 text-red-800',
      'Completed': 'bg-green-100 text-green-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Pending': 'bg-blue-100 text-blue-800',
      'Unknown': 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const renderProductsColumn = (request) => {
    const entitlements = parseEntitlements(request.Payload_Data__c);
    const validationResult = validationResults.get(request.Id);
    
    if (!entitlements) {
      return <span className="text-xs text-gray-500">No payload data</span>;
    }

    const { models, data, apps } = entitlements;
    const totalCount = models.length + data.length + apps.length;

    if (totalCount === 0) {
      return <span className="text-xs text-gray-500">No entitlements</span>;
    }

    // Helper functions to check for validation failures per product type
    const hasValidationFailureForType = (type) => {
      if (!validationResult || validationResult.overallStatus !== 'FAIL') return false;

      // Check for date overlap/gap issues
      const dateOverlapRule = validationResult.ruleResults?.find(
        rule => rule.ruleId === 'entitlement-date-overlap-validation' && rule.status === 'FAIL'
      );
      const dateGapRule = validationResult.ruleResults?.find(
        rule => rule.ruleId === 'entitlement-date-gap-validation' && rule.status === 'FAIL'
      );

      const typeMap = { models: 'model', data: 'data', apps: 'app' };
      const validationType = typeMap[type];

      if (dateOverlapRule?.details?.overlaps) {
        const hasOverlap = dateOverlapRule.details.overlaps.some(
          overlap => overlap.entitlement1.type === validationType || overlap.entitlement2.type === validationType
        );
        if (hasOverlap) return true;
      }

      if (dateGapRule?.details?.gaps) {
        const hasGap = dateGapRule.details.gaps.some(
          gap => gap.entitlement1.type === validationType || gap.entitlement2.type === validationType
        );
        if (hasGap) return true;
      }

      // Check for app-specific validation failures
      if (type === 'apps') {
        const appQuantityRule = validationResult.ruleResults?.find(
          rule => rule.ruleId === 'app-quantity-validation' && rule.status === 'FAIL'
        );
        if (appQuantityRule) return true;

        const appPackageNameRule = validationResult.ruleResults?.find(
          rule => rule.ruleId === 'app-package-name-validation' && rule.status === 'FAIL'
        );
        if (appPackageNameRule) return true;
      }

      // Check for model-specific validation failures
      if (type === 'models') {
        const modelCountRule = validationResult.ruleResults?.find(
          rule => rule.ruleId === 'model-count-validation' && rule.status === 'FAIL'
        );
        if (modelCountRule) return true;
      }

      return false;
    };

    const modelsHasFailure = models.length > 0 && hasValidationFailureForType('models');
    const dataHasFailure = data.length > 0 && hasValidationFailureForType('data');
    const appsHasFailure = apps.length > 0 && hasValidationFailureForType('apps');

    return (
      <div className="flex flex-wrap gap-1">
        {models.length > 0 && (
          <button
            onClick={() => openProductModal(models, 'models', request.Name, validationResult)}
            className={`inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors ${
              modelsHasFailure ? 'ring-2 ring-red-400' : ''
            }`}
          >
            📊 Models ({models.length})
          </button>
        )}
        {data.length > 0 && (
          <button
            onClick={() => openProductModal(data, 'data', request.Name, validationResult)}
            className={`inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors ${
              dataHasFailure ? 'ring-2 ring-red-400' : ''
            }`}
          >
            💾 Data ({data.length})
          </button>
        )}
        {apps.length > 0 && (
          <button
            onClick={() => openProductModal(apps, 'apps', request.Name, validationResult)}
            className={`inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors ${
              appsHasFailure ? 'ring-2 ring-red-400' : ''
            }`}
          >
            📱 Apps ({apps.length})
          </button>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 px-1">({totalCount} total)</span>
      </div>
    );
  };

  const renderValidationColumn = (request) => {
    const result = validationResults.get(request.Id);
    
    if (!result) {
      return (
        <span 
          className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-800"
          title="All validation rules passed"
        >
          Pass
        </span>
      );
    }

    const statusClass = result.overallStatus === 'PASS' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
    const tooltip = getValidationTooltip(result);

    return (
      <span 
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}
        title={tooltip}
      >
        {result.overallStatus}
      </span>
    );
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="page-provisioning" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Provisioning Monitor</h1>
        <p className="mt-2 text-gray-600">
          Monitor and manage Professional Services provisioning requests with advanced search and filtering
        </p>
      </div>

      {/* Exact Match Filter Badge */}
      {exactMatchFilter && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-blue-900">
              <strong>Exact Match Filter:</strong> Showing only <code className="px-2 py-0.5 bg-blue-100 rounded">{exactMatchFilter}</code>
            </span>
          </div>
          <button
            onClick={() => {
              setExactMatchFilter(null);
              setSearchTerm('');
              setSearchParams({});
            }}
            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-300 dark:text-blue-300 hover:bg-blue-100 rounded transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Account Filter Badge */}
      {filters.accountId && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-900 dark:text-green-100">
              <strong>Account Filter:</strong> Showing only <code className="px-2 py-0.5 bg-green-100 dark:bg-green-800 rounded">{filters.accountId}</code>
            </span>
          </div>
          <button
            onClick={() => {
              setFilters(prev => ({ ...prev, accountId: undefined }));
              setSearchTerm('');
            }}
            className="px-3 py-1 text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search with Type-Ahead */}
        <div className="flex-1">
          <TypeAheadSearch
            searchFunction={searchFunction}
            onSelect={handleSearchSelect}
            placeholder="Search Technical Team Requests or Accounts..."
            debounceDelay={300}
            minSearchLength={2}
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filters.requestType}
            onChange={(e) => setFilters({ ...filters, requestType: e.target.value })}
            className="px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
            disabled={filterOptions.loading}
          >
            <option value="">All Request Types</option>
            {filterOptions.requestTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
            disabled={filterOptions.loading}
          >
            <option value="">All Statuses</option>
            {filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 disabled:opacity-50 text-gray-900 dark:text-gray-100 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={requests.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Technical Team Request
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Request Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Deployment
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Tenant Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Products
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Data Validations
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Created Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Created By
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                    No provisioning requests found
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.Id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{request.Name || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{request.Account__c || 'N/A'}</div>
                      {request.Account_Site__c && (
                        <div className="text-xs text-gray-500">{request.Account_Site__c}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{request.TenantRequestAction__c || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{request.Deployment__r?.Name || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{parseTenantName(request)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {renderProductsColumn(request)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderValidationColumn(request)}
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(request)}`}
                        title={request.SMLErrorMessage__c || ''}
                      >
                        {getStatusText(request)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {new Date(request.CreatedDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(request.CreatedDate).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{request.CreatedBy?.Name || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionsMenu 
                        request={request} 
                        onRefresh={fetchRequests}
                        onSMLCompare={handleSMLCompare}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{((pagination.currentPage - 1) * pagination.pageSize) + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords)}
              </span> of{' '}
              <span className="font-medium">{pagination.totalRecords}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={productModal.isOpen}
        onClose={closeProductModal}
        products={productModal.products}
        productType={productModal.productType}
        requestName={productModal.requestName}
        validationResult={productModal.validationResult}
      />

      {/* SML Comparison Modal */}
      {smlComparisonModal.loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Fetching SML Data...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Retrieving tenant details for <strong>{smlComparisonModal.tenantName}</strong>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  This may take a few moments
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : smlComparisonModal.error ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <div className="flex flex-col items-center gap-4">
              <svg className="h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Failed to Fetch SML Data
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                  {smlComparisonModal.error}
                </p>
                <button
                  onClick={closeSMLComparisonModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <SMLComparisonModal
          isOpen={smlComparisonModal.isOpen && !smlComparisonModal.loading && !smlComparisonModal.error}
          onClose={closeSMLComparisonModal}
          salesforceData={smlComparisonModal.salesforceData}
          smlData={smlComparisonModal.smlData}
          tenantName={smlComparisonModal.tenantName}
        />
      )}
    </div>
  );
};

export default ProvisioningRequests;
