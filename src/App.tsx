import { useCallback, useEffect, useMemo } from 'react';
import type { DashboardData } from './domain';
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
import { PresalesDashboardView } from './components/presales/PresalesDashboardView';
import { WorkbenchView } from './workbench/WorkbenchView';
import { captureDashboardImport } from './workbench/db';
import type { ModuleKey } from './stores/dataStore';

const EMPTY_DASHBOARD_DATA: DashboardData = {
  ppl: [],
  summary: [],
  activity: [],
  performance: [],
  report: {
    fileName: '未导入文件',
    importedAt: '-',
    pplRows: 0,
    summaryRows: 0,
    activityRows: 0,
    performanceRows: 0,
    skippedRows: 0,
    detectedFields: [],
    missingFields: [],
    warnings: [],
  },
};

export default function App() {
  const salesData = useDataStore((s) => s.salesData);
  const presalesData = useDataStore((s) => s.presalesData);
  const previousPresalesData = useDataStore((s) => s.previousPresalesData);
  const loading = useDataStore((s) => s.loading);
  const error = useDataStore((s) => s.error);
  const activeModule = useDataStore((s) => s.activeModule);
  const activeTab = useDataStore((s) => s.activeTab);
  const setActiveModule = useDataStore((s) => s.setActiveModule);
  const isDraggingFile = useDataStore((s) => s.isDraggingFile);
  const setSalesData = useDataStore((s) => s.setSalesData);
  const setPresalesData = useDataStore((s) => s.setPresalesData);
  const setLoading = useDataStore((s) => s.setLoading);
  const setError = useDataStore((s) => s.setError);
  const setDragging = useDataStore((s) => s.setDragging);
  const clearData = useDataStore((s) => s.clearData);
  const toggleDrill = useDataStore((s) => s.toggleDrill);

  const { filteredPpl, rawPpl, kpis } = useFilteredPpl();
  const dragHandlers = useFileDrop();
  const isPresales = activeModule === 'presales';
  const isWorkbench = activeModule === 'workbench';

  const handleFile = useCallback(
    async (file: File) => {
      setDragging(false);
      setLoading(true);
      setError('');
      try {
        const parsed = await parseDashboardFile(file);
        if (activeModule === 'presales') {
          setPresalesData(parsed);
        } else {
          setSalesData(parsed);
        }
        try {
          await captureDashboardImport({
            sourceModule: activeModule === 'presales' ? 'presales' : 'sales',
            data: parsed,
          });
        } catch (captureError) {
          console.warn('[WorkbenchImport]', captureError);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '文件解析失败，请检查格式和表头。');
      } finally {
        setLoading(false);
      }
    },
    [activeModule, setPresalesData, setSalesData, setDragging, setError, setLoading],
  );

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
      onDragEnter={isWorkbench ? undefined : dragHandlers.handleDragOver}
      onDragOver={isWorkbench ? undefined : dragHandlers.handleDragOver}
      onDragLeave={isWorkbench ? undefined : dragHandlers.handleDragLeave}
      onDrop={isWorkbench ? undefined : dragHandlers.handleDrop}
    >
      <ModuleNav
        active={activeModule}
        onSales={() => setActiveModule('sales')}
        onPresales={() => setActiveModule('presales')}
        onWorkbench={() => setActiveModule('workbench')}
      />

      {activeModule === 'sales' && (
        <TopBar
          report={salesData?.report ?? null}
          hasData={!!salesData}
          onUpload={handleFile}
          onClear={clearData}
        />
      )}

      {!isWorkbench && loading && (
        <StatusCard title="正在分析 Excel..." description="正在识别 Sheet、清洗字段并生成分析结果。" />
      )}
      {!isWorkbench && error && <StatusCard tone="danger" title="文件解析失败" description={error} />}

      {isWorkbench ? (
        <WorkbenchView />
      ) : isPresales ? (
        <PresalesDashboardView
          data={presalesData ?? EMPTY_DASHBOARD_DATA}
          previousData={previousPresalesData}
          onUpload={handleFile}
        />
      ) : (
        <>
          <TabBar />
          {!salesData && !loading && !error && <FileDropZone onFile={handleFile} />}
          {salesData && (
            <>
              <ImportReportPanel report={salesData.report} />
              {activeTab === 'ppl' && (
                <PplTabView
                  rawPpl={rawPpl}
                  filteredPpl={filteredPpl}
                  kpis={kpis}
                  insights={insights}
                  toggleDrill={toggleDrill}
                />
              )}
              {activeTab === 'summary' && <SimpleRecords title="数据汇总" rows={salesData.summary} />}
              {activeTab === 'activity' && <SimpleRecords title="活动记录" rows={salesData.activity} />}
              {activeTab === 'keyCustomers' && <KeyCustomerView />}
            </>
          )}
        </>
      )}
    </main>
  );
}

function ModuleNav({
  active,
  onSales,
  onPresales,
  onWorkbench,
}: {
  active: ModuleKey;
  onSales: () => void;
  onPresales: () => void;
  onWorkbench: () => void;
}) {
  return (
    <nav className="module-nav" aria-label="驾驶舱栏目">
      <button className={active === 'sales' ? 'active' : ''} onClick={onSales}>
        销售经营驾驶舱
      </button>
      <button className={active === 'presales' ? 'active' : ''} onClick={onPresales}>
        售前经营驾驶舱
      </button>
      <button className={active === 'workbench' ? 'active' : ''} onClick={onWorkbench}>
        售前工作台
      </button>
    </nav>
  );
}

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
  const riskCount = rows.filter((row) => String(row.healthLevel).includes('风险')).length;
  return [
    owner ? `最高销售：${owner.name}，${formatMoney(owner.value)}` : '暂无销售排行',
    product ? `最高产品：${product.name}` : '暂无产品排行',
    industry ? `最高行业：${industry.name}` : '暂无行业排行',
    quarter ? `最高季度：${quarter.name}` : '暂无季度排行',
    `风险商机：${riskCount.toLocaleString('zh-CN')} 个`,
  ];
}
