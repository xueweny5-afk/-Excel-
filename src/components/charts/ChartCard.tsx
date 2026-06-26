import { DashboardCard } from '../common/DashboardCard';
import { EChartsReact } from '../../lib/EChartsReact';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  option: object;
  onClick?: (name: string) => void;
  height?: number;
}

/** 通用 ECharts 卡片：支持点击下钻 */
export function ChartCard({ title, subtitle, option, onClick, height = 300 }: ChartCardProps) {
  const events = onClick
    ? {
        click: (params: { name?: unknown; value?: unknown[] }) =>
          onClick(String(params.name ?? params.value?.[3] ?? '')),
      }
    : undefined;

  return (
    <DashboardCard title={title} subtitle={subtitle}>
      <EChartsReact
        option={option}
        style={{ height }}
        onEvents={events}
        notMerge
      />
    </DashboardCard>
  );
}