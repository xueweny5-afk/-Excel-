import { create } from 'zustand';
import type { DashboardData, DrillField, DrillFilter, Filters } from '../domain';
import type { PresalesVersionSummary } from '../lib/presalesVersionHistory';

/** 顶层模块与销售子页分离，避免不同驾驶舱的状态互相覆盖。 */
export type ModuleKey = 'sales' | 'presales' | 'workbench' | 'performanceStats';
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
  presalesVersions: PresalesVersionSummary[];

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
  setPresalesHistory: (
    current: DashboardData | null,
    previous: DashboardData | null,
    versions: PresalesVersionSummary[],
  ) => void;
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
  presalesVersions: [],
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
  // 售前模块导入：完全独立于销售模块，版本持久化由导入链路完成。
  setPresalesData: (data) => set({ presalesData: data, error: '' }),
  setPresalesHistory: (presalesData, previousPresalesData, presalesVersions) =>
    set({ presalesData, previousPresalesData, presalesVersions, error: '' }),
  clearData: () =>
    set({
      data: null,
      salesData: null,
      presalesData: null,
      previousPresalesData: null,
      presalesVersions: [],
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
