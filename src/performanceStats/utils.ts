import * as XLSX from 'xlsx';

export type Row = Record<string, unknown>;

export function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export function displayText(value: unknown) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function normalizeHeader(value: string) {
  return normalizeText(value).replace(/[()（）【】[\]_\-—:：/\\]/g, '');
}

export function mapFields<T extends string>(row: Row, aliases: Record<T, readonly string[]>) {
  const headers = Object.keys(row);
  return Object.entries(aliases).reduce<Partial<Record<T, string>>>((acc, [field, names]) => {
    const match = (names as string[])
      .map((alias) => headers.find((header) => headerMatches(header, alias)))
      .find(Boolean);
    if (match) acc[field as T] = match;
    return acc;
  }, {});
}

export function headerMatches(header: string, alias: string) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);
  if (
    normalizedAlias.includes('项目名称') &&
    /项目(编号|编码|id|code|号)$/.test(normalizedHeader)
  ) {
    return false;
  }
  return (
    normalizedHeader === normalizedAlias ||
    normalizedHeader.includes(normalizedAlias) ||
    normalizedAlias.includes(normalizedHeader)
  );
}

export function readString(row: Row, header?: string) {
  return displayText(header ? row[header] : '');
}

export function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value)
    .normalize('NFKC')
    .replace(/,/g, '')
    .replace(/￥|¥|人民币|元|万元/g, '')
    .trim();
  if (!text || /^[-—]+$/.test(text)) return 0;
  const numeric = Number(text.replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseAmountAsWan(value: unknown, header?: string) {
  const amount = parseAmount(value);
  const headerText = String(header ?? '');
  if (headerText.includes('万元')) return amount * 10000;
  return amount;
}

export function parseConfirmationDate(value: unknown, fallbackYear?: number) {
  if (value === null || value === undefined || value === '') {
    return { year: null, month: null, text: '' };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, text: `${value.getFullYear()}-${value.getMonth() + 1}` };
  }
  if (typeof value === 'number') {
    if (value >= 1 && value <= 12) {
      return { year: fallbackYear ?? new Date().getFullYear(), month: value, text: `${fallbackYear ?? new Date().getFullYear()}-${value}` };
    }
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m) return { year: parsed.y, month: parsed.m, text: `${parsed.y}-${parsed.m}` };
  }
  const text = displayText(value);
  const full = text.match(/(20\d{2})\s*[-年/.]?\s*(1[0-2]|0?[1-9])\s*月?/);
  if (full) return { year: Number(full[1]), month: Number(full[2]), text };
  const monthOnly = text.match(/^(1[0-2]|0?[1-9])\s*月?$/);
  if (monthOnly) {
    const year = fallbackYear ?? new Date().getFullYear();
    return { year, month: Number(monthOnly[1]), text };
  }
  return { year: null, month: null, text };
}

/**
 * 计算文件指纹：内容 SHA-256（首选），降级路径 `name + size + lastModified`。
 *
 * 降级触发场景：
 *   - 浏览器在非 HTTPS / file:// 协议下 `globalThis.crypto.subtle` 可能为 undefined
 *   - File System Access API 在某些浏览器实现差异
 *
 * 注意：降级指纹**不保证文件内容级别唯一性**，仅用于本地去重；
 * 如果两个用户上传同名同大小同修改时间的文件，会碰撞。
 * 服务端场景务必改用 SHA-256 内容哈希。
 */
export async function fileDigest(file: File) {
  const buffer = await file.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${file.name}:${file.size}:${file.lastModified}`;
}

// 业绩统计模块也复用的安全边界，与 src/lib/parser.ts 保持一致
const PERF_MAX_FILE_SIZE = 10 * 1024 * 1024;
const PERF_MAX_SHEETS = 20;
const PERF_MAX_ROWS = 50000;
const PERF_MAX_CELL_LENGTH = 5000;

export async function readWorkbook(file: File) {
  // 文件大小限制（防止恶意大文件触发 ReDoS / 耗尽内存）
  if (file.size > PERF_MAX_FILE_SIZE) {
    throw new Error(
      `文件超过 ${(PERF_MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 限制（当前 ${(file.size / 1024 / 1024).toFixed(2)}MB），请拆分后导入。`,
    );
  }
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
  });
}

export function workbookRows(workbook: XLSX.WorkBook) {
  if (workbook.SheetNames.length > PERF_MAX_SHEETS) {
    throw new Error(`Sheet 数 ${workbook.SheetNames.length} 超过上限 ${PERF_MAX_SHEETS}。`);
  }
  return workbook.SheetNames.map((sheetName) => {
    const allRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheetName], { defval: '', raw: true });
    const rows = allRows.length > PERF_MAX_ROWS ? allRows.slice(0, PERF_MAX_ROWS) : allRows;
    // 每个单元格字符串长度限制
    return {
      sheetName,
      rows: rows.map((row) => {
        const out: Row = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === 'string' ? v.slice(0, PERF_MAX_CELL_LENGTH) : v;
        }
        return out;
      }),
    };
  });
}

export function newId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function distinctCount(values: string[]) {
  return new Set(values.map(normalizeText).filter(Boolean)).size;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function formatWan(value: number) {
  if (!Number.isFinite(value)) return '0 万元';
  return `${Math.round(value / 10000).toLocaleString('zh-CN')} 万元`;
}

export function toRoundedWan(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 10000);
}

export function formatRate(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}
