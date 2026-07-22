import { create } from 'zustand';
import type { DashboardData, DrillField, DrillFilter, Filters } from '../domain';
import { readLatestPresalesData, saveLatestPresalesData } from '../lib/presalesHistory';

/** 顶层模块与销售子页分离，避免不同驾驶舱的状态互相覆盖。 */
export type ModuleKey = 'sales' | 'presales' | 'workbench';
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
  salesData: DashboardData | null;
  presalesData: DashboardData | null;
  previousPresalesData: DashboardData | null;

  // === 筛选/搜索状态 ===
  filters: Filters;
  drillFilters: DrillFilter[];
  search: string;
  customerQuery: string;

  // === UI 状态 ===
  activeModule: ModuleKey;
  activeTab: TabKey;
  loading: boolean;
  error: string;
  isDraggingFile: boolean;

  // === 重点客户（仅 keyCustomers Tab 用） ===
  keyCustomerInput: string;

  // === Actions：数据 ===
  setData: (data: DashboardData) => void;
  setSalesData: (data: DashboardData) => void;
  setPresalesData: (data: DashboardData) => void;
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
  setActiveModule: (module: ModuleKey) => void;
  setActiveTab: (tab: TabKey) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setDragging: (dragging: boolean) => void;

  // === Actions：重点客户 ===
  setKeyCustomerInput: (input: string) => void;
}

export const useDataStore = create<DataStore>((set) => ({
  data: null,
  salesData: null,
  presalesData: null,
  previousPresalesData: null,
  filters: emptyFilters,
  drillFilters: [],
  search: '',
  customerQuery: '',
  activeModule: 'sales',
  activeTab: 'ppl',
  loading: false,
  error: '',
  isDraggingFile: false,
  keyCustomerInput: '',

  setData: (data) =>
    set({
      data,
      salesData: data,
      filters: emptyFilters,
      drillFilters: [],
      search: '',
      customerQuery: '',
      keyCustomerInput: '',
      error: '',
    }),
  // 销售模块导入：只重置销售模块的筛选状态，不动售前模块的任何数据。
  setSalesData: (data) =>
    set({
      data,
      salesData: data,
      filters: emptyFilters,
      drillFilters: [],
      search: '',
      customerQuery: '',
      keyCustomerInput: '',
      error: '',
    }),
  // 售前模块导入：完全独立于销售模块，保留销售数据。
  // 同时把"上一版"售前数据滚动到 previousPresalesData，供周对比使用。
  setPresalesData: (data) => {
    const previousPresalesData = readLatestPresalesData();
    const saveResult = saveLatestPresalesData(data);
    const warning = saveResult.warning;
    set({
      presalesData: data,
      previousPresalesData,
      error: '',
    });
    // 静默失败的场合才主动写一条 warning（setError 会打断用户）
    if (warning) {
      console.warn('[PresalesHistory]', warning);
    }
  },
  clearData: () =>
    set({
      data: null,
      salesData: null,
      presalesData: null,
      previousPresalesData: null,
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

  setActiveModule: (activeModule) => set({ activeModule }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setDragging: (isDraggingFile) => set({ isDraggingFile }),

  setKeyCustomerInput: (keyCustomerInput) => set({ keyCustomerInput }),
}));
