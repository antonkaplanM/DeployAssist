import React from 'react';

/**
 * Data Validation Widget
 * Displays validation errors from PS requests
 */
const ValidationWidget = ({ data, error, isLoading, timeFrame, onTimeFrameChange }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading validation data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg transition-colors">
        <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <div className="text-sm">
          <p className="font-medium">Failed to load validation data</p>
          <p className="text-gray-600 dark:text-gray-400">{error.message || 'Please try again later'}</p>
        </div>
      </div>
    );
  }

  // Debug: log the data
  console.log('[ValidationWidget] Received data:', data);

  if (!data) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No validation data available
      </div>
    );
  }

  const { summary, errors } = data;
  const validCount = summary?.validRecords || 0;
  const invalidCount = summary?.invalidRecords || 0;
  const totalCount = summary?.totalRecords || 0;
  
  console.log('[ValidationWidget] Counts:', { validCount, invalidCount, totalCount });

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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center transition-colors">
          <div className="text-3xl font-bold text-green-700 dark:text-green-400">{validCount}</div>
          <div className="text-sm text-green-600 dark:text-green-400 mt-1">Valid</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center transition-colors">
          <div className="text-3xl font-bold text-red-700 dark:text-red-400">{invalidCount}</div>
          <div className="text-sm text-red-600 dark:text-red-400 mt-1">Invalid</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center transition-colors">
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{totalCount}</div>
          <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">Total</div>
        </div>
      </div>

      {/* Status Message */}
      {invalidCount > 0 ? (
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg transition-colors">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">
            {invalidCount} validation {invalidCount === 1 ? 'error' : 'errors'} found
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg transition-colors">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">All requests are valid</span>
        </div>
      )}

      {/* Error Details */}
      {invalidCount > 0 && errors && errors.length > 0 && (
        <div className="space-y-3">
          {errors.map((error, index) => (
            <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-red-900">{error.recordName || error.recordId}</span>
                    {error.account && <span className="text-sm text-red-600">({error.account})</span>}
                  </div>
                  <div className="space-y-1">
                    {error.failedRules && error.failedRules.map((rule, ruleIndex) => (
                      <div key={ruleIndex} className="text-sm">
                        <span className="font-medium text-red-800">{rule.ruleName}:</span>
                        <span className="text-red-700 ml-1">{rule.message}</span>
                      </div>
                    ))}
                  </div>
                  {error.createdDate && (
                    <div className="text-xs text-red-600 mt-2">
                      Created: {new Date(error.createdDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    // Navigate to provisioning with the exact match filter
                    window.location.href = `/provisioning?exact=${encodeURIComponent(error.recordName || error.recordId)}`;
                  }}
                  className="text-red-600 hover:text-red-800 text-sm font-medium ml-4 flex-shrink-0"
                >
                  View Record
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ValidationWidget;

