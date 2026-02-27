import React, { useState, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const resolveField = (obj, path) => {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const CF_STYLES = {
  danger:  { row: 'bg-red-50 dark:bg-red-900/20',    cell: 'text-red-700 dark:text-red-300' },
  warning: { row: 'bg-amber-50 dark:bg-amber-900/20', cell: 'text-amber-700 dark:text-amber-300' },
  success: { row: 'bg-green-50 dark:bg-green-900/20', cell: 'text-green-700 dark:text-green-300' },
  info:    { row: 'bg-blue-50 dark:bg-blue-900/20',   cell: 'text-blue-700 dark:text-blue-300' },
  muted:   { row: 'bg-gray-100 dark:bg-gray-700/40',  cell: 'text-gray-500 dark:text-gray-400' },
};

const evaluateRule = (row, rule) => {
  const val = resolveField(row, rule.field);
  if (val === null || val === undefined) return false;
  switch (rule.operator) {
    case 'equals':              return String(val) === String(rule.value);
    case 'notEquals':           return String(val) !== String(rule.value);
    case 'contains':            return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
    case 'greaterThan':         return Number(val) > Number(rule.value);
    case 'lessThan':            return Number(val) < Number(rule.value);
    case 'greaterThanOrEqual':  return Number(val) >= Number(rule.value);
    case 'lessThanOrEqual':     return Number(val) <= Number(rule.value);
    default:                    return false;
  }
};

const getRowStyle = (row, rules) => {
  if (!rules || rules.length === 0) return null;
  for (const rule of rules) {
    if (evaluateRule(row, rule)) return CF_STYLES[rule.style] || null;
  }
  return null;
};

const formatCellValue = (value, format) => {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'currency':
      return `$${Number(value).toLocaleString()}`;
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
};

const DataTable = ({ title, data, columns, pageSize = 10, searchable = true, loading, error, onRowClickConfig, onRowClick, selectedRowValue, conditionalFormatting }) => {
  const isClickable = !!(onRowClickConfig && onRowClick);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    let rows = [...data];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(row =>
        columns.some(col => {
          const val = resolveField(row, col.field);
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }

    if (sortField) {
      rows.sort((a, b) => {
        const aVal = resolveField(a, sortField) ?? '';
        const bVal = resolveField(b, sortField) ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, search, sortField, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

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
        {searchable && (
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search..."
              className="pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
            />
          </div>
        )}
      </div>

      {!data || data.length === 0 ? (
        <p className="text-sm text-gray-500">No data available</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {columns.map(col => (
                    <th
                      key={col.field}
                      onClick={() => col.sortable !== false && handleSort(col.field)}
                      className={`text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400 ${col.sortable !== false ? 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 select-none' : ''}`}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {col.header}
                        {sortField === col.field && (
                          sortDir === 'asc'
                            ? <ChevronUpIcon className="h-3 w-3" />
                            : <ChevronDownIcon className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => {
                  const isSelected = isClickable && resolveField(row, onRowClickConfig.valueField) === selectedRowValue;
                  const cfStyle = !isSelected ? getRowStyle(row, conditionalFormatting) : null;
                  return (
                    <tr
                      key={i}
                      onClick={isClickable ? () => onRowClick(onRowClickConfig.paramId, resolveField(row, onRowClickConfig.valueField)) : undefined}
                      className={[
                        'border-b border-gray-100 dark:border-gray-700',
                        isClickable ? 'cursor-pointer' : '',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                          : cfStyle
                            ? cfStyle.row
                            : 'hover:bg-gray-50 dark:hover:bg-gray-750',
                      ].join(' ')}
                    >
                      {columns.map(col => (
                        <td key={col.field} className={`py-2 px-3 ${cfStyle ? cfStyle.cell : 'text-gray-900 dark:text-gray-100'}`}>
                          {formatCellValue(resolveField(row, col.field), col.format)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{filtered.length} row{filtered.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Prev
                </button>
                <span className="px-2 py-1">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataTable;
