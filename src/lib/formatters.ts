export function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '0 万元';
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万元`;
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export function compactNumber(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}
