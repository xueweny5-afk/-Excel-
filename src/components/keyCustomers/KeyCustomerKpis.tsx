import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';
import { formatMoney, formatPercent } from '../../lib/formatters';

interface KeyCustomerKpisProps {
  analysis: KeyCustomerAnalysis;
}

/** 重点客户 KPI 卡片组 */
export function KeyCustomerKpis({ analysis }: KeyCustomerKpisProps) {
  const kpis = analysis.kpis;
  const items: Array<[string, string]> = [
    ['输入客户数', kpis.inputCustomerCount.toLocaleString('zh-CN')],
    ['已匹配客户数', kpis.matchedCustomerCount.toLocaleString('zh-CN')],
    ['商机数', kpis.opportunityCount.toLocaleString('zh-CN')],
    ['商机总金额', formatMoney(kpis.totalAmount)],
    ['加权赢单率', formatPercent(kpis.weightedWinRate)],
    ['Forecast 金额', formatMoney(kpis.forecastAmount)],
    ['风险商机数', kpis.riskCount.toLocaleString('zh-CN')],
    ['活动记录数', kpis.activityCount === null ? '暂无客户维度' : kpis.activityCount.toLocaleString('zh-CN')],
  ];
  return (
    <section className="kpi-grid key-customer-kpis">
      {items.map(([label, value]) => (
        <article className="kpi-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}