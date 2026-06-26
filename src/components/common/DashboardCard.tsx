import type { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** 通用卡片容器 */
export function DashboardCard({ title, subtitle, action, className = '', children }: DashboardCardProps) {
  return (
    <article className={`dashboard-card ${className}`}>
      <div className="dashboard-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </article>
  );
}
