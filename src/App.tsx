import { useCallback, useEffect, useMemo } from 'react';
import { parseDashboardFile } from './lib/parser';
import { groupAmount } from './lib/analyzer';
import { formatMoney } from './lib/formatters';
import { useDataStore } from './stores/dataStore';
import { useFileDrop } from './hooks/useFileDrop';
import { useFilteredPpl } from './hooks/useFilteredPpl';
import { TopBar } from './components/layout/TopBar';
import { TabBar } from './components/layout/TabBar';
import { FileDropZone } from './components/upload/FileDropZone';
import { ImportReportPanel } from './components/upload/ImportReport';
import { FilterBar } from './components/filters/FilterBar';
import { DrillTags } from './components/filters/DrillTags';
import { KpiGrid } from './components/kpi/KpiGrid';
import { InsightBanner } from './components/common/InsightBanner';
import { StatusCard } from './components/common/StatusCard';
import { ChartGrid } from './components/charts/ChartGrid';
import { PplTable } from './components/tables/PplTable';
import { SimpleRecords } from './components/tables/SimpleRecords';
import { KeyCustomerView } from './components/keyCustomers/KeyCustomerView';

/**
 * 应用根组件。
 * 职责：
 *   1. 监听拖拽 + 文件上传，调用 parser 并写入 store
 *   2. 根据 activeTab 分发到对应视图
 *   3. PPL Tab 装配：FilterBar → DrillTags → KpiGrid → InsightBanner → ChartGrid → PplTable
 */
export default function App() {
  const data = useDataStore((s) => s.data);
  const loading = useDataStore((s) => s.loading);
  const error = useDataStore((s) => s.error);
  const activeTab = useDataStore((s) => s.activeTab);
  const isDraggingFile = useDataStore((s) => s.isDraggingFile);
  const setData = useDataStore((s) => s.setData);
  const setLoading = useDataStore((s) => s.setLoading);
  const setError = useDataStore((s) => s.setError);
  const setDragging = useDataStore((s) => s.setDragging);
  const clearData = useDataStore((s) => s.clearData);
  const toggleDrill = useDataStore((s) => s.toggleDrill);

  const { filteredPpl, rawPpl, kpis } = useFilteredPpl();
  const dragHandlers = useFileDrop();

  const handleFile = useCallback(async (file: File) => {
    setDragging(false);
    setLoading(true);
    setError('');
    try {
      const parsed = await parseDashboardFile(file);
      setData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败，请检查格式和表头。');
    } finally {
      setLoading(false);
    }
  }, [setData, setDragging, setError, setLoading]);

  // 监听 useFileDrop 派发的全局事件
  useEffect(() => {
    function onFileDrop(event: Event) {
      const custom = event as CustomEvent<File>;
      if (custom.detail) void handleFile(custom.detail);
    }
    window.addEventListener('dashboard:file-drop', onFileDrop);
    return () => window.removeEventListener('dashboard:file-drop', onFileDrop);
  }, [handleFile]);

  const insights = useMemo(() => buildInsights(filteredPpl), [filteredPpl]);

  return (
    <main
      className={`app-shell ${isDraggingFile ? 'dragging-file' : ''}`}
      onDragEnter={dragHandlers.handleDragOver}
      onDragOver={dragHandlers.handleDragOver}
      onDragLeave={dragHandlers.handleDragLeave}
      onDrop={dragHandlers.handleDrop}
    >
      <TopBar
        report={data?.report ?? null}
        hasData={!!data}
        onUpload={handleFile}
        onClear={clearData}
      />

      {loading && <StatusCard title="正在解析 Excel..." description="正在识别 Sheet、清洗字段并生成分析结果。" />}
      {error && <StatusCard tone="danger" title="文件解析失败" description={error} />}
      {!data && !loading && !error && <FileDropZone />}

      {data && (
        <>
          <ImportReportPanel report={data.report} />
          <TabBar />
          {activeTab === 'ppl' && (
            <PplTabView
              rawPpl={rawPpl}
              filteredPpl={filteredPpl}
              kpis={kpis}
              insights={insights}
              toggleDrill={toggleDrill}
            />
          )}
          {activeTab === 'summary' && <SimpleRecords title="数据汇总" rows={data.summary} />}
          {activeTab === 'activity' && <SimpleRecords title="活动记录" rows={data.activity} />}
          {activeTab === 'keyCustomers' && <KeyCustomerView />}
        </>
      )}
    </main>
  );
}

/* ==================== 内部子视图 ==================== */

interface PplTabViewProps {
  rawPpl: ReturnType<typeof useFilteredPpl>['rawPpl'];
  filteredPpl: ReturnType<typeof useFilteredPpl>['filteredPpl'];
  kpis: ReturnType<typeof useFilteredPpl>['kpis'];
  insights: string[];
  toggleDrill: ReturnType<typeof useDataStore.getState>['toggleDrill'];
}

function PplTabView({ rawPpl, filteredPpl, kpis, insights, toggleDrill }: PplTabViewProps) {
  const summary = `当前结果：${filteredPpl.length.toLocaleString('zh-CN')} 条商机 / ${formatMoney(kpis.totalAmount)}`;

  return (
    <>
      <FilterBar data={rawPpl} resultSummary={summary} />
      <DrillTags />
      <KpiGrid kpis={kpis} />
      <InsightBanner insights={insights} />
      {filteredPpl.length === 0 ? (
        <StatusCard title="当前筛选条件下没有数据" description="请调整筛选条件或清空筛选。" />
      ) : (
        <>
          <ChartGrid data={filteredPpl} onDrill={toggleDrill} />
          <PplTable rows={filteredPpl} />
        </>
      )}
    </>
  );
}

function buildInsights(rows: ReturnType<typeof useFilteredPpl>['filteredPpl']) {
  const owner = groupAmount(rows, 'owner', 1)[0];
  const product = groupAmount(rows, 'product', 1)[0];
  const industry = groupAmount(rows, 'industryLevel1', 1)[0];
  const quarter = groupAmount(rows, 'expectedQuarter', 1)[0];
  const riskCount = rows.filter((row) => row.healthLevel === '风险').length;
  return [
    owner ? `最高销售：${owner.name}，${formatMoney(owner.value)}` : '暂无销售排行',
    product ? `最高产品：${product.name}` : '暂无产品排行',
    industry ? `最高行业：${industry.name}` : '暂无行业排行',
    quarter ? `最高季度：${quarter.name}` : '暂无季度排行',
    `风险商机：${riskCount.toLocaleString('zh-CN')} 个`,
  ];
}