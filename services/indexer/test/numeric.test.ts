import { describe, expect, it } from 'vitest';

import {
  fromNumericString,
  toNumericString,
  toSafeNumber,
} from '../src/utils/numeric.js';

const I128_MAX = 170141183460469231731687303715884105727n;
const I128_MIN = -170141183460469231731687303715884105728n;

describe('toNumericString', () => {
  it('stringifies bigints exactly, without float rounding', () => {
    expect(toNumericString(I128_MAX)).toBe(
      '170141183460469231731687303715884105727',
    );
    expect(toNumericString(I128_MIN)).toBe(
      '-170141183460469231731687303715884105728',
    );
  });

  it('handles small integers and zero', () => {
    expect(toNumericString(0n)).toBe('0');
    expect(toNumericString(42)).toBe('42');
    expect(toNumericString(-7)).toBe('-7');
  });

  it('returns null for absent or non-finite values', () => {
    expect(toNumericString(null)).toBeNull();
    expect(toNumericString(undefined)).toBeNull();
    expect(toNumericString(Number.NaN)).toBeNull();
    expect(toNumericString(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('fromNumericString', () => {
  it('parses decimal strings without going through a float', () => {
    expect(fromNumericString('170141183460469231731687303715884105727')).toBe(
      I128_MAX,
    );
    expect(fromNumericString('0')).toBe(0n);
    expect(fromNumericString('-7')).toBe(-7n);
  });

  it('rejects malformed input instead of coercing it', () => {
    expect(fromNumericString('')).toBeNull();
    expect(fromNumericString('1.5')).toBeNull();
    expect(fromNumericString('abc')).toBeNull();
    expect(fromNumericString(null)).toBeNull();
  });

  it('accepts a number when it is already a safe integer', () => {
    expect(fromNumericString(42)).toBe(42n);
  });
});

describe('toSafeNumber', () => {
  it('narrows values that are exactly representable', () => {
    expect(toSafeNumber(123n)).toBe(123);
    expect(toSafeNumber(0)).toBe(0);
  });

  it('refuses to silently truncate an unsafe integer', () => {
    expect(toSafeNumber(I128_MAX)).toBeNull();
    expect(toSafeNumber(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it('returns null for null', () => {
    expect(toSafeNumber(null)).toBeNull();
  });
});
