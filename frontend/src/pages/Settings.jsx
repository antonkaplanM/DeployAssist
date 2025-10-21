import React, { useState } from 'react';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  BellIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const Settings = () => {
  const [activeSection, setActiveSection] = useState('profile');

  const sections = [
    { id: 'profile', name: 'Profile', icon: UserCircleIcon },
    { id: 'sml', name: 'SML Configuration', icon: Cog6ToothIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'help', name: 'Help & Docs', icon: DocumentTextIcon },
  ];

  return (
    <div id="page-settings" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your application settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {section.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {activeSection === 'profile' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
                <p className="text-sm text-gray-600">Manage your personal information</p>
                <div className="pt-4 text-center text-gray-500">
                  Profile settings coming soon
                </div>
              </div>
            )}

            {activeSection === 'sml' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">SML Configuration</h2>
                <p className="text-sm text-gray-600">
                  Configure SML (Service Management Layer) integration for product entitlements
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-blue-800">
                    SML authentication is cookie-based and configured through the UI.
                    Configuration is stored in .sml_config.json file.
                  </p>
                  <p className="text-sm text-blue-800 mt-2">
                    Supported environments:
                  </p>
                  <ul className="mt-2 ml-4 text-sm text-blue-800 list-disc">
                    <li>euw1: https://api-euw1.rms.com</li>
                    <li>use1: https://api-use1.rms.com</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-600">
                  Manage how you receive notifications
                </p>
                <div className="pt-4 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      defaultChecked
                    />
                    <span className="text-sm text-gray-700">Email notifications</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      defaultChecked
                    />
                    <span className="text-sm text-gray-700">In-app notifications</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Expiration alerts</span>
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
                <p className="text-sm text-gray-600">
                  Manage your password and security preferences
                </p>
                <div className="pt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Change Password
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'help' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">Help & Documentation</h2>
                <p className="text-sm text-gray-600">
                  Access documentation and support resources
                </p>
                <div className="pt-4 space-y-3">
                  <a
                    href="/Technical Documentation"
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900">Technical Documentation</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Complete technical documentation and guides
                    </p>
                  </a>
                  <a
                    href="#"
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900">Getting Started</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Quick start guide for new users
                    </p>
                  </a>
                  <a
                    href="#"
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900">FAQ</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Frequently asked questions
                    </p>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

