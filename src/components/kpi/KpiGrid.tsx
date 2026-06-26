import { formatMoney, formatPercent } from '../../lib/formatters';
import type { KPISummary } from '../../lib/analyzer';
import { MetricCard, type MetricCardProps } from './MetricCard';

interface KpiGridProps {
  kpis: KPISummary;
}

/** 6 张 KPI 卡片 */
export function KpiGrid({ kpis }: KpiGridProps) {
  const items: Array<{ label: string; value: string; hint?: string; tone: MetricCardProps['tone'] }> = [
    { label: '商机总金额', value: formatMoney(kpis.totalAmount), hint: '当前筛选范围内', tone: 'blue' },
    { label: '商机数量', value: kpis.opportunityCount.toLocaleString('zh-CN'), hint: 'PPL 明细记录', tone: 'purple' },
    { label: '客户数量', value: kpis.customerCount.toLocaleString('zh-CN'), hint: '客户名称去重', tone: 'cyan' },
    { label: '加权赢单率', value: formatPercent(kpis.weightedWinRate), hint: '按金额加权', tone: 'green' },
    { label: 'Forecast 金额', value: formatMoney(kpis.forecastAmount), hint: 'Commit / Best Case', tone: 'orange' },
    { label: '风险商机', value: kpis.riskCount.toLocaleString('zh-CN'), hint: '需重点跟进', tone: 'red' },
  ];
  return (
    <section className="kpi-grid">
      {items.map((item) => <MetricCard key={item.label} {...item} />)}
    </section>
  );
}