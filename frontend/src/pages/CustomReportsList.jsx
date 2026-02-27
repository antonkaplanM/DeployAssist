import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DocumentChartBarIcon,
  PlusIcon,
  ClockIcon,
  UserIcon,
  TrashIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { listReports, deleteReport } from '../services/customReportService';

const CustomReportsList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [importError, setImportError] = useState(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReports(50, 0);
      setReports(result.reports || []);
      setTotal(result.meta?.total || 0);
    } catch (err) {
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
    } catch {
      // deletion failed; item stays in the list
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    if (!file.name.endsWith('.json')) {
      setImportError('Please select a .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        if (!config.title || !Array.isArray(config.components) || config.components.length === 0) {
          setImportError('Invalid report file: must contain a "title" and at least one component.');
          return;
        }
        navigate('/custom-reports/create', { state: { importedConfig: config } });
      } catch {
        setImportError('Could not parse file. Make sure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Custom Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} report{total !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Import a report configuration JSON file"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Import
          </button>
          <Link
            to="/custom-reports/create"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Create Report
          </Link>
        </div>
      </div>

      {importError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner message="Loading reports..." />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-500">{error}</p>
          <button onClick={loadReports} className="mt-4 text-sm text-blue-600 hover:text-blue-700">
            Retry
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-4">
          <DocumentChartBarIcon className="h-16 w-16" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No reports yet</p>
          <p className="text-sm">Create your first report using the AI report builder.</p>
          <Link
            to="/custom-reports/create"
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Create Report
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <Link
                  to={`/custom-reports/${report.slug}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {report.report_config?.title || report.name}
                  </h3>
                  {(report.report_config?.description || report.description) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {report.report_config?.description || report.description}
                    </p>
                  )}
                </Link>
                <button
                  onClick={() => handleDelete(report.id, report.name)}
                  disabled={deletingId === report.id}
                  className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete report"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                {report.created_by_username && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3.5 w-3.5" />
                    {report.created_by_username}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {new Date(report.updated_at).toLocaleDateString()}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  v{report.version}
                </span>
                {report.data_sources?.count > 0 && (
                  <span className="text-gray-400">
                    {report.data_sources.count} data source{report.data_sources.count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomReportsList;
