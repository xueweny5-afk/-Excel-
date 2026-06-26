import { describe, expect, it } from 'vitest';
import {
  axisCategory,
  axisValue,
  barOption,
  chartColors,
  countBarOption,
  donutOption,
  matchRateOption,
  quarterOption,
} from '../chartOptions';

describe('axisCategory', () => {
  it('should_create_category_axis_with_data', () => {
    const axis = axisCategory(['A', 'B', 'C']);
    expect(axis.type).toBe('category');
    expect(axis.data).toEqual(['A', 'B', 'C']);
  });

  it('should_set_truncate_overflow_when_width_provided', () => {
    const axis = axisCategory(['A'], 100);
    expect(axis.axisLabel?.overflow).toBe('truncate');
    expect(axis.axisLabel?.width).toBe(100);
  });

  it('should_not_set_overflow_when_no_width', () => {
    const axis = axisCategory(['A']);
    expect(axis.axisLabel?.overflow).toBeUndefined();
  });
});

describe('axisValue', () => {
  it('should_create_value_axis', () => {
    const axis = axisValue();
    expect(axis.type).toBe('value');
  });
});

describe('barOption', () => {
  it('should_build_bar_with_amount_label', () => {
    const option = barOption([{ name: 'A', value: 100 }], true);
    expect(option.series[0].type).toBe('bar');
    expect(option.series[0].name).toBe('金额(万元)');
  });

  it('should_use_horizontal_layout_for_categories', () => {
    const option = barOption(
      [
        { name: 'A', value: 100 },
        { name: 'B', value: 200 },
      ],
      true,
    );
    // horizontal: xAxis is value, yAxis is category
    expect(option.xAxis.type).toBe('value');
    expect(option.yAxis.type).toBe('category');
  });

  it('should_use_vertical_layout_when_not_horizontal', () => {
    const option = barOption([{ name: 'A', value: 100 }], false);
    expect(option.xAxis.type).toBe('category');
    expect(option.yAxis.type).toBe('value');
  });

  it('should_emit_one_data_point_per_item', () => {
    const items = [
      { name: 'A', value: 100 },
      { name: 'B', value: 200 },
    ];
    const option = barOption(items, true);
    expect(option.series[0].data).toHaveLength(2);
  });
});

describe('countBarOption', () => {
  it('should_use_count_label_formatter', () => {
    const option = countBarOption([{ name: 'A', value: 5 }], true);
    expect(option.series[0].name).toBe('商机数');
  });
});

describe('donutOption', () => {
  it('should_build_pie_with_default_palette', () => {
    const option = donutOption([{ name: 'A', value: 100 }]);
    expect(option.series[0].type).toBe('pie');
    expect(option.series[0].radius).toEqual(['55%', '76%']);
    expect(option.color).toEqual([
      chartColors.primary,
      chartColors.cyan,
      chartColors.purple,
      chartColors.green,
      chartColors.orange,
      chartColors.gray,
    ]);
  });

  it('should_accept_custom_palette', () => {
    const custom = ['#000', '#fff'];
    const option = donutOption([{ name: 'A', value: 100 }], custom);
    expect(option.color).toEqual(['#000', '#fff']);
  });
});

describe('quarterOption', () => {
  it('should_include_bar_and_line_series', () => {
    const items = [{ name: "Q1'2026", value: 100, count: 5 }];
    const option = quarterOption(items);
    expect(option.series).toHaveLength(2);
    expect(option.series[0].type).toBe('bar');
    expect(option.series[1].type).toBe('line');
    expect(option.series[1].data).toEqual([5]);
  });
});

describe('matchRateOption', () => {
  it('should_use_green_red_palette', () => {
    const option = matchRateOption(10, 5);
    expect(option.color).toEqual([chartColors.green, chartColors.red]);
  });

  it('should_render_two_segments', () => {
    const option = matchRateOption(10, 5);
    expect(option.series[0].data).toEqual([
      { name: '成功', value: 10 },
      { name: '未匹配', value: 5 },
    ]);
  });
});
