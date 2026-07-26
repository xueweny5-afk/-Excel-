import type { ReactNode } from 'react';
import { DashboardCard } from '../common/DashboardCard';

/** 售前驾驶舱各统计视图共用的 KPI 摘要卡片 */
export function SummaryKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <DashboardCard title={label}>
      <div className="owner-summary-value">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
    </DashboardCard>
  );
}

/**
 * 下载一个文件到本地。默认 CSV（带 UTF-8 BOM，Excel 打开中文不乱码）。
 * 接受任意 BlobPart：string / ArrayBuffer / Blob。
 */
export function downloadBlob(content: string | BlobPart[], fileName: string, mime = 'text/csv;charset=utf-8') {
  const parts: BlobPart[] = typeof content === 'string' ? ['﻿', content] : content;
  const blob = new Blob(parts, { type: mime });
  triggerDownload(blob, fileName);
}

/** 文本下载（同 downloadBlob 但不带 BOM） */
export function downloadText(text: string, fileName: string, mime = 'text/plain;charset=utf-8') {
  triggerDownload(new Blob([text], { type: mime }), fileName);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** 当前日期戳，格式 YYYYMMDD（售前/工作台统计视图默认导出文件名后缀） */
export function todayStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** 当前日期戳，格式 YYYY-MM-DD（业绩统计默认日期格式） */
export function todayHyphen(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 占位：无 icon 时直接放一个紧凑的小标签 */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}