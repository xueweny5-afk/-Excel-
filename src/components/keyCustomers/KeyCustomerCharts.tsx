import { ChartCard } from '../charts/ChartCard';
import { DistributionCard } from '../charts/DistributionCard';
import { barOption, chartColors, countBarOption } from '../../lib/chartOptions';
import { topInsight, shareInsight } from '../charts/_insights';
import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';

interface KeyCustomerChartsProps {
  analysis: KeyCustomerAnalysis;
}
/** 重点客户图表区：客户金额排行、客户数量排行、产品分布、销售分布、阶段分布 */
export function KeyCustomerCharts({ analysis }: KeyCustomerChartsProps) {
  const { customerAmountRank, customerCountRank, productAmount, ownerAmount, stageAmount } =
    analysis.chartData;
  return (
    <section className="chart-grid">
      <ChartCard
        title="客户商机金额排行"
        subtitle={topInsight(customerAmountRank, '暂无客户金额数据')}
        option={barOption(customerAmountRank, true, chartColors.primary)}
      />
      <ChartCard title="客户商机数量排行" option={countBarOption(customerCountRank, true)} />
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
