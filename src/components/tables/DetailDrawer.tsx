import { X } from 'lucide-react';
import type { PPLRecord } from '../../domain';
import { formatMoney, formatPercent } from '../../lib/formatters';

interface DetailDrawerProps {
  row: PPLRecord;
  onClose: () => void;
}

/** 详情侧边抽屉：展示 PPLRecord 完整字段 + 原始 Excel 数据 */
export function DetailDrawer({ row, onClose }: DetailDrawerProps) {
  return (
    <aside className="drawer">
      <button className="drawer-close" onClick={onClose}><X size={18} /></button>
      <h2>{row.customerName}</h2>
      <p>{row.opportunityName}</p>
      <dl>
        <dt>销售 / 产品</dt><dd>{row.owner} / {row.product}</dd>
        <dt>金额 / 赢单率</dt><dd>{formatMoney(row.amount)} / {formatPercent(row.winRate)}</dd>
        <dt>阶段 / 状态</dt><dd>{row.stage} / {row.status}</dd>
        <dt>健康度解释</dt><dd>{row.healthLevel}：{row.healthReasons.join('；')}</dd>
      </dl>
      <h3>原始 Excel 字段</h3>
      <pre>{JSON.stringify(row.raw, null, 2)}</pre>
    </aside>
  );
}