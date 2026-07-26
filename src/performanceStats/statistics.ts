import type {
  KeyProjectMatchResult,
  KeyProjectRecord,
  SalesPerformanceFilters,
  SalesPerformanceRecord,
  SalesPerformanceStats,
  SummaryRow,
} from './types';
import { distinctCount, normalizeText, sum } from './utils';

export const EMPTY_FILTERS: SalesPerformanceFilters = {
  years: [],
  months: [],
  salesperson: '',
  productLevel1: '',
  productLevel2: '',
  productLevel3: '',
  customerType: '',
  industry: '',
  duplicateStatus: '',
  keyword: '',
};

export function filterPerformanceRows(
  records: SalesPerformanceRecord[],
  filters: SalesPerformanceFilters,
) {
  const keyword = normalizeText(filters.keyword);
  return records.filter((row) => {
    if (filters.duplicateStatus) {
      if (row.duplicateStatus !== filters.duplicateStatus) return false;
    } else if (!row.included || row.duplicateStatus === '疑似重复') {
      return false;
    }
    if (filters.years.length > 0 && (!row.confirmationYear || !filters.years.includes(row.confirmationYear))) {
      return false;
    }
    if (filters.months.length > 0 && (!row.confirmationMonth || !filters.months.includes(row.confirmationMonth))) {
      return false;
    }
    if (filters.salesperson && row.salesperson !== filters.salesperson) return false;
    if (filters.productLevel1 && row.productLevel1 !== filters.productLevel1) return false;
    if (filters.productLevel2 && row.productLevel2 !== filters.productLevel2) return false;
    if (filters.productLevel3 && row.productLevel3 !== filters.productLevel3) return false;
    if (filters.customerType && row.customerType !== filters.customerType) return false;
    if (filters.industry && row.industry !== filters.industry) return false;
    if (filters.duplicateStatus && row.duplicateStatus !== filters.duplicateStatus) return false;
    if (keyword) {
      const candidates = [
        row.projectName,
        row.customerName,
        row.contractNumber,
        row.salesperson,
        row.productName,
        row.industry,
      ];
      if (!candidates.some((item) => normalizeText(item).includes(keyword))) return false;
    }
    return true;
  });
}

export function buildSalesPerformanceStats(
  records: SalesPerformanceRecord[],
  filters: SalesPerformanceFilters = EMPTY_FILTERS,
): SalesPerformanceStats {
  const includedRows = filterPerformanceRows(records, filters);
  const excludedRows = records.filter((row) => !row.included || row.duplicateStatus === '疑似重复');
  return {
    includedRows,
    excludedRows,
    kpis: buildKpis(includedRows),
    bySalesperson: groupRows(includedRows, (row) => row.salesperson || '未填写销售'),
    byMonth: groupRows(includedRows, (row) =>
      row.confirmationYear && row.confirmationMonth
        ? `${row.confirmationYear}-${String(row.confirmationMonth).padStart(2, '0')}`
        : '未识别年月',
    ),
    byYear: groupRows(includedRows, (row) => String(row.confirmationYear ?? '未识别年份')),
    byProductLevel1: groupRows(includedRows, (row) => row.productLevel1 || '未分类'),
    byProductLevel2: groupRows(includedRows, (row) => row.productLevel2 || '未分类'),
    byProductLevel3: groupRows(includedRows, (row) => row.productLevel3 || '未分类'),
    byCustomer: groupRows(includedRows, (row) => row.customerName || '未填写客户'),
    byIndustry: groupRows(includedRows, (row) => row.industry || '未分类'),
    byCustomerType: groupRows(includedRows, (row) => row.customerType || '未分类'),
    byProject: groupRows(includedRows, (row) => row.projectName || '未填写项目'),
  };
}

export function buildKeyProjectMatches(
  projects: KeyProjectRecord[],
  performanceRows: SalesPerformanceRecord[],
): KeyProjectMatchResult[] {
  const includedRows = performanceRows.filter((row) => row.included && row.duplicateStatus === '正常');
  // 预建 Map<"projectName|customerName", SalesPerformanceRecord[]>：将 N×M 双重过滤降为 O(N+M)
  const matchedByKey = new Map<string, SalesPerformanceRecord[]>();
  for (const row of includedRows) {
    const key = `${normalizeText(row.projectName)}|${normalizeText(row.customerName)}`;
    const list = matchedByKey.get(key);
    if (list) list.push(row);
    else matchedByKey.set(key, [row]);
  }
  return projects.map((project) => {
    const projectKey = normalizeText(project.projectName);
    const customerKey = normalizeText(project.customerName);
    const matchedRecords = matchedByKey.get(`${projectKey}|${customerKey}`) ?? [];
    const orderAmount = sum(matchedRecords.map((row) => row.orderAmount));
    const salesGrossProfit = sum(matchedRecords.map((row) => row.salesGrossProfit));
    const contractCount = distinctCount(matchedRecords.map((row) => row.contractNumber || row.id));
    const salespeople = Array.from(new Set(matchedRecords.map((row) => row.salesperson).filter(Boolean)));
    return {
      project,
      status: matchedRecords.length > 0 ? '已匹配' : '未匹配',
      matchedRecords,
      orderAmount,
      salesGrossProfit,
      contractCount,
      salespeople,
      targetAmountRate: project.targetAmount ? orderAmount / project.targetAmount : 0,
      targetGrossProfitRate: project.targetGrossProfit ? salesGrossProfit / project.targetGrossProfit : 0,
      reason: matchedRecords.length > 0 ? '' : '未找到项目名称和客户名称同时一致的已确认业绩记录',
    };
  });
}

export function summarizeKeyProjectMatches(matches: KeyProjectMatchResult[]) {
  const matched = matches.filter((item) => item.status === '已匹配');
  const totalTargetAmount = sum(matches.map((item) => item.project.targetAmount));
  const totalTargetProfit = sum(matches.map((item) => item.project.targetGrossProfit));
  const orderAmount = sum(matches.map((item) => item.orderAmount));
  const salesGrossProfit = sum(matches.map((item) => item.salesGrossProfit));
  return {
    totalCount: matches.length,
    matchedCount: matched.length,
    unmatchedCount: matches.length - matched.length,
    orderAmount,
    salesGrossProfit,
    targetAmountRate: totalTargetAmount ? orderAmount / totalTargetAmount : 0,
    targetGrossProfitRate: totalTargetProfit ? salesGrossProfit / totalTargetProfit : 0,
  };
}

export function uniqueOptions(records: SalesPerformanceRecord[], field: keyof SalesPerformanceRecord) {
  return Array.from(new Set(records.map((row) => String(row[field] ?? '')).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
}

export function availableYears(records: SalesPerformanceRecord[]) {
  return Array.from(
    new Set(records.map((row) => row.confirmationYear).filter((year): year is number => Number.isFinite(year))),
  ).sort((a, b) => b - a);
}

function buildKpis(rows: SalesPerformanceRecord[]) {
  const orderAmount = sum(rows.map((row) => row.orderAmount));
  const salesGrossProfit = sum(rows.map((row) => row.salesGrossProfit));
  return {
    orderAmount,
    salesGrossProfit,
    grossProfitRate: orderAmount ? salesGrossProfit / orderAmount : 0,
    contractCount: distinctCount(rows.map((row) => row.contractNumber || row.id)),
    customerCount: distinctCount(rows.map((row) => row.customerName)),
    detailCount: rows.length,
  };
}

function groupRows(rows: SalesPerformanceRecord[], nameOf: (row: SalesPerformanceRecord) => string): SummaryRow[] {
  // 用 push 而非 spread 重建数组：把 O(N²) 降到 O(N)
  const map = new Map<string, SalesPerformanceRecord[]>();
  for (const row of rows) {
    const name = nameOf(row) || '未分类';
    const list = map.get(name);
    if (list) list.push(row);
    else map.set(name, [row]);
  }
  return Array.from(map.entries())
    .map(([name, items]) => ({ name, ...buildKpis(items) }))
    .sort((a, b) => b.orderAmount - a.orderAmount);
}
