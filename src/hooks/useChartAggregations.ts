import { useMemo } from 'react';
import type { PPLRecord } from '../domain';
import { groupAmount } from '../lib/analyzer';

/**
 * 一次性聚合所有图表所需数据。
 * 修复 M4：避免 ChartGrid 内部多次 groupAmount 重复计算。
 */

export interface ChartAggregations {
  owner: Array<{ name: string; value: number; count: number }>;
  industry: Array<{ name: string; value: number; count: number }>;
  product: Array<{ name: string; value: number; count: number }>;
  quarter: Array<{ name: string; value: number; count: number }>;
  forecast: Array<{ name: string; value: number; count: number }>;
  health: Array<{ name: string; value: number; count: number }>;
}

export function useChartAggregations(data: PPLRecord[]): ChartAggregations {
  return useMemo(() => ({
    owner: groupAmount(data, 'owner', 10),
    industry: groupAmount(data, 'industryLevel1', 10),
    product: groupAmount(data, 'product', 15),
    quarter: groupAmount(data, 'expectedQuarter', 8).reverse(),
    forecast: groupAmount(data, 'forecastType', 8),
    health: healthSummary(data),
  }), [data]);
}

function healthSummary(data: PPLRecord[]) {
  const order = ['健康', '关注', '风险'] as const;
  const grouped = groupAmount(data, 'healthLevel', 3);
  return order.map((name) => grouped.find((item) => item.name === name) ?? { name, value: 0, count: 0 });
}