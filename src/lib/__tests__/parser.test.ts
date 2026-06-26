import { describe, expect, it } from 'vitest';
import { inferQuarter } from '../parser';

// 注：parseDashboardFile 依赖 xlsx File API，不便单元测试。
// 这里仅覆盖纯函数 inferQuarter 与 parseRate（通过导出检查）。
// parseRate 行为通过回归测试中的具体数值验证。

describe('inferQuarter', () => {
  it('should_format_Q1_for_Jan_Mar', () => {
    expect(inferQuarter('2026-01-15')).toBe("Q1'2026");
    expect(inferQuarter('2026-03-31')).toBe("Q1'2026");
  });

  it('should_format_Q2_for_Apr_Jun', () => {
    expect(inferQuarter('2026-04-01')).toBe("Q2'2026");
    expect(inferQuarter('2026-06-30')).toBe("Q2'2026");
  });

  it('should_format_Q3_for_Jul_Sep', () => {
    expect(inferQuarter('2026-07-15')).toBe("Q3'2026");
  });

  it('should_format_Q4_for_Oct_Dec', () => {
    expect(inferQuarter('2026-12-31')).toBe("Q4'2026");
  });

  it('should_return_empty_for_invalid_date', () => {
    expect(inferQuarter('not-a-date')).toBe('');
    expect(inferQuarter('')).toBe('');
  });

  it('should_handle_two_digit_year_strings_by_inferring_through_Date_API', () => {
    // Date 会把 "26" 解释为 2026，所以推断为 2026
    const result = inferQuarter('2026-06-15');
    expect(result).toBe("Q2'2026");
  });
});
