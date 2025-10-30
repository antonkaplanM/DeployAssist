import React, { useState, useEffect } from 'react';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  BellIcon,
  DocumentTextIcon,
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import settingsService from '../services/settingsService';
import validationService from '../services/validationService';
import notificationService from '../services/notificationService';
import { useAutoRefresh } from '../context/AutoRefreshContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const Settings = () => {
  const [activeSection, setActiveSection] = useState('web-connectivity');
  const [loadingStates, setLoadingStates] = useState({});
  const [testResults, setTestResults] = useState({});
  
  // Auto-refresh context
  const { autoRefreshInterval: contextInterval, updateAutoRefreshInterval } = useAutoRefresh();
  
  // Theme context
  const { theme, toggleTheme, isDark } = useTheme();
  
  // Toast context
  const { showToast } = useToast();
  
  // App Settings
  const [appSettings, setAppSettings] = useState({});
  
  // SML Config
  const [smlEnvironment, setSmlEnvironment] = useState('euw1');
  const [smlBearerToken, setSmlBearerToken] = useState('');
  
  // Validation Rules
  const [validationRules, setValidationRules] = useState([]);
  const [validationTestResults, setValidationTestResults] = useState(null);
  const [debugResults, setDebugResults] = useState(null);
  
  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({});
  const [notificationPermission, setNotificationPermission] = useState('default');

  const sections = [
    { id: 'web-connectivity', name: 'Web Connectivity', icon: GlobeAltIcon },
    { id: 'salesforce', name: 'Salesforce', icon: CloudIcon },
    { id: 'sml', name: 'SML Configuration', icon: Cog6ToothIcon },
    { id: 'application', name: 'Application Settings', icon: ShieldCheckIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'validation', name: 'Validation Rules', icon: DocumentTextIcon },
  ];

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Set the toast function in notification service
  useEffect(() => {
    notificationService.setToastFunction(showToast);
  }, [showToast]);

  // Sync context interval with local state
  useEffect(() => {
    setAppSettings(prev => ({
      ...prev,
      autoRefreshInterval: contextInterval
    }));
  }, [contextInterval]);

  const loadInitialData = async () => {
    const settings = settingsService.getAppSettings();
    // Sync with context interval
    settings.autoRefreshInterval = contextInterval;
    
    // Set defaults if not present
    if (!settings.defaultAnalyticsTimeframe) settings.defaultAnalyticsTimeframe = 12;
    if (!settings.defaultExpirationTimeframe) settings.defaultExpirationTimeframe = 90;
    if (!settings.defaultPackageChangesTimeframe) settings.defaultPackageChangesTimeframe = 30;
    
    // Dashboard widget defaults
    if (!settings.defaultDashboardValidationTimeframe) settings.defaultDashboardValidationTimeframe = '1w';
    if (!settings.defaultDashboardRemovalsTimeframe) settings.defaultDashboardRemovalsTimeframe = '1w';
    if (!settings.defaultDashboardExpirationWindow) settings.defaultDashboardExpirationWindow = 7;
    
    setAppSettings(settings);

    const rules = validationService.getValidationRules();
    setValidationRules(rules);

    const notifSettings = notificationService.getSettings();
    setNotificationSettings(notifSettings);
    setNotificationPermission(notificationService.getPermissionStatus());

    try {
      const smlConfig = await settingsService.getSMLConfig();
      if (smlConfig.environment) setSmlEnvironment(smlConfig.environment);
      if (smlConfig.bearerToken) setSmlBearerToken(smlConfig.bearerToken);
    } catch (error) {
      console.log('No SML config found or error loading:', error);
    }
  };

  const setLoading = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const setTestResult = (key, value) => {
    setTestResults(prev => ({ ...prev, [key]: value }));
  };

  // Web Connectivity Test
  const handleTestWebConnectivity = async () => {
    setLoading('webConnectivity', true);
    setTestResult('webConnectivity', null);
    
    try {
      const result = await settingsService.testWebConnectivity();
      setTestResult('webConnectivity', {
        success: result.overall === 'success',
        partial: result.overall === 'partial',
        message: result.summary,
        details: result
      });
    } catch (error) {
      setTestResult('webConnectivity', {
        success: false,
        message: 'Web connectivity test failed',
        error: error.message
      });
    } finally {
      setLoading('webConnectivity', false);
    }
  };

  // Salesforce Connection Test
  const handleTestSalesforce = async () => {
    setLoading('salesforce', true);
    setTestResult('salesforce', null);
    
    try {
      const result = await settingsService.testSalesforceConnection();
      setTestResult('salesforce', {
        success: result.overall === 'success',
        warning: result.overall === 'warning',
        message: result.summary || 'Salesforce test completed',
        details: result
      });
    } catch (error) {
      setTestResult('salesforce', {
        success: false,
        message: 'Salesforce connection test failed',
        error: error.message
      });
    } finally {
      setLoading('salesforce', false);
    }
  };

  // SML Configuration
  const handleSaveSMLConfig = async () => {
    setLoading('smlSave', true);
    setTestResult('smlSave', null);
    
    try {
      await settingsService.saveSMLConfig(smlEnvironment, smlBearerToken);
      setTestResult('smlSave', {
        success: true,
        message: 'SML configuration saved successfully'
      });
    } catch (error) {
      setTestResult('smlSave', {
        success: false,
        message: 'Failed to save SML configuration',
        error: error.message
      });
    } finally {
      setLoading('smlSave', false);
    }
  };

  const handleTestSMLConnection = async () => {
    setLoading('smlTest', true);
    setTestResult('smlTest', null);
    
    try {
      const result = await settingsService.testSMLConnection();
      setTestResult('smlTest', {
        success: true,
        message: 'SML connection successful',
        details: result
      });
    } catch (error) {
      setTestResult('smlTest', {
        success: false,
        message: 'SML connection failed',
        error: error.message
      });
    } finally {
      setLoading('smlTest', false);
    }
  };

  // Application Settings
  const handleSaveDefaults = () => {
    settingsService.saveAppSettings(appSettings);
    
    // Update auto-refresh context
    updateAutoRefreshInterval(appSettings.autoRefreshInterval);
    
    setTestResult('appSettings', {
      success: true,
      message: 'Application settings saved successfully - Auto-refresh updated'
    });
    setTimeout(() => setTestResult('appSettings', null), 3000);
  };

  const handleThemeToggle = () => {
    console.log('[Settings] Theme toggle clicked. Current theme:', theme);
    toggleTheme();
    // Also save to appSettings for legacy compatibility
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const newSettings = { ...appSettings, theme: newTheme };
    setAppSettings(newSettings);
    settingsService.saveAppSettings(newSettings);
    console.log('[Settings] Theme toggled to:', newTheme);
  };

  // Validation Rules
  const handleToggleValidationRule = (ruleId) => {
    const updatedRules = validationService.toggleRule(ruleId);
    setValidationRules(updatedRules);
  };

  const handleTestValidationRules = async () => {
    setLoading('validationTest', true);
    setValidationTestResults(null);
    
    try {
      const result = await validationService.testValidationRules();
      setValidationTestResults(result);
    } catch (error) {
      setValidationTestResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading('validationTest', false);
    }
  };

  const handleDebugJSON = async () => {
    setLoading('debugJSON', true);
    setDebugResults(null);
    
    try {
      const result = await validationService.debugJSONStructure();
      setDebugResults(result);
    } catch (error) {
      setDebugResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading('debugJSON', false);
    }
  };

  // Notification Settings
  const handleNotificationToggle = (setting) => {
    const updated = {
      ...notificationSettings,
      [setting]: !notificationSettings[setting]
    };
    setNotificationSettings(updated);
    notificationService.saveSettings(updated);
  };

  const handleRequestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
  };

  const handleTestNotification = () => {
    notificationService.showTestNotification();
  };

  const renderTestResult = (resultKey) => {
    const result = testResults[resultKey];
    if (!result) return null;

    // Special rendering for Salesforce with detailed test results
    if (resultKey === 'salesforce' && result.details?.tests) {
      const { details } = result;
      const bgColor = result.success ? 'bg-green-50 border-green-200' : result.warning ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
      const textColor = result.success ? 'text-green-800' : result.warning ? 'text-yellow-800' : 'text-red-800';
      
      return (
        <div className={`mt-4 rounded-lg border ${bgColor} transition-colors`}>
          {/* Summary Header */}
          <div className="p-4 border-b border-current border-opacity-20">
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : result.warning ? (
                <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${textColor}`}>
                  {result.message}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Tested {details.tests.length} components
                </p>
              </div>
            </div>
          </div>
          
          {/* Individual Test Results */}
          <div className="p-4 space-y-3">
            {details.tests.map((test, index) => (
              <div key={index} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {test.status === 'success' ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : test.status === 'warning' ? (
                        <ExclamationCircleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{test.name}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      test.status === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' :
                      test.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400' :
                      'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                    }`}>
                      {test.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">{test.message}</p>
                  
                  {/* Show details if available */}
                  {test.details && Object.keys(test.details).length > 0 && (
                    <div className="mt-2 ml-6 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs transition-colors">
                      {Object.entries(test.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1">
                          <span className="text-gray-600 dark:text-gray-400">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-gray-900 dark:text-gray-100 font-mono">{typeof value === 'object' ? JSON.stringify(value) : value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Timestamp */}
          <div className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400">
            Tested at: {new Date(details.timestamp).toLocaleString()}
          </div>
        </div>
      );
    }

    // Special rendering for web connectivity with detailed results
    if (resultKey === 'webConnectivity' && result.details?.results) {
      const { details } = result;
      const bgColor = result.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : result.partial ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      const textColor = result.success ? 'text-green-800 dark:text-green-300' : result.partial ? 'text-yellow-800 dark:text-yellow-300' : 'text-red-800 dark:text-red-300';
      
      return (
        <div className={`mt-4 rounded-lg border ${bgColor} transition-colors`}>
          {/* Summary Header */}
          <div className="p-4 border-b border-current border-opacity-20">
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : result.partial ? (
                <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${textColor}`}>
                  {result.message}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Tested {details.totalTests} endpoints • {details.successCount} successful • {details.failureCount} failed
                </p>
              </div>
            </div>
          </div>
          
          {/* Individual Results */}
          <div className="p-4 space-y-3">
            {details.results.map((endpoint, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
                <div className="flex items-center gap-3">
                  {endpoint.status === 'success' ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{endpoint.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{endpoint.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${
                    endpoint.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {endpoint.status === 'success' ? 'Connected' : 'Failed'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{endpoint.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Standard rendering for other results
    return (
      <div className={`mt-4 p-4 rounded-lg border ${
        result.success 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      } transition-colors`}>
        <div className="flex items-start gap-3">
          {result.success ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
            }`}>
              {result.message}
            </p>
            {result.error && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{result.error}</p>
            )}
            {result.details && !result.details.results && (
              <pre className="text-xs mt-2 p-2 bg-white dark:bg-gray-700 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 overflow-auto max-h-40 text-gray-900 dark:text-gray-100 transition-colors">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  };

  const enabledRulesCount = validationRules.filter(r => r.enabled).length;
  const lastUpdated = validationService.getLastUpdated();

  return (
    <div id="page-settings" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
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
                      ? 'bg-blue-600 dark:bg-blue-700 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
            
            {/* Web Connectivity */}
            {activeSection === 'web-connectivity' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Web Connectivity</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Test application's ability to reach external web resources and services
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    This test checks connectivity to multiple external endpoints including DNS services, 
                    CDN networks, and API services. Results show connection status and response times 
                    for each endpoint.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleTestWebConnectivity}
                    disabled={loadingStates.webConnectivity}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                  >
                    {loadingStates.webConnectivity ? 'Testing Connectivity...' : 'Run Connectivity Test'}
                  </button>
                  {renderTestResult('webConnectivity')}
                </div>
              </div>
            )}

            {/* Salesforce Integration */}
            {activeSection === 'salesforce' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Salesforce Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Validate Salesforce OAuth connection and API access
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                    <strong>This test validates:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 list-disc list-inside space-y-1 ml-2">
                    <li><strong>Environment Variables</strong> - Required OAuth configuration</li>
                    <li><strong>Client Credentials Flow</strong> - Server-to-server authentication setup</li>
                    <li><strong>Stored Authentication</strong> - Valid access tokens and org details</li>
                    <li><strong>API Connectivity</strong> - Live connection to Salesforce instance</li>
                  </ul>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                    💡 This integration powers the Provisioning Monitor, Expiration Monitor, Customer Products, and other core features.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleTestSalesforce}
                    disabled={loadingStates.salesforce}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                  >
                    {loadingStates.salesforce ? 'Testing Salesforce...' : 'Run Salesforce Test'}
                  </button>
                  {renderTestResult('salesforce')}
                </div>
              </div>
            )}

            {/* SML Configuration */}
            {activeSection === 'sml' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">SML Configuration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure SML (Service Management Layer) integration for product entitlements
                </p>
                
                <div className="pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Environment
                    </label>
                    <select
                      value={smlEnvironment}
                      onChange={(e) => setSmlEnvironment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    >
                      <option value="euw1">PE EUW1 (https://api-euw1.rms.com)</option>
                      <option value="use1">PE USE1 (https://api-use1.rms.com)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Select the SML environment to connect to
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bearer Token
                    </label>
                    <textarea
                      value={smlBearerToken}
                      onChange={(e) => setSmlBearerToken(e.target.value)}
                      rows={6}
                      placeholder="Paste the Bearer token value here (without 'Bearer ' prefix)..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    />
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-2 transition-colors">
                      <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                        <strong>How to get the Bearer token:</strong>
                      </p>
                      <ol className="text-xs text-blue-800 dark:text-blue-300 list-decimal list-inside space-y-1 ml-2">
                        <li>Log into the SML portal</li>
                        <li>Open Developer Tools (F12) → Network tab</li>
                        <li>Refresh the page or navigate to any data page</li>
                        <li>Click on any API request (e.g., to /sml/ or /v1/)</li>
                        <li>Find the <strong>Authorization</strong> header in Request Headers</li>
                        <li>Copy the token value AFTER "Bearer " (the long JWT string)</li>
                      </ol>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        <strong>⚠️ Note:</strong> The Bearer token expires periodically and must be refreshed.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveSMLConfig}
                      disabled={loadingStates.smlSave}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                    >
                      {loadingStates.smlSave ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <button
                      onClick={handleTestSMLConnection}
                      disabled={loadingStates.smlTest}
                      className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loadingStates.smlTest ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                  
                  {renderTestResult('smlSave')}
                  {renderTestResult('smlTest')}
                </div>
              </div>
            )}

            {/* Application Settings */}
            {activeSection === 'application' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Application Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure general application preferences and defaults
                </p>

                {/* Success Notice */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 transition-colors">
                  <div className="flex items-start gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">Auto-Refresh Now Active!</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Auto-refresh settings are now active and will work seamlessly across the application.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 space-y-6">
                  {/* General Settings */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">General</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Toggle between light and dark theme (applies to both apps)
                          </p>
                        </div>
                        <button
                          onClick={handleThemeToggle}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-2xl"
                          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                          {isDark ? '🌙' : '☀️'}
                        </button>
                      </div>

                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-medium text-gray-700">Auto-refresh Background Pages</label>
                            <p className="text-xs text-gray-500 mt-1">
                              Automatically refreshes inactive pages in both applications
                            </p>
                            <div className="mt-2 text-xs text-blue-600">
                              <strong>How it works:</strong> Refreshes data pages in the background 
                              while you're viewing other pages. Does not refresh the currently active page.
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              <strong>Affected pages:</strong> Dashboard, Analytics (Overview, Account History, Package Changes), 
                              Provisioning Monitor, Expiration Monitor, Ghost Accounts, Customer Products, PS Audit Trail
                            </div>
                            <div className="mt-2 text-xs font-medium text-green-600">
                              ✓ Currently active: {contextInterval === 0 ? 'Disabled' : `${contextInterval} minute${contextInterval !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                          <select
                            value={appSettings.autoRefreshInterval || 5}
                            onChange={(e) => setAppSettings({ ...appSettings, autoRefreshInterval: parseInt(e.target.value) })}
                            className="w-[140px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                          >
                            <option value="0">Never</option>
                            <option value="1">1 minute</option>
                            <option value="5">5 minutes</option>
                            <option value="10">10 minutes</option>
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Defaults Section */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-900">Page Defaults</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-green-800 font-medium">
                        ✓ These settings now work in the React app! Each page loads with your configured defaults.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Analytics Time Frame</label>
                          <p className="text-xs text-gray-500">Default for Analytics Overview page (Request Types & Validation Trend)</p>
                        </div>
                        <select
                          value={appSettings.defaultAnalyticsTimeframe || 12}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultAnalyticsTimeframe: parseInt(e.target.value) })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="1">1 month</option>
                          <option value="3">3 months</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Expiration Monitor Time Frame</label>
                          <p className="text-xs text-gray-500">Default for Expiration Monitor page - how far ahead to check</p>
                        </div>
                        <select
                          value={appSettings.defaultExpirationTimeframe || 90}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultExpirationTimeframe: parseInt(e.target.value) })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="30">30 days</option>
                          <option value="60">60 days</option>
                          <option value="90">90 days</option>
                          <option value="120">120 days</option>
                          <option value="180">180 days</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Package Changes Time Frame</label>
                          <p className="text-xs text-gray-500">Default for Package Changes Analytics page - lookback period</p>
                        </div>
                        <select
                          value={appSettings.defaultPackageChangesTimeframe || 30}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultPackageChangesTimeframe: parseInt(e.target.value) })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="7">7 days</option>
                          <option value="14">14 days</option>
                          <option value="30">30 days</option>
                          <option value="60">60 days</option>
                          <option value="90">90 days</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Widgets Section */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-900">Dashboard Widget Defaults</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-green-800 font-medium">
                        ✓ These settings now work in the React app! Each widget loads with your configured defaults.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Data Validation Widget</label>
                          <p className="text-xs text-gray-500">Default for Dashboard validation widget</p>
                        </div>
                        <select
                          value={appSettings.defaultDashboardValidationTimeframe || '1w'}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultDashboardValidationTimeframe: e.target.value })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="1d">1 Day</option>
                          <option value="1w">1 Week</option>
                          <option value="1m">1 Month</option>
                          <option value="1y">1 Year</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Product Removals Widget</label>
                          <p className="text-xs text-gray-500">Default for Dashboard removals widget</p>
                        </div>
                        <select
                          value={appSettings.defaultDashboardRemovalsTimeframe || '1w'}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultDashboardRemovalsTimeframe: e.target.value })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="1d">1 Day</option>
                          <option value="1w">1 Week</option>
                          <option value="1m">1 Month</option>
                          <option value="1y">1 Year</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Expiration Monitor Widget</label>
                          <p className="text-xs text-gray-500">Default for Dashboard expiration widget</p>
                        </div>
                        <select
                          value={appSettings.defaultDashboardExpirationWindow || 7}
                          onChange={(e) => setAppSettings({ ...appSettings, defaultDashboardExpirationWindow: parseInt(e.target.value) })}
                          className="w-[180px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-colors"
                        >
                          <option value="7">7 Days</option>
                          <option value="30">30 Days</option>
                          <option value="60">60 Days</option>
                          <option value="90">90 Days</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <button
                      onClick={handleSaveDefaults}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      💾 Save All Settings
                    </button>
                  </div>
                  
                  {renderTestResult('appSettings')}
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notification Preferences</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure how you receive notifications for new PS requests
                </p>
                
                <div className="pt-4 space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
                    <div className="flex items-start gap-3">
                      <ExclamationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Real-time Notification Monitoring</p>
                        <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
                          System checks for new PS requests every 60 seconds and notifies you instantly.
                        </p>
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-2">
                          Status: Active
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.inBrowserEnabled}
                      onChange={() => handleNotificationToggle('inBrowserEnabled')}
                      className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">In-Browser Notifications</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Show notification toasts in the application</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.desktopEnabled}
                      onChange={() => handleNotificationToggle('desktopEnabled')}
                      className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Desktop Notifications</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Show native OS notifications {notificationPermission !== 'granted' && '(Permission required)'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.soundEnabled}
                      onChange={() => handleNotificationToggle('soundEnabled')}
                      className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sound Alerts</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Play a sound when new requests are detected</p>
                    </div>
                  </label>

                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleRequestNotificationPermission}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
                      >
                        Enable Desktop Notifications
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Click to request permission for desktop notifications from your browser.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleTestNotification}
                      className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
                    >
                      Send Test Notification
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Send a test notification to verify your settings are working correctly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Rules */}
            {activeSection === 'validation' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Data Validation Rules</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure validation rules for Technical Team Request records
                </p>
                
                <div className="pt-4 space-y-4">
                  {/* Background Processing Info */}
                  {validationRules.some(r => r.isBackgroundRule && r.enabled) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <ExclamationCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Background Processing Active</h4>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            Some validation rules run asynchronously in the background (every 10 minutes). 
                            Results are stored in the database and displayed in the Provisioning Monitor. 
                            The "Test Rules" button will test synchronous rules only.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTestValidationRules}
                      disabled={loadingStates.validationTest}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 text-sm"
                    >
                      {loadingStates.validationTest ? 'Testing...' : 'Test Rules'}
                    </button>
                    <button
                      onClick={handleDebugJSON}
                      disabled={loadingStates.debugJSON}
                      className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm"
                    >
                      {loadingStates.debugJSON ? 'Loading...' : 'Debug JSON'}
                  </button>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Test the enabled validation rules against recent PS records. Background rules are tested separately by the scheduled task.
                  </p>

                  {/* Rules Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Rules</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{validationRules.length}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Enabled Rules</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{enabledRulesCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Updated</div>
                      <div className="text-xs text-gray-900 dark:text-gray-100 mt-2">
                        {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
                      </div>
                    </div>
                  </div>

                  {/* Validation Rules List */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Validation Rules</h3>
                    <div className="space-y-3">
                      {validationRules.map((rule) => (
                        <div key={rule.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rule.name}</h4>
                                {rule.async && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                    Async
                                  </span>
                                )}
                                {rule.requiresSML && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    SML
                                  </span>
                                )}
                                {rule.isBackgroundRule && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                    Background
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{rule.description}</p>
                              {rule.isBackgroundRule && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                                  <ExclamationCircleIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>Results processed in background every 10 minutes. Use "Test Rules" to simulate with sample data.</span>
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Category: {rule.category}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Version: {rule.version}</span>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={rule.enabled}
                                onChange={() => handleToggleValidationRule(rule.id)}
                              />
                              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Test Results */}
                  {validationTestResults && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Test Results</h3>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                        <pre className="text-xs overflow-auto max-h-96 text-gray-900 dark:text-gray-100">
                          {JSON.stringify(validationTestResults, null, 2)}
                        </pre>
                </div>
              </div>
            )}

                  {/* Debug Results */}
                  {debugResults && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">JSON Structure Analysis</h3>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                        <pre className="text-xs overflow-auto max-h-96 text-gray-900 dark:text-gray-100">
                          {JSON.stringify(debugResults, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
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
