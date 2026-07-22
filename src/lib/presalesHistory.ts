import type { DashboardData } from '../domain';

const STORAGE_KEY = 'sales-dashboard:presales-latest-data';
/** localStorage 典型限制 5MB，留余量给 JSON 序列化开销 */
const MAX_STORAGE_SIZE = 4.5 * 1024 * 1024;

export function readLatestPresalesData(): DashboardData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DashboardData) : null;
  } catch (err) {
    console.error('[PresalesHistory] Failed to read from localStorage:', err);
    return null;
  }
}

export function saveLatestPresalesData(data: DashboardData): { success: boolean; warning?: string } {
  if (typeof window === 'undefined') return { success: false };
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_STORAGE_SIZE) {
      console.warn(`[PresalesHistory] Data size (${(serialized.length / 1024 / 1024).toFixed(2)}MB) exceeds safe storage limit (${MAX_STORAGE_SIZE / 1024 / 1024}MB). Skipping localStorage save.`);
      return {
        success: false,
        warning: `数据过大（${(serialized.length / 1024 / 1024).toFixed(2)}MB），超过浏览器存储限制，周对比功能已跳过。`,
      };
    }
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return { success: true };
  } catch (err) {
    console.error('[PresalesHistory] Failed to save to localStorage:', err);
    return {
      success: false,
      warning: '存储空间不足或被其他应用占用，周对比功能已跳过。',
    };
  }
}
