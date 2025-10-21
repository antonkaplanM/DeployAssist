import React, { useState, useEffect } from 'react';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ProductModal from '../components/features/ProductModal';
import { getExpirationMonitor, refreshExpirationAnalysis } from '../services/expirationService';
import { parseTenantName } from '../utils/validationEngine';

const ExpirationMonitor = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expirationWindow, setExpirationWindow] = useState(30);
  const [showExtended, setShowExtended] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'earliestExpiry', direction: 'asc' });
  const [productModal, setProductModal] = useState({
    isOpen: false,
    products: [],
    productType: '',
    requestName: '',
  });

  useEffect(() => {
    fetchExpirations();
  }, [expirationWindow, showExtended]);

  const fetchExpirations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getExpirationMonitor(expirationWindow, showExtended);
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load expiration data');
      }
    } catch (err) {
      console.error('Error fetching expirations:', err);
      setError(err.message || 'Failed to load expiration data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    if (!confirm('This will analyze all provisioning records from the last 5 years. This may take several minutes. Continue?')) {
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const result = await refreshExpirationAnalysis(5, expirationWindow);
      if (result.success) {
        alert(`Analysis complete!\n\nRecords analyzed: ${result.summary.recordsAnalyzed}\nExpirations found: ${result.summary.expirationsFound}\nDuration: ${result.summary.duration.toFixed(1)}s`);
        fetchExpirations();
      } else {
        setError(result.error || 'Failed to refresh analysis');
      }
    } catch (err) {
      console.error('Error refreshing analysis:', err);
      setError(err.message || 'Failed to refresh analysis');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleViewProducts = (expiration, type) => {
    const products = expiration.products?.[type] || [];
    setProductModal({
      isOpen: true,
      products: products,
      productType: type,
      requestName: `${expiration.account.name} - ${type}`,
    });
  };

  const handleExport = () => {
    if (!data || !data.expirations || data.expirations.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Account', 'PS Record', 'Status', 'Earliest Expiry', 'Days Until Expiry', 'Models', 'Data', 'Apps'];
    const rows = data.expirations.map(exp => [
      exp.account.name,
      exp.psRecord.name,
      exp.status,
      new Date(exp.earliestExpiry).toLocaleDateString(),
      exp.daysUntilExpiry,
      exp.products?.models?.length || 0,
      exp.products?.data?.length || 0,
      exp.products?.apps?.length || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expiration-monitor-${expirationWindow}d-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getSortedExpirations = () => {
    if (!data || !data.expirations) return [];

    const sorted = [...data.expirations].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === 'earliestExpiry') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (sortConfig.key === 'daysUntilExpiry') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'at-risk':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'current':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const summary = data?.summary || {
    totalExpiring: 0,
    atRisk: 0,
    upcoming: 0,
    current: 0,
    accountsAffected: 0,
  };

  const expirations = getSortedExpirations();

  return (
    <div id="page-expiration" className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expiration Monitor</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track product expirations and renewals across all accounts
          </p>
          {data?.lastAnalyzed && (
            <p className="mt-1 text-xs text-gray-500" id="expiration-last-analyzed">
              Last analyzed: {new Date(data.lastAnalyzed).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAnalysis}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="refresh-expiration-btn"
          >
            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Analysis'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6" id="expiration-total">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Expiring</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalExpiring}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6" id="expiration-at-risk">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">At Risk</p>
              <p className="text-2xl font-bold text-gray-900">{summary.atRisk}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6" id="expiration-upcoming">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{summary.upcoming}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6" id="expiration-extended">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current</p>
              <p className="text-2xl font-bold text-gray-900">{summary.current}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6" id="expiration-accounts">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BuildingOfficeIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{summary.accountsAffected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="expiration-window-select" className="text-sm font-medium text-gray-700">
              Expiration Window:
            </label>
            <select
              id="expiration-window-select"
              value={expirationWindow}
              onChange={(e) => setExpirationWindow(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-extended-checkbox"
              checked={showExtended}
              onChange={(e) => setShowExtended(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="show-extended-checkbox" className="text-sm font-medium text-gray-700">
              Show Extended Entitlements
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" id="page-expiration-monitor">
        {expirations.length === 0 ? (
          <div className="p-12 text-center" id="expiration-empty-state">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No expirations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No products are expiring within the selected window.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('account.name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Account {sortConfig.key === 'account.name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('psRecord.name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    PS Record {sortConfig.key === 'psRecord.name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiring Products
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('earliestExpiry')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Earliest Expiry {sortConfig.key === 'earliestExpiry' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('daysUntilExpiry')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Days Until {sortConfig.key === 'daysUntilExpiry' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" id="expiration-table-body">
                {expirations.map((exp, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {exp.account.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exp.psRecord.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex gap-2">
                        {exp.products?.models && exp.products.models.length > 0 && (
                          <button
                            onClick={() => handleViewProducts(exp, 'models')}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {exp.products.models.length} Model{exp.products.models.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        {exp.products?.data && exp.products.data.length > 0 && (
                          <button
                            onClick={() => handleViewProducts(exp, 'data')}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {exp.products.data.length} Data
                          </button>
                        )}
                        {exp.products?.apps && exp.products.apps.length > 0 && (
                          <button
                            onClick={() => handleViewProducts(exp, 'apps')}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {exp.products.apps.length} App{exp.products.apps.length !== 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(exp.status)}`}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(exp.earliestExpiry).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {exp.daysUntilExpiry}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {productModal.isOpen && (
        <ProductModal
          isOpen={productModal.isOpen}
          onClose={() => setProductModal({ ...productModal, isOpen: false })}
          products={productModal.products}
          productType={productModal.productType}
          requestName={productModal.requestName}
        />
      )}
    </div>
  );
};

export default ExpirationMonitor;

