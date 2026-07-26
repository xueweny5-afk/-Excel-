import { ArrowUpDown, ChevronDown, ChevronUp, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EChartsReact } from '../../lib/EChartsReact';
import { formatMoney, formatPercent } from '../../lib/formatters';
import { normalizeBusinessKey } from '../../lib/normalize';
import type { PresalesAnalysis } from '../../lib/presalesMetrics';
import {
  buildOpportunityProjectStats,
  buildT2000CustomerStats,
  buildT2000PipelineMix,
  exportOpportunityProjectStatsCsv,
  exportT2000StatsCsv,
  filterT2000ByType,
  filterT2000Stats,
  summarizeT2000Stats,
  type OpportunityProjectStats,
  type T2000CustomerStats,
  type T2000ProjectScope,
} from '../../lib/t2000CustomerStats';
import { DashboardCard } from '../common/DashboardCard';
import { StatusCard } from '../common/StatusCard';
import { SummaryKpi, downloadBlob, todayStamp } from './_shared';

interface T2000CustomerStatsProps {
  analysis: PresalesAnalysis;
}

const TYPE_OPTIONS = ['全部', 'NA-I', 'NA-II', 'NA代管'] as const;
const SCOPE_OPTIONS: T2000ProjectScope[] = ['全部', 'T2000', '非T2000'];
const INPUT_HINT = '输入 T2000 客户名称（支持多值，用逗号/空格/换行分隔）；留空展示全部';
const PROJECT_INPUT_HINT = '输入商机项目名称（支持多值，用逗号/空格/换行分隔）；留空展示全部';

type SortDirection = 'asc' | 'desc';
type ProjectSortKey =
  | 'projectName'
  | 't2000Status'
  | 'opportunityCount'
  | 'pipelineAmount'
  | 't2000PipelineAmount'
  | 'nonT2000PipelineAmount'
  | 'customerNames'
  | 'productLevel2'
  | 'productLevel3'
  | 'owners'
  | 'stages';
type CustomerSortKey =
  | 'customer'
  | 'customerType'
  | 'quadrant'
  | 'customerOwner'
  | 'presales'
  | 'opportunityCount'
  | 'pipelineAmount'
  | 'forecastAmount'
  | 'performanceCount'
  | 'orderAmount'
  | 'grossProfit';

export function T2000CustomerStatsView({ analysis }: T2000CustomerStatsProps) {
  const [input, setInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>('全部');
  const [salesFilter, setSalesFilter] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    input: '',
    type: '全部' as (typeof TYPE_OPTIONS)[number],
    sales: '',
    projectInput: '',
    projectScope: '全部' as T2000ProjectScope,
  });
  const [projectInput, setProjectInput] = useState('');
  const [projectScope, setProjectScope] = useState<T2000ProjectScope>('全部');
  const [compareProjectKeys, setCompareProjectKeys] = useState<string[]>([]);
  const [projectSort, setProjectSort] = useState<{
    key: ProjectSortKey;
    direction: SortDirection;
  }>({ key: 'pipelineAmount', direction: 'desc' });
  const [customerSort, setCustomerSort] = useState<{
    key: CustomerSortKey;
    direction: SortDirection;
  }>({ key: 'pipelineAmount', direction: 'desc' });

  const salesOptions = useMemo(
    () =>
      [...new Set(analysis.rawData.ppl.flatMap((row) => splitOwnerNames(row.owner)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [analysis.rawData.ppl],
  );
  const salesScopedData = useMemo(() => {
    if (!appliedFilters.sales) return analysis.rawData;
    return {
      ...analysis.rawData,
      ppl: analysis.rawData.ppl.filter((row) =>
        splitOwnerNames(row.owner).some(
          (owner) => normalizeBusinessKey(owner) === normalizeBusinessKey(appliedFilters.sales),
        ),
      ),
    };
  }, [analysis.rawData, appliedFilters.sales]);
  const salesCustomerStats = useMemo(() => {
    if (!appliedFilters.sales) return analysis.t2000Stats;
    const customerKeys = salesScopedData.ppl
      .map((row) => normalizeBusinessKey(row.customerName))
      .filter(Boolean);
    return buildT2000CustomerStats(salesScopedData).filter((item) =>
      customerKeys.some(
        (key) => item.normalizedCustomer.includes(key) || key.includes(item.normalizedCustomer),
      ),
    );
  }, [analysis.t2000Stats, appliedFilters.sales, salesScopedData]);
  const typeFiltered: T2000CustomerStats[] = useMemo(() => {
    return filterT2000ByType(salesCustomerStats, appliedFilters.type);
  }, [appliedFilters.type, salesCustomerStats]);

  const filtered: T2000CustomerStats[] = useMemo(() => {
    return filterT2000Stats(typeFiltered, appliedFilters.input);
  }, [appliedFilters.input, typeFiltered]);
  const sortedCustomers = useMemo(
    () => sortCustomerStats(filtered, customerSort.key, customerSort.direction),
    [customerSort, filtered],
  );

  const summary = useMemo(() => summarizeT2000Stats(filtered), [filtered]);
  const pipelineMix = useMemo(
    () => buildT2000PipelineMix(salesScopedData, appliedFilters.projectInput, appliedFilters.projectScope),
    [appliedFilters.projectInput, appliedFilters.projectScope, salesScopedData],
  );
  const projectStats = useMemo(
    () =>
      buildOpportunityProjectStats(salesScopedData, appliedFilters.projectInput, appliedFilters.projectScope),
    [appliedFilters.projectInput, appliedFilters.projectScope, salesScopedData],
  );
  const sortedProjectStats = useMemo(
    () => sortProjectStats(projectStats, projectSort.key, projectSort.direction),
    [projectSort, projectStats],
  );
  const compareProjects = useMemo(
    () => sortedProjectStats.filter((item) => compareProjectKeys.includes(item.normalizedProjectName)),
    [compareProjectKeys, sortedProjectStats],
  );
  const totalT2000 = analysis.t2000Stats.length;
  const hasData = totalT2000 > 0;
  const hasProjectData = analysis.rawData.ppl.length > 0;
  const sourceSheet = analysis.t2000Stats[0]?.sourceSheet ?? '';

  function handleExport() {
    if (filtered.length === 0) return;
    const csv = exportT2000StatsCsv(filtered);
    downloadBlob(csv, `t2000-customer-stats-${todayStamp()}.csv`);
  }

  function handleProjectExport() {
    if (projectStats.length === 0) return;
    const csv = exportOpportunityProjectStatsCsv(projectStats);
    downloadBlob(csv, `presales-opportunity-project-stats-${todayStamp()}.csv`);
  }

  function toggleCompareProject(project: OpportunityProjectStats) {
    setCompareProjectKeys((current) =>
      current.includes(project.normalizedProjectName)
        ? current.filter((key) => key !== project.normalizedProjectName)
        : [...current, project.normalizedProjectName].slice(-5),
    );
  }

  function handleQuery() {
    setAppliedFilters({
      input: input.trim(),
      type: typeFilter,
      sales: salesFilter,
      projectInput: projectInput.trim(),
      projectScope,
    });
    setCompareProjectKeys([]);
  }

  function clearCustomerFilters() {
    setInput('');
    setTypeFilter('全部');
    setSalesFilter('');
    setProjectInput('');
    setProjectScope('全部');
    setAppliedFilters({
      input: '',
      type: '全部',
      sales: '',
      projectInput: '',
      projectScope: '全部',
    });
    setCompareProjectKeys([]);
  }

  function changeProjectSort(key: ProjectSortKey) {
    setProjectSort((current) => ({
      key,
      direction:
        current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : defaultSortDirection(key),
    }));
  }

  function changeCustomerSort(key: CustomerSortKey) {
    setCustomerSort((current) => ({
      key,
      direction:
        current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : defaultSortDirection(key),
    }));
  }

  return (
    <>
      <section className="presales-owner-panel">
        <div className="presales-owner-input">
          <label>
            <span>T2000 客户名称</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={INPUT_HINT}
              rows={2}
            />
          </label>
          <label>
            <span>商机项目名称</span>
            <textarea
              value={projectInput}
              onChange={(event) => setProjectInput(event.target.value)}
              placeholder={PROJECT_INPUT_HINT}
              rows={2}
            />
          </label>
          <div className="presales-owner-actions">
            <label className="t2000-type-filter">
              <span>客户类型</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as (typeof TYPE_OPTIONS)[number])}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="t2000-type-filter">
              <span>T2000 范围</span>
              <select
                value={projectScope}
                onChange={(event) => setProjectScope(event.target.value as T2000ProjectScope)}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="t2000-type-filter">
              <span>销售人员</span>
              <select value={salesFilter} onChange={(event) => setSalesFilter(event.target.value)}>
                <option value="">全部销售</option>
                {salesOptions.map((sales) => (
                  <option key={sales} value={sales}>
                    {sales}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" onClick={handleQuery}>
              <Search size={16} />
              查询
            </button>
            <button
              className="button ghost"
              onClick={clearCustomerFilters}
              disabled={
                !input &&
                typeFilter === '全部' &&
                !salesFilter &&
                !appliedFilters.input &&
                appliedFilters.type === '全部' &&
                !appliedFilters.sales &&
                !projectInput &&
                projectScope === '全部' &&
                !appliedFilters.projectInput &&
                appliedFilters.projectScope === '全部'
              }
            >
              清空筛选
            </button>
            <button
              className="button ghost"
              onClick={handleExport}
              disabled={filtered.length === 0}
              title={filtered.length === 0 ? '无可导出数据' : '导出当前筛选结果为 CSV'}
            >
              <Download size={16} />
              导出 CSV
            </button>
            <button
              className="button ghost"
              onClick={handleProjectExport}
              disabled={projectStats.length === 0}
              title={projectStats.length === 0 ? '无可导出数据' : '导出当前项目统计为 CSV'}
            >
              <Download size={16} />
              导出项目 CSV
            </button>
          </div>
        </div>
        <p className="presales-owner-hint">
          数据口径：客户列表来自 NA Sheet（{sourceSheet || '未识别'}），以"T2000
          客户标签"为权威源；商机数/Pipeline/Forecast 来自 PPL
          明细（按客户名模糊匹配），下单/毛利来自业绩明细。
          <strong>即使 T2000 客户在 PPL/业绩中无任何记录也会展示</strong>，便于盘点覆盖漏斗。
          {appliedFilters.sales && (
            <span>
              {' '}
              当前销售：{appliedFilters.sales}；销售筛选基于“Pipeline 所有人”，业绩仍按客户归属统计。
            </span>
          )}
        </p>
        <p className="presales-owner-hint">
          项目分析口径：按 PPL 明细中的“商机项目名称”聚合；Pipeline 金额取商机金额；客户唯一命中 NA/T2000
          客户名单则归为 T2000，未命中则归为非 T2000。所有条件点击“查询”后统一生效。
        </p>
      </section>

      {!hasData && !hasProjectData ? (
        <StatusCard
          title="暂无 T2000 客户数据"
          description="当前数据中未识别到 NA Sheet 或 T2000 客户标签，请确认 Excel 是否包含「NA客户」Sheet。"
        />
      ) : (
        <>
          <section className="kpi-grid presales-owner-kpis">
            <SummaryKpi label="T2000 Pipeline 占比" value={formatPercent(pipelineMix.t2000Rate)} />
            <SummaryKpi label="T2000 Pipeline" value={formatMoney(pipelineMix.t2000PipelineAmount)} />
            <SummaryKpi label="非 T2000 Pipeline" value={formatMoney(pipelineMix.nonT2000PipelineAmount)} />
            <SummaryKpi label="筛选后 Pipeline" value={formatMoney(pipelineMix.totalPipelineAmount)} />
          </section>

          <section className="chart-grid t2000-chart-grid">
            <DashboardCard title="Pipeline 金额占比" subtitle="T2000 / 非 T2000，随销售和项目筛选更新">
              <EChartsReact
                option={pipelinePieOption(
                  pipelineMix.t2000PipelineAmount,
                  pipelineMix.nonT2000PipelineAmount,
                  '金额',
                )}
                style={{ height: 290 }}
                notMerge
              />
            </DashboardCard>
            <DashboardCard title="商机数量占比" subtitle="按筛选后 PPL 商机条目计算">
              <EChartsReact
                option={pipelinePieOption(
                  pipelineMix.t2000OpportunityCount,
                  pipelineMix.nonT2000OpportunityCount,
                  '商机',
                )}
                style={{ height: 290 }}
                notMerge
              />
            </DashboardCard>
          </section>

          <section className="table-panel">
            <div className="section-title">
              <div className="table-heading">
                <h2>商机项目统计</h2>
                <span>
                  按商机项目名称聚合，默认按 Pipeline 金额降序；勾选项目可在下方做横向对比，最多 5 个
                </span>
              </div>
            </div>
            <div className="table-wrap t2000-project-table-wrap">
              <table className="presales-table t2000-project-table">
                <thead>
                  <tr>
                    <th>对比</th>
                    <SortableHeader
                      label="商机项目"
                      sortKey="projectName"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="T2000"
                      sortKey="t2000Status"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="二级产品"
                      sortKey="productLevel2"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="三级产品"
                      sortKey="productLevel3"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="商机数"
                      sortKey="opportunityCount"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="Pipeline"
                      sortKey="pipelineAmount"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="T2000 Pipeline"
                      sortKey="t2000PipelineAmount"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="非 T2000 Pipeline"
                      sortKey="nonT2000PipelineAmount"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="客户"
                      sortKey="customerNames"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="Pipeline 所有人"
                      sortKey="owners"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                    <SortableHeader
                      label="阶段"
                      sortKey="stages"
                      activeKey={projectSort.key}
                      direction={projectSort.direction}
                      onSort={changeProjectSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedProjectStats.slice(0, 80).map((item) => (
                    <tr key={item.normalizedProjectName}>
                      <td>
                        <input
                          type="checkbox"
                          checked={compareProjectKeys.includes(item.normalizedProjectName)}
                          onChange={() => toggleCompareProject(item)}
                          aria-label={`对比 ${item.projectName}`}
                        />
                      </td>
                      <td>
                        <strong>{item.projectName}</strong>
                      </td>
                      <td>
                        <T2000ProjectBadge status={item.t2000Status} />
                      </td>
                      <td>{compactList(item.productLevel2)}</td>
                      <td>{compactList(item.productLevel3)}</td>
                      <td>{item.opportunityCount.toLocaleString('zh-CN')} 个</td>
                      <td>{formatMoney(item.pipelineAmount)}</td>
                      <td>{formatMoney(item.t2000PipelineAmount)}</td>
                      <td>{formatMoney(item.nonT2000PipelineAmount)}</td>
                      <td>{compactList(item.customerNames)}</td>
                      <td>{compactList(item.owners)}</td>
                      <td>{compactList(item.stages)}</td>
                    </tr>
                  ))}
                  {projectStats.length === 0 && (
                    <tr>
                      <td colSpan={12}>当前筛选下没有商机项目。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {compareProjects.length > 0 && (
            <section className="table-panel">
              <div className="section-title">
                <div className="table-heading">
                  <h2>商机项目对比</h2>
                  <span>基于上方勾选项目横向对比</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="presales-table">
                  <thead>
                    <tr>
                      <th>商机项目</th>
                      <th>T2000</th>
                      <th>二级产品</th>
                      <th>三级产品</th>
                      <th>Pipeline</th>
                      <th>商机数</th>
                      <th>客户</th>
                      <th>Pipeline 所有人</th>
                      <th>阶段</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareProjects.map((item) => (
                      <tr key={`compare-${item.normalizedProjectName}`}>
                        <td>
                          <strong>{item.projectName}</strong>
                        </td>
                        <td>
                          <T2000ProjectBadge status={item.t2000Status} />
                        </td>
                        <td>{compactList(item.productLevel2)}</td>
                        <td>{compactList(item.productLevel3)}</td>
                        <td>{formatMoney(item.pipelineAmount)}</td>
                        <td>{item.opportunityCount.toLocaleString('zh-CN')} 个</td>
                        <td>{compactList(item.customerNames)}</td>
                        <td>{compactList(item.owners)}</td>
                        <td>{compactList(item.stages)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {hasData ? (
            <section className="kpi-grid presales-owner-kpis">
              <SummaryKpi label="T2000 客户" value={`${summary.customerCount} / ${totalT2000} 家`} />
              <SummaryKpi label="商机数" value={summary.opportunityCount.toLocaleString('zh-CN')} unit="个" />
              <SummaryKpi label="Pipeline 金额" value={formatMoney(summary.pipelineAmount)} />
              <SummaryKpi label="Forecast 金额" value={formatMoney(summary.forecastAmount)} />
              <SummaryKpi label="已下单金额" value={formatMoney(summary.orderAmount)} />
              <SummaryKpi label="销售毛利" value={formatMoney(summary.grossProfit)} />
            </section>
          ) : (
            <StatusCard
              title="暂无 T2000 客户名单"
              description="当前未识别到 NA/T2000 客户表；上方项目统计仍会展示，且全部按非 T2000 计算。"
            />
          )}

          {hasData && (
            <section className="table-panel">
              <div className="section-title">
                <div className="table-heading">
                  <h2>T2000 客户详细数据</h2>
                  <span>按 Pipeline 金额降序排列；金额为 0 表示该客户当前暂无商机或业绩</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="presales-table">
                  <thead>
                    <tr>
                      <SortableHeader
                        label="客户"
                        sortKey="customer"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="类型"
                        sortKey="customerType"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="象限"
                        sortKey="quadrant"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="客户所有人"
                        sortKey="customerOwner"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="售前"
                        sortKey="presales"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="商机数"
                        sortKey="opportunityCount"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="Pipeline"
                        sortKey="pipelineAmount"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="Forecast"
                        sortKey="forecastAmount"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="业绩"
                        sortKey="performanceCount"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="已下单"
                        sortKey="orderAmount"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                      <SortableHeader
                        label="毛利"
                        sortKey="grossProfit"
                        activeKey={customerSort.key}
                        direction={customerSort.direction}
                        onSort={changeCustomerSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCustomers.map((item) => (
                      <tr key={`${item.customer}-${item.sourceSheet}`}>
                        <td>
                          <strong>{item.customer}</strong>
                          <div className="t2000-source-tag">{item.sourceSheet}</div>
                        </td>
                        <td>{item.customerType || '—'}</td>
                        <td>{item.quadrant || '—'}</td>
                        <td>{item.customerOwner || '—'}</td>
                        <td>{item.presales || '—'}</td>
                        <td>{item.opportunityCount.toLocaleString('zh-CN')} 个</td>
                        <td>{formatMoney(item.pipelineAmount)}</td>
                        <td>{formatMoney(item.forecastAmount)}</td>
                        <td>{item.performanceCount.toLocaleString('zh-CN')} 条</td>
                        <td>{formatMoney(item.orderAmount)}</td>
                        <td>{formatMoney(item.grossProfit)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={11}>未匹配到客户，请尝试简化或修改名称。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {hasData && filtered.some((item) => item.stageBreakdown.length > 0) && (
            <section className="table-panel">
              <div className="section-title">
                <div className="table-heading">
                  <h2>T2000 客户商机阶段分布</h2>
                  <span>仅展示有商机数据的客户，按金额降序</span>
                </div>
              </div>
              <div className="t2000-stage-grid">
                {sortedCustomers
                  .filter((item) => item.opportunityCount > 0)
                  .map((item) => (
                    <DashboardCard
                      key={`stage-${item.customer}`}
                      title={item.customer}
                      subtitle={`商机 ${item.opportunityCount} 个 / Pipeline ${formatMoney(item.pipelineAmount)}`}
                    >
                      <ul className="t2000-stage-list">
                        {item.stageBreakdown.map((stage) => (
                          <li key={`${item.customer}-${stage.stage}`}>
                            <span>{stage.stage}</span>
                            <strong>{formatMoney(stage.amount)}</strong>
                            <em>{stage.count} 个</em>
                          </li>
                        ))}
                      </ul>
                    </DashboardCard>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function T2000ProjectBadge({ status }: { status: OpportunityProjectStats['t2000Status'] }) {
  const className = status === 'T2000' ? 'success' : status === '混合' ? 'warning' : 'normal';
  return <span className={`presales-status ${className}`}>{status}</span>;
}

function compactList(values: string[]) {
  if (values.length === 0) return '—';
  if (values.length <= 2) return values.join(' / ');
  return `${values.slice(0, 2).join(' / ')} 等 ${values.length} 项`;
}

function SortableHeader<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: K;
  activeKey: K;
  direction: SortDirection;
  onSort: (key: K) => void;
}) {
  const active = sortKey === activeKey;
  const nextDirection = active ? (direction === 'asc' ? 'desc' : 'asc') : defaultSortDirection(sortKey);
  return (
    <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`sortable-table-header ${active ? 'active' : ''}`}
        aria-label={`按${label}${nextDirection === 'asc' ? '升序' : '降序'}排序`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        {active ? (
          direction === 'asc' ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ArrowUpDown size={13} />
        )}
      </button>
    </th>
  );
}

function sortProjectStats(stats: OpportunityProjectStats[], key: ProjectSortKey, direction: SortDirection) {
  return [...stats].sort(
    (a, b) =>
      compareSortValues(sortableProjectValue(a, key), sortableProjectValue(b, key), direction) ||
      a.projectName.localeCompare(b.projectName, 'zh-CN'),
  );
}

function sortableProjectValue(item: OpportunityProjectStats, key: ProjectSortKey) {
  const value = item[key];
  return Array.isArray(value) ? value.join(' / ') : value;
}

function sortCustomerStats(stats: T2000CustomerStats[], key: CustomerSortKey, direction: SortDirection) {
  return [...stats].sort(
    (a, b) => compareSortValues(a[key], b[key], direction) || a.customer.localeCompare(b.customer, 'zh-CN'),
  );
}

function compareSortValues(left: string | number, right: string | number, direction: SortDirection) {
  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        });
  return direction === 'asc' ? result : -result;
}

function defaultSortDirection(key: string): SortDirection {
  return [
    'opportunityCount',
    'pipelineAmount',
    't2000PipelineAmount',
    'nonT2000PipelineAmount',
    'forecastAmount',
    'performanceCount',
    'orderAmount',
    'grossProfit',
  ].includes(key)
    ? 'desc'
    : 'asc';
}

function splitOwnerNames(value: string) {
  return String(value ?? '')
    .split(/[、,，;；/|\\\r\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function pipelinePieOption(t2000Value: number, nonT2000Value: number, unit: '金额' | '商机') {
  return {
    aria: { enabled: true },
    color: ['#2563eb', '#94a3b8'],
    tooltip: {
      trigger: 'item',
      formatter: unit === '金额' ? '{b}<br/>{c} 万元（{d}%）' : '{b}<br/>{c} 个（{d}%）',
    },
    legend: {
      bottom: 0,
      left: 'center',
    },
    series: [
      {
        name: unit === '金额' ? 'Pipeline 金额' : '商机数量',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: {
          formatter: '{b}\n{d}%',
          color: '#475569',
        },
        emphasis: {
          scaleSize: 8,
        },
        data: [
          { name: 'T2000', value: t2000Value },
          { name: '非 T2000', value: nonT2000Value },
        ],
      },
    ],
  };
}
