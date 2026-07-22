import { describe, expect, it } from 'vitest';
import type { DashboardData, PPLRecord } from '../../domain';
import { extractPipelineOwnerNames } from '../db';

function createData(owners: string[]): DashboardData {
  return {
    ppl: owners.map(
      (owner, index): PPLRecord => ({
        id: String(index),
        owner,
        customerName: `客户${index}`,
        opportunityName: `商机${index}`,
        stage: 'Pipeline',
        amount: 0,
        status: '进行中',
        industryLevel1: '',
        product: '',
        winRate: 0,
        forecastType: 'Pipeline',
        expectedQuarter: '',
        healthScore: 0,
        healthLevel: '关注',
        healthReasons: [],
        raw: {},
      }),
    ),
    summary: [],
    activity: [],
    performance: [],
    report: {
      fileName: 'pipeline.xlsx',
      importedAt: '2026-07-20',
      pplRows: owners.length,
      summaryRows: 0,
      activityRows: 0,
      performanceRows: 0,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}

describe('extractPipelineOwnerNames', () => {
  it('从 Pipeline所有人拆分人员并按规范化姓名去重', () => {
    const data = createData(['张三、李四', ' 张 三 ', '王五/赵六；钱七']);

    expect(extractPipelineOwnerNames(data)).toEqual(['张三', '李四', '王五', '赵六', '钱七']);
  });

  it('忽略空值和占位值', () => {
    const data = createData(['未填写', 'Unknown', '-', '无', '周八']);

    expect(extractPipelineOwnerNames(data)).toEqual(['周八']);
  });
});
