import { describe, expect, it } from 'vitest';
import { render, screen } from '../../test/testUtils';
import { SimpleRecords } from '../tables/SimpleRecords';

describe('SimpleRecords', () => {
  const rows = [
    { raw: { 销售: '张三', 客户名称: '客户A', 金额: 100 } },
    { raw: { 销售: '李四', 客户名称: '客户B', 金额: 200 } },
  ];

  it('should_render_title_and_row_count', () => {
    render(<SimpleRecords title="数据汇总" rows={rows} />);
    expect(screen.getByText('数据汇总')).toBeInTheDocument();
    expect(screen.getByText(/2 行/)).toBeInTheDocument();
  });

  it('should_render_column_headers_from_first_row', () => {
    render(<SimpleRecords title="数据汇总" rows={rows} />);
    expect(screen.getByText('销售')).toBeInTheDocument();
    expect(screen.getByText('客户名称')).toBeInTheDocument();
    expect(screen.getByText('金额')).toBeInTheDocument();
  });

  it('should_render_empty_state_when_no_rows', () => {
    render(<SimpleRecords title="数据汇总" rows={[]} />);
    expect(screen.getByText(/0 行/)).toBeInTheDocument();
  });

  it('should_cap_at_80_rows', () => {
    const manyRows = Array.from({ length: 120 }, (_, i) => ({
      raw: { 序号: i, 名称: `名称${i}` },
    }));
    render(<SimpleRecords title="数据汇总" rows={manyRows} />);
    expect(screen.getByText(/120 行/)).toBeInTheDocument();
    // 只渲染前 80 行
    expect(screen.getByText('名称0')).toBeInTheDocument();
    expect(screen.getByText('名称79')).toBeInTheDocument();
    expect(screen.queryByText('名称80')).not.toBeInTheDocument();
  });
});