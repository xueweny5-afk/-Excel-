import type { ActivityRecord, PPLRecord } from '../domain';
import { downloadCsv, groupAmount } from './analyzer';
import { matchCustomers } from './customerMatcher';
import type { CustomerMatchResult } from './customerMatcher';
import { normalizeCustomerName } from './normalize';

export interface KeyCustomerAnalysis {
  inputNames: string[];
  matchResults: CustomerMatchResult[];
  unmatchedInputs: string[];
  matchedPplRows: PPLRecord[];
  kpis: {
    inputCustomerCount: number;
    matchedCustomerCount: number;
    opportunityCount: number;
    totalAmount: number;
    weightedWinRate: number;
    forecastAmount: number;
    riskCount: number;
    activityCount: number | null;
    activityNote: string;
  };
  chartData: {
    customerAmountRank: Array<{ name: string; value: number; count: number }>;
    customerCountRank: Array<{ name: string; value: number; count: number }>;
    productAmount: Array<{ name: string; value: number; count: number }>;
    ownerAmount: Array<{ name: string; value: number; count: number }>;
    stageAmount: Array<{ name: string; value: number; count: number }>;
  };
}

export function analyzeKeyCustomers(inputText: string, pplRecords: PPLRecord[], _activityRecords: ActivityRecord[]): KeyCustomerAnalysis {
  const inputNames = parseCustomerInput(inputText);
  const matchResults = matchCustomers(inputNames, pplRecords);
  const matchedNames = new Set(matchResults.filter((item) => item.matched).map((item) => normalizeCustomerName(item.matchedCustomerName)));
  const matchedPplRows = pplRecords.filter((row) => matchedNames.has(normalizeCustomerName(row.customerName)));
  const totalAmount = sum(matchedPplRows.map((row) => row.amount));

  return {
    inputNames,
    matchResults,
    unmatchedInputs: matchResults.filter((item) => !item.matched).map((item) => item.inputName),
    matchedPplRows,
    kpis: {
      inputCustomerCount: inputNames.length,
      matchedCustomerCount: new Set(matchResults.filter((item) => item.matched).map((item) => item.matchedCustomerName)).size,
      opportunityCount: matchedPplRows.length,
      totalAmount,
      weightedWinRate: totalAmount ? sum(matchedPplRows.map((row) => row.amount * row.winRate)) / totalAmount : 0,
      forecastAmount: sum(matchedPplRows.filter((row) => row.forecastType === 'Commit' || row.forecastType === 'Best Case').map((row) => row.amount)),
      riskCount: matchedPplRows.filter((row) => row.healthLevel === '风险').length,
      activityCount: null,
      activityNote: '当前活动记录无客户维度，暂不统计',
    },
    chartData: {
      customerAmountRank: groupAmount(matchedPplRows, 'customerName', 10),
      customerCountRank: groupCount(matchedPplRows, 'customerName', 10),
      productAmount: groupAmount(matchedPplRows, 'product', 10),
      ownerAmount: groupAmount(matchedPplRows, 'owner', 10),
      stageAmount: groupAmount(matchedPplRows, 'stage', 10),
    },
  };
}

export function exportKeyCustomerCsv(rows: PPLRecord[]) {
  const headers = ['销售', '客户名称', '商机名称', '一级行业', '产品', '金额(万元)', '销售阶段', '赢单率', 'Forecast', '预计落单季度', '健康度', '状态'];
  const body = rows.map((row) => [
    row.owner,
    row.customerName,
    row.opportunityName,
    row.industryLevel1,
    row.product,
    row.amount.toFixed(1),
    row.stage,
    row.winRate.toFixed(2),
    row.forecastType,
    row.expectedQuarter,
    row.healthLevel,
    row.status,
  ]);
  downloadCsv([headers, ...body], `key-customers-${new Date().toISOString().slice(0, 10)}.csv`);
}

function parseCustomerInput(inputText: string) {
  return Array.from(new Set(inputText.split(/[\n,，;；、]+/).map((item) => item.trim()).filter(Boolean)));
}

function groupCount(rows: PPLRecord[], field: keyof PPLRecord, limit: number) {
  const map = new Map<string, { name: string; value: number; count: number }>();
  rows.forEach((row) => {
    const name = String(row[field] || '未填写');
    const current = map.get(name) ?? { name, value: 0, count: 0 };
    current.value += 1;
    current.count += 1;
    map.set(name, current);
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, limit);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}