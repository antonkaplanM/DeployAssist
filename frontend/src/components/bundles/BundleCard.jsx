import React from 'react';
import { RectangleStackIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, EyeIcon } from '@heroicons/react/24/outline';

const BundleCard = ({ bundle, onEdit, onDelete, onDuplicate, onViewContents }) => {
  const formattedDate = new Date(bundle.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <RectangleStackIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
              {bundle.name}
            </h3>
          </div>
          <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
            {bundle.bundle_id}
          </code>
        </div>
      </div>

      {bundle.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {bundle.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
        <div className="flex flex-col gap-1">
          <span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{bundle.product_count}</span>{' '}
            product{bundle.product_count !== 1 ? 's' : ''}
          </span>
          <span>Created {formattedDate}</span>
          {bundle.created_by_username && (
            <span className="text-xs">by {bundle.created_by_username}</span>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        {/* View Contents Button */}
        {bundle.product_count > 0 && (
          <button
            onClick={() => onViewContents(bundle.bundle_id)}
            className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            View Contents ({bundle.product_count})
          </button>
        )}
        
        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(bundle.bundle_id)}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </button>
          <button
            onClick={() => onDuplicate(bundle.bundle_id, bundle.name)}
            className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(bundle.bundle_id, bundle.name)}
            className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BundleCard;

