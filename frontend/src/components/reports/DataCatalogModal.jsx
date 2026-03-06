import React, { useState, useEffect, useMemo } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ServerIcon,
  CpuChipIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

const UPPERCASE_TOKENS = new Set([
  'id', 'url', 'ps', 'csm', 'sml', 'api', 'ip', 'ui', 'csv', 'json', 'http',
]);

function humanizeFieldName(field) {
  const tokens = field
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split(/[_\-.]+/)
    .filter(Boolean);

  return tokens
    .map((t) => {
      const lower = t.toLowerCase();
      if (UPPERCASE_TOKENS.has(lower)) return t.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

const SOURCE_TYPE_META = {
  primary: {
    label: 'Primary',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    icon: ServerIcon,
    description: 'Direct from external systems',
  },
  derived: {
    label: 'Derived',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    icon: CpuChipIcon,
    description: 'Computed from primary sources',
  },
  preserved: {
    label: 'Preserved',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
    icon: ArchiveBoxIcon,
    description: 'Captured because ephemeral in source',
  },
};

function ParamBadge({ param }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-mono">
      {param.name}
      <span className="text-gray-400 dark:text-gray-500">: {param.type}</span>
      {param.optional && (
        <span className="text-gray-400 dark:text-gray-500 italic ml-0.5">?</span>
      )}
    </span>
  );
}

function EndpointCard({ source, isExpanded, onToggle }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-semibold text-blue-600 dark:text-blue-400 truncate">
              {source.endpoint}
            </code>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {source.description?.split('.')[0]}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{source.description}</p>

          {source.primarySource && (
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Source
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-mono">
                {source.primarySource}
              </p>
            </div>
          )}

          {source.params?.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Parameters
              </span>
              <div className="mt-1.5 space-y-1.5">
                {source.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-2">
                    <ParamBadge param={p} />
                    {p.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {p.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {source.responseShape && (
            <div>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Response Fields
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {source.responseShape.fields?.map((f) => (
                  <span
                    key={f}
                    title={f}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                  >
                    {humanizeFieldName(f)}
                  </span>
                ))}
              </div>
              {source.responseShape.arrayKey && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Data array key: <code className="font-mono text-gray-600 dark:text-gray-300">{source.responseShape.arrayKey}</code>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, sources, search, expandedEndpoints, onToggleEndpoint }) {
  const sourceType = sources[0]?.sourceType || 'derived';
  const meta = SOURCE_TYPE_META[sourceType] || SOURCE_TYPE_META.derived;
  const Icon = meta.icon;

  const filteredSources = useMemo(() => {
    if (!search) return sources;
    const q = search.toLowerCase();
    return sources.filter(
      (s) =>
        s.endpoint.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.responseShape?.fields?.some((f) => f.toLowerCase().includes(q)) ||
        s.params?.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [sources, search]);

  if (filteredSources.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{category}</h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
          {meta.label}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {filteredSources.length} endpoint{filteredSources.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2 ml-6">
        {filteredSources.map((source) => (
          <EndpointCard
            key={source.id}
            source={source}
            isExpanded={expandedEndpoints.has(source.id)}
            onToggle={() => onToggleEndpoint(source.id)}
          />
        ))}
      </div>
    </div>
  );
}

const DataCatalogModal = ({ isOpen, onClose }) => {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState(new Set());

  useEffect(() => {
    if (!isOpen || catalog) return;
    setLoading(true);
    api.get('/report-data/catalog')
      .then((res) => setCatalog(res.data.catalog))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [isOpen, catalog]);

  const handleToggleEndpoint = (id) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categoryOrder = useMemo(() => {
    if (!catalog) return [];
    const typeOrder = { primary: 0, derived: 1, preserved: 2 };
    return Object.keys(catalog).sort((a, b) => {
      const aType = catalog[a][0]?.sourceType || 'derived';
      const bType = catalog[b][0]?.sourceType || 'derived';
      return (typeOrder[aType] ?? 9) - (typeOrder[bType] ?? 9);
    });
  }, [catalog]);

  const totalEndpoints = useMemo(() => {
    if (!catalog) return 0;
    return Object.values(catalog).reduce((sum, arr) => sum + arr.length, 0);
  }, [catalog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <CircleStackIcon className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Data Catalog
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {totalEndpoints} endpoints available for report building
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints, fields, or parameters..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                <div className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Loading data catalog...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              Failed to load catalog: {error}
            </div>
          )}

          {catalog && categoryOrder.map((category) => (
            <CategorySection
              key={category}
              category={category}
              sources={catalog[category]}
              search={search}
              expandedEndpoints={expandedEndpoints}
              onToggleEndpoint={handleToggleEndpoint}
            />
          ))}

          {catalog && search && categoryOrder.every((cat) => {
            const q = search.toLowerCase();
            return !catalog[cat].some(
              (s) =>
                s.endpoint.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q) ||
                s.responseShape?.fields?.some((f) => f.toLowerCase().includes(q)) ||
                s.params?.some((p) => p.name.toLowerCase().includes(q))
            );
          }) && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p className="text-sm">No endpoints match "{search}"</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              {Object.entries(SOURCE_TYPE_META).map(([key, meta]) => (
                <span key={key} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.color.split(' ')[0]}`} />
                  {meta.label}: {meta.description}
                </span>
              ))}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataCatalogModal;
