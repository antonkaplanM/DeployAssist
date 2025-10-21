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
  const [summary, setSummary] = useState(null);
  const [byProduct, setByProduct] = useState([]);
  const [byAccount, setByAccount] = useState([]);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [timeFrame, setTimeFrame] = useState('1y');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    fetchData();
  }, [timeFrame]);

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
        setByProduct(productData.changes || []);
      }
      
      if (accountData.success) {
        setByAccount(accountData.changes || []);
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
    } else {
      newExpanded.add(accountName);
    }
    setExpandedAccounts(newExpanded);
  };

  const getChangeBadge = (type) => {
    if (type === 'upgrade') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
          <ArrowTrendingUpIcon className="h-3 w-3" />
          Upgrade
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 border border-red-200">
          <ArrowTrendingDownIcon className="h-3 w-3" />
          Downgrade
        </span>
      );
    }
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
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            id="export-package-changes-btn"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="package-changes-timeframe" className="text-sm font-medium text-gray-700">
            Time Frame:
          </label>
          <select
            id="package-changes-timeframe"
            value={timeFrame}
            onChange={(e) => setTimeFrame(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Summary</h2>
        <p className="text-sm text-gray-600 mb-4">Overall package change statistics</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6" id="summary-ps-records">
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

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6" id="summary-upgrades">
            <div className="flex items-center gap-3">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-green-800">Upgrades</p>
                <p className="text-2xl font-bold text-green-900">{summaryData.total_upgrades}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-6" id="summary-downgrades">
            <div className="flex items-center gap-3">
              <ArrowTrendingDownIcon className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-red-800">Downgrades</p>
                <p className="text-2xl font-bold text-red-900">{summaryData.total_downgrades}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 p-6" id="summary-accounts">
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Package Changes by Product</h3>
          <p className="text-sm text-gray-600 mt-1">Breakdown of upgrades and downgrades per product</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Changes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Downgrades
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" id="product-changes-tbody">
                {byProduct.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {product.product_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {product.product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {product.total_changes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                      {product.upgrades}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                      {product.downgrades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By Account Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Accounts - Package Changes</h3>
          <p className="text-sm text-gray-600 mt-1">All accounts with package changes</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deployments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Changes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upgrades
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Downgrades
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" id="account-changes-tbody">
                {byAccount.map((account, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="account-row hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {account.account_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {account.deployment_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {account.total_changes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                        {account.total_upgrades}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                        {account.total_downgrades}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleAccountExpand(account.account_name)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {expandedAccounts.has(account.account_name) ? (
                            <ChevronDownIcon className="h-5 w-5 inline" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5 inline" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedAccounts.has(account.account_name) && account.deployments && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Deployments for {account.account_name}</h4>
                            {account.deployments.map((deployment, dIdx) => (
                              <div key={dIdx} className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{deployment.ps_record_name}</p>
                                    <p className="text-xs text-gray-600">Changed: {new Date(deployment.change_date).toLocaleDateString()}</p>
                                  </div>
                                  {getChangeBadge(deployment.change_type)}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">From: </span>
                                    <span className="font-medium text-gray-900">{deployment.old_package_name}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">To: </span>
                                    <span className="font-medium text-gray-900">{deployment.new_package_name}</span>
                                  </div>
                                </div>
                                {deployment.product_name && (
                                  <p className="mt-2 text-xs text-gray-600">Product: {deployment.product_name}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
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

