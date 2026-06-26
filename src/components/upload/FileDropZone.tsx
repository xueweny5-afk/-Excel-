import { Upload } from 'lucide-react';
import { useDataStore } from '../../stores/dataStore';

/** 空状态/拖拽提示区 */
export function FileDropZone() {
  const isDraggingFile = useDataStore((s) => s.isDraggingFile);

  return (
    <section className={`empty-state drop-zone ${isDraggingFile ? 'active' : ''}`}>
      <Upload size={34} />
      <h2>{isDraggingFile ? '松开即可导入 Excel 并统计' : '拖入 Excel 或点击上传'}</h2>
      <p>支持 .xlsx / .xls / .csv，数据仅在浏览器本地处理，不会上传服务器。</p>
    </section>
  );
}
