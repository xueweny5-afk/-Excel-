import type { DashboardData, PPLRecord } from '../domain';

export interface SalesDimensionStats {
  /** 主键：PPL 明细的 owner（Pipeline 所有人 / 销售 / 售前） */
  owner: string;
  /** 归一化 key（去空白），用于模糊匹配 */
  normalizedOwner: string;
  /** 覆盖客户数（PPL 中该 owner 名下 customerName 去重） */
  customerCount: number;
  /** PPL 条数 */
  opportunityCount: number;
  /** Pipeline 金额合计 */
  pipelineAmount: number;
  /** Forecast 金额合计（Commit / Best Case） */
  forecastAmount: number;
  /** T2000 商机数 */
  t2000OpportunityCount: number;
  /** T2000 商机金额 */
  t2000OpportunityAmount: number;
  /** 已立项及以上商机数 */
  establishedCount: number;
  /** 已立项及以上商机金额 */
  establishedAmount: number;
  /** 同客户 owner 反查业绩的下单金额 */
  orderAmount: number;
  /** 同客户 owner 反查业绩的销售毛利 */
  grossProfit: number;
}

/**
 * 按 PPL 明细的 owner（Pipeline 所有人 / 售前）做主键聚合。
 *
 * 业绩金额归属逻辑：
 * - 从该 owner 名下的所有客户名（PPL 中去重）作为客户白名单
 * - 反向在业绩明细中按"最终用户"双向包含匹配
 * - 累加匹配上的 orderAmount 和 salesGrossProfit || performanceGrossProfit
 */
export function buildSalesDimensionStats(data: DashboardData): SalesDimensionStats[] {
  const rows = data.ppl;
  const performanceRows = data.performance ?? [];

  // owner → PPL 行索引
  const ownerRowsMap = new Map<string, PPLRecord[]>();
  rows.forEach((row) => {
    const key = normalizeOwner(row.owner);
    if (!key) return;
    const list = ownerRowsMap.get(key) ?? [];
    list.push(row);
    ownerRowsMap.set(key, list);
  });

  // 全局 customer → owners 索引（用于业绩反查：业绩里 customer 出现在哪个 owner 名下）
  const customerOwners = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const ownerKey = normalizeOwner(row.owner);
    if (!ownerKey) return;
    const customerKey = normalizeCustomer(row.customerName);
    if (!customerKey) return;
    const set = customerOwners.get(customerKey) ?? new Set<string>();
    set.add(ownerKey);
    customerOwners.set(customerKey, set);
  });

  // 业绩按 customer 反查 owner 累加订单/毛利
  // 注：业绩里的 customerName 可能是简称，PPL 里是全称，所以用双向包含匹配
  const ownerPerfMap = new Map<string, { order: number; profit: number }>();
  performanceRows.forEach((row) => {
    const customerKey = normalizeCustomer(row.customerName);
    if (!customerKey) return;
    // 遍历所有 PPL 客户名做双向包含匹配
    const matchedOwners = new Set<string>();
    customerOwners.forEach((owners, pplCustomer) => {
      if (customerKey.includes(pplCustomer) || pplCustomer.includes(customerKey)) {
        owners.forEach((o) => matchedOwners.add(o));
      }
    });
    if (matchedOwners.size === 0) return;
    const ownerCount = matchedOwners.size;
    const orderShare = toNumber(row.orderAmount) / ownerCount;
    const profitShare = toNumber(row.salesGrossProfit) > 0
      ? toNumber(row.salesGrossProfit) / ownerCount
      : toNumber(row.performanceGrossProfit) / ownerCount;
    matchedOwners.forEach((ownerKey) => {
      const current = ownerPerfMap.get(ownerKey) ?? { order: 0, profit: 0 };
      current.order += orderShare;
      current.profit += profitShare;
      ownerPerfMap.set(ownerKey, current);
    });
  });

  // 同时构建 owner 自己的业绩（业绩归属明确为单一 owner 时）
  // 注：上面 customerOwners 是按 PPL 的 customer→owners 反查；如果业绩里 customer 只对应 1 个 owner，
  // ownerCount=1 时等同于"业绩完整归该 owner"，逻辑正确。

  const result: SalesDimensionStats[] = [];
  ownerRowsMap.forEach((ownerRows, ownerKey) => {
    const displayName = pickDisplayOwner(ownerRows, ownerKey);
    const customers = new Set<string>();
    let pipelineAmount = 0;
    let forecastAmount = 0;
    let t2000Count = 0;
    let t2000Amount = 0;
    let establishedCount = 0;
    let establishedAmount = 0;

    ownerRows.forEach((row) => {
      const customer = normalizeCustomer(row.customerName);
      if (customer) customers.add(customer);
      const amount = toNumber(row.amount);
      pipelineAmount += amount;
      if (isForecastRow(row)) forecastAmount += amount;
      if (isT2000Row(row)) {
        t2000Count += 1;
        t2000Amount += amount;
      }
      if (isEstablishedRow(row)) {
        establishedCount += 1;
        establishedAmount += amount;
      }
    });

    const perf = ownerPerfMap.get(ownerKey) ?? { order: 0, profit: 0 };

    result.push({
      owner: displayName,
      normalizedOwner: ownerKey,
      customerCount: customers.size,
      opportunityCount: ownerRows.length,
      pipelineAmount,
      forecastAmount,
      t2000OpportunityCount: t2000Count,
      t2000OpportunityAmount: t2000Amount,
      establishedCount,
      establishedAmount,
      orderAmount: perf.order,
      grossProfit: perf.profit,
    });
  });

  return result.sort((a, b) =>
    b.pipelineAmount - a.pipelineAmount ||
    b.customerCount - a.customerCount ||
    a.owner.localeCompare(b.owner, 'zh-CN'),
  );
}

/**
 * 按输入的 owner 名称过滤 stats。
 * 留空 → 返回全部；多值用逗号/空格/换行分隔。
 */
export function filterSalesStats(stats: SalesDimensionStats[], input: string): SalesDimensionStats[] {
  const tokens = parseInput(input);
  if (tokens.length === 0) return stats;
  const matched = new Set<string>();
  for (const token of tokens) {
    const needle = normalizeOwner(token);
    if (!needle) continue;
    stats.forEach((item) => {
      if (item.normalizedOwner.includes(needle) || needle.includes(item.normalizedOwner)) {
        matched.add(item.owner);
      }
    });
  }
  return stats.filter((item) => matched.has(item.owner));
}

export function summarizeSalesStats(stats: SalesDimensionStats[]) {
  return {
    ownerCount: stats.length,
    customerCount: stats.reduce((s, i) => s + i.customerCount, 0),
    opportunityCount: stats.reduce((s, i) => s + i.opportunityCount, 0),
    pipelineAmount: stats.reduce((s, i) => s + i.pipelineAmount, 0),
    forecastAmount: stats.reduce((s, i) => s + i.forecastAmount, 0),
    t2000OpportunityCount: stats.reduce((s, i) => s + i.t2000OpportunityCount, 0),
    t2000OpportunityAmount: stats.reduce((s, i) => s + i.t2000OpportunityAmount, 0),
    establishedCount: stats.reduce((s, i) => s + i.establishedCount, 0),
    establishedAmount: stats.reduce((s, i) => s + i.establishedAmount, 0),
    orderAmount: stats.reduce((s, i) => s + i.orderAmount, 0),
    grossProfit: stats.reduce((s, i) => s + i.grossProfit, 0),
  };
}

/**
 * 根据 owner 名称取该 owner 名下的所有 PPL 明细行（用于下钻）。
 *
 * 用归一化 key 双向模糊匹配：PPL 里"张磊"和"张磊 "（带空格）都会被识别。
 * 优先精确匹配，找不到再做模糊包含。
 */
export function getPplRowsByOwner(
  data: DashboardData,
  ownerDisplay: string,
): PPLRecord[] {
  const target = normalizeOwner(ownerDisplay);
  if (!target) return [];
  const rows = data.ppl;
  // 先精确匹配
  const exact = rows.filter((row) => normalizeOwner(row.owner) === target);
  if (exact.length > 0) return exact;
  // 再模糊匹配（owner 输入可能有变体，比如包含字符差异）
  return rows.filter((row) => {
    const key = normalizeOwner(row.owner);
    return key && (target.includes(key) || key.includes(target));
  });
}

export function exportSalesStatsCsv(stats: SalesDimensionStats[]): string {
  const header = [
    'Pipeline所有人',
    '覆盖客户数',
    '商机数',
    'Pipeline金额(万元)',
    'Forecast金额(万元)',
    'T2000商机数',
    'T2000商机金额(万元)',
    '已立项数',
    '已立项金额(万元)',
    '已下单金额(万元)',
    '销售毛利(万元)',
  ];
  const rows = stats.map((item) => [
    item.owner,
    item.customerCount.toString(),
    item.opportunityCount.toString(),
    item.pipelineAmount.toFixed(2),
    item.forecastAmount.toFixed(2),
    item.t2000OpportunityCount.toString(),
    item.t2000OpportunityAmount.toFixed(2),
    item.establishedCount.toString(),
    item.establishedAmount.toFixed(2),
    item.orderAmount.toFixed(2),
    item.grossProfit.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function pickDisplayOwner(rows: PPLRecord[], normalizedKey: string): string {
  const first = rows[0]?.owner?.trim();
  return first || normalizedKey;
}

function isForecastRow(row: PPLRecord): boolean {
  return row.forecastType === 'Commit' || row.forecastType === 'Best Case';
}

function isT2000Row(row: PPLRecord): boolean {
  const tag = String(row.t2000CustomerTag ?? '').toLowerCase();
  return tag.includes('t2000');
}

function isEstablishedRow(row: PPLRecord): boolean {
  const stage = String(row.stage ?? '');
  return stage.includes('立项') || stage.includes('预算到位') ||
    stage.includes('方案评估') || stage.includes('共识') ||
    stage.includes('品牌') || stage.includes('招标') || stage.includes('采购') ||
    stage.includes('Forecast');
}

function parseInput(input: string): string[] {
  if (!input) return [];
  return input.split(/[\s,，；;、\n\r]+/).map((s) => s.trim()).filter(Boolean);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value.replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function normalizeOwner(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}

function normalizeCustomer(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}