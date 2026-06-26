/**
 * ECharts 通用配置与组件级 option 构造器。
 * 把 App.tsx 中的 barOption/donutOption/quarterOption/baseChart 等抽到独立模块，
 * 让图表组件保持纯展示，单一职责。
 */

export const chartColors = {
  primary: '#2563eb',
  primaryLight: '#60a5fa',
  cyan: '#06b6d4',
  cyanLight: '#38bdf8',
  purple: '#8b5cf6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  gray: '#94a3b8',
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  surfaceMuted: '#f9fafb',
  borderSoft: '#eef2f7',
} as const;

/** ECharts 颜色字符串（不限制具体值） */
export type ChartColor = string;

const DONUT_COLOR_PALETTE_LIST = [
  chartColors.primary,
  chartColors.cyan,
  chartColors.purple,
  chartColors.green,
  chartColors.orange,
  chartColors.gray,
];

export function baseChart() {
  return {
    backgroundColor: 'transparent',
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle: { color: chartColors.textPrimary, fontFamily: 'Inter, system-ui, sans-serif' },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderWidth: 0,
      padding: [10, 12],
      extraCssText: 'border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.18);',
      textStyle: { color: chartColors.surfaceMuted, fontSize: 12 },
    },
    grid: { left: 16, right: 56, top: 18, bottom: 18, containLabel: true },
  };
}

export function axisCategory(data: string[], width?: number) {
  return {
    type: 'category' as const,
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: chartColors.textMuted, fontSize: 12, width, overflow: width ? 'truncate' as const : undefined },
  };
}

export function axisValue() {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: chartColors.textMuted, fontSize: 12 },
    splitLine: { lineStyle: { color: chartColors.borderSoft } },
  };
}

export function barOption(items: Array<{ name: string; value: number }>, horizontal = false, color: ChartColor = chartColors.primary) {
  const displayItems = horizontal ? [...items].reverse() : items;
  const names = displayItems.map((item) => item.name);
  const values = displayItems.map((item) => item.value);
  return {
    ...baseChart(),
    xAxis: horizontal ? axisValue() : axisCategory(names),
    yAxis: horizontal ? axisCategory(names, 120) : axisValue(),
    series: [{
      type: 'bar',
      data: values.map((value, index) => ({
        value,
        itemStyle: { color: index === values.length - 1 && horizontal ? chartColors.primary : color, borderRadius: 6 },
      })),
      name: '金额(万元)',
      barMaxWidth: 14,
      label: {
        show: true,
        position: horizontal ? 'right' : 'top',
        color: chartColors.textSecondary,
        fontSize: 12,
        formatter: ({ value }: { value: number }) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万`,
      },
    }],
  };
}

export function donutOption(items: Array<{ name: string; value: number }>, palette: readonly string[] = DONUT_COLOR_PALETTE_LIST) {
  return {
    ...baseChart(),
    color: [...palette],
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['55%', '76%'],
      center: ['50%', '52%'],
      label: { show: false },
      labelLine: { show: false },
      data: items,
      itemStyle: { borderColor: '#ffffff', borderWidth: 3 },
    }],
  };
}

export function quarterOption(items: Array<{ name: string; value: number; count: number }>) {
  return {
    ...baseChart(),
    tooltip: { ...baseChart().tooltip, trigger: 'axis' },
    xAxis: axisCategory(items.map((item) => item.name)),
    yAxis: axisValue(),
    series: [
      { type: 'bar', name: '金额(万元)', data: items.map((item) => item.value), barMaxWidth: 24, itemStyle: { color: chartColors.primary, borderRadius: 6 } },
      { type: 'line', name: '商机数', data: items.map((item) => item.count), yAxisIndex: 0, smooth: true, symbolSize: 8, itemStyle: { color: chartColors.orange } },
    ],
  };
}

/**
 * 计数类柱状图（商机数 / 客户数等），与金额柱状图共用布局但格式化不同。
 */
export function countBarOption(items: Array<{ name: string; value: number }>, horizontal = false) {
  const displayItems = horizontal ? [...items].reverse() : items;
  const names = displayItems.map((item) => item.name);
  const values = displayItems.map((item) => item.value);
  return {
    ...baseChart(),
    xAxis: horizontal ? axisValue() : axisCategory(names),
    yAxis: horizontal ? axisCategory(names, 120) : axisValue(),
    series: [{
      type: 'bar',
      data: values,
      name: '商机数',
      barMaxWidth: 14,
      itemStyle: { color: chartColors.cyanLight, borderRadius: 4 },
      label: {
        show: true,
        position: horizontal ? 'right' : 'top',
        color: chartColors.textSecondary,
        fontSize: 12,
        formatter: ({ value }: { value: number }) => `${value.toLocaleString('zh-CN')} 个`,
      },
    }],
  };
}

export function matchRateOption(matchedCount: number, unmatchedCount: number) {
  return {
    ...donutOption([
      { name: '成功', value: matchedCount },
      { name: '未匹配', value: unmatchedCount },
    ]),
    color: [chartColors.green, chartColors.red],
  };
}

export const DONUT_PALETTE = DONUT_COLOR_PALETTE_LIST;