import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ReportRenderer from '../components/reports/ReportRenderer';
import { sendMessage, getCapabilities } from '../services/reportAgentService';
import { createReport, updateReport, getReport } from '../services/customReportService';

const CreateReport = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isEditMode = !!slug;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);

  const [proposedConfig, setProposedConfig] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const [editReportId, setEditReportId] = useState(null);
  const [editLoading, setEditLoading] = useState(isEditMode);

  const llmAvailable = capabilities?.llmAvailable ?? false;

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        const data = await getCapabilities();
        setCapabilities(data.capabilities);
      } catch (err) {
        console.error('Failed to load capabilities:', err);
      } finally {
        setCapabilitiesLoading(false);
      }
    };
    loadCapabilities();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    const loadExistingReport = async () => {
      setEditLoading(true);
      try {
        const result = await getReport(slug);
        if (result.success && result.report) {
          const r = result.report;
          setEditReportId(r.id);
          setReportName(r.name);
          setReportDescription(r.description || '');
          setProposedConfig(r.report_config);

          if (r.conversation_history && Array.isArray(r.conversation_history)) {
            setMessages(r.conversation_history.map(m => ({
              ...m,
              timestamp: m.timestamp || new Date().toISOString()
            })));
          } else {
            setMessages([{
              role: 'assistant',
              content: `Editing report "${r.name}". The current configuration is loaded in the preview. You can modify it via chat or save your changes.`,
              timestamp: new Date().toISOString()
            }]);
          }
        }
      } catch (err) {
        console.error('Failed to load report for editing:', err);
        setMessages([{
          role: 'assistant',
          content: 'Failed to load the report for editing. Please go back and try again.',
          timestamp: new Date().toISOString(),
          isError: true
        }]);
      } finally {
        setEditLoading(false);
      }
    };
    loadExistingReport();
  }, [slug, isEditMode]);

  useEffect(() => {
    const imported = location.state?.importedConfig;
    if (imported && !isEditMode) {
      setProposedConfig(imported);
      if (!reportName) setReportName(imported.title || '');
      if (!reportDescription && imported.description) setReportDescription(imported.description);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Imported report "${imported.title}" with ${imported.components?.length || 0} component${imported.components?.length !== 1 ? 's' : ''}. Preview is on the right \u2013 click "Save Report" when ready.`,
        timestamp: new Date().toISOString()
      }]);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (capabilities && messages.length === 0 && !isEditMode) {
      setMessages([{
        role: 'assistant',
        content: buildWelcomeMessage(capabilities),
        timestamp: new Date().toISOString()
      }]);
    }
  }, [capabilities, messages.length, isEditMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const result = await sendMessage({ message: text, conversationHistory: history });

      const response = result.response;
      let assistantContent = response.message;

      if (response.type === 'config_proposed' && response.proposedConfig) {
        setProposedConfig(response.proposedConfig);
      } else if (response.type === 'config_valid' && response.validatedConfig) {
        setProposedConfig(response.validatedConfig);
        assistantContent = 'The report configuration is valid. You can preview it on the right and save it when ready.';
      } else if (response.type === 'config_invalid') {
        const errorList = response.errors?.map(e => `- ${e.path}: ${e.message}`).join('\n') || '';
        assistantContent = `The configuration has validation errors:\n${errorList}`;
      }

      if (response.metadata?.availableCategories && !llmAvailable) {
        assistantContent += `\n\nAvailable data categories: ${response.metadata.availableCategories.join(', ')}`;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      const errorDetail = err.response?.data?.error || err.message;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorDetail}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, messages, llmAvailable]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveReport = async () => {
    if (!reportName.trim() || !proposedConfig) return;
    setSavingReport(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      if (isEditMode && editReportId) {
        const result = await updateReport(editReportId, {
          name: reportName.trim(),
          description: reportDescription.trim(),
          reportConfig: proposedConfig,
          conversationHistory: history
        });
        if (result.success) {
          navigate(`/custom-reports/${result.report.slug}`);
        }
      } else {
        const result = await createReport({
          name: reportName.trim(),
          description: reportDescription.trim(),
          reportConfig: proposedConfig,
          conversationHistory: history
        });
        if (result.success) {
          navigate(`/custom-reports/${result.report.slug}`);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Failed to save report: ${err.response?.data?.error || err.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setSavingReport(false);
    }
  };

  const handleExportCsv = () => {
    if (!proposedConfig) return;
    const configStr = JSON.stringify(proposedConfig, null, 2);
    const blob = new Blob([configStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName || proposedConfig.title || 'report'}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Please select a .json file exported from the Report Builder.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);

        if (!config.title || !Array.isArray(config.components) || config.components.length === 0) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'The imported file does not appear to be a valid report configuration. It must contain at least a "title" and a non-empty "components" array.',
            timestamp: new Date().toISOString(),
            isError: true
          }]);
          return;
        }

        setProposedConfig(config);
        if (!reportName) setReportName(config.title);
        if (!reportDescription && config.description) setReportDescription(config.description);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Imported report "${config.title}" with ${config.components.length} component${config.components.length !== 1 ? 's' : ''}. You can preview it on the right and save it when ready.`,
          timestamp: new Date().toISOString()
        }]);
      } catch {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Failed to parse the file. Please make sure it is a valid JSON file.',
          timestamp: new Date().toISOString(),
          isError: true
        }]);
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  };

  const handleLoadSample = () => {
    const sampleConfig = {
      title: 'Package Changes Overview',
      description: 'Summary of product package upgrades and downgrades across customer accounts',
      layout: 'grid',
      refreshInterval: 0,
      filters: [],
      components: [
        {
          id: 'total-changes',
          type: 'kpi-card',
          title: 'Total Changes',
          gridSpan: 1,
          dataSource: { endpoint: '/api/analytics/package-changes/summary', params: {} },
          valueField: 'summary.total_changes',
          format: 'number'
        },
        {
          id: 'total-upgrades',
          type: 'kpi-card',
          title: 'Upgrades',
          gridSpan: 1,
          dataSource: { endpoint: '/api/analytics/package-changes/summary', params: {} },
          valueField: 'summary.total_upgrades',
          format: 'number'
        },
        {
          id: 'accounts-affected',
          type: 'kpi-card',
          title: 'Accounts Affected',
          gridSpan: 1,
          dataSource: { endpoint: '/api/analytics/package-changes/summary', params: {} },
          valueField: 'summary.accounts_affected',
          format: 'number'
        },
        {
          id: 'changes-by-product',
          type: 'bar-chart',
          title: 'Changes by Product',
          gridSpan: 2,
          dataSource: { endpoint: '/api/analytics/package-changes/by-product', params: { limit: 10 } },
          xField: 'product_name',
          yField: 'total_changes',
          colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        },
        {
          id: 'downgrades-kpi',
          type: 'kpi-card',
          title: 'Downgrades',
          gridSpan: 1,
          dataSource: { endpoint: '/api/analytics/package-changes/summary', params: {} },
          valueField: 'summary.total_downgrades',
          format: 'number'
        },
        {
          id: 'recent-changes',
          type: 'data-table',
          title: 'Recent Package Changes',
          gridSpan: 3,
          dataSource: { endpoint: '/api/analytics/package-changes/recent', params: { limit: 20 } },
          columns: [
            { field: 'account_name', header: 'Account' },
            { field: 'product_name', header: 'Product' },
            { field: 'change_type', header: 'Type' },
            { field: 'previous_package', header: 'From' },
            { field: 'new_package', header: 'To' },
            { field: 'ps_created_date', header: 'Date', format: 'date' }
          ],
          pageSize: 10,
          searchable: true
        }
      ]
    };

    setProposedConfig(sampleConfig);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'I\'ve loaded a sample report configuration showing Package Changes data. You can see the preview on the right. Click "Save Report" when you\'re ready.',
      timestamp: new Date().toISOString()
    }]);
  };

  if (editLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner message="Loading report for editing..." />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isEditMode ? 'Edit Report' : 'Report Builder'}
            </h2>
            {!capabilitiesLoading && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                llmAvailable
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
              }`}>
                {llmAvailable ? 'AI Active' : 'Sample Only'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              title="Import a report configuration JSON file"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5" />
              Import
            </button>
            {!isEditMode && (
              <button
                onClick={handleLoadSample}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Load Sample
              </button>
            )}
            <button
              onClick={() => { setMessages([]); setProposedConfig(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowPathIcon className="h-3.5 w-3.5 inline mr-1" />
              Reset
            </button>
          </div>
        </div>

        {/* No-LLM banner */}
        {!capabilitiesLoading && !llmAvailable && !isEditMode && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
            <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              AI chat is unavailable (no API key). Use <strong>Load Sample</strong> to explore a pre-built report, or set <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">OPENAI_API_KEY</code> to enable AI-driven building.
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {capabilitiesLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner message="Loading agent capabilities..." />
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.isError
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={llmAvailable
                ? (isEditMode ? 'Describe how you\'d like to change this report...' : 'Describe the report you\'d like to create...')
                : 'AI chat unavailable \u2013 use "Load Sample" above, or set an API key'}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="self-end px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-1/2 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Preview</h2>
          </div>
          <div className="flex gap-2">
            {proposedConfig && (
              <>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Export report configuration as JSON"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  Export
                </button>
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition-colors"
                >
                  <CheckIcon className="h-4 w-4" />
                  {isEditMode ? 'Update Report' : 'Save Report'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {proposedConfig ? (
            <ReportRenderer config={proposedConfig} showTitle={true} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-3">
              <DocumentTextIcon className="h-12 w-12" />
              <p className="text-sm">Report preview will appear here</p>
              <p className="text-xs">
                {llmAvailable
                  ? 'Describe your report in the chat or load a sample'
                  : 'Click "Load Sample" to preview a pre-built report'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save / Update Modal */}
      {showSaveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isEditMode ? 'Update Report' : 'Save Report'}
              </h3>
              <button onClick={() => setShowSaveForm(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder="e.g., Weekly Provisioning Summary"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={reportDescription}
                  onChange={e => setReportDescription(e.target.value)}
                  placeholder="Brief description of this report..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {isEditMode && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Saving will create a new version of this report.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowSaveForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReport}
                  disabled={!reportName.trim() || savingReport}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingReport ? <LoadingSpinner size="sm" message="" /> : <CheckIcon className="h-4 w-4" />}
                  {savingReport ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function buildWelcomeMessage(capabilities) {
  if (!capabilities) return 'Welcome to the Report Builder. Describe the report you\'d like to create.';

  const cats = capabilities.dataCategories?.map(c => c.category).join(', ') || 'various sources';
  const types = capabilities.componentTypes?.map(t => t.description).join(', ') || 'charts and tables';

  const lines = [
    'Welcome to the Report Builder!',
    '',
    `I have access to data from: ${cats}.`,
    '',
    `Available visualizations: ${types}.`,
    '',
  ];

  if (capabilities.llmAvailable) {
    lines.push(
      'Describe the report you\'d like to see and I\'ll generate it for you. You can also click "Load Sample" to explore a pre-built example.',
    );
  } else {
    lines.push(
      'AI-driven chat is not currently active (no API key configured).',
      '',
      'You can still explore reports by clicking the "Load Sample" button above to load a pre-built report, preview it, and save it.',
      '',
      'To enable conversational report building, set the OPENAI_API_KEY environment variable and restart the server.',
    );
  }

  return lines.join('\n');
}

export default CreateReport;
