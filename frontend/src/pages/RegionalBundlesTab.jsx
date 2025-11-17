import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  FunnelIcon,
  InformationCircleIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { CubeIcon } from '@heroicons/react/24/solid';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getRegionalBundles, getProductById } from '../services/productCatalogueService';
import { useToast } from '../context/ToastContext';

const RegionalBundlesTab = () => {
  const { showToast } = useToast();
  const [bundles, setBundles] = useState([]);
  const [filteredBundles, setFilteredBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [productGroupFilter, setProductGroupFilter] = useState('all');
  const [productSelectionGroupingFilter, setProductSelectionGroupingFilter] = useState('all');
  const [families, setFamilies] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [productSelectionGroupings, setProductSelectionGroupings] = useState([]);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Load bundles on component mount
  useEffect(() => {
    loadBundles();
  }, []);

  // Filter bundles based on search term, family, product group, and product selection grouping
  useEffect(() => {
    let filtered = [...bundles];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bundle) =>
          bundle.Name?.toLowerCase().includes(term) ||
          bundle.ProductCode?.toLowerCase().includes(term) ||
          bundle.Description?.toLowerCase().includes(term) ||
          bundle.Family?.toLowerCase().includes(term)
      );
    }

    // Apply family filter
    if (familyFilter && familyFilter !== 'all') {
      filtered = filtered.filter((bundle) => bundle.Family === familyFilter);
    }

    // Apply product group filter
    if (productGroupFilter && productGroupFilter !== 'all') {
      filtered = filtered.filter((bundle) => bundle.Product_Group__c === productGroupFilter);
    }

    // Apply product selection grouping filter
    if (productSelectionGroupingFilter && productSelectionGroupingFilter !== 'all') {
      filtered = filtered.filter((bundle) => bundle.Product_Selection_Grouping__c === productSelectionGroupingFilter);
    }

    setFilteredBundles(filtered);
  }, [bundles, searchTerm, familyFilter, productGroupFilter, productSelectionGroupingFilter]);

  const loadBundles = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getRegionalBundles({
        isActive: true,
        limit: 2000  // Load all regional bundles
      });

      if (result.success) {
        setBundles(result.bundles || []);
        setFilteredBundles(result.bundles || []);
        setTotalSize(result.totalSize || 0);
        setFamilies(result.filterOptions?.families || []);
        setProductGroups(result.filterOptions?.productGroups || []);
        setProductSelectionGroupings(result.filterOptions?.productSelectionGroupings || []);
        setLastRefresh(new Date().toLocaleString());
      } else {
        setError(result.error || 'Failed to load regional bundles');
      }
    } catch (err) {
      console.error('Error loading regional bundles:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setFamilyFilter('all');
    setProductGroupFilter('all');
    setProductSelectionGroupingFilter('all');
    loadBundles();
  };

  const handleBundleClick = async (bundleId) => {
    setLoading(true);
    try {
      const result = await getProductById(bundleId);
      if (result.success) {
        setSelectedBundle(result.product);
        setShowModal(true);
      } else {
        setError(result.error || 'Failed to load bundle details');
      }
    } catch (err) {
      console.error('Error loading bundle details:', err);
      setError('Failed to load bundle details');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBundle(null);
  };

  const formatFieldLabel = (fieldName) => {
    // Convert field names like "Product_Group__c" to "Product Group"
    return fieldName
      .replace(/__c$/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getBundleFieldsForDisplay = (bundle) => {
    if (!bundle) return [];

    const fieldsToShow = [
      { key: 'Name', label: 'Product Name' },
      { key: 'ProductCode', label: 'Product Code' },
      { key: 'Id', label: 'Salesforce ID' },
      { key: 'Description', label: 'Description' },
      { key: 'Family', label: 'Product Family' },
      { key: 'Product_Group__c', label: 'Product Group' },
      { key: 'Product_Selection_Grouping__c', label: 'Product Selection Grouping' },
      { key: 'RelatedPackages', label: 'Related Packages' },
      { key: 'Country__c', label: 'Country' },
      { key: 'Continent__c', label: 'Continent' },
      { key: 'RI_Platform_Region__c', label: 'RI Region' },
      { key: 'RI_Platform_Sub_Region__c', label: 'RI Subregions (Bundle)' },
      { key: 'Constituents', label: 'Constituents (Product Codes)' },
      { key: 'Model_Type__c', label: 'Model Type' },
      { key: 'Model_Subtype__c', label: 'Model Subtype' },
      { key: 'IRP_Bundle_Region__c', label: 'Bundle Region' },
      { key: 'IRP_Bundle_Subregion__c', label: 'Bundle Subregion' },
      { key: 'Data_API_Name__c', label: 'Data API Name' },
      { key: 'Peril__c', label: 'Peril' },
      { key: 'Data_Type__c', label: 'Data Type' }
    ];

    return fieldsToShow
      .filter(({ key }) => bundle[key] !== undefined && bundle[key] !== null)
      .map(({ key, label }) => ({
        label,
        value: bundle[key],
        isImportant: key === 'RI_Platform_Sub_Region__c' || key === 'Constituents'
      }));
  };

  const formatFieldValue = (value, isImportant = false) => {
    if (typeof value === 'boolean') {
      return value ? '✓ Yes' : '✗ No';
    }
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/))) {
      return new Date(value).toLocaleString();
    }
    if (typeof value === 'string' && value.startsWith('http')) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {value}
        </a>
      );
    }
    
    // Highlight important fields (RI Subregions and Constituents)
    if (isImportant && value) {
      return <span className="font-semibold text-green-700 dark:text-green-300">{value}</span>;
    }
    
    return value || '-';
  };

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
                placeholder="Search regional bundles by name, code, or description..."
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Family Filter */}
            <div className="relative w-full sm:w-[240px]">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Families</option>
                {families.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Group Filter */}
            <div className="relative w-full sm:w-[240px]">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={productGroupFilter}
                onChange={(e) => setProductGroupFilter(e.target.value)}
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Product Groups</option>
                {productGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Selection Grouping Filter */}
            <div className="relative w-full sm:w-[240px]">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={productSelectionGroupingFilter}
                onChange={(e) => setProductSelectionGroupingFilter(e.target.value)}
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Selection Groupings</option>
                {productSelectionGroupings.map((grouping) => (
                  <option key={grouping} value={grouping}>
                    {grouping}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
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
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredBundles.length}</span> of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{totalSize}</span> regional bundles
          </span>
          {(searchTerm || familyFilter !== 'all' || productGroupFilter !== 'all' || productSelectionGroupingFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFamilyFilter('all');
                setProductGroupFilter('all');
                setProductSelectionGroupingFilter('all');
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

        {/* Info Banner */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Regional Bundles</p>
              <p>These are products with multiple RI Subregion values (separated by semicolons). Each bundle includes a "Constituents" property listing the product codes of base products that make up the bundle.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bundles Grid */}
      <section>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading regional bundles...</p>
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
        ) : filteredBundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GlobeAltIcon className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No regional bundles found</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBundles.map((bundle) => (
              <div
                key={bundle.Id}
                onClick={() => handleBundleClick(bundle.Id)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                      {bundle.Name}
                    </h3>
                    <code className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                      {bundle.ProductCode}
                    </code>
                  </div>
                  <GlobeAltIcon className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                </div>

                {bundle.Family && (
                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-300">
                      {bundle.Family}
                    </span>
                  </div>
                )}

                {/* Show RI Subregions */}
                {bundle.RI_Platform_Sub_Region__c && (
                  <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1">RI Subregions:</p>
                    <p className="text-xs text-green-700 dark:text-green-200">{bundle.RI_Platform_Sub_Region__c}</p>
                  </div>
                )}

                {/* Show Constituents count */}
                {bundle.Constituents && (
                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-300">
                      {bundle.Constituents.split(',').length} Constituents
                    </span>
                  </div>
                )}

                {bundle.Description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{bundle.Description}</p>
                )}

                <div className="mt-4 flex items-center justify-between text-xs">
                  {bundle.IsActive !== undefined && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 font-medium ${
                        bundle.IsActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {bundle.IsActive ? '✓ Active' : 'Inactive'}
                    </span>
                  )}
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bundle Details Modal */}
      {showModal && selectedBundle && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeModal}></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <GlobeAltIcon className="h-6 w-6 text-green-500" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedBundle.Name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded">
                      {selectedBundle.ProductCode}
                    </code>
                    {selectedBundle.Family && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-sm font-medium text-gray-800 dark:text-gray-300">
                        {selectedBundle.Family}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2.5 py-1 text-sm font-medium text-green-800 dark:text-green-300">
                      Regional Bundle
                    </span>
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
                {/* Bundle Details */}
                <div className="space-y-4">
                  {getBundleFieldsForDisplay(selectedBundle).map(({ label, value, isImportant }) => (
                    <div key={label} className="grid grid-cols-3 gap-4">
                      <dt className={`text-sm font-medium ${isImportant ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {label}
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100 col-span-2 break-words">
                        {formatFieldValue(value, isImportant)}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                {selectedBundle.Id && (
                  <a
                    href={`https://riskms.lightning.force.com/lightning/r/Product2/${selectedBundle.Id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 h-10 px-4 py-2"
                  >
                    View in Salesforce →
                  </a>
                )}
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

export default RegionalBundlesTab;

