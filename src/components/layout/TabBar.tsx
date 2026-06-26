import type { ReactNode } from 'react';
import type { TabKey } from '../../stores/dataStore';
import { useDataStore } from '../../stores/dataStore';

const TAB_LIST: Array<{ key: TabKey; label: string }> = [
  { key: 'ppl', label: 'PPL 明细' },
  { key: 'summary', label: '数据汇总' },
  { key: 'activity', label: '活动记录' },
  { key: 'keyCustomers', label: '重点客户分析' },
];

/** Tab 切换栏 */
export function TabBar({ rightSlot }: { rightSlot?: ReactNode }) {
  const activeTab = useDataStore((s) => s.activeTab);
  const setActiveTab = useDataStore((s) => s.setActiveTab);

  return (
    <nav className="tabs">
      {TAB_LIST.map(({ key, label }) => (
        <button
          key={key}
          className={activeTab === key ? 'active' : ''}
          onClick={() => setActiveTab(key)}
        >
          {label}
        </button>
      ))}
      {rightSlot}
    </nav>
  );
}

export { TAB_LIST };