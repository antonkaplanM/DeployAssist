import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ComparisonModal = ({ isOpen, onClose, request1, request2 }) => {
  // Parse payload data
  const parsePayload = (request) => {
    if (!request?.Payload_Data__c) {
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
    
    try {
      const payload = JSON.parse(request.Payload_Data__c);
      const entitlements = payload?.properties?.provisioningDetail?.entitlements || {};
      
      return {
        modelEntitlements: entitlements.modelEntitlements || [],
        dataEntitlements: entitlements.dataEntitlements || [],
        appEntitlements: entitlements.appEntitlements || []
      };
    } catch (err) {
      console.error('Error parsing payload:', err);
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
  };

  // Extract PS number from request name (e.g., "PS-4280" -> 4280)
  const extractPSNumber = (name) => {
    const match = name?.match(/PS-(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  };

  // Determine which is current vs previous based on PS number (higher = current)
  const { currentRequest, previousRequest } = useMemo(() => {
    if (!request1 || !request2) return { currentRequest: null, previousRequest: null };
    
    const ps1 = extractPSNumber(request1.Name);
    const ps2 = extractPSNumber(request2.Name);
    
    return ps1 > ps2
      ? { currentRequest: request1, previousRequest: request2 }
      : { currentRequest: request2, previousRequest: request1 };
  }, [request1, request2]);

  // Aggregate consecutive date ranges
  const aggregateDateRanges = (products, getNonDateAttributes) => {
    if (!products || products.length === 0) return [];
    
    // Group by non-date attributes
    const groups = new Map();
    
    products.forEach(product => {
      const key = getNonDateAttributes(product);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(product);
    });
    
    // For each group, aggregate consecutive date ranges
    const aggregated = [];
    groups.forEach((items) => {
      // Sort by start date
      items.sort((a, b) => {
        const dateA = new Date(a.startDate || '1900-01-01');
        const dateB = new Date(b.startDate || '1900-01-01');
        return dateA - dateB;
      });
      
      // Aggregate consecutive ranges
      let currentGroup = [items[0]];
      
      for (let i = 1; i < items.length; i++) {
        const prev = currentGroup[currentGroup.length - 1];
        const curr = items[i];
        
        // Check if dates are consecutive
        const prevEndDate = new Date(prev.endDate || '2099-12-31');
        const currStartDate = new Date(curr.startDate || '1900-01-01');
        
        const nextDay = new Date(prevEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        if (nextDay.getTime() === currStartDate.getTime()) {
          // Update the end date
          currentGroup[0] = {
            ...currentGroup[0],
            endDate: curr.endDate,
            _aggregatedCount: (currentGroup[0]._aggregatedCount || 1) + 1
          };
        } else {
          aggregated.push(currentGroup[0]);
          currentGroup = [curr];
        }
      }
      
      if (currentGroup.length > 0) {
        aggregated.push(currentGroup[0]);
      }
    });
    
    return aggregated;
  };

  // Compare products
  const compareProducts = (prevProducts, currProducts, getIdentifier, compareAttributes) => {
    const result = {
      added: [],
      removed: [],
      updated: [],
      unchanged: []
    };
    
    const prevMap = new Map();
    const currMap = new Map();
    
    prevProducts.forEach(p => {
      const id = getIdentifier(p);
      if (id) prevMap.set(id, p);
    });
    
    currProducts.forEach(p => {
      const id = getIdentifier(p);
      if (id) currMap.set(id, p);
    });
    
    // Check previous products
    prevMap.forEach((prevProduct, id) => {
      if (currMap.has(id)) {
        const currProduct = currMap.get(id);
        const changes = compareAttributes(prevProduct, currProduct);
        
        if (changes.length > 0) {
          result.updated.push({ id, prev: prevProduct, curr: currProduct, changes });
        } else {
          result.unchanged.push({ id, product: prevProduct });
        }
      } else {
        result.removed.push({ id, product: prevProduct });
      }
    });
    
    // Check for added products
    currMap.forEach((currProduct, id) => {
      if (!prevMap.has(id)) {
        result.added.push({ id, product: currProduct });
      }
    });
    
    return result;
  };

  // Generate comparisons
  const { modelComparison, dataComparison, appComparison } = useMemo(() => {
    if (!currentRequest || !previousRequest) {
      return { modelComparison: null, dataComparison: null, appComparison: null };
    }

    const prevPayload = parsePayload(previousRequest);
    const currPayload = parsePayload(currentRequest);

    // Models
    const prevModels = aggregateDateRanges(
      prevPayload.modelEntitlements,
      (m) => `${m.productCode}|${m.productModifier || ''}`
    );
    const currModels = aggregateDateRanges(
      currPayload.modelEntitlements,
      (m) => `${m.productCode}|${m.productModifier || ''}`
    );
    
    const modelComp = compareProducts(
      prevModels,
      currModels,
      (m) => `${m.productCode}|${m.productModifier || ''}`,
      (prev, curr) => {
        const changes = [];
        ['startDate', 'endDate', 'productModifier'].forEach(field => {
          if (prev[field] !== curr[field]) {
            changes.push({ field, prev: prev[field], curr: curr[field] });
          }
        });
        return changes;
      }
    );

    // Data
    const prevData = aggregateDateRanges(
      prevPayload.dataEntitlements,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`
    );
    const currData = aggregateDateRanges(
      currPayload.dataEntitlements,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`
    );
    
    const dataComp = compareProducts(
      prevData,
      currData,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`,
      (prev, curr) => {
        const changes = [];
        ['startDate', 'endDate', 'productModifier'].forEach(field => {
          if (prev[field] !== curr[field]) {
            changes.push({ field, prev: prev[field], curr: curr[field] });
          }
        });
        return changes;
      }
    );

    // Apps
    const prevApps = aggregateDateRanges(
      prevPayload.appEntitlements,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`
    );
    const currApps = aggregateDateRanges(
      currPayload.appEntitlements,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`
    );
    
    const appComp = compareProducts(
      prevApps,
      currApps,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`,
      (prev, curr) => {
        const changes = [];
        ['packageName', 'quantity', 'startDate', 'endDate', 'productModifier'].forEach(field => {
          if (prev[field] !== curr[field]) {
            changes.push({ field, prev: prev[field], curr: curr[field] });
          }
        });
        return changes;
      }
    );

    return { modelComparison: modelComp, dataComparison: dataComp, appComparison: appComp };
  }, [currentRequest, previousRequest]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return <span className="text-gray-400 italic text-xs">—</span>;
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  // Render product comparison table
  const renderProductComparisonTable = (title, type, comparison, prevName, currName) => {
    if (!comparison) return null;

    const { added, removed, updated, unchanged } = comparison;
    const total = added.length + removed.length + updated.length + unchanged.length;

    if (total === 0) {
      return (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">{title}</h3>
          <p className="text-sm text-gray-500">No {title.toLowerCase()} found in either request.</p>
        </div>
      );
    }

    // Define columns based on product type
    let columns = [];
    if (type === 'models') {
      columns = [
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    } else if (type === 'data') {
      columns = [
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    } else if (type === 'apps') {
      columns = [
        { key: 'packageName', label: 'Package Name' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'productModifier', label: 'Product Modifier' }
      ];
    }

    // Build all products with their comparison data
    const allProducts = [];
    
    const extractProductCode = (compositeId) => compositeId.split('|')[0];

    // Added, Removed, Updated, Unchanged
    added.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        prev: null,
        curr: item.product,
        status: 'added',
        changes: []
      });
    });

    removed.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        prev: item.product,
        curr: null,
        status: 'removed',
        changes: []
      });
    });

    updated.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        prev: item.prev,
        curr: item.curr,
        status: 'updated',
        changes: item.changes.map(c => c.field)
      });
    });

    unchanged.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        prev: item.product,
        curr: item.product,
        status: 'unchanged',
        changes: []
      });
    });

    // Sort by product code
    allProducts.sort((a, b) => String(a.productCode).localeCompare(String(b.productCode)));

    // Determine if should be open (if there are changes)
    const hasChanges = added.length > 0 || removed.length > 0 || updated.length > 0;

    const getStatusConfig = (status) => {
      switch (status) {
        case 'added':
          return {
            bgColor: 'bg-green-50',
            icon: (
              <svg className="h-3 w-3 text-green-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="5" y2="19"></line>
                <line x1="5" x2="19" y1="12" y2="12"></line>
              </svg>
            ),
            text: <span className="text-green-700 text-xs font-medium">Added</span>
          };
        case 'removed':
          return {
            bgColor: 'bg-red-50',
            icon: (
              <svg className="h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" x2="19" y1="12" y2="12"></line>
              </svg>
            ),
            text: <span className="text-red-700 text-xs font-medium">Removed</span>
          };
        case 'updated':
          return {
            bgColor: 'bg-yellow-50',
            icon: (
              <svg className="h-3 w-3 text-yellow-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" x2="12" y1="3" y2="15"></line>
              </svg>
            ),
            text: <span className="text-yellow-700 text-xs font-medium">Updated</span>
          };
        default:
          return {
            bgColor: 'bg-blue-50',
            icon: (
              <svg className="h-3 w-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ),
            text: <span className="text-blue-700 text-xs font-medium">Unchanged</span>
          };
      }
    };

    return (
      <details open={hasChanges} className="border rounded-lg overflow-hidden group">
        <summary className="bg-gray-50 p-4 border-b cursor-pointer hover:bg-gray-100 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold inline-flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {title}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Total: {total} | <span className="text-green-700">Added: {added.length}</span> | 
                <span className="text-red-700"> Removed: {removed.length}</span> | 
                <span className="text-yellow-700"> Updated: {updated.length}</span> | 
                <span className="text-blue-700"> Unchanged: {unchanged.length}</span>
              </p>
            </div>
            {hasChanges ? (
              <span className="text-xs font-medium text-yellow-700">Has Changes</span>
            ) : (
              <span className="text-xs font-medium text-blue-700">No Changes</span>
            )}
          </div>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 border-b-2 border-gray-400">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-400" rowSpan="2">
                  Product Code
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-400" colSpan={columns.length}>
                  {prevName}
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-400" colSpan={columns.length}>
                  {currName}
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700" rowSpan="2">
                  Status
                </th>
              </tr>
              <tr>
                {/* Previous columns */}
                {columns.map(col => (
                  <th key={`prev-${col.key}`} className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 border-r border-gray-300">
                    {col.label}
                  </th>
                ))}
                {/* Current columns */}
                {columns.map((col, idx) => (
                  <th key={`curr-${col.key}`} className={`px-2 py-1.5 text-left text-xs font-medium text-gray-600 ${idx === columns.length - 1 ? 'border-r border-gray-400' : 'border-r border-gray-300'}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allProducts.map((product, idx) => {
                const changedFieldsSet = new Set(product.changes);
                const statusConfig = getStatusConfig(product.status);
                
                return (
                  <tr key={idx} className={`${statusConfig.bgColor} border-b border-gray-200`}>
                    <td className="px-2 py-2 font-medium border-r border-gray-400">
                      {formatValue(product.productCode)}
                    </td>
                    
                    {/* Previous version columns */}
                    {columns.map(col => {
                      const value = product.prev ? product.prev[col.key] : null;
                      const isChanged = changedFieldsSet.has(col.key);
                      return (
                        <td key={`prev-${col.key}`} className={`px-2 py-2 border-r border-gray-300 ${isChanged ? 'bg-yellow-100' : ''}`}>
                          {col.key.includes('Date') ? formatDate(value) : formatValue(value)}
                        </td>
                      );
                    })}
                    
                    {/* Current version columns */}
                    {columns.map((col, colIdx) => {
                      const value = product.curr ? product.curr[col.key] : null;
                      const isChanged = changedFieldsSet.has(col.key);
                      return (
                        <td key={`curr-${col.key}`} className={`px-2 py-2 ${colIdx === columns.length - 1 ? 'border-r border-gray-400' : 'border-r border-gray-300'} ${isChanged ? 'bg-yellow-100' : ''}`}>
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

  if (!isOpen || !currentRequest || !previousRequest) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Side-by-Side Product Comparison</h2>
            <p className="text-sm text-gray-600 mt-1">
              {previousRequest.Name} → {currentRequest.Name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6" style={{ overscrollBehavior: 'contain' }}>
          <div className="space-y-6">
            {renderProductComparisonTable('Model Entitlements', 'models', modelComparison, previousRequest.Name, currentRequest.Name)}
            {renderProductComparisonTable('Data Entitlements', 'data', dataComparison, previousRequest.Name, currentRequest.Name)}
            {renderProductComparisonTable('App Entitlements', 'apps', appComparison, previousRequest.Name, currentRequest.Name)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
              Added
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
              Removed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
              Updated
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
              Unchanged
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 h-10 px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;
