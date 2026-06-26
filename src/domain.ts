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
  product: string;
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

export interface ImportReport {
  fileName: string;
  importedAt: string;
  pplRows: number;
  summaryRows: number;
  activityRows: number;
  skippedRows: number;
  detectedFields: string[];
  missingFields: string[];
  warnings: string[];
}

export interface DashboardData {
  ppl: PPLRecord[];
  summary: SummaryRecord[];
  activity: ActivityRecord[];
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
