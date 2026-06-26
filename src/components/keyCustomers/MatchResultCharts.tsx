import { DashboardCard } from '../common/DashboardCard';
import { ChartCard } from '../charts/ChartCard';
import { countBarOption, matchRateOption } from '../../lib/chartOptions';
import { formatPercent } from '../../lib/formatters';
import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';

interface MatchResultChartsProps {
  analysis: KeyCustomerAnalysis;
}

/** 客户匹配结果图表：成功率环形 + 匹配方式分布 + 置信度分布 */
export function MatchResultCharts({ analysis }: MatchResultChartsProps) {
  const results = analysis.matchResults;
  const matchedCount = results.filter((r) => r.matched).length;
  const unmatchedCount = results.length - matchedCount;
  const matchRate = results.length ? matchedCount / results.length : 0;

  const matchTypeItems = ['精确匹配', '别名匹配', '模糊匹配', '未匹配']
    .map((type) => ({
      name: type,
      value: results.filter((r) => r.matchType === type).length,
    }))
    .filter((item) => item.value > 0);

  const confidenceItems = [
    { name: '100%', value: results.filter((r) => r.confidence === 1).length },
    { name: '80%-99%', value: results.filter((r) => r.confidence >= 0.8 && r.confidence < 1).length },
    { name: '1%-79%', value: results.filter((r) => r.confidence > 0 && r.confidence < 0.8).length },
    { name: '0%', value: results.filter((r) => r.confidence === 0).length },
  ].filter((item) => item.value > 0);

  return (
    <div className="match-chart-grid">
      <DashboardCard title="匹配成功率" subtitle={`${matchedCount} 个成功 / ${unmatchedCount} 个未匹配`}>
        <div className="match-rate-card">
          <ChartCard title="" option={matchRateOption(matchedCount, unmatchedCount)} height={190} />
          <div>
            <strong>{formatPercent(matchRate)}</strong>
            <span>输入客户匹配成功率</span>
          </div>
        </div>
      </DashboardCard>
      <ChartCard title="匹配方式分布" subtitle="按输入客户数量统计" option={countBarOption(matchTypeItems, true)} />
      <ChartCard title="匹配置信度分布" subtitle="按置信度区间统计" option={countBarOption(confidenceItems, false)} />
    </div>
  );
}