import { ClipboardCopy, Download, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DashboardData } from '../../domain';
import { chartColors, axisCategory, axisValue, baseChart } from '../../lib/chartOptions';
import { EChartsReact } from '../../lib/EChartsReact';
import { compactNumber, formatMoney, formatPercent } from '../../lib/formatters';
import {
  comparePresalesData,
  type PresalesComparison,
  type PresalesOpportunityChange,
  type PresalesOpportunityVersion,
} from '../../lib/presalesCompare';
import type { PresalesAnalysis, PresalesStatus, TargetMetric } from '../../lib/presalesMetrics';
import { analyzePresalesDashboard } from '../../lib/presalesMetrics';
import type { PresalesVersionSummary } from '../../lib/presalesVersionHistory';
import { DashboardCard } from '../common/DashboardCard';
import { InsightBanner } from '../common/InsightBanner';
import { MetricCard } from '../kpi/MetricCard';
import { PresalesOwnerStats } from './PresalesOwnerStats';
import { SalesDimensionStats } from './SalesDimensionStats';
import { T2000CustomerStatsView } from './T2000CustomerStats';

type PresalesSection =
  | 'overview'
  | 'changes'
  | 'gap'
  | 'product'
  | 'owner'
  | 'sales'
  | 't2000'
  | 'quality'
  | 'report';

const SECTION_LIST: Array<{ key: PresalesSection; label: string }> = [
  { key: 'overview', label: '经营总览' },
  { key: 'changes', label: '数据变化' },
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
  versions,
  onUpload,
}: {
  data: DashboardData;
  previousData: DashboardData | null;
  versions: PresalesVersionSummary[];
  onUpload: (file: File) => void;
}) {
  const [section, setSection] = useState<PresalesSection>('overview');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [selectedChange, setSelectedChange] = useState<PresalesOpportunityChange | null>(null);
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
              ? `${data.report.fileName} / PPL ${data.report.pplRows} 条 / 业绩 ${data.report.performanceRows} 条 / 活动 ${data.report.activityRows} 条 / 已保存 ${versions.length} 个版本`
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
          <button
            key={item.key}
            className={section === item.key ? 'active' : ''}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {analysis.notes.length > 0 && <InsightBanner insights={analysis.notes} />}

      {section === 'overview' && <OverviewSection analysis={analysis} comparison={comparison} />}
      {section === 'changes' && (
        <VersionChangesSection
          comparison={comparison}
          versions={versions}
          onSelectChange={setSelectedChange}
        />
      )}
      {section === 'gap' && <TargetGapSection analysis={analysis} />}
      {section === 'product' && <ProductLineSection analysis={analysis} />}
      {section === 'owner' && <PresalesOwnerStats analysis={analysis} />}
      {section === 'sales' && <SalesDimensionStats analysis={analysis} data={data} />}
      {section === 't2000' && <T2000CustomerStatsView analysis={analysis} />}
      {section === 'quality' && <QualitySection analysis={analysis} />}
      {section === 'report' && <ReportSection analysis={analysis} />}
      {selectedChange && (
        <OpportunityChangeDrawer change={selectedChange} onClose={() => setSelectedChange(null)} />
      )}
    </section>
  );
}

function OverviewSection({
  analysis,
  comparison,
}: {
  analysis: PresalesAnalysis;
  comparison: PresalesComparison;
}) {
  const targetTop = analysis.targetMetrics.slice(0, 6);
  return (
    <>
      <section className="kpi-grid presales-kpi-grid">
        <MetricCard
          label="商机储备金额"
          value={formatMoney(analysis.kpis.pipelineAmount)}
          hint={`完成率 ${formatPercent(analysis.kpis.pipelineRate)}`}
          tone="blue"
        />
        <MetricCard
          label="商机储备完成率"
          value={formatPercent(analysis.kpis.pipelineRate)}
          hint="目标 4,000 万元"
          tone="green"
        />
        <MetricCard
          label="毛利完成金额"
          value={formatMoney(analysis.kpis.profitAmount)}
          hint="按业绩明细统计"
          tone="orange"
        />
        <MetricCard
          label="毛利完成率"
          value={formatPercent(analysis.kpis.profitRate)}
          hint="目标 700 万元"
          tone="red"
        />
        <MetricCard
          label="T2000 商机金额"
          value={formatMoney(analysis.kpis.t2000OpportunityAmount)}
          hint="按 T2000 标签识别"
          tone="cyan"
        />
        <MetricCard
          label="AI XDR 商机金额"
          value={formatMoney(analysis.kpis.aiXdrOpportunityAmount)}
          hint="按产品关键词识别"
          tone="purple"
        />
        <MetricCard
          label="Forecast 金额"
          value={formatMoney(analysis.kpis.forecastAmount)}
          hint="Commit / Best Case"
          tone="orange"
        />
        <MetricCard
          label="已下单金额"
          value={formatMoney(analysis.kpis.orderAmount)}
          hint="按业绩明细统计"
          tone="red"
        />
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
      title="版本指标变化"
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

function VersionChangesSection({
  comparison,
  versions,
  onSelectChange,
}: {
  comparison: PresalesComparison;
  versions: PresalesVersionSummary[];
  onSelectChange: (change: PresalesOpportunityChange) => void;
}) {
  return (
    <>
      <WeeklyComparison comparison={comparison} />

      <section className="kpi-grid presales-change-kpis">
        <MetricCard
          label="新增商机"
          value={`${comparison.changeSummary.added} 个`}
          hint="当前版本新增"
          tone="green"
        />
        <MetricCard
          label="变化商机"
          value={`${comparison.changeSummary.changed} 个`}
          hint="金额、阶段、负责人或产品变化"
          tone="orange"
        />
        <MetricCard
          label="移除商机"
          value={`${comparison.changeSummary.removed} 个`}
          hint="上一版存在、当前版缺失"
          tone="red"
        />
      </section>

      <section className="table-panel">
        <div className="section-title">
          <div className="table-heading">
            <h2>商机变化明细</h2>
            <span>点击记录查看更新前后完整字段</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="presales-table">
            <thead>
              <tr>
                <th>变化类型</th>
                <th>客户</th>
                <th>商机</th>
                <th>变化字段</th>
                <th>原金额</th>
                <th>新金额</th>
                <th>原阶段</th>
                <th>新阶段</th>
              </tr>
            </thead>
            <tbody>
              {comparison.opportunityChanges.map((change) => (
                <tr
                  key={change.key}
                  className="clickable-row"
                  tabIndex={0}
                  onClick={() => onSelectChange(change)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectChange(change);
                  }}
                >
                  <td>
                    <ChangeTypeBadge type={change.type} />
                  </td>
                  <td>{change.customerName}</td>
                  <td>{change.opportunityName}</td>
                  <td>{change.changedFields.join('、')}</td>
                  <td>{change.before ? formatMoney(change.before.amount) : '—'}</td>
                  <td>{change.after ? formatMoney(change.after.amount) : '—'}</td>
                  <td>{change.before?.stage || '—'}</td>
                  <td>{change.after?.stage || '—'}</td>
                </tr>
              ))}
              {comparison.opportunityChanges.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    {comparison.hasReference
                      ? '当前版本没有识别到商机变化。'
                      : '当前为首个版本，暂无上一版可对比。'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-panel">
        <div className="section-title">
          <div className="table-heading">
            <h2>导入版本记录</h2>
            <span>首版保存完整基线，后续版本仅保存差异</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="presales-table version-history-table">
            <thead>
              <tr>
                <th>版本</th>
                <th>类型</th>
                <th>导入时间</th>
                <th>文件</th>
                <th>新增记录</th>
                <th>修改记录</th>
                <th>删除记录</th>
              </tr>
            </thead>
            <tbody>
              {[...versions].reverse().map((version) => (
                <tr key={version.id}>
                  <td>V{version.order}</td>
                  <td>{version.kind === 'baseline' ? '完整基线' : '增量更新'}</td>
                  <td>{version.importedAt}</td>
                  <td>{version.fileName}</td>
                  <td>{version.changes.added}</td>
                  <td>{version.changes.updated}</td>
                  <td>{version.changes.removed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function OpportunityChangeDrawer({
  change,
  onClose,
}: {
  change: PresalesOpportunityChange;
  onClose: () => void;
}) {
  return (
    <aside className="drawer presales-change-drawer" aria-label="商机变化详情">
      <button className="drawer-close" onClick={onClose} aria-label="关闭商机变化详情">
        <X size={20} />
      </button>
      <h2>{change.opportunityName}</h2>
      <p>
        {change.customerName} · <ChangeTypeBadge type={change.type} />
      </p>
      <dl>
        <dt>变化字段</dt>
        <dd>{change.changedFields.join('、')}</dd>
      </dl>
      <div className="presales-change-compare">
        <OpportunityVersionDetails title="更新前" value={change.before} />
        <OpportunityVersionDetails title="更新后" value={change.after} />
      </div>
    </aside>
  );
}

function OpportunityVersionDetails({
  title,
  value,
}: {
  title: string;
  value: PresalesOpportunityVersion | null;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {value ? (
        <dl>
          <dt>金额</dt>
          <dd>{formatMoney(value.amount)}</dd>
          <dt>阶段 / 状态</dt>
          <dd>
            {value.stage || '—'} / {value.status || '—'}
          </dd>
          <dt>负责人</dt>
          <dd>{value.owner || '—'}</dd>
          <dt>产品</dt>
          <dd>
            {[value.product, value.productLevel2, value.productLevel3].filter(Boolean).join(' / ') || '—'}
          </dd>
        </dl>
      ) : (
        <p>无记录</p>
      )}
    </section>
  );
}

function ChangeTypeBadge({ type }: { type: PresalesOpportunityChange['type'] }) {
  const label = type === 'added' ? '新增' : type === 'removed' ? '移除' : '变更';
  const className = type === 'added' ? 'success' : type === 'removed' ? 'danger' : 'warning';
  return <span className={`presales-status ${className}`}>{label}</span>;
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
                <td>
                  <StatusBadge status={item.status} />
                </td>
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
        <DashboardCard
          key={line.key}
          title={line.name}
          subtitle={`商机 ${line.opportunityCount} 个 / 立项 ${line.projectCount} 个`}
        >
          <div className="product-line-metrics">
            <span>
              商机金额<strong>{formatMoney(line.opportunityAmount)}</strong>
            </span>
            <span>
              商机目标<strong>{formatMoney(line.opportunityTarget)}</strong>
            </span>
            <span>
              商机缺口<strong>{formatMoney(line.opportunityGap)}</strong>
            </span>
            <span>
              订单金额<strong>{formatMoney(line.orderAmount)}</strong>
            </span>
            <span>
              订单缺口<strong>{formatMoney(line.orderGap)}</strong>
            </span>
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
        <MetricCard
          label="Forecast 金额"
          value={formatMoney(analysis.quality.forecastAmount)}
          hint={`占比 ${formatPercent(analysis.quality.forecastRate)}`}
          tone="orange"
        />
        <MetricCard
          label="高赢率未 Forecast"
          value={`${analysis.quality.highWinNotForecastCount} 个`}
          hint={formatMoney(analysis.quality.highWinNotForecastAmount)}
          tone="red"
        />
        <MetricCard
          label="无效商机"
          value={`${analysis.quality.invalidCount} 个`}
          hint="金额、产品或阶段异常"
          tone="red"
        />
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
                  <td>
                    <RiskBadge type={item.type} />
                  </td>
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
          <button
            className="button ghost"
            onClick={() => void navigator.clipboard.writeText(analysis.weeklyReport)}
          >
            <ClipboardCopy size={16} />
            复制周报
          </button>
          <button
            className="button ghost"
            onClick={() => downloadText(analysis.weeklyReport, 'presales-weekly-report.md')}
          >
            <Download size={16} />
            Markdown
          </button>
          <button
            className="button ghost"
            onClick={() => downloadText(analysis.weeklyReport, 'presales-weekly-report.txt')}
          >
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
            <span>
              {metricValue(item.actual, item.unit)} / {metricValue(item.target, item.unit)}
            </span>
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
  const className =
    status === '已完成'
      ? 'success'
      : status === '正常推进'
        ? 'normal'
        : status === '中风险'
          ? 'warning'
          : 'danger';
  return <span className={`presales-status ${className}`}>{status}</span>;
}

function RiskBadge({ type }: { type: string }) {
  const className =
    type.includes('红色') || type.includes('无效') ? 'danger' : type.includes('黄色') ? 'warning' : 'success';
  return <span className={`presales-status ${className}`}>{type}</span>;
}

function funnelOption(items: Array<{ name: string; value: number; count: number }>) {
  return {
    ...baseChart(),
    tooltip: { ...baseChart().tooltip, trigger: 'axis' },
    xAxis: axisValue(),
    yAxis: axisCategory(
      items.map((item) => item.name),
      100,
    ),
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
  if (value === 0) return '较上一版持平';
  const abs = Math.abs(value);
  return `${value > 0 ? '较上一版增加' : '较上一版减少'} ${unit === '万元' ? formatMoney(abs) : `${compactNumber(abs)} 个`}`;
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
