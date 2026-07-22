import type { DragEvent } from 'react';
import { useDataStore } from '../stores/dataStore';

/**
 * 文件拖拽 hook：抽离 main.tsx 中散落的拖拽事件处理。
 * 通过 window 上的 CustomEvent 把拖入的 File 派发给 App 内的 handleFile。
 *
 * 修复销售/售前导入串扰：内层上传区（销售 TopBar 的 file input + 售前 upload card
 * 自身的 drop 区）已经各自处理文件。外层 app-shell 不再无脑吞掉所有 drop —— 只有当
 * 拖入位置不在任何"已声明接管"的上传区内时才作为"主区"接收。
 */
export function useFileDrop() {
  const setDragging = useDataStore((s) => s.setDragging);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    // 如果事件起源于某个上传卡片（销售 / 售前），让那张卡自己处理，外层不接。
    if (event.target instanceof Element && event.target.closest('[data-upload-scope]')) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      window.dispatchEvent(new CustomEvent('dashboard:file-drop', { detail: file }));
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    // 内层上传卡已经设置了 dropEffect；这里只在非内层时启用外层视觉反馈。
    if (event.target instanceof Element && event.target.closest('[data-upload-scope]')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) setDragging(false);
  }

  return { handleDrop, handleDragOver, handleDragLeave };
}
