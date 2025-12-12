import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PencilIcon, 
  CheckIcon, 
  XCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

const StagingPayloadModal = ({ isOpen, onClose, record, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPayload, setEditedPayload] = useState(null);
  const [originalPayload, setOriginalPayload] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (isOpen && record?.parsedPayload) {
      const payload = {
        models: record.parsedPayload.models || [],
        data: record.parsedPayload.data || [],
        apps: record.parsedPayload.apps || []
      };
      setOriginalPayload(JSON.parse(JSON.stringify(payload)));
      setEditedPayload(JSON.parse(JSON.stringify(payload)));
      setIsEditing(false);
      setHasUnsavedChanges(false);
      setValidationErrors({});
    }
  }, [isOpen, record]);

  if (!isOpen) return null;

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setEditedPayload(JSON.parse(JSON.stringify(originalPayload)));
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setValidationErrors({});
  };

  const handleSaveEdit = () => {
    // Validate all fields
    const errors = validatePayload(editedPayload);
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Save changes
    if (onSave) {
      onSave(record.Id, editedPayload);
    }
    
    setOriginalPayload(JSON.parse(JSON.stringify(editedPayload)));
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setValidationErrors({});
  };

  const validatePayload = (payload) => {
    const errors = {};

    // Validate models
    payload.models?.forEach((model, index) => {
      if (model.startDate && model.endDate) {
        const start = new Date(model.startDate);
        const end = new Date(model.endDate);
        if (start >= end) {
          errors[`models-${index}-dates`] = 'Start date must be before end date';
        }
      }
      if (!model.productCode || model.productCode.trim() === '') {
        errors[`models-${index}-productCode`] = 'Product code is required';
      }
    });

    // Validate data
    payload.data?.forEach((data, index) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (start >= end) {
          errors[`data-${index}-dates`] = 'Start date must be before end date';
        }
      }
    });

    // Validate apps
    payload.apps?.forEach((app, index) => {
      if (app.startDate && app.endDate) {
        const start = new Date(app.startDate);
        const end = new Date(app.endDate);
        if (start >= end) {
          errors[`apps-${index}-dates`] = 'Start date must be before end date';
        }
      }
      if (!app.productCode || app.productCode.trim() === '') {
        errors[`apps-${index}-productCode`] = 'Product code is required';
      }
      if (app.quantity !== undefined && app.quantity !== null && app.quantity !== '') {
        const qty = parseInt(app.quantity);
        if (isNaN(qty) || qty < 0) {
          errors[`apps-${index}-quantity`] = 'Quantity must be a non-negative number';
        }
      }
      if (app.licensedTransactions !== undefined && app.licensedTransactions !== null && app.licensedTransactions !== '') {
        const lt = parseInt(app.licensedTransactions);
        if (isNaN(lt) || lt < 0) {
          errors[`apps-${index}-licensedTransactions`] = 'Licensed Transactions must be a non-negative number';
        }
      }
      if (app.consumptionMultiplier !== undefined && app.consumptionMultiplier !== null && app.consumptionMultiplier !== '') {
        const cm = parseFloat(app.consumptionMultiplier);
        if (isNaN(cm) || cm < 0) {
          errors[`apps-${index}-consumptionMultiplier`] = 'Consumption Multiplier must be a non-negative number';
        }
      }
    });

    return errors;
  };

  const handleFieldChange = (type, index, field, value) => {
    setEditedPayload(prev => {
      const updated = { ...prev };
      updated[type] = [...updated[type]];
      updated[type][index] = { ...updated[type][index], [field]: value };
      return updated;
    });
    setHasUnsavedChanges(true);
    
    // Clear error for this field
    const errorKey = `${type}-${index}-${field}`;
    if (validationErrors[errorKey] || validationErrors[`${type}-${index}-dates`]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[errorKey];
        delete updated[`${type}-${index}-dates`];
        return updated;
      });
    }
  };

  const isFieldEdited = (type, index, field) => {
    if (!originalPayload || !editedPayload) return false;
    const original = originalPayload[type]?.[index]?.[field];
    const edited = editedPayload[type]?.[index]?.[field];
    return original !== edited;
  };

  const renderProductSection = (type, title, products, editableFields) => {
    if (!products || products.length === 0) return null;

    const colors = {
      models: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-900 dark:text-blue-100', badge: 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200' },
      data: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-700', text: 'text-green-900 dark:text-green-100', badge: 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' },
      apps: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-100', badge: 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200' }
    };

    const color = colors[type] || colors.models;

    return (
      <div className={`${color.bg} ${color.border} border rounded-lg p-4 mb-4`}>
        <h4 className={`text-sm font-semibold ${color.text} mb-3`}>
          {title} ({products.length})
        </h4>
        
        <div className="space-y-3">
          {products.map((product, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {editableFields.map(field => {
                  const value = product[field.key] ?? '';
                  const isEdited = isFieldEdited(type, index, field.key);
                  const errorKey = `${type}-${index}-${field.key}`;
                  const dateErrorKey = `${type}-${index}-dates`;
                  const hasError = validationErrors[errorKey] || (field.key.includes('Date') && validationErrors[dateErrorKey]);

                  return (
                    <div key={field.key} className="relative">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {isEdited && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                            edited
                          </span>
                        )}
                      </label>
                      {isEditing ? (
                        <>
                          <input
                            type={field.type || 'text'}
                            value={value}
                            onChange={(e) => handleFieldChange(type, index, field.key, e.target.value)}
                            className={`w-full px-2 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                              hasError 
                                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
                                : isEdited
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                            } text-gray-900 dark:text-gray-100`}
                            disabled={!field.editable}
                          />
                          {hasError && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {validationErrors[errorKey] || validationErrors[dateErrorKey]}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className={`px-2 py-1.5 text-sm rounded-md border ${
                          isEdited 
                            ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100' 
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                        }`}>
                          {value || '—'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const modelFields = [
    { key: 'productCode', label: 'Product Code', editable: true, type: 'text' },
    { key: 'productModifier', label: 'Product Modifier', editable: true, type: 'text' },
    { key: 'startDate', label: 'Start Date', editable: true, type: 'date' },
    { key: 'endDate', label: 'End Date', editable: true, type: 'date' }
  ];

  const dataFields = [
    { key: 'productCode', label: 'Product Code', editable: false, type: 'text' },
    { key: 'productModifier', label: 'Product Modifier', editable: true, type: 'text' },
    { key: 'startDate', label: 'Start Date', editable: true, type: 'date' },
    { key: 'endDate', label: 'End Date', editable: true, type: 'date' }
  ];

  const appFields = [
    { key: 'productCode', label: 'Product Code', editable: true, type: 'text' },
    { key: 'productModifier', label: 'Product Modifier', editable: true, type: 'text' },
    { key: 'packageName', label: 'Package Name', editable: true, type: 'text' },
    { key: 'quantity', label: 'Quantity', editable: true, type: 'number' },
    { key: 'licensedTransactions', label: 'Licensed Transactions', editable: true, type: 'number' },
    { key: 'consumptionMultiplier', label: 'Consumption Multiplier', editable: true, type: 'number' },
    { key: 'startDate', label: 'Start Date', editable: true, type: 'date' },
    { key: 'endDate', label: 'End Date', editable: true, type: 'date' }
  ];

  const totalProducts = (editedPayload?.models?.length || 0) + 
                       (editedPayload?.data?.length || 0) + 
                       (editedPayload?.apps?.length || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" 
        onClick={() => {
          if (hasUnsavedChanges && isEditing) {
            if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
              onClose();
            }
          } else {
            onClose();
          }
        }}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Parsed Payload Data
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {record?.Name} • {totalProducts} product{totalProducts !== 1 ? 's' : ''}
                {hasUnsavedChanges && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                    Unsaved changes
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Save Changes
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  if (hasUnsavedChanges && isEditing) {
                    if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Edit Mode Notice */}
          {isEditing && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
              <div className="flex items-start gap-2">
                <PencilIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Edit Mode Active
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Make your changes and click "Save Changes" to apply them. Changes are temporary and will not persist.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content - Scrollable Payload */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!editedPayload ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No payload data available
              </div>
            ) : (
              <>
                {/* Model Entitlements */}
                {renderProductSection('models', '📊 Model Entitlements', editedPayload.models, modelFields)}

                {/* Data Entitlements */}
                {renderProductSection('data', '💾 Data Entitlements', editedPayload.data, dataFields)}

                {/* App Entitlements */}
                {renderProductSection('apps', '📱 App Entitlements', editedPayload.apps, appFields)}

                {totalProducts === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No product entitlements in this payload
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isEditing ? (
                <span className="text-blue-600 dark:text-blue-400">
                  Editing mode • Click "Save Changes" to apply
                </span>
              ) : (
                <span>
                  Read-only view • Click "Edit" to make changes
                </span>
              )}
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

export default StagingPayloadModal;


