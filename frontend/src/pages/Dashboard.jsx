import React, { useState, useEffect } from 'react';
import ValidationWidget from '../components/features/ValidationWidget';
import RemovalsWidget from '../components/features/RemovalsWidget';
import ExpirationWidget from '../components/features/ExpirationWidget';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getValidationErrors, getRemovalsData, getExpirationData } from '../services/dashboardService';
import {
  CheckCircleIcon,
  TrashIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  // Get initial timeframes: user's saved preference > default from Settings > fallback
  const getInitialValidationTimeframe = () => {
    const userPref = localStorage.getItem('dashboard_validationTimeframe');
    if (userPref) return userPref;
    
    const defaultSetting = localStorage.getItem('defaultDashboardValidationTimeframe');
    return defaultSetting || '1w';
  };

  const getInitialRemovalsTimeframe = () => {
    const userPref = localStorage.getItem('dashboard_removalsTimeframe');
    if (userPref) return userPref;
    
    const defaultSetting = localStorage.getItem('defaultDashboardRemovalsTimeframe');
    return defaultSetting || '1w';
  };

  const getInitialExpirationWindow = () => {
    const userPref = localStorage.getItem('dashboard_expirationWindow');
    if (userPref) return parseInt(userPref);
    
    const defaultSetting = localStorage.getItem('defaultDashboardExpirationWindow');
    return defaultSetting ? parseInt(defaultSetting) : 7;
  };

  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Validation state
  const [validationData, setValidationData] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [validationTimeFrame, setValidationTimeFrame] = useState(getInitialValidationTimeframe());

  // Removals state
  const [removalsData, setRemovalsData] = useState(null);
  const [removalsError, setRemovalsError] = useState(null);
  const [removalsLoading, setRemovalsLoading] = useState(true);
  const [removalsTimeFrame, setRemovalsTimeFrame] = useState(getInitialRemovalsTimeframe());

  // Expiration state
  const [expirationData, setExpirationData] = useState(null);
  const [expirationError, setExpirationError] = useState(null);
  const [expirationLoading, setExpirationLoading] = useState(true);
  const [expirationWindow, setExpirationWindow] = useState(getInitialExpirationWindow());

  // Fetch validation data
  useEffect(() => {
    const fetchValidation = async () => {
      setValidationLoading(true);
      setValidationError(null);
      try {
        const data = await getValidationErrors(validationTimeFrame);
        setValidationData(data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('[Dashboard] Validation error:', err);
        setValidationError(err.message);
      } finally {
        setValidationLoading(false);
      }
    };
    fetchValidation();
  }, [validationTimeFrame]);

  // Fetch removals data
  useEffect(() => {
    const fetchRemovals = async () => {
      setRemovalsLoading(true);
      setRemovalsError(null);
      try {
        const data = await getRemovalsData(removalsTimeFrame);
        setRemovalsData(data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('[Dashboard] Removals error:', err);
        setRemovalsError(err.message);
      } finally {
        setRemovalsLoading(false);
      }
    };
    fetchRemovals();
  }, [removalsTimeFrame]);

  // Fetch expiration data
  useEffect(() => {
    const fetchExpiration = async () => {
      setExpirationLoading(true);
      setExpirationError(null);
      try {
        const data = await getExpirationData(expirationWindow);
        setExpirationData(data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('[Dashboard] Expiration error:', err);
        setExpirationError(err.message);
      } finally {
        setExpirationLoading(false);
      }
    };
    fetchExpiration();
  }, [expirationWindow]);

  // Save user preferences when they change timeframes
  const handleValidationTimeFrameChange = (newTimeframe) => {
    setValidationTimeFrame(newTimeframe);
    localStorage.setItem('dashboard_validationTimeframe', newTimeframe);
    console.log(`[Dashboard] Validation widget preference saved: ${newTimeframe}`);
  };

  const handleRemovalsTimeFrameChange = (newTimeframe) => {
    setRemovalsTimeFrame(newTimeframe);
    localStorage.setItem('dashboard_removalsTimeframe', newTimeframe);
    console.log(`[Dashboard] Removals widget preference saved: ${newTimeframe}`);
  };

  const handleExpirationWindowChange = (newWindow) => {
    setExpirationWindow(newWindow);
    localStorage.setItem('dashboard_expirationWindow', newWindow.toString());
    console.log(`[Dashboard] Expiration widget preference saved: ${newWindow} days`);
  };

  return (
    <div id="page-dashboard" className="max-w-7xl mx-auto">
      {/* Centered Header */}
      <header className="text-center mb-12">
        <div className="mb-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400 font-medium">
          Welcome to your application dashboard
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <ClockIcon className="h-4 w-4" />
          <span>
            Last refreshed: <span className="font-medium">{lastRefreshed.toLocaleTimeString()}</span>
          </span>
        </div>
      </header>

      {/* Dashboard Widgets Grid */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          {/* Data Validation Monitor */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 flex flex-col transition-colors">
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="truncate">Data Validation</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Monitor validation errors</p>
                </div>
              </div>
              
              {validationLoading ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                  </div>
                </div>
              ) : validationError ? (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 transition-colors">
                  <span className="text-xs text-red-700 dark:text-red-400">{validationError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <ValidationWidget 
                    data={validationData}
                    error={validationError}
                    isLoading={false}
                    timeFrame={validationTimeFrame}
                    onTimeFrameChange={handleValidationTimeFrameChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* PS Request Removals Monitor */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 flex flex-col transition-colors">
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <TrashIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                    <span className="truncate">Product Removals</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Track PS request removals</p>
                </div>
              </div>
              
              {removalsLoading ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                  </div>
                </div>
              ) : removalsError ? (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 transition-colors">
                  <span className="text-xs text-red-700 dark:text-red-400">{removalsError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <RemovalsWidget 
                    data={removalsData}
                    error={removalsError}
                    isLoading={false}
                    timeFrame={removalsTimeFrame}
                    onTimeFrameChange={handleRemovalsTimeFrameChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Expiration Monitor Widget */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 flex flex-col transition-colors">
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <ClockIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <span className="truncate">Expiration Monitor</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Track expiring products</p>
                </div>
              </div>
              
              {expirationLoading ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                  </div>
                </div>
              ) : expirationError ? (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 transition-colors">
                  <span className="text-xs text-red-700 dark:text-red-400">{expirationError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3 transition-colors">
                  <ExpirationWidget 
                    data={expirationData}
                    error={expirationError}
                    isLoading={false}
                    expirationWindow={expirationWindow}
                    onWindowChange={handleExpirationWindowChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Status Card */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API Status</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Server is running and responding to requests</p>
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono transition-colors">
                GET /api/health
              </div>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 transition-colors">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Links</h3>
              <div className="space-y-2">
                <a href="/provisioning" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                  <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></span>
                  <span>Provisioning Monitor</span>
                </a>
                <a href="/provisioning/expiration" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                  <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full"></span>
                  <span>Expiration Monitor</span>
                </a>
                <a href="/customer-products" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                  <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></span>
                  <span>Customer Products</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; 2025 Deployment Assistant. Made for internal use only.
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
