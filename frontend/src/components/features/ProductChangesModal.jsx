import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getCustomerProducts } from '../../services/provisioningService';
import LoadingSpinner from '../common/LoadingSpinner';

const ProductChangesModal = ({ isOpen, onClose, changes, requestNumber, accountName }) => {
  const [viewMode, setViewMode] = useState('changes'); // 'changes' or 'all'
  const [currentProducts, setCurrentProducts] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch current products when switching to 'all' view
  useEffect(() => {
    if (isOpen && viewMode === 'all' && accountName && !currentProducts) {
      fetchCurrentProducts();
    }
  }, [isOpen, viewMode, accountName]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewMode('changes');
      setCurrentProducts(null);
      setLoading(false);
    }
  }, [isOpen]);

  const fetchCurrentProducts = async () => {
    try {
      setLoading(true);
      const result = await getCustomerProducts(accountName);
      if (result.success) {
        setCurrentProducts(result.productsByRegion);
      }
    } catch (error) {
      console.error('Error fetching current products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !changes) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic text-xs">—</span>;
    }
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  // Extract current products from productsByRegion structure
  const extractCurrentProducts = (productsByRegion, type) => {
    if (!productsByRegion) return [];
    
    const allProducts = [];
    
    Object.values(productsByRegion).forEach(region => {
      if (region[type]) {
        region[type].forEach(product => {
          allProducts.push({
            ...product,
            productCode: product.productCode || product.Product_Code__c,
            name: product.name || product.Product_Name__c,
            packageName: product.packageName || product.Package_Name__c,
            quantity: product.quantity || product.Quantity__c,
            startDate: product.startDate || product.Start_Date__c,
            endDate: product.endDate || product.End_Date__c,
            productModifier: product.productModifier || product.Product_Modifier__c
          });
        });
      }
    });
    
    return allProducts;
  };

  // Create product identifier for comparison
  const getProductIdentifier = (product, type) => {
    if (!product) return '';
    
    if (type === 'models') {
      return `${product.productCode || ''}|${product.startDate || ''}|${product.endDate || ''}|${product.productModifier || ''}`;
    } else if (type === 'data') {
      return `${product.productCode || product.name || ''}|${product.startDate || ''}|${product.endDate || ''}|${product.productModifier || ''}`;
    } else if (type === 'apps') {
      return `${product.productCode || product.name || ''}|${product.packageName || ''}|${product.quantity || ''}|${product.startDate || ''}|${product.endDate || ''}|${product.productModifier || ''}`;
    }
    return '';
  };

  // Get unchanged products by comparing current with changes
  const getUnchangedProducts = (currentProds, added, removed, type) => {
    const addedIds = new Set(added.map(p => getProductIdentifier(p, type)));
    const removedIds = new Set(removed.map(p => getProductIdentifier(p, type)));
    
    return currentProds.filter(product => {
      const id = getProductIdentifier(product, type);
      return !addedIds.has(id) && !removedIds.has(id);
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'added':
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          icon: (
            <svg className="h-3 w-3 text-green-700 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="5" y2="19"></line>
              <line x1="5" x2="19" y1="12" y2="12"></line>
            </svg>
          ),
          text: <span className="text-green-700 dark:text-green-400 text-xs font-medium">Added</span>
        };
      case 'removed':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          icon: (
            <svg className="h-3 w-3 text-red-700 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" x2="19" y1="12" y2="12"></line>
            </svg>
          ),
          text: <span className="text-red-700 dark:text-red-400 text-xs font-medium">Removed</span>
        };
      case 'unchanged':
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          icon: (
            <svg className="h-3 w-3 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ),
          text: <span className="text-blue-700 dark:text-blue-400 text-xs font-medium">Unchanged</span>
        };
      default:
        return {
          bgColor: '',
          icon: null,
          text: null
        };
    }
  };

  // Render product changes table for a specific type
  const renderProductChangesTable = (title, type, changesData) => {
    if (!changesData) return null;

    const added = changesData.added || [];
    const removed = changesData.removed || [];
    
    // Get unchanged products if in 'all' view mode
    let unchanged = [];
    if (viewMode === 'all' && currentProducts) {
      const currentProds = extractCurrentProducts(currentProducts, type);
      unchanged = getUnchangedProducts(currentProds, added, removed, type);
    }
    
    const total = added.length + removed.length + unchanged.length;

    if (total === 0) {
      return (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">No {title.toLowerCase()} found.</p>
        </div>
      );
    }

    // Define columns based on product type
    let columns = [];
    if (type === 'models') {
      columns = [
        { key: 'productCode', label: 'Product Code' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    } else if (type === 'data') {
      columns = [
        { key: 'productCode', label: 'Product Code' },
        { key: 'name', label: 'Name' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    } else if (type === 'apps') {
      columns = [
        { key: 'productCode', label: 'Product Code' },
        { key: 'name', label: 'Name' },
        { key: 'packageName', label: 'Package Name' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    }

    // Build all products with their status
    const allProducts = [];
    
    added.forEach(product => {
      allProducts.push({ ...product, status: 'added' });
    });

    removed.forEach(product => {
      allProducts.push({ ...product, status: 'removed' });
    });

    unchanged.forEach(product => {
      allProducts.push({ ...product, status: 'unchanged' });
    });

    // Sort by product code or name
    allProducts.sort((a, b) => {
      const aCode = a.productCode || a.name || '';
      const bCode = b.productCode || b.name || '';
      return String(aCode).localeCompare(String(bCode));
    });

    const hasChanges = added.length > 0 || removed.length > 0;

    return (
      <details open={hasChanges} className="border rounded-lg overflow-hidden group">
        <summary className="bg-gray-50 dark:bg-gray-900 p-4 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold inline-flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Total: {total} | <span className="text-green-700 dark:text-green-400">Added: {added.length}</span> | 
                <span className="text-red-700 dark:text-red-400"> Removed: {removed.length}</span>
                {viewMode === 'all' && <span className="text-blue-700 dark:text-blue-400"> | Unchanged: {unchanged.length}</span>}
              </p>
            </div>
            {hasChanges ? (
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Has Changes</span>
            ) : (
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">No Changes</span>
            )}
          </div>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                    {col.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {allProducts.map((product, idx) => {
                const statusConfig = getStatusConfig(product.status);
                
                return (
                  <tr key={idx} className={`${statusConfig.bgColor} border-b border-gray-200 dark:border-gray-700`}>
                    {columns.map(col => {
                      const value = product[col.key];
                      return (
                        <td key={col.key} className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
                          {col.key.includes('Date') ? formatDate(value) : formatValue(value)}
                        </td>
                      );
                    })}
                    
                    {/* Status column */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {statusConfig.icon}
                        {statusConfig.text}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    );
  };

  // Calculate totals
  const totalAdded = 
    (changes.models?.added?.length || 0) + 
    (changes.data?.added?.length || 0) + 
    (changes.apps?.added?.length || 0);
  
  const totalRemoved = 
    (changes.models?.removed?.length || 0) + 
    (changes.data?.removed?.length || 0) + 
    (changes.apps?.removed?.length || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Product Changes Details</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Request: <span className="font-mono font-medium">{requestNumber}</span> | Account: <span className="font-medium">{accountName}</span>
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-green-700 dark:text-green-400 font-medium">+{totalAdded} products added</span>
                  <span className="text-red-700 dark:text-red-400 font-medium">-{totalRemoved} products removed</span>
                </div>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('changes')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'changes'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Changes Only
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  All Products
                </button>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" message="Loading current products..." />
            </div>
          ) : (
            <div className="space-y-6">
              {viewMode === 'all' && !currentProducts && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Current products data is not available. Showing changes only.
                  </p>
                </div>
              )}
              {renderProductChangesTable('Model Entitlements', 'models', changes.models)}
              {renderProductChangesTable('Data Entitlements', 'data', changes.data)}
              {renderProductChangesTable('App Entitlements', 'apps', changes.apps)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700"></span>
              Added
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700"></span>
              Removed
            </span>
            {viewMode === 'all' && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></span>
                Unchanged
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-10 px-4 py-2 text-gray-900 dark:text-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductChangesModal;

