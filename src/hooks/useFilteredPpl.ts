import { useMemo } from 'react';
import { useDataStore } from '../stores/dataStore';
import { calculateKpis, filterPpl } from '../lib/analyzer';
import type { KPISummary } from '../lib/analyzer';

/**
 * 派生筛选后的 PPL 数据 + KPI。
 * 所有组件都从这里消费，避免每个组件各自 useMemo 重复计算。
 */
export function useFilteredPpl() {
  const rawPpl = useDataStore((s) => s.data?.ppl ?? EMPTY_ARRAY);
  const filters = useDataStore((s) => s.filters);
  const drillFilters = useDataStore((s) => s.drillFilters);
  const search = useDataStore((s) => s.search);
  const customerQuery = useDataStore((s) => s.customerQuery);

  const filteredPpl = useMemo(
    () => filterPpl(rawPpl, filters, drillFilters, search, customerQuery),
    [rawPpl, filters, drillFilters, search, customerQuery],
  );

  const kpis = useMemo(() => calculateKpis(filteredPpl), [filteredPpl]);

  return { rawPpl, filteredPpl, kpis: kpis as KPISummary };
}

const EMPTY_ARRAY: never[] = [];