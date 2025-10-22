import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {/* Page title will be managed by individual pages */}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <UserCircleIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  Welcome, <span className="font-medium text-gray-900 dark:text-gray-100">{user.username}</span>
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;



