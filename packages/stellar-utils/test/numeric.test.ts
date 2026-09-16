import { describe, expect, it } from 'vitest';

import {
  I128_MAX,
  I128_MIN,
  IntegerRangeError,
  assertI128,
  fromNumericString,
  isI128,
  mulDivTrunc,
  toNumericString,
  toSafeNumber,
} from '../src/index.js';

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

describe('isI128 and assertI128', () => {
  it('accepts the i128 bounds inclusive', () => {
    expect(isI128(I128_MAX)).toBe(true);
    expect(isI128(I128_MIN)).toBe(true);
    expect(isI128(I128_MAX + 1n)).toBe(false);
    expect(isI128(I128_MIN - 1n)).toBe(false);
  });

  it('throws a named range error outside the bounds', () => {
    expect(() => assertI128(I128_MAX + 1n, 'assets')).toThrow(
      IntegerRangeError,
    );
    expect(() => assertI128(I128_MAX + 1n, 'assets')).toThrow(/assets/);
    expect(assertI128(I128_MAX, 'assets')).toBe(I128_MAX);
  });
});

describe('mulDivTrunc', () => {
  it('keeps full precision for products beyond 2^53', () => {
    const shares = 170141183460469231731687303715884105727n;

    expect(mulDivTrunc(shares, 1_000_000_000_000_000_000n, 1n)).toBe(
      shares * 1_000_000_000_000_000_000n,
    );
  });

  it('truncates toward zero like Rust integer division', () => {
    expect(mulDivTrunc(10n, 1n, 3n)).toBe(3n);
    expect(mulDivTrunc(7n, 1n, 2n)).toBe(3n);
  });

  it('refuses division by zero instead of returning Infinity', () => {
    expect(() => mulDivTrunc(1n, 1n, 0n)).toThrow(/Division by zero/);
  });
});
