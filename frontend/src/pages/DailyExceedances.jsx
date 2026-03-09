import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';

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
            Scanning Mixpanel quota events...
          </p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            {events} events processed · {tenants} tenants found · {mins > 0 ? `${mins}m ` : ''}{secs}s elapsed
          </p>
        </div>
      </div>
    </div>
  );
}

function ExceedanceBadge({ count, periodDays }) {
  const ratio = count / periodDays;
  const color = ratio >= 0.5
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
    : ratio >= 0.25
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      <CalendarDaysIcon className="h-3.5 w-3.5" />
      {count} / {periodDays} days
    </span>
  );
}

const DailyExceedances = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(14);
  const [expandedTenants, setExpandedTenants] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const [refreshJob, setRefreshJob] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mixpanel/daily-exceedances', { params: { days } });
      if (res.data.success) {
        setData(res.data);
        if (res.data.activeJob) {
          setRefreshJob({ jobId: res.data.activeJob.job_id, status: 'running' });
          setRefreshing(true);
        }
      } else {
        setError(res.data.message || 'Failed to load exceedance data');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load exceedance data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!refreshing || !refreshJob?.jobId) return;

    const poll = async () => {
      try {
        const res = await api.get('/mixpanel/daily-exceedances/refresh/status', {
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
        // keep polling on transient errors
      }
    };

    pollRef.current = setInterval(poll, 5000);
    poll();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshing, refreshJob?.jobId, loadData]);

  const startRefresh = async () => {
    setError(null);
    try {
      const res = await api.post('/mixpanel/daily-exceedances/refresh', {}, {
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
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.tenantId.toLowerCase().includes(term)
      || (t.tenantName && t.tenantName.toLowerCase().includes(term))
      || (t.accountName && t.accountName.toLowerCase().includes(term))
      || (t.displayName && t.displayName.toLowerCase().includes(term));
  });

  const summary = data?.summary || { totalTenantsExceeded: 0, totalExceedanceDays: 0, periodDays: days };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Limit Exceedances</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Shows customers that exceeded at least one daily quota limit within the selected period
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 3 months</option>
          </select>
          <button
            onClick={startRefresh}
            disabled={refreshing}
            title="Fetch fresh data from Mixpanel (runs in background)"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {refreshing && <RefreshProgress job={refreshJob} />}

      {loading && !data && !refreshing && <LoadingSpinner />}

      {data?.needsRefresh && !refreshing && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
          <ServerStackIcon className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">No Data Available</h3>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 mb-4">
            Click "Refresh Data" to scan Mixpanel events for daily limit exceedances.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Customers Exceeding Limits</p>
              <p className="text-3xl font-bold mt-1 text-red-600 dark:text-red-400">{summary.totalTenantsExceeded}</p>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Exceedance Days</p>
              <p className="text-3xl font-bold mt-1 text-amber-600 dark:text-amber-400">{summary.totalExceedanceDays}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Period Analyzed</p>
              <p className="text-3xl font-bold mt-1 text-gray-700 dark:text-gray-300">{summary.periodDays} <span className="text-base font-normal">days</span></p>
            </div>
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
            <span className="text-xs text-gray-400">
              {filteredTenants.length} of {data.tenants.length} customers shown
            </span>
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
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Days Exceeded</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                        {searchTerm ? 'No tenants match the search.' : 'No exceedances found for this period.'}
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
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {tenant.tenantName || tenant.tenantId}
                                </span>
                                {tenant.tenantName && (
                                  <span className="ml-1.5 text-xs text-gray-400">({tenant.tenantId})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{tenant.accountName || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <ExceedanceBadge count={tenant.totalExceedanceDays} periodDays={summary.periodDays} />
                            </td>
                            <td className="px-4 py-3">
                              <FrequencyBar count={tenant.totalExceedanceDays} total={summary.periodDays} />
                            </td>
                          </tr>

                          {/* Expanded: per-day breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="5" className="px-0 py-0">
                                <div className="mx-6 mt-3 mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      Per-Day Exceedance Detail
                                    </h4>
                                  </div>
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-gray-100 dark:bg-gray-800">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Metric</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Value</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Limit</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Utilization</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                      {tenant.exceedances.map(day => (
                                        day.metrics.map((m, idx) => (
                                          <tr key={`${day.date}-${m.metricType}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                            {idx === 0 ? (
                                              <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-gray-200" rowSpan={day.metrics.length}>
                                                {day.date}
                                              </td>
                                            ) : null}
                                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                                              {m.metricType.replace(/^Daily/, '').replace(/Run$/, '')}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">
                                              {m.value != null ? m.value.toLocaleString() : '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-300">
                                              {m.limit != null ? m.limit.toLocaleString() : '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-right">
                                              <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                {m.utilization != null ? `${m.utilization.toFixed(1)}%` : 'N/A'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
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

      {data && data.tenants?.length === 0 && !data.needsRefresh && !refreshing && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
          <ExclamationTriangleIcon className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">No Exceedances Found</h3>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            No customers exceeded their daily limits in the last {days} days.
          </p>
        </div>
      )}
    </div>
  );
};

function FrequencyBar({ count, total }) {
  const pct = Math.min((count / total) * 100, 100);
  const barColor = pct >= 50 ? 'bg-red-500' : pct >= 25 ? 'bg-amber-500' : 'bg-yellow-500';

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

export default DailyExceedances;
