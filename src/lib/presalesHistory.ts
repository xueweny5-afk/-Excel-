import type { DashboardData } from '../domain';
import { getErrorMessage, logger } from './logger';
import { validateDashboardShape } from './schemaValidation';

const STORAGE_KEY = 'sales-dashboard:presales-latest-data';
/** localStorage 典型限制 5MB，留余量给 JSON 序列化开销 */
const MAX_STORAGE_SIZE = 4.5 * 1024 * 1024;

export function readLatestPresalesData(): DashboardData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // schema 校验：合法 JSON 但结构损坏的对象（被同源脚本篡改、版本升级破坏）会被丢弃
    const validation = validateDashboardShape(parsed);
    if (!validation.ok) {
      logger.error('PresalesHistory', 'Stored data failed schema validation', validation.error);
      // 删除坏数据，避免下次启动再次失败
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return null;
    }
    return validation.value as DashboardData;
  } catch (err) {
    logger.error('PresalesHistory', `Failed to read from localStorage: ${getErrorMessage(err)}`);
    return null;
  }
}

export function saveLatestPresalesData(data: DashboardData): { success: boolean; warning?: string } {
  if (typeof window === 'undefined') return { success: false };
  try {
    // 先快速估算体积，避免对超大对象做无意义的 JSON.stringify（CPU + 内存）
    const estimated = approxJsonSize(data);
    if (estimated > MAX_STORAGE_SIZE) {
      logger.warn('PresalesHistory', `Approx size ${(estimated / 1024 / 1024).toFixed(2)}MB exceeds safe limit`);
      return {
        success: false,
        warning: `数据过大（约 ${(estimated / 1024 / 1024).toFixed(2)}MB），超过浏览器存储限制，周对比功能已跳过。`,
      };
    }
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_STORAGE_SIZE) {
      // 估算和实际序列化结果相差较大（很罕见），再次拦截
      logger.warn('PresalesHistory', `Serialized size ${(serialized.length / 1024 / 1024).toFixed(2)}MB exceeds safe limit`);
      return {
        success: false,
        warning: `数据过大（${(serialized.length / 1024 / 1024).toFixed(2)}MB），超过浏览器存储限制，周对比功能已跳过。`,
      };
    }
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return { success: true };
  } catch (err) {
    logger.error('PresalesHistory', `Failed to save to localStorage: ${getErrorMessage(err)}`);
    return {
      success: false,
      warning: '存储空间不足或被其他应用占用，周对比功能已跳过。',
    };
  }
}

/**
 * 快速估算一个对象 JSON 序列化后的字节数（上限启发式，避免全量 stringify）。
 *
 * 估算方式：DFS 累加 key、字符串、数字、布尔值等叶子节点的字节数。
 * - 字符串：实际 UTF-16 长度（中文按 2 字节算，接近 localStorage 实际占用）
 * - 数字：最长 20 字节
 * - null/true/false：4/4/5 字节
 * - 数组/对象：递归 + 花括号/中括号 2 字节
 *
 * 该函数故意只走一遍，避免 O(N) 字符串拼接。误差通常 < 5%，足以判断是否
 * 超 4.5MB 阈值。真正写盘前还会再 JSON.stringify 一次精确校验。
 */
function approxJsonSize(value: unknown, depth = 0, limit = 8): number {
  if (value === null) return 4;
  if (value === undefined) return 0;
  if (typeof value === 'string') return value.length * 2; // UTF-16
  if (typeof value === 'number') return 20;
  if (typeof value === 'boolean') return value ? 4 : 5;
  if (Array.isArray(value)) {
    if (depth > limit) return 12;
    let size = 2; // [ ]
    for (const item of value) {
      size += approxJsonSize(item, depth + 1, limit) + 1; // +1 for comma
    }
    return size;
  }
  if (typeof value === 'object') {
    if (depth > limit) return 16;
    let size = 2; // { }
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      size += key.length * 2 + 4; // key + '"":'
      size += approxJsonSize(obj[key], depth + 1, limit) + 1; // +1 for comma
    }
    return size;
  }
  return 0;
}