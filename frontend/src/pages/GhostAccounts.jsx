import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import GhostAccountProductModal from '../components/features/GhostAccountProductModal';
import NestedMultiSelect from '../components/common/NestedMultiSelect';

const GhostAccounts = () => {
  const [ghostAccounts, setGhostAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('unreviewed');
  const [dataSource, setDataSource] = useState('salesforce'); // 'salesforce' or 'sml'
  const [productFilters, setProductFilters] = useState([]); // Array of selected product codes for SML
  const [availableProducts, setAvailableProducts] = useState({ apps: [], models: [], data: [] }); // Products grouped by category
  const [loadingProductList, setLoadingProductList] = useState(false);
  const [summary, setSummary] = useState({
    total_ghost_accounts: 0,
    unreviewed: 0,
    reviewed: 0
  });
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
  const [productModal, setProductModal] = useState({
    isOpen: false,
    allProducts: null,
    accountName: '',
    lastSynced: null,
    fromCache: false,
  });
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchGhostAccounts();
  }, [reviewStatusFilter, dataSource, productFilters]);

  // Fetch available products for filtering when SML data source is selected
  useEffect(() => {
    if (dataSource === 'sml') {
      fetchAvailableProducts();
    } else {
      setAvailableProducts({ apps: [], models: [], data: [] });
      setProductFilters([]);
    }
  }, [dataSource]);

  const fetchGhostAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountSearch) params.append('accountSearch', accountSearch);
      if (reviewStatusFilter !== 'all') params.append('isReviewed', reviewStatusFilter === 'reviewed');
      if (productFilters.length > 0 && dataSource === 'sml') params.append('productCodes', productFilters.join(','));

      // Use different API endpoint based on data source
      const endpoint = dataSource === 'sml' 
        ? `/api/sml-ghost-accounts?${params}`
        : `/api/ghost-accounts?${params}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch ghost accounts');
      }
      const data = await response.json();
      
      if (data.success) {
        setGhostAccounts(data.ghostAccounts || []);
        setSummary(data.summary || { total_ghost_accounts: 0, unreviewed: 0, reviewed: 0 });
        setLastRefresh(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error fetching ghost accounts:', err);
      setError(err.message || 'Failed to load ghost accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    setLoadingProductList(true);
    try {
      const response = await fetch('/api/sml-ghost-accounts/unique-products');
      if (!response.ok) {
        throw new Error('Failed to fetch product list');
      }
      const data = await response.json();
      
      if (data.success) {
        setAvailableProducts(data.productsByCategory || { apps: [], models: [], data: [] });
      }
    } catch (err) {
      console.error('Error fetching product list:', err);
      // Don't show error to user, just log it
    } finally {
      setLoadingProductList(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Use different API endpoint based on data source
      // For SML: /analyze = fetch from SML API, /refresh = use cached data
      const endpoint = dataSource === 'sml'
        ? '/api/sml-ghost-accounts/analyze'
        : '/api/ghost-accounts/refresh';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run ghost accounts analysis');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const message = dataSource === 'sml'
          ? `Analysis complete!\n\nTotal Tenants: ${data.summary?.totalTenants || 0}\nMapped to Accounts: ${data.summary?.mappedTenants || 0}\nGhost Accounts Found: ${data.summary?.ghostAccountsFound || 0}\n\nDuration: ${data.summary?.duration?.toFixed(1) || 0}s`
          : `Analysis complete! Found ${data.summary?.ghostAccountsFound || 0} ghost accounts`;
        alert(message);
        // Reload the data
        await fetchGhostAccounts();
      }
    } catch (err) {
      console.error('Error running analysis:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      // Build query parameters (same as fetchGhostAccounts)
      const params = new URLSearchParams();
      if (accountSearch) params.append('accountSearch', accountSearch);
      if (reviewStatusFilter !== 'all') params.append('isReviewed', reviewStatusFilter === 'reviewed');
      if (productFilters.length > 0 && dataSource === 'sml') params.append('productCodes', productFilters.join(','));

      // Only support SML export for now
      if (dataSource !== 'sml') {
        alert('Export is currently only available for SML data source');
        return;
      }

      const endpoint = `/api/sml-ghost-accounts/export?${params}`;
      
      // Download the file
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `SML_Ghost_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      // For SML: refresh from cached data (fast)
      if (dataSource === 'sml') {
        const response = await fetch('/api/sml-ghost-accounts/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to refresh data');
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Just reload the data display
          await fetchGhostAccounts();
        }
      } else {
        // For Salesforce: just reload from database
        await fetchGhostAccounts();
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReviewed = async (identifier, displayName) => {
    if (!confirm(`Mark "${displayName}" as reviewed?`)) return;
    
    try {
      const reviewedBy = 'Current User'; // In production, get from auth context
      
      // Use different API endpoint based on data source
      const endpoint = dataSource === 'sml'
        ? `/api/sml-ghost-accounts/${identifier}/review`
        : `/api/ghost-accounts/${identifier}/review`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reviewedBy, notes: '' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark as reviewed');
      }
      
      // Reload the data
      await fetchGhostAccounts();
    } catch (err) {
      console.error('Error marking as reviewed:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const getDaysSinceExpiry = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.floor((today - expiry) / (1000 * 60 * 60 * 24));
  };

  const handleShowProducts = async (identifier, displayName) => {
    setLoadingProducts(true);
    try {
      let response;
      let responseData;
      let allProducts = { models: [], data: [], apps: [] };
      
      if (dataSource === 'sml') {
        // For SML: call the SML-specific endpoint that uses cached product entitlements
        response = await fetch(`/api/sml-ghost-accounts/${encodeURIComponent(identifier)}/products?includeExpired=true`);
        if (!response.ok) {
          throw new Error('Failed to fetch SML products');
        }
        responseData = await response.json();
        
        if (responseData.success && responseData.products) {
          // SML returns products as flat array with category field
          responseData.products.forEach(product => {
            if (product.category === 'models') {
              allProducts.models.push(product);
            } else if (product.category === 'data') {
              allProducts.data.push(product);
            } else if (product.category === 'apps') {
              allProducts.apps.push(product);
            }
          });
        }
      } else {
        // For Salesforce: use the existing customer-products endpoint
        response = await fetch(`/api/customer-products?account=${encodeURIComponent(displayName)}&includeExpired=true`);
        if (!response.ok) {
          throw new Error('Failed to fetch customer products');
        }
        responseData = await response.json();
        
        if (responseData.success && responseData.productsByRegion) {
          // Flatten all products from all regions
          Object.values(responseData.productsByRegion).forEach(region => {
            allProducts.models.push(...(region.models || []));
            allProducts.data.push(...(region.data || []));
            allProducts.apps.push(...(region.apps || []));
          });
        }
      }
      
      const totalProducts = allProducts.models.length + allProducts.data.length + allProducts.apps.length;
      
      if (totalProducts > 0) {
        setProductModal({
          isOpen: true,
          allProducts: allProducts,
          accountName: displayName,
          lastSynced: dataSource === 'sml' && responseData?.lastSynced ? responseData.lastSynced : null,
          fromCache: dataSource === 'sml' && responseData?.fromCache === true,
        });
      } else {
        alert('No products found');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoadingProducts(false);
    }
  };

  const closeProductModal = () => {
    setProductModal({
      isOpen: false,
      allProducts: null,
      accountName: '',
      lastSynced: null,
      fromCache: false,
    });
  };

  if (loading && ghostAccounts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="page-ghost-accounts" className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Ghost Accounts</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              dataSource === 'sml' 
                ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            }`}>
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="3"/>
              </svg>
              {dataSource === 'sml' ? 'SML Data' : 'Salesforce Data'}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Monitor accounts with stale or outdated provisioning data
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Last refreshed: {lastRefresh}
          </p>
        </div>
        <div className="flex gap-2">
          {dataSource === 'sml' && (
            <button
              onClick={handleExportToExcel}
              disabled={loading || ghostAccounts.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
              title="Export ghost accounts to Excel with expired products"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export to Excel
            </button>
          )}
          <button
            onClick={handleRefreshData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 disabled:opacity-50 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors"
            title={dataSource === 'sml' ? 'Re-analyze using cached data (fast)' : 'Refresh data display'}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <button
            onClick={handleRefreshAnalysis}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            title={dataSource === 'sml' ? 'Fetch fresh data from SML and analyze (slow)' : 'Fetch from Salesforce and analyze'}
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Run Analysis
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ghost Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total_ghost_accounts || 0}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Needs Review</p>
              <p className="text-2xl font-bold text-orange-600">{summary.unreviewed || 0}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviewed</p>
              <p className="text-2xl font-bold text-green-600">{summary.reviewed || 0}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className={`border rounded-lg p-4 ${
        dataSource === 'sml'
          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      }`}>
        <div className="flex gap-3">
          <ExclamationTriangleIcon className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
            dataSource === 'sml' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'
          }`} />
          <div>
            <h3 className={`text-sm font-semibold mb-1 ${
              dataSource === 'sml' ? 'text-purple-900' : 'text-blue-900'
            }`}>
              About Ghost Accounts {dataSource === 'sml' ? '(SML)' : '(Salesforce)'}
            </h3>
            <p className={`text-sm ${
              dataSource === 'sml' ? 'text-purple-800' : 'text-blue-800'
            }`}>
              {dataSource === 'sml' 
                ? 'Ghost accounts from SML are tenants where all products have expired. Click "Run Analysis" to fetch fresh data from SML (includes all tenants + entitlements). Click "Refresh Data" to re-analyze cached data without SML API calls (fast).'
                : 'Ghost accounts are accounts that appear in older PS records but may no longer be active or have stale provisioning data. These accounts require review to ensure accurate provisioning status. Click "Run Analysis" to identify ghost accounts from recent Salesforce data.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Product Filter Indicator */}
      {dataSource === 'sml' && productFilters.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                Product Filters Active ({productFilters.length}):
              </span>
              <span className="text-sm text-green-800 dark:text-green-200 ml-1">
                Showing ghost accounts with any of the selected expired products
              </span>
            </div>
            <button
              onClick={() => setProductFilters([])}
              className="text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={dataSource === 'sml' ? 'Search by tenant or account name...' : 'Search by account name...'}
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGhostAccounts()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
            />
          </div>
        </div>
        <select
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value)}
          className="px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors font-medium"
        >
          <option value="salesforce">Salesforce</option>
          <option value="sml">SML</option>
        </select>
        <select
          value={reviewStatusFilter}
          onChange={(e) => setReviewStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
        >
          <option value="all">All Accounts</option>
          <option value="unreviewed">Needs Review</option>
          <option value="reviewed">Reviewed</option>
        </select>
        {dataSource === 'sml' && (
          <div className="min-w-[300px]">
            <NestedMultiSelect
              value={productFilters}
              onChange={setProductFilters}
              options={availableProducts}
              disabled={loadingProductList}
              placeholder={loadingProductList ? 'Loading products...' : 'Filter by products...'}
            />
          </div>
        )}
        <button
          onClick={fetchGhostAccounts}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Search
        </button>
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
                  {dataSource === 'sml' ? 'Tenant / Account Name' : 'Account Name'}
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Expired Products
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Latest Expiry Date
                </th>
                {dataSource === 'salesforce' && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    MA Salesforce
                  </th>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Review Status
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center">
                    <LoadingSpinner />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading ghost accounts...</p>
                  </td>
                </tr>
              ) : ghostAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No ghost accounts found
                  </td>
                </tr>
              ) : (
                ghostAccounts.map((account, index) => {
                  const daysSinceExpiry = getDaysSinceExpiry(account.latest_expiry_date);
                  
                  // Handle different field names for different data sources
                  const identifier = dataSource === 'sml' ? account.tenant_id : account.account_id;
                  const displayName = dataSource === 'sml' 
                    ? (account.tenant_name + (account.account_name ? ` (${account.account_name})` : ''))
                    : account.account_name;
                  const primaryName = dataSource === 'sml' ? account.tenant_name : account.account_name;
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{primaryName}</div>
                        {dataSource === 'sml' && account.account_name && (
                          <div className="text-xs text-gray-500">Account: {account.account_name}</div>
                        )}
                        <div className="text-xs text-gray-500">{daysSinceExpiry} days since latest expiry</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleShowProducts(identifier, displayName)}
                          disabled={loadingProducts}
                          className="inline-flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer disabled:opacity-50"
                          title="Click to view products"
                        >
                          {account.total_expired_products} products
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {new Date(account.latest_expiry_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">{daysSinceExpiry} days ago</div>
                      </td>
                      {dataSource === 'salesforce' && (
                        <td className="px-4 py-3">
                          {account.ma_sf_link ? (
                            <a
                              href={account.ma_sf_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-300 dark:text-blue-300 hover:underline"
                              title="Open in MA Salesforce"
                            >
                              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              View in MA SF
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">Not found</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {account.is_reviewed ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 px-3 py-1 text-xs font-medium text-green-700">
                              <CheckCircleIcon className="h-3 w-3" />
                              Reviewed
                            </span>
                            {account.reviewed_at && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(account.reviewed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                            <ExclamationTriangleIcon className="h-3 w-3" />
                            Needs Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {!account.is_reviewed && (
                            <button
                              onClick={() => handleMarkReviewed(identifier, displayName)}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 h-8 px-3 text-gray-900 dark:text-gray-100 transition-colors"
                              title="Mark as Reviewed"
                            >
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      <GhostAccountProductModal
        isOpen={productModal.isOpen}
        onClose={closeProductModal}
        allProducts={productModal.allProducts}
        accountName={productModal.accountName}
        lastSynced={productModal.lastSynced}
        fromCache={productModal.fromCache}
      />
    </div>
  );
};

export default GhostAccounts;
