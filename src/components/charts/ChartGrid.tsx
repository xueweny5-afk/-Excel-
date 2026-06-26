import type { PPLRecord, DrillField } from '../../domain';
import { useChartAggregations } from '../../hooks/useChartAggregations';
import { barOption, chartColors, quarterOption } from '../../lib/chartOptions';
import { formatMoney } from '../../lib/formatters';
import { ChartCard } from './ChartCard';
import { DistributionCard } from './DistributionCard';
import { HealthCard } from './HealthCard';

interface ChartGridProps {
  data: PPLRecord[];
  onDrill: (field: DrillField, value: string) => void;
}

/** 主图表区：6 张图表（销售/行业/产品/季度/健康度/Forecast） */
export function ChartGrid({ data, onDrill }: ChartGridProps) {
  const aggregations = useChartAggregations(data);
  const { owner, industry, product, quarter, forecast, health } = aggregations;

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
      <DistributionCard
        title="Forecast Pipeline 结构"
        subtitle={shareInsight(forecast, 'Forecast')}
        items={forecast}
        onClick={(name) => onDrill('forecastType', name)}
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