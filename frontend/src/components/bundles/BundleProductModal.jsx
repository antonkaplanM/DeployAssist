import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { CubeIcon } from '@heroicons/react/24/solid';

const BundleProductModal = ({ isOpen, onClose, bundle }) => {
  if (!isOpen || !bundle) return null;

  const products = bundle.products || [];

  // Group products by Product Selection Grouping
  const groupedBySelectionGrouping = useMemo(() => {
    const groups = {};
    
    products.forEach((product) => {
      const grouping = product.Product_Selection_Grouping__c || 'Ungrouped';
      if (!groups[grouping]) {
        groups[grouping] = [];
      }
      groups[grouping].push(product);
    });
    
    // Sort each group by product name
    Object.keys(groups).forEach((grouping) => {
      groups[grouping].sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
    });
    
    return groups;
  }, [products]);

  // Define colors for different groupings - cycling through color schemes
  const colorSchemes = [
    { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', icon: 'text-blue-600' },
    { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-200', icon: 'text-green-600' },
    { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200', icon: 'text-purple-600' },
    { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-200', icon: 'text-orange-600' },
    { bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-200', icon: 'text-pink-600' },
    { bg: 'bg-indigo-50', text: 'text-indigo-900', border: 'border-indigo-200', icon: 'text-indigo-600' },
    { bg: 'bg-teal-50', text: 'text-teal-900', border: 'border-teal-200', icon: 'text-teal-600' },
  ];
  
  const defaultColor = { bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200', icon: 'text-gray-600' };

  const getColor = (grouping, index) => {
    if (grouping === 'Ungrouped') return defaultColor;
    return colorSchemes[index % colorSchemes.length];
  };

  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 1), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-5xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <CubeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {bundle.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {bundle.bundle_id} • {totalProducts} product{totalProducts !== 1 ? 's' : ''} • {totalQuantity} total quantity
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Description */}
          {bundle.description && (
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">{bundle.description}</p>
            </div>
          )}

          {/* Content - Grouped Tables */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <CubeIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No products in this bundle</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedBySelectionGrouping).map(([grouping, groupProducts], groupIndex) => {
                  const colors = getColor(grouping, groupIndex);
                  const groupTotal = groupProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
                  
                  return (
                    <div key={grouping} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Grouping Header */}
                      <div className={`${colors.bg} ${colors.border} border-b px-4 py-3 flex items-center justify-between`}>
                        <div>
                          <h4 className={`text-sm font-semibold ${colors.text}`}>
                            {grouping}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {groupProducts.length} product{groupProducts.length !== 1 ? 's' : ''} • {groupTotal} total quantity
                          </p>
                        </div>
                      </div>

                      {/* Products Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Product Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                                Product Code
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                                Product Family
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                                Product Group
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                                Quantity
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {groupProducts.map((product, index) => (
                              <tr 
                                key={product.Id || index}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {product.Name || '—'}
                                  </div>
                                  {product.Description && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                                      {product.Description}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                    {product.ProductCode || '—'}
                                  </code>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {product.Family || '—'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {product.Product_Group__c || '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                    {product.quantity || 1}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{totalProducts}</span> unique product{totalProducts !== 1 ? 's' : ''} • 
              <span className="font-semibold text-gray-900 dark:text-gray-100 ml-1">{totalQuantity}</span> total items
            </div>
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
  );
};

export default BundleProductModal;

