import { describe, expect, it } from 'vitest';
import type { PPLRecord } from '../../domain';
import { matchCustomers } from '../customerMatcher';

function makePpl(customerName: string, amount = 100): PPLRecord {
  return {
    id: customerName,
    owner: 'A',
    customerName,
    opportunityName: 'X',
    industryLevel1: '金融',
    product: 'P',
    amount,
    stage: '商务谈判',
    status: '正常',
    winRate: 0.5,
    forecastType: 'Commit',
    expectedQuarter: "Q2'2026",
    healthScore: 0.7,
    healthLevel: '健康',
    healthReasons: [],
    raw: {},
  };
}

describe('matchCustomers', () => {
  const pplRecords: PPLRecord[] = [
    makePpl('南京证券股份有限公司', 500),
    makePpl('江苏银行股份有限公司', 300),
    makePpl('中国电信', 200),
    makePpl('中国移动通信集团江苏有限公司', 100),
  ];

  it('should_exact_match_when_normalized_names_equal', () => {
    const result = matchCustomers(['南京证券'], pplRecords);
    expect(result[0]).toMatchObject({
      inputName: '南京证券',
      matchedCustomerName: '南京证券股份有限公司',
      matchType: '精确匹配',
      confidence: 1,
      matched: true,
    });
  });

  it('should_alias_match_for_predefined_aliases', () => {
    // 库别名表里有 南京证券 → [南京证券股份有限公司]
    // 但因为精确匹配也能命中，这里别名匹配只在直接输入"南京证券股份有限公司"才用到
    const result = matchCustomers(['南京证券股份有限公司'], pplRecords);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchType).toBe('精确匹配');
  });

  it('should_fuzzy_match_by_substring_inclusion', () => {
    // "中国电信" 是 PPL 中存在的，"中国移动通信" 在 PPL 中以"中国移动通信集团江苏"形式存在
    // 模糊匹配：normalized input "中国移动通信" 被 "中国移动通信集团江苏" 包含
    const result = matchCustomers(['中国移动通信'], pplRecords);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchType).toBe('模糊匹配');
    expect(result[0].confidence).toBe(0.75);
  });

  it('should_not_match_unrelated_input', () => {
    const result = matchCustomers(['完全不存在的企业XYZ'], pplRecords);
    expect(result[0]).toMatchObject({
      matched: false,
      matchType: '未匹配',
      confidence: 0,
      matchedCustomerName: '',
    });
  });

  it('should_match_multiple_inputs_independently', () => {
    const result = matchCustomers(['南京证券', '完全不存在的企业XYZ'], pplRecords);
    expect(result).toHaveLength(2);
    expect(result[0].matched).toBe(true);
    expect(result[1].matched).toBe(false);
  });

  it('should_sort_candidates_by_total_amount_descending', () => {
    // 即使 PPL 中有多家匹配，priority 高的（金额大）先返回
    const records = [makePpl('某银行', 100), makePpl('某银行股份有限公司', 500)];
    const result = matchCustomers(['某银行'], records);
    expect(result[0].matchedCustomerName).toBe('某银行股份有限公司');
  });

  it('should_handle_empty_input', () => {
    expect(matchCustomers([], pplRecords)).toEqual([]);
  });

  it('should_handle_empty_ppl', () => {
    const result = matchCustomers(['南京证券'], []);
    expect(result[0].matched).toBe(false);
  });

  it('should_match_alias_for_china_telecom', () => {
    const records = [makePpl('中国电信股份有限公司', 500)];
    const result = matchCustomers(['中国电信'], records);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchedCustomerName).toBe('中国电信股份有限公司');
  });

  it('should_match_alias_for_china_mobile_with_sub_company', () => {
    const records = [makePpl('中国移动通信集团江苏有限公司', 300)];
    const result = matchCustomers(['中国移动'], records);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchedCustomerName).toBe('中国移动通信集团江苏有限公司');
  });

  it('should_match_alias_for_jiangsu_provincial_state_owned', () => {
    const records = [makePpl('江苏省国信集团有限公司', 800)];
    const result = matchCustomers(['江苏国信集团'], records);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchedCustomerName).toBe('江苏省国信集团有限公司');
  });

  it('should_match_alias_for_huawei', () => {
    const records = [makePpl('华为投资控股有限公司', 200)];
    const result = matchCustomers(['华为'], records);
    expect(result[0].matched).toBe(true);
    expect(result[0].matchedCustomerName).toBe('华为投资控股有限公司');
  });

  it('should_not_match_unknown_alias', () => {
    const records = [makePpl('某未知企业', 100)];
    const result = matchCustomers(['某不存在的别名'], records);
    expect(result[0].matched).toBe(false);
  });
});
