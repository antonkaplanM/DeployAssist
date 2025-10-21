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
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Validation state
  const [validationData, setValidationData] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [validationTimeFrame, setValidationTimeFrame] = useState('1w');

  // Removals state
  const [removalsData, setRemovalsData] = useState(null);
  const [removalsError, setRemovalsError] = useState(null);
  const [removalsLoading, setRemovalsLoading] = useState(true);
  const [removalsTimeFrame, setRemovalsTimeFrame] = useState('1w');

  // Expiration state
  const [expirationData, setExpirationData] = useState(null);
  const [expirationError, setExpirationError] = useState(null);
  const [expirationLoading, setExpirationLoading] = useState(true);
  const [expirationWindow, setExpirationWindow] = useState(7);

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

  return (
    <div id="page-dashboard" className="max-w-7xl mx-auto">
      {/* Centered Header */}
      <header className="text-center mb-12">
        <div className="mb-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <p className="text-xl text-gray-600 font-medium">
          Welcome to your application dashboard
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
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
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <span className="truncate">Data Validation</span>
                  </h2>
                  <p className="text-xs text-gray-500">Monitor validation errors</p>
                </div>
              </div>
              
              {validationLoading ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500">Loading...</span>
                  </div>
                </div>
              ) : validationError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <span className="text-xs text-red-700">{validationError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3">
                  <ValidationWidget 
                    data={validationData}
                    error={validationError}
                    isLoading={false}
                    timeFrame={validationTimeFrame}
                    onTimeFrameChange={setValidationTimeFrame}
                  />
                </div>
              )}
            </div>
          </div>

          {/* PS Request Removals Monitor */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <TrashIcon className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <span className="truncate">Product Removals</span>
                  </h2>
                  <p className="text-xs text-gray-500">Track PS request removals</p>
                </div>
              </div>
              
              {removalsLoading ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500">Loading...</span>
                  </div>
                </div>
              ) : removalsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <span className="text-xs text-red-700">{removalsError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3">
                  <RemovalsWidget 
                    data={removalsData}
                    error={removalsError}
                    isLoading={false}
                    timeFrame={removalsTimeFrame}
                    onTimeFrameChange={setRemovalsTimeFrame}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Expiration Monitor Widget */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6 flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <span className="truncate">Expiration Monitor</span>
                  </h2>
                  <p className="text-xs text-gray-500">Track expiring products</p>
                </div>
              </div>
              
              {expirationLoading ? (
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-500">Loading...</span>
                  </div>
                </div>
              ) : expirationError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <span className="text-xs text-red-700">{expirationError}</span>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 p-3">
                  <ExpirationWidget 
                    data={expirationData}
                    error={expirationError}
                    isLoading={false}
                    expirationWindow={expirationWindow}
                    onWindowChange={setExpirationWindow}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Status Card */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-semibold text-gray-900">API Status</h3>
              </div>
              <p className="text-gray-600">Server is running and responding to requests</p>
              <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded font-mono">
                GET /api/health
              </div>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Quick Links</h3>
              <div className="space-y-2">
                <a href="/provisioning" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Provisioning Monitor</span>
                </a>
                <a href="/provisioning/expiration" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Expiration Monitor</span>
                </a>
                <a href="/customer-products" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Customer Products</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center mt-12 pt-8 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          &copy; 2025 Deployment Assistant. Made for internal use only.
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
