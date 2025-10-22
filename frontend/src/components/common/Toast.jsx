import React, { useEffect } from 'react';
import { XMarkIcon, BellIcon } from '@heroicons/react/24/outline';

const Toast = ({ id, title, message, onClose, duration = 10000, actionLabel, onAction }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-300 animate-slide-in-right">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <BellIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
            {actionLabel && onAction && (
              <button
                onClick={() => {
                  onAction();
                  onClose(id);
                }}
                className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {actionLabel} →
              </button>
            )}
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              onClick={() => onClose(id)}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;

