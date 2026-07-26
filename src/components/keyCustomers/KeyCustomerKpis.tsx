import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';
import { formatMoney, formatPercent } from '../../lib/formatters';

interface KeyCustomerKpisProps {
  analysis: KeyCustomerAnalysis;
}

interface KpiItem {
  label: string;
  value: string;
}

/** 重点客户 KPI 卡片组 */
export function KeyCustomerKpis({ analysis }: KeyCustomerKpisProps) {
  const kpis = analysis.kpis;
  const items: KpiItem[] = [
    { label: '输入客户数', value: kpis.inputCustomerCount.toLocaleString('zh-CN') },
    { label: '已匹配客户数', value: kpis.matchedCustomerCount.toLocaleString('zh-CN') },
    { label: '商机数', value: kpis.opportunityCount.toLocaleString('zh-CN') },
    { label: '商机总金额', value: formatMoney(kpis.totalAmount) },
    { label: '加权赢单率', value: formatPercent(kpis.weightedWinRate) },
    { label: 'Forecast 金额', value: formatMoney(kpis.forecastAmount) },
    { label: '风险商机数', value: kpis.riskCount.toLocaleString('zh-CN') },
    { label: '活动记录数', value: kpis.activityCount === null ? '暂无客户维度' : kpis.activityCount.toLocaleString('zh-CN') },
  ];
  return (
    <section className="kpi-grid key-customer-kpis">
      {items.map((item) => (
        <article className="kpi-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}