import type { PPLRecord, DrillField } from '../../domain';
import { useChartAggregations } from '../../hooks/useChartAggregations';
import { barOption, chartColors, quarterOption } from '../../lib/chartOptions';
import { ChartCard } from './ChartCard';
import { DistributionCard } from './DistributionCard';
import { HealthCard } from './HealthCard';
import { topInsight, shareInsight } from './_insights';

interface ChartGridProps {
  data: PPLRecord[];
  onDrill: (field: DrillField, value: string) => void;
}
/** 主图表区：5 张图表（销售/行业/产品/季度/健康度） */
export function ChartGrid({ data, onDrill }: ChartGridProps) {
  const aggregations = useChartAggregations(data);
  const { owner, industry, product, quarter, health } = aggregations;

  return (
    <section className="chart-grid">
      <ChartCard
        title="销售金额 TOP 10"
        subtitle={topInsight(owner, '暂无销售数据')}
        option={barOption(owner, true, chartColors.primary)}
        onClick={(name) => onDrill('owner', name)}
      />
      <DistributionCard
        title="行业金额分布"
        subtitle={shareInsight(industry, '行业')}
        items={industry}
        onClick={(name) => onDrill('industryLevel1', name)}
      />
      <ChartCard
        title="产品金额排行"
        subtitle={topInsight(product, '暂无产品数据')}
        option={barOption(product, true, chartColors.purple)}
        onClick={(name) => onDrill('product', name)}
      />
      <ChartCard
        title="季度落单金额分布"
        subtitle={topInsight(quarter, '暂无季度数据')}
        option={quarterOption(quarter)}
        onClick={(name) => onDrill('expectedQuarter', name)}
      />
      <HealthCard
        items={health}
        subtitle={topInsight(health, '暂无健康度数据')}
        onClick={(name) => onDrill('healthLevel', name)}
      />
    </section>
  );
}
