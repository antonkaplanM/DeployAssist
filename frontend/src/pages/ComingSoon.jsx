import React from 'react';
import { RocketLaunchIcon } from '@heroicons/react/24/outline';

const ComingSoon = ({ section = 'This feature' }) => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
          <RocketLaunchIcon className="h-10 w-10 text-blue-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {section}
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This page is being migrated to React. It will be available soon!
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Migration in Progress:</span> We're working on bringing all features to the new React interface. Check back soon!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;




















