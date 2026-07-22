import type { DashboardData, PerformanceRecord, PPLRecord } from '../domain';
import { buildPresalesOwnerStats, type CustomerStats } from './presalesOwnerStats';
import { buildT2000CustomerStats, type T2000CustomerStats } from './t2000CustomerStats';
import { buildSalesDimensionStats, type SalesDimensionStats } from './salesDimensionStats';

export type PresalesStatus = '已完成' | '正常推进' | '中风险' | '高风险';
export type ProductLineKey = 'aiXdr' | 'trustOne' | 'ds';

export interface TargetMetric {
  key: string;
  name: string;
  target: number;
  actual: number;
  unit: '万元' | '个';
  rate: number;
  gap: number;
  status: PresalesStatus;
}

export interface ProductLineMetric {
  key: ProductLineKey;
  name: string;
  opportunityCount: number;
  projectCount: number;
  opportunityAmount: number;
  opportunityTarget: number;
  opportunityGap: number;
  orderAmount: number;
  orderTarget: number;
  orderGap: number;
  advice: string;
}

export interface QualityRiskItem {
  type: '红色风险' | '黄色风险' | '绿色机会' | '无效商机';
  customerName: string;
  opportunityName: string;
  amount: number;
  stage: string;
  winRate: number;
  reason: string;
}

export interface PresalesAnalysis {
  kpis: {
    pipelineAmount: number;
    pipelineRate: number;
    profitAmount: number;
    profitRate: number;
    t2000OpportunityAmount: number;
    aiXdrOpportunityAmount: number;
    forecastAmount: number;
    orderAmount: number;
  };
  targetMetrics: TargetMetric[];
  productLines: ProductLineMetric[];
  stageFunnel: Array<{ name: string; value: number; count: number }>;
  managementInsights: string[];
  quality: {
    forecastAmount: number;
    forecastRate: number;
    highWinNotForecastCount: number;
    highWinNotForecastAmount: number;
    invalidCount: number;
    risks: QualityRiskItem[];
  };
  weeklyReport: string;
  notes: string[];
  ownerStats: CustomerStats[];
  t2000Stats: T2000CustomerStats[];
  salesDimensionStats: SalesDimensionStats[];
}

const TARGETS = {
  profit: 700,
  pipeline: 4000,
  t2000Coverage: 20,
  t2000Opportunity: 1920,
  t2000Order: 480,
  aiXdrProject: 24,
  aiXdrCount: 24,
  aiXdrOpportunity: 1680,
  aiXdrOrder: 420,
  trustOneOpportunity: 1040,
  trustOneOrder: 260,
  dsOpportunity: 1040,
  dsOrder: 260,
} as const;

export function analyzePresalesDashboard(data: DashboardData): PresalesAnalysis {
  const rows = data.ppl;
  const performanceRows = data.performance ?? [];
  const pipelineAmount = sum(rows.map((row) => row.amount));
  const forecastRows = rows.filter(isForecast);
  const forecastAmount = sum(forecastRows.map((row) => row.amount));
  const t2000Rows = rows.filter(isT2000);
  const t2000OpportunityAmount = sum(t2000Rows.map((row) => row.amount));
  const t2000Coverage = new Set(t2000Rows.map((row) => row.customerName).filter(Boolean)).size;
  const aiXdrRows = rows.filter((row) => productLineOf(row) === 'aiXdr');
  const trustOneRows = rows.filter((row) => productLineOf(row) === 'trustOne');
  const dsRows = rows.filter((row) => productLineOf(row) === 'ds');
  const aiXdrOrders = performanceRows.filter((row) => performanceProductLineOf(row) === 'aiXdr');
  const trustOneOrders = performanceRows.filter((row) => performanceProductLineOf(row) === 'trustOne');
  const dsOrders = performanceRows.filter((row) => performanceProductLineOf(row) === 'ds');
  const aiProjectCount = aiXdrRows.filter(isProjectEstablished).length;
  const profitAmount = sum(performanceRows.map((row) => row.salesGrossProfit || row.performanceGrossProfit));
  const orderAmount = sum(performanceRows.map((row) => row.orderAmount));
  // T2000 订单金额：先用 PPL 中打了 T2000 标签的客户作为权威名单，去业绩里匹配累加。
  // 这样避免业绩明细的 "客户是否T2000" 字段未填导致漏算（参考文件业绩中该字段只有 2 个客户，全为 0）。
  const t2000OrderAmount = sumT2000OrderFromPpl(rows, performanceRows);
  const aiXdrOrderAmount = sum(aiXdrOrders.map((row) => row.orderAmount));
  const trustOneOrderAmount = sum(trustOneOrders.map((row) => row.orderAmount));
  const dsOrderAmount = sum(dsOrders.map((row) => row.orderAmount));

  const productLines: ProductLineMetric[] = [
    buildProductLine(
      'aiXdr',
      'AI XDR',
      aiXdrRows,
      TARGETS.aiXdrOpportunity,
      TARGETS.aiXdrOrder,
      aiProjectCount,
      aiXdrOrderAmount,
    ),
    buildProductLine(
      'trustOne',
      'TrustOne',
      trustOneRows,
      TARGETS.trustOneOpportunity,
      TARGETS.trustOneOrder,
      undefined,
      trustOneOrderAmount,
    ),
    buildProductLine('ds', 'DS', dsRows, TARGETS.dsOpportunity, TARGETS.dsOrder, undefined, dsOrderAmount),
  ];

  const targetMetrics = [
    metric('profit', '个人毛利', TARGETS.profit, profitAmount, '万元'),
    metric('pipeline', '商机储备', TARGETS.pipeline, pipelineAmount, '万元'),
    metric('t2000Coverage', 'T2000 覆盖', TARGETS.t2000Coverage, t2000Coverage, '个'),
    metric('t2000Opportunity', 'T2000 商机', TARGETS.t2000Opportunity, t2000OpportunityAmount, '万元'),
    metric('t2000Order', 'T2000 订单', TARGETS.t2000Order, t2000OrderAmount, '万元'),
    metric('aiXdrProject', 'AI XDR 立项', TARGETS.aiXdrProject, aiProjectCount, '个'),
    metric('aiXdrCount', 'AI XDR 商机数', TARGETS.aiXdrCount, aiXdrRows.filter(isProjectEstablished).length, '个'),
    metric('aiXdrOpportunity', 'AI XDR 商机', TARGETS.aiXdrOpportunity, sum(aiXdrRows.map((row) => row.amount)), '万元'),
    metric('aiXdrOrder', 'AI XDR 订单', TARGETS.aiXdrOrder, aiXdrOrderAmount, '万元'),
    metric('trustOneOpportunity', 'TrustOne 商机', TARGETS.trustOneOpportunity, sum(trustOneRows.map((row) => row.amount)), '万元'),
    metric('trustOneOrder', 'TrustOne 订单', TARGETS.trustOneOrder, trustOneOrderAmount, '万元'),
    metric('dsOpportunity', 'DS 商机', TARGETS.dsOpportunity, sum(dsRows.map((row) => row.amount)), '万元'),
    metric('dsOrder', 'DS 订单', TARGETS.dsOrder, dsOrderAmount, '万元'),
  ];

  const quality = buildQuality(rows, forecastAmount, pipelineAmount);
  const stageFunnel = buildStageFunnel(rows);
  const managementInsights = buildInsights(pipelineAmount, forecastAmount, productLines, stageFunnel);

  const notes = [
    performanceRows.length > 0
      ? `已接入业绩明细 ${performanceRows.length.toLocaleString('zh-CN')} 行，毛利、已下单和产品线订单按业绩明细统计。`
      : '当前未识别到业绩明细 Sheet，毛利、已下单和产品线订单暂为 0。',
    'NA 客户 Sheet 尚未结构化接入。',
    '本周新增字段尚未接入，周报中的本周新增暂按 0 展示。',
  ];

  return {
    kpis: {
      pipelineAmount,
      pipelineRate: rate(pipelineAmount, TARGETS.pipeline),
      profitAmount,
      profitRate: rate(profitAmount, TARGETS.profit),
      t2000OpportunityAmount,
      aiXdrOpportunityAmount: sum(aiXdrRows.map((row) => row.amount)),
      forecastAmount,
      orderAmount,
    },
    targetMetrics,
    productLines,
    stageFunnel,
    managementInsights,
    quality,
    weeklyReport: buildWeeklyReport(targetMetrics, productLines, t2000Coverage),
    notes,
    ownerStats: buildPresalesOwnerStats(data),
    t2000Stats: buildT2000CustomerStats(data),
    salesDimensionStats: buildSalesDimensionStats(data),
  };
}

function metric(key: string, name: string, target: number, actual: number, unit: '万元' | '个'): TargetMetric {
  const completionRate = rate(actual, target);
  const gap = Math.max(0, target - actual);
  return {
    key,
    name,
    target,
    actual,
    unit,
    rate: completionRate,
    gap,
    status: statusOf(completionRate),
  };
}

function buildProductLine(
  key: ProductLineKey,
  name: string,
  rows: PPLRecord[],
  opportunityTarget: number,
  orderTarget: number,
  projectCount = rows.filter(isProjectEstablished).length,
  orderAmount = 0,
): ProductLineMetric {
  const opportunityAmount = sum(rows.map((row) => row.amount));
  return {
    key,
    name,
    opportunityCount: rows.length,
    projectCount,
    opportunityAmount,
    opportunityTarget,
    opportunityGap: Math.max(0, opportunityTarget - opportunityAmount),
    orderAmount,
    orderTarget,
    orderGap: Math.max(0, orderTarget - orderAmount),
    advice: productAdvice(key),
  };
}

function buildStageFunnel(rows: PPLRecord[]) {
  const map = new Map<string, { name: string; value: number; count: number }>();
  rows.forEach((row) => {
    const name = normalizeStageName(row.stage);
    const current = map.get(name) ?? { name, value: 0, count: 0 };
    current.value += row.amount;
    current.count += 1;
    map.set(name, current);
  });
  const preferred = ['提出需求', '项目立项', '方案评估', '内部确认', '招标采购', 'Forecast'];
  return Array.from(map.values()).sort((a, b) => preferred.indexOf(a.name) - preferred.indexOf(b.name));
}

function buildQuality(rows: PPLRecord[], forecastAmount: number, pipelineAmount: number) {
  const risks: QualityRiskItem[] = [];
  rows.forEach((row) => {
    const stageRank = stageRankOf(row.stage);
    const invalidReason = invalidReasonOf(row);
    if (invalidReason) {
      risks.push(toRisk(row, '无效商机', invalidReason));
      return;
    }
    if (isLateQuarter(row.expectedQuarter) && stageRank <= 2 && row.amount >= 50) {
      risks.push(toRisk(row, '红色风险', 'Q3/Q4 大额商机仍处于早期阶段'));
      return;
    }
    if (row.winRate >= 0.6 && !isForecast(row)) {
      risks.push(toRisk(row, '黄色风险', '高赢率商机未计入 Forecast'));
      return;
    }
    if (stageRank >= 3 && row.winRate >= 0.5 && isCurrentQuarter(row.expectedQuarter)) {
      risks.push(toRisk(row, '绿色机会', '高阶段高赢率，可优先推进落单'));
    }
  });
  const highWinNotForecast = rows.filter((row) => row.winRate >= 0.6 && !isForecast(row));
  return {
    forecastAmount,
    forecastRate: rate(forecastAmount, pipelineAmount),
    highWinNotForecastCount: highWinNotForecast.length,
    highWinNotForecastAmount: sum(highWinNotForecast.map((row) => row.amount)),
    invalidCount: rows.filter(invalidReasonOf).length,
    risks: risks.sort((a, b) => b.amount - a.amount).slice(0, 30),
  };
}

function buildInsights(
  pipelineAmount: number,
  forecastAmount: number,
  productLines: ProductLineMetric[],
  stageFunnel: Array<{ name: string; value: number }>,
) {
  const insights: string[] = [];
  insights.push(
    pipelineAmount >= TARGETS.pipeline
      ? '商机储备已达到目标，下一步应关注 Forecast 和高阶段转化。'
      : '商机储备仍有缺口，需要补充有效项目池。',
  );
  if (rate(forecastAmount, pipelineAmount) < 0.3) {
    insights.push('Forecast 金额占比较低，建议把高赢率、高阶段、本季度商机纳入候选池。');
  }
  const gapLines = productLines.filter((line) => line.opportunityGap > 0);
  if (gapLines.length > 0) {
    insights.push(`${gapLines.map((line) => line.name).join('、')} 产品线仍存在目标缺口。`);
  }
  const earlyAmount = sum(stageFunnel.filter((item) => item.name === '提出需求' || item.name === '项目立项').map((item) => item.value));
  if (pipelineAmount > 0 && earlyAmount / pipelineAmount > 0.55) {
    insights.push('当前商机集中在早期阶段，需要推动立项、方案评估和内部确认。');
  }
  return insights.slice(0, 4);
}

function buildWeeklyReport(targets: TargetMetric[], productLines: ProductLineMetric[], t2000Coverage: number) {
  const byKey = new Map(targets.map((item) => [item.key, item]));
  const line = (key: ProductLineKey) => productLines.find((item) => item.key === key);
  const ai = line('aiXdr');
  const trust = line('trustOne');
  const ds = line('ds');
  return [
    '1、个人任务情况：',
    `个人毛利任务${TARGETS.profit}万元，毛利完成数字${fmt(byKey.get('profit')?.actual)}万元，毛利完成比例${pct(byKey.get('profit')?.rate)}，任务缺口${fmt(byKey.get('profit')?.gap)}万元，本周新增0万。`,
    `商机储备任务${TARGETS.pipeline}万元，商机储备金额${fmt(byKey.get('pipeline')?.actual)}万元，商机储备完成率${pct(byKey.get('pipeline')?.rate)}，商机缺口${fmt(byKey.get('pipeline')?.gap)}万元，本周新增0万。`,
    '2、T2000（目标）：',
    `负责的T2000客户数${TARGETS.t2000Coverage}个，目前覆盖数${t2000Coverage}个，覆盖完成率${pct(byKey.get('t2000Coverage')?.rate)}，本周新增0个。`,
    `T2000商机金额储备目标${TARGETS.t2000Opportunity}万元，目前完成${fmt(byKey.get('t2000Opportunity')?.actual)}万元，商机缺口${fmt(byKey.get('t2000Opportunity')?.gap)}万元，本周新增0万。`,
    `T2000订单金额目标${TARGETS.t2000Order}万元，目前完成${fmt(byKey.get('t2000Order')?.actual)}万元，订单缺口${fmt(byKey.get('t2000Order')?.gap)}万元，本周新增0万。`,
    '3、AI XDR（目标）：',
    `AI XDR立项目标${TARGETS.aiXdrProject}个，目前立项数字${fmt(byKey.get('aiXdrProject')?.actual)}个，立项缺口${fmt(byKey.get('aiXdrProject')?.gap)}个，本周新增0个。`,
    `AI XDR商机数量目标${TARGETS.aiXdrCount}个，目前商机数量${fmt(byKey.get('aiXdrCount')?.actual)}个，数量缺口${fmt(byKey.get('aiXdrCount')?.gap)}个，本周新增0个。`,
    `AI XDR商机金额目标${TARGETS.aiXdrOpportunity}万元，目前商机金额${fmt(ai?.opportunityAmount)}万元，商机缺口${fmt(ai?.opportunityGap)}万元，本周新增0万。`,
    `AI XDR订单目标${TARGETS.aiXdrOrder}万元，目前已下${fmt(ai?.orderAmount)}万元，订单缺口${fmt(ai?.orderGap)}万元，本周新增0万。`,
    '4、Trustone',
    `Trustone商机目标${TARGETS.trustOneOpportunity}万元，目前商机${fmt(trust?.opportunityAmount)}万元，商机缺口${fmt(trust?.opportunityGap)}万元，本周新增0万。`,
    `Trustone订单目标${TARGETS.trustOneOrder}万元，目前已下${fmt(trust?.orderAmount)}万元，订单缺口${fmt(trust?.orderGap)}万元，本周新增0万。`,
    '5、DS',
    `DS商机目标${TARGETS.dsOpportunity}万元，目前商机${fmt(ds?.opportunityAmount)}万元，商机缺口${fmt(ds?.opportunityGap)}万元，本周新增0万。`,
    `DS订单目标${TARGETS.dsOrder}万元，目前已下${fmt(ds?.orderAmount)}万元，订单缺口${fmt(ds?.orderGap)}万元，本周新增0万。`,
  ].join('\n');
}

function productLineOf(row: PPLRecord): ProductLineKey | '' {
  // 严格按售前商机明细表的"二级分类"识别产品线（周报口径）：
  //   - 云安全       → DS
  //   - 终端安全     → TrustOne
  //   - 联动防御系统 → AI XDR
  // 其它二级分类（身份安全/数据安全/安全管理/安全服务等）一律不归入三大产品线，
  // 即使产品名含 trustone / xdr / ds 关键词，也不兜底——避免把零信任、DSOP、AIRDS 等误归。
  const productL2 = String(row.raw['二级分类'] ?? '');
  if (productL2 === '云安全') return 'ds';
  if (productL2 === '终端安全') return 'trustOne';
  if (productL2 === '联动防御系统') return 'aiXdr';
  return '';
}

function performanceProductLineOf(row: PerformanceRecord): ProductLineKey | '' {
  // 业绩明细按"产品二级分类"识别，与 PPL 同口径。
  if (row.productLevel2 === '云安全') return 'ds';
  if (row.productLevel2 === '终端安全') return 'trustOne';
  if (row.productLevel2 === '联动防御系统') return 'aiXdr';
  return '';
}

function isT2000(row: PPLRecord) {
  return normalize(row.t2000CustomerTag ?? '').includes('t2000');
}

function isForecast(row: PPLRecord) {
  return row.forecastType === 'Commit' || row.forecastType === 'Best Case';
}

function isProjectEstablished(row: PPLRecord) {
  const text = normalize(row.stage);
  return text.includes('立项') || text.includes('预算到位') || stageRankOf(row.stage) >= 2;
}

function normalizeStageName(stage: string) {
  const text = normalize(stage);
  if (text.includes('forecast')) return 'Forecast';
  if (text.includes('招标') || text.includes('采购')) return '招标采购';
  if (text.includes('内部') || text.includes('共识')) return '内部确认';
  if (text.includes('方案') || text.includes('评估') || text.includes('品牌')) return '方案评估';
  if (text.includes('立项') || text.includes('预算')) return '项目立项';
  return '提出需求';
}

function stageRankOf(stage: string) {
  const normalized = normalizeStageName(stage);
  const stages = ['提出需求', '项目立项', '方案评估', '内部确认', '招标采购', 'Forecast'];
  const index = stages.indexOf(normalized);
  // 未找到时返回 1（当作"提出需求"处理），并通过调试信息追踪异常值
  if (index === -1) {
    console.warn(`[PresalesMetrics] Unknown stage name: "${stage}" (normalized: "${normalized}"). Defaulting to rank 1.`);
    return 1;
  }
  return index + 1;
}

function invalidReasonOf(row: PPLRecord) {
  if (row.amount <= 0) return '总价为 0 或为空';
  if (!row.product || row.product.includes('未')) return '产品名称为空';
  if (!row.stage || row.stage === 'Unknown' || row.stage.includes('未')) return '客户采购阶段为空';
  return '';
}

function toRisk(row: PPLRecord, type: QualityRiskItem['type'], reason: string): QualityRiskItem {
  return {
    type,
    customerName: row.customerName,
    opportunityName: row.opportunityName,
    amount: row.amount,
    stage: row.stage,
    winRate: row.winRate,
    reason,
  };
}

function isLateQuarter(value: string) {
  return /Q[34]/i.test(value);
}

function isCurrentQuarter(value: string) {
  const now = new Date();
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
  return normalize(value).includes(quarter.toLowerCase());
}

function productAdvice(key: ProductLineKey) {
  if (key === 'aiXdr') {
    return 'AI XDR 当前重点不是只看商机金额，而是推动立项和订单转化。建议优先筛选金额较大、阶段较早但客户需求明确的项目，推动进入项目立项和方案评估。';
  }
  if (key === 'trustOne') {
    return 'TrustOne 建议从单点终端安全升级为终端防病毒、DLP、桌面管理、零信任组合方案推进，提高客单价和转化确定性。';
  }
  return 'DS 当前需要围绕云主机防护、勒索防护、云资产暴露面、等保整改等场景补充商机，并优先推动高赢率项目进入 Forecast。';
}

function statusOf(value: number): PresalesStatus {
  if (value >= 1) return '已完成';
  if (value >= 0.7) return '正常推进';
  if (value >= 0.5) return '中风险';
  return '高风险';
}

function rate(actual: number, target: number) {
  return target > 0 ? actual / target : 0;
}

function fmt(value = 0) {
  return Math.round(value).toLocaleString('zh-CN');
}

function pct(value = 0) {
  return `${Math.round(value * 100)}%`;
}

function normalize(value: string) {
  return value.replace(/\s/g, '').toLowerCase();
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * T2000 订单金额：从 PPL 中打了 T2000 标签的客户名单出发，
 * 反向匹配业绩明细中"最终用户"字段做累加。
 *
 * 这样能覆盖两种情况：
 * - 业绩明细的"客户是否T2000"字段为空/未填（参考文件中大部分 T2000 客户都是这种情况）
 * - 业绩明细已正确填写 T2000 字段（重复统计也没关系，因为业绩里同一客户不会跨多次）
 */
function sumT2000OrderFromPpl(ppl: PPLRecord[], performance: PerformanceRecord[]): number {
  const t2000CustomerKeys = new Set<string>();
  ppl.forEach((row) => {
    if (!isT2000(row)) return;
    const key = normalizeCustomerKey(row.customerName);
    if (key) t2000CustomerKeys.add(key);
  });
  if (t2000CustomerKeys.size === 0) {
    // 兜底：用业绩里的 isT2000 字段
    return sum(performance.filter((row) => row.isT2000).map((row) => row.orderAmount));
  }
  return sum(
    performance
      .filter((row) => {
        const key = normalizeCustomerKey(row.customerName);
        if (!key) return false;
        // 双向包含：业绩里的最终用户可能是简称，PPL 里的可能是全称
        for (const t of t2000CustomerKeys) {
          if (key.includes(t) || t.includes(key)) return true;
        }
        return false;
      })
      .map((row) => row.orderAmount),
  );
}

function normalizeCustomerKey(value: string): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}
