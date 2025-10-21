import React, { useState, useRef, useEffect } from 'react';
import { 
  ChartBarIcon, 
  GlobeAltIcon, 
  ShoppingBagIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';

const ActionsMenu = ({ request, onRefresh }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
    setIsOpen(false);
  };

  const handleViewAccountHistory = () => {
    // Navigate to Analytics > Account History with the account name
    navigate(`/analytics/account-history?account=${encodeURIComponent(request.Account__c)}`);
    setIsOpen(false);
  };

  const handleViewInSalesforce = () => {
    // Open Salesforce record in new tab
    const salesforceUrl = `https://riskinc.lightning.force.com/lightning/r/Prof_Services_Request__c/${request.Id}/view`;
    window.open(salesforceUrl, '_blank');
    setIsOpen(false);
  };

  const handleViewCustomerProducts = () => {
    // Navigate to Customer Products with the account name
    navigate(`/customer-products?account=${encodeURIComponent(request.Account__c)}`);
    setIsOpen(false);
  };

  const handleViewAuditTrail = () => {
    // Navigate to PS Audit Trail with the PS record name
    navigate(`/provisioning/audit-trail?search=${encodeURIComponent(request.Name)}`);
    setIsOpen(false);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(request.Id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 h-8 w-8"
        title="Actions"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu">
            {/* View Account History */}
            <button
              onClick={handleViewAccountHistory}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ChartBarIcon className="h-4 w-4" />
              View Account History
            </button>

            {/* View in Salesforce */}
            <button
              onClick={handleViewInSalesforce}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <GlobeAltIcon className="h-4 w-4" />
              View in Salesforce
            </button>

            {/* View Customer Products */}
            <button
              onClick={handleViewCustomerProducts}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ShoppingBagIcon className="h-4 w-4" />
              View Customer Products
            </button>

            {/* View Audit Trail */}
            <button
              onClick={handleViewAuditTrail}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              View Audit Trail
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Copy PS Record ID */}
            <button
              onClick={() => handleCopy(request.Name, 'PS Record ID')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy PS Record ID
            </button>

            {/* Copy Account Name */}
            <button
              onClick={() => handleCopy(request.Account__c, 'Account Name')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy Account Name
            </button>

            {/* Copy Deployment Number */}
            {request.Deployment__r?.Name && (
              <button
                onClick={() => handleCopy(request.Deployment__r.Name, 'Deployment Number')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                role="menuitem"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy Deployment Number
              </button>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Refresh Single Record */}
            <button
              onClick={handleRefresh}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              role="menuitem"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsMenu;


