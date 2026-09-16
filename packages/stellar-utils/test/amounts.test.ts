import { PRICE_SCALE } from '@yieldanchor/constants';
import { describe, expect, it } from 'vitest';

import {
  formatSharePrice,
  formatUnits,
  isValidAmountString,
  parseUnits,
} from '../src/index.js';

describe('formatUnits', () => {
  it('renders six-decimal base units', () => {
    expect(formatUnits(0n, 6)).toBe('0.000000');
    expect(formatUnits(1n, 6)).toBe('0.000001');
    expect(formatUnits(12_345n, 6)).toBe('0.012345');
    expect(formatUnits(1_000_000n, 6)).toBe('1.000000');
  });

  it('handles zero decimals', () => {
    expect(formatUnits(42n, 0)).toBe('42');
  });

  it('keeps 128-bit magnitudes exact', () => {
    expect(formatUnits(170141183460469231731687303715884105727n, 0)).toBe(
      '170141183460469231731687303715884105727',
    );
  });

  it('renders negatives', () => {
    expect(formatUnits(-1_500_000n, 6)).toBe('-1.500000');
  });

  it('rejects a non-integer or negative decimals value', () => {
    expect(() => formatUnits(1n, -1)).toThrow(RangeError);
    expect(() => formatUnits(1n, 1.5)).toThrow(RangeError);
  });
});

describe('parseUnits', () => {
  it('parses the values formatUnits renders', () => {
    expect(parseUnits('0.000001', 6)).toBe(1n);
    expect(parseUnits('1.000000', 6)).toBe(1_000_000n);
    expect(parseUnits('12.5', 6)).toBe(12_500_000n);
    expect(parseUnits('42', 0)).toBe(42n);
    expect(parseUnits('-1.5', 6)).toBe(-1_500_000n);
  });

  it('accepts shorthand decimals', () => {
    expect(parseUnits('.5', 6)).toBe(500_000n);
    expect(parseUnits('12.', 6)).toBe(12_000_000n);
  });

  it('refuses to round away precision the user typed', () => {
    expect(() => parseUnits('0.1234567', 6)).toThrow(SyntaxError);
  });

  it('rejects malformed input rather than coercing it', () => {
    for (const value of ['', 'abc', '1,5', '1e6', '--1', '0x10']) {
      expect(() => parseUnits(value, 6)).toThrow(SyntaxError);
    }
  });

  it('round-trips a large amount exactly', () => {
    const value = 170141183460469231731687303715884105727n;

    expect(parseUnits(formatUnits(value, 6), 6)).toBe(value);
  });
});

describe('isValidAmountString', () => {
  it('reports whether a string is a usable vault amount', () => {
    expect(isValidAmountString('1.5', 6)).toBe(true);
    expect(isValidAmountString('1.1234567', 6)).toBe(false);
    expect(isValidAmountString('nope', 6)).toBe(false);
  });
});

describe('formatSharePrice', () => {
  it('renders the scaled contract price as a decimal share price', () => {
    expect(formatSharePrice(PRICE_SCALE)).toBe('1.000000000000000000');
    expect(formatSharePrice(PRICE_SCALE + PRICE_SCALE / 2n)).toBe(
      '1.500000000000000000',
    );
  });
});
