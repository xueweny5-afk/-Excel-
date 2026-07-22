import { describe, expect, it } from 'vitest';
import type { DashboardData, NaCustomer, PerformanceRecord, PPLRecord } from '../../domain';
import {
  buildT2000CustomerStats,
  exportT2000StatsCsv,
  filterT2000ByType,
  filterT2000Stats,
  summarizeT2000Stats,
} from '../t2000CustomerStats';

function makePpl(overrides: Partial<PPLRecord>): PPLRecord {
  return {
    id: overrides.id ?? 'r1',
    owner: '张磊',
    customerName: '南京证券',
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
    customerName: '南京证券',
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

function makeNa(overrides: Partial<NaCustomer>): NaCustomer {
  return {
    customer: '南京证券',
    customerOwner: '张三',
    presales: '李四',
    customerType: 'NA-I',
    quadrant: '战略客户',
    isT2000: true,
    industryLevel1: '金融',
    industryLevel2: '证券',
    scaleTarget: '',
    sourceSheet: '2026年Q3-NA客户',
    raw: {},
    ...overrides,
  };
}

function makeData(
  ppl: PPLRecord[],
  performance: PerformanceRecord[],
  naCustomers: NaCustomer[],
): DashboardData {
  return {
    ppl,
    summary: [],
    activity: [],
    performance,
    naCustomers,
    report: {
      fileName: 'test.xlsx',
      importedAt: '2026-07-01',
      pplRows: ppl.length,
      summaryRows: 0,
      activityRows: 0,
      performanceRows: performance.length,
      naCustomerRows: naCustomers.length,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}

describe('buildT2000CustomerStats', () => {
  it('should_use_na_sheet_as_authoritative_t2000_source', () => {
    const data = makeData(
      [],
      [],
      [
        makeNa({ customer: '南京证券' }),
        makeNa({ customer: '苏州银行' }),
      ],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats.length).toBe(2);
    expect(stats.map((s) => s.customer).sort()).toEqual(['南京证券', '苏州银行']);
  });

  it('should_keep_t2000_customer_without_ppl_or_performance', () => {
    const data = makeData([], [], [makeNa({ customer: '空白T2000客户' })]);
    const stats = buildT2000CustomerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('空白T2000客户');
    expect(stats[0]?.opportunityCount).toBe(0);
    expect(stats[0]?.pipelineAmount).toBe(0);
    expect(stats[0]?.orderAmount).toBe(0);
  });

  it('should_match_ppl_by_customer_name_fuzzy', () => {
    const data = makeData(
      // PPL 中的客户名更详细，NA 中的更简化
      [makePpl({ customerName: '南京证券股份有限公司', amount: 200 })],
      [],
      [makeNa({ customer: '南京证券' })],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats[0]?.opportunityCount).toBe(1);
    expect(stats[0]?.pipelineAmount).toBe(200);
  });

  it('should_aggregate_pipeline_forecast_order_and_profit', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: '南京证券', amount: 100, forecastType: 'Commit' }),
        makePpl({ id: 'r2', customerName: '南京证券', amount: 50, forecastType: 'Pipeline' }),
      ],
      [
        makePerformance({ customerName: '南京证券', orderAmount: 80, salesGrossProfit: 20 }),
        makePerformance({ customerName: '南京证券', orderAmount: 30, performanceGrossProfit: 10 }),
      ],
      [makeNa({ customer: '南京证券' })],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats[0]?.pipelineAmount).toBe(150);
    expect(stats[0]?.forecastAmount).toBe(100);
    expect(stats[0]?.orderAmount).toBe(110);
    expect(stats[0]?.grossProfit).toBe(30);
  });

  it('should_skip_na_customer_without_t2000_tag', () => {
    const data = makeData(
      [],
      [],
      [
        makeNa({ customer: 'T2000客户', isT2000: true }),
        makeNa({ customer: '普通NA客户', isT2000: false }),
      ],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('T2000客户');
  });

  it('should_include_na_customer_with_scale_target_even_without_t2000_tag', () => {
    const data = makeData(
      [],
      [],
      [makeNa({ customer: '规模化产出客户', isT2000: false, scaleTarget: '20%' })],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('规模化产出客户');
  });

  it('should_fallback_to_ppl_t2000_tag_when_na_sheet_empty', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: 'A', t2000CustomerTag: 'T2000客户', amount: 100 }),
        makePpl({ id: 'r2', customerName: 'B', t2000CustomerTag: '', amount: 200 }),
      ],
      [],
      [],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.customer).toBe('A');
    expect(stats[0]?.sourceSheet).toContain('推断');
  });

  it('should_build_stage_breakdown_sorted_by_amount', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: '南京证券', amount: 100, stage: '方案评估' }),
        makePpl({ id: 'r2', customerName: '南京证券', amount: 300, stage: '招标采购' }),
        makePpl({ id: 'r3', customerName: '南京证券', amount: 200, stage: '项目立项' }),
      ],
      [],
      [makeNa({ customer: '南京证券' })],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats[0]?.stageBreakdown.map((s) => s.stage)).toEqual(['招标采购', '项目立项', '方案评估']);
    expect(stats[0]?.stageBreakdown[0]?.amount).toBe(300);
  });

  it('should_sort_by_pipeline_amount_desc', () => {
    const data = makeData(
      [
        makePpl({ id: 'r1', customerName: 'A', amount: 100 }),
        makePpl({ id: 'r2', customerName: 'B', amount: 300 }),
      ],
      [],
      [makeNa({ customer: 'A' }), makeNa({ customer: 'B' })],
    );
    const stats = buildT2000CustomerStats(data);
    expect(stats.map((s) => s.customer)).toEqual(['B', 'A']);
  });
});

describe('filterT2000Stats', () => {
  const sample = [
    { customer: '南京证券', normalizedCustomer: '南京证券', customerType: 'NA-I', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: 'Q3', opportunityCount: 1, pipelineAmount: 100, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
    { customer: '南京地铁', normalizedCustomer: '南京地铁', customerType: 'NA-II', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: 'Q3', opportunityCount: 1, pipelineAmount: 200, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
    { customer: '苏州工业园', normalizedCustomer: '苏州工业园', customerType: 'NA代管', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: 'Q1', opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
  ];

  it('should_return_all_when_input_empty', () => {
    expect(filterT2000Stats(sample, '').length).toBe(3);
  });

  it('should_match_single_token_fuzzy', () => {
    expect(filterT2000Stats(sample, '南京').map((s) => s.customer).sort()).toEqual(['南京地铁', '南京证券']);
  });

  it('should_support_multiple_tokens', () => {
    const result = filterT2000Stats(sample, '南京证券, 苏州');
    expect(result.map((s) => s.customer).sort()).toEqual(['南京证券', '苏州工业园']);
  });
});

describe('filterT2000ByType', () => {
  const sample = [
    { customer: 'A', normalizedCustomer: 'A', customerType: 'NA-I', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: '', opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
    { customer: 'B', normalizedCustomer: 'B', customerType: 'NA-II', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: '', opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
    { customer: 'C', normalizedCustomer: 'C', customerType: '', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: '', opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
  ];

  it('should_return_all_when_type_is_all', () => {
    expect(filterT2000ByType(sample, '全部').length).toBe(3);
    expect(filterT2000ByType(sample, '').length).toBe(3);
  });

  it('should_filter_by_specific_type', () => {
    expect(filterT2000ByType(sample, 'NA-I').length).toBe(1);
    expect(filterT2000ByType(sample, 'NA-II').length).toBe(1);
  });
});

describe('summarizeT2000Stats', () => {
  it('should_sum_all_metrics', () => {
    const summary = summarizeT2000Stats([
      { customer: 'A', normalizedCustomer: 'A', customerType: '', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: '', opportunityCount: 3, pipelineAmount: 100, forecastAmount: 60, performanceCount: 1, orderAmount: 50, grossProfit: 20, stageBreakdown: [] },
      { customer: 'B', normalizedCustomer: 'B', customerType: '', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: '', opportunityCount: 5, pipelineAmount: 200, forecastAmount: 100, performanceCount: 2, orderAmount: 80, grossProfit: 40, stageBreakdown: [] },
    ]);
    expect(summary).toEqual({
      customerCount: 2,
      opportunityCount: 8,
      pipelineAmount: 300,
      forecastAmount: 160,
      performanceCount: 3,
      orderAmount: 130,
      grossProfit: 60,
    });
  });

  it('should_return_zero_for_empty_input', () => {
    expect(summarizeT2000Stats([])).toEqual({
      customerCount: 0,
      opportunityCount: 0,
      pipelineAmount: 0,
      forecastAmount: 0,
      performanceCount: 0,
      orderAmount: 0,
      grossProfit: 0,
    });
  });
});

describe('exportT2000StatsCsv', () => {
  it('should_include_header_and_escape_special_characters', () => {
    const csv = exportT2000StatsCsv([
      { customer: '南京证券', normalizedCustomer: '南京证券', customerType: 'NA-I', quadrant: '战略', customerOwner: '张三', presales: '李四', industryLevel1: '金融', sourceSheet: 'Q3', opportunityCount: 3, pipelineAmount: 100, forecastAmount: 60, performanceCount: 2, orderAmount: 50, grossProfit: 20, stageBreakdown: [] },
      { customer: '有,逗号', normalizedCustomer: '有,逗号', customerType: '', quadrant: '', customerOwner: '', presales: '', industryLevel1: '', sourceSheet: 'Q3', opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, performanceCount: 0, orderAmount: 0, grossProfit: 0, stageBreakdown: [] },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('客户,客户类型,象限');
    expect(lines[2]).toBe('"有,逗号",,,,,,Q3,0,0.00,0.00,0,0.00,0.00');
  });
});