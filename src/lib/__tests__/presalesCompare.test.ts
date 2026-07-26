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

  it('识别新增、移除以及金额、阶段、负责人和产品变化', () => {
    const previous = buildData({ pipeline: 1000, profit: 120, order: 70 });
    const current = buildData({ pipeline: 1200, profit: 100, order: 80 });
    previous.ppl.push({
      ...previous.ppl[0],
      id: '3',
      customerName: '客户C',
      opportunityName: '移除项目',
    });
    current.ppl[0] = {
      ...current.ppl[0],
      owner: '李四',
      stage: '方案评估',
      productLevel2: '高级威胁治理',
    };
    current.ppl.push({
      ...current.ppl[0],
      id: '2',
      customerName: '客户B',
      opportunityName: '新增项目',
    });

    const comparison = comparePresalesData(current, previous);

    expect(comparison.changeSummary).toEqual({ added: 1, removed: 1, changed: 1 });
    expect(comparison.opportunityChanges[0]).toMatchObject({ type: 'added', opportunityName: '新增项目' });
    expect(comparison.opportunityChanges[1].changedFields).toEqual(
      expect.arrayContaining(['金额', '阶段', '负责人', '二级产品']),
    );
    expect(comparison.opportunityChanges[2]).toMatchObject({ type: 'removed', opportunityName: '移除项目' });
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
