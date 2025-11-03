import React, { useState } from 'react';
import { CubeIcon, RectangleStackIcon } from '@heroicons/react/24/solid';
import ProductCatalogueTab from './ProductCatalogueTab';
import BundlesTab from './BundlesTab';

const Catalogue = () => {
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    {
      id: 'products',
      name: 'Products',
      icon: CubeIcon,
      description: 'Browse all available products'
    },
    {
      id: 'bundles',
      name: 'Bundles',
      icon: RectangleStackIcon,
      description: 'Manage deployment bundles'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CubeIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Catalogue
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Browse products and manage deployment bundles
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${
                        isActive
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }
                    `}
                    aria-hidden="true"
                  />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'products' && <ProductCatalogueTab />}
        {activeTab === 'bundles' && <BundlesTab />}
      </div>
    </div>
  );
};

export default Catalogue;


