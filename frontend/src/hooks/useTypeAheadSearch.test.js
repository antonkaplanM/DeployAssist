import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTypeAheadSearch from './useTypeAheadSearch';

describe('useTypeAheadSearch', () => {
  let mockSearchFunction;

  beforeEach(() => {
    mockSearchFunction = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    expect(result.current.searchTerm).toBe('');
    expect(result.current.results).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.error).toBeNull();
  });

  it('does not search when term is below minimum length', () => {
    const { result } = renderHook(() => 
      useTypeAheadSearch(mockSearchFunction, { minSearchLength: 3 })
    );

    act(() => {
      result.current.handleSearchChange('ab');
    });

    // Wait for debounce would happen here, but with short term no search occurs
    expect(result.current.results).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('updates search term when handleSearchChange is called', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    act(() => {
      result.current.handleSearchChange('test');
    });

    expect(result.current.searchTerm).toBe('test');
  });

  it('clears search state', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    act(() => {
      result.current.setSearchTerm('test');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.results).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('closes dropdown', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedIndex).toBe(-1);
  });

  it('provides keyboard navigation handler', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    expect(typeof result.current.handleKeyDown).toBe('function');
  });

  it('exposes all required hook interface methods', () => {
    const { result } = renderHook(() => useTypeAheadSearch(mockSearchFunction));

    // Verify all expected methods and properties exist
    expect(result.current).toHaveProperty('searchTerm');
    expect(result.current).toHaveProperty('setSearchTerm');
    expect(result.current).toHaveProperty('results');
    expect(result.current).toHaveProperty('isOpen');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('selectedIndex');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('handleSearchChange');
    expect(result.current).toHaveProperty('handleKeyDown');
    expect(result.current).toHaveProperty('close');
    expect(result.current).toHaveProperty('clear');
  });
});

