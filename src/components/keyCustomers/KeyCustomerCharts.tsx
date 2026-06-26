import { ChartCard } from '../charts/ChartCard';
import { DistributionCard } from '../charts/DistributionCard';
import { barOption, chartColors, countBarOption } from '../../lib/chartOptions';
import { formatMoney } from '../../lib/formatters';
import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';

interface KeyCustomerChartsProps {
  analysis: KeyCustomerAnalysis;
}

/** 重点客户图表区：客户金额排行、客户数量排行、产品分布、销售分布、阶段分布 */
export function KeyCustomerCharts({ analysis }: KeyCustomerChartsProps) {
  const { customerAmountRank, customerCountRank, productAmount, ownerAmount, stageAmount } = analysis.chartData;
  return (
    <section className="chart-grid">
      <ChartCard
        title="客户商机金额排行"
        subtitle={topInsight(customerAmountRank, '暂无客户金额数据')}
        option={barOption(customerAmountRank, true, chartColors.primary)}
      />
      <ChartCard
        title="客户商机数量排行"
        option={countBarOption(customerCountRank, true)}
      />
      <DistributionCard
        title="产品金额分布"
        subtitle={shareInsight(productAmount, '产品')}
        items={productAmount}
        onClick={() => undefined}
      />
      <DistributionCard
        title="销售负责人分布"
        subtitle={shareInsight(ownerAmount, '销售')}
        items={ownerAmount}
        onClick={() => undefined}
      />
      <ChartCard
        title="商机阶段分布"
        subtitle={topInsight(stageAmount, '暂无阶段数据')}
        option={barOption(stageAmount, true, chartColors.orange)}
      />
    </section>
  );
}

function topInsight(items: Array<{ name: string; value: number }>, empty: string) {
  const top = [...items].sort((a, b) => b.value - a.value)[0];
  return top ? `${top.name} 最高，金额 ${formatMoney(top.value)}` : empty;
}

function shareInsight(items: Array<{ name: string; value: number }>, label: string) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const top = [...items].sort((a, b) => b.value - a.value)[0];
  if (!top || total === 0) return `暂无${label}数据`;
  return `${top.name} 占比 ${((top.value / total) * 100).toFixed(0)}%，结构${top.value / total > 0.7 ? '较集中' : '较均衡'}`;
}