import { describe, expect, it } from 'vitest';
import { isSameCustomer, normalizeCustomerName } from '../normalize';

describe('normalizeCustomerName', () => {
  it('should_remove_common_company_suffixes', () => {
    expect(normalizeCustomerName('南京证券股份有限公司')).toBe('南京证券');
    expect(normalizeCustomerName('江苏银行有限责任公司')).toBe('江苏银行');
    expect(normalizeCustomerName('中国电信有限公司')).toBe('中国电信');
  });

  it('should_be_case_insensitive', () => {
    expect(normalizeCustomerName('Nanjing Securities')).toBe('nanjingsecurities');
  });

  it('should_remove_whitespace_and_punctuation', () => {
    expect(normalizeCustomerName('中国 移动（华东）')).toBe('中国移动华东');
    // "集团" 是企业后缀，会被剥离
    expect(normalizeCustomerName('腾讯,科技;集团')).toBe('腾讯科技');
  });

  it('should_handle_empty_input', () => {
    expect(normalizeCustomerName('')).toBe('');
  });

  it('should_strip_multiple_suffix_layers', () => {
    // 控股 / 控股有限公司 是企业后缀，会被剥离
    expect(normalizeCustomerName('华为投资控股有限公司')).toBe('华为投资');
    expect(normalizeCustomerName('某公司集团分公司')).toBe('某');
  });
});

describe('isSameCustomer', () => {
  it('should_return_true_for_equivalent_names_with_different_suffixes', () => {
    expect(isSameCustomer('南京证券', '南京证券股份有限公司')).toBe(true);
    expect(isSameCustomer('江苏银行', '江苏银行股份有限公司')).toBe(true);
  });

  it('should_return_false_for_different_customers', () => {
    expect(isSameCustomer('南京证券', '江苏银行')).toBe(false);
  });

  it('should_be_case_insensitive', () => {
    expect(isSameCustomer('NANJING', 'nanjing')).toBe(true);
  });
});
