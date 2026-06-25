import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Download, RotateCcw, Search, Upload, X } from 'lucide-react';
import type { DashboardData, DrillField, DrillFilter, Filters, PPLRecord } from './domain';
import { aggregatePpl, calculateKpis, exportAggregationCsv, exportCsv, filterPpl, groupAmount, uniqueOptions } from './lib/analyzer';
import type { AggregatedPplRow } from './lib/analyzer';
import { analyzeKeyCustomers, exportKeyCustomerCsv } from './lib/customerAnalyzer';
import type { KeyCustomerAnalysis } from './lib/customerAnalyzer';
import { parseDashboardFile } from './lib/parser';
import { formatMoney, formatPercent } from './lib/formatters';

const emptyFilters: Filters = {
  owner: '',
  industryLevel1: '',
  product: '',
  expectedQuarter: '',
  status: '',
  forecastType: '',
};

const drillLabels: Record<DrillField, string> = {
  owner: '销售',
  industryLevel1: '行业',
  product: '产品',
  expectedQuarter: '季度',
  forecastType: 'Forecast',
  healthLevel: '健康度',
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [drillFilters, setDrillFilters] = useState<DrillFilter[]>([]);
  const [search, setSearch] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'ppl' | 'summary' | 'activity' | 'keyCustomers'>('ppl');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [keyCustomerInput, setKeyCustomerInput] = useState('');

  const rawPpl = data?.ppl ?? [];
  const filteredPpl = useMemo(() => filterPpl(rawPpl, filters, drillFilters, search, customerQuery), [rawPpl, filters, drillFilters, search, customerQuery]);
  const kpis = useMemo(() => calculateKpis(filteredPpl), [filteredPpl]);

  async function handleFile(file: File) {
    setIsDraggingFile(false);
    setLoading(true);
    setError('');
    try {
      const parsed = await parseDashboardFile(file);
      setData(parsed);
      setFilters(emptyFilters);
      setDrillFilters([]);
      setSearch('');
      setCustomerQuery('');
      setKeyCustomerInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败，请检查格式和表头。');
    } finally {
      setLoading(false);
    }
  }

  function toggleDrill(field: DrillField, value: string) {
    setDrillFilters((current) => {
      const exists = current.some((item) => item.field === field && item.value === value);
      return exists ? current.filter((item) => !(item.field === field && item.value === value)) : [...current, { field, value }];
    });
  }

  function resetAll() {
    setFilters(emptyFilters);
    setDrillFilters([]);
    setSearch('');
    setCustomerQuery('');
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingFile(true);
  }

  return (
    <main
      className={`app-shell ${isDraggingFile ? 'dragging-file' : ''}`}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDraggingFile(false);
      }}
      onDrop={handleDrop}
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">本地数据处理 · 静态部署</p>
          <h1>江苏省办销售 Pipeline 本地分析工作台</h1>
        </div>
        <div className="topbar-actions">
          <span className="file-name">{data?.report.fileName ?? '未导入文件'}</span>
          <label className="button primary">
            <Upload size={16} />
            上传 Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
          </label>
          <button className="button ghost" onClick={() => setData(null)} disabled={!data}>
            <RotateCcw size={16} />
            清空
          </button>
        </div>
      </header>

      {loading && <StatusCard title="正在解析 Excel..." description="正在识别 Sheet、清洗字段并生成分析结果。" />}
      {error && <StatusCard tone="danger" title="文件解析失败" description={error} />}
      {!data && !loading && !error && (
        <section className={`empty-state drop-zone ${isDraggingFile ? 'active' : ''}`}>
          <Upload size={34} />
          <h2>{isDraggingFile ? '松开即可导入 Excel 并统计' : '拖入 Excel 或点击上传'}</h2>
          <p>支持 .xlsx / .xls / .csv，数据仅在浏览器本地处理，不会上传服务器。</p>
        </section>
      )}

      {data && (
        <>
          <section className="report-panel">
            <div>
              <strong>导入结果</strong>
              <span>PPL 明细 {data.report.pplRows} 行，数据汇总 {data.report.summaryRows} 行，活动记录 {data.report.activityRows} 行，跳过 {data.report.skippedRows} 行</span>
            </div>
            <div>
              <strong>字段识别</strong>
              <span>{data.report.detectedFields.slice(0, 7).join(' / ') || '未识别到字段'}</span>
            </div>
            {(data.report.missingFields.length > 0 || data.report.warnings.length > 0) && (
              <div>
                <strong>提示</strong>
                <span>{[...data.report.missingFields.map((item) => `缺少 ${item}`), ...data.report.warnings].join('；')}</span>
              </div>
            )}
          </section>

          <nav className="tabs">
            {[
              ['ppl', 'PPL 明细'],
              ['summary', '数据汇总'],
              ['activity', '活动记录'],
              ['keyCustomers', '重点客户分析'],
            ].map(([key, label]) => (
              <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key as typeof activeTab)}>{label}</button>
            ))}
          </nav>

          {activeTab === 'ppl' && (
            <>
              <FilterBar
                data={rawPpl}
                filters={filters}
                setFilters={setFilters}
                search={search}
                setSearch={setSearch}
                customerQuery={customerQuery}
                setCustomerQuery={setCustomerQuery}
                resetAll={resetAll}
              />
              <DrillTags drillFilters={drillFilters} remove={(filter) => setDrillFilters((current) => current.filter((item) => item !== filter))} clear={() => setDrillFilters([])} />
              <KpiGrid kpis={kpis} />
              {filteredPpl.length === 0 ? (
                <StatusCard title="当前筛选条件下没有数据" description="请调整筛选条件或清空筛选。" />
              ) : (
                <>
                  <ChartGrid data={filteredPpl} toggleDrill={toggleDrill} />
                  <PplTable rows={filteredPpl} exportRows={() => exportCsv(filteredPpl)} />
                </>
              )}
            </>
          )}

          {activeTab === 'summary' && <SimpleRecords title="数据汇总" rows={data.summary} />}
          {activeTab === 'activity' && <SimpleRecords title="活动记录" rows={data.activity} />}
          {activeTab === 'keyCustomers' && (
            <KeyCustomerAnalysisView
              input={keyCustomerInput}
              setInput={setKeyCustomerInput}
              ppl={rawPpl}
              activity={data.activity}
            />
          )}
        </>
      )}
    </main>
  );
}

function FilterBar({ data, filters, setFilters, search, setSearch, customerQuery, setCustomerQuery, resetAll }: {
  data: PPLRecord[];
  filters: Filters;
  setFilters: (filters: Filters) => void;
  search: string;
  setSearch: (search: string) => void;
  customerQuery: string;
  setCustomerQuery: (customerQuery: string) => void;
  resetAll: () => void;
}) {
  const config: Array<[keyof Filters, keyof PPLRecord, string]> = [
    ['owner', 'owner', '销售'],
    ['industryLevel1', 'industryLevel1', '一级行业'],
    ['product', 'product', '产品'],
    ['expectedQuarter', 'expectedQuarter', '季度'],
    ['status', 'status', '状态'],
    ['forecastType', 'forecastType', 'Forecast'],
  ];
  return (
    <section className="filters">
      {config.map(([filterKey, field, label]) => (
        <label key={filterKey}>
          <span>{label}</span>
          <select value={filters[filterKey]} onChange={(event) => setFilters({ ...filters, [filterKey]: event.target.value })}>
            <option value="">全部</option>
            {uniqueOptions(data, field).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
      <label className="search-box">
        <span>搜索</span>
        <Search size={15} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="客户、销售、产品、商机" />
      </label>
      <label className="customer-box">
        <span>指定客户</span>
        <textarea
          value={customerQuery}
          onChange={(event) => setCustomerQuery(event.target.value)}
          placeholder="一行一个客户，或用逗号分隔"
          rows={3}
        />
      </label>
      <button className="button ghost" onClick={resetAll}>
        <X size={16} />
        清空筛选
      </button>
    </section>
  );
}

function DrillTags({ drillFilters, remove, clear }: { drillFilters: DrillFilter[]; remove: (filter: DrillFilter) => void; clear: () => void }) {
  if (drillFilters.length === 0) return null;
  return (
    <section className="tag-row">
      <span>已下钻</span>
      {drillFilters.map((filter) => (
        <button key={`${filter.field}-${filter.value}`} onClick={() => remove(filter)}>
          {drillLabels[filter.field]}={filter.value}
          <X size={13} />
        </button>
      ))}
      <button onClick={clear}>清空下钻</button>
    </section>
  );
}

function KpiGrid({ kpis }: { kpis: ReturnType<typeof calculateKpis> }) {
  const items = [
    ['商机总数', kpis.opportunityCount.toLocaleString('zh-CN')],
    ['商机总金额', formatMoney(kpis.totalAmount)],
    ['客户数', kpis.customerCount.toLocaleString('zh-CN')],
    ['加权赢单率', formatPercent(kpis.weightedWinRate)],
    ['Forecast 金额', formatMoney(kpis.forecastAmount)],
    ['风险商机数', kpis.riskCount.toLocaleString('zh-CN')],
  ];
  return (
    <section className="kpi-grid">
      {items.map(([label, value]) => (
        <article className="kpi-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function ChartGrid({ data, toggleDrill }: { data: PPLRecord[]; toggleDrill: (field: DrillField, value: string) => void }) {
  const owner = groupAmount(data, 'owner', 10);
  const industry = groupAmount(data, 'industryLevel1', 10);
  const product = groupAmount(data, 'product', 15);
  const quarter = groupAmount(data, 'expectedQuarter', 8).reverse();
  const forecast = groupAmount(data, 'forecastType', 8);
  const health = healthSummary(data);

  return (
    <section className="chart-grid">
      <ChartCard title="销售金额 TOP 10" option={barOption(owner, 'owner')} onClick={(name) => toggleDrill('owner', name)} />
      <ChartCard title="一级行业金额分布" option={donutOption(industry)} onClick={(name) => toggleDrill('industryLevel1', name)} />
      <ChartCard title="产品金额 TOP 15" option={barOption(product, 'product', true)} onClick={(name) => toggleDrill('product', name)} />
      <ChartCard title="季度落单金额分布" option={quarterOption(quarter)} onClick={(name) => toggleDrill('expectedQuarter', name)} />
      <HealthCard items={health} onClick={(name) => toggleDrill('healthLevel', name)} />
      <ChartCard title="Forecast 金额占比" option={donutOption(forecast)} onClick={(name) => toggleDrill('forecastType', name)} />
    </section>
  );
}

function ChartCard({ title, option, onClick }: { title: string; option: object; onClick: (name: string) => void }) {
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <ReactECharts
        option={option}
        style={{ height: 300 }}
        onEvents={{ click: (params: { name?: unknown; value?: unknown[] }) => onClick(String(params.name ?? params.value?.[3] ?? '')) }}
        notMerge
      />
    </article>
  );
}

function baseChart() {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif' },
    tooltip: { trigger: 'item', backgroundColor: '#0f172a', borderColor: 'rgba(148,163,184,.22)', textStyle: { color: '#e5edf7' } },
    grid: { left: 54, right: 24, top: 24, bottom: 38 },
  };
}

function barOption(items: Array<{ name: string; value: number }>, _field: string, horizontal = false) {
  const names = items.map((item) => item.name);
  const values = items.map((item) => item.value);
  return {
    ...baseChart(),
    xAxis: horizontal ? { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } } : { type: 'category', data: names, axisLabel: { color: '#94a3b8', interval: 0, rotate: 35 } },
    yAxis: horizontal ? { type: 'category', data: names.reverse(), axisLabel: { color: '#94a3b8', width: 92, overflow: 'truncate' } } : { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    series: [{ type: 'bar', data: horizontal ? values.reverse() : values, name: '金额(万元)', barMaxWidth: 22, itemStyle: { color: '#06b6d4', borderRadius: 4 } }],
  };
}

function donutOption(items: Array<{ name: string; value: number }>) {
  return {
    ...baseChart(),
    legend: { orient: 'vertical', right: 4, top: 'middle', textStyle: { color: '#94a3b8' } },
    series: [{ type: 'pie', radius: ['48%', '70%'], center: ['36%', '52%'], data: items, itemStyle: { borderColor: '#121a2c', borderWidth: 2 } }],
  };
}

function quarterOption(items: Array<{ name: string; value: number; count: number }>) {
  return {
    ...baseChart(),
    xAxis: { type: 'category', data: items.map((item) => item.name), axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,.1)' } } },
    series: [
      { type: 'bar', name: '金额(万元)', data: items.map((item) => item.value), itemStyle: { color: '#22c55e', borderRadius: 4 } },
      { type: 'line', name: '商机数', data: items.map((item) => item.count), yAxisIndex: 0, smooth: true, symbolSize: 8, itemStyle: { color: '#f59e0b' } },
    ],
  };
}

function healthSummary(data: PPLRecord[]) {
  const order = ['健康', '关注', '风险'];
  const grouped = groupAmount(data, 'healthLevel', 3);
  return order.map((name) => grouped.find((item) => item.name === name) ?? { name, value: 0, count: 0 });
}

function HealthCard({ items, onClick }: { items: Array<{ name: string; value: number; count: number }>; onClick: (name: string) => void }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <article className="chart-card health-card">
      <h3>健康度金额与商机数分布</h3>
      <div className="health-bars">
        {items.map((item) => (
          <button className="health-bar-row" key={item.name} onClick={() => onClick(item.name)}>
            <span className={`health-dot ${item.name}`} />
            <span className="health-name">{item.name}</span>
            <span className="health-track">
              <span className={`health-fill ${item.name}`} style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
            </span>
            <strong>{item.value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万</strong>
            <em>{item.count} 个</em>
          </button>
        ))}
      </div>
    </article>
  );
}

function KeyCustomerAnalysisView({ input, setInput, ppl, activity }: {
  input: string;
  setInput: (input: string) => void;
  ppl: PPLRecord[];
  activity: DashboardData['activity'];
}) {
  const analysis = useMemo(() => analyzeKeyCustomers(input, ppl, activity), [input, ppl, activity]);
  const hasInput = analysis.inputNames.length > 0;

  return (
    <>
      <section className="key-customer-panel">
        <div className="key-customer-input">
          <label>
            <span>重点客户名单</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="每行一个客户名称"
              rows={6}
            />
          </label>
          <div className="key-customer-actions">
            <button className="button primary" onClick={() => setInput(input.trim())}>分析</button>
            <button className="button ghost" onClick={() => setInput('')}>清空</button>
            <button className="button primary" onClick={() => exportKeyCustomerCsv(analysis.matchedPplRows)} disabled={analysis.matchedPplRows.length === 0}>
              <Download size={16} />
              导出当前明细 CSV
            </button>
          </div>
        </div>
        <p className="key-customer-note">匹配顺序：标准化精确匹配 → 客户别名匹配 → 包含式模糊匹配。当前活动记录无客户维度，活动记录数暂不按客户统计。</p>
      </section>

      {!hasInput ? (
        <StatusCard title="请输入重点客户名单" description="每行一个客户名称，系统会匹配 PPL 明细并生成客户商机分析。" />
      ) : (
        <>
          <KeyCustomerKpis analysis={analysis} />
          {analysis.unmatchedInputs.length > 0 && (
            <section className="unmatched-panel">
              <strong>未匹配客户</strong>
              <span>{analysis.unmatchedInputs.join('、')}</span>
            </section>
          )}
          <MatchResultTable analysis={analysis} />
          {analysis.matchedPplRows.length > 0 ? (
            <>
              <KeyCustomerCharts analysis={analysis} />
              <KeyCustomerDetailTable rows={analysis.matchedPplRows} />
            </>
          ) : (
            <StatusCard title="没有匹配到商机" description="请检查客户名称，或补充客户别名后再分析。" />
          )}
        </>
      )}
    </>
  );
}

function KeyCustomerKpis({ analysis }: { analysis: KeyCustomerAnalysis }) {
  const kpis = analysis.kpis;
  const items = [
    ['输入客户数', kpis.inputCustomerCount.toLocaleString('zh-CN')],
    ['已匹配客户数', kpis.matchedCustomerCount.toLocaleString('zh-CN')],
    ['商机数', kpis.opportunityCount.toLocaleString('zh-CN')],
    ['商机总金额', formatMoney(kpis.totalAmount)],
    ['加权赢单率', formatPercent(kpis.weightedWinRate)],
    ['Forecast 金额', formatMoney(kpis.forecastAmount)],
    ['风险商机数', kpis.riskCount.toLocaleString('zh-CN')],
    ['活动记录数', kpis.activityCount === null ? '暂无客户维度' : kpis.activityCount.toLocaleString('zh-CN')],
  ];
  return (
    <section className="kpi-grid key-customer-kpis">
      {items.map(([label, value]) => (
        <article className="kpi-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function MatchResultTable({ analysis }: { analysis: KeyCustomerAnalysis }) {
  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>客户匹配结果</h2>
        <span>{analysis.matchResults.length} 个输入客户</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>输入客户</th>
              <th>匹配到的客户</th>
              <th>匹配方式</th>
              <th>匹配置信度</th>
              <th>是否匹配成功</th>
            </tr>
          </thead>
          <tbody>
            {analysis.matchResults.map((result) => (
              <tr key={result.inputName}>
                <td>{result.inputName}</td>
                <td>{result.matchedCustomerName || '-'}</td>
                <td>{result.matchType}</td>
                <td>{formatPercent(result.confidence)}</td>
                <td><span className={`match-status ${result.matched ? 'success' : 'failed'}`}>{result.matched ? '成功' : '未匹配'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KeyCustomerCharts({ analysis }: { analysis: KeyCustomerAnalysis }) {
  const chartData = analysis.chartData;
  return (
    <section className="chart-grid">
      <ChartCard title="客户商机金额排行" option={barOption(chartData.customerAmountRank, 'customerName', true)} onClick={() => undefined} />
      <ChartCard title="客户商机数量排行" option={countBarOption(chartData.customerCountRank, true)} onClick={() => undefined} />
      <ChartCard title="产品金额分布" option={donutOption(chartData.productAmount)} onClick={() => undefined} />
      <ChartCard title="销售负责人分布" option={donutOption(chartData.ownerAmount)} onClick={() => undefined} />
      <ChartCard title="商机阶段分布" option={barOption(chartData.stageAmount, 'stage', true)} onClick={() => undefined} />
    </section>
  );
}

function countBarOption(items: Array<{ name: string; value: number }>, horizontal = false) {
  const option = barOption(items, 'count', horizontal) as { series: Array<Record<string, unknown>> };
  option.series[0] = {
    ...option.series[0],
    name: '商机数',
    itemStyle: { color: '#38bdf8', borderRadius: 4 },
  };
  return option;
}

function KeyCustomerDetailTable({ rows }: { rows: PPLRecord[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<PPLRecord>[]>(() => [
    { accessorKey: 'owner', header: '销售' },
    { accessorKey: 'customerName', header: '客户名称' },
    { accessorKey: 'opportunityName', header: '商机名称' },
    { accessorKey: 'industryLevel1', header: '一级行业' },
    { accessorKey: 'product', header: '产品' },
    { accessorKey: 'amount', header: '金额(万元)', cell: (info) => formatMoney(Number(info.getValue())) },
    { accessorKey: 'stage', header: '销售阶段' },
    { accessorKey: 'winRate', header: '赢单率', cell: (info) => formatPercent(Number(info.getValue())) },
    { accessorKey: 'forecastType', header: 'Forecast' },
    { accessorKey: 'expectedQuarter', header: '季度' },
    { accessorKey: 'healthLevel', header: '健康度', cell: (info) => <span className={`health ${info.getValue()}`}>{String(info.getValue())}</span> },
    { accessorKey: 'status', header: '状态' },
  ], []);
  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });

  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>重点客户商机明细</h2>
        <span>{rows.length} 条明细</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一页</button>
        <span>第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一页</button>
      </div>
    </section>
  );
}

function PplTable({ rows, exportRows }: { rows: PPLRecord[]; exportRows: () => void }) {
  const [mode, setMode] = useState<'aggregate' | 'detail'>('aggregate');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [aggregateSorting, setAggregateSorting] = useState<SortingState>([{ id: 'totalAmount', desc: true }]);
  const [selected, setSelected] = useState<PPLRecord | null>(null);
  const aggregatedRows = useMemo(() => aggregatePpl(rows), [rows]);
  const aggregateColumns = useMemo<ColumnDef<AggregatedPplRow>[]>(() => [
    { accessorKey: 'customerName', header: '客户名称' },
    { accessorKey: 'industryLevel1', header: '一级行业' },
    { accessorKey: 'product', header: '产品' },
    { accessorKey: 'stage', header: '销售阶段' },
    { accessorKey: 'owners', header: '销售' },
    { accessorKey: 'opportunityCount', header: '商机数' },
    { accessorKey: 'totalAmount', header: '金额合计(万元)', cell: (info) => formatMoney(Number(info.getValue())) },
    { accessorKey: 'weightedWinRate', header: '加权赢单率', cell: (info) => formatPercent(Number(info.getValue())) },
    { accessorKey: 'forecastAmount', header: 'Forecast金额(万元)', cell: (info) => formatMoney(Number(info.getValue())) },
    { accessorKey: 'riskCount', header: '风险数' },
  ], []);
  const columns = useMemo<ColumnDef<PPLRecord>[]>(() => [
    { accessorKey: 'owner', header: '销售' },
    { accessorKey: 'customerName', header: '客户名称' },
    { accessorKey: 'opportunityName', header: '商机名称' },
    { accessorKey: 'industryLevel1', header: '一级行业' },
    { accessorKey: 'product', header: '产品' },
    { accessorKey: 'amount', header: '金额(万元)', cell: (info) => formatMoney(Number(info.getValue())) },
    { accessorKey: 'stage', header: '销售阶段' },
    { accessorKey: 'winRate', header: '赢单率', cell: (info) => formatPercent(Number(info.getValue())) },
    { accessorKey: 'forecastType', header: 'Forecast' },
    { accessorKey: 'expectedQuarter', header: '季度' },
    { accessorKey: 'healthLevel', header: '健康度', cell: (info) => <span className={`health ${info.getValue()}`}>{String(info.getValue())}</span> },
    { accessorKey: 'status', header: '状态' },
  ], []);
  const aggregateTable = useReactTable({
    data: aggregatedRows,
    columns: aggregateColumns,
    state: { sorting: aggregateSorting },
    onSortingChange: setAggregateSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });
  const activeTable = mode === 'aggregate' ? aggregateTable : table;

  return (
    <section className="table-panel">
      <div className="section-title">
        <div className="table-heading">
          <h2>{mode === 'aggregate' ? 'PPL 聚合统计' : 'PPL 明细表'}</h2>
          <span>{mode === 'aggregate' ? `${aggregatedRows.length} 组 / ${rows.length} 条明细` : `${rows.length} 条明细`}</span>
        </div>
        <div className="table-actions">
          <div className="segment">
            <button className={mode === 'aggregate' ? 'active' : ''} onClick={() => setMode('aggregate')}>聚合统计</button>
            <button className={mode === 'detail' ? 'active' : ''} onClick={() => setMode('detail')}>明细数据</button>
          </div>
          <button className="button primary" onClick={() => mode === 'aggregate' ? exportAggregationCsv(aggregatedRows) : exportRows()}>
            <Download size={16} />
            导出当前结果
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            {mode === 'aggregate'
              ? aggregateTable.getHeaderGroups().map((group) => (
                <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
              ))
              : table.getHeaderGroups().map((group) => (
                <tr key={group.id}>{group.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
              ))}
          </thead>
          <tbody>
            {mode === 'aggregate'
              ? aggregateTable.getRowModel().rows.map((row) => (
                <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
              ))
              : table.getRowModel().rows.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row.original)}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button onClick={() => activeTable.previousPage()} disabled={!activeTable.getCanPreviousPage()}>上一页</button>
        <span>第 {activeTable.getState().pagination.pageIndex + 1} / {activeTable.getPageCount()} 页</span>
        <button onClick={() => activeTable.nextPage()} disabled={!activeTable.getCanNextPage()}>下一页</button>
      </div>
      {selected && <DetailDrawer row={selected} close={() => setSelected(null)} />}
    </section>
  );
}

function DetailDrawer({ row, close }: { row: PPLRecord; close: () => void }) {
  return (
    <aside className="drawer">
      <button className="drawer-close" onClick={close}><X size={18} /></button>
      <h2>{row.customerName}</h2>
      <p>{row.opportunityName}</p>
      <dl>
        <dt>销售 / 产品</dt><dd>{row.owner} / {row.product}</dd>
        <dt>金额 / 赢单率</dt><dd>{formatMoney(row.amount)} / {formatPercent(row.winRate)}</dd>
        <dt>阶段 / 状态</dt><dd>{row.stage} / {row.status}</dd>
        <dt>健康度解释</dt><dd>{row.healthLevel}：{row.healthReasons.join('；')}</dd>
      </dl>
      <h3>原始 Excel 字段</h3>
      <pre>{JSON.stringify(row.raw, null, 2)}</pre>
    </aside>
  );
}

function SimpleRecords({ title, rows }: { title: string; rows: Array<{ raw: Record<string, unknown> }> }) {
  return (
    <section className="table-panel">
      <div className="section-title"><h2>{title}</h2><span>{rows.length} 行</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr>{Object.keys(rows[0]?.raw ?? {}).slice(0, 10).map((key) => <th key={key}>{key}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 80).map((row, index) => <tr key={index}>{Object.values(row.raw).slice(0, 10).map((value, idx) => <td key={idx}>{String(value ?? '')}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function StatusCard({ title, description, tone = 'default' }: { title: string; description: string; tone?: 'default' | 'danger' }) {
  return (
    <section className={`status-card ${tone}`}>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
