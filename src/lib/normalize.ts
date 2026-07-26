/**
 * 归一化工具家族：客户名 / owner / 输入 token。
 *
 * 设计原则：
 *   - 单一来源：本文件是项目内所有字符串归一化的唯一入口
 *   - 不同函数语义明确（`normalizeCustomerName` 去除企业后缀，`normalizeBusinessKey` 只去空白）
 *   - 各 stats 文件统一 import，避免在 lib 多处复制粘贴
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

/**
 * 客户名称规范化：去空白 + 去标点 + 去企业后缀。
 * 用于客户搜索/匹配场景（识别同一客户的不同写法）。
 */
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

/**
 * 业务主键归一化：仅去空白，不做语义清洗（不去企业后缀）。
 * 用于聚合主键（PPL owner / customer）的等价匹配。
 */
export function normalizeBusinessKey(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').trim();
}

/**
 * 把多 token 输入字符串解析为 token 数组。
 * 分隔符：空白、中文逗号、英文逗号、中文分号、英文分号、顿号、换行。
 */
const TOKEN_SPLIT_REGEX = /[\s,，；;、\n\r]+/;
export function parseTokens(input: string): string[] {
  if (!input) return [];
  return input
    .split(TOKEN_SPLIT_REGEX)
    .map((token) => token.trim())
    .filter(Boolean);
}