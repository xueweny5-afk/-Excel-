import type { DragEvent } from 'react';
import { useDataStore } from '../stores/dataStore';

/**
 * 文件拖拽 hook：抽离 main.tsx 中散落的拖拽事件处理。
 * 通过 window 上的 CustomEvent 把拖入的 File 派发给 App 内的 handleFile。
 */
export function useFileDrop() {
  const setDragging = useDataStore((s) => s.setDragging);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      window.dispatchEvent(new CustomEvent('dashboard:file-drop', { detail: file }));
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) setDragging(false);
  }

  return { handleDrop, handleDragOver, handleDragLeave };
}
