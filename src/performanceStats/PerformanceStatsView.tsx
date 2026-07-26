import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import type { EChartsInstance } from 'echarts-for-react';
import { EChartsReact } from '../lib/EChartsReact';
import { DashboardCard } from '../components/common/DashboardCard';
import { StatusCard } from '../components/common/StatusCard';
import type {
  KeyProjectImportCheck,
  KeyProjectRecord,
  KeyProjectSourceFile,
  SalesPerformanceFilters,
  SalesPerformanceImportCheck,
  SalesPerformanceRecord,
  SalesPerformanceSourceFile,
  SummaryRow,
} from './types';
import { parseKeyProjectFile, parsePerformanceFile } from './parser';
import {
  availableYears,
  buildKeyProjectMatches,
  buildSalesPerformanceStats,
  EMPTY_FILTERS,
  summarizeKeyProjectMatches,
  uniqueOptions,
} from './statistics';
import { exportKeyProjectMatches, exportPerformanceDetails, exportPerformanceStats } from './exporters';
import { formatRate, formatWan, toRoundedWan } from './utils';
import './performanceStats.css';

type TabKey = 'overview' | 'sales' | 'productCustomer' | 'project' | 'keyProject' | 'details';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '总览' },
  { key: 'sales', label: '销售分析' },
  { key: 'productCustomer', label: '产品客户分析' },
  { key: 'project', label: '项目统计' },
  { key: 'keyProject', label: '重点项目对比' },
  { key: 'details', label: '数据明细' },
];

export function PerformanceStatsView() {
  const [sourceFiles, setSourceFiles] = useState<SalesPerformanceSourceFile[]>([]);
  const [records, setRecords] = useState<SalesPerformanceRecord[]>([]);
  const [checks, setChecks] = useState<SalesPerformanceImportCheck[]>([]);
  const [keyProjectFiles, setKeyProjectFiles] = useState<KeyProjectSourceFile[]>([]);
  const [keyProjects, setKeyProjects] = useState<KeyProjectRecord[]>([]);
  const [keyProjectChecks, setKeyProjectChecks] = useState<KeyProjectImportCheck[]>([]);
  const [filters, setFilters] = useState<SalesPerformanceFilters>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState('');
  const [feedback, setFeedback] = useState('');
  const [dragging, setDragging] = useState<'performance' | 'keyProject' | ''>('');

  const stats = useMemo(() => buildSalesPerformanceStats(records, filters), [filters, records]);
  const keyProjectMatches = useMemo(
    () => buildKeyProjectMatches(keyProjects, stats.includedRows),
    [keyProjects, stats.includedRows],
  );
  const keyProjectSummary = useMemo(() => summarizeKeyProjectMatches(keyProjectMatches), [keyProjectMatches]);
  const years = useMemo(() => availableYears(records), [records]);
  const options = useMemo(
    () => ({
      salesperson: uniqueOptions(records, 'salesperson'),
      productLevel1: uniqueOptions(records, 'productLevel1'),
      productLevel2: uniqueOptions(records, 'productLevel2'),
      productLevel3: uniqueOptions(records, 'productLevel3'),
      customerType: uniqueOptions(records, 'customerType'),
      industry: uniqueOptions(records, 'industry'),
    }),
    [records],
  );

  async function importPerformanceFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setLoading('正在导入业绩表...');
    setFeedback('');
    const existingDigests = new Set(sourceFiles.map((file) => file.digest));
    const nextFiles: SalesPerformanceSourceFile[] = [];
    const nextRecords: SalesPerformanceRecord[] = [];
    const nextChecks: SalesPerformanceImportCheck[] = [];
    try {
      for (const file of list) {
        const result = await parsePerformanceFile(file, existingDigests);
        nextFiles.push(result.sourceFile);
        nextRecords.push(...result.records);
        nextChecks.push(result.check);
        if (result.sourceFile.status === '正常') existingDigests.add(result.sourceFile.digest);
      }
      setSourceFiles((current) => [...current, ...nextFiles]);
      setRecords((current) => [...current, ...nextRecords]);
      setChecks((current) => [...current, ...nextChecks]);
      setFeedback(`已处理 ${list.length} 个业绩文件。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '业绩表导入失败。');
    } finally {
      setLoading('');
    }
  }

  async function importKeyProjectFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setLoading('正在导入重点项目表...');
    setFeedback('');
    const existingDigests = new Set(keyProjectFiles.map((file) => file.digest));
    const nextFiles: KeyProjectSourceFile[] = [];
    const nextProjects: KeyProjectRecord[] = [];
    const nextChecks: KeyProjectImportCheck[] = [];
    try {
      for (const file of list) {
        const result = await parseKeyProjectFile(file, existingDigests);
        nextFiles.push(result.sourceFile);
        nextProjects.push(...result.projects);
        nextChecks.push(result.check);
        if (result.sourceFile.status === '正常') existingDigests.add(result.sourceFile.digest);
      }
      setKeyProjectFiles((current) => [...current, ...nextFiles]);
      setKeyProjects((current) => [...current, ...nextProjects]);
      setKeyProjectChecks((current) => [...current, ...nextChecks]);
      setFeedback(`已处理 ${list.length} 个重点项目文件。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '重点项目表导入失败。');
    } finally {
      setLoading('');
    }
  }

  function removePerformanceFile(fileId: string) {
    setSourceFiles((current) => current.filter((file) => file.id !== fileId));
    setRecords((current) => current.filter((record) => record.sourceFileId !== fileId));
    setChecks((current) => current.filter((check) => check.fileId !== fileId));
  }

  function removeKeyProjectFile(fileId: string) {
    setKeyProjectFiles((current) => current.filter((file) => file.id !== fileId));
    setKeyProjects((current) => current.filter((project) => project.sourceFileId !== fileId));
    setKeyProjectChecks((current) => current.filter((check) => check.fileId !== fileId));
  }

  function clearAll() {
    setSourceFiles([]);
    setRecords([]);
    setChecks([]);
    setKeyProjectFiles([]);
    setKeyProjects([]);
    setKeyProjectChecks([]);
    setFilters(EMPTY_FILTERS);
    setFeedback('销售业绩统计临时数据已清空。');
  }

  function patchFilters(patch: Partial<SalesPerformanceFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  const hasData = records.length > 0;

  return (
    <section className="performance-module">
      <header className="performance-hero">
        <div>
          <p>Temporary Sales Performance Analysis</p>
          <h1>销售业绩统计</h1>
          <span>当前数据仅保存在本次浏览器会话中，刷新或关闭页面后将被清除。</span>
        </div>
        <div className="performance-actions">
          <button className="button ghost" onClick={clearAll} disabled={!hasData && keyProjects.length === 0}>
            <RotateCcw size={16} />
            清空全部数据
          </button>
          <button
            className="button ghost"
            disabled={!hasData}
            onClick={() => exportPerformanceDetails(stats.includedRows, `销售业绩合并明细-${today()}.xlsx`)}
          >
            <Download size={16} />
            导出合并明细
          </button>
          <button
            className="button primary"
            disabled={!hasData}
            onClick={() => exportPerformanceStats(stats, `销售业绩统计结果-${today()}.xlsx`)}
          >
            <Download size={16} />
            导出统计结果
          </button>
        </div>
      </header>

      {loading && <StatusCard title={loading} description="正在浏览器本地解析文件，不会上传服务器。" />}
      {feedback && <StatusCard title="处理结果" description={feedback} />}

      <section className="performance-import-grid">
        <ImportPanel
          title="导入业绩表"
          description="支持多文件连续导入，数据只进入销售业绩统计模块。"
          dragging={dragging === 'performance'}
          onFiles={importPerformanceFiles}
          onDrag={(value) => setDragging(value ? 'performance' : '')}
        />
        <ImportPanel
          title="导入重点项目表"
          description="独立入口，用于和业绩表按项目名称 + 客户名称比对。"
          dragging={dragging === 'keyProject'}
          onFiles={importKeyProjectFiles}
          onDrag={(value) => setDragging(value ? 'keyProject' : '')}
        />
      </section>

      <FileCards
        sourceFiles={sourceFiles}
        keyProjectFiles={keyProjectFiles}
        onRemovePerformance={removePerformanceFile}
        onRemoveKeyProject={removeKeyProjectFile}
      />

      <CheckPanel checks={checks} keyProjectChecks={keyProjectChecks} />

      {hasData ? (
        <>
          <FilterPanel filters={filters} years={years} options={options} onChange={patchFilters} />
          <nav className="performance-tabs">
            {TABS.map((tab) => (
              <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </button>
            ))}
          </nav>
          {activeTab === 'overview' && <OverviewTab stats={stats} />}
          {activeTab === 'sales' && <SalesTab stats={stats} />}
          {activeTab === 'productCustomer' && <ProductCustomerTab stats={stats} />}
          {activeTab === 'project' && <ProjectTab stats={stats} />}
          {activeTab === 'keyProject' && (
            <KeyProjectTab
              matches={keyProjectMatches}
              summary={keyProjectSummary}
              onExport={() => exportKeyProjectMatches(keyProjectMatches, `重点项目对比-${today()}.xlsx`)}
            />
          )}
          {activeTab === 'details' && <DetailsTab records={stats.includedRows} excludedRows={stats.excludedRows} />}
        </>
      ) : (
        <StatusCard title="暂无销售业绩数据" description="请先导入一张或多张业绩 Excel，系统会在当前页面会话内自动合并统计。" />
      )}
    </section>
  );
}

function ImportPanel({
  title,
  description,
  dragging,
  onFiles,
  onDrag,
}: {
  title: string;
  description: string;
  dragging: boolean;
  onFiles: (files: FileList | File[]) => void;
  onDrag: (dragging: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`performance-import-card ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDrag(true);
      }}
      onDragLeave={() => onDrag(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDrag(false);
        void onFiles(event.dataTransfer.files);
      }}
    >
      <FileSpreadsheet size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button primary" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />
        选择 Excel
      </button>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.et"
        onChange={(event) => {
          if (event.target.files) void onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}

function FileCards({
  sourceFiles,
  keyProjectFiles,
  onRemovePerformance,
  onRemoveKeyProject,
}: {
  sourceFiles: SalesPerformanceSourceFile[];
  keyProjectFiles: KeyProjectSourceFile[];
  onRemovePerformance: (fileId: string) => void;
  onRemoveKeyProject: (fileId: string) => void;
}) {
  if (sourceFiles.length === 0 && keyProjectFiles.length === 0) return null;
  return (
    <section className="performance-panel">
      <div className="performance-section-title">
        <h2>文件列表</h2>
        <span>删除任一文件后自动重新统计</span>
      </div>
      <div className="performance-file-grid">
        {sourceFiles.map((file) => (
          <FileCard
            key={file.id}
            title={file.name}
            tag="业绩表"
            meta={`${file.salesperson} / 原始 ${file.rawRowCount} / 纳入 ${file.includedRowCount} / 排除 ${file.excludedRowCount}`}
            status={file.status}
            message={file.message}
            onRemove={() => onRemovePerformance(file.id)}
          />
        ))}
        {keyProjectFiles.map((file) => (
          <FileCard
            key={file.id}
            title={file.name}
            tag="重点项目表"
            meta={`原始 ${file.rawRowCount} / 纳入 ${file.includedRowCount}`}
            status={file.status}
            message={file.message}
            onRemove={() => onRemoveKeyProject(file.id)}
          />
        ))}
      </div>
    </section>
  );
}

function FileCard({
  title,
  tag,
  meta,
  status,
  message,
  onRemove,
}: {
  title: string;
  tag: string;
  meta: string;
  status: string;
  message?: string;
  onRemove: () => void;
}) {
  return (
    <article className="performance-file-card">
      <div>
        <span>{tag}</span>
        <strong>{title}</strong>
        <p>{meta}</p>
        {message && <p className="warning-text">{message}</p>}
      </div>
      <div>
        <em className={status === '正常' ? 'success' : 'warning'}>{status}</em>
        <button className="icon-button" onClick={onRemove} aria-label={`删除 ${title}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function CheckPanel({
  checks,
  keyProjectChecks,
}: {
  checks: SalesPerformanceImportCheck[];
  keyProjectChecks: KeyProjectImportCheck[];
}) {
  if (checks.length === 0 && keyProjectChecks.length === 0) return null;
  return (
    <section className="performance-panel">
      <div className="performance-section-title">
        <h2>数据检查</h2>
        <span>先看检查结果，再看统计图表</span>
      </div>
      <div className="check-grid">
        {checks.map((check) => (
          <article key={check.fileId} className="check-card">
            <h3>{check.fileName}</h3>
            <p>识别 Sheet：{check.sheetName}</p>
            <p>
              本次导入 {check.rawRows} 条，纳入统计 {check.includedRows} 条，排除 {check.excludedRows} 条。
            </p>
            <ul>
              <li>已确认：{check.confirmedRows}</li>
              <li>待确认/非确认：{check.pendingRows}（仅提示，不影响金额统计）</li>
              <li>年月异常：{check.missingDateRows}</li>
              <li>金额为空：{check.invalidAmountRows}</li>
              <li>合同编号为空：{check.emptyContractRows}</li>
              <li>疑似重复：{check.duplicateRows}</li>
            </ul>
            {check.negativeAmountRows > 0 && <p className="warning-text">发现 {check.negativeAmountRows} 条负数金额记录。</p>}
            {check.missingFields.length > 0 && <p className="warning-text">缺少字段：{check.missingFields.join('、')}</p>}
          </article>
        ))}
        {keyProjectChecks.map((check) => (
          <article key={check.fileId} className="check-card">
            <h3>{check.fileName}</h3>
            <p>重点项目 Sheet：{check.sheetName}</p>
            <p>
              原始 {check.rawRows} 条，纳入对比 {check.includedRows} 条。
            </p>
            {check.missingFields.length > 0 && <p className="warning-text">缺少字段：{check.missingFields.join('、')}</p>}
            {check.warnings.map((warning) => (
              <p key={warning} className="warning-text">
                {warning}
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function FilterPanel({
  filters,
  years,
  options,
  onChange,
}: {
  filters: SalesPerformanceFilters;
  years: number[];
  options: Record<
    'salesperson' | 'productLevel1' | 'productLevel2' | 'productLevel3' | 'customerType' | 'industry',
    string[]
  >;
  onChange: (patch: Partial<SalesPerformanceFilters>) => void;
}) {
  return (
    <section className="performance-filter-panel">
      <label className="keyword-field">
        <Search size={16} />
        <input
          value={filters.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder="搜索项目、客户、合同、销售、产品、行业"
        />
      </label>
      <MultiSelect label="年份" values={years} selected={filters.years} onChange={(years) => onChange({ years })} />
      <MultiSelect label="月份" values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} selected={filters.months} onChange={(months) => onChange({ months })} />
      <FuzzyFilter label="销售人员" value={filters.salesperson} options={options.salesperson} onChange={(salesperson) => onChange({ salesperson })} />
      <FuzzyFilter label="产品一级" value={filters.productLevel1} options={options.productLevel1} onChange={(productLevel1) => onChange({ productLevel1 })} />
      <FuzzyFilter label="产品二级" value={filters.productLevel2} options={options.productLevel2} onChange={(productLevel2) => onChange({ productLevel2 })} />
      <FuzzyFilter label="产品三级" value={filters.productLevel3} options={options.productLevel3} onChange={(productLevel3) => onChange({ productLevel3 })} />
      <FuzzyFilter label="业绩订单类型" value={filters.customerType} options={options.customerType} onChange={(customerType) => onChange({ customerType })} />
      <FuzzyFilter label="行业" value={filters.industry} options={options.industry} onChange={(industry) => onChange({ industry })} />
      <FuzzyFilter label="重复状态" value={filters.duplicateStatus} options={['正常', '疑似重复']} onChange={(duplicateStatus) => onChange({ duplicateStatus: duplicateStatus as SalesPerformanceFilters['duplicateStatus'] })} />
      <button className="button ghost" onClick={() => onChange(EMPTY_FILTERS)}>
        清空筛选
      </button>
    </section>
  );
}

function FuzzyFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const allOptions = useMemo(() => ['', ...options], [options]);
  const visibleOptions = useMemo(() => {
    if (!query.trim()) return allOptions.slice(0, 10);
    return allOptions.filter((option) => fuzzyMatches(option || '全部', query)).slice(0, 10);
  }, [allOptions, query]);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <label ref={rootRef} className="performance-fuzzy-filter">
      {label}
      <input
        role="combobox"
        aria-expanded={open}
        value={open ? query : value || '全部'}
        placeholder="输入关键词模糊搜索"
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="performance-fuzzy-menu">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option || '__all__'}
                type="button"
                onClick={() => {
                  onChange(option);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {option || '全部'}
              </button>
            ))
          ) : (
            <span>没有匹配项</span>
          )}
        </div>
      )}
    </label>
  );
}

function fuzzyMatches(value: string, query: string) {
  const normalizedValue = normalizeFilterText(value);
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) return true;
  return normalizedValue.includes(normalizedQuery) || isSubsequence(normalizedQuery, normalizedValue);
}

function normalizeFilterText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function isSubsequence(needle: string, haystack: string) {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function MultiSelect({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: number[];
  selected: number[];
  onChange: (values: number[]) => void;
}) {
  return (
    <div className="multi-filter">
      <span>{label}</span>
      <div>
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              className={active ? 'active' : ''}
              onClick={() => onChange(active ? selected.filter((item) => item !== value) : [...selected, value])}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewTab({ stats }: { stats: ReturnType<typeof buildSalesPerformanceStats> }) {
  return (
    <>
      <KpiCards stats={stats} />
      <div className="performance-chart-grid">
        <ExportableChart title="月度趋势" option={trendOption(stats.byMonth)} />
        <ExportableChart title="年度对比" option={barOption(stats.byYear, 'orderAmount')} />
        <ExportableChart title="业绩订单类型结构" option={pieOption(stats.byCustomerType)} />
        <ExportableChart title="行业贡献" option={barOption(stats.byIndustry.slice(0, 10), 'orderAmount')} />
      </div>
    </>
  );
}

function SalesTab({ stats }: { stats: ReturnType<typeof buildSalesPerformanceStats> }) {
  return (
    <div className="performance-chart-grid">
      <ExportableChart title="销售人员合同总额排名" option={barOption(stats.bySalesperson, 'orderAmount')} />
      <ExportableChart title="销售人员销售毛利排名" option={barOption(stats.bySalesperson, 'salesGrossProfit')} />
      <SummaryTable title="销售人员汇总" rows={stats.bySalesperson} />
    </div>
  );
}

function ProductCustomerTab({ stats }: { stats: ReturnType<typeof buildSalesPerformanceStats> }) {
  return (
    <div className="performance-chart-grid">
      <ExportableChart title="产品二级分类统计" option={barOption(stats.byProductLevel2.slice(0, 10), 'orderAmount')} />
      <ExportableChart title="产品三级分类统计" option={barOption(stats.byProductLevel3.slice(0, 10), 'orderAmount')} />
      <ExportableChart title="行业统计" option={barOption(stats.byIndustry.slice(0, 10), 'orderAmount')} />
      <ExportableChart title="客户 Top10" option={barOption(stats.byCustomer.slice(0, 10), 'orderAmount')} />
      <SummaryTable title="产品二级分类汇总" rows={stats.byProductLevel2} />
      <SummaryTable title="产品三级分类汇总" rows={stats.byProductLevel3} />
      <SummaryTable title="行业汇总" rows={stats.byIndustry} />
      <SummaryTable title="客户贡献排名" rows={stats.byCustomer.slice(0, 30)} />
    </div>
  );
}

function ProjectTab({ stats }: { stats: ReturnType<typeof buildSalesPerformanceStats> }) {
  return (
    <div className="performance-chart-grid">
      <ExportableChart title="项目合同总额 Top10" option={barOption(stats.byProject.slice(0, 10), 'orderAmount')} />
      <ExportableChart title="项目销售毛利 Top10" option={barOption(stats.byProject.slice(0, 10), 'salesGrossProfit')} />
      <SummaryTable title="项目统计" rows={stats.byProject} />
    </div>
  );
}

function KeyProjectTab({
  matches,
  summary,
  onExport,
}: {
  matches: ReturnType<typeof buildKeyProjectMatches>;
  summary: ReturnType<typeof summarizeKeyProjectMatches>;
  onExport: () => void;
}) {
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const visible = onlyUnmatched ? matches.filter((item) => item.status === '未匹配') : matches;
  if (matches.length === 0) {
    return <StatusCard title="暂无重点项目表" description="请通过独立入口导入重点项目表，再查看完成情况。" />;
  }
  return (
    <>
      <section className="kpi-grid performance-kpis">
        <SmallKpi label="重点项目数" value={summary.totalCount.toLocaleString('zh-CN')} />
        <SmallKpi label="已匹配项目数" value={summary.matchedCount.toLocaleString('zh-CN')} />
        <SmallKpi label="未匹配项目数" value={summary.unmatchedCount.toLocaleString('zh-CN')} />
        <SmallKpi label="已完成合同总额" value={formatWan(summary.orderAmount)} />
        <SmallKpi label="已完成销售毛利" value={formatWan(summary.salesGrossProfit)} />
        <SmallKpi label="目标金额完成率" value={formatRate(summary.targetAmountRate)} />
      </section>
      <div className="performance-toolbar">
        <label>
          <input type="checkbox" checked={onlyUnmatched} onChange={(event) => setOnlyUnmatched(event.target.checked)} />
          只看未匹配/未完成
        </label>
        <button className="button primary" onClick={onExport}>
          <Download size={16} />
          导出重点项目对比
        </button>
      </div>
      <div className="performance-table-wrap">
        <table>
          <thead>
            <tr>
              <th>重点项目</th>
              <th>客户</th>
              <th>状态</th>
              <th>业绩记录</th>
              <th>合同总额</th>
              <th>销售毛利</th>
              <th>合同数</th>
              <th>销售人员</th>
              <th>未匹配原因</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.project.id}>
                <td>{item.project.projectName}</td>
                <td>{item.project.customerName}</td>
                <td>{item.status}</td>
                <td>{item.matchedRecords.length}</td>
                <td>{formatWan(item.orderAmount)}</td>
                <td>{formatWan(item.salesGrossProfit)}</td>
                <td>{item.contractCount}</td>
                <td>{item.salespeople.join('、') || '-'}</td>
                <td>{item.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetailsTab({
  records,
  excludedRows,
}: {
  records: SalesPerformanceRecord[];
  excludedRows: SalesPerformanceRecord[];
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const visible = showExcluded ? excludedRows : records;
  return (
    <>
      <div className="performance-toolbar">
        <label>
          <input type="checkbox" checked={showExcluded} onChange={(event) => setShowExcluded(event.target.checked)} />
          查看排除明细
        </label>
        <span>{visible.length.toLocaleString('zh-CN')} 条</span>
      </div>
      <div className="performance-table-wrap">
        <table>
          <thead>
            <tr>
              <th>来源</th>
              <th>销售</th>
              <th>客户</th>
              <th>项目</th>
              <th>合同</th>
              <th>年月</th>
              <th>合同总额</th>
              <th>销售毛利</th>
              <th>产品</th>
              <th>行业</th>
              <th>排除原因</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, MAX_DETAIL_ROWS).map((row) => (
              <tr key={row.id}>
                <td>{row.sourceFileName}</td>
                <td>{row.salesperson}</td>
                <td>{row.customerName}</td>
                <td>{row.projectName}</td>
                <td>{row.contractNumber || '-'}</td>
                <td>
                  {row.confirmationYear ?? '-'}-{row.confirmationMonth ?? '-'}
                </td>
                <td>{formatWan(row.orderAmount)}</td>
                <td>{formatWan(row.salesGrossProfit)}</td>
                <td>{row.productName}</td>
                <td>{row.industry}</td>
                <td>{row.exclusionReason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > 300 && <p className="performance-note">当前仅展示前 300 条，请导出 Excel 查看完整明细。</p>}
    </>
  );
}

function KpiCards({ stats }: { stats: ReturnType<typeof buildSalesPerformanceStats> }) {
  return (
    <section className="kpi-grid performance-kpis">
      <SmallKpi label="合同总额" value={formatWan(stats.kpis.orderAmount)} />
      <SmallKpi label="销售毛利" value={formatWan(stats.kpis.salesGrossProfit)} />
      <SmallKpi label="销售毛利率" value={formatRate(stats.kpis.grossProfitRate)} />
      <SmallKpi label="合同数" value={stats.kpis.contractCount.toLocaleString('zh-CN')} />
      <SmallKpi label="客户数" value={stats.kpis.customerCount.toLocaleString('zh-CN')} />
      <SmallKpi label="产品明细数" value={stats.kpis.detailCount.toLocaleString('zh-CN')} />
    </section>
  );
}

function SmallKpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return (
    <DashboardCard title={title} className="wide-card">
      <div className="performance-table-wrap compact">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>合同总额</th>
              <th>销售毛利</th>
              <th>毛利率</th>
              <th>合同数</th>
              <th>客户数</th>
              <th>明细数</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_TABLE_ROWS).map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{formatWan(row.orderAmount)}</td>
                <td>{formatWan(row.salesGrossProfit)}</td>
                <td>{formatRate(row.grossProfitRate)}</td>
                <td>{row.contractCount}</td>
                <td>{row.customerCount}</td>
                <td>{row.detailCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

function ExportableChart({ title, option }: { title: string; option: object }) {
  const chartRef = useRef<EChartsInstance | null>(null);
  return (
    <DashboardCard
      title={title}
      action={
        <button
          className="button ghost small"
          onClick={() => {
            const url = chartRef.current?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
            if (!url) return;
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title}-${today()}.png`;
            link.click();
          }}
        >
          PNG
        </button>
      }
    >
      <EChartsReact option={option} style={{ height: 320 }} onChartReady={(instance) => (chartRef.current = instance)} notMerge />
    </DashboardCard>
  );
}

function barOption(rows: SummaryRow[], metric: 'orderAmount' | 'salesGrossProfit') {
  const data = rows.slice(0, MAX_BAR_RANK).reverse();
  return {
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => formatWan(value) },
    grid: { left: 128, right: 72, top: 24, bottom: 32 },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => toRoundedWan(value).toLocaleString('zh-CN') } },
    yAxis: { type: 'category', data: data.map((row) => row.name) },
    series: [
      {
        type: 'bar',
        data: data.map((row) => row[metric]),
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value: number }) => `${toRoundedWan(params.value).toLocaleString('zh-CN')} 万`,
        },
        itemStyle: { color: metric === 'orderAmount' ? '#2563eb' : '#16a34a', borderRadius: [0, 8, 8, 0] },
      },
    ],
  };
}

function trendOption(rows: SummaryRow[]) {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return {
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => formatWan(value) },
    legend: { top: 0 },
    grid: { left: 56, right: 24, top: 42, bottom: 36 },
    xAxis: { type: 'category', data: sorted.map((row) => row.name) },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => toRoundedWan(value).toLocaleString('zh-CN') } },
    series: [
      { name: '合同总额', type: 'line', smooth: true, data: sorted.map((row) => row.orderAmount) },
      { name: '销售毛利', type: 'line', smooth: true, data: sorted.map((row) => row.salesGrossProfit) },
    ],
  };
}

function pieOption(rows: SummaryRow[]) {
  return {
    tooltip: { trigger: 'item', valueFormatter: (value: number) => formatWan(value) },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data: rows.map((row) => ({ name: row.name, value: row.orderAmount })),
      },
    ],
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** 业绩统计视图的展示上限常量 */
const MAX_TABLE_ROWS = 50;
const MAX_DETAIL_ROWS = 300;
const MAX_BAR_RANK = 12;
