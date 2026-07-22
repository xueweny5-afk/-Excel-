import { describe, expect, it } from 'vitest';
import { matchesCustomerSearch } from '../customerSearch';

describe('customer fuzzy search', () => {
  const names = ['江苏 某某科技（集团）有限公司', '某某科技'];

  it('支持简称、忽略空格和标点的包含匹配', () => {
    expect(matchesCustomerSearch('某某科技', names)).toBe(true);
    expect(matchesCustomerSearch('江苏某某', names)).toBe(true);
  });

  it('支持多个关键词和按顺序的模糊字符匹配', () => {
    expect(matchesCustomerSearch('江苏 科技', names)).toBe(true);
    expect(matchesCustomerSearch('江科集团', names)).toBe(true);
    expect(matchesCustomerSearch('浙江 医疗', names)).toBe(false);
  });
});
