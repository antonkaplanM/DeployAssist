import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const SMLComparisonModal = ({ isOpen, onClose, salesforceData, smlData, tenantName }) => {
  // Parse Salesforce payload data
  const parseSalesforcePayload = (request) => {
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
      console.error('Error parsing Salesforce payload:', err);
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
  };

  // Parse SML data
  const parseSMLData = (data) => {
    if (!data?.extensionData) {
      return { modelEntitlements: [], dataEntitlements: [], appEntitlements: [] };
    }
    
    return {
      modelEntitlements: data.extensionData.modelEntitlements || [],
      dataEntitlements: data.extensionData.dataEntitlements || [],
      appEntitlements: data.extensionData.appEntitlements || []
    };
  };

  // Aggregate consecutive date ranges
  const aggregateDateRanges = (products, getIdentifierKey) => {
    if (!products || products.length === 0) return [];
    
    // Group by identifier (excluding dates)
    const groups = new Map();
    
    products.forEach(product => {
      const key = getIdentifierKey(product);
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

  // Normalize values for comparison
  const normalizeValue = (value, isDate = false) => {
    // Handle null, undefined, empty string
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    // Handle dates - normalize to YYYY-MM-DD format
    if (isDate) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
        }
      } catch {
        return null;
      }
    }
    
    // Handle numbers - convert to number if it's a numeric string
    if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
      return Number(value);
    }
    
    // Handle strings - trim and lowercase for comparison
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    
    return value;
  };
  
  // Compare products between Salesforce and SML
  const compareProducts = (sfProducts, smlProducts, getIdentifier, compareAttributes) => {
    const result = {
      added: [],
      removed: [],
      updated: [],
      unchanged: []
    };
    
    const sfMap = new Map();
    const smlMap = new Map();
    
    sfProducts.forEach(p => {
      const id = getIdentifier(p);
      if (id) sfMap.set(id, p);
    });
    
    smlProducts.forEach(p => {
      const id = getIdentifier(p);
      if (id) smlMap.set(id, p);
    });
    
    // Check Salesforce products
    sfMap.forEach((sfProduct, id) => {
      if (smlMap.has(id)) {
        const smlProduct = smlMap.get(id);
        const changes = compareAttributes(sfProduct, smlProduct);
        
        if (changes.length > 0) {
          result.updated.push({ id, sf: sfProduct, sml: smlProduct, changes });
        } else {
          result.unchanged.push({ id, product: sfProduct });
        }
      } else {
        result.removed.push({ id, product: sfProduct });
      }
    });
    
    // Check for added products (in SML but not in Salesforce)
    smlMap.forEach((smlProduct, id) => {
      if (!sfMap.has(id)) {
        result.added.push({ id, product: smlProduct });
      }
    });
    
    return result;
  };

  // Generate comparisons
  const { modelComparison, dataComparison, appComparison } = useMemo(() => {
    if (!salesforceData || !smlData) {
      return { modelComparison: null, dataComparison: null, appComparison: null };
    }

    const sfPayload = parseSalesforcePayload(salesforceData);
    const smlPayload = parseSMLData(smlData);
    
    console.log('📊 SML Comparison Data:', {
      sf: {
        models: sfPayload.modelEntitlements?.length || 0,
        data: sfPayload.dataEntitlements?.length || 0,
        apps: sfPayload.appEntitlements?.length || 0
      },
      sml: {
        models: smlPayload.modelEntitlements?.length || 0,
        data: smlPayload.dataEntitlements?.length || 0,
        apps: smlPayload.appEntitlements?.length || 0
      }
    });

    // Models
    const sfModels = aggregateDateRanges(
      sfPayload.modelEntitlements,
      (m) => `${m.productCode}|${m.productModifier || ''}`
    );
    const smlModels = aggregateDateRanges(
      smlPayload.modelEntitlements,
      (m) => `${m.productCode}|${m.productModifier || ''}`
    );
    
    const modelComp = compareProducts(
      sfModels,
      smlModels,
      (m) => `${m.productCode}|${m.productModifier || ''}`,
      (sf, sml) => {
        const changes = [];
        const dateFields = ['startDate', 'endDate'];
        const otherFields = ['productModifier'];
        
        dateFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], true);
          const smlNorm = normalizeValue(sml[field], true);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        otherFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], false);
          const smlNorm = normalizeValue(sml[field], false);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        return changes;
      }
    );

    // Data
    const sfData = aggregateDateRanges(
      sfPayload.dataEntitlements,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`
    );
    const smlDataEnts = aggregateDateRanges(
      smlPayload.dataEntitlements,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`
    );
    
    const dataComp = compareProducts(
      sfData,
      smlDataEnts,
      (d) => `${d.productCode || d.name}|${d.productModifier || ''}`,
      (sf, sml) => {
        const changes = [];
        const dateFields = ['startDate', 'endDate'];
        const otherFields = ['productModifier'];
        
        dateFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], true);
          const smlNorm = normalizeValue(sml[field], true);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        otherFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], false);
          const smlNorm = normalizeValue(sml[field], false);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        return changes;
      }
    );

    // Apps
    const sfApps = aggregateDateRanges(
      sfPayload.appEntitlements,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`
    );
    const smlApps = aggregateDateRanges(
      smlPayload.appEntitlements,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`
    );
    
    const appComp = compareProducts(
      sfApps,
      smlApps,
      (a) => `${a.productCode || a.name}|${a.packageName || ''}|${a.quantity || ''}|${a.productModifier || ''}`,
      (sf, sml) => {
        const changes = [];
        const dateFields = ['startDate', 'endDate'];
        const otherFields = ['packageName', 'quantity', 'productModifier'];
        
        dateFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], true);
          const smlNorm = normalizeValue(sml[field], true);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        otherFields.forEach(field => {
          const sfNorm = normalizeValue(sf[field], false);
          const smlNorm = normalizeValue(sml[field], false);
          if (sfNorm !== smlNorm) {
            changes.push({ field, sf: sf[field], sml: sml[field] });
          }
        });
        
        return changes;
      }
    );

    return { modelComparison: modelComp, dataComparison: dataComp, appComparison: appComp };
  }, [salesforceData, smlData]);

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
  const renderProductComparisonTable = (title, type, comparison) => {
    if (!comparison) return null;

    const { added, removed, updated, unchanged } = comparison;
    const total = added.length + removed.length + updated.length + unchanged.length;

    if (total === 0) {
      return (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">{title}</h3>
          <p className="text-sm text-gray-500">No {title.toLowerCase()} found in either source.</p>
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
        sf: null,
        sml: item.product,
        status: 'added',
        changes: []
      });
    });

    removed.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        sf: item.product,
        sml: null,
        status: 'removed',
        changes: []
      });
    });

    updated.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        sf: item.sf,
        sml: item.sml,
        status: 'updated',
        changes: item.changes.map(c => c.field)
      });
    });

    unchanged.forEach(item => {
      allProducts.push({
        productCode: extractProductCode(item.id),
        sf: item.product,
        sml: item.product,
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
            text: <span className="text-green-700 text-xs font-medium">In SML Only</span>
          };
        case 'removed':
          return {
            bgColor: 'bg-red-50',
            icon: (
              <svg className="h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" x2="19" y1="12" y2="12"></line>
              </svg>
            ),
            text: <span className="text-red-700 text-xs font-medium">In SF Only</span>
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
            text: <span className="text-yellow-700 text-xs font-medium">Different</span>
          };
        default:
          return {
            bgColor: 'bg-blue-50',
            icon: (
              <svg className="h-3 w-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ),
            text: <span className="text-blue-700 text-xs font-medium">Match</span>
          };
      }
    };

    return (
      <details open={hasChanges} className="border rounded-lg overflow-hidden group">
        <summary className="bg-gray-50 dark:bg-gray-900 p-4 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold inline-flex items-center gap-2">
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Total: {total} | <span className="text-green-700">In SML Only: {added.length}</span> | 
                <span className="text-red-700"> In SF Only: {removed.length}</span> | 
                <span className="text-yellow-700"> Different: {updated.length}</span> | 
                <span className="text-blue-700"> Match: {unchanged.length}</span>
              </p>
            </div>
            {hasChanges ? (
              <span className="text-xs font-medium text-yellow-700">Has Differences</span>
            ) : (
              <span className="text-xs font-medium text-blue-700">Perfect Match</span>
            )}
          </div>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-400">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-400" rowSpan="2">
                  Product Code
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-400" colSpan={columns.length}>
                  SML (Current)
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-400" colSpan={columns.length}>
                  Salesforce (Request)
                </th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-300" rowSpan="2">
                  Status
                </th>
              </tr>
              <tr>
                {/* SML columns */}
                {columns.map(col => (
                  <th key={`sml-${col.key}`} className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 dark:text-gray-400 border-r border-gray-300">
                    {col.label}
                  </th>
                ))}
                {/* Salesforce columns */}
                {columns.map((col, idx) => (
                  <th key={`sf-${col.key}`} className={`px-2 py-1.5 text-left text-xs font-medium text-gray-600 dark:text-gray-400 ${idx === columns.length - 1 ? 'border-r border-gray-400' : 'border-r border-gray-300'}`}>
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
                  <tr key={idx} className={`${statusConfig.bgColor} border-b border-gray-200 dark:border-gray-700`}>
                    <td className="px-2 py-2 font-medium border-r border-gray-400">
                      {formatValue(product.productCode)}
                    </td>
                    
                    {/* SML columns */}
                    {columns.map(col => {
                      const value = product.sml ? product.sml[col.key] : null;
                      const isChanged = changedFieldsSet.has(col.key);
                      return (
                        <td key={`sml-${col.key}`} className={`px-2 py-2 border-r border-gray-300 ${isChanged ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
                          {col.key.includes('Date') ? formatDate(value) : formatValue(value)}
                        </td>
                      );
                    })}
                    
                    {/* Salesforce columns */}
                    {columns.map((col, colIdx) => {
                      const value = product.sf ? product.sf[col.key] : null;
                      const isChanged = changedFieldsSet.has(col.key);
                      return (
                        <td key={`sf-${col.key}`} className={`px-2 py-2 ${colIdx === columns.length - 1 ? 'border-r border-gray-400' : 'border-r border-gray-300'} ${isChanged ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
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

  if (!isOpen || !salesforceData || !smlData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              SML vs Salesforce Comparison
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Tenant: <span className="font-medium">{tenantName || 'Unknown'}</span> | 
              PS Record: <span className="font-medium">{salesforceData.Name}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">
              Comparing current live SML state with requested Salesforce changes
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6" style={{ overscrollBehavior: 'contain' }}>
          <div className="space-y-6">
            {renderProductComparisonTable('Model Entitlements', 'models', modelComparison)}
            {renderProductComparisonTable('Data Entitlements', 'data', dataComparison)}
            {renderProductComparisonTable('App Entitlements', 'apps', appComparison)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 p-6 border-t bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
              In SML Only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
              In Salesforce Only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span>
              Different
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
              Match
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-10 px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SMLComparisonModal;

