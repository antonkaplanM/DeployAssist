import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';

const NestedMultiSelect = ({ value = [], onChange, options, disabled, placeholder = 'Select options...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (productCode) => {
    const newValue = value.includes(productCode)
      ? value.filter(code => code !== productCode)
      : [...value, productCode];
    onChange(newValue);
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const categoryLabels = {
    apps: 'Apps',
    models: 'Models',
    data: 'Data'
  };

  const categoryColors = {
    apps: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
    models: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    data: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center justify-between"
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center">
          {value.length === 0 ? (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          ) : (
            <>
              <span className="text-sm font-medium">{value.length} selected</span>
              {value.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="ml-2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Clear all"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {Object.entries(options).map(([category, products]) => {
            if (products.length === 0) return null;

            return (
              <div key={category} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                {/* Category Header */}
                <div className={`px-4 py-2 ${categoryColors[category]} font-semibold text-sm sticky top-0 z-10`}>
                  {categoryLabels[category]} ({products.length})
                </div>

                {/* Products in Category */}
                <div className="py-1">
                  {products.map(product => {
                    const isSelected = value.includes(product.productCode);
                    return (
                      <label
                        key={product.productCode}
                        className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleOption(product.productCode)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-3 text-sm text-gray-900 dark:text-gray-100">
                          {product.productName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No Options */}
          {Object.values(options).every(arr => arr.length === 0) && (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No products available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NestedMultiSelect;

