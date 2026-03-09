import React, { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../common/LoadingSpinner';
import api from '../../services/api';

const EntitlementModal = ({ isOpen, onClose, tenantName, tenantId, accountName }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!isOpen || !tenantName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');

    api.get('/tenant-entitlements', { params: { tenant: tenantName } })
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load entitlements'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isOpen, tenantName]);

  const items = data?.entitlements || [];
  const summary = data?.summary || {};

  const categories = useMemo(() => [...new Set(items.map(e => e.category))].sort(), [items]);

  const filtered = useMemo(() => {
    return items.filter(e => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        const match = (e.productName || '').toLowerCase().includes(t)
          || (e.productCode || '').toLowerCase().includes(t)
          || (e.packageName || '').toLowerCase().includes(t);
        if (!match) return false;
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, searchTerm]);

  if (!isOpen) return null;

  const displayName = accountName || tenantName || tenantId || 'Unknown';
  const subtitle = [tenantName, tenantId].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              SML Entitlements
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {displayName}
              {subtitle !== displayName && <span className="ml-1 text-xs text-gray-400">({subtitle})</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary bar */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex gap-4 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Total: {summary.totalEntitlements || items.length}
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    Active: {summary.activeCount || 0}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    Expiring: {summary.expiringCount || 0}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    Expired: {summary.expiredCount || 0}
                  </span>
                </div>
                {data.source && (
                  <span className="text-xs text-gray-400">Source: {data.source}</span>
                )}
              </div>

              {/* Filters */}
              <div className="px-6 py-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <div className="relative flex-1 max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                </select>
                <span className="text-xs text-gray-400">{filtered.length} shown</span>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                    {items.length === 0 ? 'No entitlements found for this tenant.' : 'No entitlements match the current filter.'}
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Product</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Code</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Category</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Package</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Qty</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Start Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">End Date</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Days Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filtered.map((e, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-200 font-medium">{e.productName || e.productCode}</td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">{e.productCode}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400 capitalize">{e.category}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{e.packageName || '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{e.quantity ?? '—'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              e.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              e.status === 'Expiring Soon' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{e.startDate ? new Date(e.startDate).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{e.endDate ? new Date(e.endDate).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{e.daysRemaining ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntitlementModal;
