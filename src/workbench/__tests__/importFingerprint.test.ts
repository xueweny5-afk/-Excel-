import { describe, expect, it } from 'vitest';
import type { DashboardData, PPLRecord } from '../../domain';
import { buildImportFingerprint } from '../db';

function row(id: string, customerName: string, opportunityName: string, stage = '提出需求'): PPLRecord {
  return {
    id,
    owner: '张三',
    customerName,
    opportunityName,
    industryLevel1: '金融',
    product: '产品A',
    amount: 100,
    stage,
    status: '进行中',
    winRate: 0.2,
    forecastType: 'Pipeline',
    expectedQuarter: 'Q3',
    healthScore: 0.5,
    healthLevel: '关注',
    healthReasons: [],
    raw: {},
  };
}

function data(ppl: PPLRecord[]): DashboardData {
  return {
    ppl,
    summary: [],
    activity: [],
    performance: [],
    report: {
      fileName: 'baseline.xlsx',
      importedAt: '2026-07-19',
      pplRows: ppl.length,
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

describe('buildImportFingerprint', () => {
  it('忽略行顺序，得到相同导入指纹', () => {
    const first = row('1', '客户A', '商机A');
    const second = row('2', '客户B', '商机B');
    expect(buildImportFingerprint('sales', data([first, second])).fingerprint).toBe(
      buildImportFingerprint('sales', data([second, first])).fingerprint,
    );
  });

  it('相同客户和商机的重复源行只保留一条并记录重复数', () => {
    const result = buildImportFingerprint(
      'sales',
      data([row('1', '客户A', '商机A'), row('2', ' 客户A ', '商机A')]),
    );
    expect(result.payload.rows).toHaveLength(1);
    expect(result.payload.duplicateSourceRowCount).toBe(1);
  });

  it('阶段变化会形成不同指纹，不同驾驶舱来源也彼此隔离', () => {
    const baseline = data([row('1', '客户A', '商机A')]);
    const changed = data([row('1', '客户A', '商机A', '方案评估')]);
    expect(buildImportFingerprint('sales', baseline).fingerprint).not.toBe(
      buildImportFingerprint('sales', changed).fingerprint,
    );
    expect(buildImportFingerprint('sales', baseline).fingerprint).not.toBe(
      buildImportFingerprint('presales', baseline).fingerprint,
    );
    expect(buildImportFingerprint('workbench', baseline).fingerprint).not.toBe(
      buildImportFingerprint('presales', baseline).fingerprint,
    );
  });
});
