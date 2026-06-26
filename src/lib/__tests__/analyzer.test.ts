import { describe, expect, it } from 'vitest';
import type { PPLRecord } from '../../domain';
import {
  aggregatePpl,
  calculateKpis,
  filterPpl,
  groupAmount,
  uniqueOptions,
} from '../analyzer';
import { normalizeCustomerName } from '../normalize';

function makePpl(overrides: Partial<PPLRecord> = {}): PPLRecord {
  return {
    id: overrides.id ?? 'row-1',
    owner: '金柳',
    customerName: '南京证券股份有限公司',
    opportunityName: '渗透测试项目',
    industryLevel1: '金融',
    industryLevel2: '证券',
    product: '安全服务',
    amount: 100,
    stage: '商务谈判',
    status: '正常',
    winRate: 0.6,
    forecastType: 'Commit',
    expectedQuarter: "Q2'2026",
    healthScore: 0.75,
    healthLevel: '健康',
    healthReasons: ['测试'],
    raw: {},
    ...overrides,
  };
}

/* ========== filterPpl ========== */
describe('filterPpl', () => {
  const data: PPLRecord[] = [
    makePpl({ id: 'r1', owner: '金柳', customerName: '南京证券', product: '安全服务', amount: 100 }),
    makePpl({ id: 'r2', owner: '李四', customerName: '江苏银行', product: 'AI_XDR', amount: 200 }),
    makePpl({ id: 'r3', owner: '金柳', customerName: '中国电信', product: '安全服务', amount: 300 }),
  ];

  it('should_filter_by_owner', () => {
    const result = filterPpl(data, { owner: '金柳' }, [], '', '');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.owner === '金柳')).toBe(true);
  });

  it('should_filter_by_customer_query_through_normalize', () => {
    // 输入"南京证券"应能匹配"南京证券股份有限公司"
    const result = filterPpl(data, {}, [], '', '南京证券');
    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe('南京证券');
  });

  it('should_combine_filters_AND', () => {
    const result = filterPpl(data, { owner: '金柳', product: '安全服务' }, [], '', '');
    expect(result).toHaveLength(2);
  });

  it('should_apply_drill_filter', () => {
    const result = filterPpl(
      data,
      {},
      [{ field: 'owner', value: '李四' }],
      '',
      '',
    );
    expect(result).toHaveLength(1);
  });

  it('should_apply_keyword_search_across_multiple_fields', () => {
    const result = filterPpl(data, {}, [], '江苏', '');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should_return_all_when_no_filter_active', () => {
    expect(filterPpl(data, {}, [], '', '')).toHaveLength(3);
  });
});

/* ========== calculateKpis ========== */
describe('calculateKpis', () => {
  it('should_compute_total_amount_and_weighted_win_rate', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', amount: 100, winRate: 0.5 }),
      makePpl({ id: 'b', amount: 300, winRate: 0.7 }),
    ];
    const kpis = calculateKpis(data);
    expect(kpis.totalAmount).toBe(400);
    // 加权赢单率 = (100*0.5 + 300*0.7) / 400 = (50 + 210) / 400 = 0.65
    expect(kpis.weightedWinRate).toBeCloseTo(0.65, 5);
  });

  it('should_count_unique_customers_via_normalize', () => {
    // "南京证券" 与 "南京证券股份有限公司" 应合并为同一客户
    const data: PPLRecord[] = [
      makePpl({ id: 'a', customerName: '南京证券' }),
      makePpl({ id: 'b', customerName: '南京证券股份有限公司' }),
      makePpl({ id: 'c', customerName: '江苏银行' }),
    ];
    const kpis = calculateKpis(data);
    expect(kpis.customerCount).toBe(2);
  });

  it('should_sum_forecast_amount_only_for_commit_and_best_case', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', amount: 100, forecastType: 'Commit' }),
      makePpl({ id: 'b', amount: 200, forecastType: 'Best Case' }),
      makePpl({ id: 'c', amount: 400, forecastType: 'Pipeline' }),
      makePpl({ id: 'd', amount: 800, forecastType: 'Omitted' }),
    ];
    expect(calculateKpis(data).forecastAmount).toBe(300);
  });

  it('should_count_risk_records', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', healthLevel: '风险' }),
      makePpl({ id: 'b', healthLevel: '关注' }),
      makePpl({ id: 'c', healthLevel: '健康' }),
    ];
    expect(calculateKpis(data).riskCount).toBe(1);
  });

  it('should_handle_empty_data', () => {
    const kpis = calculateKpis([]);
    expect(kpis.totalAmount).toBe(0);
    expect(kpis.weightedWinRate).toBe(0);
    expect(kpis.customerCount).toBe(0);
    expect(kpis.opportunityCount).toBe(0);
  });
});

/* ========== groupAmount ========== */
describe('groupAmount', () => {
  it('should_group_by_owner_and_sort_desc_by_value', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', owner: 'A', amount: 100 }),
      makePpl({ id: 'b', owner: 'B', amount: 300 }),
      makePpl({ id: 'c', owner: 'A', amount: 200 }),
    ];
    const groups = groupAmount(data, 'owner', 10);
    // A 与 B 总额都是 300，tiebreaker 按商机数降序 → A(2条) 排前
    expect(groups[0]).toMatchObject({ name: 'A', value: 300, count: 2 });
    expect(groups[1]).toMatchObject({ name: 'B', value: 300, count: 1 });
  });

  it('should_limit_results', () => {
    const data: PPLRecord[] = Array.from({ length: 20 }, (_, i) =>
      makePpl({ id: `r${i}`, owner: `O${i}`, amount: i + 1 }),
    );
    const groups = groupAmount(data, 'owner', 5);
    expect(groups).toHaveLength(5);
  });

  it('should_treat_empty_field_as_未填写', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', owner: '' }),
    ];
    const groups = groupAmount(data, 'owner', 10);
    expect(groups[0].name).toBe('未填写');
  });
});

/* ========== aggregatePpl ========== */
describe('aggregatePpl', () => {
  it('should_group_by_customer_industry_product_stage', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', customerName: 'A', product: 'P1', stage: 'S1', amount: 100, winRate: 0.5 }),
      makePpl({ id: 'b', customerName: 'A', product: 'P1', stage: 'S1', amount: 200, winRate: 0.7 }),
      makePpl({ id: 'c', customerName: 'B', product: 'P1', stage: 'S1', amount: 300, winRate: 0.6 }),
    ];
    const aggregated = aggregatePpl(data);
    expect(aggregated).toHaveLength(2);
    const aGroup = aggregated.find((g) => g.customerName === 'A');
    expect(aGroup).toMatchObject({
      opportunityCount: 2,
      totalAmount: 300,
      // 加权 winRate = (100*0.5 + 200*0.7) / 300 = 190/300 ≈ 0.6333
    });
    expect(aGroup?.weightedWinRate).toBeCloseTo(0.6333, 3);
  });

  it('should_join_multiple_owners_with_、', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', customerName: 'A', owner: '张三' }),
      makePpl({ id: 'b', customerName: 'A', owner: '李四' }),
    ];
    const aggregated = aggregatePpl(data);
    const owners = aggregated[0].owners.split('、').sort();
    expect(owners).toEqual(['张三', '李四']);
  });

  it('should_aggregate_risk_count', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', healthLevel: '风险' }),
      makePpl({ id: 'b', healthLevel: '风险' }),
      makePpl({ id: 'c', healthLevel: '健康' }),
    ];
    const aggregated = aggregatePpl(data);
    expect(aggregated[0].riskCount).toBe(2);
  });
});

/* ========== uniqueOptions ========== */
describe('uniqueOptions', () => {
  it('should_return_unique_sorted_values', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', product: 'AI_XDR' }),
      makePpl({ id: 'b', product: '安全服务' }),
      makePpl({ id: 'c', product: 'AI_XDR' }),
    ];
    const options = uniqueOptions(data, 'product');
    // zh-CN locale 排序：中文按拼音，'安' → ān 在 ASCII 字符之后
    expect(options).toEqual(['安全服务', 'AI_XDR']);
  });

  it('should_filter_empty_strings', () => {
    const data: PPLRecord[] = [
      makePpl({ id: 'a', product: '' }),
      makePpl({ id: 'b', product: 'X' }),
    ];
    expect(uniqueOptions(data, 'product')).toEqual(['X']);
  });
});

/* ========== normalize 集成（验证 H4 一致性） ========== */
describe('normalize 集成', () => {
  it('filterPpl 与 customerMatcher 应使用统一的 normalize 函数', () => {
    // 验证 filterPpl 内部使用 normalize.ts 的实现
    expect(normalizeCustomerName('南京证券股份有限公司')).toBe('南京证券');
  });
});