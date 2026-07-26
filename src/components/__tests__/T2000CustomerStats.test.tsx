import { vi } from 'vitest';
import type { DashboardData, NaCustomer, PPLRecord } from '../../domain';
import { analyzePresalesDashboard } from '../../lib/presalesMetrics';
import { fireEvent, render, screen, within } from '../../test/testUtils';
import { T2000CustomerStatsView } from '../presales/T2000CustomerStats';

vi.mock('../../lib/EChartsReact', () => ({
  EChartsReact: ({ option }: { option: { series?: Array<{ name?: string }> } }) => (
    <div data-testid="echarts">{option.series?.[0]?.name}</div>
  ),
}));

function makePpl(
  id: string,
  owner: string,
  customerName: string,
  opportunityName: string,
  amount: number,
): PPLRecord {
  return {
    id,
    owner,
    customerName,
    opportunityName,
    industryLevel1: '',
    product: '',
    productLevel2: customerName === '客户A' ? '云安全' : '终端安全',
    productLevel3: customerName === '客户A' ? '主机安全' : '终端防病毒',
    amount,
    stage: '项目立项',
    status: '',
    winRate: 50,
    forecastType: 'Pipeline',
    expectedQuarter: '',
    healthScore: 80,
    healthLevel: '健康',
    healthReasons: [],
    raw: {},
  };
}

function makeNa(customer: string, owner: string): NaCustomer {
  return {
    customer,
    customerOwner: owner,
    presales: '',
    customerType: 'NA-I',
    quadrant: '',
    isT2000: true,
    industryLevel1: '',
    industryLevel2: '',
    scaleTarget: '',
    sourceSheet: 'NA客户',
    raw: {},
  };
}

function makeData(): DashboardData {
  return {
    ppl: [makePpl('p1', '张三', '客户A', 'A项目', 100), makePpl('p2', '李四', '客户B', 'B项目', 300)],
    summary: [],
    activity: [],
    performance: [],
    naCustomers: [makeNa('客户A', '张三'), makeNa('客户B', '李四')],
    report: {
      fileName: 'test.xlsx',
      importedAt: '2026-07-24',
      pplRows: 2,
      summaryRows: 0,
      activityRows: 0,
      performanceRows: 0,
      naCustomerRows: 2,
      skippedRows: 0,
      detectedFields: [],
      missingFields: [],
      warnings: [],
    },
  };
}

describe('T2000CustomerStatsView', () => {
  it('选择销售后仅在点击查询时应用，并同步更新图表和项目结果', () => {
    const { container } = render(<T2000CustomerStatsView analysis={analyzePresalesDashboard(makeData())} />);

    expect(container.querySelectorAll('.presales-owner-panel')).toHaveLength(1);
    expect(screen.getAllByText('A项目').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B项目').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('echarts')).toHaveLength(2);
    expect(screen.getAllByText('Pipeline 金额').length).toBeGreaterThan(0);
    expect(screen.getByText('商机数量')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('销售人员'), { target: { value: '张三' } });
    fireEvent.change(screen.getByLabelText('商机项目名称'), { target: { value: 'A项目' } });
    expect(screen.getAllByText('B项目').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '查询' }));

    expect(screen.getAllByText('A项目').length).toBeGreaterThan(0);
    expect(screen.queryByText('B项目')).not.toBeInTheDocument();
    expect(screen.getByText(/当前销售：张三/)).toBeInTheDocument();
  });

  it('项目和客户表头可切换升序与降序', () => {
    render(<T2000CustomerStatsView analysis={analyzePresalesDashboard(makeData())} />);

    const projectPanel = screen.getByRole('heading', { name: '商机项目统计' }).closest('.table-panel');
    expect(projectPanel).not.toBeNull();
    const projectTable = within(projectPanel as HTMLElement).getByRole('table');
    expect(projectTable).toHaveClass('t2000-project-table');
    expect(projectTable.parentElement).toHaveClass('t2000-project-table-wrap');
    expect(within(projectPanel as HTMLElement).getByText('二级产品')).toBeInTheDocument();
    expect(within(projectPanel as HTMLElement).getByText('三级产品')).toBeInTheDocument();
    expect(within(projectPanel as HTMLElement).getByText('云安全')).toBeInTheDocument();
    expect(within(projectPanel as HTMLElement).getByText('主机安全')).toBeInTheDocument();
    const projectRows = () => within(projectPanel as HTMLElement).getAllByRole('row');
    expect(projectRows()[1]).toHaveTextContent('B项目');

    fireEvent.click(screen.getByRole('button', { name: '按商机项目升序排序' }));
    expect(projectRows()[1]).toHaveTextContent('A项目');
    fireEvent.click(screen.getByRole('button', { name: '按商机项目降序排序' }));
    expect(projectRows()[1]).toHaveTextContent('B项目');

    const customerPanel = screen.getByRole('heading', { name: 'T2000 客户详细数据' }).closest('.table-panel');
    expect(customerPanel).not.toBeNull();
    const customerRows = () => within(customerPanel as HTMLElement).getAllByRole('row');
    expect(customerRows()[1]).toHaveTextContent('客户B');

    fireEvent.click(within(customerPanel as HTMLElement).getByRole('button', { name: '按客户升序排序' }));
    expect(customerRows()[1]).toHaveTextContent('客户A');
    fireEvent.click(within(customerPanel as HTMLElement).getByRole('button', { name: '按客户降序排序' }));
    expect(customerRows()[1]).toHaveTextContent('客户B');
  });
});
