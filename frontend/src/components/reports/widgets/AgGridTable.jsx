import React, { useState, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

ModuleRegistry.registerModules([AllCommunityModule]);

const lightTheme = themeQuartz.withParams({
  borderRadius: 8,
  headerBackgroundColor: '#f9fafb',
  headerTextColor: '#4b5563',
  headerFontSize: 13,
  headerFontWeight: 500,
  cellTextColor: '#111827',
  rowBorder: { color: '#f3f4f6' },
  fontSize: 13,
  spacing: 6,
});

const darkTheme = themeQuartz.withParams({
  backgroundColor: '#1f2937',
  foregroundColor: '#e5e7eb',
  borderColor: '#374151',
  borderRadius: 8,
  headerBackgroundColor: '#111827',
  headerTextColor: '#9ca3af',
  headerFontSize: 13,
  headerFontWeight: 500,
  cellTextColor: '#e5e7eb',
  rowBorder: { color: '#374151' },
  oddRowBackgroundColor: '#1a2332',
  fontSize: 13,
  spacing: 6,
  rowHoverColor: '#2d3a4a',
});

const CF_BG = {
  danger:  { light: '#fef2f2', dark: '#450a0a' },
  warning: { light: '#fffbeb', dark: '#451a03' },
  success: { light: '#f0fdf4', dark: '#052e16' },
  info:    { light: '#eff6ff', dark: '#172554' },
  muted:   { light: '#f3f4f6', dark: '#374151' },
};

const CF_TEXT = {
  danger:  { light: '#b91c1c', dark: '#fca5a5' },
  warning: { light: '#b45309', dark: '#fcd34d' },
  success: { light: '#15803d', dark: '#86efac' },
  info:    { light: '#1d4ed8', dark: '#93c5fd' },
  muted:   { light: '#6b7280', dark: '#9ca3af' },
};

const resolveField = (obj, path) => {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const evaluateRule = (value, rule) => {
  if (value === null || value === undefined) return false;
  switch (rule.operator) {
    case 'equals':             return String(value) === String(rule.value);
    case 'notEquals':          return String(value) !== String(rule.value);
    case 'contains':           return String(value).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'greaterThan':        return Number(value) > Number(rule.value);
    case 'lessThan':           return Number(value) < Number(rule.value);
    case 'greaterThanOrEqual': return Number(value) >= Number(rule.value);
    case 'lessThanOrEqual':    return Number(value) <= Number(rule.value);
    default:                   return false;
  }
};

const formatCellValue = (value, format) => {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'date':       return new Date(value).toLocaleDateString();
    case 'currency':   return `$${Number(value).toLocaleString()}`;
    case 'percentage': return `${Number(value).toFixed(1)}%`;
    case 'number':     return Number(value).toLocaleString();
    default:           return String(value);
  }
};

const AgGridTable = ({
  title, data, config, loading, error,
  onRowClickConfig, onRowClick, selectedRowValue, conditionalFormatting
}) => {
  const gridRef = useRef(null);
  const [quickFilter, setQuickFilter] = useState('');
  const isClickable = !!(onRowClickConfig && onRowClick);

  const isDark = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

  const columnDefs = useMemo(() => {
    if (!config?.columnDefs) return [];

    return config.columnDefs.map(col => {
      const def = {
        field: col.field,
        headerName: col.headerName || col.header || col.field,
        sortable: col.sortable !== false,
        filter: col.filter !== false,
        resizable: col.resizable !== false,
        flex: col.flex,
        width: col.width ? parseInt(col.width, 10) : undefined,
        minWidth: col.minWidth || 80,
      };

      if (col.format) {
        def.valueFormatter = (params) => formatCellValue(params.value, col.format);
      }

      if (col.valueGetter) {
        const fieldPath = col.field;
        def.valueGetter = (params) => resolveField(params.data, fieldPath);
      }

      if (col.field && col.field.includes('.')) {
        const fieldPath = col.field;
        def.valueGetter = (params) => resolveField(params.data, fieldPath);
      }

      return def;
    });
  }, [config?.columnDefs]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    flex: 1,
    ...(config?.defaultColDef || {}),
  }), [config?.defaultColDef]);

  const getRowStyle = useCallback((params) => {
    if (!params.data) return undefined;

    if (isClickable && onRowClickConfig) {
      const rowVal = resolveField(params.data, onRowClickConfig.valueField);
      if (rowVal === selectedRowValue) {
        return {
          backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
          color: isDark ? '#93c5fd' : '#1d4ed8',
        };
      }
    }

    if (conditionalFormatting && conditionalFormatting.length > 0) {
      for (const rule of conditionalFormatting) {
        const val = resolveField(params.data, rule.field);
        if (evaluateRule(val, rule)) {
          const mode = isDark ? 'dark' : 'light';
          return {
            backgroundColor: CF_BG[rule.style]?.[mode],
            color: CF_TEXT[rule.style]?.[mode],
          };
        }
      }
    }

    return undefined;
  }, [conditionalFormatting, isClickable, onRowClickConfig, selectedRowValue, isDark]);

  const onRowClicked = useCallback((event) => {
    if (!isClickable || !event.data) return;
    const value = resolveField(event.data, onRowClickConfig.valueField);
    onRowClick(onRowClickConfig.paramId, value);
  }, [isClickable, onRowClickConfig, onRowClick]);

  const pagination = config?.pagination !== false;
  const pageSize = config?.pageSize || 10;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded mb-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-red-500">Failed to load table data</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {config?.searchable !== false && (
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={quickFilter}
              onChange={e => setQuickFilter(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
            />
          </div>
        )}
      </div>

      {!data || data.length === 0 ? (
        <p className="text-sm text-gray-500">No data available</p>
      ) : (
        <div style={{ width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            theme={isDark ? darkTheme : lightTheme}
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={pagination}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            quickFilterText={quickFilter}
            domLayout="autoHeight"
            animateRows={true}
            getRowStyle={getRowStyle}
            onRowClicked={isClickable ? onRowClicked : undefined}
            rowClass={isClickable ? 'cursor-pointer' : ''}
            suppressCellFocus={true}
            enableCellTextSelection={true}
          />
        </div>
      )}
    </div>
  );
};

export default AgGridTable;
