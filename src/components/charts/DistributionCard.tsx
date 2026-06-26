import { EChartsReact } from '../../lib/EChartsReact';
import { formatMoney } from '../../lib/formatters';
import { DONUT_PALETTE, donutOption } from '../../lib/chartOptions';
import { DashboardCard } from '../common/DashboardCard';

interface DistributionItem {
  name: string;
  value: number;
  count: number;
}

interface DistributionCardProps {
  title: string;
  subtitle?: string;
  items: DistributionItem[];
  onClick: (name: string) => void;
}

/** 环形图 + 右侧列表，展示分布占比 */
export function DistributionCard({ title, subtitle, items, onClick }: DistributionCardProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <DashboardCard title={title} subtitle={subtitle}>
      <div className="distribution-card">
        <div className="donut-wrap">
          <EChartsReact
            option={donutOption(items)}
            style={{ height: 230 }}
            onEvents={{
              click: (params: { name?: unknown }) => onClick(String(params.name ?? '')),
            }}
            notMerge
          />
          <div className="donut-center">
            <span>总金额</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
        <div className="distribution-list">
          {items.slice(0, 6).map((item, index) => (
            <button key={item.name} onClick={() => onClick(item.name)}>
              <i style={{ background: DONUT_PALETTE[index % DONUT_PALETTE.length] }} />
              <span>{item.name}</span>
              <strong>{total ? `${((item.value / total) * 100).toFixed(0)}%` : '0%'}</strong>
              <em>{formatMoney(item.value)}</em>
            </button>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
