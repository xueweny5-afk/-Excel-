export type ForecastType = 'Commit' | 'Best Case' | 'Pipeline' | 'Omitted' | 'Unknown';
export type HealthLevel = '健康' | '关注' | '风险';
export type DrillField =
  | 'owner'
  | 'industryLevel1'
  | 'product'
  | 'expectedQuarter'
  | 'forecastType'
  | 'healthLevel';

export interface PPLRecord {
  id: string;
  owner: string;
  customerName: string;
  opportunityName: string;
  industryLevel1: string;
  industryLevel2?: string;
  t2000CustomerTag?: string;
  product: string;
  productLevel2?: string;
  productLevel3?: string;
  amount: number;
  stage: string;
  status: string;
  winRate: number;
  forecastType: ForecastType;
  expectedQuarter: string;
  expectedCloseDate?: string;
  healthScore: number;
  healthLevel: HealthLevel;
  healthReasons: string[];
  raw: Record<string, unknown>;
}

export interface SummaryRecord {
  team: string;
  owner: string;
  totalAmount: number;
  forecastAmount: number;
  raw: Record<string, unknown>;
}

export interface ActivityRecord {
  owner: string;
  newPplAmount: number;
  activityCount: number;
  conversionRate: number;
  raw: Record<string, unknown>;
}

export type NaCustomerType = 'NA-I' | 'NA-II' | 'NA代管' | '';

export interface NaCustomer {
  customer: string;
  customerOwner: string;
  presales: string;
  customerType: NaCustomerType;
  quadrant: string;
  isT2000: boolean;
  /** 一级行业 */
  industryLevel1: string;
  /** 二级行业 */
  industryLevel2: string;
  /** 规模化产出目标相关 */
  scaleTarget: string;
  /** 来源 Sheet 名（Q1 / Q3 / Q4 等），用于追溯 */
  sourceSheet: string;
  raw: Record<string, unknown>;
}

export interface PerformanceRecord {
  customerName: string;
  productName: string;
  productLevel2: string;
  productLevel3: string;
  orderAmount: number;
  contractAmount: number;
  salesGrossProfit: number;
  performanceGrossProfit: number;
  finalPerformance: number;
  isT2000: boolean;
  raw: Record<string, unknown>;
}

export interface ImportReport {
  fileName: string;
  importedAt: string;
  pplRows: number;
  summaryRows: number;
  activityRows: number;
  performanceRows: number;
  naCustomerRows?: number;
  skippedRows: number;
  detectedFields: string[];
  missingFields: string[];
  warnings: string[];
}

export interface DashboardData {
  ppl: PPLRecord[];
  summary: SummaryRecord[];
  activity: ActivityRecord[];
  performance: PerformanceRecord[];
  naCustomers?: NaCustomer[];
  report: ImportReport;
}

export interface Filters {
  owner: string;
  industryLevel1: string;
  product: string;
  expectedQuarter: string;
  status: string;
  forecastType: string;
}

export interface DrillFilter {
  field: DrillField;
  value: string;
}
