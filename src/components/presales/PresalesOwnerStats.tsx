import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PresalesAnalysis } from '../../lib/presalesMetrics';
import { exportOwnerStatsCsv, filterOwnerStats, summarizeStats, type CustomerStats } from '../../lib/presalesOwnerStats';
import { formatMoney } from '../../lib/formatters';
import { DashboardCard } from '../common/DashboardCard';
import { StatusCard } from '../common/StatusCard';

interface PresalesOwnerStatsProps {
  analysis: PresalesAnalysis;
}

const INPUT_HINT = '输入客户名称（支持多值，用逗号/空格/换行分隔）；留空展示全部';

export function PresalesOwnerStats({ analysis }: PresalesOwnerStatsProps) {
  const [input, setInput] = useState('');

  const filtered: CustomerStats[] = useMemo(() => {
    return filterOwnerStats(analysis.ownerStats, input);
  }, [analysis.ownerStats, input]);

  const summary = useMemo(() => summarizeStats(filtered), [filtered]);
  const totalCustomers = analysis.ownerStats.length;
  const hasData = totalCustomers > 0;

  function handleExport() {
    if (filtered.length === 0) return;
    const csv = exportOwnerStatsCsv(filtered);
    downloadBlob(csv, `presales-customer-stats-${todayStamp()}.csv`);
  }

  return (
    <>
      <section className="presales-owner-panel">
        <div className="presales-owner-input">
          <label>
            <span>客户名称</span>
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
          数据口径：按业绩明细中的"最终用户"做主键聚合，下单/毛利来自业绩明细；商机数/Pipeline/Forecast 反向从 PPL 明细补齐同一客户的所有商机。
        </p>
      </section>

      {!hasData ? (
        <StatusCard
          title="暂无客户统计"
          description="当前数据中未识别到业绩明细或 PPL 明细，请先在售前驾驶舱导入 Excel。"
        />
      ) : (
        <>
          <section className="kpi-grid presales-owner-kpis">
            <SummaryKpi label="匹配客户" value={`${summary.customerCount} / ${totalCustomers} 家`} />
            <SummaryKpi label="业绩记录" value={summary.performanceCount.toLocaleString('zh-CN')} unit="条" />
            <SummaryKpi label="商机数" value={summary.opportunityCount.toLocaleString('zh-CN')} unit="个" />
            <SummaryKpi label="Pipeline 金额" value={formatMoney(summary.pipelineAmount)} />
            <SummaryKpi label="已下单金额" value={formatMoney(summary.orderAmount)} />
            <SummaryKpi label="销售毛利" value={formatMoney(summary.grossProfit)} />
          </section>

          <section className="table-panel">
            <div className="section-title">
              <div className="table-heading">
                <h2>客户业绩与商机统计</h2>
                <span>按下单金额降序排列</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="presales-table">
                <thead>
                  <tr>
                    <th>客户</th>
                    <th>T2000</th>
                    <th>商机数</th>
                    <th>Pipeline 金额</th>
                    <th>Forecast 金额</th>
                    <th>业绩记录</th>
                    <th>已下单金额</th>
                    <th>销售毛利</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.customer}>
                      <td>{item.customer}</td>
                      <td>{item.isT2000 ? <span className="presales-status success">T2000</span> : '—'}</td>
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
                      <td colSpan={8}>未匹配到客户，请尝试简化或修改名称。</td>
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