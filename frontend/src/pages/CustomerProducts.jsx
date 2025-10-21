import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCustomerProducts } from '../services/provisioningService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  MagnifyingGlassIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const CustomerProducts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accountName, setAccountName] = useState(searchParams.get('account') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [collapsedRegions, setCollapsedRegions] = useState({});
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Auto-search if account param is present
  React.useEffect(() => {
    const accountParam = searchParams.get('account');
    if (accountParam && !data && !loading) {
      setAccountName(accountParam);
      handleSearchWithAccount(accountParam);
    }
  }, [searchParams]);

  const handleSearchWithAccount = async (account) => {
    if (!account.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await getCustomerProducts(account.trim());
      // Map regions to productsByRegion to match test expectations
      setData({
        ...result,
        productsByRegion: result.regions || result.productsByRegion || {}
      });
    } catch (err) {
      setError(err.message || 'Failed to load customer products');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await handleSearchWithAccount(accountName);
  };

  const handleViewAccountHistory = () => {
    navigate(`/analytics/account-history?account=${encodeURIComponent(data.account)}`);
  };

  const handleClear = () => {
    setAccountName('');
    setData(null);
    setError(null);
    setCollapsedRegions({});
    setCollapsedCategories({});
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

    return (
      <div className="mb-6 category-section">
        <button
          onClick={() => toggleCategory(categoryKey)}
          className="w-full text-left"
        >
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ChevronDownIcon 
              className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            />
            {title}
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {products.length}
            </span>
          </h4>
        </button>
        {!isCollapsed && (
          <div className="space-y-3">
            {products.map((product, idx) => (
              <div
                key={idx}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-base mb-1">
                      {product.productName || product.productCode}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {product.productCode}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      {product.packageName && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Package:</span> {product.packageName}
                        </span>
                      )}
                      {product.quantity && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Qty:</span> {product.quantity}
                        </span>
                      )}
                      {product.productModifier && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Modifier:</span> {product.productModifier}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-gray-600 mb-1">
                      {new Date(product.startDate).toLocaleDateString()} - {new Date(product.endDate).toLocaleDateString()}
                    </div>
                    {product.daysRemaining !== undefined && (
                      <div className={`text-xs font-semibold ${
                        product.daysRemaining < 30 ? 'text-red-600' :
                        product.daysRemaining < 90 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {product.daysRemaining} days remaining
                      </div>
                    )}
                    {product.status && (
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
                        product.status === 'active' ? 'bg-green-100 text-green-700' :
                        product.status === 'expiring-soon' ? 'bg-yellow-100 text-yellow-700' :
                        product.status === 'expiring' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {product.status}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Contributing PS Records */}
                {(product.sourcePSRecords || product.contributingRecords) && 
                 (product.sourcePSRecords?.length > 0 || product.contributingRecords?.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        Source PS Records ({(product.sourcePSRecords || product.contributingRecords)?.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(product.sourcePSRecords || product.contributingRecords)?.map((recordName, ridx) => (
                        <span
                          key={ridx}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                        >
                          {recordName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRegion = (regionName, regionData, regionIndex) => {
    if (!regionData) return null;

    const isCollapsed = collapsedRegions[regionIndex];

    return (
      <div key={regionName} className="mb-8">
        <button
          onClick={() => toggleRegion(regionIndex)}
          className="w-full text-left"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🌎</span>
            {regionName}
            <ChevronDownIcon 
              id={`region-${regionIndex}-chevron`}
              className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            />
          </h3>
        </button>
        {!isCollapsed && (
          <div id={`region-${regionIndex}`} className="pl-8 space-y-6">
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
    <div id="page-customer-products">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer Products</h1>
        <p className="text-sm text-gray-600 mt-1">
          View all active products for a customer organized by geographic region
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              id="customer-products-search"
              type="text"
              placeholder="Enter account name..."
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {/* Autocomplete results container (for future implementation) */}
            <div id="customer-products-search-results" className="hidden absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-10" />
          </div>
          <button
            id="customer-products-search-btn"
            type="submit"
            disabled={!accountName.trim() || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
          <button
            id="customer-products-clear"
            type="button"
            onClick={handleClear}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" message="Loading customer products..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error Loading Customer Products</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          {/* Summary */}
          <div id="customer-products-summary" className="mb-6 pb-6 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h2 id="customer-products-account-name" className="text-xl font-bold text-gray-900 mb-2">
                  {data.account}
                </h2>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <span>
                      {data.summary?.totalActive || 0} active product{data.summary?.totalActive !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {data.lastUpdated && (
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-5 w-5 text-gray-400" />
                      <span>
                        Last updated: {new Date(data.lastUpdated.date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Category Counts */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Models: </span>
                    <span id="customer-products-models-count" className="font-semibold text-blue-600">
                      {categoryCounts.models}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Data: </span>
                    <span id="customer-products-data-count" className="font-semibold text-blue-600">
                      {categoryCounts.data}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Apps: </span>
                    <span id="customer-products-apps-count" className="font-semibold text-blue-600">
                      {categoryCounts.apps}
                    </span>
                  </div>
                </div>
              </div>
              <button
                id="customer-products-view-history"
                onClick={handleViewAccountHistory}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <ChartBarIcon className="h-4 w-4" />
                View Account History
              </button>
            </div>
          </div>

          {/* Regions */}
          {data.productsByRegion && Object.keys(data.productsByRegion).length > 0 ? (
            <div id="customer-products-regions">
              {Object.entries(data.productsByRegion).map(([regionName, regionData], idx) =>
                renderRegion(regionName, regionData, idx)
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No active products found for this account
            </div>
          )}

          {/* Note if present */}
          {data.note && (
            <div className="mt-6 pt-6 border-t">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">{data.note}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div id="customer-products-empty-state" className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Search for Customer Products
          </h3>
          <p className="text-sm text-gray-600">
            Enter an account name above to view their active products organized by region
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomerProducts;
