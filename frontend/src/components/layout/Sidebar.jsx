import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  ChartBarIcon, 
  ClockIcon,
  RectangleStackIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { hasPageAccess } = useAuth();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [provisioningOpen, setProvisioningOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Auto-expand/collapse sections based on current route
  useEffect(() => {
    const path = location.pathname;
    
    // Check if current path belongs to Analytics section
    const isAnalyticsPath = path.startsWith('/analytics');
    
    // Check if current path belongs to Provisioning section
    const isProvisioningPath = path.startsWith('/provisioning');
    
    // Update states accordingly
    setAnalyticsOpen(isAnalyticsPath);
    setProvisioningOpen(isProvisioningPath);
  }, [location.pathname]);

  // Define all navigation items with their page name mappings
  const allNavItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: HomeIcon, 
      id: 'nav-dashboard',
      pageName: 'dashboard'
    },
    { 
      name: 'Analytics', 
      icon: ChartBarIcon,
      id: 'nav-analytics',
      pageName: 'analytics', // Parent page
      submenu: [
        { 
          name: 'Overview', 
          path: '/analytics', 
          id: 'nav-analytics-overview',
          pageName: 'analytics.overview'
        },
        { 
          name: 'Account History', 
          path: '/analytics/account-history', 
          id: 'nav-account-history',
          pageName: 'analytics.account_history'
        },
        { 
          name: 'Package Changes', 
          path: '/analytics/package-changes', 
          id: 'nav-package-changes',
          pageName: 'analytics.package_changes'
        }
      ]
    },
    {
      name: 'Provisioning Monitor',
      icon: RectangleStackIcon,
      id: 'nav-provisioning',
      pageName: 'provisioning', // Parent page
      submenu: [
        { 
          name: 'Provisioning Monitor', 
          path: '/provisioning', 
          id: 'nav-provisioning-monitor',
          pageName: 'provisioning.monitor'
        },
        { 
          name: 'Expiration Monitor', 
          path: '/provisioning/expiration', 
          id: 'nav-expiration',
          pageName: 'provisioning.expiration'
        },
        { 
          name: 'Ghost Accounts', 
          path: '/provisioning/ghost-accounts', 
          id: 'nav-ghost-accounts',
          pageName: 'provisioning.ghost_accounts'
        },
        { 
          name: 'Audit Trail', 
          path: '/provisioning/audit-trail', 
          id: 'nav-audit-trail',
          pageName: 'provisioning.audit_trail'
        }
      ]
    },
    { 
      name: 'Customer Products', 
      path: '/customer-products', 
      icon: UserGroupIcon, 
      id: 'nav-customer-products',
      pageName: 'customer_products'
    },
    { 
      name: 'User Management', 
      path: '/users', 
      icon: UserGroupIcon, 
      id: 'nav-user-management',
      pageName: 'user_management'
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: Cog6ToothIcon, 
      id: 'nav-settings',
      pageName: 'settings'
    }
  ];

  // Filter navigation items based on user permissions
  const navItems = useMemo(() => {
    return allNavItems
      .map(item => {
        if (item.submenu) {
          // Filter submenu items
          const accessibleSubmenu = item.submenu.filter(subItem => 
            hasPageAccess(subItem.pageName)
          );
          
          // Only show parent if at least one submenu item is accessible
          if (accessibleSubmenu.length > 0) {
            return { ...item, submenu: accessibleSubmenu };
          }
          return null;
        }
        
        // Check direct page access
        return hasPageAccess(item.pageName) ? item : null;
      })
      .filter(Boolean); // Remove null items
  }, [hasPageAccess]);

  return (
    <aside className="w-64 border-r bg-white shadow-sm flex flex-col h-screen">
      {/* Logo/Header */}
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
          <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
        <span className="font-semibold text-gray-900">Deploy Assist</span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="space-y-2">
          {navItems.map((item) => {
            if (item.submenu) {
              const isOpen = item.name === 'Analytics' ? analyticsOpen : 
                           item.name === 'Provisioning Monitor' ? provisioningOpen : false;
              const setOpen = item.name === 'Analytics' ? setAnalyticsOpen : 
                            item.name === 'Provisioning Monitor' ? setProvisioningOpen : null;

              const subnavId = item.name === 'Analytics' ? 'analytics-subnav' :
                              item.name === 'Provisioning Monitor' ? 'provisioning-subnav' : undefined;

              return (
                <div key={item.name}>
                  <button
                    id={item.id}
                    onClick={() => setOpen && setOpen(!isOpen)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </div>
                    {isOpen ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>
                  
                  {isOpen && (
                    <div id={subnavId} className="ml-6 mt-1 space-y-1">
                      {item.submenu.map((subItem) => (
                        <Link
                          key={subItem.path}
                          id={subItem.id}
                          to={subItem.path}
                          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                            isActive(subItem.path)
                              ? 'bg-blue-50 text-blue-600 font-medium active'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                id={item.id}
                to={item.path}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer with user info */}
      <div className="border-t px-4 py-3">
        <div className="text-xs text-gray-500">
          Deploy Assist v2.0
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
