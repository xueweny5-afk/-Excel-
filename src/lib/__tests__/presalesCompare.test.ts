import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../domain';
import { comparePresalesData } from '../presalesCompare';

describe('comparePresalesData', () => {
  it('should_mark_first_version_when_no_previous_data', () => {
    const current = buildData({ pipeline: 1200, profit: 100, order: 80 });

    const comparison = comparePresalesData(current, null);

    expect(comparison.hasReference).toBe(false);
    expect(comparison.items.find((item) => item.key === 'pipelineAmount')?.delta).toBeNull();
  });

  it('should_calculate_delta_against_previous_import', () => {
    const previous = buildData({ pipeline: 1000, profit: 120, order: 70 });
    const current = buildData({ pipeline: 1200, profit: 100, order: 80 });

    const comparison = comparePresalesData(current, previous);

    expect(comparison.hasReference).toBe(true);
    expect(comparison.items.find((item) => item.key === 'pipelineAmount')?.delta).toBe(200);
    expect(comparison.items.find((item) => item.key === 'profitAmount')?.delta).toBe(-20);
    expect(comparison.items.find((item) => item.key === 'orderAmount')?.delta).toBe(10);
  });
});

function buildData(input: { pipeline: number; profit: number; order: number }): DashboardData {
  return {
    ppl: [
      {
        id: '1',
        owner: '张三',
        customerName: '南京证券股份有限公司',
        opportunityName: 'AI XDR 项目',
        industryLevel1: '金融',
        t2000CustomerTag: 'T2000',
        product: 'AI XDR',
        amount: input.pipeline,
        stage: '项目立项',
        status: '进行中',
        winRate: 0.6,
        forecastType: 'Commit',
        expectedQuarter: "Q3'2026",
        healthScore: 0.8,
        healthLevel: '健康',
        healthReasons: [],
        raw: {},
      },
    ],
    summary: [],
    activity: [],
    performance: [
      {
        customerName: '南京证券股份有限公司',
        productName: 'AI XDR',
        productLevel2: '',
        productLevel3: '',
        orderAmount: input.order,
        contractAmount: input.order,
        salesGrossProfit: input.profit,
        performanceGrossProfit: input.profit,
        finalPerformance: input.order,
        isT2000: true,
        raw: {},
      },
    ],
    report: {
      fileName: 'test.xlsx',
      importedAt: '-',
      pplRows: 1,
      summaryRows: 0,
      activityRows: 0,
      performanceRows: 1,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}
