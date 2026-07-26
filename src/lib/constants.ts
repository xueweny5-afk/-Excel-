/**
 * 项目级稳定常量引用。
 * 主要是数组的"空引用"——避免组件内 `const EMPTY: never[] = []` 重复定义，
 * 也保证 useMemo 依赖比较时不会因每次新 `[]` 而失效。
 */
import type { ActivityRecord, PPLRecord } from '../domain';

export const EMPTY_PPL: PPLRecord[] = [];
export const EMPTY_ACTIVITY: ActivityRecord[] = [];

/** 展示上限（业绩统计视图） */
export const MAX_TABLE_ROWS = 50;
export const MAX_DETAIL_ROWS = 300;
export const MAX_BAR_RANK = 12;

/** 售前驾驶舱客户/人员名称归一化匹配时，多 token 输入的分隔符 */
export const TOKEN_SPLIT_REGEX = /[\s,，；;、\n\r]+/;