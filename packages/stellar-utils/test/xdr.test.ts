import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import {
  asBigInt,
  asItems,
  asSafeInteger,
  asString,
  decodeTopics,
  scValToNativeSafe,
} from '../src/index.js';

const I128_MAX = 170141183460469231731687303715884105727n;

describe('scValToNativeSafe', () => {
  it('decodes the scalar types the vault publishes', () => {
    expect(scValToNativeSafe(nativeToScVal('deposit'))).toBe('deposit');
    expect(scValToNativeSafe(nativeToScVal(500n))).toBe(500n);
    expect(scValToNativeSafe(nativeToScVal(true))).toBe(true);
  });

  it('decodes a vector payload into an array', () => {
    const payload = xdr.ScVal.scvVec([
      nativeToScVal(500n),
      nativeToScVal(495n),
    ]);

    expect(scValToNativeSafe(payload)).toEqual([500n, 495n]);
  });

  it('returns null for absent values instead of throwing', () => {
    expect(scValToNativeSafe(undefined)).toBeNull();
    expect(scValToNativeSafe(null)).toBeNull();
  });
});

describe('asBigInt', () => {
  it('accepts bigints and safe integers', () => {
    expect(asBigInt(500n)).toBe(500n);
    expect(asBigInt(42)).toBe(42n);
  });

  it('keeps an i128 exact', () => {
    expect(asBigInt(I128_MAX)).toBe(I128_MAX);
  });

  it('refuses anything else', () => {
    expect(asBigInt('500')).toBeNull();
    expect(asBigInt(1.5)).toBeNull();
    expect(asBigInt(null)).toBeNull();
    expect(asBigInt(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });
});

describe('asSafeInteger', () => {
  it('narrows representable values', () => {
    expect(asSafeInteger(12n)).toBe(12);
    expect(asSafeInteger(12)).toBe(12);
  });

  it('refuses an amount that would lose precision', () => {
    expect(asSafeInteger(I128_MAX)).toBeNull();
  });
});

describe('asString', () => {
  it('returns non-empty strings only', () => {
    expect(asString('deposit')).toBe('deposit');
    expect(asString('')).toBeNull();
    expect(asString(5)).toBeNull();
    expect(asString(undefined)).toBeNull();
  });
});

describe('asItems', () => {
  it('returns array elements and an empty list otherwise', () => {
    expect(asItems([1, 2])).toEqual([1, 2]);
    expect(asItems('not an array')).toEqual([]);
    expect(asItems(null)).toEqual([]);
  });
});

describe('decodeTopics', () => {
  it('decodes a topic list into strings', () => {
    expect(
      decodeTopics([nativeToScVal('deposit'), nativeToScVal('GUSER')]),
    ).toEqual(['deposit', 'GUSER']);
  });

  it('drops values that are not strings, and undefined slots', () => {
    expect(decodeTopics([nativeToScVal('yield'), undefined])).toEqual([
      'yield',
    ]);
    expect(decodeTopics([nativeToScVal(5n)])).toEqual([]);
  });
});
