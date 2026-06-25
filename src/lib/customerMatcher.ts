import type { PPLRecord } from '../domain';

export type CustomerMatchType = '精确匹配' | '别名匹配' | '模糊匹配' | '未匹配';

export interface CustomerMatchResult {
  inputName: string;
  normalizedInput: string;
  matchedCustomerName: string;
  matchType: CustomerMatchType;
  confidence: number;
  matched: boolean;
}

export const CUSTOMER_ALIASES: Record<string, string[]> = {
  南京证券: ['南京证券股份有限公司'],
  江苏银行: ['江苏银行股份有限公司'],
};

interface CustomerCandidate {
  customerName: string;
  normalizedName: string;
  totalAmount: number;
}

const COMPANY_SUFFIXES = [
  '股份有限公司',
  '有限责任公司',
  '有限公司',
  '集团股份',
  '控股集团',
  '集团',
  '总部',
  '总公司',
  '分公司',
  '公司',
];

export function normalizeCustomerName(name: string) {
  let normalized = name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()[\]【】{}]/g, '')
    .replace(/[，,。.;；、·\-_/\\]/g, '');

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
  const exact = candidates.find((candidate) => candidate.normalizedName === normalizedInput);
  if (exact) return result(inputName, normalizedInput, exact.customerName, '精确匹配', 1);

  const aliasNames = CUSTOMER_ALIASES[inputName] ?? CUSTOMER_ALIASES[normalizedInput] ?? [];
  const normalizedAliases = aliasNames.map(normalizeCustomerName);
  const alias = candidates.find((candidate) => normalizedAliases.includes(candidate.normalizedName));
  if (alias) return result(inputName, normalizedInput, alias.customerName, '别名匹配', 0.95);

  const fuzzy = candidates.find((candidate) => {
    if (!normalizedInput || !candidate.normalizedName) return false;
    return candidate.normalizedName.includes(normalizedInput) || normalizedInput.includes(candidate.normalizedName);
  });
  if (fuzzy) return result(inputName, normalizedInput, fuzzy.customerName, '模糊匹配', 0.75);

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
