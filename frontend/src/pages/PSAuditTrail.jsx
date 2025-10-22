import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  getAuditStats,
  searchAuditTrail,
  getPSAuditTrail,
  getPSStatusChanges,
  triggerManualCapture,
} from '../services/auditTrailService';

const PSAuditTrail = () => {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [statusChanges, setStatusChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
    
    // Check for search parameter in URL
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
      // Trigger search automatically
      performSearch(searchParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const result = await getAuditStats();
      if (result.success) {
        // Map API response fields to component state
        setStats({
          totalRecords: result.stats.total_ps_records || 0,
          totalSnapshots: result.stats.total_snapshots || 0,
          statusChanges: result.stats.total_status_changes || 0,
          lastCapture: result.stats.latest_snapshot || null,
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (term) => {
    if (!term || term.length < 2) {
      alert('Please enter at least 2 characters to search');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedRecord(null);
    setAuditTrail([]);
    setStatusChanges([]);

    try {
      const result = await searchAuditTrail(term);
      if (result.success) {
        setSearchResults(result.results);
        if (result.results.length === 0) {
          setError('No PS records found matching your search');
        } else if (result.results.length === 1) {
          // Auto-select if there's only one result
          handleSelectRecord(result.results[0]);
        }
      }
    } catch (err) {
      console.error('Error searching:', err);
      setError('Failed to search audit trail');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    performSearch(searchTerm);
  };

  const handleSelectRecord = async (record) => {
    setSelectedRecord(record);
    setError(null);

    try {
      // Fetch audit trail and status changes in parallel
      const [auditResult, statusResult] = await Promise.all([
        getPSAuditTrail(record.ps_record_id),
        getPSStatusChanges(record.ps_record_id),
      ]);

      if (auditResult.success) {
        setAuditTrail(auditResult.records);
      }

      if (statusResult.success) {
        setStatusChanges(statusResult.changes);
      }
    } catch (err) {
      console.error('Error fetching record details:', err);
      setError('Failed to load record details');
    }
  };

  const handleTriggerCapture = async () => {
    if (!confirm('Trigger a manual capture of all current PS records? This will update the audit trail.')) {
      return;
    }

    setCapturing(true);
    try {
      const result = await triggerManualCapture();
      if (result.success) {
        alert(result.message || 'Capture triggered successfully');
        fetchStats();
      }
    } catch (err) {
      console.error('Error triggering capture:', err);
      setError('Failed to trigger capture');
    } finally {
      setCapturing(false);
    }
  };

  const handleExport = () => {
    if (auditTrail.length === 0) {
      alert('No data to export. Please select a PS record first.');
      return;
    }

    const headers = [
      'Snapshot ID',
      'Captured At',
      'Status',
      'Change Type',
      'Request Type',
      'Deployment',
      'Tenant',
      'Account Name',
      'Account ID',
      'Account Site'
    ];
    
    const rows = auditTrail.map(record => [
      record.id,
      new Date(record.captured_at).toLocaleString(),
      record.status,
      record.change_type,
      record.request_type || '',
      record.deployment_name || record.deployment_id || '',
      record.tenant_name || '',
      record.account_name || '',
      record.account_id || '',
      record.account_site || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ps-audit-trail-${selectedRecord?.ps_record_name}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadgeColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('active')) {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (statusLower.includes('cancelled') || statusLower.includes('terminated')) {
      return 'bg-red-100 text-red-800 border-red-200';
    } else if (statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatChangeType = (changeType) => {
    if (!changeType) return '📸 Snapshot';
    
    const typeMap = {
      'initial': '🆕 Initial Capture',
      'status_change': '🔄 Status Change',
      'update': '📝 Update',
      'snapshot': '📸 Snapshot'
    };
    
    return typeMap[changeType] || changeType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="page-audit-trail" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">PS Record Audit Trail</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Track changes and history of PS records over time. Data automatically updates every 5 minutes.
          </p>
        </div>
        <button
          onClick={handleTriggerCapture}
          disabled={capturing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Manual capture (updates automatically every 5 minutes)"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${capturing ? 'animate-spin' : ''}`} />
          {capturing ? 'Capturing...' : 'Manual Refresh'}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total PS Records</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalRecords || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Snapshots</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalSnapshots || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ArrowPathIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Status Changes</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.statusChanges || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Capture</p>
              <p className="text-sm font-medium text-gray-900">
                {stats?.lastCapture
                  ? new Date(stats.lastCapture).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Search PS Records</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              id="audit-trail-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PS Record name, Account name, or PS Record ID..."
              className="w-full px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Search Results:</h3>
            <div className="space-y-2">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectRecord(result)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedRecord?.ps_record_id === result.ps_record_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{result.ps_record_name}</p>
                      <p className="text-sm text-gray-600">{result.account_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(result.status)}`}>
                      {result.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Last captured: {new Date(result.captured_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Record Details */}
      {selectedRecord && (
        <div className="space-y-6" id="audit-trail-results">
          {/* Record Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedRecord.ps_record_name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Account: {selectedRecord.account_name}</p>
                <p className="text-sm text-gray-600">ID: {selectedRecord.ps_record_id}</p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Export
              </button>
            </div>
          </div>

          {/* Status Timeline */}
          {statusChanges.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6" id="status-timeline">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Change History</h3>
              <div className="space-y-4">
                {statusChanges.map((change, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === statusChanges.length - 1;
                  const capturedDate = new Date(change.captured_at);
                  
                  return (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isFirst ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                          {isFirst ? '📍' : '⏺'}
                        </div>
                        {!isLast && (
                          <div className="w-0.5 flex-1 bg-gray-300 mt-2" style={{ minHeight: '40px' }} />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeColor(change.status)}`}>
                            {change.status || 'Unknown'}
                          </span>
                          {change.previous_status && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              ← from {change.previous_status}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {capturedDate.toLocaleDateString()} at {capturedDate.toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {change.change_type === 'initial' ? 'Initial capture' : 'Status change detected'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit Trail Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Complete Audit Trail</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">All captured snapshots for this PS record</p>
            </div>
            {auditTrail.length === 0 ? (
              <div className="p-12 text-center">
                <DocumentDuplicateIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No audit trail found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No snapshots have been captured for this PS record yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" id="audit-trail-table">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Captured At
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Change Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Request Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Deployment
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Tenant
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {auditTrail.map((record, idx) => {
                      const capturedDate = new Date(record.captured_at);
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-gray-100">{capturedDate.toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{capturedDate.toLocaleTimeString()}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(record.status)}`}>
                              {record.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-900 dark:text-gray-100">{formatChangeType(record.change_type)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-gray-100">{record.request_type || '-'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-gray-100">{record.deployment_name || record.deployment_id || '-'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 dark:text-gray-100">{record.tenant_name || '-'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => alert(`Details for Snapshot ID: ${record.id}\n\nFull record data:\n${JSON.stringify(record, null, 2)}`)}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 h-8 px-3 transition-colors"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - No Record Selected */}
      {!selectedRecord && searchResults.length === 0 && !searching && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Search for a PS Record</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter a PS Record name, Account name, or ID to view its audit trail history.
          </p>
        </div>
      )}
    </div>
  );
};

export default PSAuditTrail;

