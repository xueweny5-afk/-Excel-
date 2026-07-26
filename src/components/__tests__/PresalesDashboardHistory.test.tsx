import { vi } from 'vitest';
import type { DashboardData } from '../../domain';
import { fireEvent, render, screen } from '../../test/testUtils';
import { PresalesDashboardView } from '../presales/PresalesDashboardView';

vi.mock('../../lib/EChartsReact', () => ({
  EChartsReact: () => <div data-testid="echarts" />,
}));

describe('PresalesDashboardView version changes', () => {
  it('展示版本变化并可下钻查看商机更新前后字段', () => {
    const previous = buildData(100, '提出需求', '张三');
    const current = buildData(180, '方案评估', '李四');

    render(
      <PresalesDashboardView
        data={current}
        previousData={previous}
        versions={[
          {
            id: 'v1',
            order: 1,
            kind: 'baseline',
            fileName: 'v1.xlsx',
            importedAt: '2026-07-18',
            fingerprint: 'v1',
            changes: { added: 2, updated: 0, removed: 0 },
          },
          {
            id: 'v2',
            order: 2,
            kind: 'delta',
            fileName: 'v2.xlsx',
            importedAt: '2026-07-25',
            fingerprint: 'v2',
            changes: { added: 0, updated: 1, removed: 0 },
          },
        ]}
        onUpload={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '数据变化' }));

    expect(screen.getByText('商机变化明细')).toBeInTheDocument();
    expect(screen.getByText('变化商机')).toBeInTheDocument();
    expect(screen.getByText('V2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('AI XDR 项目'));

    expect(screen.getByRole('complementary', { name: '商机变化详情' })).toBeInTheDocument();
    expect(screen.getByText('更新前')).toBeInTheDocument();
    expect(screen.getByText('更新后')).toBeInTheDocument();
    expect(screen.getAllByText('负责人')).toHaveLength(2);
  });
});

function buildData(amount: number, stage: string, owner: string): DashboardData {
  return {
    ppl: [
      {
        id: '1',
        owner,
        customerName: '南京证券股份有限公司',
        opportunityName: 'AI XDR 项目',
        industryLevel1: '金融',
        t2000CustomerTag: 'T2000',
        product: 'AI XDR',
        productLevel2: '高级威胁治理',
        productLevel3: 'AI XDR',
        amount,
        stage,
        status: '进行中',
        winRate: 0.6,
        forecastType: 'Commit',
        expectedQuarter: 'Q3',
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
        productLevel2: '高级威胁治理',
        productLevel3: 'AI XDR',
        orderAmount: 20,
        contractAmount: 20,
        salesGrossProfit: 5,
        performanceGrossProfit: 5,
        finalPerformance: 20,
        isT2000: true,
        raw: {},
      },
    ],
    report: {
      fileName: amount === 100 ? 'v1.xlsx' : 'v2.xlsx',
      importedAt: amount === 100 ? '2026-07-18' : '2026-07-25',
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
