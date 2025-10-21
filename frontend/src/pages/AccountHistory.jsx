import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  ClockIcon,
  XMarkIcon,
  ChevronDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ActionsMenu from '../components/common/ActionsMenu';
import ProductModal from '../components/features/ProductModal';
import ComparisonModal from '../components/features/ComparisonModal';
import { searchAccounts, getAccountHistory } from '../services/accountHistoryService';

const AccountHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters
  const [deploymentFilter, setDeploymentFilter] = useState('');
  const [showLimit, setShowLimit] = useState(5);
  const [showProductChanges, setShowProductChanges] = useState(false);
  const [deploymentOptions, setDeploymentOptions] = useState([]);
  
  // Comparison
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  
  // Product Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalData, setProductModalData] = useState({
    products: [],
    productType: '',
    requestName: ''
  });

  // Handle search
  const handleSearch = async (term) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const result = await searchAccounts(term);
      console.log('[AccountHistory] Search result:', result);
      
      if (result.success && result.results) {
        const searchResults = [];
        
        // Add PS-IDs (Technical Requests)
        // Backend returns: { id, name, account, status, requestType, type }
        if (result.results.technicalRequests && result.results.technicalRequests.length > 0) {
          result.results.technicalRequests.forEach(item => {
            if (item.name && item.account) {
              searchResults.push({
                type: 'ps-id',
                name: item.name,
                account: item.account,
                displayName: `${item.name} - ${item.account}`,
                id: item.id
              });
            }
          });
        }
        
        // Add unique accounts
        // Backend returns: { id, name, type }
        if (result.results.accounts && result.results.accounts.length > 0) {
          const uniqueAccounts = new Map();
          result.results.accounts.forEach(item => {
            if (item.name && !uniqueAccounts.has(item.name)) {
              uniqueAccounts.set(item.name, {
                type: 'account',
                name: item.name,
                displayName: item.name,
                id: item.id || item.name
              });
            }
          });
          searchResults.push(...Array.from(uniqueAccounts.values()));
        }
        
        console.log('[AccountHistory] Parsed search results:', searchResults);
        setSearchResults(searchResults);
      }
    } catch (err) {
      console.error('Error searching accounts:', err);
    } finally {
      setSearching(false);
    }
  };

  // Handle account selection
  const handleSelectAccount = async (account) => {
    console.log('[AccountHistory] Account selected:', account);
    setSelectedAccount(account);
    setSearchResults([]);
    setSearchTerm(account.displayName || account.name);
    setError(null);
    setLoading(true);
    setSelectedForComparison([]);

    try {
      // Use the account name for search (not PS-ID)
      const searchName = account.type === 'ps-id' ? account.account : account.name;
      console.log('[AccountHistory] Fetching history for:', searchName);
      
      const result = await getAccountHistory(searchName);
      console.log('[AccountHistory] History result:', result);
      
      if (result.success) {
        // Sort by date descending (newest first)
        const sorted = (result.requests || []).sort((a, b) => 
          new Date(b.CreatedDate) - new Date(a.CreatedDate)
        );
        setRequests(sorted);
        
        // Get unique deployment numbers
        const deployments = [...new Set(sorted.map(r => r.Deployment__r?.Name).filter(Boolean))];
        setDeploymentOptions(deployments);
        
        console.log('[AccountHistory] Loaded', sorted.length, 'requests');
      }
    } catch (err) {
      console.error('Error fetching account history:', err);
      setError('Failed to load account history');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...requests];
    
    // Apply deployment filter
    if (deploymentFilter) {
      filtered = filtered.filter(r => r.Deployment__r?.Name === deploymentFilter);
    }
    
    // Apply limit
    if (showLimit !== 'all') {
      filtered = filtered.slice(0, parseInt(showLimit));
    }
    
    setFilteredRequests(filtered);
  }, [requests, deploymentFilter, showLimit]);

  // Handle comparison checkbox
  const handleComparisonCheckbox = (request) => {
    setSelectedForComparison(prev => {
      const isSelected = prev.some(r => r.Id === request.Id);
      if (isSelected) {
        return prev.filter(r => r.Id !== request.Id);
      } else if (prev.length < 2) {
        return [...prev, request];
      }
      return prev;
    });
  };

  // Clear selection
  const handleClear = () => {
    setSelectedAccount(null);
    setSearchTerm('');
    setRequests([]);
    setFilteredRequests([]);
    setDeploymentFilter('');
    setShowLimit(5);
    setSelectedForComparison([]);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get date range
  const getDateRange = () => {
    if (requests.length === 0) return '-';
    const dates = requests.map(r => new Date(r.CreatedDate));
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));
    return `${oldest.toLocaleDateString()} - ${newest.toLocaleDateString()}`;
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const colors = {
      'Completed': 'bg-green-100 text-green-800 border-green-200',
      'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Failed': 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Parse payload data to extract product entitlements
  const parsePayloadData = (payloadString) => {
    if (!payloadString) {
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
    
    try {
      const payload = JSON.parse(payloadString);
      const entitlements = payload?.properties?.provisioningDetail?.entitlements || {};
      
      return {
        modelEntitlements: entitlements.modelEntitlements || [],
        dataEntitlements: entitlements.dataEntitlements || [],
        appEntitlements: entitlements.appEntitlements || []
      };
    } catch (err) {
      console.error('Error parsing payload:', err);
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
  };
  
  // Handle product group click
  const handleProductGroupClick = (requestName, groupType, entitlements) => {
    setProductModalData({
      products: entitlements,
      productType: groupType,
      requestName: requestName
    });
    setProductModalOpen(true);
  };

  return (
    <div className="space-y-6" id="page-account-history">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <ClockIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Account History</h1>
        </div>
        <p className="text-sm text-gray-600">
          View provisioning request history for any account
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Search for Account</h2>
        <p className="text-sm text-gray-600 mb-4">
          Search by account name (e.g., "Bank of America") or by Technical Team Request ID (e.g., "PS-4331")
        </p>
        
        <div className="relative">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              id="account-history-search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Enter account name or PS-ID..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div
              id="account-history-search-results"
              className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            >
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectAccount(item)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.type === 'ps-id' ? (
                      <ClockIcon className="h-5 w-5 text-blue-500" />
                    ) : (
                      <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.displayName}</div>
                      {item.type === 'ps-id' && (
                        <div className="text-xs text-gray-500">Technical Team Request</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account Summary */}
      {selectedAccount && (
        <div id="account-summary-section" className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900" id="account-summary-name">
                {selectedAccount.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                <span id="account-summary-count">{requests.length}</span> Technical Team Requests
                <span className="mx-2">•</span>
                <span id="account-summary-date-range">{getDateRange()}</span>
              </p>
            </div>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!selectedAccount && !loading && (
        <div
          id="account-history-empty-state"
          className="bg-white rounded-lg border border-gray-200 p-12 text-center"
        >
          <MagnifyingGlassIcon className="mx-auto h-16 w-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Search for an Account</h3>
          <p className="mt-2 text-sm text-gray-600">
            Use the search box above to find an account by name or by Technical Team Request ID
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Example: "Bank of America" or "PS-4331"
          </p>
        </div>
      )}

      {/* Request History Table */}
      {selectedAccount && !loading && requests.length > 0 && (
        <div id="account-history-table-section" className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Request History</h3>
                <p className="text-sm text-gray-600">
                  <span id="account-history-count-indicator">
                    {showLimit === 'all' 
                      ? `Showing all ${filteredRequests.length} requests` 
                      : `Showing latest ${Math.min(showLimit, filteredRequests.length)} of ${requests.length} requests`}
                  </span> in chronological order
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Deployment Filter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="deployment-filter" className="text-sm text-gray-600">
                    Deployment:
                  </label>
                  <select
                    id="deployment-filter"
                    value={deploymentFilter}
                    onChange={(e) => setDeploymentFilter(e.target.value)}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Deployments</option>
                    {deploymentOptions.map(dep => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>

                {/* Show Limit */}
                <div className="flex items-center gap-2">
                  <label htmlFor="show-limit" className="text-sm text-gray-600">
                    Show:
                  </label>
                  <select
                    id="show-limit"
                    value={showLimit}
                    onChange={(e) => setShowLimit(e.target.value)}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="5">Latest 5</option>
                    <option value="10">Latest 10</option>
                    <option value="25">Latest 25</option>
                    <option value="50">Latest 50</option>
                    <option value="all">All Requests</option>
                  </select>
                </div>

                {/* Product Changes Toggle */}
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showProductChanges}
                    onChange={(e) => setShowProductChanges(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Show Product Changes</span>
                </label>
              </div>
            </div>

            {/* Comparison Controls */}
            {selectedForComparison.length > 0 && (
              <div className="flex items-center gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowComparison(true)}
                  disabled={selectedForComparison.length !== 2}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedForComparison.length === 2
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                  View Side-by-Side
                </button>
                <button
                  onClick={() => setSelectedForComparison([])}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Selection
                </button>
                <span className="text-sm text-gray-600">
                  {selectedForComparison.length === 0 && 'Select any 2 records to compare'}
                  {selectedForComparison.length === 1 && 'Select 1 more record to compare'}
                  {selectedForComparison.length === 2 && 'Click "View Side-by-Side" to compare'}
                </span>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-10">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Request ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Deployment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tenant Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Products
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  const { modelEntitlements, dataEntitlements, appEntitlements } = parsePayloadData(request.Payload_Data__c);
                  
                  return (
                    <React.Fragment key={request.Id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedForComparison.some(r => r.Id === request.Id)}
                            onChange={() => handleComparisonCheckbox(request)}
                            disabled={selectedForComparison.length >= 2 && !selectedForComparison.some(r => r.Id === request.Id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-blue-600">
                            {request.Name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(request.CreatedDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {request.Deployment__r?.Name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {request.Tenant_Name__c || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.Status__c)}`}>
                            {request.Status__c || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {request.TenantRequestAction__c || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {modelEntitlements.length > 0 && (
                              <button
                                onClick={() => handleProductGroupClick(request.Name, 'models', modelEntitlements)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              >
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                                  {modelEntitlements.length}
                                </span>
                                Models
                              </button>
                            )}
                            {dataEntitlements.length > 0 && (
                              <button
                                onClick={() => handleProductGroupClick(request.Name, 'data', dataEntitlements)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 px-2 py-1 rounded transition-colors"
                              >
                                <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                                  {dataEntitlements.length}
                                </span>
                                Data
                              </button>
                            )}
                            {appEntitlements.length > 0 && (
                              <button
                                onClick={() => handleProductGroupClick(request.Name, 'apps', appEntitlements)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                              >
                                <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">
                                  {appEntitlements.length}
                                </span>
                                Apps
                              </button>
                            )}
                            {modelEntitlements.length === 0 && dataEntitlements.length === 0 && appEntitlements.length === 0 && (
                              <span className="text-xs text-gray-500">No products</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ActionsMenu request={request} />
                        </td>
                      </tr>
                      {showProductChanges && (
                        <tr className="bg-blue-50">
                          <td colSpan="9" className="px-4 py-3">
                            <div className="text-sm space-y-1">
                              <span className="font-medium text-gray-700">Product Details:</span>
                              {modelEntitlements.length > 0 && (
                                <div className="text-gray-600">
                                  <span className="font-medium">Models:</span> {modelEntitlements.map(m => m.productCode).join(', ')}
                                </div>
                              )}
                              {dataEntitlements.length > 0 && (
                                <div className="text-gray-600">
                                  <span className="font-medium">Data:</span> {dataEntitlements.map(d => d.productCode).join(', ')}
                                </div>
                              )}
                              {appEntitlements.length > 0 && (
                                <div className="text-gray-600">
                                  <span className="font-medium">Apps:</span> {appEntitlements.map(a => a.productCode).join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results State */}
      {selectedAccount && !loading && requests.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Requests Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No provisioning requests found for this account
          </p>
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        products={productModalData.products}
        productType={productModalData.productType}
        requestName={productModalData.requestName}
      />

      {/* Comparison Modal */}
      <ComparisonModal
        isOpen={showComparison}
        onClose={() => {
          setShowComparison(false);
          setSelectedForComparison([]);
        }}
        request1={selectedForComparison[0]}
        request2={selectedForComparison[1]}
      />
    </div>
  );
};

export default AccountHistory;
