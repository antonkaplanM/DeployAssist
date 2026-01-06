import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchProvisioning } from '../services/provisioningService';
import { fetchSMLTenantDetails, getSMLConfig } from '../services/smlCompareService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import TypeAheadSearch from '../components/common/TypeAheadSearch';
import ProductUpdateModal from '../components/features/ProductUpdateModal';
import { 
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ServerIcon
} from '@heroicons/react/24/outline';

const CustomerProducts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('account') || searchParams.get('tenant') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [collapsedRegions, setCollapsedRegions] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showProductUpdateModal, setShowProductUpdateModal] = useState(false);
  const [smlConfigured, setSmlConfigured] = useState(null);
  const [searchType, setSearchType] = useState(null); // 'account' or 'tenant'

  // Check SML configuration on mount
  React.useEffect(() => {
    const checkSMLConfig = async () => {
      try {
        const config = await getSMLConfig();
        setSmlConfigured(config.configured && config.hasAuthCookie);
      } catch (err) {
        console.error('Error checking SML config:', err);
        setSmlConfigured(false);
      }
    };
    checkSMLConfig();
  }, []);

  // Auto-search if account or tenant param is present
  React.useEffect(() => {
    const accountParam = searchParams.get('account');
    const tenantParam = searchParams.get('tenant');
    if (accountParam && !data && !loading) {
      setSearchTerm(accountParam);
      setSearchType('account');
      handleSearchWithTenant(accountParam, 'account');
    } else if (tenantParam && !data && !loading) {
      setSearchTerm(tenantParam);
      setSearchType('tenant');
      handleSearchWithTenant(tenantParam, 'tenant');
    }
  }, [searchParams]);

  /**
   * Transform SML tenant details to the format expected by the UI
   */
  const transformSMLDataForUI = (smlData, tenantName) => {
    const extensionData = smlData?.extensionData || {};
    const modelEntitlements = extensionData.modelEntitlements || [];
    const dataEntitlements = extensionData.dataEntitlements || [];
    const appEntitlements = extensionData.appEntitlements || [];

    // Helper to calculate days remaining and status
    const calculateProductStatus = (endDate) => {
      if (!endDate) return { status: 'active', daysRemaining: null };
      const now = new Date();
      const end = new Date(endDate);
      const diffTime = end.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysRemaining < 0) {
        return { status: 'expired', daysRemaining };
      } else if (daysRemaining < 30) {
        return { status: 'expiring-soon', daysRemaining };
      } else if (daysRemaining < 90) {
        return { status: 'expiring', daysRemaining };
      }
      return { status: 'active', daysRemaining };
    };

    // Transform entitlements to product format
    const transformEntitlement = (entitlement) => {
      const { status, daysRemaining } = calculateProductStatus(entitlement.endDate);
      return {
        productCode: entitlement.productCode,
        productName: entitlement.productName || entitlement.productCode,
        packageName: entitlement.packageName || null,
        quantity: entitlement.quantity || null,
        productModifier: entitlement.productModifier || null,
        startDate: entitlement.startDate,
        endDate: entitlement.endDate,
        status,
        daysRemaining,
        source: 'SML',
        sourcePSRecords: []
      };
    };

    // Group by region (SML doesn't have region info, so we use the SML environment)
    const regionName = `SML Entitlements - ${tenantName}`;
    
    const models = modelEntitlements.map(transformEntitlement);
    const dataProducts = dataEntitlements.map(transformEntitlement);
    const apps = appEntitlements.map(transformEntitlement);

    return {
      account: smlData.accountName || tenantName,
      tenantName: smlData.tenantName || tenantName,
      tenantId: smlData.tenantId,
      source: 'SML',
      productsByRegion: {
        [regionName]: {
          models,
          data: dataProducts,
          apps
        }
      },
      summary: {
        totalActive: models.length + dataProducts.length + apps.length,
        byCategory: {
          models: models.length,
          data: dataProducts.length,
          apps: apps.length
        }
      },
      lastUpdated: {
        date: new Date().toISOString(),
        source: 'SML API'
      }
    };
  };

  const handleSearchWithTenant = async (term, type = 'tenant') => {
    if (!term.trim()) return;

    setLoading(true);
    setError(null);
    setSearchType(type);

    try {
      // Check SML configuration
      const config = await getSMLConfig();
      if (!config.configured || !config.hasAuthCookie) {
        setError('SML is not configured. Please configure SML authentication in Settings before viewing customer products.');
        setSmlConfigured(false);
        setLoading(false);
        return;
      }
      setSmlConfigured(true);

      // Fetch tenant details from SML
      console.log(`🔍 Fetching SML data for: ${term} (type: ${type})`);
      const result = await fetchSMLTenantDetails(term.trim());
      
      if (result.success && result.tenantDetails) {
        const transformedData = transformSMLDataForUI(result.tenantDetails, term.trim());
        setData(transformedData);
      } else {
        setError(result.error || `Could not find tenant "${term}" in SML. Try searching with a different name.`);
        setData(null);
      }
    } catch (err) {
      console.error('Error fetching customer products from SML:', err);
      setError(err.message || 'Failed to load customer products from SML');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    // Default to tenant search when manually typing
    await handleSearchWithTenant(searchTerm, 'tenant');
  };

  const handleViewAccountHistory = () => {
    const param = data.tenantName || data.account;
    navigate(`/analytics/account-history?account=${encodeURIComponent(param)}`);
  };

  const handleViewPendingRequests = () => {
    const param = data.tenantName || data.account;
    navigate(`/pending-product-requests?account=${encodeURIComponent(param)}`);
  };

  const handleProductUpdateRequest = () => {
    setShowProductUpdateModal(true);
  };

  const handleRequestCreated = (request) => {
    // Optionally navigate to pending requests page
    const param = data.tenantName || data.account;
    navigate(`/pending-product-requests?account=${encodeURIComponent(param)}`);
  };

  const handleClear = () => {
    setSearchTerm('');
    setData(null);
    setError(null);
    setSearchType(null);
    setCollapsedRegions({});
    setCollapsedCategories({});
  };

  // Handle type-ahead search selection
  const handleSearchSelect = (item) => {
    if (item.type === 'account') {
      setSearchTerm(item.name);
      setSearchType('account');
      // Automatically trigger search when account is selected
      handleSearchWithTenant(item.name, 'account');
    } else if (item.type === 'tenant') {
      setSearchTerm(item.name);
      setSearchType('tenant');
      // Automatically trigger search when tenant is selected
      handleSearchWithTenant(item.name, 'tenant');
    }
  };

  // Wrapper for searchProvisioning that shows accounts and tenants
  const searchFunction = async (term, limit) => {
    try {
      const response = await searchProvisioning(term, limit);
      if (response.success) {
        // Return accounts and tenants for Customer Products page
        return {
          success: true,
          results: {
            technicalRequests: [], // Hide technical requests
            accounts: response.results.accounts || [],
            tenants: response.results.tenants || []
          }
        };
      }
      return response;
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
      return { success: false, results: { technicalRequests: [], accounts: [], tenants: [] } };
    }
  };

  const toggleRegion = (regionIndex) => {
    setCollapsedRegions(prev => ({
      ...prev,
      [regionIndex]: !prev[regionIndex]
    }));
  };

  const toggleCategory = (categoryKey) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const renderProductGroup = (title, products, regionIndex, category) => {
    if (!products || products.length === 0) return null;

    const categoryKey = `${regionIndex}-${category}`;
    const isCollapsed = collapsedCategories[categoryKey];

    // Color scheme for each category
    const categoryColors = {
      Models: {
        icon: '📊',
        headerBg: 'bg-blue-50',
        headerBorder: 'border-blue-200',
        headerText: 'text-blue-900',
        badge: 'bg-blue-100 text-blue-700',
      },
      Data: {
        icon: '💾',
        headerBg: 'bg-green-50',
        headerBorder: 'border-green-200',
        headerText: 'text-green-900',
        badge: 'bg-green-100 text-green-700',
      },
      Apps: {
        icon: '📱',
        headerBg: 'bg-purple-50',
        headerBorder: 'border-purple-200',
        headerText: 'text-purple-900',
        badge: 'bg-purple-100 text-purple-700',
      },
    };

    const colors = categoryColors[title] || categoryColors.Models;

    return (
      <div className="mb-6 category-section">
        <button
          onClick={() => toggleCategory(categoryKey)}
          className={`w-full text-left mb-3 px-4 py-3 rounded-lg border ${colors.headerBg} ${colors.headerBorder} hover:opacity-80 transition-opacity`}
        >
          <h4 className={`text-sm font-semibold ${colors.headerText} flex items-center gap-2`}>
            <ChevronDownIcon 
              className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
            <span className="text-base">{colors.icon}</span>
            {title}
            <span className={`${colors.badge} px-2 py-0.5 rounded-full text-xs font-medium ml-auto`}>
              {products.length}
            </span>
          </h4>
        </button>
        {!isCollapsed && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Product Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Product Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Package</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Modifier</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">End Date</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Days Left</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">Source PS Records</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100">
                {products.map((product, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {product.productName || product.productCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono">
                      {product.productCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {product.packageName || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-medium">
                      {product.quantity || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {product.productModifier || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                      {new Date(product.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                      {new Date(product.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {product.daysRemaining !== undefined ? (
                        <span className={`inline-flex items-center justify-center font-bold text-sm px-2 py-1 rounded ${
                          product.daysRemaining < 30 ? 'bg-red-100 text-red-700' :
                          product.daysRemaining < 90 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {product.daysRemaining}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.status ? (
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          product.status === 'active' ? 'bg-green-100 text-green-800' :
                          product.status === 'expiring-soon' ? 'bg-yellow-100 text-yellow-800' :
                          product.status === 'expiring' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {product.status}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {(product.sourcePSRecords || product.contributingRecords) && 
                       (product.sourcePSRecords?.length > 0 || product.contributingRecords?.length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {(product.sourcePSRecords || product.contributingRecords)?.map((recordName, ridx) => (
                            <span
                              key={ridx}
                              className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 dark:text-blue-300 dark:text-blue-300 text-xs font-semibold"
                            >
                              {recordName}
                            </span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderRegion = (regionName, regionData, regionIndex) => {
    if (!regionData) return null;

    const isCollapsed = collapsedRegions[regionIndex];

    return (
      <div key={regionName} className="mb-6">
        <button
          onClick={() => toggleRegion(regionIndex)}
          className="w-full text-left"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-2xl">🌎</span>
            {regionName}
            <ChevronDownIcon 
              id={`region-${regionIndex}-chevron`}
              className={`h-5 w-5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </h3>
        </button>
        {!isCollapsed && (
          <div id={`region-${regionIndex}`} className="space-y-4">
            {renderProductGroup('Models', regionData.models, regionIndex, 'models')}
            {renderProductGroup('Data', regionData.data, regionIndex, 'data')}
            {renderProductGroup('Apps', regionData.apps, regionIndex, 'apps')}
          </div>
        )}
      </div>
    );
  };

  // Calculate category counts
  const getCategoryCounts = () => {
    if (!data?.productsByRegion) return { models: 0, data: 0, apps: 0 };
    
    let counts = { models: 0, data: 0, apps: 0 };
    Object.values(data.productsByRegion).forEach(region => {
      counts.models += (region.models?.length || 0);
      counts.data += (region.data?.length || 0);
      counts.apps += (region.apps?.length || 0);
    });
    return counts;
  };

  const categoryCounts = data ? getCategoryCounts() : { models: 0, data: 0, apps: 0 };

  return (
    <div id="page-customer-products" className="space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Customer Products</h1>
        <p className="mt-2 text-gray-600">
          View all active products for a customer organized by geographic region
        </p>
      </div>

      {/* SML Configuration Status */}
      {smlConfigured === false && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">SML Integration Not Configured</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Customer Products now uses SML as the data source. Please configure SML authentication in{' '}
                <a href="/settings" className="underline hover:no-underline">Settings</a> to view product entitlements.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Box */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ServerIcon className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Data Source: <span className="text-blue-600 dark:text-blue-400">SML (Service Management Layer)</span>
          </span>
          {smlConfigured && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Connected
            </span>
          )}
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <TypeAheadSearch
              searchFunction={searchFunction}
              onSelect={handleSearchSelect}
              placeholder="Enter customer account name or tenant name..."
              debounceDelay={300}
              minSearchLength={2}
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>
          <button
            id="customer-products-search-btn"
            type="button"
            onClick={handleSearch}
            disabled={!searchTerm.trim() || loading || smlConfigured === false}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
          {data && (
            <button
              id="customer-products-clear"
              onClick={handleClear}
              className="px-6 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Search by customer account name or tenant name. Results are fetched directly from SML.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" message="Loading customer products..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error Loading Customer Products</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Account Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="customer-products-account-name" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {data.account}
                </h2>
                {data.tenantName && data.tenantName !== data.account && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Tenant: <span className="font-mono text-gray-700 dark:text-gray-300">{data.tenantName}</span>
                    {data.tenantId && (
                      <span className="ml-2 text-xs text-gray-400">(ID: {data.tenantId})</span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <span>
                      {data.summary?.totalActive || 0} active product{data.summary?.totalActive !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {data.source && (
                    <div className="flex items-center gap-2">
                      <ServerIcon className="h-5 w-5 text-blue-400" />
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        Source: {data.source}
                      </span>
                    </div>
                  )}
                  {data.lastUpdated && (
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-5 w-5 text-gray-400" />
                      <span>
                        Last updated: {new Date(data.lastUpdated.date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  id="customer-products-pending-requests"
                  onClick={handleViewPendingRequests}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  <ClipboardDocumentListIcon className="h-4 w-4" />
                  Pending Requests
                </button>
                <button
                  id="customer-products-update-request"
                  onClick={handleProductUpdateRequest}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Product Update
                </button>
                <button
                  id="customer-products-view-history"
                  onClick={handleViewAccountHistory}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <ChartBarIcon className="h-4 w-4" />
                  View History
                </button>
              </div>
            </div>
            
            {/* Category Count Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-900">Models</div>
                <div className="text-2xl font-bold text-blue-700" id="customer-products-models-count">
                  {categoryCounts.models}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="text-sm font-medium text-green-900">Data</div>
                <div className="text-2xl font-bold text-green-700" id="customer-products-data-count">
                  {categoryCounts.data}
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-900">Apps</div>
                <div className="text-2xl font-bold text-purple-700" id="customer-products-apps-count">
                  {categoryCounts.apps}
                </div>
              </div>
            </div>
          </div>

          {/* Products by Region */}
          <div id="customer-products-regions">
            {data.productsByRegion && Object.keys(data.productsByRegion).length > 0 ? (
              <>
                {Object.entries(data.productsByRegion).map(([regionName, regionData], idx) =>
                  renderRegion(regionName, regionData, idx)
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No active products found for this account
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div id="customer-products-empty-state" className="bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 p-12 text-center text-gray-900 dark:text-gray-100 transition-colors">
          <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Search for Customer Products
          </h3>
          <p className="text-sm text-gray-600">
            Enter an account name above to view their active products organized by region
          </p>
        </div>
      )}

      {/* Product Update Modal */}
      {data && (
        <ProductUpdateModal
          isOpen={showProductUpdateModal}
          onClose={() => setShowProductUpdateModal(false)}
          accountName={data.tenantName || data.account}
          currentProducts={data.productsByRegion}
          onRequestCreated={handleRequestCreated}
        />
      )}
    </div>
  );
};

export default CustomerProducts;
