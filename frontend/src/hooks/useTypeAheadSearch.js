import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for type-ahead search functionality
 * Provides debounced search, keyboard navigation, and result management
 */
const useTypeAheadSearch = (searchFunction, options = {}) => {
  const {
    debounceDelay = 300,
    minSearchLength = 2,
    limit = 10,
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);
  
  const abortControllerRef = useRef(null);
  const debounceTimeoutRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Perform search
  const performSearch = useCallback(async (term) => {
    if (term.length < minSearchLength) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await searchFunction(term, limit, controller.signal);
      
      if (!controller.signal.aborted) {
        if (data.success) {
          setResults(data.results);
          setIsOpen(true);
          setSelectedIndex(-1);
        } else {
          setError(data.error || 'Search failed');
          setResults(null);
          setIsOpen(false);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        console.error('Type-ahead search error:', err);
        setError(err.message || 'Search failed');
        setResults(null);
        setIsOpen(false);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [searchFunction, minSearchLength, limit]);

  // Handle search term change with debouncing
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, debounceDelay);
  }, [performSearch, debounceDelay]);

  // Keyboard navigation handlers
  const handleKeyDown = useCallback((event) => {
    if (!isOpen || !results) return;

    const { technicalRequests = [], accounts = [] } = results;
    const totalItems = technicalRequests.length + accounts.length;

    if (totalItems === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
        break;
      
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          // Get the selected item
          let selectedItem;
          if (selectedIndex < technicalRequests.length) {
            selectedItem = {
              type: 'technical_request',
              ...technicalRequests[selectedIndex]
            };
          } else {
            selectedItem = {
              type: 'account',
              ...accounts[selectedIndex - technicalRequests.length]
            };
          }
          return selectedItem;
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      
      default:
        break;
    }

    return null;
  }, [isOpen, results, selectedIndex]);

  // Close dropdown
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(-1);
  }, []);

  // Clear search
  const clear = useCallback(() => {
    setSearchTerm('');
    setResults(null);
    setIsOpen(false);
    setSelectedIndex(-1);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isOpen,
    isLoading,
    selectedIndex,
    error,
    handleSearchChange,
    handleKeyDown,
    close,
    clear,
  };
};

export default useTypeAheadSearch;

