import type { PPLRecord } from '../domain';
import { normalizeCustomerName } from './normalize';

export type CustomerMatchType = '精确匹配' | '别名匹配' | '模糊匹配' | '未匹配';

export interface CustomerMatchResult {
  inputName: string;
  normalizedInput: string;
  matchedCustomerName: string;
  matchType: CustomerMatchType;
  confidence: number;
  matched: boolean;
}

/**
 * 内置客户别名表（覆盖江苏省办常见重点客户）。
 * Key 是规范化的简称，Value 是 PPL 中可能出现的全称列表。
 *
 * 用途：当用户在重点客户输入框中输入简称时，自动尝试匹配全称。
 * 新增别名时按"最常用简称 → 全称列表"的格式追加即可。
 *
 * 维护策略：
 *   - 央企/省属国企优先收录
 *   - 江苏省办近期重点跟进客户优先
 *   - 出现"未匹配"时补录对应的全称
 */
export const CUSTOMER_ALIASES: Record<string, string[]> = {
  // === 金融 ===
  南京证券: ['南京证券股份有限公司'],
  江苏银行: ['江苏银行股份有限公司'],
  紫金农商行: ['江苏紫金农村商业银行股份有限公司'],
  紫金银行: ['江苏紫金农村商业银行股份有限公司'],
  南京银行: ['南京银行股份有限公司'],
  苏宁银行: ['江苏苏宁银行股份有限公司'],
  苏州银行: ['苏州银行股份有限公司'],
  江苏国信: ['江苏省国信集团有限公司'],

  // === 央企/省属国企 ===
  中国电信: ['中国电信股份有限公司', '中国电信集团有限公司'],
  中国移动: ['中国移动通信集团有限公司', '中国移动通信集团江苏有限公司'],
  中国联通: ['中国联合网络通信集团有限公司'],
  国家电网: ['国家电网有限公司', '国网江苏省电力有限公司'],
  国家能源: ['国家能源投资集团有限责任公司'],
  中国石化: ['中国石油化工集团有限公司', '中国石化销售有限公司江苏石油分公司'],
  中国石油: ['中国石油天然气集团有限公司'],
  中国中车: ['中国中车股份有限公司'],
  中信集团: ['中国中信集团有限公司'],
  中国电子: ['中国电子信息产业集团有限公司'],
  中国电科: ['中国电子科技集团有限公司'],
  中国航信: ['中国民航信息集团有限公司'],

  // === 江苏省国资委直属 ===
  江苏国信集团: ['江苏省国信集团有限公司'],
  江苏交通控股: ['江苏交通控股有限公司'],
  江苏沿海开发: ['江苏沿海开发集团有限公司'],
  江苏农垦: ['江苏省农垦集团有限公司', '江苏省农垦集团'],
  苏豪控股: ['江苏苏豪控股集团有限公司'],

  // === 南京市属国企 ===
  南京新工投资: ['南京新工投资集团有限责任公司', '南京新工投资集团'],
  南京地铁: ['南京地铁集团有限公司'],
  南京城建: ['南京城市建设投资控股（集团）有限责任公司'],

  // === 苏州市/无锡市/常州市 ===
  苏州轨交: ['苏州轨道交通集团有限公司', '苏州市轨道交通集团有限公司'],
  苏州国发: ['苏州国际发展集团有限公司'],
  无锡国联: ['无锡市国联发展（集团）有限公司'],

  // === 其他常见客户 ===
  华为: ['华为技术有限公司', '华为投资控股有限公司'],
  阿里: ['阿里巴巴（中国）有限公司', '阿里云计算有限公司'],
  腾讯: ['腾讯云计算（北京）有限责任公司', '深圳市腾讯计算机系统有限公司'],
  字节跳动: ['字节跳动有限公司'],
};

interface CustomerCandidate {
  customerName: string;
  normalizedName: string;
  totalAmount: number;
}

/** 匹配置信度档位 */
const CONFIDENCE = {
  exact: 1,
  alias: 0.95,
  fuzzy: 0.75,
} as const;

export function matchCustomers(inputNames: string[], pplRecords: PPLRecord[]): CustomerMatchResult[] {
  const candidates = buildCandidates(pplRecords);
  return inputNames.map((inputName) => matchOne(inputName, candidates));
}

function buildCandidates(records: PPLRecord[]) {
  const map = new Map<string, CustomerCandidate>();
  records.forEach((record) => {
    const customerName = record.customerName;
    const current = map.get(customerName) ?? {
      customerName,
      normalizedName: normalizeCustomerName(customerName),
      totalAmount: 0,
    };
    current.totalAmount += record.amount;
    map.set(customerName, current);
  });
  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function matchOne(inputName: string, candidates: CustomerCandidate[]): CustomerMatchResult {
  const normalizedInput = normalizeCustomerName(inputName);

  // 1. 精确匹配：归一化后完全相等
  const exact = candidates.find((candidate) => candidate.normalizedName === normalizedInput);
  if (exact) return result(inputName, normalizedInput, exact.customerName, '精确匹配', CONFIDENCE.exact);

  // 2. 别名匹配：先尝试直接命中别名表，再尝试归一化命中
  const aliasNames = CUSTOMER_ALIASES[inputName] ?? CUSTOMER_ALIASES[normalizedInput] ?? [];
  const normalizedAliases = aliasNames.map(normalizeCustomerName);
  const alias = candidates.find((candidate) => normalizedAliases.includes(candidate.normalizedName));
  if (alias) return result(inputName, normalizedInput, alias.customerName, '别名匹配', CONFIDENCE.alias);

  // 3. 模糊匹配：归一化后双向包含
  const fuzzy = candidates.find((candidate) => {
    if (!normalizedInput || !candidate.normalizedName) return false;
    return candidate.normalizedName.includes(normalizedInput) || normalizedInput.includes(candidate.normalizedName);
  });
  if (fuzzy) return result(inputName, normalizedInput, fuzzy.customerName, '模糊匹配', CONFIDENCE.fuzzy);

  return {
    inputName,
    normalizedInput,
    matchedCustomerName: '',
    matchType: '未匹配',
    confidence: 0,
    matched: false,
  };
}

function result(inputName: string, normalizedInput: string, matchedCustomerName: string, matchType: CustomerMatchType, confidence: number): CustomerMatchResult {
  return {
    inputName,
    normalizedInput,
    matchedCustomerName,
    matchType,
    confidence,
    matched: true,
  };
}