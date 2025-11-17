import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  FunnelIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { CubeIcon } from '@heroicons/react/24/solid';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getPackages, getPackageByIdentifier, exportPackagesToExcel } from '../services/packageService';
import { useToast } from '../context/ToastContext';

const PackagesCatalogueTab = () => {
  const { showToast } = useToast();
  const [packages, setPackages] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedPackageProducts, setSelectedPackageProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Load packages on component mount
  useEffect(() => {
    loadPackages();
  }, []);

  // Filter packages based on search term and type
  useEffect(() => {
    let filtered = [...packages];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (pkg) =>
          pkg.package_name?.toLowerCase().includes(term) ||
          pkg.ri_package_name?.toLowerCase().includes(term) ||
          pkg.package_type?.toLowerCase().includes(term) ||
          pkg.description?.toLowerCase().includes(term)
      );
    }

    // Apply type filter
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter((pkg) => pkg.package_type === typeFilter);
    }

    setFilteredPackages(filtered);
  }, [packages, searchTerm, typeFilter]);

  const loadPackages = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getPackages({
        includeDeleted: false
      });

      if (result.success) {
        setPackages(result.packages || []);
        setFilteredPackages(result.packages || []);
        setTotalCount(result.count || 0);
        setLastRefresh(new Date().toLocaleString());
      } else {
        setError(result.error || 'Failed to load packages');
      }
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setTypeFilter('all');
    loadPackages();
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      await exportPackagesToExcel();
      showToast({
        title: 'Success',
        message: 'Packages catalogue exported successfully!'
      });
    } catch (error) {
      console.error('Export error:', error);
      showToast({
        title: 'Export Failed',
        message: error.message || 'Failed to export packages catalogue'
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePackageClick = async (identifier) => {
    setLoading(true);
    try {
      const result = await getPackageByIdentifier(identifier);
      if (result.success) {
        setSelectedPackage(result.package);
        
        // related_products is now included directly in the package data
        // No need for separate API call
        setSelectedPackageProducts([]);
        
        setShowModal(true);
      } else {
        setError(result.error || 'Failed to load package details');
      }
    } catch (err) {
      console.error('Error loading package details:', err);
      setError('Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPackage(null);
    setSelectedPackageProducts([]);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const getPackageFieldsForDisplay = (pkg) => {
    if (!pkg) return [];

    const fields = [
      { key: 'sf_package_id', label: 'Salesforce ID' },
      { key: 'package_name', label: 'Package Name' },
      { key: 'ri_package_name', label: 'RI Package Name' },
      { key: 'package_type', label: 'Package Type' },
      { key: 'related_products', label: 'Related Products' },
      { key: 'locations', label: 'Locations', formatter: formatNumber },
      { key: 'max_concurrent_model', label: 'Max Concurrent Model', formatter: formatNumber },
      { key: 'max_concurrent_non_model', label: 'Max Concurrent Non-Model', formatter: formatNumber },
      { key: 'max_concurrent_accumulation_jobs', label: 'Max Concurrent Accumulation Jobs', formatter: formatNumber },
      { key: 'max_concurrent_non_accumulation_jobs', label: 'Max Concurrent Non-Accumulation Jobs', formatter: formatNumber },
      { key: 'max_jobs_day', label: 'Max Jobs per Day', formatter: formatNumber },
      { key: 'max_users', label: 'Max Users', formatter: formatNumber },
      { key: 'number_edms', label: 'Number of EDMs', formatter: formatNumber },
      { key: 'max_exposure_storage_tb', label: 'Max Exposure Storage (TB)' },
      { key: 'max_other_storage_tb', label: 'Max Other Storage (TB)' },
      { key: 'max_risks_accumulated_day', label: 'Max Risks Accumulated per Day', formatter: formatNumber },
      { key: 'max_risks_single_accumulation', label: 'Max Risks Single Accumulation', formatter: formatNumber },
      { key: 'api_rps', label: 'API Requests per Second', formatter: formatNumber },
      { key: 'description', label: 'Description' },
      { key: 'first_synced', label: 'First Synced' },
      { key: 'last_synced', label: 'Last Synced' }
    ];

    return fields
      .filter(({ key }) => pkg[key] !== undefined && pkg[key] !== null && pkg[key] !== '')
      .map(({ key, label, formatter }) => ({
        label,
        value: formatter ? formatter(pkg[key]) : pkg[key]
      }));
  };

  const formatFieldValue = (value) => {
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/))) {
      return new Date(value).toLocaleString();
    }
    return value || '-';
  };

  // Get unique package types for filter
  const packageTypes = ['all', ...new Set(packages.map(pkg => pkg.package_type).filter(Boolean))];

  return (
    <div>
      {/* Controls Section */}
      <section className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search packages by name, type, or description..."
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <div className="relative w-full sm:w-[240px]">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {packageTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Export to Excel Button */}
            <button
              onClick={handleExportToExcel}
              disabled={exporting || loading || filteredPackages.length === 0}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export all packages to Excel"
            >
              <ArrowDownTrayIcon className={`h-4 w-4 mr-2 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredPackages.length}</span> of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{totalCount}</span> packages
          </span>
          {(searchTerm || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {lastRefresh && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last refreshed: {lastRefresh}
          </div>
        )}
      </section>

      {/* Packages Grid */}
      <section>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading packages...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-red-500 mb-4">
              <InformationCircleIcon className="h-16 w-16" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 h-10 px-4 py-2"
            >
              Try Again
            </button>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="h-16 w-16 text-gray-400 mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No packages found</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => handlePackageClick(pkg.sf_package_id)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                      {pkg.package_name}
                    </h3>
                    {pkg.ri_package_name && (
                      <code className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                        {pkg.ri_package_name}
                      </code>
                    )}
                  </div>
                  <CubeIcon className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                </div>

                {pkg.package_type && (
                  <div className="mb-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      pkg.package_type === 'Base' 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300'
                    }`}>
                      {pkg.package_type}
                    </span>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  {pkg.locations && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Locations:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(pkg.locations)}
                      </span>
                    </div>
                  )}
                  {pkg.max_users && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Max Users:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatNumber(pkg.max_users)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end text-xs">
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Package Details Modal */}
      {showModal && selectedPackage && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeModal}></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedPackage.package_name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedPackage.ri_package_name && (
                      <code className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded">
                        {selectedPackage.ri_package_name}
                      </code>
                    )}
                    {selectedPackage.package_type && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                        selectedPackage.package_type === 'Base'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                          : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300'
                      }`}>
                        {selectedPackage.package_type}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="ml-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Related Products Section */}
                {selectedPackageProducts.length > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Related Products ({selectedPackageProducts.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPackageProducts.map((product) => (
                        <span
                          key={product.product_code}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-xs font-medium text-blue-800 dark:text-blue-200"
                          title={`Seen ${product.occurrence_count} time(s)`}
                        >
                          {product.product_code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Package Details */}
                <div className="space-y-4">
                  {getPackageFieldsForDisplay(selectedPackage).map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-3 gap-4">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100 col-span-2 break-words">
                        {formatFieldValue(value)}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeModal}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 h-10 px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackagesCatalogueTab;

