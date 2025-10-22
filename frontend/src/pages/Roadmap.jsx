import React, { useState, useEffect } from 'react';
import { MapIcon, UserIcon, ArrowPathIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Roadmap = () => {
  const [assigneeName, setAssigneeName] = useState('Kevin Yu');
  const [initiatives, setInitiatives] = useState([]);
  const [filteredInitiatives, setFilteredInitiatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [lastRefresh, setLastRefresh] = useState(null);

  // Load initiatives on component mount
  useEffect(() => {
    loadInitiatives('Kevin Yu');
  }, []);

  // Filter and search initiatives
  useEffect(() => {
    let filtered = [...initiatives];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (initiative) =>
          initiative.key.toLowerCase().includes(term) ||
          initiative.summary.toLowerCase().includes(term) ||
          (initiative.description && initiative.description.toLowerCase().includes(term)) ||
          initiative.status.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((initiative) => initiative.status === statusFilter);
    }

    setFilteredInitiatives(filtered);
  }, [initiatives, searchTerm, statusFilter]);

  const loadInitiatives = async (name) => {
    if (!name || !name.trim()) {
      setError('Please enter an assignee name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jira/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeName: name }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.issues && data.issues.length > 0) {
          setInitiatives(data.issues);
          setFilteredInitiatives(data.issues);
          setLastRefresh(new Date().toLocaleString());
        } else {
          setInitiatives([]);
          setFilteredInitiatives([]);
          setError(`No initiatives found for ${name}`);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch initiatives');
      }
    } catch (err) {
      console.error('Error fetching initiatives:', err);
      setError('Failed to connect to Jira. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadInitiatives = () => {
    loadInitiatives(assigneeName);
  };

  const handleRefresh = () => {
    setSearchTerm('');
    setStatusFilter('');
    loadInitiatives(assigneeName);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    const sorted = [...filteredInitiatives].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (key === 'created' || key === 'updated') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredInitiatives(sorted);
    setSortConfig({ key, direction });
  };

  const getDescriptionText = (description) => {
    // Handle Atlassian Document Format (ADF) objects
    if (description && typeof description === 'object' && description.content) {
      // Extract text from ADF format
      return extractTextFromADF(description);
    }
    return description || '';
  };

  const extractTextFromADF = (adf) => {
    // Simple text extraction from Atlassian Document Format
    if (!adf || !adf.content) return '';
    
    let text = '';
    const extractFromNode = (node) => {
      if (node.text) {
        text += node.text + ' ';
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(extractFromNode);
      }
    };
    
    adf.content.forEach(extractFromNode);
    return text.trim();
  };

  const handleExport = () => {
    try {
      const headers = ['Key', 'Summary', 'Status', 'Created', 'Updated', 'Description'];
      const csvRows = [headers.join(',')];

      filteredInitiatives.forEach((item) => {
        const descriptionText = getDescriptionText(item.description);
        const row = [
          `"${item.key}"`,
          `"${item.summary.replace(/"/g, '""')}"`,
          `"${item.status}"`,
          `"${new Date(item.created).toLocaleDateString()}"`,
          `"${new Date(item.updated).toLocaleDateString()}"`,
          `"${descriptionText.replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `roadmap_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'proposed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'committed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'open':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'in progress':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'done':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MapIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Platform Roadmap
          </h1>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-gray-600 dark:text-gray-400">
            Strategic initiatives to enhance the platform product
          </p>
          {lastRefresh && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Last refreshed: {lastRefresh}</span>
            </div>
          )}
        </div>
      </header>

      {/* Controls Section */}
      <section className="mb-6 space-y-4">
        {/* Assignee Input Section */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLoadInitiatives()}
              placeholder="Enter assignee name (e.g., Kevin Yu)..."
              className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleLoadInitiatives}
            disabled={loading}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              <>Load Initiatives</>
            )}
          </button>
        </div>

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search initiatives..."
                className="pl-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-[180px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Proposed">Proposed</option>
              <option value="Committed">Committed</option>
              <option value="Done">Done</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={filteredInitiatives.length === 0}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </section>

      {/* Roadmap Table */}
      <section className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {assigneeName ? `${assigneeName}'s Initiatives` : 'Initiatives'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {assigneeName
                    ? `Initiatives and tasks assigned to ${assigneeName}`
                    : 'Enter an assignee name above to load their initiatives'}
                </p>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold">{filteredInitiatives.length}</span> initiatives
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th
                    onClick={() => handleSort('key')}
                    className="h-12 px-4 text-left align-middle font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Key
                      <span className="text-gray-400">↕</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('summary')}
                    className="h-12 px-4 text-left align-middle font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Summary
                      <span className="text-gray-400">↕</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="h-12 px-4 text-left align-middle font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <span className="text-gray-400">↕</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('created')}
                    className="h-12 px-4 text-left align-middle font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Created
                      <span className="text-gray-400">↕</span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('updated')}
                    className="h-12 px-4 text-left align-middle font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Updated
                      <span className="text-gray-400">↕</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <LoadingSpinner />
                        <p className="text-sm text-gray-600 dark:text-gray-400">Loading initiatives...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="text-yellow-500">
                          <svg
                            className="h-12 w-12"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{error}</p>
                          <button
                            onClick={handleRefresh}
                            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredInitiatives.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <svg
                          className="h-12 w-12 text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {initiatives.length === 0
                            ? 'Enter an assignee name and click "Load Initiatives"'
                            : 'No initiatives found matching your filters'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInitiatives.map((initiative) => (
                    <tr
                      key={initiative.key}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                    >
                      <td className="p-4 align-middle">
                        <code className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-mono text-gray-900 dark:text-gray-100">
                          {initiative.key}
                        </code>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="max-w-[400px]">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{initiative.summary}</div>
                          {initiative.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                              {getDescriptionText(initiative.description)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                            initiative.status
                          )}`}
                        >
                          {initiative.status}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-sm text-gray-600 dark:text-gray-400">
                        {new Date(initiative.created).toLocaleDateString()}
                      </td>
                      <td className="p-4 align-middle text-sm text-gray-600 dark:text-gray-400">
                        {new Date(initiative.updated).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Roadmap;

