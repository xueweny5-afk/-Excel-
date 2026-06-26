import { describe, expect, it } from 'vitest';
import {
  buildRecordId,
  inferQuarter,
  normalizeHeader,
  parseAmount,
  parseForecast,
  parseRate,
  sanitizeRow,
} from '../parser';

/* ========== parseAmount ========== */
describe('parseAmount', () => {
  it('should_return_0_for_null_undefined_empty', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
  });

  it('should_return_0_for_non_numeric_string', () => {
    expect(parseAmount('abc')).toBe(0);
  });

  it('should_parse_plain_number', () => {
    expect(parseAmount('123.45')).toBe(123.45);
  });

  it('should_strip_thousands_separator', () => {
    expect(parseAmount('1,234,567')).toBe(1234567);
  });

  it('should_multiply_by_10000_for_亿_unit', () => {
    expect(parseAmount('1.5亿')).toBe(15000);
    expect(parseAmount('2亿')).toBe(20000);
  });

  it('should_keep_as_is_for_万_unit', () => {
    expect(parseAmount('500万')).toBe(500);
    expect(parseAmount('1234万')).toBe(1234);
  });

  it('should_handle_numeric_input_directly', () => {
    expect(parseAmount(100)).toBe(100);
  });
});

/* ========== parseRate (H2 回归测试) ========== */
describe('parseRate', () => {
  it('should_return_0_for_empty', () => {
    expect(parseRate('')).toBe(0);
    expect(parseRate(null)).toBe(0);
    expect(parseRate(undefined)).toBe(0);
  });

  it('should_parse_decimal_as_is', () => {
    expect(parseRate('0.85')).toBe(0.85);
    expect(parseRate('0.5')).toBe(0.5);
  });

  it('should_parse_percent_with_%_sign', () => {
    expect(parseRate('50%')).toBe(0.5);
    expect(parseRate('85%')).toBe(0.85);
    expect(parseRate('100%')).toBe(1);
  });

  it('REGRESSION_H2_should_NOT_divide_decimal_above_1', () => {
    // 修复前 bug：1.5 被误判为百分比 → 0.015
    expect(parseRate('1.5')).toBe(1.5);
    expect(parseRate('1.2')).toBe(1.2);
    expect(parseRate('2')).toBe(2);
  });

  it('should_handle_numeric_input', () => {
    expect(parseRate(0.7)).toBe(0.7);
    expect(parseRate(70)).toBe(70);
  });
});

/* ========== parseForecast ========== */
describe('parseForecast', () => {
  it('should_classify_commit_keywords', () => {
    expect(parseForecast('Commit')).toBe('Commit');
    expect(parseForecast('commit')).toBe('Commit');
    expect(parseForecast('是')).toBe('Commit');
    expect(parseForecast('确认')).toBe('Commit');
  });

  it('should_classify_best_case', () => {
    expect(parseForecast('Best Case')).toBe('Best Case');
    expect(parseForecast('best case')).toBe('Best Case');
  });

  it('should_classify_pipeline', () => {
    expect(parseForecast('Pipeline')).toBe('Pipeline');
    expect(parseForecast('争取')).toBe('Pipeline');
  });

  it('should_classify_omitted', () => {
    expect(parseForecast('Omitted')).toBe('Omitted');
    expect(parseForecast('否')).toBe('Omitted');
  });

  it('should_return_unknown_for_unrecognized', () => {
    expect(parseForecast('奇怪的值')).toBe('Unknown');
    expect(parseForecast('')).toBe('Unknown');
    expect(parseForecast(null)).toBe('Unknown');
  });
});

/* ========== normalizeHeader ========== */
describe('normalizeHeader', () => {
  it('should_strip_spaces_and_lowercase', () => {
    expect(normalizeHeader('Pipeline 所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('  SALES  ')).toBe('sales');
  });

  it('should_lowercase_for_case_insensitive_matching', () => {
    // normalizeHeader 的目的是做大小写无关的 header 匹配
    expect(normalizeHeader('Pipeline所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('PIPELINE 所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('  销售  ')).toBe('销售');
  });

  it('should_preserve_chinese_characters', () => {
    expect(normalizeHeader('客户名称')).toBe('客户名称');
  });
});

/* ========== sanitizeRow (防护原型链污染) ========== */
describe('sanitizeRow', () => {
  it('should_remove_dangerous_keys', () => {
    const row = sanitizeRow({
      owner: '金柳',
      __proto__: { polluted: true } as unknown as string,
      constructor: 'hack',
      prototype: 'bad' as unknown as string,
    });
    expect(row.owner).toBe('金柳');
    // 注意：'__proto__' in row 在 JS 中表现特殊（返回对象原型链结果），
    // 应通过 Object.keys 或 hasOwnProperty 验证
    expect(Object.keys(row)).not.toContain('__proto__');
    expect(Object.keys(row)).not.toContain('constructor');
    expect(Object.keys(row)).not.toContain('prototype');
  });

  it('should_trim_string_values', () => {
    const row = sanitizeRow({ customerName: '  南京证券  ' });
    expect(row.customerName).toBe('南京证券');
  });

  it('should_truncate_oversized_strings', () => {
    const big = 'x'.repeat(20000);
    const row = sanitizeRow({ note: big });
    expect((row.note as string).length).toBeLessThanOrEqual(10000);
  });

  it('should_preserve_non_string_values', () => {
    const row = sanitizeRow({ amount: 100, active: true });
    expect(row.amount).toBe(100);
    expect(row.active).toBe(true);
  });

  it('should_strip_trimmed_dangerous_keys', () => {
    const row = sanitizeRow({ '  __proto__  ': 'x' });
    expect('  __proto__  ' in row).toBe(false);
  });
});

/* ========== buildRecordId (H1 稳定性测试) ========== */
describe('buildRecordId', () => {
  it('should_combine_rowNumber_with_business_fields', () => {
    expect(buildRecordId(0, '金柳', '南京证券', '渗透测试')).toBe('0|金柳|南京证券|渗透测试');
  });

  it('should_be_stable_across_reorder', () => {
    const id1 = buildRecordId(5, 'A', 'B', 'C');
    const id2 = buildRecordId(5, 'A', 'B', 'C');
    expect(id1).toBe(id2);
  });

  it('should_differ_for_different_row_numbers', () => {
    expect(buildRecordId(0, 'A', 'B', 'C')).not.toBe(buildRecordId(1, 'A', 'B', 'C'));
  });

  it('should_differ_for_different_business_fields', () => {
    expect(buildRecordId(0, 'A', 'B', 'C')).not.toBe(buildRecordId(0, 'A', 'B', 'D'));
  });

  it('should_handle_empty_fields', () => {
    expect(buildRecordId(0, '', '', '')).toBe('0|||');
  });
});

/* ========== inferQuarter ========== */
describe('inferQuarter', () => {
  it('should_format_Q1_for_jan_mar', () => {
    expect(inferQuarter('2026-01-15')).toBe("Q1'2026");
    expect(inferQuarter('2026-03-31')).toBe("Q1'2026");
  });

  it('should_format_Q2_for_apr_jun', () => {
    expect(inferQuarter('2026-04-01')).toBe("Q2'2026");
    expect(inferQuarter('2026-06-30')).toBe("Q2'2026");
  });

  it('should_format_Q3_for_jul_sep', () => {
    expect(inferQuarter('2026-07-15')).toBe("Q3'2026");
  });

  it('should_format_Q4_for_oct_dec', () => {
    expect(inferQuarter('2026-12-31')).toBe("Q4'2026");
  });

  it('should_return_empty_for_invalid_date', () => {
    expect(inferQuarter('not-a-date')).toBe('');
    expect(inferQuarter('')).toBe('');
  });
});
