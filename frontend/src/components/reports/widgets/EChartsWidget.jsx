import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart,
         FunnelChart, GaugeChart, HeatmapChart, TreemapChart,
         SunburstChart, BoxplotChart, CandlestickChart, GraphChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent,
         TitleComponent, ToolboxComponent, DataZoomComponent,
         DatasetComponent, VisualMapComponent, MarkLineComponent,
         MarkPointComponent, MarkAreaComponent, PolarComponent,
         RadarComponent, GeoComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { sanitizeEChartsOption } from '../../../utils/echartsSanitizer';

echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  FunnelChart, GaugeChart, HeatmapChart, TreemapChart,
  SunburstChart, BoxplotChart, CandlestickChart, GraphChart,
  GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, ToolboxComponent, DataZoomComponent,
  DatasetComponent, VisualMapComponent, MarkLineComponent,
  MarkPointComponent, MarkAreaComponent, PolarComponent,
  RadarComponent, GeoComponent, GraphicComponent,
  CanvasRenderer,
]);

const DARK_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#e5e7eb' },
  legend: { textStyle: { color: '#9ca3af' } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#374151' } },
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#374151' } },
    axisLabel: { color: '#9ca3af' },
    splitLine: { lineStyle: { color: '#1f2937' } },
  },
};

/**
 * Inject API data into an ECharts option that uses the `dataset` component.
 * The renderer sets `option.dataset.source` to the fetched data array so
 * ECharts' built-in dimension mapping handles the rest.
 */
function injectDataset(option, data) {
  if (!data || !Array.isArray(data) || data.length === 0) return option;

  const merged = { ...option };

  if (merged.dataset) {
    if (Array.isArray(merged.dataset)) {
      merged.dataset = merged.dataset.map((ds, i) =>
        i === 0 ? { ...ds, source: data } : ds
      );
    } else {
      merged.dataset = { ...merged.dataset, source: data };
    }
  } else {
    merged.dataset = { source: data };
  }

  return merged;
}

const EChartsWidget = ({ title, data, option: rawOption, loading, error }) => {
  const chartRef = useRef(null);
  const isDark = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

  useEffect(() => {
    const handleResize = () => chartRef.current?.getEchartsInstance()?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const finalOption = useMemo(() => {
    if (!rawOption) return null;

    let sanitized = sanitizeEChartsOption(rawOption);
    sanitized = injectDataset(sanitized, data);

    sanitized.title = { show: false };

    if (!sanitized.tooltip) {
      sanitized.tooltip = { trigger: 'axis', confine: true };
    }

    if (isDark) {
      sanitized.textStyle = { ...DARK_THEME.textStyle, ...(sanitized.textStyle || {}) };
      sanitized.backgroundColor = 'transparent';
      if (sanitized.legend) {
        sanitized.legend = { ...sanitized.legend, ...DARK_THEME.legend };
      }
    }

    return sanitized;
  }, [rawOption, data, isDark]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse" />
        <div className="h-72 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
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

  if (!finalOption) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-500">No chart configuration provided</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-shadow hover:shadow-md">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div className="h-72">
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={finalOption}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

export default EChartsWidget;
