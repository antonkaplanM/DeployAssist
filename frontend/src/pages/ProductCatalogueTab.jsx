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
import { getProductCatalogue, getProductById, exportProductCatalogueToExcel } from '../services/productCatalogueService';
import { useToast } from '../context/ToastContext';

const ProductCatalogueTab = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [productGroupFilter, setProductGroupFilter] = useState('all');
  const [productSelectionGroupingFilter, setProductSelectionGroupingFilter] = useState('all');
  const [families, setFamilies] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [productSelectionGroupings, setProductSelectionGroupings] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductPackages, setSelectedProductPackages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products based on search term, family, product group, and product selection grouping
  useEffect(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.Name?.toLowerCase().includes(term) ||
          product.ProductCode?.toLowerCase().includes(term) ||
          product.Description?.toLowerCase().includes(term) ||
          product.Family?.toLowerCase().includes(term)
      );
    }

    // Apply family filter
    if (familyFilter && familyFilter !== 'all') {
      filtered = filtered.filter((product) => product.Family === familyFilter);
    }

    // Apply product group filter
    if (productGroupFilter && productGroupFilter !== 'all') {
      filtered = filtered.filter((product) => product.Product_Group__c === productGroupFilter);
    }

    // Apply product selection grouping filter
    if (productSelectionGroupingFilter && productSelectionGroupingFilter !== 'all') {
      filtered = filtered.filter((product) => product.Product_Selection_Grouping__c === productSelectionGroupingFilter);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, familyFilter, productGroupFilter, productSelectionGroupingFilter]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getProductCatalogue({
        isActive: true,
        limit: 2000  // Increased to load all products (2000 total in DB, 1342 active)
      });

      if (result.success) {
        setProducts(result.products || []);
        setFilteredProducts(result.products || []);
        setTotalSize(result.totalSize || 0);
        setFamilies(result.filterOptions?.families || []);
        setProductGroups(result.filterOptions?.productGroups || []);
        setProductSelectionGroupings(result.filterOptions?.productSelectionGroupings || []);
        setLastRefresh(new Date().toLocaleString());
      } else {
        setError(result.error || 'Failed to load products');
      }
    } catch (err) {
      console.error('Error loading products:', err);
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
    loadProducts();
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      await exportProductCatalogueToExcel();
      showToast({ 
        title: 'Success', 
        message: 'Product catalogue exported successfully!' 
      });
    } catch (error) {
      console.error('Export error:', error);
      showToast({ 
        title: 'Export Failed', 
        message: error.message || 'Failed to export product catalogue' 
      });
    } finally {
      setExporting(false);
    }
  };

  const handleProductClick = async (productId) => {
    setLoading(true);
    try {
      const result = await getProductById(productId);
      if (result.success) {
        setSelectedProduct(result.product);
        
        // RelatedPackages is now included directly in the product data
        // No need for separate API call
        setSelectedProductPackages([]);
        
        setShowModal(true);
      } else {
        setError(result.error || 'Failed to load product details');
      }
    } catch (err) {
      console.error('Error loading product details:', err);
      setError('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
    setSelectedProductPackages([]);
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

  const getProductFieldsForDisplay = (product) => {
    if (!product) return [];

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
      { key: 'RI_Platform_Sub_Region__c', label: 'RI Subregion' },
      { key: 'Model_Type__c', label: 'Model Type' },
      { key: 'Model_Subtype__c', label: 'Model Subtype' },
      { key: 'IRP_Bundle_Region__c', label: 'Bundle Region' },
      { key: 'IRP_Bundle_Subregion__c', label: 'Bundle Subregion' },
      { key: 'Data_API_Name__c', label: 'Data API Name' },
      { key: 'Peril__c', label: 'Peril' },
      { key: 'Data_Type__c', label: 'Data Type' }
    ];

    return fieldsToShow
      .filter(({ key }) => product[key] !== undefined && product[key] !== null)
      .map(({ key, label }) => ({
        label,
        value: product[key]
      }));
  };

  const formatFieldValue = (value) => {
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
                placeholder="Search products by name, code, or description..."
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
            {/* Export to Excel Button */}
            <button
              onClick={handleExportToExcel}
              disabled={exporting || loading || filteredProducts.length === 0}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export all active products to Excel"
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
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredProducts.length}</span> of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{totalSize}</span> products
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
      </section>

      {/* Products Grid */}
      <section>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading products...</p>
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
        ) : filteredProducts.length === 0 ? (
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
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No products found</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.Id}
                onClick={() => handleProductClick(product.Id)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2">
                      {product.Name}
                    </h3>
                    <code className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                      {product.ProductCode}
                    </code>
                  </div>
                  <CubeIcon className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                </div>

                {product.Family && (
                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-300">
                      {product.Family}
                    </span>
                  </div>
                )}

                {product.Description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{product.Description}</p>
                )}

                <div className="mt-4 flex items-center justify-between text-xs">
                  {product.IsActive !== undefined && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 font-medium ${
                        product.IsActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {product.IsActive ? '✓ Active' : 'Inactive'}
                    </span>
                  )}
                  <span className="text-blue-600 dark:text-blue-400 font-medium hover:underline">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Product Details Modal */}
      {showModal && selectedProduct && (
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
                    {selectedProduct.Name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded">
                      {selectedProduct.ProductCode}
                    </code>
                    {selectedProduct.Family && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-sm font-medium text-gray-800 dark:text-gray-300">
                        {selectedProduct.Family}
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
                {/* Related Packages Section */}
                {selectedProductPackages.length > 0 && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Related Packages ({selectedProductPackages.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProductPackages.map((pkg) => (
                        <span
                          key={pkg.package_name}
                          className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900 px-3 py-1 text-xs font-medium text-green-800 dark:text-green-200"
                          title={`Seen ${pkg.occurrence_count} time(s)`}
                        >
                          {pkg.package_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Product Details */}
                <div className="space-y-4">
                  {getProductFieldsForDisplay(selectedProduct).map(({ label, value }) => (
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
                {selectedProduct.Id && (
                  <a
                    href={`https://riskms.lightning.force.com/lightning/r/Product2/${selectedProduct.Id}/view`}
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

export default ProductCatalogueTab;


