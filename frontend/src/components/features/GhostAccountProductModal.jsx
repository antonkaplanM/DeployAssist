import React, { useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const GhostAccountProductModal = ({ isOpen, onClose, allProducts, accountName }) => {
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [packageModalData, setPackageModalData] = useState(null);

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

  const isProductExpired = (item) => {
    return item.isExpired === true || item.status === 'expired';
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

  const renderProductTable = (products, category) => {
    if (!products || products.length === 0) return null;

    const expiredCount = products.filter(p => isProductExpired(p)).length;
    const activeCount = products.length - expiredCount;

    // Determine columns based on category
    let columns = [];
    if (category === 'models') {
      columns = [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate },
        { key: 'modifier', label: 'Modifier', get: getModifier }
      ];
    } else if (category === 'apps') {
      columns = [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'packageName', label: 'Package Name', get: getPackageName, showInfo: true },
        { key: 'quantity', label: 'Quantity', get: getQuantity },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ];
    } else {
      // data
      columns = [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ];
    }

    const categoryLabels = {
      models: 'Model Entitlements',
      data: 'Data Entitlements',
      apps: 'App Entitlements'
    };

    const categoryColors = {
      models: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      data: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      apps: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
    };

    const colors = categoryColors[category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

    return (
      <div key={category} className="mb-6 last:mb-0">
        <div className={`flex items-center justify-between px-4 py-2 ${colors.bg} ${colors.border} border-b-2 rounded-t-lg`}>
          <h4 className={`font-semibold ${colors.text}`}>
            {categoryLabels[category]}
          </h4>
          <div className="flex gap-3 text-xs">
            {activeCount > 0 && (
              <span className="px-2 py-1 bg-white rounded-full text-gray-700">
                {activeCount} Active
              </span>
            )}
            {expiredCount > 0 && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                {expiredCount} Expired
              </span>
            )}
          </div>
        </div>
        
        <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 w-6"></th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((item, index) => {
                const expired = isProductExpired(item);
                const rowClass = expired
                  ? 'border-b bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'border-b hover:bg-gray-50';

                return (
                  <tr 
                    key={index} 
                    className={rowClass}
                    title={expired ? 'This product is expired' : ''}
                  >
                    <td className="px-2 py-2 w-6 text-center">
                      {expired && (
                        <svg className="h-3 w-3 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      )}
                    </td>
                    {columns.map((col) => {
                      const value = col.get(item);

                      // Special rendering for package name with info icon
                      if (col.showInfo && value !== '—' && value) {
                        return (
                          <td key={col.key} className="px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{value}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowPackageInfo(value);
                                }}
                                className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors p-1"
                                title="View package details"
                              >
                                <InformationCircleIcon className="h-4 w-4 text-blue-600" />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="px-3 py-2 text-sm text-gray-900">
                          {col.key === 'startDate' || col.key === 'endDate' ? formatDate(value) : value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const totalProducts = (allProducts?.models?.length || 0) + (allProducts?.data?.length || 0) + (allProducts?.apps?.length || 0);
  const totalExpired = [
    ...(allProducts?.models || []),
    ...(allProducts?.data || []),
    ...(allProducts?.apps || [])
  ].filter(p => isProductExpired(p)).length;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-6xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Customer Products - {accountName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {totalProducts} total product{totalProducts !== 1 ? 's' : ''} • 
                  <span className="ml-1 font-medium text-yellow-700 dark:text-yellow-500">{totalExpired} expired</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Content - All Product Categories */}
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
              {totalProducts === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No products found for this account
                </div>
              ) : (
                <>
                  {renderProductTable(allProducts?.models, 'models')}
                  {renderProductTable(allProducts?.data, 'data')}
                  {renderProductTable(allProducts?.apps, 'apps')}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-between items-center border-t">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <svg className="h-3 w-3 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Yellow background indicates expired products
                </span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50"
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
                  <h3 className="text-lg font-semibold text-gray-900">{packageModalData.package_name}</h3>
                  {packageModalData.ri_package_name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">RI Package: {packageModalData.ri_package_name}</p>
                  )}
                  {packageModalData.package_type && (
                    <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
                      packageModalData.package_type === 'Base' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {packageModalData.package_type}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPackageModalData(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 flex-shrink-0"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Description */}
              {packageModalData.description && (
                <div className="p-6 border-b">
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
                      <div className="text-lg font-semibold text-gray-900">{Number(packageModalData.locations).toLocaleString()}</div>
                    </div>
                  )}
                  {packageModalData.max_concurrent_model && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Concurrent Model Jobs</div>
                      <div className="text-lg font-semibold text-gray-900">{packageModalData.max_concurrent_model}</div>
                    </div>
                  )}
                  {packageModalData.max_concurrent_non_model && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Concurrent Non-Model Jobs</div>
                      <div className="text-lg font-semibold text-gray-900">{packageModalData.max_concurrent_non_model}</div>
                    </div>
                  )}
                  {packageModalData.max_jobs_day && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Jobs per Day</div>
                      <div className="text-lg font-semibold text-gray-900">{Number(packageModalData.max_jobs_day).toLocaleString()}</div>
                    </div>
                  )}
                  {packageModalData.max_users && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Users</div>
                      <div className="text-lg font-semibold text-gray-900">{Number(packageModalData.max_users).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end border-t">
                <button
                  onClick={() => setPackageModalData(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loadingPackage && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading package details...</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GhostAccountProductModal;

