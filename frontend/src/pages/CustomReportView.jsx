import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  TrashIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ReportRenderer from '../components/reports/ReportRenderer';
import { getReport, deleteReport } from '../services/customReportService';

const CustomReportView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getReport(slug);
        if (result.success) {
          setReport(result.report);
        } else {
          setError('Report not found');
        }
      } catch (err) {
        setError(err.response?.status === 404 ? 'Report not found' : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [slug]);

  const handleDelete = async () => {
    if (!report) return;
    setDeleting(true);
    try {
      await deleteReport(report.id);
      navigate('/custom-reports');
    } catch (err) {
      console.error('Failed to delete report:', err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Loading report..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <Link
          to="/custom-reports"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Reports
        </Link>
      </div>
    );
  }

  const config = report?.report_config;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/custom-reports"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{config?.title || report.name}</h1>
            {(config?.description || report.description) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{config?.description || report.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              v{report.version}
            </span>
          </div>
          <Link
            to={`/custom-reports/edit/${report.slug}`}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit report"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete report"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Report Content */}
      {config ? (
        <ReportRenderer config={config} showTitle={false} />
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>This report has no configuration data.</p>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Report</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{report.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-40 flex items-center gap-2"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportView;
