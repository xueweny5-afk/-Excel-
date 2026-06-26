import type { ImportReport } from '../../domain';

interface ImportReportPanelProps {
  report: ImportReport;
}

/** 导入结果/字段识别/提示 三栏报告面板 */
export function ImportReportPanel({ report }: ImportReportPanelProps) {
  const summary = `PPL 明细 ${report.pplRows} 行，数据汇总 ${report.summaryRows} 行，活动记录 ${report.activityRows} 行，跳过 ${report.skippedRows} 行`;
  const fields = report.detectedFields.slice(0, 7).join(' / ') || '未识别到字段';
  const hints = [...report.missingFields.map((item) => `缺少 ${item}`), ...report.warnings];

  return (
    <section className="report-panel">
      <div>
        <strong>导入结果</strong>
        <span>{summary}</span>
      </div>
      <div>
        <strong>字段识别</strong>
        <span>{fields}</span>
      </div>
      {hints.length > 0 && (
        <div>
          <strong>提示</strong>
          <span>{hints.join('；')}</span>
        </div>
      )}
    </section>
  );
}
