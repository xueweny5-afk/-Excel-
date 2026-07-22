import { ClipboardCopy, Download, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DashboardData } from '../../domain';
import { chartColors, axisCategory, axisValue, baseChart } from '../../lib/chartOptions';
import { EChartsReact } from '../../lib/EChartsReact';
import { compactNumber, formatMoney, formatPercent } from '../../lib/formatters';
import { comparePresalesData, type PresalesComparison } from '../../lib/presalesCompare';
import type { PresalesAnalysis, PresalesStatus, TargetMetric } from '../../lib/presalesMetrics';
import { analyzePresalesDashboard } from '../../lib/presalesMetrics';
import { DashboardCard } from '../common/DashboardCard';
import { InsightBanner } from '../common/InsightBanner';
import { MetricCard } from '../kpi/MetricCard';
import { PresalesOwnerStats } from './PresalesOwnerStats';
import { SalesDimensionStats } from './SalesDimensionStats';
import { T2000CustomerStatsView } from './T2000CustomerStats';

type PresalesSection = 'overview' | 'gap' | 'product' | 'owner' | 'sales' | 't2000' | 'quality' | 'report';

const SECTION_LIST: Array<{ key: PresalesSection; label: string }> = [
  { key: 'overview', label: '经营总览' },
  { key: 'gap', label: '目标缺口' },
  { key: 'product', label: '产品线分析' },
  { key: 'owner', label: '客户统计' },
  { key: 'sales', label: '销售维度' },
  { key: 't2000', label: 'T2000 客户' },
  { key: 'quality', label: '商机质量' },
  { key: 'report', label: '周报输出' },
];

export function PresalesDashboardView({
  data,
  previousData,
  onUpload,
}: {
  data: DashboardData;
  previousData: DashboardData | null;
  onUpload: (file: File) => void;
}) {
  const [section, setSection] = useState<PresalesSection>('overview');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const analysis = useMemo(() => analyzePresalesDashboard(data), [data]);
  const comparison = useMemo(() => comparePresalesData(data, previousData), [data, previousData]);
  const hasData =
    data.report.pplRows > 0 ||
    data.report.summaryRows > 0 ||
    data.report.activityRows > 0 ||
    data.report.performanceRows > 0;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    event.target.value = '';
  }

  function handleUploadDrag(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes('Files')) setIsDraggingUpload(true);
  }

  function handleUploadLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(false);
  }

  function handleUploadDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <section className="presales-module">
      <div className="presales-hero">
        <div>
          <p className="eyebrow">Presales Operating Cockpit</p>
          <h2>售前经营驾驶舱</h2>
          <span>面向区域售前团队，聚焦目标完成、产品线缺口、商机质量和周报输出。</span>
        </div>
        <div
          className={`presales-upload-card ${isDraggingUpload ? 'active' : ''}`}
          data-upload-scope="presales"
          onDragEnter={handleUploadDrag}
          onDragOver={handleUploadDrag}
          onDragLeave={handleUploadLeave}
          onDrop={handleUploadDrop}
        >
          <Upload className="presales-upload-icon" size={34} />
          <strong>{hasData ? '当前数据' : '导入 Excel'}</strong>
          <span>
            {hasData
              ? `${data.report.fileName} / PPL ${data.report.pplRows} 条 / 业绩 ${data.report.performanceRows} 条 / 活动 ${data.report.activityRows} 条`
              : '把 Excel 文件拖到此区域，或点击按钮选择 Excel / CSV 文件。'}
          </span>
          <label className="button primary">
            <Upload size={16} />
            {hasData ? '重新导入' : '导入 Excel'}
            <input type="file" accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.et" onChange={handleChange} />
          </label>
        </div>
      </div>

      <nav className="segment presales-segment" aria-label="售前经营驾驶舱子栏目">
        {SECTION_LIST.map((item) => (
          <button key={item.key} className={section === item.key ? 'active' : ''} onClick={() => setSection(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>

      {analysis.notes.length > 0 && <InsightBanner insights={analysis.notes} />}

      {section === 'overview' && <OverviewSection analysis={analysis} comparison={comparison} />}
      {section === 'gap' && <TargetGapSection analysis={analysis} />}
      {section === 'product' && <ProductLineSection analysis={analysis} />}
      {section === 'owner' && <PresalesOwnerStats analysis={analysis} />}
      {section === 'sales' && <SalesDimensionStats analysis={analysis} data={data} />}
      {section === 't2000' && <T2000CustomerStatsView analysis={analysis} />}
      {section === 'quality' && <QualitySection analysis={analysis} />}
      {section === 'report' && <ReportSection analysis={analysis} />}
    </section>
  );
}

function OverviewSection({ analysis, comparison }: { analysis: PresalesAnalysis; comparison: PresalesComparison }) {
  const targetTop = analysis.targetMetrics.slice(0, 6);
  return (
    <>
      <section className="kpi-grid presales-kpi-grid">
        <MetricCard label="商机储备金额" value={formatMoney(analysis.kpis.pipelineAmount)} hint={`完成率 ${formatPercent(analysis.kpis.pipelineRate)}`} tone="blue" />
        <MetricCard label="商机储备完成率" value={formatPercent(analysis.kpis.pipelineRate)} hint="目标 4,000 万元" tone="green" />
        <MetricCard label="毛利完成金额" value={formatMoney(analysis.kpis.profitAmount)} hint="按业绩明细统计" tone="orange" />
        <MetricCard label="毛利完成率" value={formatPercent(analysis.kpis.profitRate)} hint="目标 700 万元" tone="red" />
        <MetricCard label="T2000 商机金额" value={formatMoney(analysis.kpis.t2000OpportunityAmount)} hint="按 T2000 标签识别" tone="cyan" />
        <MetricCard label="AI XDR 商机金额" value={formatMoney(analysis.kpis.aiXdrOpportunityAmount)} hint="按产品关键词识别" tone="purple" />
        <MetricCard label="Forecast 金额" value={formatMoney(analysis.kpis.forecastAmount)} hint="Commit / Best Case" tone="orange" />
        <MetricCard label="已下单金额" value={formatMoney(analysis.kpis.orderAmount)} hint="按业绩明细统计" tone="red" />
      </section>

      <WeeklyComparison comparison={comparison} />

      <section className="chart-grid">
        <DashboardCard title="目标完成进度" subtitle="按 MVP 固定目标口径计算">
          <ProgressList items={targetTop} />
        </DashboardCard>
        <DashboardCard title="商机阶段漏斗" subtitle="按客户采购阶段汇总金额">
          <EChartsReact option={funnelOption(analysis.stageFunnel)} style={{ height: 310 }} notMerge />
        </DashboardCard>
      </section>

      <InsightBanner insights={analysis.managementInsights} />
    </>
  );
}

function WeeklyComparison({ comparison }: { comparison: PresalesComparison }) {
  return (
    <DashboardCard
      title="本周变化"
      subtitle={
        comparison.hasReference
          ? `对比上一版：${comparison.referenceFileName} / ${comparison.referenceImportedAt}`
          : '第一版参考：暂无上一版导入数据'
      }
    >
      <div className="weekly-compare-grid">
        {comparison.items.map((item) => (
          <div className="weekly-compare-item" key={item.key}>
            <span>{item.label}</span>
            <strong>{metricValue(item.current, item.unit)}</strong>
            <em className={deltaClass(item.delta)}>
              {item.delta === null ? '第一版参考' : deltaText(item.delta, item.unit)}
            </em>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function TargetGapSection({ analysis }: { analysis: PresalesAnalysis }) {
  return (
    <section className="table-panel">
      <div className="section-title">
        <div className="table-heading">
          <h2>目标完成与缺口分析</h2>
          <span>状态规则：100% 已完成，70% 正常推进，50% 中风险，低于 50% 高风险</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="presales-table">
          <thead>
            <tr>
              <th>目标项</th>
              <th>目标</th>
              <th>当前完成</th>
              <th>完成率</th>
              <th>缺口</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {analysis.targetMetrics.map((item) => (
              <tr key={item.key}>
                <td>{item.name}</td>
                <td>{metricValue(item.target, item.unit)}</td>
                <td>{metricValue(item.actual, item.unit)}</td>
                <td>{formatPercent(item.rate)}</td>
                <td>{metricValue(item.gap, item.unit)}</td>
                <td><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductLineSection({ analysis }: { analysis: PresalesAnalysis }) {
  return (
    <section className="presales-product-grid">
      {analysis.productLines.map((line) => (
        <DashboardCard key={line.key} title={line.name} subtitle={`商机 ${line.opportunityCount} 个 / 立项 ${line.projectCount} 个`}>
          <div className="product-line-metrics">
            <span>商机金额<strong>{formatMoney(line.opportunityAmount)}</strong></span>
            <span>商机目标<strong>{formatMoney(line.opportunityTarget)}</strong></span>
            <span>商机缺口<strong>{formatMoney(line.opportunityGap)}</strong></span>
            <span>订单金额<strong>{formatMoney(line.orderAmount)}</strong></span>
            <span>订单缺口<strong>{formatMoney(line.orderGap)}</strong></span>
          </div>
          <p className="product-line-advice">{line.advice}</p>
        </DashboardCard>
      ))}
    </section>
  );
}

function QualitySection({ analysis }: { analysis: PresalesAnalysis }) {
  return (
    <>
      <section className="kpi-grid presales-quality-kpis">
        <MetricCard label="Forecast 金额" value={formatMoney(analysis.quality.forecastAmount)} hint={`占比 ${formatPercent(analysis.quality.forecastRate)}`} tone="orange" />
        <MetricCard label="高赢率未 Forecast" value={`${analysis.quality.highWinNotForecastCount} 个`} hint={formatMoney(analysis.quality.highWinNotForecastAmount)} tone="red" />
        <MetricCard label="无效商机" value={`${analysis.quality.invalidCount} 个`} hint="金额、产品或阶段异常" tone="red" />
      </section>
      <section className="table-panel">
        <div className="section-title">
          <div className="table-heading">
            <h2>商机风险清单</h2>
            <span>自动识别红色风险、黄色风险、绿色机会和无效商机</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="presales-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>客户</th>
                <th>商机</th>
                <th>金额</th>
                <th>阶段</th>
                <th>赢单率</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {analysis.quality.risks.map((item, index) => (
                <tr key={`${item.type}-${item.customerName}-${item.opportunityName}-${index}`}>
                  <td><RiskBadge type={item.type} /></td>
                  <td>{item.customerName}</td>
                  <td>{item.opportunityName}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>{item.stage}</td>
                  <td>{formatPercent(item.winRate)}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
              {analysis.quality.risks.length === 0 && (
                <tr>
                  <td colSpan={7}>当前未识别到风险商机。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ReportSection({ analysis }: { analysis: PresalesAnalysis }) {
  return (
    <DashboardCard
      title="固定格式周报"
      subtitle="格式固定，仅数字随当前 Excel 数据变化"
      action={
        <div className="table-actions">
          <button className="button ghost" onClick={() => void navigator.clipboard.writeText(analysis.weeklyReport)}>
            <ClipboardCopy size={16} />
            复制周报
          </button>
          <button className="button ghost" onClick={() => downloadText(analysis.weeklyReport, 'presales-weekly-report.md')}>
            <Download size={16} />
            Markdown
          </button>
          <button className="button ghost" onClick={() => downloadText(analysis.weeklyReport, 'presales-weekly-report.txt')}>
            <Download size={16} />
            TXT
          </button>
        </div>
      }
    >
      <textarea className="weekly-report-box" readOnly value={analysis.weeklyReport} />
    </DashboardCard>
  );
}

function ProgressList({ items }: { items: TargetMetric[] }) {
  return (
    <div className="target-progress-list">
      {items.map((item) => (
        <div className="target-progress-row" key={item.key}>
          <div>
            <strong>{item.name}</strong>
            <span>{metricValue(item.actual, item.unit)} / {metricValue(item.target, item.unit)}</span>
          </div>
          <div className="target-progress-track">
            <i style={{ width: `${Math.min(100, Math.round(item.rate * 100))}%` }} />
          </div>
          <em>{formatPercent(item.rate)}</em>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: PresalesStatus }) {
  const className = status === '已完成' ? 'success' : status === '正常推进' ? 'normal' : status === '中风险' ? 'warning' : 'danger';
  return <span className={`presales-status ${className}`}>{status}</span>;
}

function RiskBadge({ type }: { type: string }) {
  const className = type.includes('红色') || type.includes('无效') ? 'danger' : type.includes('黄色') ? 'warning' : 'success';
  return <span className={`presales-status ${className}`}>{type}</span>;
}

function funnelOption(items: Array<{ name: string; value: number; count: number }>) {
  return {
    ...baseChart(),
    tooltip: { ...baseChart().tooltip, trigger: 'axis' },
    xAxis: axisValue(),
    yAxis: axisCategory(items.map((item) => item.name), 100),
    series: [
      {
        type: 'bar',
        name: '金额(万元)',
        data: items.map((item) => item.value),
        barMaxWidth: 18,
        itemStyle: { color: chartColors.primary, borderRadius: 6 },
        label: {
          show: true,
          position: 'right',
          color: chartColors.textSecondary,
          formatter: ({ value }: { value: number }) => `${compactNumber(value)} 万`,
        },
      },
    ],
  };
}

function metricValue(value: number, unit: '万元' | '个') {
  return unit === '万元' ? formatMoney(value) : `${compactNumber(value)} 个`;
}

function deltaText(value: number, unit: '万元' | '个') {
  if (value === 0) return '较上周持平';
  const abs = Math.abs(value);
  return `${value > 0 ? '较上周增加' : '较上周减少'} ${unit === '万元' ? formatMoney(abs) : `${compactNumber(abs)} 个`}`;
}

function deltaClass(value: number | null) {
  if (value === null || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
