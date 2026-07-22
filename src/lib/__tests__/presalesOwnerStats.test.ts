import { describe, expect, it } from 'vitest';
import type { DashboardData, PerformanceRecord, PPLRecord } from '../../domain';
import {
  buildPresalesOwnerStats,
  exportOwnerStatsCsv,
  filterOwnerStats,
  summarizeStats,
} from '../presalesOwnerStats';

function makePpl(overrides: Partial<PPLRecord>): PPLRecord {
  return {
    id: overrides.id ?? 'r1',
    owner: '张磊',
    customerName: '客户A',
    opportunityName: '商机A',
    industryLevel1: '金融',
    product: 'DS',
    amount: 100,
    stage: '需求确认',
    status: '推进中',
    winRate: 0.5,
    forecastType: 'Pipeline',
    expectedQuarter: "Q1'2026",
    healthScore: 0.5,
    healthLevel: '关注',
    healthReasons: [],
    raw: {},
    ...overrides,
  };
}

function makePerformance(overrides: Partial<PerformanceRecord>): PerformanceRecord {
  return {
    customerName: '客户A',
    productName: 'DS V20',
    productLevel2: '',
    productLevel3: '',
    orderAmount: 0,
    contractAmount: 0,
    salesGrossProfit: 0,
    performanceGrossProfit: 0,
    finalPerformance: 0,
    isT2000: false,
    raw: {},
    ...overrides,
  };
}

function makeData(ppl: PPLRecord[], performance: PerformanceRecord[] = []): DashboardData {
  return {
    ppl,
    summary: [],
    activity: [],
    performance,
    report: {
      fileName: 'test.xlsx',
      importedAt: '2026-07-01',
      pplRows: ppl.length,
      summaryRows: 0,
      activityRows: 0,
      performanceRows: performance.length,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}

describe('buildPresalesOwnerStats (by customer)', () => {
  it('should_aggregate_performance_records_by_customer', () => {
    const data = makeData(
      // 同客户多条 PPL
      [
        makePpl({ id: 'r1', customerName: '客户A', amount: 100 }),
        makePpl({ id: 'r2', customerName: '客户A', amount: 50 }),
      ],
      // 同客户多条业绩
      [
        makePerformance({ customerName: '客户A', orderAmount: 80, salesGrossProfit: 20 }),
        makePerformance({ customerName: '客户A', orderAmount: 30, performanceGrossProfit: 10 }),
      ],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('客户A');
    expect(stats[0]?.performanceCount).toBe(2);
    expect(stats[0]?.opportunityCount).toBe(2);
    expect(stats[0]?.orderAmount).toBe(110);
    // 两条业绩分别贡献毛利：第一条 salesGrossProfit=20，第二条回退到 performanceGrossProfit=10
    expect(stats[0]?.grossProfit).toBe(30);
  });

  it('should_keep_customer_with_only_ppl_no_performance', () => {
    const data = makeData(
      [makePpl({ id: 'r1', customerName: '客户A', amount: 100 })],
      [],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('客户A');
    expect(stats[0]?.opportunityCount).toBe(1);
    expect(stats[0]?.orderAmount).toBe(0);
    expect(stats[0]?.grossProfit).toBe(0);
  });

  it('should_keep_customer_with_only_performance_no_ppl', () => {
    const data = makeData(
      [],
      [makePerformance({ customerName: '客户B', orderAmount: 80, salesGrossProfit: 20 })],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('客户B');
    expect(stats[0]?.opportunityCount).toBe(0);
    expect(stats[0]?.performanceCount).toBe(1);
    expect(stats[0]?.orderAmount).toBe(80);
  });

  it('should_separate_forecast_amount_from_pipeline', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: '客户A', amount: 100, forecastType: 'Commit' }),
        makePpl({ id: 'r2', customerName: '客户A', amount: 50, forecastType: 'Pipeline' }),
        makePpl({ id: 'r3', customerName: '客户A', amount: 30, forecastType: 'Best Case' }),
        makePpl({ id: 'r4', customerName: '客户A', amount: 20, forecastType: 'Omitted' }),
      ],
      [],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats[0]?.pipelineAmount).toBe(200);
    expect(stats[0]?.forecastAmount).toBe(130);
  });

  it('should_mark_t2000_from_performance_or_ppl_tag', () => {
    const data = makeData(
      [
        // 客户A 通过 t2000CustomerTag 标记
        makePpl({ id: 'r1', customerName: '客户A', amount: 100, t2000CustomerTag: 'T2000客户' }),
        // 客户B 通过业绩 isT2000 标记
      ],
      [makePerformance({ customerName: '客户B', orderAmount: 50, isT2000: true })],
    );
    const stats = buildPresalesOwnerStats(data);
    const a = stats.find((s) => s.customer === '客户A');
    const b = stats.find((s) => s.customer === '客户B');
    expect(a?.isT2000).toBe(true);
    expect(b?.isT2000).toBe(true);
  });

  it('should_sort_by_order_amount_then_pipeline_amount', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: '甲', amount: 10 }),
        makePpl({ id: 'r2', customerName: '乙', amount: 100 }),
      ],
      [
        makePerformance({ customerName: '乙', orderAmount: 50 }),
        makePerformance({ customerName: '甲', orderAmount: 0 }),
      ],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats.map((s) => s.customer)).toEqual(['乙', '甲']);
  });

  it('should_ignore_blank_customer_rows', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: '', amount: 100 }),
        makePpl({ id: 'r2', customerName: '   ', amount: 50 }),
        makePpl({ id: 'r3', customerName: '客户A', amount: 30 }),
      ],
      [
        makePerformance({ customerName: '', orderAmount: 80 }),
        makePerformance({ customerName: '客户B', orderAmount: 40 }),
      ],
    );
    const stats = buildPresalesOwnerStats(data);
    expect(stats.map((s) => s.customer).sort()).toEqual(['客户A', '客户B']);
  });
});

describe('filterOwnerStats (by customer)', () => {
  const sample = [
    { customer: '南京证券', normalizedCustomer: '南京证券', isT2000: true, performanceCount: 1, opportunityCount: 1, pipelineAmount: 100, forecastAmount: 0, orderAmount: 50, grossProfit: 20 },
    { customer: '南京地铁集团', normalizedCustomer: '南京地铁集团', isT2000: false, performanceCount: 1, opportunityCount: 2, pipelineAmount: 200, forecastAmount: 0, orderAmount: 80, grossProfit: 30 },
    { customer: '苏州工业园', normalizedCustomer: '苏州工业园', isT2000: false, performanceCount: 0, opportunityCount: 3, pipelineAmount: 300, forecastAmount: 0, orderAmount: 0, grossProfit: 0 },
  ];

  it('should_return_all_when_input_empty', () => {
    expect(filterOwnerStats(sample, '').length).toBe(3);
    expect(filterOwnerStats(sample, '   ').length).toBe(3);
  });

  it('should_match_single_token_fuzzy', () => {
    expect(filterOwnerStats(sample, '南京证券').map((s) => s.customer)).toEqual(['南京证券']);
    // "南京" 模糊匹配 "南京证券" 和 "南京地铁集团"
    expect(filterOwnerStats(sample, '南京').map((s) => s.customer).sort()).toEqual(['南京地铁集团', '南京证券']);
  });

  it('should_support_multiple_tokens', () => {
    const result = filterOwnerStats(sample, '南京证券, 苏州');
    expect(result.map((s) => s.customer).sort()).toEqual(['南京证券', '苏州工业园']);
  });

  it('should_support_whitespace_and_newline_separator', () => {
    const result = filterOwnerStats(sample, '南京证券\n苏州工业园  ');
    expect(result.map((s) => s.customer).sort()).toEqual(['南京证券', '苏州工业园']);
  });

  it('should_return_empty_when_no_match', () => {
    expect(filterOwnerStats(sample, '不存在的客户').length).toBe(0);
  });
});

describe('summarizeStats', () => {
  it('should_sum_all_metrics_across_customers', () => {
    const summary = summarizeStats([
      { customer: 'A', normalizedCustomer: 'A', isT2000: true, performanceCount: 1, opportunityCount: 3, pipelineAmount: 100, forecastAmount: 60, orderAmount: 50, grossProfit: 20 },
      { customer: 'B', normalizedCustomer: 'B', isT2000: false, performanceCount: 2, opportunityCount: 5, pipelineAmount: 200, forecastAmount: 100, orderAmount: 80, grossProfit: 40 },
    ]);
    expect(summary).toEqual({
      customerCount: 2,
      opportunityCount: 8,
      pipelineAmount: 300,
      forecastAmount: 160,
      orderAmount: 130,
      grossProfit: 60,
      performanceCount: 3,
    });
  });

  it('should_return_zero_for_empty_input', () => {
    expect(summarizeStats([])).toEqual({
      customerCount: 0,
      opportunityCount: 0,
      pipelineAmount: 0,
      forecastAmount: 0,
      orderAmount: 0,
      grossProfit: 0,
      performanceCount: 0,
    });
  });
});

describe('exportOwnerStatsCsv', () => {
  it('should_produce_csv_with_header_and_escaped_values', () => {
    const csv = exportOwnerStatsCsv([
      { customer: '客户A', normalizedCustomer: '客户A', isT2000: true, performanceCount: 2, opportunityCount: 3, pipelineAmount: 100, forecastAmount: 60, orderAmount: 50, grossProfit: 20 },
      { customer: '有,逗号', normalizedCustomer: '有,逗号', isT2000: false, performanceCount: 0, opportunityCount: 1, pipelineAmount: 10, forecastAmount: 0, orderAmount: 0, grossProfit: 0 },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('客户,T2000,商机数,Pipeline金额(万元),Forecast金额(万元),业绩记录数,下单金额(万元),销售毛利(万元)');
    expect(lines[1]).toBe('客户A,是,3,100.00,60.00,2,50.00,20.00');
    expect(lines[2]).toBe('"有,逗号",否,1,10.00,0.00,0,0.00,0.00');
  });
});