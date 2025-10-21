import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ProductModal from '../components/features/ProductModal';
import ActionsMenu from '../components/common/ActionsMenu';
import { getProvisioningRequests, searchProvisioning } from '../services/provisioningService';
import { validateRecord, getValidationTooltip, parseEntitlements, parseTenantName } from '../utils/validationEngine';

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
  const [sortConfig, setSortConfig] = useState({
    key: 'created',
    direction: 'desc',
  });

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
  }, [filters.requestType, filters.status]);

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.requestType, filters.status, pagination.currentPage, exactMatchFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        offset: (pagination.currentPage - 1) * pagination.pageSize,
        pageSize: pagination.pageSize,
        search: exactMatchFilter || searchTerm || undefined,
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
    // In a real implementation, this would trigger a new API call with search param
    fetchRequests();
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
        parseTenantName(request.Payload_Data__c),
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
        <span className="text-xs text-gray-500 px-1">({totalCount} total)</span>
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
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
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PS Request or Account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filters.requestType}
            onChange={(e) => setFilters({ ...filters, requestType: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Request Types</option>
            <option value="Tenant Request Add">Add</option>
            <option value="Tenant Request Update">Update</option>
            <option value="Tenant Request Remove">Remove</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
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
                      <div className="text-sm text-gray-900">{parseTenantName(request.Payload_Data__c)}</div>
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
                      <ActionsMenu request={request} onRefresh={fetchRequests} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
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
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default ProvisioningRequests;
