import type { DrillFilter, Filters, PPLRecord } from '../domain';
import { normalizeCustomerName } from './normalize';

/** KPI 汇总类型（提供给 hooks/components 复用） */
export interface KPISummary {
  opportunityCount: number;
  totalAmount: number;
  customerCount: number;
  weightedWinRate: number;
  forecastAmount: number;
  riskCount: number;
}

export interface AggregatedPplRow {
  customerName: string;
  industryLevel1: string;
  product: string;
  stage: string;
  owners: string;
  opportunityCount: number;
  totalAmount: number;
  weightedWinRate: number;
  forecastAmount: number;
  riskCount: number;
}

export function filterPpl(
  data: PPLRecord[],
  filters: Partial<Filters>,
  drillFilters: DrillFilter[],
  search: string,
  customerQuery = '',
) {
  const keyword = search.trim().toLowerCase();
  const customerTerms = parseCustomerTerms(customerQuery);
  return data.filter((row) => {
    const manualOk =
      (!filters.owner || row.owner === filters.owner) &&
      (!filters.industryLevel1 || row.industryLevel1 === filters.industryLevel1) &&
      (!filters.product || row.product === filters.product) &&
      (!filters.expectedQuarter || row.expectedQuarter === filters.expectedQuarter) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.forecastType || row.forecastType === filters.forecastType);
    const drillOk = drillFilters.every((filter) => String(row[filter.field]) === filter.value);
    const searchOk =
      !keyword ||
      [row.owner, row.customerName, row.opportunityName, row.product, row.industryLevel1].some((value) =>
        value.toLowerCase().includes(keyword),
      );
    const customerOk =
      customerTerms.length === 0 ||
      customerTerms.some((term) => normalizeCustomerName(row.customerName).includes(term));
    return manualOk && drillOk && searchOk && customerOk;
  });
}

export function calculateKpis(data: PPLRecord[]) {
  const totalAmount = sum(data.map((row) => row.amount));
  const weightedWinRate = totalAmount ? sum(data.map((row) => row.amount * row.winRate)) / totalAmount : 0;
  return {
    opportunityCount: data.length,
    totalAmount,
    customerCount: new Set(data.map((row) => normalizeCustomerName(row.customerName)).filter(Boolean)).size,
    weightedWinRate,
    forecastAmount: sum(
      data
        .filter((row) => row.forecastType === 'Commit' || row.forecastType === 'Best Case')
        .map((row) => row.amount),
    ),
    riskCount: data.filter((row) => row.healthLevel === '风险').length,
  };
}

export function groupAmount(data: PPLRecord[], field: keyof PPLRecord, limit = 10) {
  const map = new Map<string, { name: string; value: number; count: number }>();
  data.forEach((row) => {
    const name = String(row[field] || '未填写');
    const prev = map.get(name) ?? { name, value: 0, count: 0 };
    prev.value += row.amount;
    prev.count += 1;
    map.set(name, prev);
  });
  // 排序：金额降序 → 同金额按商机数降序 → 同数按名称字典序，保证稳定
  return Array.from(map.values())
    .sort((a, b) => b.value - a.value || b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, limit);
}

export function uniqueOptions(data: PPLRecord[], field: keyof PPLRecord) {
  return Array.from(new Set(data.map((row) => String(row[field] || '')).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
}

export function aggregatePpl(rows: PPLRecord[]): AggregatedPplRow[] {
  const map = new Map<string, AggregatedPplRow & { weightedAmount: number; ownerSet: Set<string> }>();
  rows.forEach((row) => {
    const key = [row.customerName, row.industryLevel1, row.product, row.stage].join('');
    const current = map.get(key) ?? {
      customerName: row.customerName,
      industryLevel1: row.industryLevel1,
      product: row.product,
      stage: row.stage,
      owners: '',
      opportunityCount: 0,
      totalAmount: 0,
      weightedWinRate: 0,
      forecastAmount: 0,
      riskCount: 0,
      weightedAmount: 0,
      ownerSet: new Set<string>(),
    };
    current.opportunityCount += 1;
    current.totalAmount += row.amount;
    current.weightedAmount += row.amount * row.winRate;
    current.forecastAmount +=
      row.forecastType === 'Commit' || row.forecastType === 'Best Case' ? row.amount : 0;
    current.riskCount += row.healthLevel === '风险' ? 1 : 0;
    current.ownerSet.add(row.owner);
    map.set(key, current);
  });

  return Array.from(map.values())
    .map(({ weightedAmount, ownerSet, ...row }) => ({
      ...row,
      owners: Array.from(ownerSet).join('、'),
      weightedWinRate: row.totalAmount ? weightedAmount / row.totalAmount : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function exportCsv(rows: PPLRecord[]) {
  const headers = [
    '销售',
    '客户名称',
    '商机名称',
    '一级行业',
    '产品',
    '金额(万元)',
    '销售阶段',
    '赢单率',
    'Forecast',
    '预计落单季度',
    '健康度',
    '状态',
  ];
  const body = rows.map((row) => [
    row.owner,
    row.customerName,
    row.opportunityName,
    row.industryLevel1,
    row.product,
    row.amount.toFixed(1), // L 修复：CSV 数字精度统一
    row.stage,
    row.winRate.toFixed(2),
    row.forecastType,
    row.expectedQuarter,
    row.healthLevel,
    row.status,
  ]);
  downloadCsv([headers, ...body], `pipeline-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportAggregationCsv(rows: AggregatedPplRow[]) {
  const headers = [
    '客户名称',
    '一级行业',
    '产品',
    '销售阶段',
    '销售',
    '商机数',
    '金额合计(万元)',
    '加权赢单率',
    'Forecast金额(万元)',
    '风险商机数',
  ];
  const body = rows.map((row) => [
    row.customerName,
    row.industryLevel1,
    row.product,
    row.stage,
    row.owners,
    row.opportunityCount,
    row.totalAmount.toFixed(1),
    row.weightedWinRate.toFixed(2),
    row.forecastAmount.toFixed(1),
    row.riskCount,
  ]);
  downloadCsv([headers, ...body], `pipeline-aggregation-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadCsv(lines: unknown[][], fileName: string) {
  const csv = lines.map((line) => line.map(escapeCsv).join(',')).join('\n');
  // BOM 让 Excel 识别 UTF-8 中文
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 修复 H5：增加 \r 转义。
 * Windows 源数据可能含 \r，未转义会导致 CSV 解析错位。
 */
function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCustomerTerms(value: string) {
  return value
    .split(/[\n,，;；、]+/)
    .map((term) => normalizeCustomerName(term.trim()))
    .filter(Boolean);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
