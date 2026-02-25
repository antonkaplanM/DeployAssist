import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import KpiCard from './widgets/KpiCard';
import ChartWidget from './widgets/ChartWidget';
import DataTable from './widgets/DataTable';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const GRID_SPAN_CLASSES = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
};

/**
 * Resolve a nested field path (e.g. "meta.total") from an object
 */
const resolveField = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

/**
 * Extract an array from an API response, trying common response shapes.
 * Handles: raw arrays, { data: [...] }, { reports: [...] }, { summary: {...} }, etc.
 */
const extractArray = (responseData) => {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;

  // Try well-known array keys in priority order
  const arrayKeys = ['data', 'reports', 'ghostAccounts', 'packages', 'deprovisionedAccounts',
    'changes', 'errors', 'products', 'entitlements', 'records', 'results', 'items'];
  for (const key of arrayKeys) {
    if (Array.isArray(responseData[key])) return responseData[key];
  }

  // If nothing matched, scan all top-level values for the first array
  for (const val of Object.values(responseData)) {
    if (Array.isArray(val)) return val;
  }

  return [];
};

/**
 * Apply a transform to raw API response data
 */
const applyTransform = (rawData, transform, valueField) => {
  if (!rawData) return undefined;

  const dataArray = Array.isArray(rawData) ? rawData : rawData.data;

  switch (transform) {
    case 'count':
      return Array.isArray(dataArray) ? dataArray.length : resolveField(rawData, valueField);
    case 'sum':
      return Array.isArray(dataArray) ? dataArray.reduce((s, d) => s + (Number(d[valueField]) || 0), 0) : undefined;
    case 'average':
      if (!Array.isArray(dataArray) || dataArray.length === 0) return 0;
      return dataArray.reduce((s, d) => s + (Number(d[valueField]) || 0), 0) / dataArray.length;
    case 'first':
      return Array.isArray(dataArray) && dataArray.length > 0 ? dataArray[0] : undefined;
    case 'last':
      return Array.isArray(dataArray) && dataArray.length > 0 ? dataArray[dataArray.length - 1] : undefined;
    default:
      return rawData;
  }
};

const ComponentRenderer = ({ component, filterValues }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...component.dataSource.params };
      if (filterValues) {
        Object.entries(filterValues).forEach(([, filter]) => {
          if (filter.value && filter.mapsToParam) {
            params[filter.mapsToParam] = filter.value;
          }
        });
      }
      const endpoint = component.dataSource.endpoint.replace(/^\/api\//, '/');
      const response = await api.get(endpoint, { params });
      setData(response.data);
    } catch (err) {
      console.error(`[ReportRenderer] Failed to fetch data for ${component.id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [component.dataSource, component.id, filterValues]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rawArray = extractArray(data);

  switch (component.type) {
    case 'kpi-card': {
      const value = component.dataSource.transform
        ? applyTransform(data, component.dataSource.transform, component.valueField)
        : resolveField(data, component.valueField);
      const comparison = component.comparisonField ? resolveField(data, component.comparisonField) : undefined;
      return (
        <KpiCard
          title={component.title}
          value={value}
          format={component.format}
          prefix={component.prefix}
          suffix={component.suffix}
          comparison={comparison}
          comparisonLabel={component.comparisonLabel}
          loading={loading}
          error={error}
        />
      );
    }

    case 'bar-chart':
    case 'line-chart':
    case 'pie-chart':
      return (
        <ChartWidget
          type={component.type}
          title={component.title}
          data={rawArray}
          config={component}
          loading={loading}
          error={error}
        />
      );

    case 'data-table':
      return (
        <DataTable
          title={component.title}
          data={rawArray}
          columns={component.columns}
          pageSize={component.pageSize}
          searchable={component.searchable}
          loading={loading}
          error={error}
        />
      );

    default:
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-yellow-200 dark:border-yellow-800 p-6">
          <p className="text-sm text-yellow-600">Unknown component type: {component.type}</p>
        </div>
      );
  }
};

const ReportRenderer = ({ config, showTitle = true }) => {
  const [filterValues, setFilterValues] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (config?.filters) {
      const initial = {};
      config.filters.forEach(f => {
        initial[f.id] = { value: f.default || '', mapsToParam: f.mapsToParam };
      });
      setFilterValues(initial);
    }
  }, [config]);

  useEffect(() => {
    if (config?.refreshInterval && config.refreshInterval > 0) {
      const interval = setInterval(() => setRefreshKey(k => k + 1), config.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [config?.refreshInterval]);

  if (!config || !config.components) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No report configuration provided</p>
      </div>
    );
  }

  const handleFilterChange = (filterId, value) => {
    setFilterValues(prev => ({
      ...prev,
      [filterId]: { ...prev[filterId], value }
    }));
  };

  return (
    <div>
      {showTitle && config.title && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h2>
            {config.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{config.description}</p>
            )}
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh data"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {config.filters && config.filters.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6">
          {config.filters.map(filter => (
            <div key={filter.id} className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {filter.label}
              </label>
              {filter.type === 'select' && (
                <select
                  value={filterValues[filter.id]?.value || filter.default || ''}
                  onChange={e => handleFilterChange(filter.id, e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {filter.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {filter.type === 'text' && (
                <input
                  type="text"
                  value={filterValues[filter.id]?.value || ''}
                  onChange={e => handleFilterChange(filter.id, e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-48"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {config.components.map(component => (
          <div
            key={`${component.id}-${refreshKey}`}
            className={GRID_SPAN_CLASSES[component.gridSpan] || 'col-span-1'}
          >
            <ComponentRenderer component={component} filterValues={filterValues} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportRenderer;
