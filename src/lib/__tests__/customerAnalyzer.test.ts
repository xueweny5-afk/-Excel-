import { describe, expect, it } from 'vitest';
import type { ActivityRecord, PPLRecord } from '../../domain';
import { analyzeKeyCustomers } from '../customerAnalyzer';

function makePpl(overrides: Partial<PPLRecord> = {}): PPLRecord {
  return {
    id: 'r1',
    owner: '金柳',
    customerName: '南京证券股份有限公司',
    opportunityName: 'X',
    industryLevel1: '金融',
    product: 'AI_XDR',
    amount: 100,
    stage: '商务谈判',
    status: '正常',
    winRate: 0.6,
    forecastType: 'Commit',
    expectedQuarter: "Q2'2026",
    healthScore: 0.7,
    healthLevel: '健康',
    healthReasons: [],
    raw: {},
    ...overrides,
  };
}

const emptyActivity: ActivityRecord[] = [];

describe('analyzeKeyCustomers', () => {
  it('should_return_empty_when_no_input', () => {
    const ppl: PPLRecord[] = [makePpl()];
    const result = analyzeKeyCustomers('', ppl, emptyActivity);
    expect(result.inputNames).toEqual([]);
    expect(result.matchedPplRows).toHaveLength(0);
    expect(result.kpis.matchedCustomerCount).toBe(0);
  });

  it('should_parse_multi_line_input', () => {
    const ppl: PPLRecord[] = [makePpl()];
    const result = analyzeKeyCustomers('南京证券\n江苏银行\n华为', ppl, emptyActivity);
    expect(result.inputNames).toEqual(['南京证券', '江苏银行', '华为']);
  });

  it('should_deduplicate_input_names', () => {
    const ppl: PPLRecord[] = [makePpl()];
    const result = analyzeKeyCustomers('南京证券\n南京证券\n江苏银行', ppl, emptyActivity);
    expect(result.inputNames).toEqual(['南京证券', '江苏银行']);
  });

  it('should_split_by_various_separators', () => {
    const ppl: PPLRecord[] = [makePpl()];
    const result = analyzeKeyCustomers('南京证券，江苏银行；华为、阿里', ppl, emptyActivity);
    expect(result.inputNames).toEqual(['南京证券', '江苏银行', '华为', '阿里']);
  });

  it('should_calculate_kpis_for_matched_customers', () => {
    const ppl: PPLRecord[] = [
      makePpl({ id: 'a', amount: 100, winRate: 0.5, forecastType: 'Commit', healthLevel: '健康' }),
      makePpl({ id: 'b', amount: 200, winRate: 0.7, forecastType: 'Commit', healthLevel: '风险' }),
    ];
    const result = analyzeKeyCustomers('南京证券', ppl, emptyActivity);
    expect(result.kpis.opportunityCount).toBe(2);
    expect(result.kpis.totalAmount).toBe(300);
    expect(result.kpis.forecastAmount).toBe(300);
    expect(result.kpis.riskCount).toBe(1);
    // 加权 winRate = (100*0.5 + 200*0.7) / 300 = 190/300 ≈ 0.633
    expect(result.kpis.weightedWinRate).toBeCloseTo(0.6333, 3);
  });

  it('should_collect_unmatched_inputs', () => {
    const ppl: PPLRecord[] = [makePpl({ customerName: '南京证券股份有限公司' })];
    const result = analyzeKeyCustomers('南京证券\n完全不存在的企业', ppl, emptyActivity);
    expect(result.unmatchedInputs).toEqual(['完全不存在的企业']);
  });

  it('should_aggregate_chart_data_for_matched_customers', () => {
    const ppl: PPLRecord[] = [
      makePpl({ id: 'a', customerName: '南京证券股份有限公司', amount: 200 }),
      makePpl({ id: 'b', customerName: '南京证券股份有限公司', amount: 300, product: '安全服务' }),
    ];
    const result = analyzeKeyCustomers('南京证券', ppl, emptyActivity);
    expect(result.chartData.customerAmountRank).toHaveLength(1);
    expect(result.chartData.customerAmountRank[0].value).toBe(500);
    expect(result.chartData.productAmount).toHaveLength(2);
  });

  it('should_rank_customers_by_amount_desc', () => {
    const ppl: PPLRecord[] = [
      makePpl({ id: 'a', customerName: 'A银行', amount: 100 }),
      makePpl({ id: 'b', customerName: 'B银行', amount: 500 }),
    ];
    const result = analyzeKeyCustomers('A银行\nB银行', ppl, emptyActivity);
    expect(result.chartData.customerAmountRank[0].name).toBe('B银行');
    expect(result.chartData.customerAmountRank[1].name).toBe('A银行');
  });

  it('should_provide_activity_note', () => {
    const result = analyzeKeyCustomers('南京证券', [], emptyActivity);
    expect(result.kpis.activityCount).toBeNull();
    expect(result.kpis.activityNote).toContain('客户维度');
  });
});
