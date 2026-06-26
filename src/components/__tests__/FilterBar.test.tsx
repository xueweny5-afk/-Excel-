import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, resetStore, screen } from '../../test/testUtils';
import { FilterBar } from '../filters/FilterBar';
import type { PPLRecord } from '../../domain';
import { useDataStore } from '../../stores/dataStore';

function makePpl(overrides: Partial<PPLRecord> = {}): PPLRecord {
  return {
    id: 'r1',
    owner: '金柳',
    customerName: '南京证券',
    opportunityName: 'X',
    industryLevel1: '金融',
    product: 'AI_XDR',
    amount: 100,
    stage: '商务谈判',
    status: '正常',
    winRate: 0.5,
    forecastType: 'Commit',
    expectedQuarter: "Q2'2026",
    healthScore: 0.7,
    healthLevel: '健康',
    healthReasons: [],
    raw: {},
    ...overrides,
  };
}

describe('FilterBar', () => {
  beforeEach(() => {
    resetStore();
  });

  const data: PPLRecord[] = [
    makePpl({ id: 'r1', owner: '金柳', industryLevel1: '金融', product: 'AI_XDR', status: '正常' }),
    makePpl({ id: 'r2', owner: '李四', industryLevel1: '政府', product: '安全服务', status: '暂停' }),
  ];

  it('should_render_filter_labels', () => {
    render(<FilterBar data={data} resultSummary="测试" />);
    expect(screen.getByText('销售')).toBeInTheDocument();
    expect(screen.getByText('一级行业')).toBeInTheDocument();
    expect(screen.getByText('产品')).toBeInTheDocument();
    expect(screen.getByText('季度')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('Forecast')).toBeInTheDocument();
  });

  it('should_render_result_summary', () => {
    render(<FilterBar data={data} resultSummary="共 2 条 / 200 万" />);
    expect(screen.getByText('共 2 条 / 200 万')).toBeInTheDocument();
  });

  it('should_render_owner_options_from_data', () => {
    render(<FilterBar data={data} resultSummary="" />);
    const ownerSelect = screen.getAllByRole('combobox')[0];
    const options = Array.from(ownerSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('金柳');
    expect(options).toContain('李四');
  });

  it('should_update_store_when_owner_filter_changes', () => {
    render(<FilterBar data={data} resultSummary="" />);
    const ownerSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(ownerSelect, { target: { value: '金柳' } });
    expect(useDataStore.getState().filters.owner).toBe('金柳');
  });

  it('should_update_store_when_search_changes', () => {
    render(<FilterBar data={data} resultSummary="" />);
    const searchInput = screen.getByPlaceholderText('客户、销售、产品、商机');
    fireEvent.change(searchInput, { target: { value: '南京' } });
    expect(useDataStore.getState().search).toBe('南京');
  });

  it('should_update_store_when_customer_query_changes', () => {
    render(<FilterBar data={data} resultSummary="" />);
    const customerTextarea = screen.getByPlaceholderText('一行一个客户，或用逗号分隔');
    fireEvent.change(customerTextarea, { target: { value: '南京证券\n江苏银行' } });
    expect(useDataStore.getState().customerQuery).toBe('南京证券\n江苏银行');
  });

  it('should_call_resetAll_when_reset_button_clicked', () => {
    // 先设置一些状态
    useDataStore.setState({
      filters: { owner: '金柳', industryLevel1: '', product: '', expectedQuarter: '', status: '', forecastType: '' },
      search: '南京',
      customerQuery: 'XX',
    });
    render(<FilterBar data={data} resultSummary="" />);
    fireEvent.click(screen.getByText('重置筛选'));
    const state = useDataStore.getState();
    expect(state.filters.owner).toBe('');
    expect(state.search).toBe('');
    expect(state.customerQuery).toBe('');
  });
});