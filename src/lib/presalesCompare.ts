import type { DashboardData } from '../domain';
import { normalizeBusinessKey } from './normalize';
import { analyzePresalesDashboard } from './presalesMetrics';

export interface PresalesComparisonItem {
  key: string;
  label: string;
  unit: '万元' | '个';
  current: number;
  previous: number | null;
  delta: number | null;
}

export interface PresalesComparison {
  hasReference: boolean;
  referenceFileName: string;
  referenceImportedAt: string;
  items: PresalesComparisonItem[];
  opportunityChanges: PresalesOpportunityChange[];
  changeSummary: {
    added: number;
    removed: number;
    changed: number;
  };
}

export interface PresalesOpportunityChange {
  key: string;
  type: 'added' | 'removed' | 'changed';
  customerName: string;
  opportunityName: string;
  changedFields: string[];
  before: PresalesOpportunityVersion | null;
  after: PresalesOpportunityVersion | null;
}

export interface PresalesOpportunityVersion {
  owner: string;
  amount: number;
  stage: string;
  status: string;
  product: string;
  productLevel2: string;
  productLevel3: string;
}

/**
 * 周对比：复用主分析入口，但每次调用只触发对比所需的字段（kpis + targetMetrics + 风险商机数）。
 *
 * 注意：当前实现仍走完整 analyzePresalesDashboard 以避免指标口径漂移；
 * 未来可演进为分步懒计算（lazy KPIs + lazy targetMetrics）。
 */
export function comparePresalesData(
  currentData: DashboardData,
  previousData: DashboardData | null,
): PresalesComparison {
  const current = analyzePresalesDashboard(currentData);
  const previous = previousData ? analyzePresalesDashboard(previousData) : null;

  const currentTarget = new Map(current.targetMetrics.map((item) => [item.key, item.actual]));
  const hasValidPrevious = Boolean(
    previous?.targetMetrics && Array.isArray(previous.targetMetrics) && previous.targetMetrics.length > 0,
  );
  const previousTarget = hasValidPrevious
    ? new Map(previous!.targetMetrics.map((item) => [item.key, item.actual]))
    : new Map();
  const previousKpis = hasValidPrevious ? previous?.kpis : undefined;
  const opportunityChanges = previousData ? compareOpportunities(currentData, previousData) : [];

  const items: PresalesComparisonItem[] = [
    metric(
      'pipelineAmount',
      '商机储备金额',
      '万元',
      current.kpis.pipelineAmount,
      previousKpis?.pipelineAmount ?? null,
    ),
    metric(
      'profitAmount',
      '毛利完成金额',
      '万元',
      current.kpis.profitAmount,
      previousKpis?.profitAmount ?? null,
    ),
    metric('orderAmount', '已下单金额', '万元', current.kpis.orderAmount, previousKpis?.orderAmount ?? null),
    metric(
      'forecastAmount',
      'Forecast 金额',
      '万元',
      current.kpis.forecastAmount,
      previousKpis?.forecastAmount ?? null,
    ),
    metric(
      't2000Coverage',
      'T2000 覆盖',
      '个',
      currentTarget.get('t2000Coverage') ?? 0,
      previousTarget.get('t2000Coverage') ?? null,
    ),
    metric(
      't2000Opportunity',
      'T2000 商机',
      '万元',
      currentTarget.get('t2000Opportunity') ?? 0,
      previousTarget.get('t2000Opportunity') ?? null,
    ),
    metric(
      't2000Order',
      'T2000 订单',
      '万元',
      currentTarget.get('t2000Order') ?? 0,
      previousTarget.get('t2000Order') ?? null,
    ),
    metric(
      'aiXdrOpportunity',
      'AI XDR 商机',
      '万元',
      currentTarget.get('aiXdrOpportunity') ?? 0,
      previousTarget.get('aiXdrOpportunity') ?? null,
    ),
    metric(
      'riskCount',
      '风险商机数',
      '个',
      current.quality.risks.length,
      previous?.quality.risks.length ?? null,
    ),
  ];

  return {
    hasReference: hasValidPrevious,
    referenceFileName: hasValidPrevious ? (previousData?.report.fileName ?? '') : '',
    referenceImportedAt: hasValidPrevious ? (previousData?.report.importedAt ?? '') : '',
    items,
    opportunityChanges,
    changeSummary: {
      added: opportunityChanges.filter((item) => item.type === 'added').length,
      removed: opportunityChanges.filter((item) => item.type === 'removed').length,
      changed: opportunityChanges.filter((item) => item.type === 'changed').length,
    },
  };
}

function compareOpportunities(currentData: DashboardData, previousData: DashboardData) {
  const current = opportunityMap(currentData);
  const previous = opportunityMap(previousData);
  const keys = new Set([...current.keys(), ...previous.keys()]);
  const changes: PresalesOpportunityChange[] = [];
  keys.forEach((key) => {
    const after = current.get(key) ?? null;
    const before = previous.get(key) ?? null;
    const source = after ?? before;
    if (!source) return;
    if (!before) {
      changes.push({
        key,
        type: 'added',
        ...source.identity,
        changedFields: ['新增商机'],
        before: null,
        after: after?.value ?? null,
      });
      return;
    }
    if (!after) {
      changes.push({
        key,
        type: 'removed',
        ...source.identity,
        changedFields: ['移除商机'],
        before: before.value,
        after: null,
      });
      return;
    }
    const changedFields = [
      fieldChanged(before.value.amount, after.value.amount, '金额'),
      fieldChanged(before.value.stage, after.value.stage, '阶段'),
      fieldChanged(before.value.status, after.value.status, '状态'),
      fieldChanged(before.value.owner, after.value.owner, '负责人'),
      fieldChanged(before.value.product, after.value.product, '一级产品'),
      fieldChanged(before.value.productLevel2, after.value.productLevel2, '二级产品'),
      fieldChanged(before.value.productLevel3, after.value.productLevel3, '三级产品'),
    ].filter((item): item is string => Boolean(item));
    if (changedFields.length > 0) {
      changes.push({
        key,
        type: 'changed',
        ...after.identity,
        changedFields,
        before: before.value,
        after: after.value,
      });
    }
  });
  return changes.sort(
    (a, b) =>
      changeOrder(a.type) - changeOrder(b.type) || a.customerName.localeCompare(b.customerName, 'zh-CN'),
  );
}

function opportunityMap(data: DashboardData) {
  const result = new Map<
    string,
    {
      identity: Pick<PresalesOpportunityChange, 'customerName' | 'opportunityName'>;
      value: PresalesOpportunityVersion;
    }
  >();
  data.ppl.forEach((row) => {
    const key = `${normalizeBusinessKey(row.customerName)}|${normalizeBusinessKey(row.opportunityName)}`;
    result.set(key, {
      identity: { customerName: row.customerName, opportunityName: row.opportunityName },
      value: {
        owner: row.owner,
        amount: row.amount,
        stage: row.stage,
        status: row.status,
        product: row.product,
        productLevel2: row.productLevel2 ?? '',
        productLevel3: row.productLevel3 ?? '',
      },
    });
  });
  return result;
}

function fieldChanged(before: string | number, after: string | number, label: string) {
  return before === after ? '' : label;
}

function changeOrder(type: PresalesOpportunityChange['type']) {
  return type === 'added' ? 0 : type === 'changed' ? 1 : 2;
}

function metric(
  key: string,
  label: string,
  unit: '万元' | '个',
  current: number,
  previous: number | null,
): PresalesComparisonItem {
  const reference = previous ?? null;
  return {
    key,
    label,
    unit,
    current,
    previous: reference,
    delta: reference === null ? null : current - reference,
  };
}
