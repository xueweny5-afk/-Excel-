import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PresalesAnalysis } from '../../lib/presalesMetrics';
import {
  exportT2000StatsCsv,
  filterT2000ByType,
  filterT2000Stats,
  summarizeT2000Stats,
  type T2000CustomerStats,
} from '../../lib/t2000CustomerStats';
import { formatMoney } from '../../lib/formatters';
import { DashboardCard } from '../common/DashboardCard';
import { StatusCard } from '../common/StatusCard';

interface T2000CustomerStatsProps {
  analysis: PresalesAnalysis;
}

const TYPE_OPTIONS = ['全部', 'NA-I', 'NA-II', 'NA代管'] as const;
const INPUT_HINT = '输入 T2000 客户名称（支持多值，用逗号/空格/换行分隔）；留空展示全部';

export function T2000CustomerStatsView({ analysis }: T2000CustomerStatsProps) {
  const [input, setInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>('全部');

  const typeFiltered: T2000CustomerStats[] = useMemo(() => {
    return filterT2000ByType(analysis.t2000Stats, typeFilter);
  }, [analysis.t2000Stats, typeFilter]);

  const filtered: T2000CustomerStats[] = useMemo(() => {
    return filterT2000Stats(typeFiltered, input);
  }, [typeFiltered, input]);

  const summary = useMemo(() => summarizeT2000Stats(filtered), [filtered]);
  const totalT2000 = analysis.t2000Stats.length;
  const hasData = totalT2000 > 0;
  const sourceSheet = analysis.t2000Stats[0]?.sourceSheet ?? '';

  function handleExport() {
    if (filtered.length === 0) return;
    const csv = exportT2000StatsCsv(filtered);
    downloadBlob(csv, `t2000-customer-stats-${todayStamp()}.csv`);
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
            <button className="button ghost" onClick={() => setInput('')} disabled={!input}>
              清空名称
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
          </div>
        </div>
        <p className="presales-owner-hint">
          数据口径：客户列表来自 NA Sheet（{sourceSheet || '未识别'}），以"T2000 客户标签"为权威源；商机数/Pipeline/Forecast 来自 PPL 明细（按客户名模糊匹配），下单/毛利来自业绩明细。
          <strong>即使 T2000 客户在 PPL/业绩中无任何记录也会展示</strong>，便于盘点覆盖漏斗。
        </p>
      </section>

      {!hasData ? (
        <StatusCard
          title="暂无 T2000 客户数据"
          description="当前数据中未识别到 NA Sheet 或 T2000 客户标签，请确认 Excel 是否包含「NA客户」Sheet。"
        />
      ) : (
        <>
          <section className="kpi-grid presales-owner-kpis">
            <SummaryKpi label="T2000 客户" value={`${summary.customerCount} / ${totalT2000} 家`} />
            <SummaryKpi label="商机数" value={summary.opportunityCount.toLocaleString('zh-CN')} unit="个" />
            <SummaryKpi label="Pipeline 金额" value={formatMoney(summary.pipelineAmount)} />
            <SummaryKpi label="Forecast 金额" value={formatMoney(summary.forecastAmount)} />
            <SummaryKpi label="已下单金额" value={formatMoney(summary.orderAmount)} />
            <SummaryKpi label="销售毛利" value={formatMoney(summary.grossProfit)} />
          </section>

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
                    <th>客户</th>
                    <th>类型</th>
                    <th>象限</th>
                    <th>客户所有人</th>
                    <th>售前</th>
                    <th>商机数</th>
                    <th>Pipeline</th>
                    <th>Forecast</th>
                    <th>业绩</th>
                    <th>已下单</th>
                    <th>毛利</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
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

          {filtered.some((item) => item.stageBreakdown.length > 0) && (
            <section className="table-panel">
              <div className="section-title">
                <div className="table-heading">
                  <h2>T2000 客户商机阶段分布</h2>
                  <span>仅展示有商机数据的客户，按金额降序</span>
                </div>
              </div>
              <div className="t2000-stage-grid">
                {filtered
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

function SummaryKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <DashboardCard title={label}>
      <div className="owner-summary-value">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
      </div>
    </DashboardCard>
  );
}

function downloadBlob(content: string, fileName: string) {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}