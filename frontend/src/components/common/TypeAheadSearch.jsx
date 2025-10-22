import React, { useRef, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useTypeAheadSearch from '../../hooks/useTypeAheadSearch';

/**
 * TypeAheadSearch Component
 * Provides a search input with dropdown suggestions for technical requests and accounts
 */
const TypeAheadSearch = ({ 
  searchFunction, 
  onSelect, 
  placeholder = "Search...",
  className = "",
  debounceDelay = 300,
  minSearchLength = 2,
  value = undefined,
  onChange = undefined,
}) => {
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const {
    searchTerm: internalSearchTerm,
    setSearchTerm: setInternalSearchTerm,
    results,
    isOpen,
    isLoading,
    selectedIndex,
    error,
    handleSearchChange,
    handleKeyDown,
    close,
  } = useTypeAheadSearch(searchFunction, { debounceDelay, minSearchLength });

  // Use controlled value if provided, otherwise use internal state
  const isControlled = value !== undefined;
  const searchTerm = isControlled ? value : internalSearchTerm;
  const setSearchTerm = isControlled ? onChange : setInternalSearchTerm;

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  // Handle result selection
  const selectResult = (item, type) => {
    if (isControlled && onChange) {
      onChange(item.name);
    } else {
      setSearchTerm(item.name);
    }
    close();
    if (onSelect) {
      onSelect({ ...item, type });
    }
  };

  // Handle keyboard navigation with Enter key
  const handleKeyPress = (event) => {
    const selectedItem = handleKeyDown(event);
    if (selectedItem && event.key === 'Enter') {
      selectResult(selectedItem, selectedItem.type);
    }
  };

  // Highlight matching text
  const highlightMatch = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Get total number of results
  const getTotalResults = () => {
    if (!results) return 0;
    const { technicalRequests = [], accounts = [] } = results;
    return technicalRequests.length + accounts.length;
  };

  // Check if an item is selected
  const isItemSelected = (index) => index === selectedIndex;

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            const newValue = e.target.value;
            if (isControlled && onChange) {
              onChange(newValue);
            }
            handleSearchChange(newValue);
          }}
          onKeyDown={handleKeyPress}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {error && (
            <div className="p-3 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {!error && getTotalResults() === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              No results found for "{searchTerm}"
            </div>
          )}

          {!error && results.technicalRequests && results.technicalRequests.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200">
                Technical Team Requests ({results.technicalRequests.length})
              </div>
              {results.technicalRequests.map((request, index) => (
                <div
                  key={`request-${request.id}`}
                  className={`px-3 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                    isItemSelected(index) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => selectResult(request, 'technical_request')}
                >
                  <div className="font-medium text-sm text-gray-900">
                    {highlightMatch(request.name, searchTerm)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Account: {request.account || 'N/A'} • Status: {request.status || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!error && results.accounts && results.accounts.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200">
                Accounts ({results.accounts.length})
              </div>
              {results.accounts.map((account, index) => {
                const globalIndex = (results.technicalRequests?.length || 0) + index;
                return (
                  <div
                    key={`account-${account.id}`}
                    className={`px-3 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                      isItemSelected(globalIndex) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => selectResult(account, 'account')}
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {highlightMatch(account.name, searchTerm)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {account.type && `Type: ${account.type}`}
                      {account.type && account.industry && ' • '}
                      {account.industry && `Industry: ${account.industry}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TypeAheadSearch;

