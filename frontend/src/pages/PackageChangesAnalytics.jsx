import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingOfficeIcon,
  CubeIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  getPackageChangesSummary,
  getPackageChangesByProduct,
  getPackageChangesByAccount,
  refreshPackageChangesAnalysis,
  exportPackageChanges,
} from '../services/packageChangesService';

const PackageChangesAnalytics = () => {
  // Get initial timeframe: user's saved preference > default from Settings > fallback to 30 days
  const getInitialTimeFrame = () => {
    // First, check if user has a saved preference for this page
    const userPreference = localStorage.getItem('packageChanges_timeframe');
    if (userPreference) return userPreference;
    
    // If not, use the default from Settings and map to available options
    const defaultSetting = localStorage.getItem('defaultPackageChangesTimeframe');
    if (!defaultSetting) return '30d';
    
    const days = parseInt(defaultSetting);
    // Map to available options in the component
    if (days <= 7) return '7d';
    if (days <= 14) return '14d';
    if (days <= 30) return '30d';
    if (days <= 60) return '60d';
    if (days <= 90) return '90d';
    if (days <= 180) return '6m';
    return '1y';
  };

  const [summary, setSummary] = useState(null);
  const [byProduct, setByProduct] = useState([]);
  const [byAccount, setByAccount] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [expandedDeployments, setExpandedDeployments] = useState(new Set());
  const [timeFrame, setTimeFrame] = useState(getInitialTimeFrame());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    fetchData();
  }, [timeFrame]);

  // Save user's timeframe preference when they change it
  const handleTimeFrameChange = (newTimeFrame) => {
    setTimeFrame(newTimeFrame);
    localStorage.setItem('packageChanges_timeframe', newTimeFrame);
    console.log(`[PackageChanges] User preference saved: ${newTimeFrame}`);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, productData, accountData] = await Promise.all([
        getPackageChangesSummary(timeFrame),
        getPackageChangesByProduct(timeFrame),
        getPackageChangesByAccount(timeFrame),
      ]);

      if (summaryData.success) {
        setSummary(summaryData.summary);
        setLastRefresh(summaryData.timestamp);
      }
      
      if (productData.success) {
        console.log('[PackageChanges] Product data:', productData.data);
        setByProduct(productData.data || []);
      }
      
      if (accountData.success) {
        console.log('[PackageChanges] Account data:', accountData.data);
        setByAccount(accountData.data || []);
      }
    } catch (err) {
      console.error('Error fetching package changes:', err);
      setError('Failed to load package changes data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!confirm('This will analyze all PS records from the last 5 years. This may take several minutes. Continue?')) {
      return;
    }

    setRefreshing(true);
    try {
      const result = await refreshPackageChangesAnalysis(5);
      if (result.success) {
        alert(`Analysis complete!\n\nRecords analyzed: ${result.summary.recordsAnalyzed}\nChanges found: ${result.summary.changesFound}\nDuration: ${result.summary.duration.toFixed(1)}s`);
        fetchData();
      }
    } catch (err) {
      console.error('Error refreshing analysis:', err);
      setError('Failed to refresh analysis');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPackageChanges(timeFrame);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const toggleAccountExpand = (accountName) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountName)) {
      newExpanded.delete(accountName);
      // Also collapse all deployments under this account
      const newExpandedDeployments = new Set(expandedDeployments);
      expandedDeployments.forEach(key => {
        if (key.startsWith(`${accountName}-`)) {
          newExpandedDeployments.delete(key);
        }
      });
      setExpandedDeployments(newExpandedDeployments);
    } else {
      newExpanded.add(accountName);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleDeploymentExpand = (accountName, deploymentNumber) => {
    const deploymentKey = `${accountName}-${deploymentNumber}`;
    const newExpanded = new Set(expandedDeployments);
    if (newExpanded.has(deploymentKey)) {
      newExpanded.delete(deploymentKey);
    } else {
      newExpanded.add(deploymentKey);
    }
    setExpandedDeployments(newExpanded);
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const summaryData = summary || {
    total_changes: 0,
    total_upgrades: 0,
    total_downgrades: 0,
    ps_records_with_changes: 0,
    accounts_affected: 0,
    products_changed: 0,
  };

  return (
    <div className="space-y-6" id="page-package-changes">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Package Change Analytics</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track customer package upgrades and downgrades over time
          </p>
          {lastRefresh && (
            <p className="mt-1 text-xs text-gray-500" id="package-changes-last-refresh">
              Last refreshed: {new Date(lastRefresh).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="refresh-package-changes-btn"
          >
            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Analysis'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 disabled:opacity-50 transition-colors"
            id="export-package-changes-btn"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="package-changes-timeframe" className="text-sm font-medium text-gray-700">
            Time Frame:
          </label>
          <select
            id="package-changes-timeframe"
            value={timeFrame}
            onChange={(e) => handleTimeFrameChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-colors"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Summary Statistics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Summary</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Overall package change statistics</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 dark:border-blue-800 p-6" id="summary-ps-records">
            <div className="flex items-center gap-3">
              <CubeIcon className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-800">PS Records</p>
                <p className="text-2xl font-bold text-blue-900">{summaryData.ps_records_with_changes}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6" id="summary-total-changes">
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-purple-800">Total Changes</p>
                <p className="text-2xl font-bold text-purple-900">{summaryData.total_changes}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 dark:border-green-800 p-6" id="summary-upgrades">
            <div className="flex items-center gap-3">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-green-800">Upgrades</p>
                <p className="text-2xl font-bold text-green-900">{summaryData.total_upgrades}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 dark:border-red-800 p-6" id="summary-downgrades">
            <div className="flex items-center gap-3">
              <ArrowTrendingDownIcon className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-red-800">Downgrades</p>
                <p className="text-2xl font-bold text-red-900">{summaryData.total_downgrades}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6" id="summary-accounts">
            <div className="flex items-center gap-3">
              <BuildingOfficeIcon className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm text-yellow-800">Accounts</p>
                <p className="text-2xl font-bold text-yellow-900">{summaryData.accounts_affected}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200 p-6" id="summary-products">
            <div className="flex items-center gap-3">
              <CubeIcon className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="text-sm text-indigo-800">Products</p>
                <p className="text-2xl font-bold text-indigo-900">{summaryData.products_changed}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* By Product Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Package Changes by Product</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Breakdown of upgrades and downgrades per product</p>
        </div>
        {byProduct.length === 0 ? (
          <div className="p-12 text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No changes found</h3>
            <p className="mt-1 text-sm text-gray-500">No package changes in the selected time frame</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Changes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Upgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Downgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PS Records
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Accounts
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200" id="product-changes-tbody">
                {byProduct.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors">
                    <td className="px-6 py-4 align-middle">
                      <div className="font-medium text-gray-900">{product.product_code}</div>
                      {product.product_name && product.product_name !== product.product_code && (
                        <div className="text-xs text-gray-600">{product.product_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {parseInt(product.total_changes || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <ArrowTrendingUpIcon className="h-3 w-3" />
                        {parseInt(product.upgrades || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="inline-flex items-center gap-1 text-orange-700">
                        <ArrowTrendingDownIcon className="h-3 w-3" />
                        {parseInt(product.downgrades || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      {parseInt(product.ps_records || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      {parseInt(product.accounts || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Account Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Accounts - Package Changes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All accounts with package changes (3-level hierarchy: Account → Deployment → Product)</p>
        </div>
        {byAccount.length === 0 ? (
          <div className="p-12 text-center">
            <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No changes found</h3>
            <p className="mt-1 text-sm text-gray-500">No package changes in the selected time frame</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Account / Deployment / Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Changes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Upgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Downgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PS Records
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Products
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200" id="account-changes-tbody">
                {byAccount.map((account, accountIdx) => (
                  <React.Fragment key={accountIdx}>
                    {/* Account Row (Level 1) */}
                    <tr 
                      className="account-row hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 cursor-pointer"
                      onClick={() => toggleAccountExpand(account.account_name)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {account.deployments && account.deployments.length > 0 ? (
                            expandedAccounts.has(account.account_name) ? (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400 transition-transform" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400 transition-transform" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-medium text-base text-gray-900">{account.account_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        {parseInt(account.total_changes || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <ArrowTrendingUpIcon className="h-3 w-3" />
                          {parseInt(account.upgrades || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className="inline-flex items-center gap-1 text-orange-700">
                          <ArrowTrendingDownIcon className="h-3 w-3" />
                          {parseInt(account.downgrades || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        {parseInt(account.ps_records || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                        {parseInt(account.products_changed || 0).toLocaleString()}
                      </td>
                    </tr>

                    {/* Deployment Rows (Level 2) */}
                    {expandedAccounts.has(account.account_name) && account.deployments && account.deployments.map((deployment, deployIdx) => (
                      <React.Fragment key={`${accountIdx}-${deployIdx}`}>
                        <tr 
                          className="deployment-row bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDeploymentExpand(account.account_name, deployment.deployment_number);
                          }}
                        >
                          <td className="py-3 pr-4" style={{ paddingLeft: '2.5rem' }}>
                            <div className="flex items-center gap-2 border-l-2 border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 pl-3 text-gray-900 dark:text-gray-100 transition-colors">
                              {deployment.products && deployment.products.length > 0 ? (
                                expandedDeployments.has(`${account.account_name}-${deployment.deployment_number}`) ? (
                                  <ChevronDownIcon className="h-3 w-3 text-gray-400 transition-transform" />
                                ) : (
                                  <ChevronRightIcon className="h-3 w-3 text-gray-400 transition-transform" />
                                )
                              ) : (
                                <span className="w-3" />
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium text-sm text-gray-900">{deployment.deployment_number}</span>
                                {deployment.tenant_name && (
                                  <span className="text-xs text-gray-600">{deployment.tenant_name}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {parseInt(deployment.total_changes || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-sm text-right">
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <ArrowTrendingUpIcon className="h-3 w-3" />
                              {parseInt(deployment.upgrades || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-sm text-right">
                            <span className="inline-flex items-center gap-1 text-orange-700">
                              <ArrowTrendingDownIcon className="h-3 w-3" />
                              {parseInt(deployment.downgrades || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-sm text-right text-gray-600">
                            {parseInt(deployment.ps_records || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-sm text-right text-gray-600">
                            {parseInt(deployment.products_changed || 0).toLocaleString()}
                          </td>
                        </tr>

                        {/* Product Rows (Level 3) */}
                        {expandedDeployments.has(`${account.account_name}-${deployment.deployment_number}`) && 
                         deployment.products && deployment.products.map((product, prodIdx) => (
                          <tr 
                            key={`${accountIdx}-${deployIdx}-${prodIdx}`}
                            className="product-row bg-gray-100"
                          >
                            <td className="py-2 pr-4" style={{ paddingLeft: '4rem' }}>
                              <div className="text-xs border-l-4 border-gray-400 pl-3">
                                <div className="font-medium text-gray-900">{product.product_code}</div>
                                {product.product_name && product.product_name !== product.product_code && (
                                  <div className="text-xs text-gray-600">{product.product_name}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-xs text-right font-medium text-gray-900">
                              {parseInt(product.total_changes || 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-xs text-right">
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <ArrowTrendingUpIcon className="h-2 w-2" />
                                {parseInt(product.upgrades || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-xs text-right">
                              <span className="inline-flex items-center gap-1 text-orange-700">
                                <ArrowTrendingDownIcon className="h-2 w-2" />
                                {parseInt(product.downgrades || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-xs text-right text-gray-600">
                              {parseInt(product.ps_records || 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-xs text-right text-gray-600">
                              -
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageChangesAnalytics;

