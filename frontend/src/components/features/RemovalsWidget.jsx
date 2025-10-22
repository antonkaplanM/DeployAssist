import React, { useState, useMemo } from 'react';

/**
 * Product Removals Widget
 * Displays PS requests with product removals
 */
const RemovalsWidget = ({ data, error, isLoading, timeFrame, onTimeFrameChange }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-500">Loading removals data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-red-700 dark:text-red-400 dark:text-red-400 bg-red-50 dark:bg-red-900/20 dark:bg-red-900/20 p-4 rounded-lg">
        <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <div className="text-sm">
          <p className="font-medium">Failed to load removals data</p>
          <p className="text-gray-600">{error.message || 'Please try again later'}</p>
        </div>
      </div>
    );
  }

  // Debug: log the data
  console.log('[RemovalsWidget] Received data:', data);
  
  if (!data) {
    return (
      <div className="text-sm text-gray-500">
        No removals data available
      </div>
    );
  }

  const requests = data.requests || [];
  const requestCount = requests.length;
  
  // Aggregate removals by category across all requests
  const aggregatedRemovals = useMemo(() => {
    const aggregated = {
      models: [],
      data: [],
      apps: []
    };
    
    const removalSources = new Map(); // productKey -> [{ currentRequest, previousRequest }]
    
    requests.forEach(item => {
      const { currentRequest, previousRequest, removals } = item;
      
      // Aggregate models
      (removals?.removedModels || []).forEach(model => {
        const key = model.productCode;
        if (!removalSources.has(key)) {
          aggregated.models.push({
            ...model,
            productCode: model.productCode,
            productName: model.name || model.productCode
          });
          removalSources.set(key, []);
        }
        removalSources.get(key).push({ currentRequest, previousRequest });
      });
      
      // Aggregate data
      (removals?.removedData || []).forEach(dataItem => {
        const key = dataItem.productCode;
        if (!removalSources.has(key)) {
          aggregated.data.push({
            ...dataItem,
            productCode: dataItem.productCode,
            productName: dataItem.name || dataItem.productCode
          });
          removalSources.set(key, []);
        }
        removalSources.get(key).push({ currentRequest, previousRequest });
      });
      
      // Aggregate apps
      (removals?.removedApps || []).forEach(app => {
        const key = app.productCode;
        if (!removalSources.has(key)) {
          aggregated.apps.push({
            ...app,
            productCode: app.productCode,
            productName: app.name || app.productCode
          });
          removalSources.set(key, []);
        }
        removalSources.get(key).push({ currentRequest, previousRequest });
      });
    });
    
    return { aggregated, removalSources };
  }, [requests]);
  
  const totalModels = aggregatedRemovals.aggregated.models.length;
  const totalData = aggregatedRemovals.aggregated.data.length;
  const totalApps = aggregatedRemovals.aggregated.apps.length;
  const totalProducts = totalModels + totalData + totalApps;
  
  console.log('[RemovalsWidget] Counts:', { requestCount, totalProducts, totalModels, totalData, totalApps });

  return (
    <div className="space-y-4">
      {/* Time Frame Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Frame:</label>
        <select
          value={timeFrame}
          onChange={(e) => onTimeFrameChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
        >
          <option value="1d">Last 24 hours</option>
          <option value="3d">Last 3 days</option>
          <option value="1w">Last week</option>
          <option value="1m">Last month</option>
        </select>
      </div>

      {/* Status Message */}
      {totalProducts === 0 ? (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 dark:text-green-400 bg-green-50 dark:bg-green-900/20 dark:bg-green-900/20 p-3 rounded-lg">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">No product removals found</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-orange-700">
          <svg className="h-6 w-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">{totalProducts} unique product{totalProducts !== 1 ? 's' : ''} removed across {requestCount} PS request{requestCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Category Cards */}
      {totalProducts > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Models Card */}
          <button
            onClick={() => totalModels > 0 && setSelectedCategory({ type: 'models', products: aggregatedRemovals.aggregated.models, sources: aggregatedRemovals.removalSources })}
            disabled={totalModels === 0}
            className={`rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 hover:shadow-lg transition-all hover:border-blue-300 text-left ${totalModels === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="rounded-lg bg-blue-100 p-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-blue-700">Models</p>
              <p className="text-3xl font-bold text-blue-900">{totalModels}</p>
              <p className="text-xs text-blue-600">{totalModels === 0 ? 'No removals' : 'Click to view details'}</p>
            </div>
          </button>

          {/* Data Card */}
          <button
            onClick={() => totalData > 0 && setSelectedCategory({ type: 'data', products: aggregatedRemovals.aggregated.data, sources: aggregatedRemovals.removalSources })}
            disabled={totalData === 0}
            className={`rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 p-4 hover:shadow-lg transition-all hover:border-green-300 text-left ${totalData === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="rounded-lg bg-green-100 p-2">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-green-700">Data</p>
              <p className="text-3xl font-bold text-green-900">{totalData}</p>
              <p className="text-xs text-green-600">{totalData === 0 ? 'No removals' : 'Click to view details'}</p>
            </div>
          </button>

          {/* Apps Card */}
          <button
            onClick={() => totalApps > 0 && setSelectedCategory({ type: 'apps', products: aggregatedRemovals.aggregated.apps, sources: aggregatedRemovals.removalSources })}
            disabled={totalApps === 0}
            className={`rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 hover:shadow-lg transition-all hover:border-purple-300 text-left ${totalApps === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="rounded-lg bg-purple-100 p-2">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zM14 17a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-purple-700">Apps</p>
              <p className="text-3xl font-bold text-purple-900">{totalApps}</p>
              <p className="text-xs text-purple-600">{totalApps === 0 ? 'No removals' : 'Click to view details'}</p>
            </div>
          </button>
        </div>
      )}

      {/* Modal */}
      {selectedCategory && (
        <RemovalCategoryModal
          category={selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
};

// Modal Component
const RemovalCategoryModal = ({ category, onClose }) => {
  const categoryConfig = {
    models: { title: 'Model Removals', colorClass: 'blue' },
    data: { title: 'Data Removals', colorClass: 'green' },
    apps: { title: 'App Removals', colorClass: 'purple' }
  };

  const config = categoryConfig[category.type];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">{config.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:text-gray-400 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                    Product Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                    Removed From
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 dark:bg-gray-800 divide-y divide-gray-200">
                {category.products.map((product, index) => {
                  const sources = category.sources.get(product.productCode) || [];
                  return (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.productCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {product.productName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {sources.map((source, idx) => (
                          <div key={idx} className="mb-1">
                            <a
                              href={`/provisioning?exact=${encodeURIComponent(source.currentRequest?.name || '')}`}
                              className="text-blue-600 dark:text-blue-400 dark:text-blue-400 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                window.location.href = `/provisioning?exact=${encodeURIComponent(source.currentRequest?.name || '')}`;
                              }}
                            >
                              {source.currentRequest?.name || 'Unknown'}
                            </a>
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 dark:bg-gray-900 dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemovalsWidget;

