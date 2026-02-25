import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

const formatValue = (value, format) => {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'currency':
      return `$${Number(value).toLocaleString()}`;
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
    default:
      return Number(value).toLocaleString();
  }
};

const KpiCard = ({ title, value, format = 'number', prefix, suffix, comparison, comparisonLabel, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-sm text-red-500 mt-2">Failed to load data</p>
      </div>
    );
  }

  const isPositive = comparison > 0;
  const isNegative = comparison < 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
      <div className="mt-2 flex items-baseline gap-1">
        {prefix && <span className="text-lg text-gray-500 dark:text-gray-400">{prefix}</span>}
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {formatValue(value, format)}
        </span>
        {suffix && <span className="text-lg text-gray-500 dark:text-gray-400">{suffix}</span>}
      </div>
      {comparison !== undefined && comparison !== null && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive && <ArrowUpIcon className="h-4 w-4 text-green-500" />}
          {isNegative && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
            {Math.abs(comparison).toLocaleString()}
          </span>
          {comparisonLabel && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{comparisonLabel}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
