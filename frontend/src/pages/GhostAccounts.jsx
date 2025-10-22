import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';

const GhostAccounts = () => {
  const [ghostAccounts, setGhostAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('unreviewed');
  const [summary, setSummary] = useState({
    total_ghost_accounts: 0,
    unreviewed: 0,
    reviewed: 0
  });
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    fetchGhostAccounts();
  }, [reviewStatusFilter]);

  const fetchGhostAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountSearch) params.append('accountSearch', accountSearch);
      if (reviewStatusFilter !== 'all') params.append('isReviewed', reviewStatusFilter === 'reviewed');

      const response = await fetch(`/api/ghost-accounts?${params}`);
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

  const handleRefreshAnalysis = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/api/ghost-accounts/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh ghost accounts analysis');
      }
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Analysis complete! Found ${data.summary?.ghostAccountsFound || 0} ghost accounts`);
        // Reload the data
        await fetchGhostAccounts();
      }
    } catch (err) {
      console.error('Error refreshing analysis:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkReviewed = async (accountId, accountName) => {
    if (!confirm(`Mark "${accountName}" as reviewed?`)) return;
    
    try {
      const reviewedBy = 'Current User'; // In production, get from auth context
      const response = await fetch(`/api/ghost-accounts/${accountId}/review`, {
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
          <h1 className="text-3xl font-bold text-gray-900">Ghost Accounts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor accounts with stale or outdated provisioning data
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Last refreshed: {lastRefresh}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchGhostAccounts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 disabled:opacity-50 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <button
            onClick={handleRefreshAnalysis}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
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
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">About Ghost Accounts</h3>
            <p className="text-sm text-blue-800">
              Ghost accounts are accounts that appear in older PS records but may no longer be active or have stale provisioning data. 
              These accounts require review to ensure accurate provisioning status. Click "Run Analysis" to identify ghost accounts 
              from recent Salesforce data.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by account name..."
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGhostAccounts()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
            />
          </div>
        </div>
        <select
          value={reviewStatusFilter}
          onChange={(e) => setReviewStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors"
        >
          <option value="all">All Accounts</option>
          <option value="unreviewed">Needs Review</option>
          <option value="reviewed">Reviewed</option>
        </select>
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
                  Account Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Expired Products
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Latest Expiry Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  MA Salesforce
                </th>
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
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{account.account_name}</div>
                        <div className="text-xs text-gray-500">{daysSinceExpiry} days since latest expiry</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 px-3 py-1 text-xs font-medium text-red-700">
                          {account.total_expired_products} products
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {new Date(account.latest_expiry_date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">{daysSinceExpiry} days ago</div>
                      </td>
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
                              onClick={() => handleMarkReviewed(account.account_id, account.account_name)}
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
    </div>
  );
};

export default GhostAccounts;
