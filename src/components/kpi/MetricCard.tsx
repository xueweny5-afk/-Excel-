export interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone: 'blue' | 'purple' | 'cyan' | 'green' | 'orange' | 'red';
}

/** 单张 KPI 卡片 */
export function MetricCard({ label, value, hint, tone }: MetricCardProps) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <em>{hint}</em>}
    </article>
  );
}