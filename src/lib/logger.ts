/**
 * 统一日志层。
 *
 * 设计原则：
 *   - 在生产代码中统一通过该模块打印日志，避免直接 `console.*` 散落
 *   - dev 环境下保留 console 输出；production 下 console 仍走（保留诊断能力，但 ErrorBoundary 一次性收口）
 *   - 提供 `getErrorMessage(reason)` 替代 9+ 处 `reason instanceof Error ? reason.message : '...'`
 *   - 后续接入 Sentry / Datadog 时只需替换内部实现
 */

function detectDev(): boolean {
  if (typeof import.meta === 'undefined') return false;
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  return Boolean(env?.DEV);
}

const isDev = detectDev();

export interface Logger {
  warn: (scope: string, message: string, detail?: unknown) => void;
  error: (scope: string, message: string, detail?: unknown) => void;
  info: (scope: string, message: string, detail?: unknown) => void;
}

export const logger: Logger = {
  warn: (scope, message, detail) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(`[${scope}] ${message}`, detail ?? '');
    }
  },
  error: (scope, message, detail) => {
    // error 永远保留，用于排障
    // eslint-disable-next-line no-console
    console.error(`[${scope}] ${message}`, detail ?? '');
  },
  info: (scope, message, detail) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(`[${scope}] ${message}`, detail ?? '');
    }
  },
};

/**
 * 统一错误消息提取：替代重复的 `reason instanceof Error ? reason.message : '...'`
 */
export function getErrorMessage(reason: unknown, fallback = '未知错误'): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const m = (reason as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback;
}