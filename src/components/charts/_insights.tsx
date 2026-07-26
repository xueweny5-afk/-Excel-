import { formatMoney } from '../../lib/formatters';

/** 通用图表提示文本生成器 */
export interface DistributionItem {
  name: string;
  value: number;
}

export function topInsight(items: DistributionItem[], empty: string): string {
  const top = [...items].sort((a, b) => b.value - a.value)[0];
  return top ? `${top.name} 最高，金额 ${formatMoney(top.value)}` : empty;
}

export function shareInsight(items: DistributionItem[], label: string): string {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const top = [...items].sort((a, b) => b.value - a.value)[0];
  if (!top || total === 0) return `暂无${label}数据`;
  return `${top.name} 占比 ${((top.value / total) * 100).toFixed(0)}%，结构${top.value / total > 0.7 ? '较集中' : '较均衡'}`;
}