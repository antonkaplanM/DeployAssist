import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const resolveField = (obj, path) => {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

const ChartWidget = ({ type, title, data, config, loading, error }) => {
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    const {
      xField, yField, labelField, valueField,
      colors = DEFAULT_COLORS, seriesField, multiSeries
    } = config;

    if (type === 'pie-chart') {
      return {
        labels: data.map(d => resolveField(d, labelField)),
        datasets: [{
          data: data.map(d => resolveField(d, valueField)),
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 1,
        }],
      };
    }

    if (multiSeries && seriesField) {
      const series = [...new Set(data.map(d => resolveField(d, seriesField)))];
      const labels = [...new Set(data.map(d => resolveField(d, xField)))];
      return {
        labels,
        datasets: series.map((s, i) => ({
          label: s,
          data: labels.map(l => {
            const row = data.find(d => resolveField(d, xField) === l && resolveField(d, seriesField) === s);
            return row ? resolveField(row, yField) : 0;
          }),
          backgroundColor: colors[i % colors.length] + '99',
          borderColor: colors[i % colors.length],
          borderWidth: 2,
          fill: config.fill || false,
        })),
      };
    }

    return {
      labels: data.map(d => resolveField(d, xField)),
      datasets: [{
        label: title,
        data: data.map(d => resolveField(d, yField)),
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 2,
        fill: config.fill || false,
      }],
    };
  }, [data, config, type, title]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: type === 'pie-chart' || config.multiSeries, position: 'bottom' },
      title: { display: false },
    },
    ...(type !== 'pie-chart' && {
      indexAxis: config.horizontal ? 'y' : 'x',
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    }),
  }), [type, config]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-red-500">Failed to load chart data</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  const ChartComponent = {
    'bar-chart': Bar,
    'line-chart': Line,
    'pie-chart': config.doughnut ? Doughnut : Pie,
  }[type] || Bar;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-shadow hover:shadow-md">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div className="h-64">
        <ChartComponent data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ChartWidget;
