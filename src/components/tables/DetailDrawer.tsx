import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { PPLRecord } from '../../domain';
import { formatMoney, formatPercent } from '../../lib/formatters';

interface DetailDrawerProps {
  row: PPLRecord;
  onClose: () => void;
}

/** 详情侧边抽屉：展示 PPLRecord 完整字段 + 原始 Excel 数据
 *
 * 无障碍：
 *   - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向标题
 *   - 打开时把焦点移到关闭按钮
 *   - Escape 关闭
 *   - 关闭后焦点恢复到触发元素（调用方需在挂载时记录）
 */
export function DetailDrawer({ row, onClose }: DetailDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // 打开时把焦点移到关闭按钮
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const headingId = `drawer-heading-${row.id}`;

  return (
    <aside
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button
        ref={closeButtonRef}
        className="drawer-close"
        onClick={onClose}
        aria-label="关闭详情"
        type="button"
      >
        <X size={18} aria-hidden="true" />
      </button>
      <h2 id={headingId}>{row.customerName}</h2>
      <p>{row.opportunityName}</p>
      <dl>
        <dt>销售 / 产品</dt>
        <dd>
          {row.owner} / {row.product}
        </dd>
        <dt>金额 / 赢单率</dt>
        <dd>
          {formatMoney(row.amount)} / {formatPercent(row.winRate)}
        </dd>
        <dt>阶段 / 状态</dt>
        <dd>
          {row.stage} / {row.status}
        </dd>
        <dt>健康度解释</dt>
        <dd>
          {row.healthLevel}：{row.healthReasons.join('；')}
        </dd>
      </dl>
      <h3>原始 Excel 字段</h3>
      <pre>{JSON.stringify(row.raw, null, 2)}</pre>
    </aside>
  );
}