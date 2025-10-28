import React, { useState, useMemo } from 'react';
import { XMarkIcon, InformationCircleIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const ProductModal = ({ isOpen, onClose, products, productType, requestName, validationResult = null }) => {
  const [packageModalData, setPackageModalData] = useState(null);
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const typeLabels = {
    models: 'Model Entitlements',
    data: 'Data Entitlements',
    apps: 'App Entitlements',
  };

  const typeColors = {
    models: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', icon: 'text-blue-600' },
    data: { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-200', icon: 'text-green-600' },
    apps: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200', icon: 'text-purple-600' },
  };

  const colors = typeColors[productType] || { bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200', icon: 'text-gray-600' };

  // Helper functions to normalize field names (declared before use)
  const getProductCode = (item) => item.productCode || item.product_code || item.ProductCode || item.name || '—';
  const getStartDate = (item) => item.startDate || item.start_date || item.StartDate || '—';
  const getEndDate = (item) => item.endDate || item.end_date || item.EndDate || '—';
  const getQuantity = (item) => item.quantity !== undefined ? item.quantity : (item.Quantity !== undefined ? item.Quantity : '—');
  const getModifier = (item) => item.productModifier || item.ProductModifier || '—';
  const getPackageName = (item) => item.packageName || item.package_name || item.PackageName || '—';

  // Check if a product is expired
  const isProductExpired = (item) => {
    return item.isExpired === true || item.status === 'expired';
  };

  // Check if an individual item has a validation issue
  const hasValidationIssue = (item, index) => {
    if (!validationResult || validationResult.overallStatus !== 'FAIL') {
      return false;
    }

    // Map UI groupType to validation engine type
    const validationGroupType = {
      'models': 'model',
      'apps': 'app',
      'data': 'data'
    }[productType] || productType;

    // Look for date overlap validation failures
    const dateOverlapRule = validationResult.ruleResults?.find(rule =>
      rule.ruleId === 'entitlement-date-overlap-validation' && rule.status === 'FAIL'
    );

    if (dateOverlapRule?.details?.overlaps) {
      // Check if this item is involved in any overlaps
      const hasOverlap = dateOverlapRule.details.overlaps.some(overlap =>
        (overlap.entitlement1.type === validationGroupType && overlap.entitlement1.index === (index + 1)) ||
        (overlap.entitlement2.type === validationGroupType && overlap.entitlement2.index === (index + 1))
      );

      if (hasOverlap) return true;
    }

    // Look for date gap validation failures
    const dateGapRule = validationResult.ruleResults?.find(rule =>
      rule.ruleId === 'entitlement-date-gap-validation' && rule.status === 'FAIL'
    );

    if (dateGapRule?.details?.gaps) {
      // Check if this item is involved in any gaps
      const hasGap = dateGapRule.details.gaps.some(gap =>
        (gap.entitlement1.type === validationGroupType && gap.entitlement1.index === (index + 1)) ||
        (gap.entitlement2.type === validationGroupType && gap.entitlement2.index === (index + 1))
      );

      if (hasGap) return true;
    }

    // Look for app quantity validation failures (only for apps groupType)
    if (productType === 'apps') {
      const appQuantityRule = validationResult.ruleResults?.find(rule =>
        rule.ruleId === 'app-quantity-validation' && rule.status === 'FAIL'
      );

      if (appQuantityRule?.details?.failures && appQuantityRule.details.failures.length > 0) {
        // Check if this specific app failed
        const productCode = getProductCode(item);
        const quantity = getQuantity(item);

        // An app fails if quantity !== 1 AND productCode !== "IC-DATABRIDGE" AND productCode !== "RI-RISKMODELER-EXPANSION"
        if (quantity !== 1 && quantity !== '1' && productCode !== "IC-DATABRIDGE" && productCode !== "RI-RISKMODELER-EXPANSION") {
          return true;
        }
      }

      // Look for app package name validation failures (only for apps groupType)
      const appPackageNameRule = validationResult.ruleResults?.find(rule =>
        rule.ruleId === 'app-package-name-validation' && rule.status === 'FAIL'
      );

      if (appPackageNameRule?.details?.failures && appPackageNameRule.details.failures.length > 0) {
        // Check if this specific app failed - missing package name
        const packageName = getPackageName(item);
        const productCode = getProductCode(item);

        // Exceptions: DATAAPI-LOCINTEL, IC-RISKDATALAKE, RI-COMETA, and DATAAPI-BULK-GEOCODE don't require package names
        const isException = productCode === 'DATAAPI-LOCINTEL' || productCode === 'IC-RISKDATALAKE' || 
                           productCode === 'RI-COMETA' || productCode === 'DATAAPI-BULK-GEOCODE';

        // An app fails if packageName is missing or empty, UNLESS it's an exception product
        if ((!packageName || packageName === '—' || packageName.trim() === '') && !isException) {
          return true;
        }
      }
    }

    return false;
  };

  // Group products by product code and aggregate dates
  const groupedProducts = useMemo(() => {
    if (!products || !Array.isArray(products) || products.length === 0) return [];

    const grouped = new Map();
    
    products.forEach((item, originalIndex) => {
      if (!item) return; // Skip null/undefined items
      
      const productCode = getProductCode(item);
      const startDate = getStartDate(item);
      const endDate = getEndDate(item);
      
      if (!grouped.has(productCode)) {
        grouped.set(productCode, {
          productCode: productCode,
          items: [],
          minStartDate: startDate,
          maxEndDate: endDate,
          defaultItem: item
        });
      }
      
      const group = grouped.get(productCode);
      if (group) {
        group.items.push({ ...item, originalIndex });
        
        // Update min/max dates
        if (startDate !== '—' && (group.minStartDate === '—' || new Date(startDate) < new Date(group.minStartDate))) {
          group.minStartDate = startDate;
        }
        if (endDate !== '—' && (group.maxEndDate === '—' || new Date(endDate) > new Date(group.maxEndDate))) {
          group.maxEndDate = endDate;
        }
      }
    });
    
    return Array.from(grouped.values());
  }, [products]);

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

  // Determine columns based on product type
  const columns = useMemo(() => {
    if (productType === 'models') {
      return [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate },
        { key: 'modifier', label: 'Modifier', get: getModifier }
      ];
    } else if (productType === 'apps') {
      return [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'packageName', label: 'Package Name', get: getPackageName, showInfo: true },
        { key: 'quantity', label: 'Quantity', get: getQuantity },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ];
    } else {
      // data entitlements
      return [
        { key: 'productCode', label: 'Product Code', get: getProductCode },
        { key: 'startDate', label: 'Start Date', get: getStartDate },
        { key: 'endDate', label: 'End Date', get: getEndDate }
      ];
    }
  }, [productType]);

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Toggle group expansion
  const toggleGroup = (groupIndex) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  };

  // Don't render anything if modal is closed
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-4xl">
            {/* Header */}
            <div className={`${colors.bg} ${colors.border} border-b px-6 py-4 flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text}`}>
                  {typeLabels[productType]}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {requestName} • {products?.length || 0} item{products?.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-gray-200 dark:bg-gray-600 transition-colors"
              >
                <XMarkIcon className={`h-6 w-6 ${colors.icon}`} />
              </button>
            </div>

            {/* Content - Table */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {!products || products.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No {typeLabels[productType].toLowerCase()} found
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="px-1 py-2 w-4 text-center text-xs font-medium text-gray-500"></th>
                      {columns.map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.map((group, groupIndex) => {
                      const isMultiple = group.items.length > 1;
                      const isExpanded = expandedGroups.has(groupIndex);
                      
                      // For single items, check if they have validation issues or are expired
                      const singleItemHasIssue = !isMultiple && group.items.length === 1 
                        ? hasValidationIssue(group.items[0], group.items[0].originalIndex)
                        : false;
                      const singleItemIsExpired = !isMultiple && group.items.length === 1 
                        ? isProductExpired(group.items[0])
                        : false;
                      
                      let mainRowClass;
                      if (singleItemHasIssue) {
                        mainRowClass = 'border-b bg-red-50 border-red-200 transition-colors';
                      } else if (singleItemIsExpired) {
                        mainRowClass = 'border-b bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 transition-colors';
                      } else {
                        mainRowClass = `border-b transition-colors ${isMultiple ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'}`;
                      }
                      
                      return (
                        <React.Fragment key={groupIndex}>
                          {/* Main row (aggregated view or single item) */}
                          <tr 
                            className={mainRowClass}
                            onClick={isMultiple ? () => toggleGroup(groupIndex) : undefined}
                            title={singleItemHasIssue ? 'This entitlement has a validation failure' : (singleItemIsExpired ? 'This product is expired' : '')}
                          >
                            {/* Expand icon column or warning icon for single item */}
                            <td className="px-1 py-3 w-4 text-center">
                              {isMultiple ? (
                                <ChevronRightIcon 
                                  className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                              ) : singleItemHasIssue ? (
                                <svg className="h-3 w-3 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                  <path d="M12 9v4"></path>
                                  <path d="m12 17 .01 0"></path>
                                </svg>
                              ) : singleItemIsExpired ? (
                                <svg className="h-3 w-3 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="12" y1="8" x2="12" y2="12"></line>
                                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                              ) : null}
                            </td>
                            
                            {columns.map((col, colIndex) => {
                              let value;
                              if (col.key === 'startDate') {
                                value = formatDate(group.minStartDate);
                              } else if (col.key === 'endDate') {
                                value = formatDate(group.maxEndDate);
                              } else {
                                value = col.get(group.defaultItem);
                              }

                              // Special rendering for product code with instance count
                              if (col.key === 'productCode' && isMultiple) {
                                return (
                                  <td key={col.key} className="px-3 py-3 text-sm">
                                    <span className="font-medium">{value}</span>
                                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                      {group.items.length} instances
                                    </span>
                                  </td>
                                );
                              }

                              // Special rendering for package name with info icon
                              if (col.showInfo && value !== '—' && value) {
                                return (
                                  <td key={col.key} className="px-3 py-3 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span>{value}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShowPackageInfo(value);
                                        }}
                                        className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors p-1"
                                        title="View package details"
                                      >
                                        <InformationCircleIcon className="h-4 w-4 text-blue-600" />
                                      </button>
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td key={col.key} className="px-3 py-3 text-sm text-gray-900">
                                  {value}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Child rows (individual items) - shown when expanded */}
                          {isMultiple && isExpanded && group.items.map((item, itemIndex) => {
                            const hasIssue = hasValidationIssue(item, item.originalIndex);
                            const itemIsExpired = isProductExpired(item);
                            
                            let childRowClass;
                            if (hasIssue) {
                              childRowClass = 'border-b bg-red-50 border-red-200';
                            } else if (itemIsExpired) {
                              childRowClass = 'border-b bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
                            } else {
                              childRowClass = 'border-b bg-gray-50';
                            }

                            return (
                              <tr 
                                key={`${groupIndex}-${itemIndex}`} 
                                className={childRowClass}
                                title={hasIssue ? 'This entitlement has a validation failure' : (itemIsExpired ? 'This product is expired' : '')}
                              >
                                {/* Empty cell or item number / warning icon */}
                                <td className="px-1 py-2 w-4 text-center pl-6">
                                  {hasIssue ? (
                                    <svg className="h-3 w-3 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                      <path d="M12 9v4"></path>
                                      <path d="m12 17 .01 0"></path>
                                    </svg>
                                  ) : itemIsExpired ? (
                                    <svg className="h-3 w-3 text-yellow-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <line x1="12" y1="8" x2="12" y2="12"></line>
                                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                  ) : (
                                    <span className="text-xs text-gray-400">{itemIndex + 1}</span>
                                  )}
                                </td>
                              
                                {columns.map((col) => {
                                  const value = col.get(item);

                                  // Special rendering for package name with info icon
                                  if (col.showInfo && value !== '—' && value) {
                                    return (
                                      <td key={col.key} className="px-3 py-2 text-sm text-gray-700">
                                        <div className="flex items-center gap-2">
                                          <span>{value}</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleShowPackageInfo(value);
                                            }}
                                            className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors p-1"
                                            title="View package details"
                                          >
                                            <InformationCircleIcon className="h-4 w-4 text-blue-600" />
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={col.key} className="px-3 py-2 text-sm text-gray-700">
                                      {col.key === 'startDate' || col.key === 'endDate' ? formatDate(value) : value}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end border-t">
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

export default ProductModal;


