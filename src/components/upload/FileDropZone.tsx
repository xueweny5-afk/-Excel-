import type { DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { useDataStore } from '../../stores/dataStore';

interface FileDropZoneProps {
  onFile: (file: File) => void;
}

/** 空状态/拖拽提示区（支持点击上传 + 拖拽上传） */
export function FileDropZone({ onFile }: FileDropZoneProps) {
  const isDraggingFile = useDataStore((s) => s.isDraggingFile);
  const setDragging = useDataStore((s) => s.setDragging);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget === event.target) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      // 直接派发事件，绕开 app-shell 的拦截逻辑
      window.dispatchEvent(new CustomEvent('dashboard:file-drop', { detail: file }));
    }
  }

  return (
    <label
      className={`empty-state drop-zone ${isDraggingFile ? 'active' : ''}`}
      data-upload-scope="sales"
      style={{ cursor: 'pointer' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.et"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <Upload size={34} />
      <h2>{isDraggingFile ? '松开即可导入 Excel 并统计' : '拖入 Excel 或点击上传'}</h2>
      <p>支持 .xlsx / .xls / .csv / .xlsm / .xlsb / .et，数据仅在浏览器本地处理，不会上传服务器。</p>
    </label>
  );
}
