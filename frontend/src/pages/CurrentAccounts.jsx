import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowPathIcon,
    ArrowDownTrayIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    XMarkIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
    getCurrentAccounts,
    getSyncStatus,
    triggerSync,
    triggerQuickSync,
    updateComments,
    exportAccounts
} from '../services/currentAccountsService';

const COLUMNS = [
    { key: 'client', label: 'Client', sortable: true },
    { key: 'services', label: 'Services', sortable: true },
    { key: 'account_type', label: 'Type', sortable: true },
    { key: 'csm_owner', label: 'CSM/Owner', sortable: true },
    { key: 'ps_record_name', label: 'PS Record', sortable: true },
    { key: 'completion_date', label: 'Completion Date', sortable: true },
    { key: 'size', label: 'Size', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    { key: 'tenant_name', label: 'Tenant Name', sortable: true },
    { key: 'tenant_url', label: 'Tenant URL', sortable: false },
    { key: 'tenant_id', label: 'Tenant ID', sortable: true },
    { key: 'salesforce_account_id', label: 'SF Account ID', sortable: true },
    { key: 'initial_tenant_admin', label: 'Initial Tenant Admin', sortable: true },
    { key: 'comments', label: 'Comments', sortable: false, editable: true }
];

const CurrentAccounts = () => {
    // State
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [quickSyncLoading, setQuickSyncLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [includeRemoved, setIncludeRemoved] = useState(false);
    
    // Sorting
    const [sortBy, setSortBy] = useState('completion_date');
    const [sortOrder, setSortOrder] = useState('DESC');
    
    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 0
    });

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [savingComment, setSavingComment] = useState(false);

    // Fetch accounts
    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getCurrentAccounts({
                page: pagination.page,
                pageSize: pagination.pageSize,
                sortBy,
                sortOrder,
                includeRemoved,
                search: searchTerm
            });

            if (result.success) {
                setAccounts(result.accounts || []);
                setPagination(prev => ({
                    ...prev,
                    totalCount: result.pagination?.totalCount || 0,
                    totalPages: result.pagination?.totalPages || 0
                }));
            } else {
                setError(result.error || 'Failed to load accounts');
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
            setError(err.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, sortBy, sortOrder, includeRemoved, searchTerm]);

    // Fetch sync status
    const fetchSyncStatus = useCallback(async () => {
        try {
            const result = await getSyncStatus();
            if (result.success) {
                setSyncStatus(result);
            }
        } catch (err) {
            console.error('Error fetching sync status:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchAccounts();
        fetchSyncStatus();
    }, [fetchAccounts, fetchSyncStatus]);

    // Handle sort
    const handleSort = (columnKey) => {
        if (sortBy === columnKey) {
            setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(columnKey);
            setSortOrder('DESC');
        }
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchAccounts();
    };

    // Handle sync
    const handleSync = async () => {
        if (!window.confirm('This will sync all tenant data from Salesforce and SML. This may take several minutes. Continue?')) {
            return;
        }

        setSyncLoading(true);
        try {
            const result = await triggerSync();
            if (result.success) {
                alert(`Sync completed!\n\nTenants processed: ${result.stats?.tenantsProcessed || 0}\nRecords created: ${result.stats?.recordsCreated || 0}\nRecords updated: ${result.stats?.recordsUpdated || 0}\nRecords marked removed: ${result.stats?.recordsMarkedRemoved || 0}`);
                fetchAccounts();
                fetchSyncStatus();
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        } catch (err) {
            alert(`Sync failed: ${err.message}`);
        } finally {
            setSyncLoading(false);
        }
    };

    // Handle quick sync - only adds new tenants
    const handleQuickSync = async () => {
        if (!window.confirm('Quick Sync will only add NEW tenants that don\'t already exist in the database.\n\nThis is faster than a full sync but won\'t update existing records.\n\nContinue?')) {
            return;
        }

        setQuickSyncLoading(true);
        try {
            const result = await triggerQuickSync();
            if (result.success) {
                const stats = result.stats || {};
                alert(`Quick Sync completed!\n\nSML tenants scanned: ${stats.smlTenantsScanned || 0}\nExisting tenants in DB: ${stats.existingTenants || 0}\nNew tenants found: ${stats.newTenantsFound || 0}\nRecords created: ${stats.recordsCreated || 0}`);
                fetchAccounts();
                fetchSyncStatus();
            } else {
                if (result.tokenExpired) {
                    alert(`Quick Sync failed: ${result.error}\n\n${result.resolution}`);
                } else {
                    alert(`Quick Sync failed: ${result.error}`);
                }
            }
        } catch (err) {
            alert(`Quick Sync failed: ${err.message}`);
        } finally {
            setQuickSyncLoading(false);
        }
    };

    // Handle export
    const handleExport = async () => {
        try {
            const blob = await exportAccounts(includeRemoved);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `current-accounts-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert(`Export failed: ${err.message}`);
        }
    };

    // Handle page change
    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    // Start editing comment
    const startEditing = (account) => {
        setEditingId(account.id);
        setEditValue(account.comments || '');
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingId(null);
        setEditValue('');
    };

    // Save comment
    const saveComment = async (id) => {
        setSavingComment(true);
        try {
            const result = await updateComments(id, editValue);
            if (result.success) {
                setAccounts(prev => prev.map(acc => 
                    acc.id === id ? { ...acc, comments: editValue } : acc
                ));
                setEditingId(null);
                setEditValue('');
            } else {
                alert(`Failed to save comment: ${result.error}`);
            }
        } catch (err) {
            alert(`Failed to save comment: ${err.message}`);
        } finally {
            setSavingComment(false);
        }
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return dateStr;
        }
    };

    // Get cell value
    const getCellValue = (account, column) => {
        const value = account[column.key];
        
        if (column.key === 'completion_date') {
            return formatDate(value);
        }
        
        if (column.key === 'tenant_url' && value) {
            return (
                <a 
                    href={value} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                    Open <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </a>
            );
        }
        
        if (column.key === 'account_type') {
            const typeColors = {
                'POC': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                'Subscription': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            };
            return value ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[value] || 'bg-gray-100 text-gray-800'}`}>
                    {value}
                </span>
            ) : '—';
        }

        if (column.key === 'ps_record_name') {
            return value ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-medium">
                    {value}
                </span>
            ) : '—';
        }
        
        return value || '—';
    };

    // Render sort indicator
    const renderSortIndicator = (column) => {
        if (!column.sortable) return null;
        
        if (sortBy === column.key) {
            return sortOrder === 'ASC' 
                ? <ChevronUpIcon className="h-4 w-4 ml-1" />
                : <ChevronDownIcon className="h-4 w-4 ml-1" />;
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Current Accounts</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    View and manage all active tenant accounts with their entitlement details
                </p>
            </div>

            {/* Sync Status Banner */}
            {syncStatus?.latestSync && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Last Sync:</strong> {formatDate(syncStatus.latestSync.sync_completed)} 
                        {syncStatus.latestSync.status === 'completed' && (
                            <span className="ml-2 text-green-600 dark:text-green-400">✓ Successful</span>
                        )}
                        {syncStatus.stats && (
                            <span className="ml-4">
                                {syncStatus.stats.active_records} active records • 
                                {syncStatus.stats.unique_clients} clients • 
                                {syncStatus.stats.unique_tenants} tenants
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex-1 max-w-md">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by client, services, tenant..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </form>

                {/* Filters & Actions */}
                <div className="flex flex-wrap gap-2 items-center">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                            type="checkbox"
                            checked={includeRemoved}
                            onChange={(e) => {
                                setIncludeRemoved(e.target.checked);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Include Removed
                    </label>

                    <button
                        onClick={fetchAccounts}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 transition-colors"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    <button
                        onClick={handleQuickSync}
                        disabled={quickSyncLoading || syncLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        title="Only add new tenants (faster)"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${quickSyncLoading ? 'animate-spin' : ''}`} />
                        {quickSyncLoading ? 'Quick Syncing...' : 'Quick Sync'}
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={syncLoading || quickSyncLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        title="Full sync - updates all records"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
                        {syncLoading ? 'Syncing...' : 'Full Sync'}
                    </button>

                    <button
                        onClick={handleExport}
                        disabled={accounts.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
            )}

            {/* Loading State */}
            {loading && accounts.length === 0 && (
                <div className="flex justify-center items-center h-64">
                    <LoadingSpinner />
                </div>
            )}

            {/* Table */}
            {!loading || accounts.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="table-scroll-container overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                        <table className="min-w-max w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    {COLUMNS.map((column) => (
                                        <th
                                            key={column.key}
                                            onClick={() => column.sortable && handleSort(column.key)}
                                            className={`px-3 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap ${
                                                column.sortable 
                                                    ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none' 
                                                    : ''
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                {column.label}
                                                {renderSortIndicator(column)}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                            {syncStatus?.stats?.total_records === 0 
                                                ? 'No data available. Click "Sync Data" to populate accounts from Salesforce and SML.'
                                                : 'No accounts found matching your search criteria'
                                            }
                                        </td>
                                    </tr>
                                ) : (
                                    accounts.map((account) => (
                                        <tr 
                                            key={account.id} 
                                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                                                account.record_status === 'removed' 
                                                    ? 'bg-gray-100 dark:bg-gray-800/50 opacity-60' 
                                                    : ''
                                            }`}
                                        >
                                            {COLUMNS.map((column) => (
                                                <td 
                                                    key={column.key} 
                                                    className="px-3 py-3 text-gray-900 dark:text-gray-100 whitespace-nowrap"
                                                >
                                                    {column.editable && column.key === 'comments' ? (
                                                        editingId === account.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-32 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveComment(account.id);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => saveComment(account.id)}
                                                                    disabled={savingComment}
                                                                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                >
                                                                    <CheckIcon className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditing}
                                                                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                                >
                                                                    <XMarkIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                onClick={() => startEditing(account)}
                                                                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded min-w-[100px] min-h-[24px]"
                                                                title="Click to edit"
                                                            >
                                                                {account.comments || <span className="text-gray-400 italic text-xs">Click to add...</span>}
                                                            </div>
                                                        )
                                                    ) : (
                                                        getCellValue(account, column)
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                Showing{' '}
                                <span className="font-medium">
                                    {((pagination.page - 1) * pagination.pageSize) + 1}
                                </span>
                                {' '}to{' '}
                                <span className="font-medium">
                                    {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
                                </span>
                                {' '}of{' '}
                                <span className="font-medium">{pagination.totalCount}</span> results
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-gray-700 dark:text-gray-300">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex gap-3">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            About Current Accounts
                        </h4>
                        <div className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                            <ul className="list-disc list-inside space-y-1">
                                <li>This page shows all active tenant accounts consolidated from Salesforce and SML</li>
                                <li>Each row represents a unique Tenant + App combination</li>
                                <li>Click on any column header to sort the data</li>
                                <li>Click on the Comments field to add or edit notes (preserved on sync)</li>
                                <li><strong>Quick Sync:</strong> Only adds NEW tenants that don't exist yet (faster)</li>
                                <li><strong>Full Sync:</strong> Updates all records from source systems (comprehensive, slower)</li>
                                <li><strong>Type:</strong> POC if term &lt; 1 year, Subscription if ≥ 1 year</li>
                                <li><strong>PS Record:</strong> The Salesforce Professional Services record that provisioned this tenant</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CurrentAccounts;



