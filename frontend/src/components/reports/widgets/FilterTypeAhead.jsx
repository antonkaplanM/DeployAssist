import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

const resolveField = (obj, path) => {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

/**
 * Recursively search a response object for an array matching the target key.
 * Handles cases where the result key is nested deeper than expected
 * (e.g. response is { results: { accounts: [...] } } and key is "accounts").
 */
const findArrayIn = (obj, targetKey, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  if (Array.isArray(obj)) return null;

  if (targetKey) {
    const leafKey = targetKey.includes('.') ? targetKey.split('.').pop() : targetKey;
    if (obj[leafKey] && Array.isArray(obj[leafKey])) return obj[leafKey];
  }

  for (const val of Object.values(obj)) {
    if (targetKey && typeof val === 'object' && !Array.isArray(val)) {
      const found = findArrayIn(val, targetKey, depth + 1);
      if (found) return found;
    }
  }

  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val;
  }

  return null;
};

/**
 * Generic typeahead filter for the report renderer.
 * Fetches suggestions from a configurable API endpoint as the user types.
 */
const FilterTypeAhead = ({
  value,
  onChange,
  placeholder = 'Search...',
  suggestEndpoint,
  suggestParam = 'search',
  suggestResultKey,
  suggestDisplayField = 'name',
  suggestSecondaryField,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const localTermRef = useRef(value || '');

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (term) => {
    if (!suggestEndpoint) {
      console.warn('[FilterTypeAhead] No suggestEndpoint configured');
      return;
    }
    if (!term || term.length < MIN_CHARS) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = suggestEndpoint.replace(/^\/api\//, '/');
      const res = await api.get(endpoint, {
        params: { [suggestParam]: term, limit: 10 },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const responseData = res.data;
      let items = null;

      if (suggestResultKey) {
        items = resolveField(responseData, suggestResultKey);
      }

      if (!items || !Array.isArray(items)) {
        items = findArrayIn(responseData, suggestResultKey);
      }

      if (!Array.isArray(items)) items = [];

      setSuggestions(items);
      setIsOpen(items.length > 0);
      setSelectedIndex(-1);

      if (items.length === 0) {
        setError('No matches found');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      console.warn('[FilterTypeAhead] Fetch error:', err.message, err.response?.status);
      setError(`Search failed: ${err.response?.status || err.message}`);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [suggestEndpoint, suggestParam, suggestResultKey]);

  const handleChange = useCallback((e) => {
    const term = e.target.value;
    localTermRef.current = term;
    onChange(term);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (term.length >= MIN_CHARS) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(localTermRef.current);
      }, DEBOUNCE_MS);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [onChange, fetchSuggestions]);

  const selectItem = useCallback((item) => {
    const display = resolveField(item, suggestDisplayField) || String(item);
    localTermRef.current = display;
    onChange(display);
    setIsOpen(false);
    setSuggestions([]);
    setError(null);
  }, [onChange, suggestDisplayField]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) selectItem(suggestions[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, suggestions, selectedIndex, selectItem]);

  const highlightMatch = (text) => {
    if (!value || !text) return text;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === value.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-0.5 rounded">{part}</mark>
        : part
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className="pl-8 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
        />
        {isLoading && (
          <div className="absolute right-2.5 top-2.5">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          </div>
        )}
      </div>

      {error && !isOpen && value.length >= MIN_CHARS && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 text-xs text-gray-500 dark:text-gray-400">
          {error}
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
        >
          {suggestions.map((item, i) => {
            const display = resolveField(item, suggestDisplayField) || String(item);
            const secondary = suggestSecondaryField
              ? resolveField(item, suggestSecondaryField)
              : (item.tenantName || item.type || item.industry || null);
            return (
              <div
                key={item.id || item.tenant_id || i}
                className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => selectItem(item)}
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {highlightMatch(display)}
                </div>
                {secondary && secondary !== display && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {highlightMatch(String(secondary))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FilterTypeAhead;
