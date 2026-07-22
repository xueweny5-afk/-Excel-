import { describe, expect, it } from 'vitest';
import type { DashboardData, PerformanceRecord, PPLRecord } from '../../domain';
import {
  buildSalesDimensionStats,
  exportSalesStatsCsv,
  filterSalesStats,
  getPplRowsByOwner,
  summarizeSalesStats,
} from '../salesDimensionStats';

function makePpl(overrides: Partial<PPLRecord>): PPLRecord {
  return {
    id: overrides.id ?? 'r1',
    owner: '严学文',
    customerName: '客户A',
    opportunityName: '商机A',
    industryLevel1: '金融',
    product: 'DS',
    amount: 100,
    stage: '需求确认',
    status: '推进',
    winRate: 0.5,
    forecastType: 'Pipeline',
    expectedQuarter: "Q3'2026",
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
    productName: 'DS',
    productLevel2: '云安全',
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
      fileName: 't.xlsx',
      importedAt: '-',
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

describe('buildSalesDimensionStats', () => {
  it('should_aggregate_ppl_metrics_by_owner', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊', customerName: '客户A', amount: 100 }),
      makePpl({ id: 'r2', owner: '张磊', customerName: '客户B', amount: 50 }),
      makePpl({ id: 'r3', owner: '李四', customerName: '客户C', amount: 200 }),
    ]);
    const stats = buildSalesDimensionStats(data);
    const zl = stats.find((s) => s.owner === '张磊');
    const ls = stats.find((s) => s.owner === '李四');
    expect(zl?.opportunityCount).toBe(2);
    expect(zl?.customerCount).toBe(2);
    expect(zl?.pipelineAmount).toBe(150);
    expect(ls?.pipelineAmount).toBe(200);
  });

  it('should_aggregate_t2000_metrics', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊', customerName: 'T2000客户', amount: 100, t2000CustomerTag: 'T2000' }),
      makePpl({ id: 'r2', owner: '张磊', customerName: '普通客户', amount: 50, t2000CustomerTag: '' }),
    ]);
    const stats = buildSalesDimensionStats(data);
    const zl = stats.find((s) => s.owner === '张磊');
    expect(zl?.t2000OpportunityCount).toBe(1);
    expect(zl?.t2000OpportunityAmount).toBe(100);
  });

  it('should_aggregate_forecast_and_established_separately', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊', amount: 100, forecastType: 'Commit', stage: '项目立项' }),
      makePpl({ id: 'r2', owner: '张磊', amount: 50, forecastType: 'Pipeline', stage: '方案评估' }),
      makePpl({ id: 'r3', owner: '张磊', amount: 30, forecastType: 'Commit', stage: '1.提出需求' }),
    ]);
    const stats = buildSalesDimensionStats(data);
    const zl = stats.find((s) => s.owner === '张磊');
    expect(zl?.pipelineAmount).toBe(180);
    expect(zl?.forecastAmount).toBe(130);
    expect(zl?.establishedCount).toBe(2); // 项目立项 + 方案评估
    expect(zl?.establishedAmount).toBe(150);
  });

  it('should_attribute_performance_to_owner_via_customer_fuzzy_match', () => {
    const data = makeData(
      [makePpl({ id: 'r1', owner: '张磊', customerName: '南京证券' })],
      [makePerformance({ customerName: '南京证券股份有限公司', orderAmount: 100, salesGrossProfit: 30 })],
    );
    const stats = buildSalesDimensionStats(data);
    const zl = stats.find((s) => s.owner === '张磊');
    expect(zl?.orderAmount).toBe(100);
    expect(zl?.grossProfit).toBe(30);
  });

  it('should_split_performance_evenly_when_customer_has_multiple_owners', () => {
    // 客户 A 同时属于张磊、李四：业绩金额按 50/50 均摊
    const data = makeData(
      [
        makePpl({ id: 'r1', owner: '张磊', customerName: '共拓客户A' }),
        makePpl({ id: 'r2', owner: '李四', customerName: '共拓客户A' }),
      ],
      [makePerformance({ customerName: '共拓客户A', orderAmount: 100, salesGrossProfit: 40 })],
    );
    const stats = buildSalesDimensionStats(data);
    const zl = stats.find((s) => s.owner === '张磊');
    const ls = stats.find((s) => s.owner === '李四');
    expect(zl?.orderAmount).toBe(50);
    expect(zl?.grossProfit).toBe(20);
    expect(ls?.orderAmount).toBe(50);
    expect(ls?.grossProfit).toBe(20);
  });

  it('should_fall_back_to_performanceGrossProfit_when_salesGrossProfit_zero', () => {
    const data = makeData(
      [makePpl({ id: 'r1', owner: '张磊', customerName: '客户X' })],
      [makePerformance({ customerName: '客户X', orderAmount: 50, salesGrossProfit: 0, performanceGrossProfit: 20 })],
    );
    const stats = buildSalesDimensionStats(data);
    expect(stats[0]?.grossProfit).toBe(20);
  });

  it('should_sort_by_pipeline_desc_then_customer_desc', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '甲', customerName: 'A1', amount: 10 }),
      makePpl({ id: 'r2', owner: '乙', customerName: 'B1', amount: 100 }),
      makePpl({ id: 'r3', owner: '丙', customerName: 'C1', amount: 100 }),
      makePpl({ id: 'r4', owner: '丙', customerName: 'C2', amount: 0 }), // 同样金额但客户多
    ]);
    const stats = buildSalesDimensionStats(data);
    expect(stats.map((s) => s.owner).slice(0, 2)).toEqual(['丙', '乙']);
  });

  it('should_ignore_blank_owner_rows', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '', amount: 100 }),
      makePpl({ id: 'r2', owner: '   ', amount: 50 }),
      makePpl({ id: 'r3', owner: '张磊', amount: 30 }),
    ]);
    const stats = buildSalesDimensionStats(data);
    expect(stats.length).toBe(1);
    expect(stats[0]?.owner).toBe('张磊');
  });
});

describe('filterSalesStats', () => {
  const sample = [
    { owner: '张磊', normalizedOwner: '张磊', customerCount: 1, opportunityCount: 2, pipelineAmount: 100, forecastAmount: 0, t2000OpportunityCount: 0, t2000OpportunityAmount: 0, establishedCount: 0, establishedAmount: 0, orderAmount: 0, grossProfit: 0 },
    { owner: '李四', normalizedOwner: '李四', customerCount: 1, opportunityCount: 1, pipelineAmount: 200, forecastAmount: 0, t2000OpportunityCount: 0, t2000OpportunityAmount: 0, establishedCount: 0, establishedAmount: 0, orderAmount: 0, grossProfit: 0 },
    { owner: '张三丰', normalizedOwner: '张三丰', customerCount: 3, opportunityCount: 5, pipelineAmount: 300, forecastAmount: 0, t2000OpportunityCount: 0, t2000OpportunityAmount: 0, establishedCount: 0, establishedAmount: 0, orderAmount: 0, grossProfit: 0 },
  ];

  it('should_return_all_when_input_empty', () => {
    expect(filterSalesStats(sample, '').length).toBe(3);
  });

  it('should_match_single_token_fuzzy', () => {
    expect(filterSalesStats(sample, '张磊').map((s) => s.owner)).toEqual(['张磊']);
    // '张' 同时匹配 "张磊" 和 "张三丰"，按字符串默认排序
    expect(filterSalesStats(sample, '张').map((s) => s.owner).sort()).toEqual(['张磊', '张三丰'].sort());
  });

  it('should_support_multiple_tokens', () => {
    expect(filterSalesStats(sample, '张磊, 李四').map((s) => s.owner).sort()).toEqual(['张磊', '李四']);
  });
});

describe('summarizeSalesStats', () => {
  it('should_sum_all_metrics', () => {
    const summary = summarizeSalesStats([
      { owner: 'A', normalizedOwner: 'A', customerCount: 2, opportunityCount: 5, pipelineAmount: 100, forecastAmount: 60, t2000OpportunityCount: 1, t2000OpportunityAmount: 30, establishedCount: 2, establishedAmount: 50, orderAmount: 80, grossProfit: 20 },
      { owner: 'B', normalizedOwner: 'B', customerCount: 3, opportunityCount: 7, pipelineAmount: 200, forecastAmount: 100, t2000OpportunityCount: 2, t2000OpportunityAmount: 60, establishedCount: 3, establishedAmount: 80, orderAmount: 100, grossProfit: 40 },
    ]);
    expect(summary).toEqual({
      ownerCount: 2,
      customerCount: 5,
      opportunityCount: 12,
      pipelineAmount: 300,
      forecastAmount: 160,
      t2000OpportunityCount: 3,
      t2000OpportunityAmount: 90,
      establishedCount: 5,
      establishedAmount: 130,
      orderAmount: 180,
      grossProfit: 60,
    });
  });

  it('should_return_zero_for_empty', () => {
    expect(summarizeSalesStats([]).pipelineAmount).toBe(0);
    expect(summarizeSalesStats([]).ownerCount).toBe(0);
  });
});

describe('exportSalesStatsCsv', () => {
  it('should_include_header_and_escape_values', () => {
    const csv = exportSalesStatsCsv([
      { owner: '张磊', normalizedOwner: '张磊', customerCount: 2, opportunityCount: 3, pipelineAmount: 100, forecastAmount: 60, t2000OpportunityCount: 1, t2000OpportunityAmount: 30, establishedCount: 2, establishedAmount: 50, orderAmount: 80, grossProfit: 20 },
      { owner: '有,逗号', normalizedOwner: '有,逗号', customerCount: 0, opportunityCount: 0, pipelineAmount: 0, forecastAmount: 0, t2000OpportunityCount: 0, t2000OpportunityAmount: 0, establishedCount: 0, establishedAmount: 0, orderAmount: 0, grossProfit: 0 },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Pipeline所有人');
    expect(lines[1]).toBe('张磊,2,3,100.00,60.00,1,30.00,2,50.00,80.00,20.00');
    expect(lines[2]).toBe('"有,逗号",0,0,0.00,0.00,0,0.00,0,0.00,0.00,0.00');
  });
});
describe('getPplRowsByOwner (drill down)', () => {
  it('should_return_ppl_rows_matching_owner_display_name', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊', customerName: '客户A', opportunityName: '商机1' }),
      makePpl({ id: 'r2', owner: '张磊', customerName: '客户B', opportunityName: '商机2' }),
      makePpl({ id: 'r3', owner: '李四', customerName: '客户C', opportunityName: '商机3' }),
    ]);
    const rows = getPplRowsByOwner(data, '张磊');
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('should_handle_owner_with_trailing_or_leading_whitespace', () => {
    // PPL 中的 owner 可能带空格，但 displayName 已被 trim
    const data = makeData([
      makePpl({ id: 'r1', owner: '  张磊  ', customerName: '客户A' }),
    ]);
    const rows = getPplRowsByOwner(data, '张磊');
    expect(rows.length).toBe(1);
  });

  it('should_fall_back_to_fuzzy_match_when_no_exact', () => {
    // 输入 "张" 模糊匹配 "张磊"
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊', customerName: '客户A' }),
    ]);
    const rows = getPplRowsByOwner(data, '张');
    expect(rows.length).toBe(1);
  });

  it('should_return_empty_for_blank_owner', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊' }),
    ]);
    expect(getPplRowsByOwner(data, '')).toEqual([]);
    expect(getPplRowsByOwner(data, '   ')).toEqual([]);
  });

  it('should_return_empty_when_no_ppl_matches', () => {
    const data = makeData([
      makePpl({ id: 'r1', owner: '张磊' }),
    ]);
    expect(getPplRowsByOwner(data, '不存在的人').length).toBe(0);
  });
});
