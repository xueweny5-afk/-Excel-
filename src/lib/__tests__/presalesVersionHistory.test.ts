import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../domain';
import { applyDashboardDelta, buildDashboardDelta } from '../presalesVersionHistory';

describe('presalesVersionHistory delta', () => {
  it('后续版本仅保存增删改并可完整重建当前数据', () => {
    const previous = buildData();
    const current: DashboardData = {
      ...previous,
      ppl: [
        { ...previous.ppl[0], amount: 180, stage: '方案评估' },
        {
          ...previous.ppl[0],
          id: '2',
          customerName: '客户B',
          opportunityName: '商机B',
          amount: 60,
        },
      ],
      summary: [],
      report: { ...previous.report, fileName: 'v2.xlsx', importedAt: '2026-07-25' },
    };

    const delta = buildDashboardDelta(previous, current);
    const rebuilt = applyDashboardDelta(previous, delta);

    expect(delta.ppl.upserts).toHaveLength(2);
    expect(delta.summary.removedKeys).toHaveLength(1);
    expect(rebuilt).toEqual(current);
  });
});

function buildData(): DashboardData {
  return {
    ppl: [
      {
        id: '1',
        owner: '张三',
        customerName: '客户A',
        opportunityName: '商机A',
        industryLevel1: '金融',
        product: '云安全',
        amount: 100,
        stage: '提出需求',
        status: '进行中',
        winRate: 0.2,
        forecastType: 'Pipeline',
        expectedQuarter: 'Q3',
        healthScore: 0.5,
        healthLevel: '关注',
        healthReasons: [],
        raw: {},
      },
    ],
    summary: [{ team: '一组', owner: '张三', totalAmount: 100, forecastAmount: 20, raw: {} }],
    activity: [{ owner: '张三', newPplAmount: 10, activityCount: 2, conversionRate: 0.5, raw: {} }],
    performance: [],
    naCustomers: [],
    report: {
      fileName: 'v1.xlsx',
      importedAt: '2026-07-18',
      pplRows: 1,
      summaryRows: 1,
      activityRows: 1,
      performanceRows: 0,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}
