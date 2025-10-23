import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon,
  ArrowPathIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../common/LoadingSpinner';
import { getAllProductOptions, createProductUpdateRequest } from '../../services/productUpdateService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ProductUpdateModal = ({ isOpen, onClose, accountName, currentProducts, onRequestCreated }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('models');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState(null);
  
  // Track changes for each category
  const [modelsChanges, setModelsChanges] = useState({ added: [], removed: [], modified: [] });
  const [dataChanges, setDataChanges] = useState({ added: [], removed: [], modified: [] });
  const [appsChanges, setAppsChanges] = useState({ added: [], removed: [], modified: [] });
  
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('normal');

  // Load options when modal opens
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  const loadOptions = async () => {
    try {
      setLoading(true);
      const result = await getAllProductOptions();
      
      if (result.success) {
        setOptions(result.options);
      } else {
        showToast('Failed to load product options', 'error');
      }
    } catch (error) {
      showToast('Error loading product options', 'error');
      console.error('Error loading options:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentCategoryChanges = () => {
    switch (activeTab) {
      case 'models': return modelsChanges;
      case 'data': return dataChanges;
      case 'apps': return appsChanges;
      default: return { added: [], removed: [], modified: [] };
    }
  };

  const setCurrentCategoryChanges = (changes) => {
    switch (activeTab) {
      case 'models': setModelsChanges(changes); break;
      case 'data': setDataChanges(changes); break;
      case 'apps': setAppsChanges(changes); break;
    }
  };

  const getCurrentProducts = () => {
    if (!currentProducts) return [];
    
    // Flatten products from all regions for the current category
    const allProducts = [];
    Object.values(currentProducts).forEach(region => {
      if (region[activeTab]) {
        allProducts.push(...region[activeTab]);
      }
    });
    return allProducts;
  };

  const addNewEntitlement = () => {
    const changes = getCurrentCategoryChanges();
    const newEntitlement = {
      id: `new-${Date.now()}`,
      productCode: '',
      productName: '',
      packageName: '',
      quantity: 1,
      productModifier: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isNew: true
    };
    
    setCurrentCategoryChanges({
      ...changes,
      added: [...changes.added, newEntitlement]
    });
  };

  const updateAddedEntitlement = (id, field, value) => {
    const changes = getCurrentCategoryChanges();
    const updated = changes.added.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    
    // If product is selected, auto-fill product name
    if (field === 'productCode' && options?.products?.[activeTab]) {
      const selectedProduct = options.products[activeTab].find(p => p.value === value);
      if (selectedProduct) {
        const index = updated.findIndex(item => item.id === id);
        if (index !== -1) {
          updated[index].productName = selectedProduct.label;
        }
      }
    }
    
    setCurrentCategoryChanges({
      ...changes,
      added: updated
    });
  };

  const removeAddedEntitlement = (id) => {
    const changes = getCurrentCategoryChanges();
    setCurrentCategoryChanges({
      ...changes,
      added: changes.added.filter(item => item.id !== id)
    });
  };

  const toggleRemoveExisting = (product) => {
    const changes = getCurrentCategoryChanges();
    const isMarkedForRemoval = changes.removed.some(p => p.productCode === product.productCode);
    
    if (isMarkedForRemoval) {
      // Unmark for removal
      setCurrentCategoryChanges({
        ...changes,
        removed: changes.removed.filter(p => p.productCode !== product.productCode)
      });
    } else {
      // Mark for removal
      setCurrentCategoryChanges({
        ...changes,
        removed: [...changes.removed, product]
      });
    }
  };

  const isMarkedForRemoval = (product) => {
    const changes = getCurrentCategoryChanges();
    return changes.removed.some(p => p.productCode === product.productCode);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate that there are changes
      const totalChanges = 
        modelsChanges.added.length + modelsChanges.removed.length +
        dataChanges.added.length + dataChanges.removed.length +
        appsChanges.added.length + appsChanges.removed.length;
      
      if (totalChanges === 0) {
        showToast('Please make at least one change before submitting', 'warning');
        setSubmitting(false);
        return;
      }
      
      // Validate added entitlements have required fields
      const validateAdded = (items) => {
        return items.every(item => 
          item.productCode && 
          item.packageName && 
          item.startDate && 
          item.endDate
        );
      };
      
      if (!validateAdded(modelsChanges.added) || 
          !validateAdded(dataChanges.added) || 
          !validateAdded(appsChanges.added)) {
        showToast('Please fill in all required fields for new entitlements', 'error');
        setSubmitting(false);
        return;
      }
      
      console.log('Submitting product update request...', {
        accountName,
        requestedBy: user?.username,
        changes: {
          models: modelsChanges,
          data: dataChanges,
          apps: appsChanges
        }
      });
      
      const requestData = {
        accountName,
        requestedBy: user?.username || 'unknown',
        priority,
        requestType: 'modify',
        notes,
        changes: {
          models: modelsChanges,
          data: dataChanges,
          apps: appsChanges
        }
      };
      
      const result = await createProductUpdateRequest(requestData);
      
      console.log('Request result:', result);
      
      if (result.success) {
        showToast(`Product update request created: ${result.request.requestNumber}`, 'success');
        onRequestCreated?.(result.request);
        handleClose();
      } else {
        const errorMsg = result.error || 'Failed to create product update request';
        showToast(errorMsg, 'error');
        console.error('Request failed:', result);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Error creating product update request';
      showToast(errorMsg, 'error');
      console.error('Error submitting request:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setActiveTab('models');
    setModelsChanges({ added: [], removed: [], modified: [] });
    setDataChanges({ added: [], removed: [], modified: [] });
    setAppsChanges({ added: [], removed: [], modified: [] });
    setNotes('');
    setPriority('normal');
    onClose();
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'models', label: 'Models', icon: '📊' },
    { id: 'data', label: 'Data', icon: '💾' },
    { id: 'apps', label: 'Apps', icon: '📱' }
  ];

  const currentChanges = getCurrentCategoryChanges();
  const currentProductsList = getCurrentProducts();
  
  const totalChangesCount = 
    modelsChanges.added.length + modelsChanges.removed.length +
    dataChanges.added.length + dataChanges.removed.length +
    appsChanges.added.length + appsChanges.removed.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Product Update Request
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {accountName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {(() => {
                  const changes = tab.id === 'models' ? modelsChanges :
                                tab.id === 'data' ? dataChanges : appsChanges;
                  const count = changes.added.length + changes.removed.length;
                  return count > 0 ? (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" message="Loading product options..." />
            </div>
          ) : (
            <>
              {/* Current Entitlements */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Current Entitlements
                </h3>
                
                {currentProductsList.length === 0 ? (
                  <p className="text-gray-500 text-sm">No current entitlements in this category</p>
                ) : (
                  <div className="space-y-2">
                    {currentProductsList.map((product, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isMarkedForRemoval(product)
                            ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                            : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {product.productName || product.productCode}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {product.packageName} • {product.productCode}
                            {product.endDate && (
                              <span className="ml-2">
                                • Expires: {new Date(product.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleRemoveExisting(product)}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            isMarkedForRemoval(product)
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {isMarkedForRemoval(product) ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 inline mr-1" />
                              Undo Remove
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4 inline mr-1" />
                              Remove
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Entitlements */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Add New Entitlements
                  </h3>
                  <button
                    onClick={addNewEntitlement}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Entitlement
                  </button>
                </div>

                {currentChanges.added.length === 0 ? (
                  <p className="text-gray-500 text-sm">No new entitlements added yet</p>
                ) : (
                  <div className="space-y-4">
                    {currentChanges.added.map(item => (
                      <div key={item.id} className="p-4 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Product Code */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Product Code <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={item.productCode}
                              onChange={(e) => updateAddedEntitlement(item.id, 'productCode', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">Select Product</option>
                              {options?.products?.[activeTab]?.map(opt => (
                                <option key={opt.id} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Package */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Package <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={item.packageName}
                              onChange={(e) => updateAddedEntitlement(item.id, 'packageName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">Select Package</option>
                              {options?.packages?.map(opt => (
                                <option key={opt.id} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateAddedEntitlement(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>

                          {/* Modifier */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Modifier
                            </label>
                            <select
                              value={item.productModifier}
                              onChange={(e) => updateAddedEntitlement(item.id, 'productModifier', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="">Select Modifier</option>
                              {options?.modifiers?.map(opt => (
                                <option key={opt.id} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Start Date */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={item.startDate}
                              onChange={(e) => updateAddedEntitlement(item.id, 'startDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>

                          {/* End Date */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              End Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={item.endDate}
                              onChange={(e) => updateAddedEntitlement(item.id, 'endDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => removeAddedEntitlement(item.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this request..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {totalChangesCount > 0 ? (
                <span className="font-medium text-blue-600">
                  {totalChangesCount} change{totalChangesCount !== 1 ? 's' : ''} pending
                </span>
              ) : (
                'No changes yet'
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || totalChangesCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductUpdateModal;

