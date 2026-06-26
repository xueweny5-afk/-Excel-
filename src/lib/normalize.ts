/**
 * 客户名称规范化
 *
 * 用于搜索、匹配、聚合等场景，确保同一客户在不同数据源下能正确识别。
 * 设计原则：
 *   - 小写归一
 *   - 去除空白与常见标点
 *   - 递归去除企业后缀
 */

const COMPANY_SUFFIXES = [
  '股份有限公司',
  '有限责任公司',
  '控股有限公司',
  '有限公司',
  '集团股份',
  '控股集团',
  '控股',
  '集团',
  '总部',
  '总公司',
  '分公司',
  '公司',
] as const;

const PUNCTUATION_REGEX = /[（）()[\]【】{}]/g;
const SEPARATOR_REGEX = /[，,。.;；、·\-_/\\]/g;

export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  let normalized = name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(PUNCTUATION_REGEX, '')
    .replace(SEPARATOR_REGEX, '');

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      if (normalized.endsWith(suffix.toLowerCase())) {
        normalized = normalized.slice(0, -suffix.length);
        changed = true;
      }
    }
  }

  return normalized;
}

/** 比较两个客户名是否等价（忽略大小写、空白、后缀） */
export function isSameCustomer(a: string, b: string): boolean {
  return normalizeCustomerName(a) === normalizeCustomerName(b);
}
