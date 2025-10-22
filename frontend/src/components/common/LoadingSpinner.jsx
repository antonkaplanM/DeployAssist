import React from 'react';

const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin rounded-full border-blue-600 dark:border-blue-400 border-t-transparent ${sizeClasses[size]}`}
      ></div>
      {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;



