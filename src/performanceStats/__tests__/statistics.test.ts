import { describe, expect, it } from 'vitest';
import type { KeyProjectRecord, SalesPerformanceRecord } from '../types';
import {
  buildKeyProjectMatches,
  buildSalesPerformanceStats,
  EMPTY_FILTERS,
  filterPerformanceRows,
} from '../statistics';
import { parseAmountAsWan, parseConfirmationDate } from '../utils';

function record(patch: Partial<SalesPerformanceRecord>): SalesPerformanceRecord {
  return {
    id: patch.id ?? crypto.randomUUID(),
    sourceFileId: 'file-1',
    sourceFileName: '徐余涛.xlsx',
    sourceSheetName: '业绩',
    sourceRowNumber: 2,
    salesperson: '徐余涛',
    customerName: '紫金山实验室',
    projectName: 'DS汇报',
    contractNumber: 'HT-1',
    confirmationYear: 2026,
    confirmationMonth: 1,
    confirmationDateText: '2026-01',
    confirmationStatus: '已确认',
    orderAmount: 100,
    salesGrossProfit: 30,
    productLevel1: '安全产品',
    productLevel2: '云安全',
    productLevel3: '',
    productName: 'DS',
    customerType: '新购',
    industry: '科研',
    included: true,
    exclusionReason: '',
    duplicateStatus: '正常',
    raw: {},
    ...patch,
  };
}

function keyProject(patch: Partial<KeyProjectRecord>): KeyProjectRecord {
  return {
    id: 'kp-1',
    sourceFileId: 'kpf-1',
    sourceFileName: '重点项目.xlsx',
    sourceSheetName: '重点项目',
    sourceRowNumber: 2,
    projectName: 'DS汇报',
    customerName: '紫金山实验室',
    owner: '徐余涛',
    targetAmount: 200,
    targetGrossProfit: 60,
    productCategory: '云安全',
    industry: '科研',
    note: '',
    raw: {},
    ...patch,
  };
}

describe('sales performance statistics', () => {
  it('parses amounts and confirmation dates', () => {
    expect(parseAmountAsWan('¥78,000', '下单金额')).toBe(78000);
    expect(parseAmountAsWan('78.5', '下单金额(万元)')).toBe(785000);
    expect(parseAmountAsWan('-10000', '销售毛利')).toBe(-10000);
    expect(parseConfirmationDate('2026年1月')).toMatchObject({ year: 2026, month: 1 });
    expect(parseConfirmationDate('2026/02')).toMatchObject({ year: 2026, month: 2 });
    expect(parseConfirmationDate('3', 2025)).toMatchObject({ year: 2025, month: 3 });
  });

  it('filters by year month and keyword', () => {
    const rows = [
      record({ id: '1', projectName: '紫金山DS汇报', confirmationYear: 2026, confirmationMonth: 1 }),
      record({ id: '2', projectName: '苏州轨交项目', confirmationYear: 2025, confirmationMonth: 12 }),
      record({ id: '3', included: false, exclusionReason: '确认年月为空或无法识别' }),
    ];
    const filtered = filterPerformanceRows(rows, {
      ...EMPTY_FILTERS,
      years: [2026],
      months: [1],
      keyword: 'DS',
    });
    expect(filtered.map((item) => item.id)).toEqual(['1']);
  });

  it('can inspect duplicate rows without counting them by default', () => {
    const rows = [
      record({ id: 'normal', duplicateStatus: '正常' }),
      record({ id: 'dup', duplicateStatus: '疑似重复', included: false, exclusionReason: '疑似重复' }),
    ];
    expect(buildSalesPerformanceStats(rows).includedRows.map((item) => item.id)).toEqual(['normal']);
    expect(
      filterPerformanceRows(rows, { ...EMPTY_FILTERS, duplicateStatus: '疑似重复' }).map((item) => item.id),
    ).toEqual(['dup']);
  });

  it('aggregates contracts customers and projects', () => {
    const stats = buildSalesPerformanceStats([
      record({ id: '1', contractNumber: 'HT-1', productName: 'DS-A', orderAmount: 100, salesGrossProfit: 30 }),
      record({ id: '2', contractNumber: 'HT-1', productName: 'DS-B', orderAmount: 50, salesGrossProfit: 10 }),
      record({ id: '3', contractNumber: 'HT-2', customerName: '南京证券', projectName: '证券项目', orderAmount: 20, salesGrossProfit: 5 }),
    ]);

    expect(stats.kpis.orderAmount).toBe(170);
    expect(stats.kpis.contractCount).toBe(2);
    expect(stats.kpis.customerCount).toBe(2);
    expect(stats.byProject.find((item) => item.name === 'DS汇报')?.orderAmount).toBe(150);
  });

  it('aggregates contract total and gross profit by salesperson', () => {
    const stats = buildSalesPerformanceStats([
      record({ id: '1', salesperson: '徐余涛', contractNumber: 'HT-1', orderAmount: 1000000, salesGrossProfit: 300000 }),
      record({ id: '2', salesperson: '徐余涛', contractNumber: 'HT-2', orderAmount: 500000, salesGrossProfit: 100000 }),
      record({ id: '3', salesperson: '吴启帆', contractNumber: 'HT-3', orderAmount: 200000, salesGrossProfit: 50000 }),
    ]);

    expect(stats.bySalesperson[0]).toMatchObject({
      name: '徐余涛',
      orderAmount: 1500000,
      salesGrossProfit: 400000,
      contractCount: 2,
    });
    expect(stats.bySalesperson[1]).toMatchObject({
      name: '吴启帆',
      orderAmount: 200000,
      salesGrossProfit: 50000,
      contractCount: 1,
    });
  });

  it('aggregates by performance order type for renewal new customer and expansion', () => {
    const stats = buildSalesPerformanceStats([
      record({ id: '1', customerType: '纯续费', orderAmount: 1000000, salesGrossProfit: 600000 }),
      record({ id: '2', customerType: '新客户', orderAmount: 500000, salesGrossProfit: 200000 }),
      record({ id: '3', customerType: '增购', orderAmount: 300000, salesGrossProfit: 100000 }),
      record({ id: '4', customerType: '纯续费', orderAmount: 200000, salesGrossProfit: 50000 }),
    ]);

    expect(stats.byCustomerType).toEqual([
      expect.objectContaining({ name: '纯续费', orderAmount: 1200000, salesGrossProfit: 650000 }),
      expect.objectContaining({ name: '新客户', orderAmount: 500000, salesGrossProfit: 200000 }),
      expect.objectContaining({ name: '增购', orderAmount: 300000, salesGrossProfit: 100000 }),
    ]);
  });

  it('aggregates and filters by product level 2 level 3 and industry', () => {
    const rows = [
      record({
        id: '1',
        productLevel2: '云安全',
        productLevel3: '云主机防护',
        industry: '金融',
        orderAmount: 100,
      }),
      record({
        id: '2',
        productLevel2: '终端安全',
        productLevel3: '终端防病毒',
        industry: '教育',
        orderAmount: 50,
      }),
    ];

    const stats = buildSalesPerformanceStats(rows, {
      ...EMPTY_FILTERS,
      productLevel2: '云安全',
      productLevel3: '云主机防护',
      industry: '金融',
    });

    expect(stats.kpis.orderAmount).toBe(100);
    expect(stats.byProductLevel2[0]).toMatchObject({ name: '云安全', orderAmount: 100 });
    expect(stats.byProductLevel3[0]).toMatchObject({ name: '云主机防护', orderAmount: 100 });
    expect(stats.byIndustry[0]).toMatchObject({ name: '金融', orderAmount: 100 });
  });

  it('matches key projects by project and customer together', () => {
    const matches = buildKeyProjectMatches(
      [
        keyProject({ id: 'kp-1', projectName: 'DS汇报', customerName: '紫金山实验室' }),
        keyProject({ id: 'kp-2', projectName: 'DS汇报', customerName: '南京证券' }),
      ],
      [record({ projectName: 'DS汇报', customerName: '紫金山实验室', orderAmount: 100, salesGrossProfit: 30 })],
    );

    expect(matches[0].status).toBe('已匹配');
    expect(matches[0].targetAmountRate).toBe(0.5);
    expect(matches[1].status).toBe('未匹配');
  });
});
