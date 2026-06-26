import { DashboardCard } from '../common/DashboardCard';

interface HealthItem {
  name: string;
  value: number;
  count: number;
}

interface HealthCardProps {
  items: HealthItem[];
  subtitle?: string;
  onClick: (name: string) => void;
}

/** 健康度金额/商机数卡片：横向进度条 + 点击下钻 */
export function HealthCard({ items, subtitle, onClick }: HealthCardProps) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <DashboardCard title="健康度金额与商机数分布" subtitle={subtitle} className="health-card">
      <div className="health-bars">
        {items.map((item) => (
          <button className="health-bar-row" key={item.name} onClick={() => onClick(item.name)}>
            <span className={`health-dot ${item.name}`} />
            <span className="health-name">{item.name}</span>
            <span className="health-track">
              <span className={`health-fill ${item.name}`} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
            </span>
            <strong>{item.value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万</strong>
            <em>{item.count} 个</em>
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}