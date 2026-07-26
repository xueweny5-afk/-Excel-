import { describe, expect, it } from 'vitest';
import {
  err,
  hasArray,
  hasNumber,
  hasString,
  IMPORT_LIMITS,
  isPlainObject,
  ok,
  pickPath,
  requireFields,
  validateArrayLength,
  validateDashboardShape,
  validateStringLength,
} from '../schemaValidation';

describe('isPlainObject', () => {
  it('should_return_true_for_plain_object', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('should_return_false_for_non_objects', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject('s')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject([])).toBe(false);
  });
});

describe('pickPath', () => {
  it('should_pick_nested_value_safely', () => {
    expect(pickPath({ a: { b: 1 } }, ['a', 'b'])).toBe(1);
    expect(pickPath({ a: null }, ['a', 'b'])).toBe(undefined);
    expect(pickPath(undefined, ['a'])).toBe(undefined);
  });
});

describe('field guards', () => {
  it('should_validate_string_field', () => {
    expect(hasString({ name: 'A' }, 'name')).toBe(true);
    expect(hasString({ name: 1 }, 'name')).toBe(false);
    expect(hasString(null, 'name')).toBe(false);
  });

  it('should_validate_number_field', () => {
    expect(hasNumber({ n: 1.5 }, 'n')).toBe(true);
    expect(hasNumber({ n: NaN }, 'n')).toBe(false);
    expect(hasNumber({ n: Infinity }, 'n')).toBe(false);
    expect(hasNumber({ n: '1' }, 'n')).toBe(false);
  });

  it('should_validate_array_field', () => {
    expect(hasArray({ items: [] }, 'items')).toBe(true);
    expect(hasArray({ items: 'no' }, 'items')).toBe(false);
  });
});

describe('validateArrayLength', () => {
  it('should_pass_for_valid_array', () => {
    expect(validateArrayLength([1, 2, 3], 'items', 10)).toEqual(ok([1, 2, 3]));
  });

  it('should_fail_for_non_array', () => {
    expect(validateArrayLength('not array', 'items', 10).ok).toBe(false);
  });

  it('should_fail_when_length_exceeds_max', () => {
    const result = validateArrayLength(Array.from({ length: 1001 }), 'items', 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('1001');
  });
});

describe('validateStringLength', () => {
  it('should_pass_for_short_string', () => {
    const result = validateStringLength('hello', 'name', 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('hello');
  });

  it('should_fail_for_too_long_string', () => {
    const result = validateStringLength('a'.repeat(100), 'name', 50);
    expect(result.ok).toBe(false);
  });
});

describe('requireFields', () => {
  it('should_pass_when_all_required_present', () => {
    expect(requireFields({ a: 1, b: 2 }, ['a', 'b'], 'root').ok).toBe(true);
  });

  it('should_list_missing_fields', () => {
    const result = requireFields({ a: 1 }, ['a', 'b', 'c'], 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('b');
  });
});

describe('validateDashboardShape', () => {
  const valid = {
    ppl: [],
    summary: [],
    activity: [],
    performance: [],
    report: { fileName: 'a.xlsx', importedAt: '2026-01-01' },
  };

  it('should_pass_for_minimal_valid_shape', () => {
    expect(validateDashboardShape(valid).ok).toBe(true);
  });

  it('should_fail_when_top_level_not_object', () => {
    expect(validateDashboardShape('not object').ok).toBe(false);
  });

  it('should_fail_when_ppl_not_array', () => {
    const bad = { ...valid, ppl: 'wrong' };
    expect(validateDashboardShape(bad).ok).toBe(false);
  });

  it('should_fail_when_ppl_too_large', () => {
    const bad = { ...valid, ppl: Array.from({ length: IMPORT_LIMITS.MAX_ROWS + 1 }) };
    expect(validateDashboardShape(bad).ok).toBe(false);
  });

  it('should_fail_when_report_missing_filename', () => {
    const bad = { ...valid, report: { importedAt: 'x' } };
    expect(validateDashboardShape(bad).ok).toBe(false);
  });

  it('should_pass_with_extra_fields', () => {
    const ok = { ...valid, naCustomers: [] };
    expect(validateDashboardShape(ok).ok).toBe(true);
  });
});

describe('ok/err constructors', () => {
  it('should_build_correct_result', () => {
    const okResult = ok('value');
    expect(okResult.ok).toBe(true);
    if (okResult.ok) expect(okResult.value).toBe('value');

    const errResult = err('failure');
    expect(errResult.ok).toBe(false);
    if (!errResult.ok) expect(errResult.error).toBe('failure');
  });
});