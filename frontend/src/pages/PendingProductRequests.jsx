import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  getPendingProductUpdateRequests,
  deleteProductUpdateRequest,
  updateProductUpdateRequestStatus
} from '../services/productUpdateService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const PendingProductRequests = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState(searchParams.get('account') || '');
  
  useEffect(() => {
    loadRequests();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [requests, statusFilter, accountFilter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const result = await getPendingProductUpdateRequests();
      
      if (result.success) {
        setRequests(result.requests);
      } else {
        showToast('Failed to load pending requests', 'error');
      }
    } catch (error) {
      showToast('Error loading pending requests', 'error');
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (accountFilter) {
      filtered = filtered.filter(r => 
        r.accountName.toLowerCase().includes(accountFilter.toLowerCase())
      );
    }
    
    setFilteredRequests(filtered);
  };

  const handleDelete = async (requestNumber) => {
    if (!window.confirm(`Are you sure you want to delete request ${requestNumber}?`)) {
      return;
    }
    
    try {
      const result = await deleteProductUpdateRequest(requestNumber);
      
      if (result.success) {
        showToast(`Request ${requestNumber} deleted`, 'success');
        loadRequests(); // Reload list
      } else {
        showToast('Failed to delete request', 'error');
      }
    } catch (error) {
      showToast('Error deleting request', 'error');
      console.error('Error deleting request:', error);
    }
  };

  const handleStatusChange = async (requestNumber, newStatus) => {
    try {
      const result = await updateProductUpdateRequestStatus(requestNumber, newStatus);
      
      if (result.success) {
        showToast(`Request ${requestNumber} marked as ${newStatus}`, 'success');
        loadRequests(); // Reload list
      } else {
        showToast('Failed to update request status', 'error');
      }
    } catch (error) {
      showToast('Error updating request status', 'error');
      console.error('Error updating status:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    
    const icons = {
      pending: ClockIcon,
      approved: CheckCircleIcon,
      rejected: XCircleIcon,
      processing: ArrowPathIcon,
      completed: CheckCircleIcon,
      failed: XCircleIcon
    };
    
    const Icon = icons[status] || ClockIcon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[priority] || styles.normal}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const getChangeSummary = (changes) => {
    let totalAdded = 0;
    let totalRemoved = 0;
    
    if (changes.models) {
      totalAdded += changes.models.added?.length || 0;
      totalRemoved += changes.models.removed?.length || 0;
    }
    if (changes.data) {
      totalAdded += changes.data.added?.length || 0;
      totalRemoved += changes.data.removed?.length || 0;
    }
    if (changes.apps) {
      totalAdded += changes.apps.added?.length || 0;
      totalRemoved += changes.apps.removed?.length || 0;
    }
    
    return (
      <div className="flex gap-3 text-sm">
        {totalAdded > 0 && (
          <span className="text-green-600 dark:text-green-400">
            +{totalAdded} added
          </span>
        )}
        {totalRemoved > 0 && (
          <span className="text-red-600 dark:text-red-400">
            -{totalRemoved} removed
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pending Product Update Requests</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and manage product entitlement update requests
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-4">
        <div className="flex items-center gap-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Account Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                placeholder="Filter by account name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <button
            onClick={loadRequests}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" message="Loading pending requests..." />
        </div>
      )}

      {/* Results */}
      {!loading && (
        <>
          {filteredRequests.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Pending Requests
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {accountFilter || statusFilter !== 'all' 
                  ? 'No requests match your filters'
                  : 'There are no pending product update requests at this time'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Request #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Account</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Changes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Requested By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Created</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRequests.map(request => (
                      <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                            {request.requestNumber}
                          </span>
                          {request.psRecordName && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              → {request.psRecordName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/customer-products?account=${encodeURIComponent(request.accountName)}`)}
                            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 underline"
                          >
                            {request.accountName}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {getChangeSummary(request.changes)}
                        </td>
                        <td className="px-4 py-3">
                          {getPriorityBadge(request.priority)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {request.requestedBy}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {/* Quick status changes */}
                            {request.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(request.requestNumber, 'approved')}
                                  className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Approve"
                                >
                                  <CheckCircleIcon className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(request.requestNumber, 'rejected')}
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Reject"
                                >
                                  <XCircleIcon className="h-5 w-5" />
                                </button>
                              </>
                            )}
                            
                            <button
                              onClick={() => handleDelete(request.requestNumber)}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {filteredRequests.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredRequests.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PendingProductRequests;

