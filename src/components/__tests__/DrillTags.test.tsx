import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, resetStore, screen } from '../../test/testUtils';
import { DrillTags } from '../filters/DrillTags';
import { useDataStore } from '../../stores/dataStore';

describe('DrillTags', () => {
  beforeEach(() => {
    resetStore();
  });

  it('should_render_nothing_when_no_drill_filters', () => {
    const { container } = render(<DrillTags />);
    expect(container.firstChild).toBeNull();
  });

  it('should_render_drill_tag_with_label_and_value', () => {
    useDataStore.setState({
      drillFilters: [{ field: 'owner', value: '金柳' }],
    });
    render(<DrillTags />);
    expect(screen.getByText(/销售=金柳/)).toBeInTheDocument();
  });

  it('should_remove_single_drill_when_x_clicked', () => {
    useDataStore.setState({
      drillFilters: [
        { field: 'owner', value: '金柳' },
        { field: 'product', value: 'AI_XDR' },
      ],
    });
    render(<DrillTags />);
    // 找到包含"销售=金柳"的 button 并点击
    const ownerTag = screen.getByText(/销售=金柳/).closest('button')!;
    fireEvent.click(ownerTag);
    const state = useDataStore.getState();
    expect(state.drillFilters).toEqual([{ field: 'product', value: 'AI_XDR' }]);
  });

  it('should_clear_all_drills_when_clear_button_clicked', () => {
    useDataStore.setState({
      drillFilters: [
        { field: 'owner', value: '金柳' },
        { field: 'product', value: 'AI_XDR' },
      ],
    });
    render(<DrillTags />);
    fireEvent.click(screen.getByText('清空下钻'));
    expect(useDataStore.getState().drillFilters).toEqual([]);
  });

  it('should_render_all_drill_types', () => {
    useDataStore.setState({
      drillFilters: [
        { field: 'owner', value: 'A' },
        { field: 'industryLevel1', value: 'B' },
        { field: 'product', value: 'C' },
        { field: 'expectedQuarter', value: 'D' },
        { field: 'forecastType', value: 'E' },
        { field: 'healthLevel', value: 'F' },
      ],
    });
    render(<DrillTags />);
    expect(screen.getByText(/销售=A/)).toBeInTheDocument();
    expect(screen.getByText(/行业=B/)).toBeInTheDocument();
    expect(screen.getByText(/产品=C/)).toBeInTheDocument();
    expect(screen.getByText(/季度=D/)).toBeInTheDocument();
    expect(screen.getByText(/Forecast=E/)).toBeInTheDocument();
    expect(screen.getByText(/健康度=F/)).toBeInTheDocument();
  });
});