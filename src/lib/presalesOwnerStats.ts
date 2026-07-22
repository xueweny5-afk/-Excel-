import type { DashboardData, PPLRecord } from '../domain';

export interface CustomerStats {
  /** 业绩明细中的"最终用户"作为主键 */
  customer: string;
  /** 用于排序/匹配的归一化客户名（去除空白） */
  normalizedCustomer: string;
  /** 是否 T2000 客户（任一业绩/商机记录命中即标记为 true） */
  isT2000: boolean;
  /** 业绩记录条数 */
  performanceCount: number;
  /** PPL 明细中的商机数 */
  opportunityCount: number;
  /** PPL Pipeline 金额合计 */
  pipelineAmount: number;
  /** PPL Forecast 金额合计（Commit / Best Case） */
  forecastAmount: number;
  /** 业绩明细中的下单金额合计 */
  orderAmount: number;
  /** 业绩明细中的销售毛利（优先 salesGrossProfit，否则 performanceGrossProfit） */
  grossProfit: number;
}

/**
 * 按业绩明细中的"最终用户"（PerformanceRecord.customerName）做主键聚合。
 *
 * 数据来源：
 * - 下单金额 / 销售毛利：业绩明细（主）
 * - 商机数 / Pipeline / Forecast：PPL 明细（按 customerName 反向补齐）
 *
 * 即使某客户只有 PPL 没有业绩，也会出现在列表里（下单金额/毛利为 0）；
 * 只有业绩没有 PPL 的客户也会保留（下单金额>0，商机数为 0）。
 */
export function buildPresalesOwnerStats(data: DashboardData): CustomerStats[] {
  const pplByCustomer = new Map<string, PPLRecord[]>();
  data.ppl.forEach((row) => {
    const key = normalizeCustomer(row.customerName);
    if (!key) return;
    const list = pplByCustomer.get(key) ?? [];
    list.push(row);
    pplByCustomer.set(key, list);
  });

  // 业绩按最终用户聚合
  const perfByCustomer = new Map<string, { order: number; profit: number; count: number; isT2000: boolean }>();
  data.performance.forEach((row) => {
    const key = normalizeCustomer(row.customerName);
    if (!key) return;
    const current = perfByCustomer.get(key) ?? { order: 0, profit: 0, count: 0, isT2000: false };
    current.order += toNumber(row.orderAmount);
    // 单条记录优先使用 salesGrossProfit，为 0 时才回退到 performanceGrossProfit
    const profit = toNumber(row.salesGrossProfit) > 0
      ? toNumber(row.salesGrossProfit)
      : toNumber(row.performanceGrossProfit);
    current.profit += profit;
    current.count += 1;
    if (row.isT2000) current.isT2000 = true;
    perfByCustomer.set(key, current);
  });

  // T2000 标签从 PPL 补齐
  const t2000Set = new Set<string>();
  data.ppl.forEach((row) => {
    if (!row.t2000CustomerTag) return;
    if (!String(row.t2000CustomerTag).toLowerCase().includes('t2000')) return;
    const key = normalizeCustomer(row.customerName);
    if (key) t2000Set.add(key);
  });

  // 合并：业绩主，PPL 补
  const allKeys = new Set<string>();
  pplByCustomer.forEach((_, k) => allKeys.add(k));
  perfByCustomer.forEach((_, k) => allKeys.add(k));

  const result: CustomerStats[] = [];
  allKeys.forEach((key) => {
    const ppl = pplByCustomer.get(key) ?? [];
    const perf = perfByCustomer.get(key);
    const displayName = pickDisplayName(ppl, key, data);
    result.push({
      customer: displayName,
      normalizedCustomer: key,
      isT2000: Boolean(perf?.isT2000) || t2000Set.has(key),
      performanceCount: perf?.count ?? 0,
      opportunityCount: ppl.length,
      pipelineAmount: sumRows(ppl, 'amount'),
      forecastAmount: sumRows(ppl.filter(isForecastRow), 'amount'),
      orderAmount: perf?.order ?? 0,
      grossProfit: perf?.profit ?? 0,
    });
  });

  return result.sort((a, b) => {
    // 优先按下单金额降序，无业绩时按 Pipeline 降序
    if (b.orderAmount !== a.orderAmount) return b.orderAmount - a.orderAmount;
    if (b.pipelineAmount !== a.pipelineAmount) return b.pipelineAmount - a.pipelineAmount;
    return a.customer.localeCompare(b.customer, 'zh-CN');
  });
}

/**
 * 按输入的客户名称过滤 stats。
 *
 * 输入规则：
 * - 空字符串 / 仅空白：返回全部
 * - 单值：模糊匹配 customer（包含关系，忽略大小写/空格）
 * - 多值：用逗号/空格/换行/分号/顿号分隔，逐个模糊匹配，去重
 */
export function filterOwnerStats(stats: CustomerStats[], input: string): CustomerStats[] {
  const tokens = parseInput(input);
  if (tokens.length === 0) return stats;
  const matched = new Set<string>();
  for (const token of tokens) {
    const needle = normalizeCustomer(token);
    if (!needle) continue;
    stats.forEach((item) => {
      if (item.normalizedCustomer.includes(needle) || needle.includes(item.normalizedCustomer)) {
        matched.add(item.customer);
      }
    });
  }
  return stats.filter((item) => matched.has(item.customer));
}

/**
 * 聚合输出多个客户的合计（用于顶部 summary 行）。
 */
export function summarizeStats(stats: CustomerStats[]) {
  return {
    customerCount: stats.length,
    opportunityCount: stats.reduce((sum, item) => sum + item.opportunityCount, 0),
    pipelineAmount: stats.reduce((sum, item) => sum + item.pipelineAmount, 0),
    forecastAmount: stats.reduce((sum, item) => sum + item.forecastAmount, 0),
    orderAmount: stats.reduce((sum, item) => sum + item.orderAmount, 0),
    grossProfit: stats.reduce((sum, item) => sum + item.grossProfit, 0),
    performanceCount: stats.reduce((sum, item) => sum + item.performanceCount, 0),
  };
}

/**
 * 导出 customer stats 为 CSV 字符串（UTF-8 BOM 由调用方负责添加）。
 */
export function exportOwnerStatsCsv(stats: CustomerStats[]): string {
  const header = [
    '客户',
    'T2000',
    '商机数',
    'Pipeline金额(万元)',
    'Forecast金额(万元)',
    '业绩记录数',
    '下单金额(万元)',
    '销售毛利(万元)',
  ];
  const rows = stats.map((item) => [
    item.customer,
    item.isT2000 ? '是' : '否',
    item.opportunityCount.toString(),
    item.pipelineAmount.toFixed(2),
    item.forecastAmount.toFixed(2),
    item.performanceCount.toString(),
    item.orderAmount.toFixed(2),
    item.grossProfit.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function parseInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\s,，；;、\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function pickDisplayName(
  ppl: PPLRecord[],
  normalizedKey: string,
  data: DashboardData,
): string {
  // 优先 PPL 的客户名（更完整），其次业绩中的客户名，最后 raw 里查找
  const fromPpl = ppl[0]?.customerName?.trim();
  if (fromPpl) return fromPpl;
  const fromPerf = data.performance.find((row) => normalizeCustomer(row.customerName) === normalizedKey)?.customerName?.trim();
  if (fromPerf) return fromPerf;
  return normalizedKey;
}

function sumRows(rows: PPLRecord[], key: keyof PPLRecord): number {
  return rows.reduce((total, row) => total + toNumber(row[key]), 0);
}

function isForecastRow(row: PPLRecord): boolean {
  return row.forecastType === 'Commit' || row.forecastType === 'Best Case';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value.replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function normalizeCustomer(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}