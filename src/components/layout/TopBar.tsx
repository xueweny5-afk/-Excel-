import { RotateCcw, Upload } from 'lucide-react';
import { useDataStore } from '../../stores/dataStore';
import type { ImportReport } from '../../domain';

interface TopBarProps {
  report: ImportReport | null;
  hasData: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}

/** 顶部导航：标题 + 文件信息 + 上传/清空按钮 */
export function TopBar({ report, hasData, onUpload, onClear }: TopBarProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUpload(file);
    // H7 修复：重置 input value 以允许重复上传同名文件
    event.target.value = '';
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Pipeline & Forecast Analysis</p>
        <h1>江苏省办销售经营驾驶舱</h1>
      </div>
      <div className="header-meta">
        <span>当前文件：{report?.fileName ?? '未导入文件'}</span>
        <span>导入时间：{report?.importedAt ?? '-'}</span>
        <span>
          数据范围：PPL {report?.pplRows ?? 0} 条 / 活动 {report?.activityRows ?? 0} 条
        </span>
      </div>
      <div className="topbar-actions">
        <label className="button primary">
          <Upload size={16} />
          重新上传
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleChange} />
        </label>
        <button className="button ghost" onClick={onClear} disabled={!hasData}>
          <RotateCcw size={16} />
          清空
        </button>
      </div>
    </header>
  );
}

/** 顶部导航的"清空"按钮触发 store.clearData，避免组件内重复 props 透传 */
export function TopBarClearButton({ hasData }: { hasData: boolean }) {
  const clearData = useDataStore((s) => s.clearData);
  return (
    <button className="button ghost" onClick={clearData} disabled={!hasData}>
      <RotateCcw size={16} />
      清空
    </button>
  );
}
