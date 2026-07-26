import * as XLSX from 'xlsx';
import type { KeyProjectMatchResult, SalesPerformanceRecord, SalesPerformanceStats, SummaryRow } from './types';
import { formatRate, toRoundedWan } from './utils';

export function exportPerformanceDetails(records: SalesPerformanceRecord[], fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(records.map(recordToExportRow)),
    '合并明细',
  );
  XLSX.writeFile(workbook, fileName);
}

export function exportPerformanceStats(stats: SalesPerformanceStats, fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([kpiRow(stats)]), '总体汇总');
  appendSummary(workbook, '销售人员汇总', stats.bySalesperson);
  appendSummary(workbook, '月度汇总', stats.byMonth);
  appendSummary(workbook, '年度汇总', stats.byYear);
  appendSummary(workbook, '产品一级汇总', stats.byProductLevel1);
  appendSummary(workbook, '产品二级汇总', stats.byProductLevel2);
  appendSummary(workbook, '产品三级汇总', stats.byProductLevel3);
  appendSummary(workbook, '客户汇总', stats.byCustomer);
  appendSummary(workbook, '行业汇总', stats.byIndustry);
  appendSummary(workbook, '业绩订单类型汇总', stats.byCustomerType);
  appendSummary(workbook, '项目汇总', stats.byProject);
  XLSX.writeFile(workbook, fileName);
}

export function exportKeyProjectMatches(matches: KeyProjectMatchResult[], fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      matches.map((item) => ({
        重点项目名称: item.project.projectName,
        客户名称: item.project.customerName,
        匹配状态: item.status,
        匹配业绩记录数: item.matchedRecords.length,
        合同总额万元: toRoundedWan(item.orderAmount),
        销售毛利万元: toRoundedWan(item.salesGrossProfit),
        合同数: item.contractCount,
        涉及销售人员: item.salespeople.join('、'),
        目标金额万元: toRoundedWan(item.project.targetAmount),
        目标毛利万元: toRoundedWan(item.project.targetGrossProfit),
        目标金额完成率: formatRate(item.targetAmountRate),
        目标毛利完成率: formatRate(item.targetGrossProfitRate),
        未匹配原因: item.reason,
      })),
    ),
    '重点项目对比',
  );
  XLSX.writeFile(workbook, fileName);
}

function appendSummary(workbook: XLSX.WorkBook, sheetName: string, rows: SummaryRow[]) {
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        名称: row.name,
        合同总额万元: toRoundedWan(row.orderAmount),
        销售毛利万元: toRoundedWan(row.salesGrossProfit),
        销售毛利率: formatRate(row.grossProfitRate),
        合同数: row.contractCount,
        客户数: row.customerCount,
        产品明细数: row.detailCount,
      })),
    ),
    sheetName,
  );
}

function kpiRow(stats: SalesPerformanceStats) {
  return {
    合同总额万元: toRoundedWan(stats.kpis.orderAmount),
    销售毛利万元: toRoundedWan(stats.kpis.salesGrossProfit),
    销售毛利率: formatRate(stats.kpis.grossProfitRate),
    合同数: stats.kpis.contractCount,
    客户数: stats.kpis.customerCount,
    产品明细数: stats.kpis.detailCount,
  };
}

function recordToExportRow(row: SalesPerformanceRecord) {
  return {
    来源文件: row.sourceFileName,
    Sheet: row.sourceSheetName,
    行号: row.sourceRowNumber,
    销售人员: row.salesperson,
    最终用户: row.customerName,
    项目名称: row.projectName,
    合同编号: row.contractNumber,
    业绩确认年份: row.confirmationYear ?? '',
    业绩确认月份: row.confirmationMonth ?? '',
    确认状态: row.confirmationStatus,
    合同总额万元: toRoundedWan(row.orderAmount),
    销售毛利万元: toRoundedWan(row.salesGrossProfit),
    产品一级分类: row.productLevel1,
    产品二级分类: row.productLevel2,
    产品三级分类: row.productLevel3,
    产品名称: row.productName,
    业绩订单类型: row.customerType,
    行业: row.industry,
    是否纳入统计: row.included && row.duplicateStatus === '正常' ? '是' : '否',
    排除原因: row.exclusionReason,
    重复状态: row.duplicateStatus,
  };
}
