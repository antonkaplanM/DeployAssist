import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Expiration Monitor Widget
 * Displays products expiring soon
 */
const ExpirationWidget = ({ data, error, isLoading, expirationWindow, onWindowChange }) => {
  const [showAtRisk, setShowAtRisk] = useState(false);
  const navigate = useNavigate();
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-500">Loading expiration data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-red-700 bg-red-50 p-4 rounded-lg">
        <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <div className="text-sm">
          <p className="font-medium">Failed to load expiration data</p>
          <p className="text-gray-600">{error.message || 'Please try again later'}</p>
        </div>
      </div>
    );
  }

  // Debug: log the data
  console.log('[ExpirationWidget] Received data:', data);
  
  if (!data) {
    return (
      <div className="text-sm text-gray-500">
        No expiration data available
      </div>
    );
  }

  const { summary, lastAnalyzed } = data;
  console.log('[ExpirationWidget] Summary:', summary, 'Last analyzed:', lastAnalyzed);

  // Check if analysis has been run
  if (!lastAnalyzed) {
    return (
      <div className="flex items-center gap-3 text-yellow-700 bg-yellow-50 p-4 rounded-lg">
        <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="text-sm">
          <p className="font-medium">No Analysis Data Available</p>
          <p className="text-gray-600">
            Please run the analysis in the Expiration Monitor to view expiration data.
          </p>
        </div>
      </div>
    );
  }

  const atRiskCount = summary?.atRisk || 0;
  const upcomingCount = summary?.upcoming || 0;
  const currentCount = summary?.current || 0;
  const accountsAffected = summary?.accountsAffected || 0;
  const totalExpiring = atRiskCount + upcomingCount + currentCount;

  // Get at-risk expirations for display - flatten the grouped structure
  const atRiskExpirations = useMemo(() => {
    const grouped = (data.expirations || []).filter(e => e.status === 'at-risk');
    
    // Flatten the grouped structure to show individual products
    const flattened = [];
    grouped.forEach(group => {
      const { account, psRecord, expiringProducts, earliestExpiry, earliestDaysUntilExpiry } = group;
      
      // Add all models
      expiringProducts.models?.forEach(product => {
        flattened.push({
          accountName: account.name,
          psRecordName: psRecord.name,
          productCode: product.productCode,
          productName: product.productName,
          productType: 'Model',
          endDate: product.endDate,
          daysUntilExpiry: product.daysUntilExpiry
        });
      });
      
      // Add all data
      expiringProducts.data?.forEach(product => {
        flattened.push({
          accountName: account.name,
          psRecordName: psRecord.name,
          productCode: product.productCode,
          productName: product.productName,
          productType: 'Data',
          endDate: product.endDate,
          daysUntilExpiry: product.daysUntilExpiry
        });
      });
      
      // Add all apps
      expiringProducts.apps?.forEach(product => {
        flattened.push({
          accountName: account.name,
          psRecordName: psRecord.name,
          productCode: product.productCode,
          productName: product.productName,
          productType: 'App',
          endDate: product.endDate,
          daysUntilExpiry: product.daysUntilExpiry
        });
      });
    });
    
    return flattened;
  }, [data.expirations]);

  // Determine status
  let statusColor = 'green';
  let statusText = 'No products expiring';
  let statusIcon = (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );

  if (atRiskCount > 0) {
    statusColor = 'red';
    statusText = `${atRiskCount} product${atRiskCount === 1 ? '' : 's'} expiring soon`;
    statusIcon = (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  } else if (upcomingCount > 0) {
    statusColor = 'yellow';
    statusText = `${upcomingCount} product${upcomingCount === 1 ? '' : 's'} expiring upcoming`;
    statusIcon = (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="space-y-4">
      {/* Expiration Window Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Window:</label>
        <select
          value={expirationWindow}
          onChange={(e) => onWindowChange(parseInt(e.target.value))}
          className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{atRiskCount}</div>
          <div className="text-sm text-red-600 mt-1">At Risk</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{upcomingCount}</div>
          <div className="text-sm text-yellow-600 mt-1">Upcoming</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-700">{accountsAffected}</div>
          <div className="text-sm text-blue-600 mt-1">Accounts</div>
        </div>
      </div>

      {/* Status Message */}
      <div className={`flex items-center gap-2 text-${statusColor}-700 bg-${statusColor}-50 p-3 rounded-lg`}>
        {statusIcon}
        <div className="flex-1">
          <p className="text-sm font-medium">{statusText}</p>
          <p className="text-xs text-gray-600">
            {totalExpiring} product{totalExpiring !== 1 ? 's' : ''} expiring in next {expirationWindow} days
            {accountsAffected > 0 && ` across ${accountsAffected} account${accountsAffected !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Expandable At-Risk Records */}
      {atRiskCount > 0 && atRiskExpirations.length > 0 && (
        <div className="border-t pt-3">
          <button
            onClick={() => setShowAtRisk(!showAtRisk)}
            className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showAtRisk ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>
              {showAtRisk ? 'Hide' : 'Show'} {atRiskCount} at-risk record{atRiskCount !== 1 ? 's' : ''}
            </span>
          </button>

          {showAtRisk && (
            <div className="mt-3 space-y-2">
              {atRiskExpirations.map((exp, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{exp.accountName}</div>
                      <div className="text-sm text-red-700 mt-1">
                        <span className="font-medium">{exp.productType}:</span> {exp.productCode} - {exp.productName}
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        Expires: {new Date(exp.endDate).toLocaleDateString()}
                        {exp.daysUntilExpiry !== undefined && ` (${exp.daysUntilExpiry} days)`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Full Details Button */}
      {totalExpiring > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-gray-500">
            Last analyzed: {formatTimestamp(lastAnalyzed)}
          </div>
          <button
            onClick={() => navigate('/provisioning/expiration')}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 transition-colors"
          >
            View Full Details
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExpirationWidget;

