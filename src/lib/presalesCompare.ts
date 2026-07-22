import type { DashboardData } from '../domain';
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
}

export function comparePresalesData(currentData: DashboardData, previousData: DashboardData | null): PresalesComparison {
  const current = analyzePresalesDashboard(currentData);
  const previous = previousData ? analyzePresalesDashboard(previousData) : null;

  const currentTarget = new Map(current.targetMetrics.map((item) => [item.key, item.actual]));

  // 只有当 previous 数据完整（有 targetMetrics 数组）时才进行对比计算
  const hasValidPrevious = Boolean(previous?.targetMetrics && Array.isArray(previous.targetMetrics) && previous.targetMetrics.length > 0);
  const previousTarget = hasValidPrevious
    ? new Map(previous!.targetMetrics.map((item) => [item.key, item.actual]))
    : new Map();
  const previousKpis = hasValidPrevious ? previous?.kpis : undefined;

  const items: PresalesComparisonItem[] = [
    metric('pipelineAmount', '商机储备金额', '万元', current.kpis.pipelineAmount, previousKpis?.pipelineAmount ?? null),
    metric('profitAmount', '毛利完成金额', '万元', current.kpis.profitAmount, previousKpis?.profitAmount ?? null),
    metric('orderAmount', '已下单金额', '万元', current.kpis.orderAmount, previousKpis?.orderAmount ?? null),
    metric('forecastAmount', 'Forecast 金额', '万元', current.kpis.forecastAmount, previousKpis?.forecastAmount ?? null),
    metric('t2000Coverage', 'T2000 覆盖', '个', currentTarget.get('t2000Coverage') ?? 0, previousTarget.get('t2000Coverage') ?? null),
    metric('t2000Opportunity', 'T2000 商机', '万元', currentTarget.get('t2000Opportunity') ?? 0, previousTarget.get('t2000Opportunity') ?? null),
    metric('t2000Order', 'T2000 订单', '万元', currentTarget.get('t2000Order') ?? 0, previousTarget.get('t2000Order') ?? null),
    metric('aiXdrOpportunity', 'AI XDR 商机', '万元', currentTarget.get('aiXdrOpportunity') ?? 0, previousTarget.get('aiXdrOpportunity') ?? null),
    metric('riskCount', '风险商机数', '个', current.quality.risks.length, previous?.quality.risks.length ?? null),
  ];

  return {
    hasReference: hasValidPrevious,
    referenceFileName: hasValidPrevious ? (previousData?.report.fileName ?? '') : '',
    referenceImportedAt: hasValidPrevious ? (previousData?.report.importedAt ?? '') : '',
    items,
  };
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
