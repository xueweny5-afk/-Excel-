import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKeyProjectFile, parsePerformanceFile } from '../parser';

function workbookFile(rows: object[], sheetName: string, fileName: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new File([buffer], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('sales performance parser', () => {
  it('normalizes performance file and keeps pending rows in amount statistics', async () => {
    const file = workbookFile(
      [
        {
          销售人员: '徐余涛',
          最终用户: '紫金山实验室',
          项目名称: 'DS汇报',
          合同编号: 'HT-1',
          业绩确认月: '2026年1月',
          确认状态: '已确认',
          下单金额: 1000000,
          '销售毛利（含激励）': 300000,
          一级产品分类: '安全产品',
          二级产品分类: '云安全',
          产品名称: 'DS',
          业绩订单类型: '纯续费',
          行业: '科研',
        },
        {
          销售人员: '徐余涛',
          最终用户: '紫金山实验室',
          项目名称: '待确认项目',
          业绩确认月: '2026年2月',
          确认状态: '待确认',
          下单金额: 200000,
        },
      ],
      '业绩明细',
      '徐余涛.xlsx',
    );

    const result = await parsePerformanceFile(file, new Set());
    expect(result.sourceFile.status).toBe('正常');
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      salesperson: '徐余涛',
      customerName: '紫金山实验室',
      projectName: 'DS汇报',
      confirmationYear: 2026,
      confirmationMonth: 1,
      orderAmount: 1000000,
      salesGrossProfit: 300000,
      customerType: '纯续费',
      included: true,
    });
    expect(result.records[1].included).toBe(true);
    expect(result.check.pendingRows).toBe(1);
  });

  it('recognizes salesperson from sales member column', async () => {
    const file = workbookFile(
      [
        {
          销售员: '栾伽',
          最终用户: '紫金山实验室',
          项目名称: 'DS汇报',
          业绩确认月: '2026年1月',
          合同总额: 1389000,
          '销售毛利（含激励）': 873000,
        },
      ],
      '业绩明细',
      '业绩表.xlsx',
    );

    const result = await parsePerformanceFile(file, new Set());
    expect(result.sourceFile.status).toBe('正常');
    expect(result.records[0]).toMatchObject({
      salesperson: '栾伽',
      orderAmount: 1389000,
      salesGrossProfit: 873000,
      included: true,
    });
  });

  it('prefers contract total over order amount for amount statistics', async () => {
    const file = workbookFile(
      [
        {
          最终用户: '紫金山实验室',
          项目名称: 'DS汇报',
          业绩确认月: '2026年1月',
          确认状态: '已确认',
          下单金额: 1000000,
          合同总额: 1500000,
          '销售毛利（含激励）': 300000,
        },
      ],
      '业绩明细',
      '金额口径.xlsx',
    );

    const result = await parsePerformanceFile(file, new Set());
    expect(result.records[0].orderAmount).toBe(1500000);
    expect(result.records[0].salesGrossProfit).toBe(300000);
  });

  it('does not treat gross profit columns as salesperson fields', async () => {
    const file = workbookFile(
      [
        {
          最终用户: '紫金山实验室',
          项目名称: 'DS汇报',
          业绩确认月: '2026年1月',
          确认状态: '已确认',
          合同总额: 1500000,
          '销售毛利（含激励）': 300000,
        },
      ],
      '业绩明细',
      '吴启帆.xlsx',
    );

    const result = await parsePerformanceFile(file, new Set());
    expect(result.records[0].salesperson).toBe('吴启帆');
    expect(result.records[0].salesperson).not.toBe('300000');
  });

  it('blocks duplicate performance files', async () => {
    const file = workbookFile(
      [{ 最终用户: 'A', 业绩确认月: '2026-01', 确认状态: '已确认', 下单金额: 100 }],
      '业绩明细',
      'a.xlsx',
    );
    const first = await parsePerformanceFile(file, new Set());
    const duplicate = await parsePerformanceFile(file, new Set([first.sourceFile.digest]));
    expect(duplicate.sourceFile.status).toBe('重复文件');
    expect(duplicate.records).toHaveLength(0);
  });

  it('does not treat project code as project name', async () => {
    const file = workbookFile(
      [
        {
          销售人员: '徐余涛',
          最终用户: '紫金山实验室',
          项目编号: 'YJCF-20260420-0787',
          项目名称: '紫金山实验室DS汇报',
          业绩确认月: '2026年1月',
          确认状态: '已确认',
          下单金额: 1000000,
        },
      ],
      '业绩明细',
      '徐余涛.xlsx',
    );

    const result = await parsePerformanceFile(file, new Set());
    expect(result.records[0].projectName).toBe('紫金山实验室DS汇报');
  });

  it('parses key project files', async () => {
    const file = workbookFile(
      [
        {
          重点项目名称: 'DS汇报',
          客户名称: '紫金山实验室',
          负责人: '徐余涛',
          目标金额: 2000000,
          目标毛利: 600000,
        },
      ],
      '重点项目',
      '重点项目.xlsx',
    );

    const result = await parseKeyProjectFile(file, new Set());
    expect(result.sourceFile.status).toBe('正常');
    expect(result.projects[0]).toMatchObject({
      projectName: 'DS汇报',
      customerName: '紫金山实验室',
      targetAmount: 2000000,
      targetGrossProfit: 600000,
    });
  });
});
