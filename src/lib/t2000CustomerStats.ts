import type { DashboardData, NaCustomer, PerformanceRecord, PPLRecord } from '../domain';
import { normalizeBusinessKey, parseTokens } from './normalize';

export interface T2000CustomerStats {
  /** 客户名（优先 NA Sheet 的名称） */
  customer: string;
  /** 用于匹配/排序的归一化 key */
  normalizedCustomer: string;
  /** NA Sheet 中的客户类型：NA-I / NA-II / NA代管 / 空 */
  customerType: string;
  /** NA Sheet 中的客户象限 */
  quadrant: string;
  /** NA Sheet 中的客户所有人 */
  customerOwner: string;
  /** NA Sheet 中的售前 */
  presales: string;
  /** NA Sheet 中的一级行业 */
  industryLevel1: string;
  /** 来源 Sheet 名（Q1/Q3/Q4） */
  sourceSheet: string;
  /** PPL 明细中匹配的商机数 */
  opportunityCount: number;
  /** PPL 明细中匹配的 Pipeline 金额合计 */
  pipelineAmount: number;
  /** PPL 明细中匹配的 Forecast 金额合计（Commit / Best Case） */
  forecastAmount: number;
  /** 业绩明细中匹配的记录数 */
  performanceCount: number;
  /** 业绩明细中匹配的已下单金额 */
  orderAmount: number;
  /** 业绩明细中匹配的销售毛利 */
  grossProfit: number;
  /** 商机阶段分布（按金额） */
  stageBreakdown: Array<{ stage: string; amount: number; count: number }>;
}

export type T2000ProjectScope = '全部' | 'T2000' | '非T2000';

export interface T2000PipelineMix {
  t2000PipelineAmount: number;
  nonT2000PipelineAmount: number;
  totalPipelineAmount: number;
  t2000Rate: number;
  nonT2000Rate: number;
  t2000OpportunityCount: number;
  nonT2000OpportunityCount: number;
}

export interface OpportunityProjectStats {
  projectName: string;
  normalizedProjectName: string;
  t2000Status: 'T2000' | '非T2000' | '混合';
  opportunityCount: number;
  pipelineAmount: number;
  t2000PipelineAmount: number;
  nonT2000PipelineAmount: number;
  customerNames: string[];
  productLevel2: string[];
  productLevel3: string[];
  owners: string[];
  stages: string[];
}

/**
 * 基于 NA Sheet 中的"权威 T2000 名单"做客户统计。
 *
 * 数据流：
 * 1. 入口：data.naCustomers?.filter(isT2000) — 用 NA Sheet 里的 T2000 标签做权威源
 * 2. 对每个 T2000 客户：
 *    - PPL 明细：按 customerName 模糊匹配，聚合商机数/Pipeline/Forecast
 *    - 业绩明细：按最终用户模糊匹配，聚合下单/毛利
 * 3. 排序：先按 Pipeline 金额降序，再按下单金额降序
 *
 * 注意：即便某个 T2000 客户在 PPL/业绩里没有任何记录（盘点漏掉），也会保留在结果中（指标为 0），
 * 这样可以一眼看出 T2000 覆盖的"空白客户"。
 */
export function buildT2000CustomerStats(data: DashboardData): T2000CustomerStats[] {
  const naT2000List = (data.naCustomers ?? []).filter(isT2000NaCustomer);

  if (naT2000List.length === 0) {
    // 兜底：若 NA Sheet 缺失/无 T2000 客户，回退到从 PPL/业绩里识别（兼容旧数据）
    return buildT2000CustomerStatsFallback(data);
  }

  const pplIndex = indexPplByCustomer(data.ppl);
  const perfIndex = indexPerformanceByCustomer(data.performance);

  return naT2000List
    .map((na) => buildStatsFromNaCustomer(na, pplIndex, perfIndex))
    .sort((a, b) => b.pipelineAmount - a.pipelineAmount || b.orderAmount - a.orderAmount);
}

/**
 * 兜底逻辑：没有 NA Sheet 时，从 PPL/业绩中识别 T2000 客户。
 */
function buildT2000CustomerStatsFallback(data: DashboardData): T2000CustomerStats[] {
  const t2000Keys = new Set<string>();
  const customerNames = new Map<string, string>(); // key -> display name

  data.ppl.forEach((row) => {
    const key = normalizeBusinessKey(row.customerName);
    if (!key) return;
    customerNames.set(key, row.customerName.trim() || key);
    const tag = String(row.t2000CustomerTag ?? '').toLowerCase();
    if (tag.includes('t2000')) t2000Keys.add(key);
  });
  data.performance.forEach((row) => {
    if (!row.isT2000) return;
    const key = normalizeBusinessKey(row.customerName);
    if (!key) return;
    customerNames.set(key, row.customerName.trim() || key);
    t2000Keys.add(key);
  });

  const pplIndex = indexPplByCustomer(data.ppl);
  const perfIndex = indexPerformanceByCustomer(data.performance);

  return Array.from(t2000Keys)
    .map((key) => {
      const fakeNa: NaCustomer = {
        customer: customerNames.get(key) ?? key,
        customerOwner: '',
        presales: '',
        customerType: '',
        quadrant: '',
        isT2000: true,
        industryLevel1: '',
        industryLevel2: '',
        scaleTarget: '',
        sourceSheet: '（PPL/业绩 推断）',
        raw: {},
      };
      return buildStatsFromNaCustomer(fakeNa, pplIndex, perfIndex);
    })
    .sort((a, b) => b.pipelineAmount - a.pipelineAmount || b.orderAmount - a.orderAmount);
}

function buildStatsFromNaCustomer(
  na: NaCustomer,
  pplIndex: Map<string, PPLRecord[]>,
  perfIndex: Map<string, PerformanceRecord[]>,
): T2000CustomerStats {
  const key = normalizeBusinessKey(na.customer);
  const pplRows = matchRows(pplIndex, key);
  const perfRows = matchRows(perfIndex, key);

  const orderAmount = perfRows.reduce((sum, row) => sum + toNumber(row.orderAmount), 0);
  const grossProfit = perfRows.reduce((sum, row) => {
    const sg = toNumber(row.salesGrossProfit);
    return sum + (sg > 0 ? sg : toNumber(row.performanceGrossProfit));
  }, 0);

  return {
    customer: na.customer,
    normalizedCustomer: key,
    customerType: na.customerType,
    quadrant: na.quadrant,
    customerOwner: na.customerOwner,
    presales: na.presales,
    industryLevel1: na.industryLevel1,
    sourceSheet: na.sourceSheet,
    opportunityCount: pplRows.length,
    pipelineAmount: pplRows.reduce((sum, row) => sum + toNumber(row.amount), 0),
    forecastAmount: pplRows
      .filter((row) => row.forecastType === 'Commit' || row.forecastType === 'Best Case')
      .reduce((sum, row) => sum + toNumber(row.amount), 0),
    performanceCount: perfRows.length,
    orderAmount,
    grossProfit,
    stageBreakdown: buildStageBreakdown(pplRows),
  };
}

/**
 * 按客户名称过滤 stats（多值、模糊匹配）。
 * 空输入 → 返回全部。
 */
export function filterT2000Stats(stats: T2000CustomerStats[], input: string): T2000CustomerStats[] {
  const tokens = parseTokens(input);
  if (tokens.length === 0) return stats;
  const matched = new Set<string>();
  for (const token of tokens) {
    const needle = normalizeBusinessKey(token);
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
 * 按 NA Sheet 的客户类型过滤。
 * 空 / '全部' → 不过滤。
 */
export function filterT2000ByType(stats: T2000CustomerStats[], type: string): T2000CustomerStats[] {
  if (!type || type === '全部') return stats;
  return stats.filter((item) => item.customerType === type);
}

export function summarizeT2000Stats(stats: T2000CustomerStats[]) {
  return {
    customerCount: stats.length,
    opportunityCount: stats.reduce((sum, item) => sum + item.opportunityCount, 0),
    pipelineAmount: stats.reduce((sum, item) => sum + item.pipelineAmount, 0),
    forecastAmount: stats.reduce((sum, item) => sum + item.forecastAmount, 0),
    performanceCount: stats.reduce((sum, item) => sum + item.performanceCount, 0),
    orderAmount: stats.reduce((sum, item) => sum + item.orderAmount, 0),
    grossProfit: stats.reduce((sum, item) => sum + item.grossProfit, 0),
  };
}

export function exportT2000StatsCsv(stats: T2000CustomerStats[]): string {
  const header = [
    '客户',
    '客户类型',
    '象限',
    '客户所有人',
    '售前',
    '一级行业',
    '来源Sheet',
    '商机数',
    'Pipeline金额(万元)',
    'Forecast金额(万元)',
    '业绩记录数',
    '已下单金额(万元)',
    '销售毛利(万元)',
  ];
  const rows = stats.map((item) => [
    item.customer,
    item.customerType || '',
    item.quadrant || '',
    item.customerOwner || '',
    item.presales || '',
    item.industryLevel1 || '',
    item.sourceSheet,
    item.opportunityCount.toString(),
    item.pipelineAmount.toFixed(2),
    item.forecastAmount.toFixed(2),
    item.performanceCount.toString(),
    item.orderAmount.toFixed(2),
    item.grossProfit.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function buildT2000PipelineMix(
  data: DashboardData,
  projectInput = '',
  scope: T2000ProjectScope = '全部',
): T2000PipelineMix {
  const rows = filterProjectRows(classifyPplRowsByT2000(data), projectInput, scope);
  const t2000Rows = rows.filter((row) => row.isT2000);
  const nonT2000Rows = rows.filter((row) => !row.isT2000);
  const t2000PipelineAmount = sumPplAmount(t2000Rows.map((row) => row.record));
  const nonT2000PipelineAmount = sumPplAmount(nonT2000Rows.map((row) => row.record));
  const totalPipelineAmount = t2000PipelineAmount + nonT2000PipelineAmount;
  return {
    t2000PipelineAmount,
    nonT2000PipelineAmount,
    totalPipelineAmount,
    t2000Rate: totalPipelineAmount > 0 ? t2000PipelineAmount / totalPipelineAmount : 0,
    nonT2000Rate: totalPipelineAmount > 0 ? nonT2000PipelineAmount / totalPipelineAmount : 0,
    t2000OpportunityCount: t2000Rows.length,
    nonT2000OpportunityCount: nonT2000Rows.length,
  };
}

export function buildOpportunityProjectStats(
  data: DashboardData,
  projectInput = '',
  scope: T2000ProjectScope = '全部',
): OpportunityProjectStats[] {
  const rows = filterProjectRows(classifyPplRowsByT2000(data), projectInput, scope);
  const grouped = new Map<
    string,
    {
      projectName: string;
      normalizedProjectName: string;
      opportunityCount: number;
      pipelineAmount: number;
      t2000PipelineAmount: number;
      nonT2000PipelineAmount: number;
      customerNames: Set<string>;
      productLevel2: Set<string>;
      productLevel3: Set<string>;
      owners: Set<string>;
      stages: Set<string>;
    }
  >();

  rows.forEach(({ record, isT2000 }) => {
    const projectName = normalizeProjectName(record.opportunityName);
    const key = normalizeBusinessKey(projectName);
    const current = grouped.get(key) ?? {
      projectName,
      normalizedProjectName: key,
      opportunityCount: 0,
      pipelineAmount: 0,
      t2000PipelineAmount: 0,
      nonT2000PipelineAmount: 0,
      customerNames: new Set<string>(),
      productLevel2: new Set<string>(),
      productLevel3: new Set<string>(),
      owners: new Set<string>(),
      stages: new Set<string>(),
    };
    const amount = toNumber(record.amount);
    current.opportunityCount += 1;
    current.pipelineAmount += amount;
    if (isT2000) current.t2000PipelineAmount += amount;
    else current.nonT2000PipelineAmount += amount;
    if (record.customerName.trim()) current.customerNames.add(record.customerName.trim());
    const productLevel2 = readPplProductLevel(record, 2);
    const productLevel3 = readPplProductLevel(record, 3);
    if (productLevel2) current.productLevel2.add(productLevel2);
    if (productLevel3) current.productLevel3.add(productLevel3);
    if (record.owner.trim()) current.owners.add(record.owner.trim());
    if (record.stage.trim()) current.stages.add(record.stage.trim());
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      t2000Status: projectT2000Status(item.t2000PipelineAmount, item.nonT2000PipelineAmount),
      customerNames: [...item.customerNames].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      productLevel2: [...item.productLevel2].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      productLevel3: [...item.productLevel3].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      owners: [...item.owners].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      stages: [...item.stages].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    }))
    .sort(
      (a, b) => b.pipelineAmount - a.pipelineAmount || a.projectName.localeCompare(b.projectName, 'zh-CN'),
    );
}

export function exportOpportunityProjectStatsCsv(stats: OpportunityProjectStats[]): string {
  const header = [
    '商机项目名称',
    'T2000状态',
    '商机数',
    'Pipeline金额(万元)',
    'T2000 Pipeline金额(万元)',
    '非T2000 Pipeline金额(万元)',
    '客户',
    '二级产品',
    '三级产品',
    'Pipeline所有人',
    '阶段',
  ];
  const rows = stats.map((item) => [
    item.projectName,
    item.t2000Status,
    item.opportunityCount.toString(),
    item.pipelineAmount.toFixed(2),
    item.t2000PipelineAmount.toFixed(2),
    item.nonT2000PipelineAmount.toFixed(2),
    item.customerNames.join(' / '),
    item.productLevel2.join(' / '),
    item.productLevel3.join(' / '),
    item.owners.join(' / '),
    item.stages.join(' / '),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function isT2000NaCustomer(na: NaCustomer): boolean {
  return na.isT2000 || na.scaleTarget.length > 0;
}

function projectT2000Status(
  t2000PipelineAmount: number,
  nonT2000PipelineAmount: number,
): OpportunityProjectStats['t2000Status'] {
  if (t2000PipelineAmount > 0 && nonT2000PipelineAmount > 0) return '混合';
  if (t2000PipelineAmount > 0) return 'T2000';
  return '非T2000';
}

function classifyPplRowsByT2000(data: DashboardData): Array<{ record: PPLRecord; isT2000: boolean }> {
  const t2000Customers = (data.naCustomers ?? []).filter(isT2000NaCustomer);
  return data.ppl.map((record) => ({
    record,
    isT2000: isCustomerInT2000List(record.customerName, t2000Customers),
  }));
}

function isCustomerInT2000List(customerName: string, t2000Customers: NaCustomer[]) {
  const key = normalizeBusinessKey(customerName);
  if (!key) return false;
  return t2000Customers.some((customer) => {
    const t2000Key = normalizeBusinessKey(customer.customer);
    return Boolean(t2000Key && (key === t2000Key || key.includes(t2000Key) || t2000Key.includes(key)));
  });
}

function filterProjectRows(
  rows: Array<{ record: PPLRecord; isT2000: boolean }>,
  projectInput: string,
  scope: T2000ProjectScope,
) {
  const tokens = parseTokens(projectInput).map(normalizeBusinessKey).filter(Boolean);
  return rows.filter((row) => {
    if (scope === 'T2000' && !row.isT2000) return false;
    if (scope === '非T2000' && row.isT2000) return false;
    if (tokens.length === 0) return true;
    const projectKey = normalizeBusinessKey(normalizeProjectName(row.record.opportunityName));
    return tokens.some((token) => projectKey.includes(token) || token.includes(projectKey));
  });
}

function normalizeProjectName(name: string) {
  const trimmed = String(name ?? '').trim();
  return trimmed || '未填写商机项目';
}

function readPplProductLevel(record: PPLRecord, level: 2 | 3) {
  const direct = level === 2 ? record.productLevel2 : record.productLevel3;
  if (direct?.trim()) return direct.trim();
  const aliases =
    level === 2
      ? ['二级产品分类', '二级分类', '产品二级分类', '二级产品线']
      : ['三级产品分类', '三级分类', '产品三级分类', '三类产品分类', '三层产品分类'];
  for (const alias of aliases) {
    const value = String(record.raw[alias] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function sumPplAmount(rows: PPLRecord[]) {
  return rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
}

function buildStageBreakdown(rows: PPLRecord[]): Array<{ stage: string; amount: number; count: number }> {
  const map = new Map<string, { stage: string; amount: number; count: number }>();
  rows.forEach((row) => {
    const stage = normalizeStage(row.stage);
    const current = map.get(stage) ?? { stage, amount: 0, count: 0 };
    current.amount += toNumber(row.amount);
    current.count += 1;
    map.set(stage, current);
  });
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

function normalizeStage(stage: string): string {
  const text = String(stage ?? '').trim();
  return text || '未分类';
}

function indexPplByCustomer(rows: PPLRecord[]): Map<string, PPLRecord[]> {
  const map = new Map<string, PPLRecord[]>();
  rows.forEach((row) => {
    const key = normalizeBusinessKey(row.customerName);
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  });
  return map;
}

function indexPerformanceByCustomer(rows: PerformanceRecord[]): Map<string, PerformanceRecord[]> {
  const map = new Map<string, PerformanceRecord[]>();
  rows.forEach((row) => {
    const key = normalizeBusinessKey(row.customerName);
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  });
  return map;
}

/**
 * NA Sheet 中的客户名可能比 PPL/业绩里的更简化（例如"南京证券" vs "南京证券股份有限公司"），
 * 因此这里同时尝试精确匹配和包含式匹配，取并集。
 */
function matchRows<T extends { customerName: string }>(index: Map<string, T[]>, key: string): T[] {
  const exact = index.get(key) ?? [];
  if (exact.length > 0) return exact;
  const partial: T[] = [];
  index.forEach((rows, k) => {
    if (k === key) return;
    if (k.includes(key) || key.includes(k)) {
      partial.push(...rows);
    }
  });
  return partial;
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
