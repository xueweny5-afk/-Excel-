import { Search, X } from 'lucide-react';
import type { PPLRecord } from '../../domain';
import type { Filters } from '../../domain';
import { uniqueOptions } from '../../lib/analyzer';
import { useDataStore } from '../../stores/dataStore';

interface FilterBarProps {
  data: PPLRecord[];
  resultSummary: string;
}

const FILTER_CONFIG: Array<{ key: keyof Filters; field: keyof PPLRecord; label: string }> = [
  { key: 'owner', field: 'owner', label: '销售' },
  { key: 'industryLevel1', field: 'industryLevel1', label: '一级行业' },
  { key: 'product', field: 'product', label: '产品' },
  { key: 'expectedQuarter', field: 'expectedQuarter', label: '季度' },
  { key: 'status', field: 'status', label: '状态' },
  { key: 'forecastType', field: 'forecastType', label: 'Forecast' },
];

/** 多维筛选面板（销售/行业/产品/季度/状态/Forecast）+ 搜索 + 指定客户 */
export function FilterBar({ data, resultSummary }: FilterBarProps) {
  const filters = useDataStore((s) => s.filters);
  const setFilter = useDataStore((s) => s.setFilter);
  const search = useDataStore((s) => s.search);
  const setSearch = useDataStore((s) => s.setSearch);
  const customerQuery = useDataStore((s) => s.customerQuery);
  const setCustomerQuery = useDataStore((s) => s.setCustomerQuery);
  const resetAll = useDataStore((s) => s.resetAll);

  return (
    <section className="filters">
      <div className="filter-header">
        <div>
          <strong>分析条件</strong>
          <span>{resultSummary}</span>
        </div>
        <button className="button ghost" onClick={resetAll}>
          <X size={16} />
          重置筛选
        </button>
      </div>
      <div className="filter-grid">
        {FILTER_CONFIG.map(({ key, field, label }) => (
          <label key={key}>
            <span>{label}</span>
            <select
              value={filters[key]}
              onChange={(event) => setFilter(key, event.target.value)}
            >
              <option value="">全部</option>
              {uniqueOptions(data, field).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="search-box">
          <span>搜索</span>
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="客户、销售、产品、商机"
          />
        </label>
        <label className="customer-box">
          <span>指定客户</span>
          <textarea
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="一行一个客户，或用逗号分隔"
            rows={3}
          />
        </label>
      </div>
    </section>
  );
}