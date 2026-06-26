import { X } from 'lucide-react';
import type { DrillField } from '../../domain';
import { useDataStore } from '../../stores/dataStore';

const drillLabels: Record<DrillField, string> = {
  owner: '销售',
  industryLevel1: '行业',
  product: '产品',
  expectedQuarter: '季度',
  forecastType: 'Forecast',
  healthLevel: '健康度',
};

/** 已下钻标签栏：展示当前激活的 drill filters，可单独删除或一键清空 */
export function DrillTags() {
  const drillFilters = useDataStore((s) => s.drillFilters);
  const removeDrill = useDataStore((s) => s.removeDrill);
  const clearDrill = useDataStore((s) => s.clearDrill);

  if (drillFilters.length === 0) return null;
  return (
    <section className="tag-row">
      <span>已下钻</span>
      {drillFilters.map((filter) => (
        <button key={`${filter.field}-${filter.value}`} onClick={() => removeDrill(filter)}>
          {drillLabels[filter.field]}={filter.value}
          <X size={13} />
        </button>
      ))}
      <button onClick={clearDrill}>清空下钻</button>
    </section>
  );
}
