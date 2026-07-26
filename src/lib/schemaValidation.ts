/**
 * 统一 schema 校验层。
 *
 * 提供：
 *   - 数组长度 / 字符串长度 / 数字范围等结构化守卫
 *   - 任意 JSON 对象的 shape 校验（isPlainObject / hasString / hasNumber / hasArray）
 *   - 校验失败时给出明确的字段路径，便于排查损坏数据来源
 *
 * 应用范围：
 *   - localStorage 读取后的结构校验（presalesHistory.ts）
 *   - 工作台备份恢复的 schema 校验（workbench/db.ts → restoreWorkbenchBackup）
 *   - 业绩统计导入的额外资源边界
 *   - 后续任何需要校验不可信 JSON 的入口
 *
 * 设计原则：
 *   - 零外部依赖（避免再叠加运行时 schema 库带来的依赖攻击面）
 *   - 严格：失败立即返回错误，不静默放过
 *   - 详细错误：携带字段路径，便于排查
 */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function err<T = never>(error: string): ValidationResult<T> {
  return { ok: false, error };
}

/**
 * 安全地获取嵌套字段，遇到 null/undefined 返回 undefined 而不抛错。
 * 用于 schema 校验里递归访问字段。
 */
export function pickPath(obj: unknown, path: readonly (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasString(obj: unknown, key: string): boolean {
  return isPlainObject(obj) && typeof obj[key] === 'string';
}

export function hasNumber(obj: unknown, key: string): boolean {
  return isPlainObject(obj) && typeof obj[key] === 'number' && Number.isFinite(obj[key]);
}

export function hasArray(obj: unknown, key: string): boolean {
  return isPlainObject(obj) && Array.isArray(obj[key]);
}

/**
 * 校验数组长度上限（防止恶意大数组耗尽内存）
 */
export function validateArrayLength<T>(
  arr: unknown,
  path: string,
  maxLength: number,
): ValidationResult<T[]> {
  if (!Array.isArray(arr)) return err(`${path} 必须是数组`);
  if (arr.length > maxLength) {
    return err(`${path} 数组长度 ${arr.length} 超过上限 ${maxLength}`);
  }
  return ok(arr as T[]);
}

/**
 * 校验字符串长度上限
 */
export function validateStringLength(
  value: unknown,
  path: string,
  maxLength: number,
): ValidationResult<string> {
  if (typeof value !== 'string') return err(`${path} 必须是字符串`);
  if (value.length > maxLength) {
    return err(`${path} 长度 ${value.length} 超过上限 ${maxLength}`);
  }
  return ok(value);
}

/**
 * 校验对象必需字段（所有 key 必须存在）
 */
export function requireFields(
  obj: unknown,
  fields: readonly string[],
  parentPath: string,
): ValidationResult<Record<string, unknown>> {
  if (!isPlainObject(obj)) return err(`${parentPath} 必须是对象`);
  const missing = fields.filter((key) => !(key in obj));
  if (missing.length > 0) {
    return err(`${parentPath} 缺少必需字段：${missing.join(', ')}`);
  }
  return ok(obj);
}

/**
 * 校验导入文件资源边界：解析前必跑。
 * 与 parser.ts 的硬编码常量保持一致。
 */
export const IMPORT_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  MAX_SHEETS: 20,
  MAX_ROWS: 50000,
  MAX_COLS: 200,
  MAX_CELL_LENGTH: 5000,
} as const;

/**
 * 完整校验一个 DashboardData 对象从 localStorage 读出后的结构。
 * 失败时返回具体错误信息，由调用方决定是丢弃还是回退。
 */
export function validateDashboardShape(raw: unknown): ValidationResult<unknown> {
  if (!isPlainObject(raw)) return err('localStorage 数据必须是对象');

  const okPpl = validateArrayLength(raw.ppl, 'ppl', IMPORT_LIMITS.MAX_ROWS);
  if (!okPpl.ok) return okPpl;

  const okSummary = validateArrayLength(raw.summary, 'summary', 5000);
  if (!okSummary.ok) return okSummary;

  const okActivity = validateArrayLength(raw.activity, 'activity', 5000);
  if (!okActivity.ok) return okActivity;

  const okPerformance = validateArrayLength(raw.performance, 'performance', IMPORT_LIMITS.MAX_ROWS);
  if (!okPerformance.ok) return okPerformance;

  // report 至少包含 fileName/importedAt 等基本字段
  if (!isPlainObject(raw.report)) return err('report 字段缺失或不是对象');
  if (!hasString(raw.report, 'fileName')) return err('report.fileName 缺失');
  if (!hasString(raw.report, 'importedAt')) return err('report.importedAt 缺失');

  return ok(raw);
}