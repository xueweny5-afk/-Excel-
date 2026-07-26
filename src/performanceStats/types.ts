export type DuplicateStatus = '正常' | '疑似重复';
export type MatchStatus = '已匹配' | '未匹配';

export interface SalesPerformanceSourceFile {
  id: string;
  name: string;
  digest: string;
  importedAt: string;
  salesperson: string;
  rawRowCount: number;
  includedRowCount: number;
  excludedRowCount: number;
  status: '正常' | '重复文件' | '缺少字段' | '解析失败';
  message?: string;
}

export interface SalesPerformanceRecord {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  salesperson: string;
  customerName: string;
  projectName: string;
  contractNumber: string;
  confirmationYear: number | null;
  confirmationMonth: number | null;
  confirmationDateText: string;
  confirmationStatus: string;
  orderAmount: number;
  salesGrossProfit: number;
  productLevel1: string;
  productLevel2: string;
  productLevel3: string;
  productName: string;
  customerType: string;
  industry: string;
  included: boolean;
  exclusionReason: string;
  duplicateStatus: DuplicateStatus;
  raw: Record<string, unknown>;
}

export interface SalesPerformanceImportCheck {
  fileId: string;
  fileName: string;
  sheetName: string;
  rawRows: number;
  includedRows: number;
  excludedRows: number;
  confirmedRows: number;
  pendingRows: number;
  missingDateRows: number;
  invalidAmountRows: number;
  emptyContractRows: number;
  negativeAmountRows: number;
  duplicateRows: number;
  missingFields: string[];
  warnings: string[];
}

export interface KeyProjectRecord {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  projectName: string;
  customerName: string;
  owner: string;
  targetAmount: number;
  targetGrossProfit: number;
  productCategory: string;
  industry: string;
  note: string;
  raw: Record<string, unknown>;
}

export interface KeyProjectSourceFile {
  id: string;
  name: string;
  digest: string;
  importedAt: string;
  rawRowCount: number;
  includedRowCount: number;
  status: '正常' | '重复文件' | '缺少字段' | '解析失败';
  message?: string;
}

export interface KeyProjectImportCheck {
  fileId: string;
  fileName: string;
  sheetName: string;
  rawRows: number;
  includedRows: number;
  missingFields: string[];
  warnings: string[];
}

export interface SalesPerformanceFilters {
  years: number[];
  months: number[];
  salesperson: string;
  productLevel1: string;
  productLevel2: string;
  productLevel3: string;
  customerType: string;
  industry: string;
  duplicateStatus: '' | DuplicateStatus;
  keyword: string;
}

export interface SummaryRow {
  name: string;
  orderAmount: number;
  salesGrossProfit: number;
  grossProfitRate: number;
  contractCount: number;
  customerCount: number;
  detailCount: number;
}

export interface SalesPerformanceStats {
  includedRows: SalesPerformanceRecord[];
  excludedRows: SalesPerformanceRecord[];
  kpis: {
    orderAmount: number;
    salesGrossProfit: number;
    grossProfitRate: number;
    contractCount: number;
    customerCount: number;
    detailCount: number;
  };
  bySalesperson: SummaryRow[];
  byMonth: SummaryRow[];
  byYear: SummaryRow[];
  byProductLevel1: SummaryRow[];
  byProductLevel2: SummaryRow[];
  byProductLevel3: SummaryRow[];
  byCustomer: SummaryRow[];
  byIndustry: SummaryRow[];
  byCustomerType: SummaryRow[];
  byProject: SummaryRow[];
}

export interface KeyProjectMatchResult {
  project: KeyProjectRecord;
  status: MatchStatus;
  matchedRecords: SalesPerformanceRecord[];
  orderAmount: number;
  salesGrossProfit: number;
  contractCount: number;
  salespeople: string[];
  targetAmountRate: number;
  targetGrossProfitRate: number;
  reason: string;
}
