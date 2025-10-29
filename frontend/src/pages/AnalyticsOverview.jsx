import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getRequestTypesAnalytics, getValidationTrend, getCompletionTimes } from '../services/analyticsService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AnalyticsOverview = () => {
  const navigate = useNavigate();
  
  // Get initial timeframe: user's saved preference > default from Settings > fallback to 12 months
  const getInitialTimeframe = () => {
    // First, check if user has a saved preference for this page
    const userPreference = localStorage.getItem('analyticsOverview_timeframe');
    if (userPreference) return parseInt(userPreference);
    
    // If not, use the default from Settings
    const defaultSetting = localStorage.getItem('defaultAnalyticsTimeframe');
    return defaultSetting ? parseInt(defaultSetting) : 12;
  };
  
  // State for request types analytics
  const [requestTypesData, setRequestTypesData] = useState([]);
  const [requestTypesLoading, setRequestTypesLoading] = useState(true);
  const [requestTypesError, setRequestTypesError] = useState(null);
  const [period, setPeriod] = useState(null);
  
  // State for validation trend
  const [trendData, setTrendData] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState(null);
  
  // State for completion times
  const [completionData, setCompletionData] = useState([]);
  const [completionLoading, setCompletionLoading] = useState(true);
  const [completionError, setCompletionError] = useState(null);
  const [completionPeriod, setCompletionPeriod] = useState(null);
  
  // State for timeframe selection
  const [timeframeMonths, setTimeframeMonths] = useState(getInitialTimeframe());
  
  // State for toggle controls (default all enabled like old app)
  const [visibleLines, setVisibleLines] = useState({
    Update: true,
    New: true,
    Deprovision: true
  });
  
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch data on mount and when timeframe changes
  useEffect(() => {
    fetchData();
  }, [timeframeMonths]);

  const fetchData = async () => {
    setLastRefresh(new Date());
    await Promise.all([fetchRequestTypesData(), fetchTrendData(), fetchCompletionData()]);
  };

  // Save user's timeframe preference when they change it
  const handleTimeframeChange = (newMonths) => {
    setTimeframeMonths(newMonths);
    localStorage.setItem('analyticsOverview_timeframe', newMonths.toString());
    console.log(`[AnalyticsOverview] User preference saved: ${newMonths} months`);
  };

  const fetchRequestTypesData = async () => {
    setRequestTypesLoading(true);
    setRequestTypesError(null);
    try {
      const data = await getRequestTypesAnalytics(timeframeMonths);
      if (data.success) {
        setRequestTypesData(data.data || []);
        if (data.period) {
          setPeriod(data.period);
        }
      }
    } catch (err) {
      console.error('[AnalyticsOverview] Error fetching request types:', err);
      setRequestTypesError(err.message);
    } finally {
      setRequestTypesLoading(false);
    }
  };

  const fetchTrendData = async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await getValidationTrend(timeframeMonths);
      console.log('[AnalyticsOverview] Trend API response:', data);
      if (data.success) {
        console.log('[AnalyticsOverview] Setting trend data:', data.trendData?.length, 'items');
        const trendItems = data.trendData || [];
        
        // Log first item to see structure
        if (trendItems.length > 0) {
          console.log('[AnalyticsOverview] First trend item structure:', trendItems[0]);
        }
        
        setTrendData(trendItems);
        
        // Initialize visible lines for all three request types (like old app)
        setVisibleLines({
          Update: true,
          New: true,
          Deprovision: true
        });
        
        if (data.period) {
          setTrendPeriod(data.period);
        }
      } else {
        console.error('[AnalyticsOverview] API returned success: false', data);
        setTrendError(data.error || 'Failed to load trend data');
      }
    } catch (err) {
      console.error('[AnalyticsOverview] Error fetching trend data:', err);
      setTrendError(err.message);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchCompletionData = async () => {
    setCompletionLoading(true);
    setCompletionError(null);
    try {
      const data = await getCompletionTimes();
      console.log('[AnalyticsOverview] Completion times API response:', data);
      if (data.success) {
        setCompletionData(data.data || []);
        if (data.period) {
          setCompletionPeriod(data.period);
        }
      } else {
        console.error('[AnalyticsOverview] API returned success: false', data);
        setCompletionError(data.error || 'Failed to load completion times');
      }
    } catch (err) {
      console.error('[AnalyticsOverview] Error fetching completion times:', err);
      setCompletionError(err.message);
    } finally {
      setCompletionLoading(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Format date range
  const formatDateRange = (period) => {
    if (!period) return '';
    const start = new Date(period.startDate).toLocaleDateString();
    const end = new Date(period.endDate).toLocaleDateString();
    return `${start} - ${end}`;
  };

  // Get color classes for request types
  const getRequestTypeColors = (requestType) => {
    const colors = {
      'Update': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      'New': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      'Deprovision': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    };
    return colors[requestType] || { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' };
  };

  // Get color for request type
  const getRequestTypeColor = (requestType) => {
    const colors = {
      'Update': 'rgb(239, 68, 68)',
      'New': 'rgb(59, 130, 246)',
      'Deprovision': 'rgb(16, 185, 129)',
    };
    
    // Return predefined color or a fallback
    return colors[requestType] || `hsl(${(requestType.charCodeAt(0) * 10) % 360}, 70%, 50%)`;
  };

  // Prepare chart data (matching old app's structure)
  const prepareChartData = () => {
    if (!trendData || trendData.length === 0) {
      console.log('[AnalyticsOverview] No trend data available for chart');
      return null;
    }

    console.log('[AnalyticsOverview] Preparing chart with', trendData.length, 'data points');

    // Sample every 3rd data point to avoid overcrowding (like old app)
    const sampledData = trendData.filter((d, index) => index % 3 === 0);
    console.log('[AnalyticsOverview] Sampled to', sampledData.length, 'data points');

    // Extract labels from displayDate field
    const labels = sampledData.map(d => d.displayDate || d.display_date || new Date(d.weekStartDate || d.week_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // Extract data for each request type
    const updateFailurePercentages = sampledData.map(d => parseFloat(d.updateFailurePercentage || 0));
    const newFailurePercentages = sampledData.map(d => parseFloat(d.newFailurePercentage || 0));
    const deprovisionFailurePercentages = sampledData.map(d => parseFloat(d.deprovisionFailurePercentage || 0));

    console.log('[AnalyticsOverview] Update percentages sample:', updateFailurePercentages.slice(0, 3));
    console.log('[AnalyticsOverview] New percentages sample:', newFailurePercentages.slice(0, 3));
    console.log('[AnalyticsOverview] Deprovision percentages sample:', deprovisionFailurePercentages.slice(0, 3));

    // Build datasets based on visible lines
    const datasets = [];

    if (visibleLines.Update) {
      datasets.push({
        label: 'Update',
        data: updateFailurePercentages,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (visibleLines.New) {
      datasets.push({
        label: 'New',
        data: newFailurePercentages,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (visibleLines.Deprovision) {
      datasets.push({
        label: 'Deprovision',
        data: deprovisionFailurePercentages,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(16, 185, 129)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    console.log('[AnalyticsOverview] Created', datasets.length, 'datasets');

    return {
      labels,
      datasets
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We'll use custom toggle controls
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + '%';
          }
        },
        title: {
          display: true,
          text: 'Validation Failure Rate (%)'
        },
        grid: {
          display: true, // Keep horizontal grid lines
        }
      },
      x: {
        title: {
          display: true,
          text: 'Week'
        },
        grid: {
          display: false, // Remove vertical grid lines
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
  };

  const chartData = useMemo(() => {
    const data = prepareChartData();
    
    // Debug chart data
    if (data) {
      console.log('[AnalyticsOverview] Chart data prepared:', {
        labels: data.labels?.length,
        datasets: data.datasets?.length,
        datasetDetails: data.datasets?.map(d => ({
          label: d.label,
          dataPoints: d.data?.length,
          nonNullPoints: d.data?.filter(v => v !== null).length
        }))
      });
    } else {
      console.log('[AnalyticsOverview] Chart data is null');
    }
    
    return data;
  }, [trendData, visibleLines]);

  return (
    <div className="space-y-6" id="page-analytics">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Monitor Technical Team Request activity and trends</p>
          <div className="flex items-center gap-4">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="analytics-timeframe" className="text-sm font-medium text-gray-700">
                Time Frame:
              </label>
              <select
                id="analytics-timeframe"
                value={timeframeMonths}
                onChange={(e) => handleTimeframeChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 bg-white dark:bg-gray-700"
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
            <div className="text-sm text-gray-500">
              Last refreshed: {formatTimestamp(lastRefresh)}
            </div>
            <button
              onClick={fetchData}
              disabled={requestTypesLoading || trendLoading || completionLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`h-4 w-4 ${(requestTypesLoading || trendLoading || completionLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Technical Team Requests - Last {timeframeMonths} {timeframeMonths === 1 ? 'Month' : 'Months'}
          </h2>
          {period && <span className="text-sm text-gray-500">{formatDateRange(period)}</span>}
        </div>

        {requestTypesLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : requestTypesError ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
            <p className="text-red-600">Failed to load analytics data</p>
            <button
              onClick={fetchRequestTypesData}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {requestTypesData.map((item) => {
              const colors = getRequestTypeColors(item.requestType);
              const isZero = item.count === 0;
              const hasValidationFailures = item.validationFailures > 0;

              return (
                <div
                  key={item.requestType}
                  className={`rounded-lg border bg-white shadow-sm p-6 ${isZero ? 'opacity-60' : ''}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-600">{item.requestType}</p>
                        <p className={`text-3xl font-bold ${isZero ? 'text-gray-400' : 'text-gray-900'}`}>
                          {item.count}
                        </p>
                      </div>
                      <div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${colors.bg} ${colors.text}`}>
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    {!isZero && (
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-medium ${hasValidationFailures ? 'text-red-600' : 'text-green-600'}`}>
                              {hasValidationFailures ? '⚠️' : '✓'} Validation
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${hasValidationFailures ? 'text-red-600' : 'text-green-600'}`}>
                              {item.validationFailures}
                            </p>
                            <p className="text-xs text-gray-500">failed ({item.validationFailureRate}%)</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Charts Grid - Side by side on large screens, stacked on small screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validation Trend Chart */}
        <section className="rounded-lg border bg-white dark:bg-gray-800 shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Validation Trend - Last {timeframeMonths} {timeframeMonths === 1 ? 'Month' : 'Months'}
                </h3>
                <p className="text-sm text-gray-600">Validation failure percentage by request type</p>
              </div>
              {trendPeriod && <span className="text-xs text-gray-500">{formatDateRange(trendPeriod)}</span>}
            </div>

            {/* Toggle Controls */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
              <span className="text-sm font-medium text-gray-600">Show:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLines.Update}
                  onChange={(e) => setVisibleLines({
                    ...visibleLines,
                    Update: e.target.checked
                  })}
                  className="w-4 h-4 text-red-600 dark:text-red-400 rounded border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-gray-100 transition-colors"
                />
                <span className="text-sm flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></span>
                  Update
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLines.New}
                  onChange={(e) => setVisibleLines({
                    ...visibleLines,
                    New: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100 transition-colors"
                />
                <span className="text-sm flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(59, 130, 246)' }}></span>
                  New
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLines.Deprovision}
                  onChange={(e) => setVisibleLines({
                    ...visibleLines,
                    Deprovision: e.target.checked
                  })}
                  className="w-4 h-4 text-green-600 dark:text-green-400 rounded border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-gray-100 transition-colors"
                />
                <span className="text-sm flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(16, 185, 129)' }}></span>
                  Deprovision
                </span>
              </label>
            </div>
          </div>

          <div className="p-6">
            {trendLoading ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <LoadingSpinner />
                <p className="text-sm text-gray-500">Loading trend data...</p>
              </div>
            ) : trendError ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-sm text-gray-500">Failed to load trend data</p>
                <p className="text-xs text-red-600">{trendError}</p>
                <button
                  onClick={fetchTrendData}
                  className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  Try Again
                </button>
              </div>
            ) : !trendData || trendData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm text-gray-500">No trend data available</p>
              </div>
            ) : !chartData || chartData.datasets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-500">No data to display (all request types are hidden)</p>
                <p className="text-xs text-gray-400">
                  {trendData?.length || 0} trend items, {Object.keys(visibleLines).length} types available
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative', height: '350px' }}>
                {chartData && chartData.datasets && chartData.datasets.length > 0 ? (
                  <>
                    <Line data={chartData} options={chartOptions} />
                    <div className="text-xs text-gray-400 text-center mt-2">
                      Showing {chartData.datasets.length} trend line(s)
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Chart initialization failed
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Provisioning Completion Times Chart */}
        <section className="rounded-lg border bg-white dark:bg-gray-800 shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Weekly Provisioning Completion Times
              </h3>
              <p className="text-sm text-gray-600">
                Average time to complete provisioning requests per week (from first appearance to completion)
              </p>
            </div>
            {completionPeriod && (
              <span className="text-xs text-gray-500">
                Since {new Date(completionPeriod.startDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {completionLoading ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <LoadingSpinner />
              <p className="text-sm text-gray-500">Loading completion times...</p>
            </div>
          ) : completionError ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <p className="text-sm text-gray-500">Failed to load completion times</p>
              <p className="text-xs text-red-600">{completionError}</p>
              <button
                onClick={fetchCompletionData}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
              >
                Try Again
              </button>
            </div>
          ) : !completionData || completionData.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-gray-500">No completion data available</p>
              <p className="text-xs text-gray-400">Complete at least one provisioning request to see data</p>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', height: '400px' }}>
                <Bar
                  data={{
                    labels: completionData.map(d => d.weekLabel),
                    datasets: [{
                      label: 'Average Hours to Complete',
                      data: completionData.map(d => parseFloat(d.avgHours)),
                      backgroundColor: 'rgba(59, 130, 246, 0.6)',
                      borderColor: 'rgb(59, 130, 246)',
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const dataPoint = completionData[context.dataIndex];
                            const lines = [
                              `Average: ${dataPoint.avgHours.toFixed(2)} hours (${dataPoint.avgDays} days)`,
                              `Completed: ${dataPoint.completedCount} request(s)`,
                              `Min: ${dataPoint.minHours.toFixed(2)} hours`,
                              `Max: ${dataPoint.maxHours.toFixed(2)} hours`,
                              `Median: ${dataPoint.medianHours.toFixed(2)} hours`
                            ];
                            if (dataPoint.psRecords) {
                              lines.push(`PS Records: ${dataPoint.psRecords}`);
                            }
                            return lines;
                          }
                        }
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Hours to Complete'
                        },
                        ticks: {
                          callback: function(value) {
                            return value + ' hrs';
                          }
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Week'
                        },
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45
                        }
                      }
                    }
                  }}
                />
              </div>
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {completionData.length} week(s) of data • 
                Total completed: {completionData.reduce((sum, d) => sum + d.completedCount, 0)} request(s)
              </div>
            </div>
          )}
        </div>
        </section>
      </div>
    </div>
  );
};

export default AnalyticsOverview;

