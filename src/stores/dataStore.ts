import { create } from 'zustand';
import type { DashboardData, DrillField, DrillFilter, Filters } from '../domain';

/** 应用 Tab 类型（统一枚举，避免散落字符串） */
export type TabKey = 'ppl' | 'summary' | 'activity' | 'keyCustomers';

const emptyFilters: Filters = {
  owner: '',
  industryLevel1: '',
  product: '',
  expectedQuarter: '',
  status: '',
  forecastType: '',
};

interface DataStore {
  // === 数据 ===
  data: DashboardData | null;

  // === 筛选/搜索状态 ===
  filters: Filters;
  drillFilters: DrillFilter[];
  search: string;
  customerQuery: string;

  // === UI 状态 ===
  activeTab: TabKey;
  loading: boolean;
  error: string;
  isDraggingFile: boolean;

  // === 重点客户（仅 keyCustomers Tab 用） ===
  keyCustomerInput: string;

  // === Actions：数据 ===
  setData: (data: DashboardData) => void;
  clearData: () => void;

  // === Actions：筛选 ===
  setFilters: (patch: Partial<Filters>) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleDrill: (field: DrillField, value: string) => void;
  removeDrill: (filter: DrillFilter) => void;
  clearDrill: () => void;
  setSearch: (search: string) => void;
  setCustomerQuery: (customerQuery: string) => void;
  resetAll: () => void;

  // === Actions：UI ===
  setActiveTab: (tab: TabKey) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setDragging: (dragging: boolean) => void;

  // === Actions：重点客户 ===
  setKeyCustomerInput: (input: string) => void;
}

export const useDataStore = create<DataStore>((set) => ({
  data: null,
  filters: emptyFilters,
  drillFilters: [],
  search: '',
  customerQuery: '',
  activeTab: 'ppl',
  loading: false,
  error: '',
  isDraggingFile: false,
  keyCustomerInput: '',

  setData: (data) =>
    set({
      data,
      filters: emptyFilters,
      drillFilters: [],
      search: '',
      customerQuery: '',
      keyCustomerInput: '',
      error: '',
    }),
  clearData: () =>
    set({
      data: null,
      filters: emptyFilters,
      drillFilters: [],
      search: '',
      customerQuery: '',
      keyCustomerInput: '',
    }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  toggleDrill: (field, value) =>
    set((s) => {
      const exists = s.drillFilters.some((f) => f.field === field && f.value === value);
      return {
        drillFilters: exists
          ? s.drillFilters.filter((f) => !(f.field === field && f.value === value))
          : [...s.drillFilters, { field, value }],
      };
    }),
  removeDrill: (filter) => set((s) => ({ drillFilters: s.drillFilters.filter((f) => f !== filter) })),
  clearDrill: () => set({ drillFilters: [] }),
  setSearch: (search) => set({ search }),
  setCustomerQuery: (customerQuery) => set({ customerQuery }),
  resetAll: () => set({ filters: emptyFilters, drillFilters: [], search: '', customerQuery: '' }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setDragging: (isDraggingFile) => set({ isDraggingFile }),

  setKeyCustomerInput: (keyCustomerInput) => set({ keyCustomerInput }),
}));
