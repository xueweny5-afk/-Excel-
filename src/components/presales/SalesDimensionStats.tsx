import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DashboardData, PPLRecord } from '../../domain';
import type { PresalesAnalysis } from '../../lib/presalesMetrics';
import {
  exportSalesStatsCsv,
  filterSalesStats,
  getPplRowsByOwner,
  summarizeSalesStats,
  type SalesDimensionStats,
} from '../../lib/salesDimensionStats';
import { formatMoney } from '../../lib/formatters';
import { DashboardCard } from '../common/DashboardCard';
import { StatusCard } from '../common/StatusCard';

interface SalesDimensionStatsProps {
  analysis: PresalesAnalysis;
  data: DashboardData;
}

const INPUT_HINT = '输入 Pipeline 所有人姓名（支持多值，用逗号/空格/换行分隔）；留空展示全部';

export function SalesDimensionStats({ analysis, data }: SalesDimensionStatsProps) {
  const [input, setInput] = useState('');
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  const filtered: SalesDimensionStats[] = useMemo(
    () => filterSalesStats(analysis.salesDimensionStats, input),
    [analysis.salesDimensionStats, input],
  );

  const summary = useMemo(() => summarizeSalesStats(filtered), [filtered]);
  const totalOwners = analysis.salesDimensionStats.length;
  const hasData = totalOwners > 0;

  function handleExport() {
    if (filtered.length === 0) return;
    const csv = exportSalesStatsCsv(filtered);
    downloadBlob(csv, `presales-sales-dimension-${todayStamp()}.csv`);
  }

  return (
    <>
      <section className="presales-owner-panel">
        <div className="presales-owner-input">
          <label>
            <span>Pipeline 所有人</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={INPUT_HINT}
              rows={2}
            />
          </label>
          <div className="presales-owner-actions">
            <button className="button ghost" onClick={() => setInput('')} disabled={!input}>
              清空
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
          数据口径：按 PPL 明细的"Pipeline 所有人 / 售前"（owner 字段）做主键聚合；
          已下单/毛利来自业绩明细，按"同客户 owner 反查"模糊匹配（多 owner 共拓时按均摊）。
        </p>
      </section>

      {!hasData ? (
        <StatusCard
          title="暂无销售维度数据"
          description="当前数据中未识别到 PPL 明细或 owner 字段，请先在售前驾驶舱导入 Excel。"
        />
      ) : (
        <>
          <section className="kpi-grid presales-owner-kpis">
            <SummaryKpi label="匹配销售" value={`${summary.ownerCount} / ${totalOwners} 人`} />
            <SummaryKpi label="覆盖客户" value={summary.customerCount.toLocaleString('zh-CN')} unit="家" />
            <SummaryKpi label="商机数" value={summary.opportunityCount.toLocaleString('zh-CN')} unit="个" />
            <SummaryKpi label="Pipeline" value={formatMoney(summary.pipelineAmount)} />
            <SummaryKpi label="Forecast" value={formatMoney(summary.forecastAmount)} />
            <SummaryKpi label="T2000 商机金额" value={formatMoney(summary.t2000OpportunityAmount)} />
            <SummaryKpi label="已下单金额" value={formatMoney(summary.orderAmount)} />
            <SummaryKpi label="销售毛利" value={formatMoney(summary.grossProfit)} />
          </section>

          <section className="table-panel">
            <div className="section-title">
              <div className="table-heading">
                <h2>销售维度统计</h2>
                <span>按 Pipeline 金额降序排列</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="presales-table">
                <thead>
                  <tr>
                    <th>Pipeline 所有人</th>
                    <th>覆盖客户</th>
                    <th>商机数</th>
                    <th>Pipeline</th>
                    <th>Forecast</th>
                    <th>T2000 商机</th>
                    <th>T2000 金额</th>
                    <th>已立项</th>
                    <th>已下单</th>
                    <th>销售毛利</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isExpanded = expandedOwner === item.owner;
                    return (
                      <DrillRow
                        key={item.owner}
                        item={item}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedOwner(isExpanded ? null : item.owner)}
                        detailRows={isExpanded ? getPplRowsByOwner(data, item.owner) : []}
                      />
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10}>未匹配到人员，请尝试简化或修改名称。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
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
  // 添加 UTF-8 BOM 确保 Excel 打开中文不乱码
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

interface DrillRowProps {
  item: SalesDimensionStats;
  isExpanded: boolean;
  onToggle: () => void;
  detailRows: PPLRecord[];
}

function DrillRow({ item, isExpanded, onToggle, detailRows }: DrillRowProps) {
  return (
    <>
      <tr
        className={`drill-row ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <td>
          <span className="drill-icon" aria-hidden>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <strong>{item.owner}</strong>
        </td>
        <td>{item.customerCount} 家</td>
        <td>{item.opportunityCount.toLocaleString('zh-CN')} 个</td>
        <td>{formatMoney(item.pipelineAmount)}</td>
        <td>{formatMoney(item.forecastAmount)}</td>
        <td>{item.t2000OpportunityCount.toLocaleString('zh-CN')} 个</td>
        <td>{formatMoney(item.t2000OpportunityAmount)}</td>
        <td>{item.establishedCount.toLocaleString('zh-CN')} 个</td>
        <td>{formatMoney(item.orderAmount)}</td>
        <td>{formatMoney(item.grossProfit)}</td>
      </tr>
      {isExpanded && (
        <tr className="drill-detail-row">
          <td colSpan={10}>
            <OwnerPplDetail rows={detailRows} ownerName={item.owner} />
          </td>
        </tr>
      )}
    </>
  );
}

function OwnerPplDetail({ rows, ownerName }: { rows: PPLRecord[]; ownerName: string }) {
  const pipelineAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const forecastAmount = rows
    .filter((r) => r.forecastType === 'Commit' || r.forecastType === 'Best Case')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return (
    <div className="owner-ppl-detail">
      <div className="owner-ppl-summary">
        <strong>{ownerName} 名下商机明细</strong>
        <span>共 {rows.length} 条 / Pipeline {formatMoney(pipelineAmount)} / Forecast {formatMoney(forecastAmount)}</span>
      </div>
      <div className="table-wrap">
        <table className="presales-table owner-ppl-table">
          <thead>
            <tr>
              <th>商机名称</th>
              <th>客户</th>
              <th>产品</th>
              <th>阶段</th>
              <th>金额</th>
              <th>Forecast</th>
              <th>赢率</th>
              <th>季度</th>
              <th>T2000</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9}>该人员名下未找到对应的 PPL 明细。</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.opportunityName || '—'}</td>
                  <td>{row.customerName || '—'}</td>
                  <td>{row.product || '—'}</td>
                  <td>{row.stage || '—'}</td>
                  <td>{formatMoney(Number(row.amount) || 0)}</td>
                  <td>{row.forecastType || '—'}</td>
                  <td>{formatPercentLocal(row.winRate)}</td>
                  <td>{row.expectedQuarter || '—'}</td>
                  <td>{isT2000Ppl(row) ? <span className="presales-status success">T2000</span> : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isT2000Ppl(row: PPLRecord): boolean {
  return String(row.t2000CustomerTag ?? '').toLowerCase().includes('t2000');
}

function formatPercentLocal(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}