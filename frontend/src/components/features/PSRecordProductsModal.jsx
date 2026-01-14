import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { getStagingRecordById } from '../../services/stagingService';

const PSRecordProductsModal = ({ isOpen, onClose, psRecordId, psRecordName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set(['models', 'data', 'apps']));
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [packageModalData, setPackageModalData] = useState(null);

  // Fetch PS record data when modal opens
  useEffect(() => {
    if (isOpen && psRecordId) {
      fetchRecordData();
    }
  }, [isOpen, psRecordId]);

  const fetchRecordData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getStagingRecordById(psRecordId);
      
      if (result.success && result.record) {
        setRecordData(result.record);
      } else {
        setError('Failed to load PS record details');
      }
    } catch (err) {
      console.error('Error fetching PS record:', err);
      setError(err.message || 'Failed to load PS record details');
    } finally {
      setLoading(false);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Helper functions to normalize field names
  const getProductCode = (item) => item.productCode || item.product_code || item.ProductCode || item.name || '—';
  const getStartDate = (item) => item.startDate || item.start_date || item.StartDate || '—';
  const getEndDate = (item) => item.endDate || item.end_date || item.EndDate || '—';
  const getQuantity = (item) => item.quantity !== undefined ? item.quantity : (item.Quantity !== undefined ? item.Quantity : '—');
  const getModifier = (item) => item.productModifier || item.ProductModifier || '—';
  const getPackageName = (item) => item.packageName || item.package_name || item.PackageName || '—';

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Fetch package info
  const handleShowPackageInfo = async (packageName) => {
    if (!packageName || packageName === '—') return;
    
    setLoadingPackage(true);
    
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(packageName)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          alert(`Package not found: ${packageName}`);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.package) {
        setPackageModalData(data.package);
      } else {
        alert(`Package not found: ${packageName}`);
      }
    } catch (error) {
      console.error('Error fetching package info:', error);
      alert('Failed to load package information');
    } finally {
      setLoadingPackage(false);
    }
  };

  // Category configuration
  const categoryConfig = {
    models: {
      label: 'Model Entitlements',
      icon: '🧮',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-700 dark:text-blue-300',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
      columns: [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate },
        { key: 'modifier', label: 'Modifier', get: getModifier }
      ]
    },
    data: {
      label: 'Data Entitlements',
      icon: '📊',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-300',
      badgeColor: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      columns: [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ]
    },
    apps: {
      label: 'App Entitlements',
      icon: '📱',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      textColor: 'text-purple-700 dark:text-purple-300',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
      columns: [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'packageName', label: 'Package Name', get: getPackageName, showInfo: true },
        { key: 'quantity', label: 'Quantity', get: getQuantity },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ]
    }
  };

  const renderCategorySection = (categoryKey, products) => {
    const config = categoryConfig[categoryKey];
    const isExpanded = expandedCategories.has(categoryKey);
    const productCount = products?.length || 0;

    return (
      <div key={categoryKey} className={`rounded-lg border ${config.borderColor} overflow-hidden mb-4 last:mb-0`}>
        {/* Category Header - Clickable */}
        <button
          onClick={() => toggleCategory(categoryKey)}
          className={`w-full flex items-center justify-between px-4 py-3 ${config.bgColor} hover:opacity-90 transition-opacity`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{config.icon}</span>
            <h4 className={`font-semibold ${config.textColor}`}>
              {config.label}
            </h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.badgeColor}`}>
              {productCount} item{productCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDownIcon className={`h-5 w-5 ${config.textColor}`} />
            ) : (
              <ChevronRightIcon className={`h-5 w-5 ${config.textColor}`} />
            )}
          </div>
        </button>

        {/* Category Content - Products Table */}
        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            {productCount === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                No {config.label.toLowerCase()} in this PS record
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {config.columns.map((col) => (
                      <th key={col.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {config.columns.map((col) => {
                        const value = col.get(item);

                        // Special rendering for package name with info icon
                        if (col.showInfo && value !== '—' && value) {
                          return (
                            <td key={col.key} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-2">
                                <span>{value}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowPackageInfo(value);
                                  }}
                                  className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors p-1"
                                  title="View package details"
                                >
                                  <InformationCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {col.key === 'startDate' || col.key === 'endDate' ? formatDate(value) : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const parsedPayload = recordData?.parsedPayload;
  const totalProducts = (parsedPayload?.models?.length || 0) + 
                       (parsedPayload?.data?.length || 0) + 
                       (parsedPayload?.apps?.length || 0);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 transition-opacity" onClick={onClose}></div>

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-4xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-b border-indigo-200 dark:border-indigo-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  PS Record Products
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-medium mr-2">
                    {psRecordName || psRecordId}
                  </span>
                  {!loading && parsedPayload && (
                    <span>• {totalProducts} total product{totalProducts !== 1 ? 's' : ''}</span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">Loading PS record products...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                  <button
                    onClick={fetchRecordData}
                    className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : !parsedPayload ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>No product entitlements found in this PS record.</p>
                  <p className="text-sm mt-2">The payload may not contain entitlement data.</p>
                </div>
              ) : (
                <>
                  {/* Tenant Info Banner */}
                  {(parsedPayload.tenantName || parsedPayload.region) && (
                    <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center gap-4 text-sm">
                      {parsedPayload.tenantName && (
                        <span className="text-gray-700 dark:text-gray-300">
                          <strong>Tenant:</strong> {parsedPayload.tenantName}
                        </span>
                      )}
                      {parsedPayload.region && (
                        <span className="text-gray-700 dark:text-gray-300">
                          <strong>Region:</strong> {parsedPayload.region}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Category Sections */}
                  {renderCategorySection('models', parsedPayload.models)}
                  {renderCategorySection('data', parsedPayload.data)}
                  {renderCategorySection('apps', parsedPayload.apps)}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Package Info Modal (nested) */}
      {packageModalData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setPackageModalData(null)}></div>
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{packageModalData.package_name}</h3>
                  {packageModalData.ri_package_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">RI Package: {packageModalData.ri_package_name}</p>
                  )}
                  {packageModalData.package_type && (
                    <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
                      packageModalData.package_type === 'Base' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {packageModalData.package_type}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPackageModalData(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Description */}
              {packageModalData.description && (
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{packageModalData.description}</p>
                </div>
              )}

              {/* Capacity & Limits */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Capacity & Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  {packageModalData.locations && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Locations</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{Number(packageModalData.locations).toLocaleString()}</div>
                    </div>
                  )}
                  {packageModalData.max_concurrent_model && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Concurrent Model Jobs</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{packageModalData.max_concurrent_model}</div>
                    </div>
                  )}
                  {packageModalData.max_concurrent_non_model && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Concurrent Non-Model Jobs</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{packageModalData.max_concurrent_non_model}</div>
                    </div>
                  )}
                  {packageModalData.max_jobs_day && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Jobs per Day</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{Number(packageModalData.max_jobs_day).toLocaleString()}</div>
                    </div>
                  )}
                  {packageModalData.max_users && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Users</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{Number(packageModalData.max_users).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setPackageModalData(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for package info */}
      {loadingPackage && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-600 dark:text-gray-300">Loading package details...</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PSRecordProductsModal;
