import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { analyzeKeyCustomers, exportKeyCustomerCsv } from '../../lib/customerAnalyzer';
import { useDataStore } from '../../stores/dataStore';
import { StatusCard } from '../common/StatusCard';
import { KeyCustomerKpis } from './KeyCustomerKpis';
import { KeyCustomerCharts } from './KeyCustomerCharts';
import { MatchResultCharts } from './MatchResultCharts';
import { KeyCustomerDetailTable } from '../tables/KeyCustomerDetailTable';
import { UnmatchedCustomerTable } from '../tables/UnmatchedCustomerTable';

/** 重点客户分析 Tab 完整视图 */
export function KeyCustomerView() {
  const input = useDataStore((s) => s.keyCustomerInput);
  const setInput = useDataStore((s) => s.setKeyCustomerInput);
  const rawPpl = useDataStore((s) => s.data?.ppl ?? EMPTY_ARRAY);
  const activity = useDataStore((s) => s.data?.activity ?? EMPTY_ACTIVITY);

  const analysis = useMemo(() => analyzeKeyCustomers(input, rawPpl, activity), [input, rawPpl, activity]);
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
            <button
              className="button primary"
              onClick={() => exportKeyCustomerCsv(analysis.matchedPplRows)}
              disabled={analysis.matchedPplRows.length === 0}
            >
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
            <UnmatchedCustomerTable customers={analysis.unmatchedInputs} />
          )}
          <section className="table-panel">
            <div className="section-title">
              <h2>客户匹配结果</h2>
              <span>{analysis.matchResults.length} 个输入客户</span>
            </div>
            <MatchResultCharts analysis={analysis} />
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
                      <td>{formatPercentLocal(result.confidence)}</td>
                      <td>
                        <span className={`match-status ${result.matched ? 'success' : 'failed'}`}>
                          {result.matched ? '成功' : '未匹配'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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

const EMPTY_ARRAY: never[] = [];
const EMPTY_ACTIVITY: never[] = [];

function formatPercentLocal(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}