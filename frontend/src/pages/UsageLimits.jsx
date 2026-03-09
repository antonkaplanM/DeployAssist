import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ServerStackIcon,
  TableCellsIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EntitlementModal from '../components/features/EntitlementModal';
import api from '../services/api';

const STATUS_CONFIG = {
  exceeded: { label: 'Exceeded', color: 'red', icon: XCircleIcon, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  warning:  { label: 'Warning',  color: 'amber', icon: ExclamationTriangleIcon, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  ok:       { label: 'OK',       color: 'green', icon: CheckCircleIcon, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
  unknown:  { label: 'Unknown',  color: 'gray', icon: ServerStackIcon, bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600 dark:text-gray-400' },
};

function UtilizationBar({ value, status }) {
  if (value === null || value === undefined) return <span className="text-xs text-gray-400">N/A</span>;
  const pct = Math.min(value, 100);
  const barColor = status === 'exceeded' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[120px]">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium ${status === 'exceeded' ? 'text-red-600 dark:text-red-400' : status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function RefreshProgress({ job }) {
  if (!job) return null;
  const events = (job.eventsProcessed || 0).toLocaleString();
  const tenants = job.tenantsFound || 0;
  const elapsed = job.elapsedSeconds || 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <ArrowPathIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <div className="flex-1">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            Refreshing data from Mixpanel...
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {events} events processed · {tenants} tenants found · {mins > 0 ? `${mins}m ` : ''}{secs}s elapsed
          </p>
        </div>
      </div>
    </div>
  );
}

const UsageLimits = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);
  const [expandedTenants, setExpandedTenants] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [entitlementModal, setEntitlementModal] = useState({ isOpen: false, tenantName: null, tenantId: null, accountName: null });

  // Refresh job state
  const [refreshJob, setRefreshJob] = useState(null); // { jobId, status, ... }
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mixpanel/usage-limits', { params: { days } });
      if (res.data.success) {
        setData(res.data);
        // If the backend tells us a job is already running, pick it up
        if (res.data.activeJob) {
          setRefreshJob({ jobId: res.data.activeJob.job_id, status: 'running' });
          setRefreshing(true);
        }
      } else {
        setError(res.data.message || 'Failed to load usage data');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  // Polling for refresh job status
  useEffect(() => {
    if (!refreshing || !refreshJob?.jobId) return;

    const poll = async () => {
      try {
        const res = await api.get('/mixpanel/usage-limits/refresh/status', {
          params: { jobId: refreshJob.jobId },
        });
        if (res.data.success) {
          const job = res.data.job;
          setRefreshJob(job);

          if (job.status === 'completed') {
            setRefreshing(false);
            loadData();
          } else if (job.status === 'failed') {
            setRefreshing(false);
            setError(`Refresh failed: ${job.errorMessage || 'Unknown error'}`);
          }
        }
      } catch {
        // Keep polling on transient errors
      }
    };

    pollRef.current = setInterval(poll, 5000);
    poll(); // immediate first check

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshing, refreshJob?.jobId, loadData]);

  const startRefresh = async () => {
    setError(null);
    try {
      const res = await api.post('/mixpanel/usage-limits/refresh', null, {
        params: { days },
      });
      if (res.data.success || res.data.jobId) {
        setRefreshJob({ jobId: res.data.jobId, status: 'running' });
        setRefreshing(true);
      } else {
        setError(res.data.message || 'Failed to start refresh');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start refresh');
    }
  };

  const toggleTenant = (tenantId) => {
    setExpandedTenants(prev => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  };

  const filteredTenants = (data?.tenants || []).filter(t => {
    if (statusFilter !== 'all' && t.overallStatus !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matches = t.tenantId.toLowerCase().includes(term)
        || (t.tenantName && t.tenantName.toLowerCase().includes(term))
        || (t.accountName && t.accountName.toLowerCase().includes(term))
        || (t.displayName && t.displayName.toLowerCase().includes(term));
      if (!matches) return false;
    }
    return true;
  });

  const summary = data?.summary || { totalTenants: 0, exceeded: 0, warning: 0, ok: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usage Limits Monitor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tracks customer quota utilization from Mixpanel with SML entitlement cross-reference
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 1 year</option>
          </select>
          <button
            onClick={startRefresh}
            disabled={refreshing}
            title="Fetch fresh data from Mixpanel (runs in background, ~1-2 min)"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Refresh progress */}
      {refreshing && <RefreshProgress job={refreshJob} />}

      {/* Loading (only on first load, before any data exists) */}
      {loading && !data && !refreshing && <LoadingSpinner />}

      {/* No data yet — prompt to refresh */}
      {data?.needsRefresh && !refreshing && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
          <ServerStackIcon className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">No Data Available</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 mb-4">
            Click "Refresh Data" to fetch usage data from Mixpanel. This takes about 1-2 minutes.
          </p>
          <button
            onClick={startRefresh}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh Data Now
          </button>
        </div>
      )}

      {data && data.tenants?.length > 0 && (
        <>
          {/* Data info bar */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <span>{data.dateRange?.fromDate} to {data.dateRange?.toDate}</span>
              {data.lastRefreshedAt && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Last refreshed {new Date(data.lastRefreshedAt).toLocaleString()}
                  </span>
                </>
              )}
            </div>
            {refreshing && <ArrowPathIcon className="h-4 w-4 animate-spin text-indigo-500" />}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { key: 'totalTenants', label: 'Total Tenants', value: summary.totalTenants, color: 'indigo' },
              { key: 'exceeded', label: 'Exceeded Limits', value: summary.exceeded, color: 'red' },
              { key: 'warning', label: 'Near Limits (≥80%)', value: summary.warning, color: 'amber' },
              { key: 'ok', label: 'Within Limits', value: summary.ok, color: 'green' },
            ].map(card => (
              <div
                key={card.key}
                onClick={() => setStatusFilter(card.key === 'totalTenants' ? 'all' : card.key)}
                className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
                  (statusFilter === card.key || (statusFilter === 'all' && card.key === 'totalTenants'))
                    ? `border-${card.color}-400 dark:border-${card.color}-600 ring-2 ring-${card.color}-200 dark:ring-${card.color}-800`
                    : 'border-gray-200 dark:border-gray-700'
                } bg-white dark:bg-gray-800`}
              >
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className={`text-3xl font-bold mt-1 text-${card.color}-600 dark:text-${card.color}-400`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search tenants or accounts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 max-w-md text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400"
            />
          </div>

          {/* Tenant Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    <th className="w-10 px-3 py-3"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Peak Utilization</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Quota Metrics</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Last Seen</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Entitlements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500">
                        {searchTerm || statusFilter !== 'all' ? 'No tenants match the current filter.' : 'No usage data available.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map(tenant => {
                      const isExpanded = expandedTenants.has(tenant.tenantId);
                      const ChevronIcon = isExpanded ? ChevronDownIcon : ChevronRightIcon;
                      return (
                        <React.Fragment key={tenant.tenantId}>
                          <tr
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                            onClick={() => toggleTenant(tenant.tenantId)}
                          >
                            <td className="px-3 py-3 text-center">
                              <ChevronIcon className="h-4 w-4 text-gray-400 mx-auto" />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tenant.tenantName || tenant.tenantId}</span>
                                {tenant.tenantName && (
                                  <span className="ml-1.5 text-xs text-gray-400">({tenant.tenantId})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{tenant.accountName || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={tenant.overallStatus} />
                            </td>
                            <td className="px-4 py-3">
                              <UtilizationBar value={tenant.maxQuotaUtilization} status={tenant.overallStatus} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {tenant.quotaMetrics.map(m => (
                                  <span
                                    key={m.metricType}
                                    title={`${m.metricType}: ${m.currentValue ?? '?'} / ${m.limit ?? '?'} (${m.utilization !== null ? m.utilization.toFixed(1) + '%' : 'N/A'})`}
                                    className={`inline-flex px-1.5 py-0.5 rounded text-xs ${
                                      m.status === 'exceeded' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      m.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                      m.status === 'ok' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}
                                  >
                                    {m.metricType.replace(/^Daily/, '').replace(/Run$/, '')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {tenant.lastSeen ? new Date(tenant.lastSeen).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {tenant.tenantName ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEntitlementModal({
                                      isOpen: true,
                                      tenantName: tenant.tenantName,
                                      tenantId: tenant.tenantId,
                                      accountName: tenant.accountName,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  title="View SML entitlements"
                                >
                                  <TableCellsIcon className="h-3.5 w-3.5" />
                                  View
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                          {/* Expanded detail: quota metrics breakdown */}
                          {isExpanded && (
                            <>
                              <tr>
                                <td colSpan="100%" className="px-0 py-0">
                                  <div className="mx-6 mt-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2">
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quota Metrics Detail</h4>
                                    </div>
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-gray-100 dark:bg-gray-800">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Metric</th>
                                          <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Current</th>
                                          <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Limit</th>
                                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Utilization</th>
                                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Service</th>
                                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Last Seen</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {tenant.quotaMetrics.map(m => (
                                          <tr key={m.metricType} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                            <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-gray-200">{m.metricType}</td>
                                            <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{m.currentValue ?? '—'}</td>
                                            <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">{m.limit ?? '—'}</td>
                                            <td className="px-3 py-1.5"><UtilizationBar value={m.utilization} status={m.status} /></td>
                                            <td className="px-3 py-1.5"><StatusBadge status={m.status} /></td>
                                            <td className="px-3 py-1.5 text-gray-500">{m.serviceId || '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-500">{m.lastSeen ? new Date(m.lastSeen).toLocaleString() : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {tenant.storageMetrics.length > 0 && (
                                      <>
                                        <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Storage Metrics</h4>
                                        </div>
                                        <table className="min-w-full text-xs">
                                          <thead className="bg-gray-100 dark:bg-gray-800">
                                            <tr>
                                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Metric</th>
                                              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Value</th>
                                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Instance</th>
                                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Last Seen</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {tenant.storageMetrics.map((s, idx) => (
                                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                                <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-gray-200">{s.metricType}</td>
                                                <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">
                                                  {s.metricType === 'StorageStatus' && s.storageDetails
                                                    ? `${s.storageDetails.usedDiskMb ?? '?'} / ${s.storageDetails.totalDiskMb ?? '?'} MB${s.utilization !== null ? ` (${s.utilization.toFixed(1)}%)` : ''}`
                                                    : (s.currentValue ?? '—')}
                                                </td>
                                                <td className="px-3 py-1.5 text-gray-500">{s.storageDetails?.instanceName || s.serviceId || '—'}</td>
                                                <td className="px-3 py-1.5 text-gray-500">{s.lastSeen ? new Date(s.lastSeen).toLocaleString() : '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Entitlements Modal */}
      <EntitlementModal
        isOpen={entitlementModal.isOpen}
        onClose={() => setEntitlementModal({ isOpen: false, tenantName: null, tenantId: null, accountName: null })}
        tenantName={entitlementModal.tenantName}
        tenantId={entitlementModal.tenantId}
        accountName={entitlementModal.accountName}
      />
    </div>
  );
};

export default UsageLimits;
