import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { RectangleStackIcon } from '@heroicons/react/24/solid';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getBundles, getBundleById, createBundle, deleteBundle, duplicateBundle } from '../services/bundleService';
import { getProductCatalogue } from '../services/productCatalogueService';
import { addProductsToBundle, updateProductQuantity, removeProductFromBundle } from '../services/bundleService';
import CreateBundleModal from '../components/bundles/CreateBundleModal';
import BundleCard from '../components/bundles/BundleCard';
import BundleProductModal from '../components/bundles/BundleProductModal';
import { useToast } from '../context/ToastContext';

const BundlesTab = () => {
  // View state
  const [view, setView] = useState('list'); // 'list' or 'builder'
  const [currentBundle, setCurrentBundle] = useState(null);

  // Bundles state
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Products state (for builder view)
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bundleProducts, setBundleProducts] = useState([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatingBundle, setDuplicatingBundle] = useState(null);
  const [showContentsModal, setShowContentsModal] = useState(false);
  const [viewingBundle, setViewingBundle] = useState(null);

  const { showToast } = useToast();

  // Helper functions for toast messages
  const showSuccess = (message) => {
    showToast({ title: 'Success', message, duration: 3000 });
  };

  const showError = (message) => {
    showToast({ title: 'Error', message, duration: 5000 });
  };

  useEffect(() => {
    loadBundles();
  }, [sortBy, sortOrder]);

  useEffect(() => {
    if (view === 'builder') {
      loadProducts();
    }
  }, [view]);

  const loadBundles = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getBundles({ sortBy, sortOrder });
      if (result.success) {
        setBundles(result.bundles || []);
      } else {
        setError(result.error || 'Failed to load bundles');
      }
    } catch (err) {
      console.error('Error loading bundles:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const result = await getProductCatalogue({ isActive: true, limit: 2000 });
      if (result.success) {
        setProducts(result.products || []);
      }
    } catch (err) {
      console.error('Error loading products:', err);
      showError('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const handleCreateBundle = async (bundleData) => {
    const result = await createBundle(bundleData);
    if (result.success) {
      showSuccess('Bundle created successfully');
      setShowCreateModal(false);
      // Switch to builder view with new bundle
      setCurrentBundle(result.bundle);
      setBundleProducts([]);
      setSelectedProducts(new Set());
      setView('builder');
      loadBundles();
    } else {
      showError(result.error || 'Failed to create bundle');
    }
  };

  const handleEditBundle = async (bundleId) => {
    setLoading(true);
    try {
      const result = await getBundleById(bundleId);
      if (result.success) {
        setCurrentBundle(result.bundle);
        setBundleProducts(result.bundle.products || []);
        setSelectedProducts(new Set());
        setView('builder');
      } else {
        showError(result.error || 'Failed to load bundle');
      }
    } catch (err) {
      console.error('Error loading bundle:', err);
      showError('Failed to load bundle');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBundle = async (bundleId, bundleName) => {
    if (!window.confirm(`Are you sure you want to delete "${bundleName}"?`)) {
      return;
    }

    const result = await deleteBundle(bundleId);
    if (result.success) {
      showSuccess(result.message || 'Bundle deleted');
      loadBundles();
    } else {
      showError(result.error || 'Failed to delete bundle');
    }
  };

  const handleDuplicateBundle = async (bundleId, bundleName) => {
    setDuplicatingBundle({ bundleId, originalName: bundleName });
    setShowDuplicateModal(true);
  };

  const handleDuplicateConfirm = async (newName) => {
    if (!duplicatingBundle) return;

    const result = await duplicateBundle(duplicatingBundle.bundleId, newName);
    if (result.success) {
      showSuccess('Bundle duplicated successfully');
      setShowDuplicateModal(false);
      setDuplicatingBundle(null);
      loadBundles();
    } else {
      showError(result.error || 'Failed to duplicate bundle');
    }
  };

  const handleViewContents = async (bundleId) => {
    setLoading(true);
    try {
      const result = await getBundleById(bundleId);
      if (result.success) {
        setViewingBundle(result.bundle);
        setShowContentsModal(true);
      } else {
        showError(result.error || 'Failed to load bundle');
      }
    } catch (err) {
      console.error('Error loading bundle:', err);
      showError('Failed to load bundle');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setView('list');
    setCurrentBundle(null);
    setBundleProducts([]);
    setSelectedProducts(new Set());
    setProductSearchTerm('');
    loadBundles();
  };

  const toggleProductSelection = (productId) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const handleAddSelectedProducts = async () => {
    if (selectedProducts.size === 0 || !currentBundle) return;

    const productsToAdd = Array.from(selectedProducts).map((productId) => ({
      productId,
      quantity: 1
    }));

    const result = await addProductsToBundle(currentBundle.bundle_id, productsToAdd);
    if (result.success) {
      showSuccess(`${result.count} product(s) added to bundle`);
      setSelectedProducts(new Set());
      // Reload bundle to get updated products
      const updatedBundle = await getBundleById(currentBundle.bundle_id);
      if (updatedBundle.success) {
        setBundleProducts(updatedBundle.bundle.products || []);
      }
    } else {
      showError(result.error || 'Failed to add products');
    }
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    if (!currentBundle || newQuantity < 1) return;

    const result = await updateProductQuantity(currentBundle.bundle_id, productId, newQuantity);
    if (result.success) {
      // Update local state
      setBundleProducts((prev) =>
        prev.map((p) => (p.Id === productId ? { ...p, quantity: newQuantity } : p))
      );
      showSuccess('Quantity updated');
    } else {
      showError(result.error || 'Failed to update quantity');
    }
  };

  const handleRemoveProduct = async (productId) => {
    if (!currentBundle) return;

    const result = await removeProductFromBundle(currentBundle.bundle_id, productId);
    if (result.success) {
      setBundleProducts((prev) => prev.filter((p) => p.Id !== productId));
      showSuccess('Product removed from bundle');
    } else {
      showError(result.error || 'Failed to remove product');
    }
  };

  const filteredBundles = bundles.filter((bundle) =>
    searchTerm ? bundle.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 bundle.description?.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  const filteredProducts = products.filter((product) => {
    if (!productSearchTerm) return true;
    const term = productSearchTerm.toLowerCase();
    return (
      product.Name?.toLowerCase().includes(term) ||
      product.ProductCode?.toLowerCase().includes(term) ||
      product.Family?.toLowerCase().includes(term)
    );
  });

  // Filter out products already in bundle
  const availableProducts = filteredProducts.filter(
    (product) => !bundleProducts.some((bp) => bp.Id === product.Id)
  );

  if (view === 'list') {
    return (
      <div>
        {/* Controls */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full max-w-2xl">
              {/* Search */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search bundles..."
                  className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Sort */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="w-full sm:w-[200px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 h-10 px-4 py-2 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Bundle
            </button>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredBundles.length}</span> bundle(s)
          </div>
        </div>

        {/* Bundles Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading bundles...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-red-500 mb-4">
              <InformationCircleIcon className="h-16 w-16" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{error}</p>
            <button
              onClick={loadBundles}
              className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
            >
              Try Again
            </button>
          </div>
        ) : filteredBundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RectangleStackIcon className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No bundles found</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first bundle'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Bundle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                onEdit={handleEditBundle}
                onDelete={handleDeleteBundle}
                onDuplicate={handleDuplicateBundle}
                onViewContents={handleViewContents}
              />
            ))}
          </div>
        )}

        {/* Create Bundle Modal */}
        {showCreateModal && (
          <CreateBundleModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateBundle}
          />
        )}

        {/* Duplicate Bundle Modal */}
        {showDuplicateModal && duplicatingBundle && (
          <CreateBundleModal
            onClose={() => {
              setShowDuplicateModal(false);
              setDuplicatingBundle(null);
            }}
            onCreate={handleDuplicateConfirm}
            initialName={`Copy of ${duplicatingBundle.originalName}`}
            title="Duplicate Bundle"
            submitLabel="Duplicate"
          />
        )}

        {/* Bundle Contents Modal */}
        {showContentsModal && viewingBundle && (
          <BundleProductModal
            isOpen={showContentsModal}
            onClose={() => {
              setShowContentsModal(false);
              setViewingBundle(null);
            }}
            bundle={viewingBundle}
          />
        )}
      </div>
    );
  }

  // Builder View
  return (
    <div>
      {/* Builder Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handleBackToList}
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Bundles
        </button>
        {currentBundle && (
          <div className="text-right">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentBundle.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{currentBundle.bundle_id}</p>
          </div>
        )}
      </div>

      {/* Side-by-Side View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product Catalogue */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Available Products</h3>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedProducts.size > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedProducts.size} product(s) selected
                </span>
                <button
                  onClick={handleAddSelectedProducts}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add to Bundle
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {productsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : availableProducts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {productSearchTerm ? 'No products found' : 'All products have been added to this bundle'}
              </p>
            ) : (
              availableProducts.map((product) => (
                <div
                  key={product.Id}
                  onClick={() => toggleProductSelection(product.Id)}
                  className={`
                    p-3 rounded-md border cursor-pointer transition-all
                    ${
                      selectedProducts.has(product.Id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`
                            w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                            ${
                              selectedProducts.has(product.Id)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300 dark:border-gray-600'
                            }
                          `}
                        >
                          {selectedProducts.has(product.Id) && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{product.Name}</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">{product.ProductCode}</p>
                      {product.Family && (
                        <span className="inline-block ml-7 mt-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {product.Family}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Bundle Builder */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Bundle Contents</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {bundleProducts.length} product(s) in bundle
            </p>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {bundleProducts.length === 0 ? (
              <div className="text-center py-16">
                <RectangleStackIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No products in bundle yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Select products from the left to add them
                </p>
              </div>
            ) : (
              bundleProducts.map((product) => (
                <div
                  key={product.Id}
                  className="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{product.Name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{product.ProductCode}</p>
                      {product.Family && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {product.Family}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <input
                        type="number"
                        min="1"
                        value={product.quantity || 1}
                        onChange={(e) => handleUpdateQuantity(product.Id, parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleRemoveProduct(product.Id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundlesTab;

