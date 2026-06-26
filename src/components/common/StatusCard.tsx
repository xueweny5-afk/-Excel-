interface StatusCardProps {
  title: string;
  description: string;
  tone?: 'default' | 'danger';
}

/** 通用状态卡片：空状态/错误状态/加载状态 */
export function StatusCard({ title, description, tone = 'default' }: StatusCardProps) {
  return (
    <section className={`status-card ${tone}`}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
