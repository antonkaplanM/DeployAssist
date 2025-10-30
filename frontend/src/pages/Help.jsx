import React, { useState } from 'react';
import { 
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';

const Help = () => {
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedWorkflow, setExpandedWorkflow] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const toggleWorkflow = (workflow) => {
    setExpandedWorkflow(expandedWorkflow === workflow ? null : workflow);
  };

  const workflows = [
    {
      id: 'monitor-requests',
      title: 'Monitor Provisioning Requests',
      icon: MagnifyingGlassIcon,
      color: 'blue',
      steps: [
        {
          step: '1',
          title: 'Navigate to Provisioning Monitor',
          description: 'Click "Provisioning Monitor" in the sidebar or go to Provisioning → Monitor',
        },
        {
          step: '2',
          title: 'Search for Requests',
          description: 'Use the type-ahead search to find specific Technical Team Requests or Accounts. Search supports PS-IDs (e.g., PS-1234) and account names.',
        },
        {
          step: '3',
          title: 'Apply Filters',
          description: 'Use the filter dropdowns to narrow results by Request Type, Status, or other criteria.',
        },
        {
          step: '4',
          title: 'View Details',
          description: 'Click the expand arrow on any request to see full details including product entitlements, validation status, and metadata.',
        },
        {
          step: '5',
          title: 'Check Validation',
          description: 'Review the "Data Validations" column for compliance status. Red badges indicate validation failures.',
        },
      ],
      tips: [
        'Click column headers to sort data',
        'Use the export button to download filtered results',
        'Click product group badges (e.g., "2 Data, 1 App") to see individual product details',
        'The Actions menu (⋮) provides quick access to Audit Trail and other features',
      ],
    },
    {
      id: 'refresh-sml-data',
      title: 'Refresh SML Data for Deprovision Requests',
      icon: CloudArrowDownIcon,
      color: 'amber',
      steps: [
        {
          step: '1',
          title: 'Navigate to Provisioning Monitor',
          description: 'Go to Provisioning → Monitor from the sidebar',
        },
        {
          step: '2',
          title: 'Click Refresh SML Data Button',
          description: 'Find the amber "Refresh SML Data" button in the action buttons section at the top of the page.',
        },
        {
          step: '3',
          title: 'Confirm Refresh',
          description: 'Click "OK" in the confirmation dialog. The process will fetch fresh entitlement data from SML for all Deprovision requests.',
        },
        {
          step: '4',
          title: 'Wait for Background Processing',
          description: 'The refresh runs in the background and takes ~8-10 minutes to process all Deprovision records. You can continue using the application.',
        },
        {
          step: '5',
          title: 'Refresh Page to See Results',
          description: 'After a few minutes, refresh the Provisioning Monitor page to see updated entitlements in the Products column with +X★ indicators.',
        },
      ],
      tips: [
        'SML entitlements show with a amber ★ badge to distinguish them from payload data',
        'The refresh is manual to give you control over when to fetch fresh data',
        'All entitlements (including expired) are displayed for Deprovision requests',
        'Click product buttons to see detailed entitlement information in a modal',
      ],
    },
    {
      id: 'track-expirations',
      title: 'Track Product Expirations',
      icon: ClockIcon,
      color: 'amber',
      steps: [
        {
          step: '1',
          title: 'Open Expiration Monitor',
          description: 'Navigate to Provisioning → Expiration Monitor from the sidebar',
        },
        {
          step: '2',
          title: 'Run Analysis',
          description: 'Click "Refresh Analysis" to analyze the last 5 years of PS records. This takes 10-30 seconds.',
        },
        {
          step: '3',
          title: 'Select Time Window',
          description: 'Use the dropdown to filter by expiration window: 7, 30, 60, or 90 days.',
        },
        {
          step: '4',
          title: 'Review At-Risk Products',
          description: 'Focus on items with red badges (no extension found). Extended items show in blue/green/purple.',
        },
        {
          step: '5',
          title: 'View Details',
          description: 'Click "View Details" to see product-by-product breakdown with extension information.',
        },
        {
          step: '6',
          title: 'Take Action',
          description: 'Click "Monitor" button to view the full PS record in Provisioning Monitor with exact match filtering.',
        },
      ],
      tips: [
        'The system automatically filters out products that were intentionally removed (~21% reduction in noise)',
        'Products with multiple end dates use the latest date automatically',
        'Run "Refresh Analysis" daily or weekly for up-to-date data',
        'Use 30-day window for proactive planning, 7-day for urgent expirations',
      ],
    },
    {
      id: 'view-account-history',
      title: 'View Account History',
      icon: ChartBarIcon,
      color: 'green',
      steps: [
        {
          step: '1',
          title: 'Navigate to Account History',
          description: 'Go to Analytics → Account History from the sidebar',
        },
        {
          step: '2',
          title: 'Search for Account',
          description: 'Type account name or PS-ID in the search box. Results appear as you type (2+ characters).',
        },
        {
          step: '3',
          title: 'Select Account',
          description: 'Click on the desired account or PS-ID from the search results.',
        },
        {
          step: '4',
          title: 'Review Timeline',
          description: 'View chronological history of all PS requests for the account. Use filters to narrow by deployment or limit.',
        },
        {
          step: '5',
          title: 'Compare Requests',
          description: 'Select 2+ requests using checkboxes, then click "View Side-by-Side" to compare product changes.',
        },
        {
          step: '6',
          title: 'View Request Details',
          description: 'Click the expand button on any request to see full product entitlements and request information.',
        },
      ],
      tips: [
        'Use the deployment filter to focus on specific environments',
        'Show/hide product changes toggle reveals what changed between requests',
        'You can search by PS-ID to jump directly to an account',
        'The comparison view highlights additions, removals, and modifications',
      ],
    },
    {
      id: 'view-customer-products',
      title: 'View Customer Products',
      icon: UserGroupIcon,
      color: 'purple',
      steps: [
        {
          step: '1',
          title: 'Navigate to Customer Products',
          description: 'Click "Customer Products" in the sidebar',
        },
        {
          step: '2',
          title: 'Search for Account',
          description: 'Use the type-ahead search to find an account. Start typing the account name (2+ characters).',
        },
        {
          step: '3',
          title: 'View Summary',
          description: 'See total active products broken down by category (Models, Data, Apps).',
        },
        {
          step: '4',
          title: 'Browse by Region',
          description: 'Products are organized by region. Expand/collapse regions to focus on specific areas.',
        },
        {
          step: '5',
          title: 'Check Expiration Status',
          description: 'Review days remaining for each product. Color-coded badges indicate expiration proximity.',
        },
        {
          step: '6',
          title: 'View Account History',
          description: 'Click "View Account History" to see the full timeline of PS requests for this account.',
        },
      ],
      tips: [
        'Products are organized by region for easy geographic analysis',
        'Each product shows source PS record(s) for traceability',
        'Use the clear button to start a new search',
        'Data is real-time from the latest PS records',
      ],
    },
    {
      id: 'audit-trail',
      title: 'Review PS Audit Trail',
      icon: ShieldCheckIcon,
      color: 'indigo',
      steps: [
        {
          step: '1',
          title: 'Access Audit Trail',
          description: 'Two ways: (1) Provisioning → Audit Trail, or (2) Click Actions (⋮) on any PS record → "Audit Trail"',
        },
        {
          step: '2',
          title: 'Search for PS Record',
          description: 'Enter the PS record name (e.g., PS-12345) or Salesforce ID',
        },
        {
          step: '3',
          title: 'Review Timeline',
          description: 'See all captured snapshots with timestamps, status changes, and transitions.',
        },
        {
          step: '4',
          title: 'Analyze Status Changes',
          description: 'Review how the record progressed through different statuses over time.',
        },
        {
          step: '5',
          title: 'Check Processing Times',
          description: 'View time spent in each status to identify bottlenecks or delays.',
        },
      ],
      tips: [
        'Snapshots are captured automatically every 5 minutes',
        'Complete audit trail maintained for compliance',
        'Use Quick Access from Provisioning Monitor for faster lookup',
        'Timeline shows exact date and time of each status change',
      ],
    },
  ];

  const features = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: ChartBarIcon,
      description: 'Your central hub for monitoring system health and validation status',
      content: (
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold mb-2">Data Validation Monitor</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time validation status for Professional Services records. Use the time frame selector (1d/1w/1m/1y) to adjust the monitoring period.
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-4 list-disc space-y-1">
              <li><strong>Green status:</strong> All records pass validation</li>
              <li><strong>Red status:</strong> Validation failures detected</li>
              <li><strong>Click "View Record"</strong> to navigate to specific PS records</li>
            </ul>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold mb-2">Expiration Widget</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quick view of products expiring in the next 7, 30, 60, or 90 days. Shows extended vs. at-risk products.
            </p>
          </div>
          
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold mb-2">API Status</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Shows current status of server connectivity and API responses.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'validation-rules',
      title: 'Validation Rules',
      icon: ShieldCheckIcon,
      description: 'Automated data quality checks for PS records',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Validation rules automatically check PS records for common data quality issues. Configure rules in Settings → Data Validation Rules.
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-3">Available Validation Rules:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <div>
                  <strong>App Quantity Validation:</strong> Ensures apps have quantity=1 (except IC-DATABRIDGE and RI-RISKMODELER-EXPANSION)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <div>
                  <strong>Model Count Validation:</strong> Checks that model entitlements don't exceed 100
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <div>
                  <strong>Date Overlap Validation:</strong> Detects overlapping date ranges for the same product
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <div>
                  <strong>Date Gap Validation:</strong> Identifies gaps between entitlement periods
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <div>
                  <strong>Package Name Validation:</strong> Ensures apps have valid package names
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How to Use:</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>View validation status in Provisioning Monitor's "Data Validations" column</li>
              <li>Click validation badges to see detailed failure information</li>
              <li>Enable/disable specific rules in Settings</li>
              <li>Monitor overall validation health on Dashboard</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'authentication',
      title: 'Authentication & Users',
      icon: ShieldCheckIcon,
      description: 'User management and access control',
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Logging In</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>Navigate to the application (redirects to login if not authenticated)</li>
              <li>Enter your username and password</li>
              <li>Optionally check "Remember me" for 30-day session</li>
              <li>Click "Sign In"</li>
            </ol>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Session Management</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>Session Duration:</strong> Maximum 24 hours</p>
              <p><strong>Inactivity Timeout:</strong> 60 minutes</p>
              <p><strong>Remember Me:</strong> Extends session to 30 days</p>
              <p><strong>Logout:</strong> Click user menu → "Sign Out"</p>
            </div>
          </div>
          
          <div className="border-l-4 border-indigo-500 pl-4">
            <h4 className="font-semibold mb-2">User Management (Admin Only)</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• <strong>Access:</strong> Navigate to User Management (admin only)</li>
              <li>• <strong>Create Users:</strong> Click "+ Create User", assign roles</li>
              <li>• <strong>Edit Users:</strong> Modify user details and roles</li>
              <li>• <strong>Change Passwords:</strong> Admins can reset any password</li>
              <li>• <strong>Activate/Deactivate:</strong> Toggle user status</li>
            </ul>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold mb-2">Role-Based Access</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• <strong>Admin Role:</strong> Full access to all pages and user management</li>
              <li>• <strong>User Role:</strong> Standard access (no user management)</li>
              <li>• <strong>Custom Roles:</strong> Create roles with specific page permissions</li>
              <li>• <strong>Multiple Roles:</strong> Users can have multiple roles (permissions combine)</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Account Locked?</h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
              After 5 failed login attempts, your account is locked for 15 minutes.
            </p>
            <ul className="text-sm text-yellow-800 dark:text-yellow-300 list-disc list-inside space-y-1">
              <li>Wait 15 minutes for automatic unlock</li>
              <li>Contact administrator for immediate unlock</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: Cog6ToothIcon,
      description: 'Configure application preferences and integrations',
      content: (
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold mb-2">Salesforce Integration</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure authentication credentials for Salesforce connectivity. Test the connection to ensure all integrations are working.
            </p>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold mb-2">Data Validation Rules</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enable/disable specific validation rules. Toggle individual rules on or off based on your data quality requirements.
            </p>
          </div>
          
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold mb-2">Application Settings</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure auto-refresh intervals for background pages (default: 5 minutes). This keeps data fresh without manual refreshes.
            </p>
          </div>
          
          <div className="border-l-4 border-amber-500 pl-4">
            <h4 className="font-semibold mb-2">Theme</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Toggle between light and dark mode using the theme switcher in the header.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <QuestionMarkCircleIcon className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Help & User Guide
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Complete guide to using the Deployment Assistant
          </p>
        </header>

        {/* Getting Started */}
        <section className="mb-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <RocketLaunchIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Getting Started
            </h2>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Welcome to the Deployment Assistant! This application helps you manage and monitor Professional Services requests, 
            track deployment progress, and maintain data quality through validation rules.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">First Time Setup</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300">
              <li>Navigate to <strong>Settings</strong> to configure Salesforce authentication</li>
              <li>Test connectivity to ensure all integrations are working</li>
              <li>In <strong>Settings</strong>, configure <strong>Data Validation Rules</strong></li>
              <li>Configure <strong>Auto-refresh</strong> settings (default: 5 minutes)</li>
              <li>Explore the <strong>Dashboard</strong> for an overview of system status</li>
            </ol>
          </div>
        </section>

        {/* Common Workflows */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <LightBulbIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Common Workflows
            </h2>
          </div>
          
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div 
                key={workflow.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${workflow.color}-100 dark:bg-${workflow.color}-900/20`}>
                      <workflow.icon className={`h-6 w-6 text-${workflow.color}-600 dark:text-${workflow.color}-400`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {workflow.title}
                    </h3>
                  </div>
                  {expandedWorkflow === workflow.id ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                  )}
                </button>
                
                {expandedWorkflow === workflow.id && (
                  <div className="px-6 pb-6 border-t dark:border-gray-700">
                    <div className="mt-4 space-y-4">
                      {workflow.steps.map((step) => (
                        <div key={step.step} className="flex gap-4">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-${workflow.color}-600 dark:bg-${workflow.color}-500 flex items-center justify-center text-white font-bold text-sm`}>
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              {step.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {workflow.tips && workflow.tips.length > 0 && (
                      <div className={`mt-6 bg-${workflow.color}-50 dark:bg-${workflow.color}-900/20 border border-${workflow.color}-200 dark:border-${workflow.color}-800 rounded-lg p-4`}>
                        <h4 className={`font-semibold text-${workflow.color}-900 dark:text-${workflow.color}-300 mb-2`}>
                          💡 Pro Tips
                        </h4>
                        <ul className={`space-y-1 text-sm text-${workflow.color}-800 dark:text-${workflow.color}-300`}>
                          {workflow.tips.map((tip, index) => (
                            <li key={index}>• {tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Features Reference */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Features Reference
          </h2>
          
          <div className="space-y-4">
            {features.map((feature) => (
              <div 
                key={feature.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(feature.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <feature.icon className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  {expandedSection === feature.id ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                
                {expandedSection === feature.id && (
                  <div className="px-6 pb-6 border-t dark:border-gray-700">
                    <div className="mt-4">
                      {feature.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Quick Tips */}
        <section className="mb-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            💡 Quick Tips
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> to submit search forms</li>
                <li>• Use arrow keys in dropdowns for navigation</li>
                <li>• <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> closes modals and dropdowns</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Data Refresh</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Dashboard auto-refreshes every 5 minutes</li>
                <li>• Click refresh buttons for on-demand updates</li>
                <li>• Expiration analysis takes 10-30 seconds</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Search Tips</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Search requires minimum 2 characters</li>
                <li>• Type-ahead shows results as you type</li>
                <li>• Search supports partial matches</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Performance</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Export large datasets for offline analysis</li>
                <li>• Use filters to narrow results</li>
                <li>• Limit result sets for faster loading</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🔧 Troubleshooting
          </h2>
          <div className="space-y-4">
            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Connection Issues
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If you see connection errors, check Settings → Salesforce Integration to verify credentials and test connectivity.
              </p>
            </div>
            
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Search Not Working
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ensure you're typing at least 2 characters. Wait a moment for type-ahead results to load (debounced 300ms).
              </p>
            </div>
            
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Data Not Refreshing
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click the refresh button on the page. For Expiration Monitor, run "Refresh Analysis" to update cached data.
              </p>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Session Expired
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sessions expire after 60 minutes of inactivity. Simply log in again. Check "Remember me" for 30-day sessions.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Need more help? Contact your administrator or refer to the Technical Documentation.</p>
        </footer>
      </div>
    </div>
  );
};

export default Help;

