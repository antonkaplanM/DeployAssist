import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StagingPayloadModal from '../components/features/StagingPayloadModal';
import RawDataModal from '../components/features/RawDataModal';
import { getRandomStagingRecords, replaceRecordWithRandom } from '../services/stagingService';
import { parseEntitlements } from '../utils/validationEngine';

const SAMPLE_SIZE = 10;

const Staging = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingRecords, setProcessingRecords] = useState(new Set());
  const [replacingRecords, setReplacingRecords] = useState(new Set());
  const [stats, setStats] = useState({
    confirmed: 0,
    rejected: 0
  });

  // Modal states
  const [payloadModal, setPayloadModal] = useState({
    isOpen: false,
    record: null
  });
  const [rawDataModal, setRawDataModal] = useState({
    isOpen: false,
    data: null,
    title: ''
  });

  // Local edits tracking (temporary, in-memory only)
  const [editedPayloads, setEditedPayloads] = useState({});

  useEffect(() => {
    fetchInitialRecords();
  }, []);

  const fetchInitialRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRandomStagingRecords(SAMPLE_SIZE, []);
      if (data.success) {
        setRecords(data.records || []);
      } else {
        setError(data.error || 'Failed to load staging records');
      }
    } catch (err) {
      console.error('Error fetching staging records:', err);
      setError(err.message || 'Failed to load staging records');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    if (!window.confirm('This will reload all sample records with new random selections. Continue?')) {
      return;
    }
    
    setEditedPayloads({});
    setStats({ confirmed: 0, rejected: 0 });
    await fetchInitialRecords();
  };

  const replaceRecord = async (recordId, action) => {
    setReplacingRecords(prev => new Set([...prev, recordId]));
    
    try {
      // Get current record IDs to maintain variety
      const currentIds = records.map(r => r.Id);
      
      // Fetch a replacement record
      const data = await replaceRecordWithRandom(currentIds);
      
      if (data.success && data.records && data.records.length > 0) {
        const newRecord = data.records[0];
        
        // Replace the record with animation
        setRecords(prev => prev.map(r => 
          r.Id === recordId ? newRecord : r
        ));

        // Update stats
        setStats(prev => ({
          ...prev,
          [action]: prev[action] + 1
        }));

        // Remove edited payload if any
        setEditedPayloads(prev => {
          const updated = { ...prev };
          delete updated[recordId];
          return updated;
        });
      }
    } catch (err) {
      console.error('Error replacing record:', err);
      alert('Failed to replace record. Please try again.');
    } finally {
      setReplacingRecords(prev => {
        const updated = new Set(prev);
        updated.delete(recordId);
        return updated;
      });
      setProcessingRecords(prev => {
        const updated = new Set(prev);
        updated.delete(recordId);
        return updated;
      });
    }
  };

  const handleConfirm = async (recordId) => {
    setProcessingRecords(prev => new Set([...prev, recordId]));
    await replaceRecord(recordId, 'confirmed');
  };

  const handleReject = async (recordId) => {
    setProcessingRecords(prev => new Set([...prev, recordId]));
    
    // If there are unsaved edits, warn the user
    if (editedPayloads[recordId]) {
      if (!window.confirm('This record has unsaved edits. Rejecting will discard these changes. Continue?')) {
        setProcessingRecords(prev => {
          const updated = new Set(prev);
          updated.delete(recordId);
          return updated;
        });
        return;
      }
    }
    
    await replaceRecord(recordId, 'rejected');
  };

  const openPayloadModal = (record) => {
    // Use edited payload if available, otherwise use original
    const recordWithEdits = editedPayloads[record.Id] 
      ? { ...record, parsedPayload: editedPayloads[record.Id] }
      : record;
    
    setPayloadModal({
      isOpen: true,
      record: recordWithEdits
    });
  };

  const closePayloadModal = () => {
    setPayloadModal({
      isOpen: false,
      record: null
    });
  };

  const handleSavePayload = (recordId, editedPayload) => {
    // Store edited payload in memory
    setEditedPayloads(prev => ({
      ...prev,
      [recordId]: editedPayload
    }));

    // Update the record in the list to reflect changes
    setRecords(prev => prev.map(r => {
      if (r.Id === recordId) {
        return {
          ...r,
          parsedPayload: editedPayload
        };
      }
      return r;
    }));
  };

  const openRawDataModal = (record) => {
    setRawDataModal({
      isOpen: true,
      data: record.Payload_Data__c,
      title: `Raw JSON - ${record.Name}`
    });
  };

  const closeRawDataModal = () => {
    setRawDataModal({
      isOpen: false,
      data: null,
      title: ''
    });
  };

  const renderProductsColumn = (record) => {
    const payload = editedPayloads[record.Id] || record.parsedPayload;
    
    if (!payload) {
      return <span className="text-xs text-gray-500 dark:text-gray-400">No payload data</span>;
    }

    const models = payload.models || [];
    const data = payload.data || [];
    const apps = payload.apps || [];

    const totalCount = models.length + data.length + apps.length;

    if (totalCount === 0) {
      return <span className="text-xs text-gray-500 dark:text-gray-400">No entitlements</span>;
    }

    const hasEdits = !!editedPayloads[record.Id];

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {models.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
            📊 Models ({models.length})
          </span>
        )}
        {data.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
            💾 Data ({data.length})
          </span>
        )}
        {apps.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded">
            📱 Apps ({apps.length})
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">({totalCount} total)</span>
        {hasEdits && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
            edited
          </span>
        )}
      </div>
    );
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'Completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'In Progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Pending': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Failed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'Submitted for Onboarding': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Submitted for Deprovisioning': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'Tenant Request Completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  };

  if (loading && records.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Staging Area</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
            Experimental PoC
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Review and manage PS records before downstream processing. This is a proof-of-concept staging area with test data.
        </p>
      </div>

      {/* Stats and Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
            <div className="text-xs text-green-700 dark:text-green-400 font-medium">Confirmed</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.confirmed}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
            <div className="text-xs text-red-700 dark:text-red-400 font-medium">Rejected</div>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.rejected}</div>
          </div>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh All Samples
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  PS Record
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  Deploy Number
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  Account Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  Products
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  Payload
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                  Raw Data
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No staging records available
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const isProcessing = processingRecords.has(record.Id);
                  const isReplacing = replacingRecords.has(record.Id);
                  const hasEdits = !!editedPayloads[record.Id];
                  
                  return (
                    <tr 
                      key={record.Id} 
                      className={`transition-all duration-300 ${
                        isReplacing 
                          ? 'opacity-50 scale-95 bg-gray-100 dark:bg-gray-900' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      } ${
                        hasEdits 
                          ? 'bg-amber-50/30 dark:bg-amber-900/10' 
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {record.Name || 'N/A'}
                          </div>
                          {hasEdits && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                              edited
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {record.TenantRequestAction__c || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {record.Deployment__r?.Name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {record.Account__c || 'N/A'}
                        </div>
                        {record.Account_Site__c && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {record.Account_Site__c}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {renderProductsColumn(record)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openPayloadModal(record)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          <DocumentTextIcon className="h-4 w-4" />
                          View Payload
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openRawDataModal(record)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                        >
                          <CodeBracketIcon className="h-4 w-4" />
                          View Raw
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleConfirm(record.Id)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Confirm and replace with new record"
                          >
                            {isProcessing && processingRecords.has(record.Id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="h-4 w-4" />
                                Confirm
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(record.Id)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Reject and replace with new record"
                          >
                            {isProcessing && processingRecords.has(record.Id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="h-4 w-4" />
                                Reject
                              </>
                            )}
                          </button>
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
              Proof of Concept Staging Area
            </h4>
            <div className="mt-2 text-sm text-blue-800 dark:text-blue-200">
              <ul className="list-disc list-inside space-y-1">
                <li>This page displays {SAMPLE_SIZE} random PS records from the live database</li>
                <li>Click "View Payload" to see parsed JSON data and edit product attributes</li>
                <li>Click "View Raw" to see the complete raw JSON payload</li>
                <li>Use "Confirm" or "Reject" to process records (replaces with a new random record)</li>
                <li><strong>Note:</strong> All edits are temporary and will not be saved to the database</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Payload Modal */}
      <StagingPayloadModal
        isOpen={payloadModal.isOpen}
        onClose={closePayloadModal}
        record={payloadModal.record}
        onSave={handleSavePayload}
      />

      {/* Raw Data Modal */}
      <RawDataModal
        isOpen={rawDataModal.isOpen}
        onClose={closeRawDataModal}
        data={rawDataModal.data}
        title={rawDataModal.title}
      />
    </div>
  );
};

export default Staging;


